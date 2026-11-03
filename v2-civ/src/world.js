import * as THREE from 'three';
import {
  XMIN, ZMIN, XMAX, ZMAX, HW, HH, WW, WH, HMAX, elevToY, HEX_R, HEX_N, HEX_DIRS, REGION,
  hexCenter, hexIndex, hexFromIndex, worldToHex, toWorld, hexDist, hash2,
} from './config.js';

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

export class World {
  async load(base) {
    const [hp, wp] = await Promise.all([loadPixels(base + 'data/height.png'), loadPixels(base + 'data/water.png')]);
    this.Hm = new Float32Array(HW * HH);
    this.Y = new Float32Array(HW * HH);
    for (let i = 0; i < HW * HH; i++) {
      const v = hp[i * 4] / 255;
      const m = HMAX * v * v;
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
    this.buildNormalTex();
  }

  _bil(arr, w, h, fx, fy) {
    fx = Math.max(0, Math.min(w - 1.001, fx)); fy = Math.max(0, Math.min(h - 1.001, fy));
    const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * w + x0;
    return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - ty) + (arr[i + w] * (1 - tx) + arr[i + w + 1] * tx) * ty;
  }
  heightY(x, z) { return this._bil(this.Y, HW, HH, (x - XMIN) / 0.75 - 0.5, (z - ZMIN) / 0.75 - 0.5); }
  elevM(x, z) { return this._bil(this.Hm, HW, HH, (x - XMIN) / 0.75 - 0.5, (z - ZMIN) / 0.75 - 0.5); }
  sdf(x, z) { return this._bil(this.SDF, WW, WH, (x - XMIN) / 0.5 - 0.5, (z - ZMIN) / 0.5 - 0.5); }
  sea(x, z) { return this._bil(this.SEA, WW, WH, (x - XMIN) / 0.5 - 0.5, (z - ZMIN) / 0.5 - 0.5); }
  slope(x, z) {
    const e = 0.75;
    const dx = (this.heightY(x + e, z) - this.heightY(x - e, z)) / (2 * e);
    const dz = (this.heightY(x, z + e) - this.heightY(x, z - e)) / (2 * e);
    return Math.sqrt(dx * dx + dz * dz);
  }

  buildNormalTex() {
    const d = new Uint8Array(HW * HH * 4), Y = this.Y, s = 0.75;
    for (let j = 0; j < HH; j++) for (let i = 0; i < HW; i++) {
      const xm = Y[j * HW + Math.max(0, i - 1)], xp = Y[j * HW + Math.min(HW - 1, i + 1)];
      const zm = Y[Math.max(0, j - 1) * HW + i], zp = Y[Math.min(HH - 1, j + 1) * HW + i];
      let nx = -(xp - xm) / (2 * s), ny = 1, nz = -(zp - zm) / (2 * s);
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const k = (j * HW + i) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    const t = new THREE.DataTexture(d, HW, HH, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    this.normalTex = t;
  }

  // ---------- hexes ----------
  buildHexes(cities, communities) {
    const N = HEX_N * HEX_N;
    const hx = this.hex = new Array(N);
    const inRegion = (x, z) => {
      const lon = 120.1 + x / 95.33, lat = 31.1 - z / 110.6;
      return lon > REGION.w && lon < REGION.e && lat > REGION.s && lat < REGION.n;
    };
    // sample pattern inside a hex
    const samples = [[0, 0]];
    for (let k = 1; k <= 3; k++) for (let a = 0; a < 6 * k; a++) {
      const ang = (a / (6 * k)) * Math.PI * 2, rr = (k / 3.3) * HEX_R * 0.92;
      samples.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
    }
    for (let i = 0; i < N; i++) {
      const [q, r] = hexFromIndex(i);
      const [cx, cz] = hexCenter(q, r);
      let wat = 0, land = 0, sumE = 0, maxE = 0, sumS = 0, seaS = 0;
      for (const [dx, dz] of samples) {
        const x = cx + dx, z = cz + dz;
        const sd = this.sdf(x, z);
        if (sd > 0) { wat++; seaS += this.sea(x, z); } else { land++; const e = this.elevM(x, z); sumE += e; maxE = Math.max(maxE, e); sumS += this.slope(x, z); }
      }
      const n = samples.length;
      hx[i] = {
        i, q, r, cx, cz, waterFrac: wat / n, seaFrac: wat ? seaS / wat : 0,
        meanE: land ? sumE / land : 0, maxE, slope: land ? sumS / land : 0,
        biome: 0, owner: 0, order: 255, flags: 0, inRegion: inRegion(cx, cz), rnd: hash2(q * 7 + 3, r * 13 + 5),
      };
    }
    // cities & districts
    const cityHex = cities.map((c) => {
      const [x, z] = toWorld(c.lon, c.lat);
      const h = worldToHex(x, z);
      c.hex = h; [c.x, c.z] = hexCenter(h[0], h[1]);
      c.y = this.heightY(c.x, c.z);
      return h;
    });
    const taken = new Set(cityHex.map((h) => hexIndex(h[0], h[1])));
    for (const cm of communities) {
      const city = cities.find((c) => c.id === cm.cityId);
      let best = null, bestS = -1e9;
      const toward = cm.toward ? toWorld(cm.toward[0], cm.toward[1]) : null;
      HEX_DIRS.forEach(([dq, dr], k) => {
        const q = city.hex[0] + dq, r = city.hex[1] + dr, idx = hexIndex(q, r);
        if (taken.has(idx)) return;
        const h = hx[idx];
        const [cx, cz] = hexCenter(q, r);
        let s = -h.waterFrac * 6;
        if (toward) {
          const vx = toward[0] - city.x, vz = toward[1] - city.z, l = Math.hypot(vx, vz) || 1;
          const ux = cx - city.x, uz = cz - city.z, lu = Math.hypot(ux, uz);
          s += (vx * ux + vz * uz) / (l * lu) * 2;
        } else if (cm.prefDir != null) s += k === cm.prefDir ? 1.5 : 0;
        s -= h.slope * 0.5;
        if (s > bestS) { bestS = s; best = [q, r]; }
      });
      cm.hex = best; taken.add(hexIndex(best[0], best[1]));
      [cm.x, cm.z] = hexCenter(best[0], best[1]);
      cm.y = this.heightY(cm.x, cm.z);
    }

    // territory owners
    for (const h of hx) {
      let bestD = 99, owner = 0;
      cities.forEach((c, ci) => {
        const d = hexDist([h.q, h.r], c.hex);
        if (d <= c.radius && d < bestD) { bestD = d; owner = ci + 1; }
      });
      h.owner = owner;
    }
    for (const cm of communities) { const h = hx[hexIndex(cm.hex[0], cm.hex[1])]; h.owner = cities.findIndex((c) => c.id === cm.cityId) + 1; h.flags |= FLAG.DISTRICT; }
    cities.forEach((c) => { hx[hexIndex(c.hex[0], c.hex[1])].flags |= FLAG.CITY; });

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
          const j = hexIndex(h.q + dq, h.r + dr);
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
        const lakeNear = HEX_DIRS.some(([dq, dr]) => { const j = hexIndex(h.q + dq, h.r + dr); return j >= 0 && hx[j].biome === BIOME.LAKE; });
        if (lakeNear && v < 0.25) h.biome = BIOME.MARSH;
        else if (v < (nearCity < 5 ? 0.5 : 0.36)) h.biome = BIOME.FARM;
        else h.biome = v < 0.8 ? BIOME.GRASS : BIOME.PLAINS;
      }
    }
    for (const h of hx) {
      if (h.biome !== BIOME.OCEAN) continue;
      let near = false;
      for (const [dq, dr] of HEX_DIRS) {
        const j = hexIndex(h.q + dq, h.r + dr);
        if (j >= 0 && hx[j].waterFrac < 0.75) near = true;
      }
      if (near || h.waterFrac < 0.95) h.biome = BIOME.COAST;
    }
    cities.forEach((c) => { const h = hx[hexIndex(c.hex[0], c.hex[1])]; h.biome = BIOME.URBAN; });
    communities.forEach((c) => { const h = hx[hexIndex(c.hex[0], c.hex[1])]; h.biome = BIOME.DISTRICT; });

    const data = new Uint8Array(N * 4);
    for (const h of hx) {
      data[h.i * 4] = h.biome; data[h.i * 4 + 1] = h.owner; data[h.i * 4 + 2] = h.order; data[h.i * 4 + 3] = h.flags;
    }
    const t = new THREE.DataTexture(data, HEX_N, HEX_N, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
    this.hexTex = t;
    this.hexData = data;
  }

  revealSources(cities) {
    const C = Object.fromEntries(cities.map((c) => [c.id, [c.x, c.z]]));
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
    ];
  }

  // flatten terrain around a site (city / district) so compounds sit level
  flatten(x, z, r) {
    const y0 = this.heightY(x, z);
    const i0 = Math.max(0, Math.floor((x - r * 1.6 - XMIN) / 0.75)), i1 = Math.min(HW - 1, Math.ceil((x + r * 1.6 - XMIN) / 0.75));
    const j0 = Math.max(0, Math.floor((z - r * 1.6 - ZMIN) / 0.75)), j1 = Math.min(HH - 1, Math.ceil((z + r * 1.6 - ZMIN) / 0.75));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = XMIN + (i + 0.5) * 0.75, pz = ZMIN + (j + 0.5) * 0.75;
      const d = Math.hypot(px - x, pz - z);
      const t = Math.min(1, Math.max(0, (d - r) / (r * 0.6)));
      const w = 1 - t * t * (3 - 2 * t);
      const k = j * HW + i;
      if (this.SDF[Math.min(WH - 1, Math.floor((pz - ZMIN) / 0.5)) * WW + Math.min(WW - 1, Math.floor((px - XMIN) / 0.5))] > 0) continue;
      this.Y[k] = this.Y[k] * (1 - w) + Math.max(y0, 0.04) * w;
    }
  }

  hexAt(x, z) { const [q, r] = worldToHex(x, z); const i = hexIndex(q, r); return i >= 0 ? this.hex[i] : null; }
  isRevealed(x, z) { const h = this.hexAt(x, z); return h && h.orderKm < 0; }
}
