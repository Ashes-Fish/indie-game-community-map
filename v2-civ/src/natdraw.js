// 全国古舆图纸面（方向 A，见 docs/全国一张世界方案.md）: the fog-of-war paper under and around the land patches.
// It is drawn on demand as a pyramid of tiles (paper.js): any rectangle of the national frame at any resolution comes
// out the same, because every feature (stains, sea, waves, mountain glyphs, rivers, borders, labels) is placed in km
// on fixed global grids, and line widths / glyph sizes are in tile pixels, so each level reads at a constant screen size.
// Style 'qinglv' (墨线 + 青绿淡彩) is the chosen look; 'mo' (纯墨 + 做旧纸黄) stays as ?paper=mo.
// Plain 2D canvas, no DOM and no three.js: runs in the paper worker (paperWorker.js) or, as a fallback, on the page.
import { Z0 } from './albers.js';
import { toWorld, hash2, rng } from './config.js';
import { drawMountain, compass, KAI } from './inkdraw.js';
import { CN_CITIES } from './cn.js';

const mkCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

export const PAPER_STYLES = {
  qinglv: {
    paper: '#e5d2a5', stain: 'rgba(150,110,60,0.05)', sea: 'rgba(132,170,166,0.42)', wave: 'rgba(58,92,98,0.5)',
    coast: 'rgba(36,30,24,0.85)', river: 'rgba(58,96,112,0.85)', lake: 'rgba(132,172,170,0.85)',
    border: ['rgba(34,24,16,0.85)', 'rgba(170,52,40,0.55)'], province: 'rgba(96,62,34,0.42)', label: 'rgba(66,44,26,0.62)',
    mtn: { high: 'rgba(84,128,120,0.95)', low: 'rgba(110,144,110,0.92)', mid: 'rgba(176,182,140,0.85)', foot: 'rgba(226,212,176,0.9)', ink: '34,26,18' },
    seal: 'rgba(176,58,46,0.75)',
  },
  mo: {
    paper: '#d9c294', stain: 'rgba(120,80,30,0.08)', sea: 'rgba(110,96,70,0.16)', wave: 'rgba(40,30,22,0.45)',
    coast: 'rgba(28,20,12,0.9)', river: 'rgba(36,28,20,0.8)', lake: 'rgba(120,104,78,0.35)',
    border: ['rgba(26,18,10,0.9)', 'rgba(120,40,28,0.5)'], province: 'rgba(60,40,22,0.45)', label: 'rgba(40,28,16,0.66)',
    mtn: { high: 'rgba(70,62,52,0.85)', low: 'rgba(98,88,72,0.8)', mid: 'rgba(168,150,116,0.75)', foot: 'rgba(212,194,152,0.85)', ink: '26,18,10' },
    seal: 'rgba(150,44,32,0.75)',
  },
};
// province name positions where the centroid lands on a neighbour or a capital
const LABEL_AT = { 河北: [115.4, 38.3], 内蒙古: [112.5, 42.6], 甘肃: [100.8, 38.6], 北京: null, 天津: null, 上海: null, 香港: null, 澳门: null };

// ---- tile resolution classes (pixels per km) ----
// Sizes below are tile pixels; detail switches on with resolution. ppk ≈ 0.07 at the coarsest tile, 4.4 at the finest.
const GLYPH_PX = 20;           // mountain glyph spacing in px (≥ 9 km)
const WAVE_PX = 20;            // wave grid in px (≥ 4 km)

function bboxOf(pts) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return [x0, z0, x1, z1];
}
const hits = (b, r, m = 0) => b[0] <= r[2] + m && b[2] >= r[0] - m && b[1] <= r[3] + m && b[3] >= r[1] - m;

// Load the national data once; returns { rect, draw(ctx, rect, w, h) } (draw paints rect [x0, z0, x1, z1] km into w × h px).
export async function loadNational(base, style, hubs = []) {
  const S = PAPER_STYLES[style] || PAPER_STYLES.qinglv;
  const [map, rj, elevImg] = await Promise.all([
    fetch(base + 'data/china/map.json').then((r) => r.json()),
    fetch(base + 'data/china/relief.json').then((r) => r.json()),
    fetch(base + 'data/china/elev.png').then((r) => r.blob()).then((b) => createImageBitmap(b)),
  ]);
  // elevation lookup (metres, 0 = sea, -1 = beyond the data) and "inside China"
  const ec = mkCanvas(elevImg.width, elevImg.height);
  const eg = ec.getContext('2d', { willReadFrequently: true }); eg.drawImage(elevImg, 0, 0);
  const ED = eg.getImageData(0, 0, ec.width, ec.height).data, EW = ec.width, EH = ec.height;
  const cell = (x, z) => {
    const ay = Z0 - z;
    const i = Math.floor(((x - rj.xmin) / (rj.xmax - rj.xmin)) * EW), j = Math.floor(((rj.ymax - ay) / (rj.ymax - rj.ymin)) * EH);
    return i < 0 || j < 0 || i >= EW || j >= EH ? -1 : (j * EW + i) * 4;
  };
  const elev = (x, z) => { const k = cell(x, z); if (k < 0) return -1; const v = ED[k] / 255; return ED[k] ? v * v * 6000 : 0; };
  const inCN = (x, z) => { const k = cell(x, z); return k >= 0 && ED[k + 1] > 127; };
  // beyond the elevation grid: the South China Sea and the Pacific are open sea, the far west plain paper
  const isSea = (x, z) => { const e = elev(x, z); return e < 0 ? Z0 - z < rj.ymin || x > rj.xmax : e === 0; };

  // the national rect: the whole country plus a sea margin
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let lo = 73; lo <= 136; lo += 1) for (const la of [16, 20, 30, 40, 50, 54]) {
    const [x, z] = toWorld(lo, la);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const RECT = [x0 - 260, z0 - 220, x1 + 260, z1 + 320];
  const RW = RECT[2] - RECT[0];

  // vectors, once, in km with bounding boxes
  const W = (r) => r.map(([lo, la]) => toWorld(lo, la));
  const lakes = map.lakes.map((l) => { const rs = l.r.map(W); return { rs, b: bboxOf(rs.flat()) }; });
  const rivers = map.rivers.filter((r) => r.r <= 6).map((r) => { const p = W(r.p); return { p, r: r.r, b: bboxOf(p) }; });
  // boundary rings split into land runs and coast runs (sea within ~14 km on either side): borders only over land
  const runs = (ring) => {
    const L = W(ring), out = { land: [], coast: [] };
    let cur = null, curK = null;
    for (let i = 1; i < L.length; i++) {
      const [ax, az] = L[i - 1], [bx, bz] = L[i];
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az) || 1;
      const nx = -(bz - az) / len * 14, nz = (bx - ax) / len * 14;
      const kind = elev(mx + nx, mz + nz) === 0 || elev(mx - nx, mz - nz) === 0 ? 'coast' : 'land';
      if (kind !== curK) { cur = [L[i - 1]]; out[kind].push(cur); curK = kind; }
      cur.push(L[i]);
    }
    return out;
  };
  const withB = (list) => list.map((p) => ({ p, b: bboxOf(p) }));
  const provLand = withB(map.provinces.flatMap((p) => p.r.flatMap((r) => runs(r).land)));
  const cRuns = map.country.map(runs);
  const natLand = withB(cRuns.flatMap((r) => r.land)), natCoast = withB(cRuns.flatMap((r) => r.coast));
  const provLabels = map.provinces.map((p) => ({ n: p.n, at: p.n in LABEL_AT ? LABEL_AT[p.n] : p.c })).filter((p) => p.at)
    .map((p) => ({ n: p.n, xz: toWorld(p.at[0], p.at[1]) }));
  const hubSet = new Set(hubs);
  const seals = CN_CITIES.map((c) => ({ s: c.s, xz: toWorld(c.lon, c.lat), cap: c.cap, hub: hubSet.has(c.s) }));
  // age stains: big soft blobs on fixed national positions
  const SR = rng(20261109);
  const stains = Array.from({ length: 40 }, () => ({ x: RECT[0] + SR() * RW, z: RECT[1] + SR() * (RECT[3] - RECT[1]), r: (0.05 + SR() * 0.12) * RW }));
  // 南海诸岛 inset (standard-map convention) and the compass, fixed in km in the south-east sea
  const INSET = (() => { const iw = RW * 0.11, ih = iw * 1.45; const ix = RECT[2] - iw - RW * 0.03, iz = RECT[3] - ih - (RECT[3] - RECT[1]) * 0.04; return [ix, iz, ix + iw, iz + ih]; })();
  const insetProv = map.provinces.filter((p) => ['海南', '广东', '广西', '台湾', '福建', '云南'].includes(p.n));

  function draw(g, r, cw, chh) {
    const s = cw / (r[2] - r[0]);                       // px per km
    const P = (x, z) => [(x - r[0]) * s, (z - r[1]) * s];
    const path = (pts) => { pts.forEach(([x, z], i) => { const px = (x - r[0]) * s, py = (z - r[1]) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    // paper and stains
    g.fillStyle = S.paper; g.fillRect(0, 0, cw, chh);
    for (const st of stains) {
      if (!hits([st.x - st.r, st.z - st.r, st.x + st.r, st.z + st.r], r)) continue;
      const [px, py] = P(st.x, st.z), rr = st.r * s;
      const gr = g.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, S.stain); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(px - rr, py - rr, 2 * rr, 2 * rr);
    }
    // sea: a mask at half resolution (plus a one-cell border, so coast edges match the neighbour tile)
    const MW = Math.ceil(cw / 2) + 2, MH = Math.ceil(chh / 2) + 2, ck = (r[2] - r[0]) / (MW - 2);
    const sea = new Uint8Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) sea[j * MW + i] = isSea(r[0] + (i - 0.5) * ck, r[1] + (j - 0.5) * ck) ? 1 : 0;
    const mk = mkCanvas(MW, MH);
    const mg = mk.getContext('2d'), md = mg.createImageData(MW, MH), ed = mg.createImageData(MW, MH);
    const sm = S.sea.match(/[\d.]+/g).map(Number);
    let any = false;
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      const q = j * MW + i;
      if (!sea[q]) continue;
      any = true;
      md.data[q * 4] = sm[0]; md.data[q * 4 + 1] = sm[1]; md.data[q * 4 + 2] = sm[2]; md.data[q * 4 + 3] = sm[3] * 255;
      if (i && j && i < MW - 1 && j < MH - 1 && (!sea[q - 1] || !sea[q + 1] || !sea[q - MW] || !sea[q + MW])) ed.data[q * 4 + 3] = 255;
    }
    if (any) {
      const sx = cw / (MW - 2), sy = chh / (MH - 2);
      mg.putImageData(md, 0, 0);
      g.imageSmoothingEnabled = true; g.drawImage(mk, -sx, -sy, MW * sx, MH * sy);
      mg.putImageData(ed, 0, 0);
      g.save(); g.globalAlpha = 0.5; g.filter = 'blur(0.8px)'; g.drawImage(mk, -sx, -sy, MW * sx, MH * sy); g.restore();
      // wave strokes on a fixed grid (cell size by resolution), only in open sea
      const wc = Math.max(4, WAVE_PX / s);
      g.strokeStyle = S.wave; g.lineWidth = 0.9;
      for (let gz = Math.floor((r[1] - wc) / wc); gz * wc < r[3] + wc; gz++) for (let gx = Math.floor((r[0] - 2 * wc) / wc); gx * wc < r[2] + 2 * wc; gx++) {
        const hh = hash2(gx * 7 + 11, gz * 13 + 5);
        if (hh > 0.42) continue;
        const x = (gx + hash2(gx, gz + 99)) * wc, z = (gz + hash2(gx + 7, gz)) * wc;
        if (!isSea(x, z) || !isSea(x + wc * 0.6, z) || !isSea(x - wc * 0.6, z) || !isSea(x, z + wc * 0.4)) continue;
        const [px, py] = P(x, z), w = 7 + hh * 18;
        g.beginPath(); g.moveTo(px - w, py);
        g.bezierCurveTo(px - w * 0.5, py - 2.5, px - w * 0.2, py + 2, px, py);
        g.bezierCurveTo(px + w * 0.25, py - 2.5, px + w * 0.6, py + 1.5, px + w, py - 0.5);
        g.stroke();
      }
    }
    // lakes and rivers (more of the small rivers as resolution grows)
    const rankMax = s < 0.2 ? 4 : s < 0.5 ? 5 : 6;
    for (const l of lakes) {
      if (!hits(l.b, r, 5)) continue;
      g.beginPath(); for (const ring of l.rs) path(ring);
      g.fillStyle = S.lake; g.fill('evenodd');
      g.strokeStyle = S.coast; g.lineWidth = 0.8; g.stroke();
    }
    for (const rv of rivers) {
      if (rv.r > rankMax || !hits(rv.b, r, 5)) continue;
      g.beginPath(); path(rv.p);
      if (rv.r <= 3) { g.strokeStyle = S.river; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = S.paper; g.lineWidth = 1.5; g.stroke(); }
      else { g.strokeStyle = S.river; g.lineWidth = rv.r <= 4 ? 1.4 : 0.9; g.stroke(); }
    }
    // mountains: rugged ground on a fixed grid (spacing by resolution); the flat plateaus stay open paper
    const sp = Math.max(9, GLYPH_PX / s), gs = sp * s / GLYPH_PX;    // gs > 1 once the spacing stops shrinking
    const glyphs = [];
    for (let gz = Math.floor((r[1] - sp) / (sp * 0.82)); gz * sp * 0.82 < r[3] + 3 * sp; gz++) for (let gx = Math.floor((r[0] - 2 * sp) / sp); gx * sp < r[2] + 2 * sp; gx++) {
      const x = (gx + 0.05 + hash2(gx * 3 + 1, gz * 5 + 2) * 0.9) * sp, z = (gz + 0.15 + hash2(gx * 7 + 3, gz * 11 + 4) * 0.7) * sp * 0.82;
      const e = elev(x, z);
      if (e <= 0) continue;
      const nb = [[30, 0], [-30, 0], [0, 30], [0, -30], [21, 21], [-21, -21]].map(([dx, dz]) => elev(x + dx, z + dz)).filter((v) => v > 0);
      const rel = nb.length ? Math.max(e, ...nb) - Math.min(e, ...nb) : 0;
      if (!(rel > (e > 3500 ? 1100 : 700) || (rel > 420 && e > 900 && e < 3500))) continue;
      glyphs.push({ x, z, e, cn: inCN(x, z), seed: (gx * 73856093) ^ (gz * 19349663) });
    }
    glyphs.sort((a, b) => a.z - b.z || a.x - b.x);
    for (const m of glyphs) {
      const R = rng(m.seed);
      const [px, py] = P(m.x, m.z);
      const w = (11 + Math.min(m.e, 5500) / 420) * gs * (0.85 + R() * 0.3);
      const h = w * (0.5 + Math.min(m.e, 5500) / 9000 + R() * 0.1);
      g.globalAlpha = m.cn ? 1 : 0.45;
      drawMountain(g, px, py, w, h, R, m.e > 2600, S.mtn);
    }
    g.globalAlpha = 1;
    // province borders (dashed), coast, national border (double, over land only)
    const strokeList = (list, m = 5) => { g.beginPath(); for (const it of list) if (hits(it.b, r, m)) path(it.p); g.stroke(); };
    g.setLineDash([5, 3.5]); g.strokeStyle = S.province; g.lineWidth = 1.1;
    strokeList(provLand);
    g.setLineDash([]);
    g.strokeStyle = S.coast; g.lineWidth = 1.4; strokeList(natCoast);
    g.strokeStyle = S.border[0]; g.lineWidth = 3.2; strokeList(natLand);
    g.strokeStyle = S.border[1]; g.lineWidth = 1.3; strokeList(natLand);
    // province names (coarse tiles), city seals: capitals and community cities always, every prefecture seat when fine
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (s < 1.2) {
      const fs = s < 0.2 ? 24 : 30, step = fs * 1.17;
      g.font = `400 ${fs}px ${KAI}`; g.fillStyle = S.label;
      for (const p of provLabels) {
        const [px, py] = P(...p.xz), ch = [...p.n];
        if (px < -200 || py < -60 || px > cw + 200 || py > chh + 60) continue;
        ch.forEach((t, i) => g.fillText(t, px + (i - (ch.length - 1) / 2) * step, py));
      }
    }
    g.textAlign = 'left';
    const allSeats = s >= 0.5;
    for (const c of seals) {
      if (!c.cap && !c.hub && !allSeats) continue;
      const [px, py] = P(...c.xz);
      if (px < -120 || py < -30 || px > cw + 30 || py > chh + 30) continue;
      const rr = c.hub ? 4.5 : c.cap ? 3.5 : 2.6;
      g.fillStyle = S.seal; g.fillRect(px - rr, py - rr, 2 * rr, 2 * rr);
      g.strokeStyle = `rgba(${S.mtn.ink},0.9)`; g.lineWidth = 0.9; g.strokeRect(px - rr * 1.5, py - rr * 1.5, rr * 3, rr * 3);
      if (c.hub || c.cap || s >= 0.9) {
        g.font = `400 ${c.hub ? 15 : c.cap ? 13 : 11}px ${KAI}`; g.fillStyle = `rgba(${S.mtn.ink},0.88)`;
        g.fillText(c.s, px + rr * 2.2, py);
      }
    }
    // 南海诸岛 inset and compass
    if (hits(INSET, r, 600)) {
      const [ix, iz] = P(INSET[0], INSET[1]), iw = (INSET[2] - INSET[0]) * s, ih = (INSET[3] - INSET[1]) * s;
      const [bx0, bz0] = toWorld(105.5, 2.5), [bx1, bz1] = toWorld(123.5, 24.5);   // inset frame: SW and NE corners
      const kk = Math.min(iw / (bx1 - bx0), ih / (bz0 - bz1));
      const T = (lo, la) => { const [x, z] = toWorld(lo, la); return [ix + (x - bx0) * kk, iz + ih - (bz0 - z) * kk]; };
      g.save();
      g.fillStyle = S.paper; g.fillRect(ix, iz, iw, ih);
      g.beginPath(); g.rect(ix, iz, iw, ih); g.clip();
      for (const p of insetProv) {
        g.beginPath();
        for (const ring of p.r) ring.forEach(([lo, la], i) => { const [px, py] = T(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); });
        g.fillStyle = 'rgba(255,250,235,0.35)'; g.fill('evenodd');
        g.strokeStyle = S.coast; g.lineWidth = Math.max(0.6, 0.004 * iw); g.stroke();
      }
      g.strokeStyle = S.border[0]; g.lineWidth = Math.max(1, 0.01 * iw);
      for (const d of map.jd) { g.beginPath(); d.forEach(([lo, la], i) => { const [px, py] = T(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
      g.restore();
      g.strokeStyle = S.border[0]; g.lineWidth = Math.max(1, 0.01 * iw); g.strokeRect(ix, iz, iw, ih);
      g.font = `400 ${0.085 * iw}px ${KAI}`; g.fillStyle = S.label; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillText('南海诸岛', ix + iw * 0.96, iz + ih * 0.98);
      compass(g, ix + iw * 0.5, iz - 0.5 * iw, 0.23 * iw);
    }
  }
  return { rect: RECT, draw };
}
