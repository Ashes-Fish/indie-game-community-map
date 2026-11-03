// Cities (城郭 + landmarks) and community districts (one distinctive compound per community, with a logo flag).
import * as THREE from 'three';
import { Builder, makeMaterials } from './kit.js';
import { HEX_R, rng } from './config.js';

const C = {
  wall: '#8f8778', wallTop: '#6c665c', red: '#b5392e', redD: '#8e2a22', roof: '#3e4652', roofD: '#2f353f',
  gold: '#d9a842', white: '#efe9dc', stone: '#b6aa94', stoneD: '#9a8e78', wood: '#a3784c', earth: '#c9a46c',
};

function cityCenter(b, city, R) {
  const big = city.id === 'nanjing' || city.id === 'shanghai' || city.id === 'hangzhou';
  const L = big ? 6.6 : 5.6, H = big ? 0.78 : 0.62, T = 0.42;
  b.cyl(L * 0.78, L * 0.84, 0.35, 6, '#a3967a', 0, -0.3, 0, 'std', Math.PI / 6);
  // walls with gate gaps
  const gap = 1.25;
  for (let s = 0; s < 4; s++) {
    const ry = (s * Math.PI) / 2, seg = (L - gap) / 2;
    for (const k of [-1, 1]) {
      const off = k * (gap / 2 + seg / 2);
      const x = Math.cos(ry) * off + Math.sin(ry) * (L / 2), z = -Math.sin(ry) * off + Math.cos(ry) * (L / 2);
      b.box(seg, H, T, C.wall, x, 0, z, ry);
      b.box(seg, 0.08, T + 0.08, C.wallTop, x, H, z, ry);
      // merlons
      for (let m = 0; m < Math.floor(seg / 0.42); m++) {
        const mo = -seg / 2 + 0.21 + m * 0.42;
        const mx = x + Math.cos(ry) * mo, mz = z - Math.sin(ry) * mo;
        const ox = Math.sin(ry) * T * 0.35, oz = Math.cos(ry) * T * 0.35;
        b.box(0.2, 0.14, 0.1, C.wallTop, mx + ox, H + 0.08, mz + oz, ry);
      }
    }
    // gate tower 城楼
    const gx = Math.sin(ry) * (L / 2), gz = Math.cos(ry) * (L / 2);
    b.box(gap + 0.6, H + 0.22, T + 0.5, C.wall, gx, 0, gz, ry);
    b.box(gap * 0.8, 0.5, 0.18, '#3a2e26', gx + Math.sin(ry) * (T / 2 + 0.2), 0, gz + Math.cos(ry) * (T / 2 + 0.2), ry);
    b.hall(gap + 0.2, 0.62, 0.42, C.red, C.roof, gx, H + 0.22, gz, ry, { tiers: s === 0 ? 2 : 1, ridgeColor: C.gold, roofH: 0.42 });
    // corner towers
    const cx = (s & 1 ? 1 : -1) * L / 2, cz = (s & 2 ? 1 : -1) * L / 2;
    b.box(0.85, H + 0.25, 0.85, C.wall, cx, 0, cz);
    b.hall(0.6, 0.6, 0.3, C.red, C.roof, cx, H + 0.25, cz, 0, { roofH: 0.45 });
  }
  // inner city: lanes of white-wall houses
  const inner = L / 2 - 0.55;
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
    if (Math.abs(i) <= 1 && Math.abs(j) <= 1) continue;
    if (R() < 0.18) continue;
    const x = i * inner / 3.4 + (R() - 0.5) * 0.15, z = j * inner / 3.4 + (R() - 0.5) * 0.15;
    if (Math.abs(x) > inner || Math.abs(z) > inner) continue;
    const w = 0.55 + R() * 0.25, d = 0.4 + R() * 0.15, hh = 0.3 + (R() < 0.3 ? 0.25 : 0);
    const ry = R() < 0.5 ? 0 : Math.PI / 2;
    b.box(w, hh, d, R() < 0.85 ? C.white : '#d8cdb8', x, 0, z, ry);
    b.gable(w, d, 0.2, R() < 0.8 ? C.roof : C.roofD, x, hh, z, ry);
  }
  // central drum tower 鼓楼
  b.box(2.0, 0.7, 1.5, C.stone, 0, 0, 0);
  b.box(1.0, 0.7, 1.52, '#5b4636', 0, 0, 0);
  b.hall(1.5, 1.0, 0.55, C.red, C.roof, 0, 0.7, 0, 0, { tiers: 2, ridgeColor: C.gold, roofH: 0.45 });
  // trees inside
  for (let k = 0; k < 6; k++) {
    const a = R() * 6.28, r = 1.4 + R() * 1.2;
    b.cyl(0.04, 0.06, 0.3, 5, '#5a3e28', Math.cos(a) * r, 0, Math.sin(a) * r);
    b.sphere(0.32 + R() * 0.12, R() < 0.5 ? '#4f8a2c' : '#3d7a30', Math.cos(a) * r, 0.5, Math.sin(a) * r, 'std', 0);
  }
  return L;
}

function landmark(b, city, L, R) {
  if (city.landmark === 'pearl') { // 东方明珠
    const x = L / 2 + 2.1, z = 0.6;
    b.cyl(0.9, 1.1, 0.25, 8, C.stone, x, 0, z);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.09, 0.12, 2.6, 6);
      g.rotateZ(0.32); g.rotateY(a); g.translate(x + Math.cos(a) * 0.45, 1.25, z - Math.sin(a) * 0.45);
      b.geo(g, '#e8e2dc');
    }
    b.cyl(0.13, 0.16, 5.4, 8, '#ede7df', x, 0, z);
    b.sphere(0.62, '#c8326a', x, 2.25, z, 'std', 1);
    b.sphere(0.42, '#c8326a', x, 4.25, z, 'std', 1);
    b.sphere(0.2, '#d24a7d', x, 5.5, z, 'std', 1);
    b.cyl(0.03, 0.05, 1.2, 5, '#e6e0d8', x, 5.6, z);
    for (const yy of [2.25, 4.25]) b.torus(0.64 * (yy < 3 ? 1 : 0.68), 0.03, '#ffe2a8', x, yy, z, Math.PI / 2, 0, 'emis');
    return [x, z];
  }
  if (city.landmark === 'tianning') { b.pagoda(9, 0.85, 0.42, '#c98a3a', C.roofD, L / 2 + 1.6, 0, -1.2, { spire: C.gold }); return; }
  if (city.landmark === 'fangta') { b.pagoda(7, 0.75, 0.4, '#d9cfbd', C.roofD, -L / 2 - 1.3, 0, 1.0, { spire: C.gold }); return; }
  if (city.landmark === 'gate') { // Nanjing 中华门: a massive stacked south gate
    b.box(2.6, 1.0, 1.4, '#8b8273', 0, 0, L / 2 + 0.35);
    b.box(2.0, 0.4, 1.0, '#8b8273', 0, 1.0, L / 2 + 0.35);
    for (const dx of [-0.6, 0, 0.6]) b.box(0.36, 0.55, 0.06, '#2f2620', dx, 0, L / 2 + 1.06);
    return;
  }
  if (city.landmark === 'leifeng') return; // built at West Lake separately
}

export function buildCities(world, cities, shared) {
  const mats = makeMaterials();
  const group = new THREE.Group();
  cities.forEach((city, i) => {
    const R = rng(100 + i * 31);
    const b = new Builder();
    const L = cityCenter(b, city, R);
    landmark(b, city, L, R);
    const g = b.build(mats);
    g.position.set(city.x, city.y - 0.02, city.z);
    city.group = g;
    group.add(g);
  });
  return { group, mats };
}

// ---- West Lake extras: Leifeng pagoda, Su causeway, Broken bridge ----
export function buildWestLake(world, rivers) {
  const mats = makeMaterials();
  const pts = rivers.westLake; // polygon
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  const b = new Builder();
  // Su causeway: a green strip with willows crossing north-south on the west side
  const y0 = world.heightY(cx, cz) + 0.02;
  const g = new THREE.BoxGeometry(0.18, 0.1, 5.4);
  b.geo(g, '#6aa040', cx - 0.7, y0, cz, 0.15);
  for (let k = -5; k <= 5; k++) {
    b.sphere(0.16, '#7fbf4a', cx - 0.7 + Math.sin(0.15) * k * 0.45, y0 + 0.2, cz + k * 0.45, 'std', 0);
  }
  // Leifeng pagoda on the south shore hill
  const px = cx + 1.2, pz = cz + 3.9;
  const py = world.heightY(px, pz);
  b.pagoda(5, 0.9, 0.5, '#b5652e', C.roofD, px, py, pz, { round: true, spire: C.gold, plinthColor: C.stone });
  const grp = b.build(mats);
  return grp;
}

// ---- districts ----
function distBase(b, color) {
  b.cyl(HEX_R * 0.62, HEX_R * 0.66, 0.2, 6, color, 0, -0.17, 0, 'std', Math.PI / 6);
  b.cyl(HEX_R * 0.66, HEX_R * 0.7, 0.12, 6, '#6f8a46', 0, -0.2, 0, 'std', Math.PI / 6);
}

const STYLES = {
  guild(b, R) { // 会馆 courtyard + opera stage
    distBase(b, '#b3a589');
    const W = 4.4, D = 3.8, H = 0.5;
    for (const [w, d, x, z] of [[W, 0.2, 0, -D / 2], [0.2, D, -W / 2, 0], [0.2, D, W / 2, 0], [1.6, 0.2, -1.4, D / 2], [1.6, 0.2, 1.4, D / 2]]) {
      b.box(w, H, d, C.white, x, 0, z); b.box(w + 0.08, 0.07, d + 0.08, C.roofD, x, H, z);
    }
    b.hall(1.1, 0.55, 0.55, C.red, C.roof, 0, 0, D / 2, 0, { ridgeColor: C.gold });
    b.box(3.2, 0.25, 1.4, C.stone, 0, 0, -1.0);
    b.hall(2.6, 1.1, 0.75, C.red, '#2f3d52', 0, 0.25, -1.0, 0, { tiers: 2, ridgeColor: C.gold, roofH: 0.42 });
    b.hall(0.8, 1.6, 0.5, C.red, C.roof, -1.55, 0, 0.5, 0);
    b.hall(0.8, 1.6, 0.5, C.red, C.roof, 1.55, 0, 0.5, 0);
    // opera stage
    for (const [x, z] of [[-0.45, 0.25], [0.45, 0.25], [-0.45, 0.95], [0.45, 0.95]]) b.cyl(0.05, 0.05, 0.6, 5, C.red, x, 0.2, z);
    b.box(1.2, 0.2, 1.0, C.stone, 0, 0, 0.6);
    b.roof(1.5, 1.3, 0.42, C.roof, 0, 0.8, 0.6, 0, { ridgeColor: C.gold, lift: 0.3 });
    for (const x of [-1.9, 1.9]) b.sphere(0.12, '#ff5a3a', x, 0.7, D / 2 + 0.25, 'emis', 0);
  },
  tulou(b, R) { // round communal house: everybody lives together
    distBase(b, '#b9a07a');
    const ro = 2.05, ri = 1.45, H = 1.15;
    const outer = new THREE.CylinderGeometry(ro, ro, H, 28, 1, true).translate(0, H / 2, 0);
    b.geo(outer, '#d2ad74');
    const inner = new THREE.CylinderGeometry(ri, ri, H, 28, 1, true).translate(0, H / 2, 0).scale(-1, 1, 1);
    b.geo(inner, '#e5cfa6');
    const roof = new THREE.LatheGeometry([new THREE.Vector2(ro + 0.32, H - 0.08), new THREE.Vector2((ro + ri) / 2, H + 0.42), new THREE.Vector2(ri - 0.25, H - 0.05)], 28);
    b.geo(roof, '#4a4440');
    // windows ring
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      for (const yy of [0.55, 0.85]) b.box(0.12, 0.12, 0.04, '#3b2a1e', Math.cos(a) * (ro + 0.01), yy, Math.sin(a) * (ro + 0.01), -a + Math.PI / 2);
    }
    // warm lights inside the ring (people at home)
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + 0.3; b.box(0.12, 0.12, 0.04, '#ffcf73', Math.cos(a) * (ri - 0.01), 0.75, Math.sin(a) * (ri - 0.01), -a + Math.PI / 2, 'emis'); }
    b.box(0.6, 0.6, 0.12, '#3b2a1e', 0, 0, ro, 0);
    // courtyard hall
    b.hall(0.9, 0.7, 0.4, C.red, C.roof, 0, 0, -0.2, 0, { ridgeColor: C.gold });
    b.cyl(0.22, 0.22, 0.12, 10, '#7c8a92', 0.6, 0, 0.6);
  },
  cyber(b, R) { // Cyberia Coffee Club: neon tower with a pagoda roof + coffee pavilion
    distBase(b, '#8d8e8c');
    const w = 1.5, h = 3.4;
    b.box(w, h, w, '#262a35', -0.6, 0, -0.5);
    for (let k = 0; k < 7; k++) {
      const yy = 0.35 + k * 0.42;
      b.box(w + 0.02, 0.07, w + 0.02, k % 2 ? '#3ff2ff' : '#ff4fd8', -0.6, yy, -0.5, 0, 'emis');
    }
    b.roof(w * 1.6, w * 1.6, 0.6, '#1d2230', -0.6, h, -0.5, 0, { ridgeColor: '#3ff2ff', lift: 0.45 });
    b.cyl(0.03, 0.05, 1.1, 5, '#9aa3ad', -0.6, h + 0.55, -0.5);
    b.sphere(0.09, '#ff3048', -0.6, h + 1.7, -0.5, 'emis', 0);
    // coffee pavilion with glass
    b.box(1.9, 0.08, 1.3, C.stone, 1.0, 0, 0.9);
    b.box(1.7, 0.7, 1.1, '#ffd590', 1.0, 0.08, 0.9, 0, 'emis');
    b.box(1.8, 0.08, 1.2, '#2a2420', 1.0, 0.78, 0.9);
    b.box(0.9, 0.24, 0.05, '#ff4fd8', 1.0, 0.92, 1.52, 0, 'emis');
    b.box(0.2, 0.2, 0.2, '#ff8c3a', -1.6, 0, 1.2, 0.4);
    for (const [x, z] of [[1.9, -0.6], [-1.9, 0.6], [0.6, -1.7]]) { b.cyl(0.04, 0.05, 0.3, 5, '#5a3e28', x, 0, z); b.sphere(0.32, '#3f8a3a', x, 0.5, z, 'std', 0); }
  },
  observatory(b, R) { // 星游集: stepped star-gazing platform with an armillary sphere and a floating star
    distBase(b, '#b5a98e');
    b.box(3.4, 0.45, 3.4, '#a69a84', 0, 0, -0.3);
    b.box(2.5, 0.45, 2.5, '#b4a890', 0, 0.45, -0.3);
    b.box(1.6, 0.45, 1.6, '#c2b69c', 0, 0.9, -0.3);
    b.box(0.6, 0.95, 1.2, '#9b8f78', 0, 0, 1.6);
    const y = 1.35 + 0.75;
    b.torus(0.62, 0.045, C.gold, 0, y, -0.3, Math.PI / 2, 0);
    b.torus(0.62, 0.045, C.gold, 0, y, -0.3, 0, 0.6);
    b.torus(0.62, 0.045, C.gold, 0, y, -0.3, 0.8, -0.6);
    b.cyl(0.05, 0.07, 0.75, 5, '#6a5032', 0, 1.35, -0.3);
    b.sphere(0.14, '#e8f0ff', 0, y, -0.3, 'emis', 1);
    b.hall(1.1, 0.7, 0.45, C.red, C.roof, -2.0, 0, 1.2, 0.2, { ridgeColor: C.gold });
    b.hall(1.1, 0.7, 0.45, C.red, C.roof, 2.0, 0, 1.0, -0.2, { ridgeColor: C.gold });
  },
  paifang(b, R) { // 创乐坊: memorial archway leading into a lantern-lit market street
    distBase(b, '#b0a487');
    const z0 = 2.0;
    for (const x of [-1.25, -0.42, 0.42, 1.25]) b.box(0.16, 1.4, 0.16, C.red, x, 0, z0);
    b.box(2.9, 0.16, 0.22, C.gold, 0, 1.25, z0);
    b.roof(1.3, 0.55, 0.32, '#2f6b5a', 0, 1.62, z0, 0, { ridgeColor: C.gold, lift: 0.22 });
    b.box(0.9, 0.2, 0.06, '#1f3a5c', 0, 1.42, z0 + 0.12);
    b.roof(1.0, 0.5, 0.26, '#2f6b5a', -0.95, 1.38, z0, 0, { ridgeColor: C.gold, lift: 0.2 });
    b.roof(1.0, 0.5, 0.26, '#2f6b5a', 0.95, 1.38, z0, 0, { ridgeColor: C.gold, lift: 0.2 });
    b.box(0.8, 0.02, 3.6, '#8a7f6c', 0, 0.01, 0.0);
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const z = 1.1 - k * 0.95, x = side * 1.15;
      const two = (k + (side > 0 ? 1 : 0)) % 2 === 0;
      b.box(0.9, two ? 0.75 : 0.5, 0.8, C.white, x, 0, z);
      b.box(0.92, 0.05, 0.82, '#5a3e2a', x, 0.42, z);
      b.gable(0.8, 0.95, 0.28, C.roof, x, two ? 0.75 : 0.5, z, Math.PI / 2);
      b.sphere(0.08, '#ff4a2a', x - side * 0.5, 0.48, z, 'emis', 0);
    }
  },
  savepoint(b, R) { // 存档点: hexagonal pavilion sheltering a glowing save crystal
    distBase(b, '#aca08a');
    b.cyl(1.45, 1.55, 0.25, 6, C.stone, 0, 0, 0, 'std', Math.PI / 6);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.cyl(0.06, 0.06, 1.05, 6, C.red, Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1); }
    const roof = new THREE.ConeGeometry(1.75, 0.9, 6, 3);
    const p = roof.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const t = (0.45 - y) / 0.9; p.setY(i, y - Math.sin(t * Math.PI) * 0.12 + Math.pow(t, 6) * 0.22); }
    roof.computeVertexNormals(); roof.translate(0, 1.3 + 0.45, 0);
    b.geo(roof, '#2f4a5c', 0, 0, 0, Math.PI / 6);
    b.sphere(0.12, C.gold, 0, 2.25, 0, 'std', 0);
    b.cyl(0.25, 0.32, 0.3, 6, '#7c7468', 0, 0.25, 0);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.78; b.box(0.18, 0.4, 0.18, '#8a8070', Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4); b.box(0.12, 0.1, 0.12, '#ffd36b', Math.cos(a) * 2.4, 0.3, Math.sin(a) * 2.4, 0, 'emis'); }
  },
  pinewood(b, R) { // Pinewood Lab: timber art studio in a pine grove + a red sculpture
    distBase(b, '#9f9a7c');
    b.box(2.6, 0.9, 1.5, '#b88a58', -0.3, 0, -0.4);
    b.box(2.2, 0.62, 0.05, '#ffe2b0', -0.3, 0.12, 0.36, 0, 'emis');
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.65, 0); s.lineTo(0, 0.42); s.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false }).translate(-1.6 + k * 0.65, 0.9, -1.15);
      b.geo(g, '#5b4a3a');
    }
    b.torus(0.45, 0.09, '#d63b2f', 1.6, 0.55, 1.1, 0, 0.6);
    b.box(0.4, 0.12, 0.4, C.stone, 1.6, 0, 1.1);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + R(), r = 2.3 + R() * 0.9;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.9 + R() * 0.5;
      b.cyl(0.05, 0.08, 0.5 * s, 5, '#5a3e28', x, 0, z);
      b.cone(0.42 * s, 0.9 * s, 6, '#2c5e36', x, 0.35 * s, z);
      b.cone(0.3 * s, 0.75 * s, 6, '#336a3c', x, 0.85 * s, z);
      b.cone(0.18 * s, 0.55 * s, 6, '#3b7442', x, 1.3 * s, z);
    }
  },
};

function makeFlagTexture(cm, color, img) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 170;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 170);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 150, 256, 20);
  g.strokeStyle = '#f2cf72'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 158);
  g.fillStyle = '#f7eedb';
  const S = 120, x = 128 - S / 2, y = 85 - S / 2;
  g.beginPath(); g.roundRect(x - 4, y - 4, S + 8, S + 8, 16); g.fill();
  if (img) {
    g.save(); g.beginPath(); g.roundRect(x, y, S, S, 12); g.clip(); g.drawImage(img, x, y, S, S); g.restore();
  } else {
    g.fillStyle = '#1b2a48'; g.beginPath(); g.roundRect(x, y, S, S, 12); g.fill();
    g.fillStyle = '#f2cf72'; g.font = '700 84px "Songti SC","STSong","Noto Serif SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('存', 128, 90);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, canvas: c };
}

export function makeFlag(cm, color, img, shared) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.6 }));
  pole.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 4.66, 0), new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.6, roughness: 0.3 }));
  const { tex } = makeFlagTexture(cm, color, img);
  const geo = new THREE.PlaneGeometry(2.4, 1.6, 16, 6).translate(1.2, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fx = position.x / 2.4;
        transformed.z += sin(position.x * 3.2 - uTime * 4.2) * 0.13 * fx + sin(position.x * 5.1 - uTime * 6.3 + position.y * 2.0) * 0.04 * fx;
        transformed.y -= fx * fx * 0.08;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float fx0 = position.x / 2.4;
        objectNormal = normalize(vec3(-cos(position.x * 3.2 - uTime * 4.2) * 0.42 * fx0, 0.0, 1.0));`);
  };
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(0.06, 3.7, 0);
  cloth.castShadow = true;
  grp.add(pole, knob, cloth);
  return grp;
}

export function buildDistricts(world, communities, cities, shared, logos) {
  const group = new THREE.Group();
  for (const cm of communities) {
    const city = cities.find((c) => c.id === cm.cityId);
    const R = rng(cm.key.length * 977 + 13);
    const b = new Builder();
    STYLES[cm.style](b, R);
    const mats = makeMaterials();
    const g = b.build(mats);
    const holder = new THREE.Group();
    holder.add(g);
    // orient the compound to face the camera (south) with a slight random twist
    g.rotation.y = (R() - 0.5) * 0.25;
    const flag = makeFlag(cm, city.color, logos[cm.logo], shared);
    flag.position.set(2.7, 0, 2.0);
    flag.rotation.y = -0.35;
    holder.add(flag);
    holder.position.set(cm.x, world.heightY(cm.x, cm.z) - 0.02, cm.z);
    cm.group = holder; cm.inner = g; cm.flag = flag; cm.mats = mats;
    group.add(holder);
  }
  return group;
}
