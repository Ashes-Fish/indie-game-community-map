import * as THREE from 'three';
import { RES_H, RES_W, elevToY, HEX_R, HEX_W, SQ3, HEX_DIRS, hexCenter, worldToHex, toWorld, hexDist, hash2 } from './config.js';
import { layoutCities } from './layout.js';

export const BIOME = { OCEAN: 0, COAST: 1, LAKE: 2, GRASS: 3, PLAINS: 4, FARM: 5, WOOD: 6, HILLS: 7, MOUNTAIN: 8, MARSH: 9, URBAN: 10, DISTRICT: 11 };
export const FLAG = { CITY: 1, DISTRICT: 2, WONDER: 4, RIVERSIDE: 8 };

export function loadImage(url) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; });
}

async function loadPixels(url) {
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height).data;
}

// One land patch (地块): its baked height / water grids, its window onto the global hex grid and the uniforms its
// shaders read (the patch-specific values of GLSL_COMMON). Coordinates are national km (config.js).
export class World {
  constructor(patch) {
    this.id = patch.id; this.patch = patch;
    const [x0, z0, x1, z1] = patch.rect;
    Object.assign(this, { x0, z0, x1, z1 });
    this.HW = Math.round((x1 - x0) / RES_H); this.HH = Math.round((z1 - z0) / RES_H);
    this.WW = Math.round((x1 - x0) / RES_W); this.WH = Math.round((z1 - z0) / RES_W);
    this.hmax = patch.hmax;
    // hex window: offset columns / rows whose centres can fall inside the rect
    const rh = HEX_R * 1.5, cw = HEX_R * SQ3;
    this.r0 = Math.floor(z0 / rh) - 1; this.c0 = Math.floor(x0 / cw) - 1;
    this.NY = Math.ceil(z1 / rh) + 2 - this.r0; this.NX = Math.ceil(x1 / cw) + 2 - this.c0;
    this.uniforms = {
      uHex: { value: null }, uWater: { value: null }, uNormalTex: { value: null }, uRevealB: { value: 0 },
      uRect: { value: new THREE.Vector4(x0, z0, x1 - x0, z1 - z0) }, uHexGrid: { value: new THREE.Vector4(this.c0, this.r0, this.NX, this.NY) },
    };
  }

  // shared uniforms plus this patch's own: pass to every builder of the patch (terrain, props, places, routes, life)
  shared(shared) { return { uniforms: { ...shared.uniforms, ...this.uniforms } }; }

  hexIndex(q, r) {
    const ix = q + (r - (r & 1)) / 2 - this.c0, iy = r - this.r0;
    if (ix < 0 || iy < 0 || ix >= this.NX || iy >= this.NY) return -1;
    return iy * this.NX + ix;
  }
  hexFromIndex(i) {
    const ix = i % this.NX, iy = (i / this.NX) | 0;
    const r = iy + this.r0, col = ix + this.c0;
    return [col - (r - (r & 1)) / 2, r];
  }
  contains(x, z, margin = 0) { return x > this.x0 + margin && x < this.x1 - margin && z > this.z0 + margin && z < this.z1 - margin; }

  async load(base) {
    const dir = `${base}data/patches/${this.id}/`;
    const [hp, wp] = await Promise.all([loadPixels(dir + 'height.png'), loadPixels(dir + 'water.png')]);
    const { HW, HH, WW, WH, hmax } = this;
    this.Hm = new Float32Array(HW * HH);
    this.Y = new Float32Array(HW * HH);
    for (let i = 0; i < HW * HH; i++) {
      const v = hp[i * 4] / 255;
      const m = hmax * v * v;
      this.Hm[i] = m; this.Y[i] = elevToY(m);
    }
    this.SDF = new Float32Array(WW * WH);
    this.SEA = new Float32Array(WW * WH);
    const wbytes = new Uint8Array(WW * WH * 4);
    for (let i = 0; i < WW * WH; i++) {
      this.SDF[i] = (wp[i * 4] - 128) / 10;
      this.SEA[i] = wp[i * 4 + 1] / 255;
      wbytes[i * 4] = wp[i * 4]; wbytes[i * 4 + 1] = wp[i * 4 + 1]; wbytes[i * 4 + 2] = 0; wbytes[i * 4 + 3] = 255;
    }
    this.waterTex = new THREE.DataTexture(wbytes, WW, WH, THREE.RGBAFormat);
    this.waterTex.magFilter = THREE.LinearFilter; this.waterTex.minFilter = THREE.LinearFilter;
    this.waterTex.needsUpdate = true;
    this.uniforms.uWater.value = this.waterTex;
    // lowland level: biome, peak and ink-mountain thresholds read elevation relative to it, so a 500 m basin
    // (成都平原) is plain, not mountains. 长三角 keeps 0, its thresholds were tuned on absolute heights.
    const lows = [];
    if (this.id !== 'yrd') {
      for (let j = 0; j < HH; j += 6) for (let i = 0; i < HW; i += 6) {
        if (this.sdf(this.x0 + (i + 0.5) * RES_H, this.z0 + (j + 0.5) * RES_H) < 0) lows.push(this.Hm[j * HW + i]);
      }
      lows.sort((a, b) => a - b);
    }
    this.base = lows.length ? lows[Math.floor(lows.length * 0.25)] : 0;
    this.buildNormalTex();
  }

  // elevation above the patch's lowland level (metres)
  relM(x, z) { return this.elevM(x, z) - this.base; }

  _bil(arr, w, h, fx, fy) {
    fx = Math.max(0, Math.min(w - 1.001, fx)); fy = Math.max(0, Math.min(h - 1.001, fy));
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * w + x0;
    return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - ty) + (arr[i + w] * (1 - tx) + arr[i + w + 1] * tx) * ty;
  }
  heightY(x, z) { return this._bil(this.Y, this.HW, this.HH, (x - this.x0) / RES_H - 0.5, (z - this.z0) / RES_H - 0.5); }
  elevM(x, z) { return this._bil(this.Hm, this.HW, this.HH, (x - this.x0) / RES_H - 0.5, (z - this.z0) / RES_H - 0.5); }
  sdf(x, z) { return this._bil(this.SDF, this.WW, this.WH, (x - this.x0) / RES_W - 0.5, (z - this.z0) / RES_W - 0.5); }
  sea(x, z) { return this._bil(this.SEA, this.WW, this.WH, (x - this.x0) / RES_W - 0.5, (z - this.z0) / RES_W - 0.5); }
  slope(x, z) {
    const e = 0.75;
    const dx = (this.heightY(x + e, z) - this.heightY(x - e, z)) / (2 * e);
    const dz = (this.heightY(x, z + e) - this.heightY(x, z - e)) / (2 * e);
    return Math.sqrt(dx * dx + dz * dz);
  }

  buildNormalTex() {
    const { HW, HH } = this;
    const d = new Uint8Array(HW * HH * 4), Y = this.Y, s = RES_H;
    for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
      const xm = Y[j * HW + Math.max(0, i - 1)], xp = Y[j * HW + Math.min(HW - 1, i + 1)];
      const zm = Y[Math.max(0, j - 1) * HW + i], zp = Y[Math.min(HH - 1, j + 1) * HW + i];
      let nx = -(xp - xm) / (2 * s), ny = 1, nz = -(zp - zm) / (2 * s);
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (j * HW + i) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    if (this.normalTex) this.normalTex.dispose();
    const t = new THREE.DataTexture(d, HW, HH, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    this.normalTex = t;
    this.uniforms.uNormalTex.value = t;
  }

  // ---------- hexes ----------
  // cities: this patch's cities, each with .gi = its index in the national city list (territory colour slot − 1)
  buildHexes(cities, communities, pins) {
    const N = this.NX * this.NY, index = (q, r) => this.hexIndex(q, r);
    const hx = this.hex = new Array(N);
    // hexes that can be revealed: 75 km in from the patch edge, so the burnt fog edge and the blend into the
    // national paper map stay inside the patch
    const inRegion = (x, z) => this.contains(x, z, 75);
    // sample pattern inside a hex
    const samples = [[0, 0]];
    for (let k = 1; k <= 3; k++) for (let a = 0; a < 6 * k; a++) {
      const ang = (a / (6 * k)) * Math.PI * 2, rr = (k / 3.3) * HEX_R * 0.92;
      samples.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    for (let i = 0; i < N; i++) {
      const [q, r] = this.hexFromIndex(i);
      const [cx, cz] = hexCenter(q, r);
      let wat = 0, land = 0, sumE = 0, maxE = 0, sumS = 0, seaS = 0;
      for (const [dx, dz] of samples) {
        const x = cx + dx, z = cz + dz;
        const sd = this.sdf(x, z);
        if (sd > 0) { wat++; seaS += this.sea(x, z); } else { land++; const e = this.relM(x, z); sumE += e; maxE = Math.max(maxE, e); sumS += this.slope(x, z); }
      }
      const n = samples.length;
      hx[i] = {
        i, q, r, cx, cz, waterFrac: wat / n, seaFrac: wat ? seaS / wat : 0,
        meanE: land ? sumE / land : 0, maxE, slope: land ? sumS / land : 0,
        biome: 0, owner: 0, order: 255, flags: 0, inRegion: inRegion(cx, cz), rnd: hash2(q * 7 + 3, r * 13 + 5),
      };
    }
    // cities, territory and district sites (layout.js)
    for (const c of cities) {
      const [x, z] = toWorld(c.lon, c.lat);
      c.hex = worldToHex(x, z); [c.x, c.z] = hexCenter(c.hex[0], c.hex[1]);
      c.y = this.heightY(c.x, c.z);
    }
    this.sites = layoutCities(hx, cities, communities, pins, index);
    for (const s of this.sites) { s.y = this.heightY(s.x, s.z); for (const cm of s.members) cm.y = s.y; }
    // layout works with patch-local owner numbers; the shaders colour territory by national city slot
    for (const h of hx) if (h.owner) h.owner = cities[h.owner - 1].gi + 1;
    for (const s of this.sites) {
      const h = hx[index(s.hex[0], s.hex[1])];
      h.owner = cities.find((c) => c.id === s.cityId).gi + 1; h.flags |= FLAG.DISTRICT;
    }
    cities.forEach((c) => { hx[index(c.hex[0], c.hex[1])].flags |= FLAG.CITY; });

    // reveal order (km to the revealed boundary; negative = inside)
    const src = this.revealSources(cities);
    for (const h of hx) {
      let o = 1e9;
      for (const s of src) {
        let d;
        if (s.b) {
          const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
          const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((h.cx - ax) * vx + (h.cz - az) * vz) / (vx * vx + vz * vz)));
          d = Math.hypot(h.cx - ax - vx * t, h.cz - az - vz * t);
        } else d = Math.hypot(h.cx - s.a[0], h.cz - s.a[1]);
        o = Math.min(o, d - s.rad);
      }
      o += (h.rnd - 0.5) * 9;
      if (!h.inRegion) o = Math.max(o, 40 + (h.rnd * 10));
      h.order = Math.max(0, Math.min(255, Math.round((o + 80) * 1.5)));
      h.orderKm = o;
    }

    // fill fog holes: unrevealed hexes not connected to the outer fog become revealed
    {
      const seen = new Uint8Array(N), queue = [];
      for (const h of hx) if (!h.inRegion) { seen[h.i] = 1; queue.push(h); }
      while (queue.length) {
        const h = queue.pop();
        for (const [dq, dr] of HEX_DIRS) {
          const j = index(h.q + dq, h.r + dr);
          if (j < 0 || seen[j] || hx[j].orderKm < 0) continue;
          seen[j] = 1; queue.push(hx[j]);
        }
      }
      for (const h of hx) if (!seen[h.i] && h.orderKm >= 0) { h.orderKm = -0.5; h.order = Math.round((h.orderKm + 80) * 1.5); }
    }

    // biomes
    for (const h of hx) {
      if (h.waterFrac > 0.55) { h.biome = h.seaFrac > 0.5 ? BIOME.OCEAN : BIOME.LAKE; continue; }
      if (h.maxE > 780 || h.meanE > 470) h.biome = BIOME.MOUNTAIN;
      else if (h.meanE > 110 || h.slope > 0.28) h.biome = BIOME.HILLS;
      else if (h.meanE > 30) h.biome = h.rnd < 0.55 ? BIOME.WOOD : BIOME.HILLS;
      else {
        const nearCity = Math.min(...cities.map((c) => hexDist([h.q, h.r], c.hex)));
        const v = hash2(h.q * 31 + 1, h.r * 17 + 9);
        const lakeNear = HEX_DIRS.some(([dq, dr]) => { const j = index(h.q + dq, h.r + dr); return j >= 0 && hx[j].biome === BIOME.LAKE; });
        if (lakeNear && v < 0.25) h.biome = BIOME.MARSH;
        else if (v < (nearCity < 5 ? 0.5 : 0.36)) h.biome = BIOME.FARM;
        else h.biome = v < 0.8 ? BIOME.GRASS : BIOME.PLAINS;
      }
    }
    for (const h of hx) {
      if (h.biome !== BIOME.OCEAN) continue;
      let near = false;
      for (const [dq, dr] of HEX_DIRS) {
        const j = index(h.q + dq, h.r + dr);
        if (j >= 0 && hx[j].waterFrac < 0.75) near = true;
      }
      if (near || h.waterFrac < 0.95) h.biome = BIOME.COAST;
    }
    cities.forEach((c) => { const h = hx[index(c.hex[0], c.hex[1])]; h.biome = BIOME.URBAN; });
    this.sites.forEach((s) => { hx[index(s.hex[0], s.hex[1])].biome = BIOME.DISTRICT; });

    const data = new Uint8Array(N * 4);
    for (const h of hx) {
      data[h.i * 4] = h.biome; data[h.i * 4 + 1] = h.owner; data[h.i * 4 + 2] = h.order; data[h.i * 4 + 3] = h.flags;
    }
    const t = new THREE.DataTexture(data, this.NX, this.NY, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    this.hexTex = t;
    this.hexData = data;
    this.uniforms.uHex.value = t;
  }

  revealSources(cities) {
    // the explored land: a disc round every city's territory, joined to neighbours within ~320 km (长三角 is hand-shaped)
    const territory = cities.map((c) => ({ a: [c.x, c.z], rad: (c.radius + 1.6) * HEX_W }));
    const C = Object.fromEntries(cities.map((c) => [c.id, [c.x, c.z]]));
    if (this.id !== 'yrd' || !['shanghai', 'changshu', 'changzhou', 'nanjing', 'hangzhou'].every((id) => C[id])) {
      const links = [];
      cities.forEach((a, i) => cities.slice(i + 1).forEach((b) => {
        if (Math.hypot(a.x - b.x, a.z - b.z) < 320) links.push({ a: [a.x, a.z], b: [b.x, b.z], rad: 30 });
      }));
      return [...cities.map((c) => ({ a: [c.x, c.z], rad: 56 })), ...links, ...territory];
    }
    const W = (lon, lat) => toWorld(lon, lat);
    return [
      { a: C.shanghai, rad: 50 }, { a: C.changshu, rad: 40 }, { a: C.changzhou, rad: 52 },
      { a: C.nanjing, rad: 58 }, { a: C.hangzhou, rad: 56 },
      { a: W(120.2, 31.2), rad: 46 }, { a: W(119.62, 31.32), rad: 50 }, { a: W(119.75, 30.85), rad: 42 },
      { a: W(121.95, 31.05), rad: 36 }, { a: W(121.3, 30.55), rad: 32 }, { a: W(120.85, 30.75), rad: 36 },
      { a: C.nanjing, b: C.changzhou, rad: 34 }, { a: C.changzhou, b: C.changshu, rad: 34 },
      { a: C.changshu, b: C.shanghai, rad: 34 },
      { a: C.hangzhou, b: W(119.4, 30.3), rad: 32 }, { a: W(119.4, 30.3), b: W(118.75, 30.15), rad: 28 },
      { a: W(118.75, 30.15), b: W(118.17, 30.13), rad: 28 }, { a: W(118.17, 30.13), rad: 36 },
      // always reveal a city's whole territory, however large it grows
      ...territory,
    ];
  }

  // flatten terrain around a site (city / district) so compounds sit level
  flatten(x, z, r) {
    const { HW, HH, WW, WH, x0, z0 } = this;
    const y0 = this.heightY(x, z);
    const i0 = Math.max(0, Math.floor((x - r * 1.6 - x0) / RES_H)), i1 = Math.min(HW - 1, Math.ceil((x + r * 1.6 - x0) / RES_H));
    const j0 = Math.max(0, Math.floor((z - r * 1.6 - z0) / RES_H)), j1 = Math.min(HH - 1, Math.ceil((z + r * 1.6 - z0) / RES_H));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * RES_H, pz = z0 + (j + 0.5) * RES_H;
      const d = Math.hypot(px - x, pz - z);
      const t = Math.min(1, Math.max(0, (d - r) / (r * 0.6)));
      const w = 1 - t * t * (3 - 2 * t);
      const k = j * HW + i;
      if (this.SDF[Math.min(WH - 1, Math.floor((pz - z0) / RES_W)) * WW + Math.min(WW - 1, Math.floor((px - x0) / RES_W))] > 0) continue;
      this.Y[k] = this.Y[k] * (1 - w) + Math.max(y0, 0.04) * w;
    }
  }

  hexAt(x, z) { const [q, r] = worldToHex(x, z); const i = this.hexIndex(q, r); return i >= 0 ? this.hex[i] : null; }
  isRevealed(x, z) { const h = this.hexAt(x, z); return h && h.orderKm < 0; }
}
