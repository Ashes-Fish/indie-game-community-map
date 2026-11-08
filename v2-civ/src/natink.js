// 全国古舆图纸面（方向 A，见 docs/全国一张世界方案.md）: the whole country drawn once into a canvas in the national
// frame (config.js), laid under and around the land patches as the fog-of-war paper.
// Style 'qinglv' (墨线 + 青绿淡彩) is the chosen look; 'mo' (纯墨 + 做旧纸黄) stays as ?paper=mo.
import * as THREE from 'three';
import { albers, Z0 } from './albers.js';
import { toWorld, rng } from './config.js';
import { drawMountain, compass, KAI } from './parchment.js';
import { CN_CITIES } from './cn.js';

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
// paper colour of the region's own fog paper (terrain.js C_PAPER), to tint it toward the chosen style
const C_PAPER = new THREE.Color('#e4d0a4');
export function paperMul(style) {
  const c = new THREE.Color(PAPER_STYLES[style].paper);
  return new THREE.Vector3(c.r / C_PAPER.r, c.g / C_PAPER.g, c.b / C_PAPER.b);
}

const toLocal = toWorld;
const localToAlbers = (x, z) => [x, Z0 - z];

// province name positions where the centroid lands on a neighbour or a capital
const LABEL_AT = { 河北: [115.4, 38.3], 内蒙古: [112.5, 42.6], 甘肃: [100.8, 38.6], 北京: null, 天津: null, 上海: null, 香港: null, 澳门: null };

export async function buildNationalInk(base, style, maxSize, hubs = []) {
  const S = PAPER_STYLES[style] || PAPER_STYLES.qinglv;
  const [map, rj, elevImg] = await Promise.all([
    fetch(base + 'data/china/map.json').then((r) => r.json()),
    fetch(base + 'data/china/relief.json').then((r) => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = base + 'data/china/elev.png'; }),
  ]);
  // elevation lookup (metres, 0 = sea, -1 = beyond the data) and "inside China"
  const ec = document.createElement('canvas'); ec.width = elevImg.width; ec.height = elevImg.height;
  const eg = ec.getContext('2d', { willReadFrequently: true }); eg.drawImage(elevImg, 0, 0);
  const ED = eg.getImageData(0, 0, ec.width, ec.height).data, EW = ec.width, EH = ec.height;
  const cell = (x, z) => {
    const [ax, ay] = localToAlbers(x, z);
    const i = Math.floor(((ax - rj.xmin) / (rj.xmax - rj.xmin)) * EW), j = Math.floor(((rj.ymax - ay) / (rj.ymax - rj.ymin)) * EH);
    return i < 0 || j < 0 || i >= EW || j >= EH ? -1 : (j * EW + i) * 4;
  };
  const elev = (x, z) => { const k = cell(x, z); if (k < 0) return -1; const v = ED[k] / 255; return ED[k] ? v * v * 6000 : 0; };
  const inCN = (x, z) => { const k = cell(x, z); return k >= 0 && ED[k + 1] > 127; };

  // canvas extent: the whole country plus a sea margin, in local km
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let lo = 73; lo <= 136; lo += 1) for (const la of [16, 20, 30, 40, 50, 54]) {
    const [x, z] = toLocal(lo, la);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  x0 -= 260; x1 += 260; z0 -= 220; z1 += 320;
  const CW = maxSize, CH = Math.round(maxSize * (z1 - z0) / (x1 - x0));
  const s = CW / (x1 - x0);                      // px per km
  const k = maxSize / 4096;                      // line widths and fonts are tuned at 4096
  const P = (x, z) => [(x - x0) * s, (z - z0) * s];
  const LL = (lo, la) => P(...toLocal(lo, la));
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const R = rng(20261109);
  g.lineCap = 'round'; g.lineJoin = 'round';

  // paper with a few large age stains
  g.fillStyle = S.paper; g.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 26; i++) {
    const x = R() * CW, y = R() * CH, r = (0.05 + R() * 0.12) * CW;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, S.stain); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  // sea: a low-res mask, tinted and outlined
  const MW = 1024, MH = Math.round(MW * CH / CW);
  const mk = document.createElement('canvas'); mk.width = MW; mk.height = MH;
  const mg = mk.getContext('2d'); const md = mg.createImageData(MW, MH);
  const sea = new Uint8Array(MW * MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
    const x = x0 + ((i + 0.5) / MW) * (x1 - x0), z = z0 + ((j + 0.5) / MH) * (z1 - z0);
    const e = elev(x, z);
    if (e >= 0) { sea[j * MW + i] = e === 0 ? 1 : 0; continue; }
    const [ax, ay] = localToAlbers(x, z);   // beyond the elevation grid: the South China Sea and the Pacific are open sea
    sea[j * MW + i] = ay < rj.ymin || ax > rj.xmax ? 1 : 0;
  }
  const tint = new THREE.Color(); const sm = S.sea.match(/[\d.]+/g).map(Number);
  tint.setRGB(sm[0] / 255, sm[1] / 255, sm[2] / 255);
  for (let i = 0; i < MW * MH; i++) {
    if (!sea[i]) continue;
    md.data[i * 4] = sm[0]; md.data[i * 4 + 1] = sm[1]; md.data[i * 4 + 2] = sm[2]; md.data[i * 4 + 3] = sm[3] * 255;
  }
  mg.putImageData(md, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(mk, 0, 0, CW, CH);
  // coast: mask edges as a soft ink line
  const ed = mg.createImageData(MW, MH);
  for (let j = 1; j < MH - 1; j++) for (let i = 1; i < MW - 1; i++) {
    const q = j * MW + i;
    if (sea[q] && (!sea[q - 1] || !sea[q + 1] || !sea[q - MW] || !sea[q + MW])) { ed.data[q * 4 + 3] = 255; }
  }
  mg.clearRect(0, 0, MW, MH); mg.putImageData(ed, 0, 0);
  g.save(); g.globalAlpha = 0.5; g.filter = 'blur(0.8px)'; g.drawImage(mk, 0, 0, CW, CH); g.restore();
  // wave rows in open sea
  g.strokeStyle = S.wave; g.lineWidth = 1.6 * k;
  for (let n = 0; n < 2600; n++) {
    const i = Math.floor(R() * MW), j = Math.floor(R() * MH);
    if (!sea[j * MW + i] || !sea[j * MW + Math.min(MW - 1, i + 3)] || !sea[j * MW + Math.max(0, i - 3)] || !sea[Math.min(MH - 1, j + 2) * MW + i]) continue;
    const px = (i / MW) * CW, py = (j / MH) * CH, w = (16 + R() * 18) * k;
    g.beginPath(); g.moveTo(px - w, py);
    g.bezierCurveTo(px - w * 0.5, py - 5 * k, px - w * 0.2, py + 4 * k, px, py);
    g.bezierCurveTo(px + w * 0.25, py - 5 * k, px + w * 0.6, py + 3 * k, px + w, py - 1 * k);
    g.stroke();
  }

  // lakes
  for (const l of map.lakes) {
    g.beginPath();
    for (const r of l.r) r.forEach(([lo, la], i) => { const [px, py] = LL(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.fillStyle = S.lake; g.fill('evenodd');
    g.strokeStyle = S.coast; g.lineWidth = 1.2 * k; g.stroke();
  }
  // rivers: big ones as double lines (古舆图 style), small ones single
  for (const rv of map.rivers) {
    if (rv.r > 6) continue;
    g.beginPath(); rv.p.forEach(([lo, la], i) => { const [px, py] = LL(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    if (rv.r <= 3) {
      g.strokeStyle = S.river; g.lineWidth = 5.2 * k; g.stroke();
      g.strokeStyle = S.paper; g.lineWidth = 2.4 * k; g.stroke();
    } else { g.strokeStyle = S.river; g.lineWidth = (rv.r <= 4 ? 2.2 : 1.4) * k; g.stroke(); }
  }

  // mountains where the land stands high or rugged; neighbours fainter
  const sp = 58, glyphs = [];
  for (let z = z0 + sp; z < z1 - sp; z += sp * 0.82) for (let x = x0 + sp; x < x1 - sp; x += sp) {
    const jx = x + (R() - 0.5) * sp * 0.9, jz = z + (R() - 0.5) * sp * 0.7;
    const e = elev(jx, jz);
    if (e <= 0) continue;
    const nb = [[30, 0], [-30, 0], [0, 30], [0, -30], [21, 21], [-21, -21]].map(([dx, dz]) => elev(jx + dx, jz + dz)).filter((v) => v > 0);
    const rel = nb.length ? Math.max(e, ...nb) - Math.min(e, ...nb) : 0;
    // ranges, not plateaus: rugged ground only (the flat Tibetan / Mongolian plateaus stay open paper)
    if (!(rel > (e > 3500 ? 1100 : 700) || (rel > 420 && e > 900 && e < 3500))) continue;
    glyphs.push({ x: jx, z: jz, e, cn: inCN(jx, jz) });
  }
  glyphs.sort((a, b) => a.z - b.z);
  for (const m of glyphs) {
    const [px, py] = P(m.x, m.z);
    const w = (30 + Math.min(m.e, 5500) / 200) * s * (0.85 + R() * 0.3);
    const h = w * (0.5 + Math.min(m.e, 5000) / 9000 + R() * 0.1);
    g.globalAlpha = m.cn ? 1 : 0.45;
    drawMountain(g, px, py, w, h, R, m.e > 2600, S.mtn);
  }
  g.globalAlpha = 1;

  // boundary rings split into land runs and coast runs (sea within ~14 km on either side of a segment):
  // borders are drawn only over land, the coast gets a plain ink line
  const runs = (ring) => {
    const L = ring.map(([lo, la]) => toLocal(lo, la)), out = { land: [], coast: [] };
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
  const strokeRuns = (list) => { g.beginPath(); for (const r of list) r.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
  g.setLineDash([7 * k, 5 * k]); g.strokeStyle = S.province; g.lineWidth = 1.6 * k;
  for (const p of map.provinces) for (const r of p.r) strokeRuns(runs(r).land);
  g.setLineDash([]);
  const cRuns = map.country.map(runs);
  g.strokeStyle = S.coast; g.lineWidth = 2.2 * k;
  for (const r of cRuns) strokeRuns(r.coast);
  g.strokeStyle = S.border[0]; g.lineWidth = 5 * k;
  for (const r of cRuns) strokeRuns(r.land);
  g.strokeStyle = S.border[1]; g.lineWidth = 2 * k;
  for (const r of cRuns) strokeRuns(r.land);

  // province names, capitals and community cities as seals
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of map.provinces) {
    const at = p.n in LABEL_AT ? LABEL_AT[p.n] : p.c;
    if (!at) continue;
    const [px, py] = LL(at[0], at[1]);
    g.font = `400 ${72 * k}px ${KAI}`; g.fillStyle = S.label;
    const ch = [...p.n], step = 84 * k;
    ch.forEach((t, i) => g.fillText(t, px + (i - (ch.length - 1) / 2) * step, py));
  }
  const hubNames = new Set(hubs);
  g.textAlign = 'left';
  for (const cc of CN_CITIES) {
    const hub = hubNames.has(cc.s);
    if (!cc.cap && !hub) continue;
    const [px, py] = LL(cc.lon, cc.lat), r = (hub ? 9 : 6) * k;
    g.fillStyle = S.seal; g.fillRect(px - r, py - r, 2 * r, 2 * r);
    g.strokeStyle = `rgba(${S.mtn.ink},0.9)`; g.lineWidth = 1.4 * k; g.strokeRect(px - r * 1.5, py - r * 1.5, r * 3, r * 3);
    g.font = `400 ${(hub ? 30 : 24) * k}px ${KAI}`; g.fillStyle = `rgba(${S.mtn.ink},0.88)`;
    g.fillText(cc.s, px + r * 2.2, py);
  }

  // 南海诸岛 inset in the bottom-right sea, at its own scale (standard-map convention)
  {
    const iw = CW * 0.11, ih = iw * 1.45, ix = CW - iw - CW * 0.03, iy = CH - ih - CH * 0.04;
    const [bx0, by0] = albers(105.5, 2.5), [bx1, by1] = albers(123.5, 24.5);
    const kk = Math.min(iw / (bx1 - bx0), ih / (by1 - by0));
    const T = (lo, la) => { const [ax, ay] = albers(lo, la); return [ix + (ax - bx0) * kk, iy + ih - (ay - by0) * kk]; };
    g.save();
    g.fillStyle = S.paper; g.fillRect(ix, iy, iw, ih);
    g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
    for (const p of map.provinces) {
      if (!['海南', '广东', '广西', '台湾', '福建', '云南'].includes(p.n)) continue;
      g.beginPath();
      for (const r of p.r) r.forEach(([lo, la], i) => { const [px, py] = T(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.fillStyle = 'rgba(255,250,235,0.35)'; g.fill('evenodd');
      g.strokeStyle = S.coast; g.lineWidth = 1.2 * k; g.stroke();
    }
    g.strokeStyle = S.border[0]; g.lineWidth = 3 * k;
    for (const d of map.jd) { g.beginPath(); d.forEach(([lo, la], i) => { const [px, py] = T(lo, la); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
    g.restore();
    g.strokeStyle = S.border[0]; g.lineWidth = 3 * k; g.strokeRect(ix, iy, iw, ih);
    g.font = `400 ${26 * k}px ${KAI}`; g.fillStyle = S.label; g.textAlign = 'right'; g.textBaseline = 'bottom';
    g.fillText('南海诸岛', ix + iw - 8 * k, iy + ih - 6 * k);
    compass(g, ix + iw * 0.5, iy - 150 * k, 70 * k);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.flipY = false;   // canvas row 0 is the northern edge z0, like uv.y = 0
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { tex: t, rect: new THREE.Vector4(x0, z0, x1, z1), canvas: c };
}
