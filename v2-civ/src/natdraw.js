// 全国古舆图纸面（方向 A，见 docs/全国一张世界方案.md）: the fog-of-war paper under and around the land patches.
// It is drawn on demand as a pyramid of tiles (paper.js): any rectangle of the national frame at any resolution comes
// out the same, because every feature (stains, sea, waves, mountain glyphs, rivers, borders, labels) is placed in km
// on fixed global grids, and line widths / glyph sizes are in tile pixels, so each level reads at a constant screen size.
// Style 'qinglv' (墨线 + 青绿淡彩) is the chosen look; 'mo' (纯墨 + 做旧纸黄) stays as ?paper=mo.
// Plain 2D canvas, no DOM and no three.js: runs in the paper worker (paperWorker.js) or, as a fallback, on the page.
// One map at every scale: inside a land patch the painter reads the patch's own fine height / water grids (coast, lakes,
// low hills) and thin rivers, so the paper there needs no second ink map; the extra detail fades in with resolution.
import { Z0 } from './albers.js';
import { toWorld, hash2, rng } from './config.js';
import { drawMountain, compass, KAI } from './inkdraw.js';

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

// ---- tile resolution classes (pixels per km) ----
// Sizes below are tile pixels; detail switches on with resolution. ppk ≈ 0.07 at the coarsest tile, 4.4 at the finest.
const GLYPH_PX = 20;           // mountain glyph spacing in px (≥ 9 km)
const WAVE_PX = 20;            // wave grid in px (≥ 4 km)

function bboxOf(pts) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return [x0, z0, x1, z1];
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hits = (b, r, m = 0) => b[0] <= r[2] + m && b[2] >= r[0] - m && b[1] <= r[3] + m && b[3] >= r[1] - m;

// A land patch's fine data: height / water grids (bilinear), thin rivers, lowland level for the hill thresholds.
async function loadFine(base, P) {
  const get = (f) => fetch(base + 'data/patches/' + P.id + '/' + f);
  const px = async (f) => {
    const bmp = await createImageBitmap(await get(f).then((r) => r.blob()), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = mkCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    return { d: g.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height };
  };
  const [h, w, rv] = await Promise.all([px('height.png'), px('water.png'), get('rivers.json').then((r) => r.json())]);
  const [x0, z0, x1, z1] = P.rect;
  const HM = new Float32Array(h.w * h.h), SD = new Float32Array(w.w * w.h), SE = new Float32Array(w.w * w.h);
  for (let i = 0; i < HM.length; i++) { const v = h.d[i * 4] / 255; HM[i] = P.hmax * v * v; }
  for (let i = 0; i < SD.length; i++) { SD[i] = (w.d[i * 4] - 128) / 10; SE[i] = w.d[i * 4 + 1] / 255; }
  const kh = h.w / (x1 - x0), kw = w.w / (x1 - x0);
  const bil = (A, W, H, k, x, z) => {
    const fx = Math.max(0, Math.min(W - 1.001, (x - x0) * k - 0.5)), fy = Math.max(0, Math.min(H - 1.001, (z - z0) * k - 0.5));
    const i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, i = j0 * W + i0;
    return (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - ty) + (A[i + W] * (1 - tx) + A[i + W + 1] * tx) * ty;
  };
  const F = {
    id: P.id, x0, z0, x1, z1, base: 0,
    hm: (x, z) => bil(HM, h.w, h.h, kh, x, z), sdf: (x, z) => bil(SD, w.w, w.h, kw, x, z), sea: (x, z) => bil(SE, w.w, w.h, kw, x, z),
    thin: rv.rivers.filter((r) => !r.water).map((r) => ({ p: r.pts, b: bboxOf(r.pts) })),
  };
  if (P.id !== 'yrd') {   // lowland level (world.js): hill thresholds read elevation above it
    const lows = [];
    for (let j = 0; j < h.h; j += 6) for (let i = 0; i < h.w; i += 6) if (F.sdf(x0 + (i + 0.5) / kh, z0 + (j + 0.5) / kh) < 0) lows.push(HM[j * h.w + i]);
    lows.sort((a, b) => a - b);
    F.base = lows.length ? lows[Math.floor(lows.length * 0.25)] : 0;
  }
  return F;
}

// painted names inside a patch (lakes, seas, mountains, rivers); sizes in km, so they grow with the zoom
const INK = 'rgba(30,50,60,0.85)';
const FINE_LABELS = {
  yrd: [
    [123.05, 30.75, '東海', 13, { vertical: true, bold: true, color: 'rgba(40,52,62,0.8)' }],
    [122.55, 33.15, '黄海', 11, { vertical: true, bold: true, color: 'rgba(40,52,62,0.75)' }],
    [117.55, 31.6, '巢湖', 4.5, { color: INK }], [119.25, 32.82, '高邮湖', 4.2, { color: INK }],
    [118.6, 33.32, '洪泽湖', 4.6, { color: INK }], [118.95, 29.58, '千岛湖', 4.0, { color: INK }],
    [117.82, 30.5, '九华山', 4.6, { spacing: 0.15 }], [120.62, 29.72, '会稽山', 4.6, { spacing: 0.15 }],
    [121.15, 29.62, '四明山', 4.6, { spacing: 0.15 }], [120.95, 29.05, '天台山', 4.6, { spacing: 0.15 }],
    [117.7, 31.15, '长 江', 5.2, { color: INK }], [119.75, 29.62, '富春江', 4.0, { color: INK }],
    [120.4, 33.0, '淮 扬', 6, { spacing: 0.3, color: 'rgba(38,28,20,0.6)' }],
  ],
};

// Load the national data once; returns { rect, draw(ctx, rect, w, h) } (draw paints rect [x0, z0, x1, z1] km into w × h px).
export async function loadNational(base, style, hubs = [], patches = []) {
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
  const fine = await Promise.all(patches.map((P) => loadFine(base, P)));
  const finePatch = (x, z) => { for (const F of fine) if (x > F.x0 + 8 && x < F.x1 - 8 && z > F.z0 + 8 && z < F.z1 - 8) return F; return null; };
  const isSea = (x, z) => {
    const F = finePatch(x, z);
    if (F) return F.sdf(x, z) > 0 && F.sea(x, z) > 0.5;
    const e = elev(x, z); return e < 0 ? Z0 - z < rj.ymin || x > rj.xmax : e === 0;
  };
  const elevA = (x, z) => { const F = finePatch(x, z); return F ? (F.sdf(x, z) > 0 ? 0 : Math.max(1, F.hm(x, z))) : elev(x, z); };

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
    // fine patch data in this tile (from ~0.6 px/km): its coast, lakes and rivers replace the coarse national ones inside the patch
    const fineHere = s >= 0.6 ? fine.filter((F) => hits([F.x0 + 8, F.z0 + 8, F.x1 - 8, F.z1 - 8], r)) : [];
    const outsideFine = (fn) => {
      if (!fineHere.length) return fn();
      g.save(); g.beginPath(); g.rect(-50, -50, cw + 100, chh + 100);
      for (const F of fineHere) { const [a, b] = P(F.x0 + 8, F.z0 + 8); g.rect(a, b, (F.x1 - F.x0 - 16) * s, (F.z1 - F.z0 - 16) * s); }
      g.clip('evenodd'); fn(); g.restore();
    };
    const fm = smooth(0.5, 2.0, s);   // how much of the patch's own detail (low hills, glyph sizes) shows
    // sea: a mask at half resolution (full where fine data is drawn), plus a one-cell border, so coast edges match the neighbour tile
    const div = fineHere.length ? 1 : 2;
    const MW = Math.ceil(cw / div) + 2, MH = Math.ceil(chh / div) + 2, ck = (r[2] - r[0]) / (MW - 2);
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
    // inside a patch: inland water (lakes, wide rivers) and the coast line from its fine water grid
    if (fineHere.length) {
      const mk2 = mkCanvas(MW, MH), mg2 = mk2.getContext('2d');
      const lk = S.lake.match(/[\d.]+/g).map(Number), ci = S.coast.match(/[\d.]+/g).map(Number);
      const wd = mg2.createImageData(MW, MH), cd = mg2.createImageData(MW, MH);
      const lake = new Uint8Array(MW * MH), inF = new Uint8Array(MW * MH);
      for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
        const x = r[0] + (i - 0.5) * ck, z = r[1] + (j - 0.5) * ck, F = finePatch(x, z), q = j * MW + i;
        if (!F) continue;
        inF[q] = 1; lake[q] = F.sdf(x, z) > 0 && F.sea(x, z) <= 0.5 ? 1 : 0;
      }
      for (let j = 1; j < MH - 1; j++) for (let i = 1; i < MW - 1; i++) {
        const q = j * MW + i;
        if (!inF[q]) continue;
        if (lake[q]) { wd.data[q * 4] = lk[0]; wd.data[q * 4 + 1] = lk[1]; wd.data[q * 4 + 2] = lk[2]; wd.data[q * 4 + 3] = lk[3] * 255; }
        if (!(inF[q - 1] && inF[q + 1] && inF[q - MW] && inF[q + MW])) continue;
        const edge = (A) => A[q - 1] !== A[q] || A[q + 1] !== A[q] || A[q - MW] !== A[q] || A[q + MW] !== A[q];
        if ((lake[q] && edge(lake)) || (sea[q] && edge(sea))) { cd.data[q * 4] = ci[0]; cd.data[q * 4 + 1] = ci[1]; cd.data[q * 4 + 2] = ci[2]; cd.data[q * 4 + 3] = ci[3] * 255; }
      }
      const fx = cw / (MW - 2), fy = chh / (MH - 2);
      mg2.putImageData(wd, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(mk2, -fx, -fy, MW * fx, MH * fy);
      mg2.putImageData(cd, 0, 0); g.save(); g.filter = 'blur(0.5px)'; g.drawImage(mk2, -fx, -fy, MW * fx, MH * fy); g.restore();
    }
    // lakes and rivers (more of the small rivers as resolution grows); the patches' own water replaces them inside
    const rankMax = s < 0.2 ? 4 : s < 0.5 ? 5 : 6;
    outsideFine(() => {
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
    });
    // thin rivers of the patches (not wide enough for the water grid)
    for (const F of fineHere) {
      g.strokeStyle = 'rgba(52,72,84,0.75)'; g.lineWidth = 0.8 + 0.65 * s; g.globalAlpha = smooth(0.6, 1.4, s);
      for (const rv of F.thin) { if (!hits(rv.b, r, 5)) continue; g.beginPath(); path(rv.p); g.stroke(); }
      g.globalAlpha = 1;
    }
    // mountains: rugged ground on a fixed grid (spacing by resolution); the flat plateaus stay open paper
    const sp = Math.max(9, GLYPH_PX / s), gs = sp * s / GLYPH_PX;    // gs > 1 once the spacing stops shrinking
    const glyphs = [];
    for (let gz = Math.floor((r[1] - sp) / (sp * 0.82)); gz * sp * 0.82 < r[3] + 3 * sp; gz++) for (let gx = Math.floor((r[0] - 2 * sp) / sp); gx * sp < r[2] + 2 * sp; gx++) {
      const x = (gx + 0.05 + hash2(gx * 3 + 1, gz * 5 + 2) * 0.9) * sp, z = (gz + 0.15 + hash2(gx * 7 + 3, gz * 11 + 4) * 0.7) * sp * 0.82;
      const e = elevA(x, z);
      if (e <= 0) continue;
      const nb = [[30, 0], [-30, 0], [0, 30], [0, -30], [21, 21], [-21, -21]].map(([dx, dz]) => elevA(x + dx, z + dz)).filter((v) => v > 0);
      const rel = nb.length ? Math.max(e, ...nb) - Math.min(e, ...nb) : 0;
      // inside a patch, low hills above its lowland level count too (the threshold relaxes as the resolution grows)
      const F = fm > 0 ? finePatch(x, z) : null, relM = F ? e - F.base : 0;
      const low = F && relM > 140 + hash2(gx * 17 + 1, gz * 19 + 3) * 80 + (1 - fm) * 900;
      if (!(low || rel > (e > 3500 ? 1100 : 700) || (rel > 420 && e > 900 && e < 3500))) continue;
      glyphs.push({ x, z, e, relM: Math.max(0, relM), fine: !!F, cn: inCN(x, z), seed: (gx * 73856093) ^ (gz * 19349663) });
    }
    glyphs.sort((a, b) => a.z - b.z || a.x - b.x);
    for (const m of glyphs) {
      const R = rng(m.seed);
      const [px, py] = P(m.x, m.z);
      const rw = R(), rh = R();
      let w = (11 + Math.min(m.e, 5500) / 420) * gs * (0.85 + rw * 0.3);
      let h = w * (0.5 + Math.min(m.e, 5500) / 9000 + rh * 0.1);
      if (m.fine) {   // the patch's own glyph proportions (km-sized, so they grow with the zoom), blended in with the resolution
        const wf = (4.2 + Math.min(m.relM, 1500) / 260) * s * (0.85 + rw * 0.3), hf = wf * (0.48 + Math.min(m.relM, 1500) / 3200 + rh * 0.1);
        w += (wf - w) * fm; h += (hf - h) * fm;
      }
      g.globalAlpha = m.cn ? 1 : 0.45;
      drawMountain(g, px, py, w, h, R, m.e > 2600, S.mtn);
    }
    g.globalAlpha = 1;
    // province borders (dashed), coast, national border (double, over land only)
    const strokeList = (list, m = 5) => { g.beginPath(); for (const it of list) if (hits(it.b, r, m)) path(it.p); g.stroke(); };
    g.setLineDash([5, 3.5]); g.strokeStyle = S.province; g.lineWidth = 1.1;
    strokeList(provLand);
    g.setLineDash([]);
    outsideFine(() => { g.strokeStyle = S.coast; g.lineWidth = 1.4; strokeList(natCoast); });
    g.strokeStyle = S.border[0]; g.lineWidth = 3.2; strokeList(natLand);
    g.strokeStyle = S.border[1]; g.lineWidth = 1.3; strokeList(natLand);
    // province names and city seals + names are screen-space labels (ui.js): text drawn into tiles changes size from level
    // to level, is cut at tile edges and is blown up when a coarse tile stands in during a fast zoom
    // painted names inside a patch, sized in km and fading in with the resolution
    if (s >= 1.2 && fineHere.length) {
      g.textBaseline = 'middle'; g.textAlign = 'center';
      for (const F of fineHere) for (const [lo, la, text, size, opt] of FINE_LABELS[F.id] || []) {
        const [lx, lz] = toWorld(lo, la);
        if (!hits([lx - 30, lz - 30, lx + 30, lz + 30], r)) continue;
        const [px, py] = P(lx, lz), fs = size * s;
        g.save(); g.globalAlpha = smooth(1.2, 2.6, s);
        g.font = (opt.bold ? 700 : 400) + ' ' + fs + 'px ' + KAI; g.fillStyle = opt.color || 'rgba(38,28,20,0.86)';
        if (opt.vertical) [...text].forEach((ch, i) => g.fillText(ch, px, py + (i - (text.length - 1) / 2) * fs * 1.15));
        else if (opt.spacing) { const cs = [...text], step = fs * (1 + opt.spacing); cs.forEach((ch, i) => g.fillText(ch, px + (i - (cs.length - 1) / 2) * step, py)); }
        else g.fillText(text, px, py);
        g.restore();
      }
      g.textAlign = 'left';
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
