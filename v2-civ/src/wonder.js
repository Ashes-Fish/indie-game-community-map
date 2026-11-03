// 黄山 natural wonder: granite pillars with flat-topped pines, wrapped in a drifting sea of clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './config.js';
import { paint } from './kit.js';

function pillar(R, h, rb) {
  const g = new THREE.CylinderGeometry(rb * 0.45, rb, h, 6, 5).toNonIndexed();
  const p = g.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(key)) { const t = p.getY(i) / h + 0.5; map.set(key, [(R() - 0.5) * rb * 0.35 * (1 - t * 0.3), (R() - 0.5) * 0.15 * h / 5, (R() - 0.5) * rb * 0.35 * (1 - t * 0.3)]); }
    const d = map.get(key); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1] + h / 2, p.getZ(i) + d[2]);
  }
  g.computeVertexNormals();
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / h;
    c.set(y < 0.15 ? '#6f7c56' : '#c7c0b0').multiplyScalar(0.82 + R() * 0.3);
    if (R() < 0.12) c.set('#7f8a62');
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function pine(R, s) {
  const parts = [];
  parts.push(paint(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.5 * s, 5).translate(0, 0.25 * s, 0), '#4a3424'));
  for (let k = 0; k < 3; k++) {
    const g = new THREE.CylinderGeometry(0.42 * s * (1 - k * 0.2), 0.5 * s * (1 - k * 0.2), 0.12 * s, 7).translate((R() - 0.5) * 0.3 * s, (0.42 + k * 0.14) * s, (R() - 0.5) * 0.3 * s);
    parts.push(paint(g, k % 2 ? '#2f5a34' : '#294f2e'));
  }
  return mergeGeometries(parts);
}

export function buildHuangshan(world, x, z, shared) {
  const R = rng(1864);
  const group = new THREE.Group();
  const parts = [];
  const tops = [];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * 2.3 + R() * 0.6, r = 0.6 + Math.sqrt(i / N) * 4.2;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.85;
    const base = world.heightY(px, pz) - 0.8;
    const h = (i < 4 ? 9.5 - i * 0.6 : 5 + R() * 4) * (1 - r / 14);
    const rb = 0.75 + R() * 0.5;
    parts.push(pillar(R, h, rb).translate(px, base, pz));
    tops.push([px, base + h - 0.05, pz, rb]);
  }
  for (const [px, py, pz, rb] of tops) {
    const n = 1 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) parts.push(pine(R, 0.8 + R() * 0.5).translate(px + (R() - 0.5) * rb * 0.5, py - 0.1, pz + (R() - 0.5) * rb * 0.5));
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  // sea of clouds
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 1, transparent: true, opacity: 0.72, emissive: 0x6a7686, emissiveIntensity: 0.25, depthWrite: false });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const clouds = new THREE.Group();
  const baseY = world.heightY(x, z) + 2.4;
  for (let k = 0; k < 16; k++) {
    const a = R() * Math.PI * 2, r = 2 + R() * 6.5;
    const cl = new THREE.Group();
    const n = 3 + Math.floor(R() * 3);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(puff, cloudMat);
      const s = 0.45 + R() * 0.5;
      m.scale.set(s * 1.25, s * 0.7, s);
      m.position.set((j - n / 2) * 0.55 + (R() - 0.5) * 0.3, (R() - 0.3) * 0.25, (R() - 0.5) * 0.5);
      m.renderOrder = 4;
      cl.add(m);
    }
    cl.position.set(Math.cos(a) * r, baseY + R() * 1.6 - 0.6, Math.sin(a) * r * 0.85);
    cl.rotation.y = R() * 6.28;
    cl.userData = { a, r, sp: (0.05 + R() * 0.06) * (R() < 0.5 ? 1 : -1), y0: cl.position.y, ph: R() * 6 };
    clouds.add(cl);
  }
  clouds.position.set(x, 0, z);
  group.add(clouds);
  return {
    group,
    update(t) {
      for (const m of clouds.children) {
        const u = m.userData;
        const a = u.a + t * u.sp;
        m.position.x = Math.cos(a) * u.r; m.position.z = Math.sin(a) * u.r * 0.85;
        m.position.y = u.y0 + Math.sin(t * 0.4 + u.ph) * 0.25;
      }
    },
  };
}
