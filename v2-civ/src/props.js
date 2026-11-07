// Instanced scenery: forests, villages, sculpted mountain peaks. Hidden under the fog of war in the vertex shader.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_COMMON } from './glsl.js';
import { paint } from './kit.js';
import { BIOME } from './world.js';
import { HEX_R, rng } from './config.js';
import { bakeAO } from './ao.js';

// Patch any material so instances collapse where the fog field is low; lit materials also get drifting cloud
// shadows, and `sway` makes foliage lean in the wind (per-tree sway plus gusts rolling across the woods).
export function fogPatch(mat, shared, lo = 0.66, hi = 0.82, sway = false) {
  const prev = mat.onBeforeCompile;
  const lit = !!mat.isMeshStandardMaterial;
  mat.customProgramCacheKey = () => `fogPatch:${lo}:${hi}:${mat.type}:${sway}`;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, shared.uniforms);
    sh.uniforms.uPropVis = mat.userData.vis || { value: 1 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nuniform float uPropVis;\nvarying vec2 vPW;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec4 ip4 = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #else
        vec4 ip4 = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      #endif
        float pvis = smoothstep(${lo.toFixed(2)}, ${hi.toFixed(2)}, fogField(ip4.xz)) * uPropVis;
        transformed *= pvis;
        vPW = ip4.xz;
      ${sway ? `#ifdef USE_INSTANCING
        float gust = 0.55 + 0.45 * sin(dot(ip4.xz, vec2(0.11, 0.07)) - uTime * 1.1);
        float swy = (sin(uTime * 1.7 + ip4.x * 0.9 + ip4.z * 0.6) * 0.6 + sin(uTime * 3.1 + ip4.z * 1.3) * 0.25 + 0.35) * gust;
        vec3 windW = vec3(0.9, 0.0, 0.45) * swy * 0.08 * smoothstep(0.25, 1.4, position.y);
        mat3 im3 = mat3(instanceMatrix);
        transformed += transpose(im3) * windW / max(dot(im3[0], im3[0]), 1e-4) * pvis;
      #endif` : ''}`);
    if (lit) {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec2 vPW;`)
        .replace('#include <aomap_fragment>', 'float cS = cloudShade(vPW); reflectedLight.directDiffuse *= cS; reflectedLight.directSpecular *= cS;\n#include <aomap_fragment>');
    }
  };
  return mat;
}

function jitter(g, amt, seed) {
  const R = rng(seed), p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) map.set(key, [(R() - 0.5) * amt, (R() - 0.5) * amt * 0.6, (R() - 0.5) * amt]);
    const d = map.get(key);
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

function treeGeos() {
  const trunk = (h) => paint(new THREE.CylinderGeometry(0.05, 0.08, h, 5).translate(0, h / 2, 0), '#6b4a2e');
  const leaf = jitter(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.9, 1), 0.18, 7).translate(0, 0.78, 0);
  const leaf2 = jitter(new THREE.IcosahedronGeometry(0.3, 0), 0.12, 9).translate(0.28, 0.6, 0.12);
  const broad = mergeGeometries([trunk(0.5), paint(leaf, '#ffffff'), paint(leaf2, '#f0f0f0')]);
  const c1 = paint(new THREE.ConeGeometry(0.42, 0.75, 6).translate(0, 0.55, 0), '#ffffff');
  const c2 = paint(new THREE.ConeGeometry(0.32, 0.62, 6).translate(0, 0.92, 0), '#f4f4f4');
  const c3 = paint(new THREE.ConeGeometry(0.2, 0.5, 6).translate(0, 1.25, 0), '#ebebeb');
  const conifer = mergeGeometries([trunk(0.35), c1, c2, c3]);
  const bush = paint(jitter(new THREE.IcosahedronGeometry(0.26, 0).scale(1.2, 0.75, 1), 0.1, 3).translate(0, 0.15, 0), '#ffffff');
  return { broad, conifer, bush };
}

function houseGeo() {
  const parts = [];
  const wall = paint(new THREE.BoxGeometry(0.62, 0.36, 0.4).translate(0, 0.18, 0), '#f4f0e6');
  const s = new THREE.Shape();
  s.moveTo(-0.25, 0); s.lineTo(0.25, 0); s.lineTo(0, 0.22); s.lineTo(-0.25, 0);
  const roof = new THREE.ExtrudeGeometry(s, { depth: 0.72, bevelEnabled: false }).translate(0, 0.36, -0.36).rotateY(Math.PI / 2);
  parts.push(wall, paint(roof, '#3b3f46'));
  // horse-head gable wall (马头墙) stub
  parts.push(paint(new THREE.BoxGeometry(0.06, 0.2, 0.46).translate(0.31, 0.44, 0), '#f4f0e6'));
  parts.push(paint(new THREE.BoxGeometry(0.08, 0.03, 0.5).translate(0.31, 0.55, 0), '#3b3f46'));
  return mergeGeometries(parts);
}

function peakGeo(seed) {
  const g = new THREE.ConeGeometry(1, 1, 7, 4).toNonIndexed();
  const R = rng(seed), p = g.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!map.has(key)) {
      const t = y + 0.5;
      const k = t > 0.98 ? 0 : 0.22 * (1 - t * 0.5);
      map.set(key, [x + (R() - 0.5) * k, y + (R() - 0.5) * 0.08 * (t < 0.98 ? 1 : 0), z + (R() - 0.5) * k]);
    }
    const v = map.get(key); p.setXYZ(i, v[0], v[1], v[2]);
  }
  g.translate(0, 0.5, 0);
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  const cg = new THREE.Color('#5b7a37'), cr = new THREE.Color('#857a68'), ct = new THREE.Color('#d9d4c8');
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    if (y < 0.28) c.copy(cg).lerp(cr, y / 0.28 * 0.4); else if (y < 0.72) c.copy(cr).multiplyScalar(0.9 + R() * 0.2); else c.copy(cr).lerp(ct, (y - 0.72) / 0.28 + 0.2);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

export function buildProps(world, shared, Q, keepOut) {
  const R = rng(1234);
  const group = new THREE.Group();
  const mat = fogPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), shared);
  const depth = fogPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), shared);
  const matTree = fogPatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), shared, 0.66, 0.82, true);
  const depthTree = fogPatch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), shared, 0.66, 0.82, true);
  const smallVis = { value: 1 };
  const matSmall = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  matSmall.userData.vis = smallVis; fogPatch(matSmall, shared);
  const depthSmall = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthSmall.userData.vis = smallVis; fogPatch(depthSmall, shared);
  const { broad, conifer, bush } = treeGeos();
  const lists = { broad: [], conifer: [], bush: [], house: [], peak0: [], peak1: [], peak2: [] };
  const free = (x, z, r = 0.5) => {
    if (world.sdf(x, z) > -0.35 * r - 0.15) return false;
    for (const k of keepOut) if (Math.hypot(x - k.x, z - k.z) < k.r) return false;
    return true;
  };
  const GREENS = ['#4f8a2a', '#5d9a2e', '#3f7a2c', '#6aa233', '#7aa63a', '#467f35'];
  const CONIF = ['#2f6a3a', '#2b5e34', '#3a7440', '#36683a'];
  const AUT = ['#c9a63a', '#d28a2e', '#b8b24a'];
  const dens = Q.trees;
  for (const h of world.hex) {
    if (h.orderKm > 10) continue;
    const b = h.biome;
    let nTree = 0, conifP = 0.3, nHouse = 0;
    if (b === BIOME.HILLS) { nTree = 30; conifP = 0.55; }
    else if (b === BIOME.MOUNTAIN) { nTree = 16; conifP = 0.75; }
    else if (b === BIOME.WOOD) { nTree = 20; conifP = 0.2; }
    else if (b === BIOME.GRASS) { nTree = 5; nHouse = R() < 0.35 ? 4 : 0; }
    else if (b === BIOME.PLAINS) { nTree = 3; nHouse = R() < 0.3 ? 3 : 0; }
    else if (b === BIOME.FARM) { nTree = 3; nHouse = R() < 0.7 ? 5 : 2; }
    else if (b === BIOME.MARSH) { nTree = 6; }
    else if (b === BIOME.URBAN || b === BIOME.DISTRICT) { nTree = 4; }
    nTree = Math.round(nTree * dens);
    // clustered placement
    const clusters = [];
    const nc = b === BIOME.HILLS || b === BIOME.WOOD || b === BIOME.MOUNTAIN ? 4 : 2;
    for (let c = 0; c < nc; c++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * HEX_R * 0.6; clusters.push([h.cx + Math.cos(a) * r, h.cz + Math.sin(a) * r]); }
    for (let t = 0; t < nTree; t++) {
      const [ccx, ccz] = clusters[t % nc];
      const spread = b === BIOME.HILLS || b === BIOME.WOOD || b === BIOME.MOUNTAIN ? 2.6 : 1.4;
      const x = ccx + (R() + R() - 1) * spread, z = ccz + (R() + R() - 1) * spread;
      if (!free(x, z)) continue;
      if (b === BIOME.MOUNTAIN && world.elevM(x, z) > 900) continue;
      const y = world.heightY(x, z);
      const isC = R() < conifP;
      const s = (0.8 + R() * 0.5) * (b === BIOME.HILLS || b === BIOME.MOUNTAIN ? 1.0 : 0.9);
      const tint = isC ? CONIF[(R() * CONIF.length) | 0] : (R() < 0.035 ? AUT[(R() * AUT.length) | 0] : GREENS[(R() * GREENS.length) | 0]);
      (isC ? lists.conifer : lists.broad).push({ x, y: y - 0.05, z, s, ry: R() * 6.28, c: tint });
      if (R() < 0.35) {
        const bx = x + (R() - 0.5) * 1.2, bz = z + (R() - 0.5) * 1.2;
        if (free(bx, bz)) lists.bush.push({ x: bx, y: world.heightY(bx, bz) - 0.03, z: bz, s: 0.7 + R() * 0.6, ry: R() * 6.28, c: GREENS[(R() * GREENS.length) | 0] });
      }
    }
    // villages: rows of white-wall houses near water
    if (nHouse && h.orderKm < 6) {
      const a = R() * Math.PI * 2, r = R() * HEX_R * 0.55;
      const vx = h.cx + Math.cos(a) * r, vz = h.cz + Math.sin(a) * r;
      const ry = Math.round(R() * 4) * (Math.PI / 2) + (R() - 0.5) * 0.3;
      for (let k = 0; k < nHouse; k++) {
        const along = (k % 3 - 1) * 0.85, across = Math.floor(k / 3) * 0.75;
        const x = vx + Math.cos(ry) * along + Math.sin(ry) * across + (R() - 0.5) * 0.15;
        const z = vz - Math.sin(ry) * along + Math.cos(ry) * across + (R() - 0.5) * 0.15;
        if (!free(x, z, 1)) continue;
        lists.house.push({ x, y: world.heightY(x, z) - 0.02, z, s: 0.95 + R() * 0.3, ry, c: '#ffffff', sy: R() < 0.25 ? 1.45 : 1 });
      }
    }
    // sculpted peaks
    if (b === BIOME.MOUNTAIN && h.orderKm < 6) {
      const cand = [];
      for (let k = 0; k < 12; k++) { const a = R() * 6.28, r = Math.sqrt(R()) * HEX_R * 0.62; const x = h.cx + Math.cos(a) * r, z = h.cz + Math.sin(a) * r; cand.push([world.elevM(x, z), x, z]); }
      cand.sort((p, q) => q[0] - p[0]);
      const np = h.maxE > 1000 ? 3 : 2;
      const used = [];
      for (const [e, x, z] of cand) {
        if (used.length >= np) break;
        if (used.some(([ux, uz]) => Math.hypot(ux - x, uz - z) < 2.6)) continue;
        if (!free(x, z, 2)) continue;
        used.push([x, z]);
        const hh = 2.2 + Math.min(e, 1600) / 1600 * 3.2 + R() * 0.8;
        lists['peak' + ((R() * 3) | 0)].push({ x, y: world.heightY(x, z) - 0.6, z, s: 1.5 + R() * 0.7, sy: hh, ry: R() * 6.28, c: '#ffffff' });
      }
    }
  }
  const geos = { broad, conifer, bush, house: houseGeo(), peak0: peakGeo(11), peak1: peakGeo(23), peak2: peakGeo(37) };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const meshes = {};
  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const small = k === 'house' || k === 'bush';
    const tree = k === 'broad' || k === 'conifer';
    const im = new THREE.InstancedMesh(geos[k], small ? matSmall : tree ? matTree : mat, list.length);
    list.forEach((it, i) => {
      e.set(0, it.ry, 0); q.setFromEuler(e);
      sc.set(it.s, (it.sy ?? 1) * (k.startsWith('peak') ? 1 : it.s), it.s);
      m4.compose(v.set(it.x, it.y, it.z), q, sc);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(it.c));
    });
    im.castShadow = true; im.receiveShadow = true;
    im.customDepthMaterial = small ? depthSmall : tree ? depthTree : depth;
    im.computeBoundingSphere();
    group.add(im);
    meshes[k] = im;
  }
  // grounded, volumetric foliage and houses: bake AO once on each base geometry (in the AO worker)
  for (const k of ['broad', 'conifer', 'bush', 'house']) if (meshes[k]) bakeAO(meshes[k], { radius: k === 'house' ? 0.3 : 0.4, strength: 0.75, rays: 20 });
  return { group, meshes, houses: lists.house, setDist(d) { smallVis.value = Math.min(1, Math.max(0, (300 - d) / 90)); }, counts: Object.fromEntries(Object.entries(lists).map(([k, l]) => [k, l.length])) };
}
