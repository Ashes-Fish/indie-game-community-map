// Per-vertex ambient occlusion for merged building geometry, computed once in a worker and multiplied into vertex colours.
// Works for any mesh hierarchy (procedural kit buildings now, GLB models later): bakeAO(object3D).
// Mobile has no realtime AO pass, so this is what gives buildings their weight there.
import * as THREE from 'three';

const cache = new Map();   // geometry fingerprint → AO arrays (identical buildings / re-bakes reuse the result)
let worker = null, nextId = 1;
const jobs = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ao.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const j = jobs.get(e.data.id); jobs.delete(e.data.id); j(e.data.ao); };
  }
  return worker;
}

function fingerprint(arrays, radius) {
  let h = 2166136261 >>> 0, n = 0;
  for (const a of arrays) {
    n += a.length;
    const step = Math.max(1, (a.length / 512) | 0);
    for (let i = 0; i < a.length; i += step) h = Math.imul(h ^ Math.round(a[i] * 1000), 16777619) >>> 0;
  }
  return `${h}:${n}:${radius}`;
}

// Split long triangles so big flat faces (walls, plinths) get interior vertices to carry the AO gradient.
// Shared geometries (GLB instances) are tessellated once and stay shared.
const tessCache = new WeakMap();
const comp = (at, i, c) => (c === 0 ? at.getX(i) : c === 1 ? at.getY(i) : c === 2 ? at.getZ(i) : at.getW(i));
function tessellate(g0, maxEdge) {
  if (tessCache.has(g0)) return tessCache.get(g0);
  const g = g0.index ? g0.toNonIndexed() : g0;
  const names = Object.keys(g.attributes), src = names.map((k) => g.attributes[k]);
  const out = names.map(() => []);
  const P = g.attributes.position;
  const emit = (vals) => vals.forEach((v, k) => out[k].push(...v));
  const lerp = (a, b) => a.map((x, i) => (x + b[i]) / 2);
  const split = (vs, depth) => { // vs: per vertex [attr0[], attr1[], ...]
    const p = vs.map((v) => v[0]);
    const e = [0, 1, 2].map((i) => Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][1] - p[(i + 1) % 3][1], p[i][2] - p[(i + 1) % 3][2]));
    const m = Math.max(...e);
    if (m <= maxEdge || depth > 4) { for (const v of vs) emit(v); return; }
    const i = e.indexOf(m), a = vs[i], b = vs[(i + 1) % 3], c = vs[(i + 2) % 3];
    const mid = a.map((x, k) => lerp(x, b[k]));
    split([a, mid, c], depth + 1); split([mid, b, c], depth + 1);
  };
  for (let t = 0; t < P.count; t += 3) {
    const vs = [0, 1, 2].map((j) => src.map((at) => Array.from({ length: at.itemSize }, (_, c) => comp(at, t + j, c))));
    split(vs, 0);
  }
  const ng = new THREE.BufferGeometry();
  names.forEach((k, i) => ng.setAttribute(k, new THREE.Float32BufferAttribute(out[i], src[i].itemSize)));
  ng.boundingSphere = g0.boundingSphere; ng.boundingBox = g0.boundingBox;
  if (!ng.boundingSphere) ng.computeBoundingSphere();
  tessCache.set(g0, ng);
  return ng;
}

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
 * opts: radius (world units, how far occluders count), strength (0..1), rays.
 */
export function bakeAO(root, opts = {}) {
  const radius = opts.radius ?? 0.7, strength = opts.strength ?? 0.7, rays = opts.rays ?? 24;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  root.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.geometry?.attributes.position && !o.userData.noAO) meshes.push(o); });
  if (!meshes.length) return Promise.resolve();
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
  const payload = meshes.map((mesh) => {
    if (!mesh.isInstancedMesh && !mesh.material.isMeshBasicMaterial && !mesh.geometry.userData.aoBaked && mesh.geometry.groups.length < 2) {
      mesh.geometry = tessellate(mesh.geometry, radius * 0.45);
    }
    const g = mesh.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    // instanced meshes are baked on their base geometry (in its own space)
    m.copy(inv).multiply(mesh.isInstancedMesh ? root.matrixWorld : mesh.matrixWorld);
    if (mesh.isInstancedMesh) m.identity();
    nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal, n = P.count;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
    }
    const idx = g.index ? Uint32Array.from(g.index.array) : null;
    return { pos, nrm, idx };
  });
  const key = fingerprint(payload.map((p) => p.pos), radius);
  const done = (aos) => {
    cache.set(key, aos);
    meshes.forEach((mesh, i) => { if (!mesh.material.isMeshBasicMaterial) apply(mesh, aos[i], strength); });
  };
  if (cache.has(key)) { done(cache.get(key)); return Promise.resolve(); }
  return new Promise((res) => {
    const id = nextId++;
    jobs.set(id, (aos) => { done(aos); res(); });
    const transfer = payload.flatMap((p) => [p.pos.buffer, p.nrm.buffer, ...(p.idx ? [p.idx.buffer] : [])]);
    getWorker().postMessage({ id, meshes: payload, radius, rays }, transfer);
  });
}
