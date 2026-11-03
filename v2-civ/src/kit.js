// Tiny procedural modelling kit: vertex-coloured primitives merged per material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
export function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  _c.set(color);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function place(g, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

export class Builder {
  constructor() { this.parts = { std: [], emis: [], glass: [] }; }
  add(geo, kind = 'std') { this.parts[kind].push(geo); return geo; }
  box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0, kind) { return this.add(place(paint(new THREE.BoxGeometry(w, h, d), color), x, y + h / 2, z, ry), kind); }
  cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0, kind, ry = 0) { return this.add(place(paint(new THREE.CylinderGeometry(rt, rb, h, seg), color), x, y + h / 2, z, ry), kind); }
  cone(r, h, seg, color, x = 0, y = 0, z = 0, kind, ry = 0) { return this.add(place(paint(new THREE.ConeGeometry(r, h, seg), color), x, y + h / 2, z, ry), kind); }
  sphere(r, color, x = 0, y = 0, z = 0, kind, detail = 1) { return this.add(place(paint(new THREE.IcosahedronGeometry(r, detail), color), x, y, z), kind); }
  torus(r, t, color, x, y, z, rx = 0, ry = 0, kind) { return this.add(place(paint(new THREE.TorusGeometry(r, t, 5, 20), color), x, y, z, ry, rx), kind); }
  geo(g, color, x = 0, y = 0, z = 0, ry = 0, kind) { return this.add(place(paint(g, color), x, y, z, ry), kind); }

  // Chinese hip roof with concave slopes and upturned eave corners.
  roof(w, d, h, color, x, y, z, ry = 0, opt = {}) {
    const lift = opt.lift ?? 0.22 * Math.min(w, d), N = 6;
    const ridgeHalf = Math.max(0, (w - d) / 2);
    const g = new THREE.BufferGeometry();
    const pos = [];
    const hgt = (u, v) => { // u in [-w/2,w/2], v in [-d/2,d/2]
      const mz = Math.abs(v) / (d / 2), mx = Math.max(0, (Math.abs(u) - ridgeHalf) / (d / 2));
      const m = Math.min(1, Math.max(mz, mx));
      let yy = h * (1 - m) - h * 0.35 * m * (1 - m);
      const cx = Math.abs(u) / (w / 2), cz = Math.abs(v) / (d / 2);
      yy += lift * Math.pow(cx * cz, 5);
      return yy;
    };
    const grid = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const u = -w / 2 + (w * i) / N, v = -d / 2 + (d * j) / N;
      grid.push([u, hgt(u, v), v]);
    }
    const P = (i, j) => grid[j * (N + 1) + i];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), e = P(i + 1, j + 1);
      // choose diagonal along hip lines for crisper ridges
      if ((i < N / 2) === (j < N / 2)) pos.push(...a, ...c, ...e, ...a, ...e, ...b);
      else pos.push(...a, ...c, ...b, ...b, ...c, ...e);
    }
    // eave fascia (thin skirt so roofs don't look paper-thin)
    const skirt = Math.min(w, d) * 0.06;
    const edge = [];
    for (let i = 0; i < N; i++) edge.push([P(i, 0), P(i + 1, 0)]);
    for (let j = 0; j < N; j++) edge.push([P(N, j), P(N, j + 1)]);
    for (let i = N; i > 0; i--) edge.push([P(i, N), P(i - 1, N)]);
    for (let j = N; j > 0; j--) edge.push([P(0, j), P(0, j - 1)]);
    for (const [a, b] of edge) {
      pos.push(...a, a[0], a[1] - skirt, a[2], ...b, ...b, a[0], a[1] - skirt, a[2], b[0], b[1] - skirt, b[2]);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    this.add(place(paint(g, color), x, y, z, ry));
    // ridge
    if (opt.ridge !== false) {
      const rl = Math.max(ridgeHalf * 2, w * 0.12);
      const rc = opt.ridgeColor ?? '#3a3a3e';
      this.add(place(paint(new THREE.BoxGeometry(rl + 0.02, h * 0.16, Math.min(w, d) * 0.06), rc), x, y + h * 1.0, z, ry));
      if (ridgeHalf > 0.01) {
        const c = Math.cos(ry), s = Math.sin(ry);
        for (const sx of [-1, 1]) {
          const ox = sx * (rl / 2), oz = 0;
          this.add(place(paint(new THREE.BoxGeometry(h * 0.12, h * 0.34, h * 0.12), rc), x + ox * c + oz * s, y + h * 1.05, z - ox * s + oz * c, ry));
        }
      }
    }
    return g;
  }

  // simple gable roof (prism)
  gable(w, d, h, color, x, y, z, ry = 0) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2 - 0.04, 0); s.lineTo(d / 2 + 0.04, 0); s.lineTo(0, h); s.lineTo(-d / 2 - 0.04, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: w + 0.08, bevelEnabled: false });
    g.translate(0, 0, -(w + 0.08) / 2);
    g.rotateY(Math.PI / 2);
    return this.add(place(paint(g, color), x, y, z, ry));
  }

  // a hall: walls + (optional pillars) + roof
  hall(w, d, hw, color, roofColor, x, y, z, ry = 0, opt = {}) {
    this.box(w, hw, d, color, x, y, z, ry);
    const tiers = opt.tiers ?? 1;
    let yy = y + hw, ww = w * 1.32, dd = d * 1.4, rh = (opt.roofH ?? 0.42) * Math.min(w, d) + 0.12;
    for (let t = 0; t < tiers; t++) {
      this.roof(ww, dd, rh, roofColor, x, yy, z, ry, { ridgeColor: opt.ridgeColor, lift: opt.lift });
      if (t < tiers - 1) {
        const c2 = opt.upperColor ?? color;
        this.box(w * 0.66, hw * 0.55, d * 0.66, c2, x, yy + rh * 0.35, z, ry);
        yy += rh * 0.35 + hw * 0.55; ww *= 0.72; dd *= 0.72; rh *= 0.85;
      }
    }
  }

  pagoda(levels, base, hgt, wall, roofC, x, y, z, opt = {}) {
    let yy = y, b = base;
    if (opt.plinth !== false) { this.box(base * 1.5, hgt * 0.4, base * 1.5, opt.plinthColor ?? '#b9ad98', x, yy, z); yy += hgt * 0.4; }
    for (let i = 0; i < levels; i++) {
      const lh = hgt * (i === 0 ? 1.25 : 1);
      if (opt.round) this.cyl(b / 2, b / 2, lh, 8, wall, x, yy, z);
      else this.box(b, lh, b, wall, x, yy, z);
      yy += lh;
      const rw = b * 1.55;
      this.roof(rw, rw, b * 0.32, roofC, x, yy - 0.02, z, 0, { lift: b * 0.3, ridge: false });
      yy += b * 0.12;
      b *= opt.taper ?? 0.88;
    }
    this.cone(b * 0.3, hgt * 1.6, 6, opt.spire ?? '#d4a640', x, yy, z);
    this.sphere(b * 0.22, opt.spire ?? '#d4a640', x, yy + hgt * 0.5, z, 'std', 0);
    return yy + hgt * 1.6;
  }

  build(mats) {
    const out = new THREE.Group();
    for (const k of Object.keys(this.parts)) {
      if (!this.parts[k].length) continue;
      const g = mergeGeometries(this.parts[k].map((p) => (p.index ? p.toNonIndexed() : p)), false);
      const m = new THREE.Mesh(g, mats[k]);
      m.castShadow = k !== 'glass'; m.receiveShadow = true;
      out.add(m);
    }
    return out;
  }
}

export function makeMaterials() {
  return {
    std: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0, flatShading: true }),
    emis: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }),
  };
}
