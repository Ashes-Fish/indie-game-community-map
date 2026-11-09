// Per-vertex ambient occlusion for merged building geometry, computed once in a worker and multiplied into vertex colours.
// Works for any mesh hierarchy (procedural kit buildings; GLB models carry baked AO in their textures and opt out with
// userData.noAO): bakeAO(object3D). Mobile has no realtime AO pass, so this is what gives buildings their weight there.
// The main thread only copies attribute arrays out; transforming, tessellating and tracing all happen in the worker.
import * as THREE from 'three';

const cache = new Map();   // payload fingerprint → worker result (identical buildings / re-bakes reuse it)
let worker = null, nextId = 1;
const jobs = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ao.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j(e.data); };
  }
  return worker;
}

function fingerprint(payload, radius) {
  let h = 2166136261 >>> 0, n = 0;
  for (const p of payload) {
    const a = p.attrs.find((x) => x.name === 'position').array;
    n += a.length;
    const step = Math.max(1, (a.length / 512) | 0);
    for (let i = 0; i < a.length; i += step) h = Math.imul(h ^ Math.round(a[i] * 1000), 16777619) >>> 0;
    for (const v of p.matrix) h = Math.imul(h ^ Math.round(v * 1000), 16777619) >>> 0;
  }
  return `${h}:${n}:${radius}`;
}

// source geometry → its tessellated copy (shared geometries, e.g. GLB instances, stay shared)
const tessCache = new WeakMap();

function apply(mesh, ao, strength) {
  const g = mesh.geometry;
  if (g.userData.aoBaked) return;
  g.userData.aoBaked = true; g.userData.ao = ao;
  const n = g.attributes.position.count;
  let col = g.attributes.color;
  if (!col) {
    col = new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3);
    g.setAttribute('color', col);
    mesh.material.vertexColors = true; mesh.material.needsUpdate = true;
  }
  for (let i = 0; i < n; i++) {
    const o = 1 - strength * (1 - ao[i]);
    // occluded corners lean slightly warm, like light bounced off earth and timber
    col.setXYZ(i, col.getX(i) * o, col.getY(i) * o, col.getZ(i) * o * (0.88 + 0.12 * o));
  }
  col.needsUpdate = true;
}

/**
 * Bake AO into every lit mesh under `root`; all meshes under root occlude each other, and a ground plane at the
 * lowest point occludes downward rays (contact darkening). Emissive (MeshBasic) meshes occlude but stay bright.
 * Long triangles of plain meshes are split first (in the worker) so big flat faces carry the AO gradient.
 * opts: radius (world units, how far occluders count), strength (0..1), rays.
 */
export function bakeAO(root, opts = {}) {
  const radius = opts.radius ?? 0.7, strength = opts.strength ?? 0.7, rays = opts.rays ?? 24;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.geometry?.attributes.position && !o.userData.noAO) meshes.push(o); });
  if (!meshes.length) return Promise.resolve();
  const m = new THREE.Matrix4();
  const payload = meshes.map((mesh) => {
    if (tessCache.has(mesh.geometry)) mesh.geometry = tessCache.get(mesh.geometry);
    const g = mesh.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    const tess = !mesh.isInstancedMesh && !mesh.material.isMeshBasicMaterial && !g.userData.aoBaked && !g.userData.tessellated && g.groups.length < 2;
    if (!mesh.material.isMeshBasicMaterial && !g.attributes.color) {
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      mesh.material.vertexColors = true; mesh.material.needsUpdate = true;
    }
    // instanced meshes are baked on their base geometry (in its own space)
    m.copy(inv).multiply(mesh.isInstancedMesh ? root.matrixWorld : mesh.matrixWorld);
    if (mesh.isInstancedMesh) m.identity();
    const attrs = Object.entries(g.attributes).map(([name, at]) => ({ name, itemSize: at.itemSize, array: Float32Array.from(at.array) }));
    return { attrs, idx: g.index ? Uint32Array.from(g.index.array) : null, matrix: m.toArray(), maxEdge: tess ? radius * 0.45 : 0 };
  });
  const key = fingerprint(payload, radius);
  const done = (res) => {
    cache.set(key, res);
    meshes.forEach((mesh, i) => {
      const t = res.geos[i];
      if (t && !mesh.geometry.userData.tessellated) {
        const ng = new THREE.BufferGeometry();
        for (const a of t) ng.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize));
        ng.boundingSphere = mesh.geometry.boundingSphere; ng.boundingBox = mesh.geometry.boundingBox;
        if (!ng.boundingSphere) ng.computeBoundingSphere();
        ng.userData.tessellated = true;
        tessCache.set(mesh.geometry, ng);
        mesh.geometry = ng;
      }
      if (!mesh.material.isMeshBasicMaterial) apply(mesh, res.aos[i], strength);
    });
  };
  if (cache.has(key)) { done(cache.get(key)); return Promise.resolve(); }
  return new Promise((res) => {
    const id = nextId++;
    jobs.set(id, (r) => { done(r); res(); });
    const transfer = payload.flatMap((p) => [...p.attrs.map((a) => a.array.buffer), ...(p.idx ? [p.idx.buffer] : [])]);
    getWorker().postMessage({ id, meshes: payload, radius, rays }, transfer);
  });
}
