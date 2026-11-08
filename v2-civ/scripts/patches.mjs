// Work out the 3D land patches (地块) from where communities are: every community city, cities within LINK km
// joined into one patch, patch = their bounding box + MARGIN km in the national frame (src/albers.js toGlobal).
// Usage (from v2-civ/): node scripts/patches.mjs   → src/data/patches.json, then python scripts/bake_patch.py
// Patch ids and names follow the old regions (regions.json) by nearest centre, so data folders and links stay put.
import fs from 'node:fs';
import { toGlobal, fromGlobal } from '../src/albers.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const communities = read('../../site/data/communities.json');
const CN = [...read('../src/data/china-cities.json'), ...read('../src/data/county-cities.json')];
const REGIONS = read('../src/data/regions.json');
const OUT = new URL('../src/data/patches.json', import.meta.url);
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

const LINK = 320, MARGIN = 150, SNAP = 3;   // km; rects snap to 3 km so the 0.75 / 0.5 / 0.25 km bake grids line up
// hand-made extras that must sit inside a patch: 常熟 (Ludere's branch city), 黄山
const EXTRA = [{ s: '常熟', lon: 120.7525, lat: 31.6538 }, { s: '黄山', lon: 118.17, lat: 30.13 }];

// same rule as src/cn.js resolveCity: a province-level record lands in its first listed city
const byName = new Map(); for (const c of CN) { byName.set(c.n, c); byName.set(c.s, c); }
const PROV = new Set(CN.map((c) => c.p));
function resolve(r) {
  let city = byName.get((r.city || '').trim());
  if (!city && PROV.has((r.city || '').replace(/(省|市|自治区)$/, ''))) {
    const first = (r.otherCities || '').split(/[\s,，、/]+/).find((n) => byName.get(n));
    city = first && byName.get(first);
  }
  return city;
}
const cities = [...new Map(communities.map(resolve).filter(Boolean).map((c) => [c.s, c])).values()];
const pts = cities.map((c) => ({ s: c.s, xz: toGlobal(c.lon, c.lat), main: true }));
for (const e of EXTRA) {
  const xz = toGlobal(e.lon, e.lat);
  if (pts.some((p) => Math.hypot(p.xz[0] - xz[0], p.xz[1] - xz[1]) < LINK)) pts.push({ s: e.s, xz, main: false });
}

// single-link clustering
const group = pts.map((_, i) => i);
const find = (i) => (group[i] === i ? i : (group[i] = find(group[i])));
pts.forEach((a, i) => pts.forEach((b, j) => { if (j > i && Math.hypot(a.xz[0] - b.xz[0], a.xz[1] - b.xz[1]) < LINK) group[find(j)] = find(i); }));
const clusters = new Map();
pts.forEach((p, i) => { const k = find(i); if (!clusters.has(k)) clusters.set(k, []); clusters.get(k).push(p); });

const out = {};
for (const ps of clusters.values()) {
  const xs = ps.map((p) => p.xz[0]), zs = ps.map((p) => p.xz[1]);
  const rect = [Math.min(...xs) - MARGIN, Math.min(...zs) - MARGIN, Math.max(...xs) + MARGIN, Math.max(...zs) + MARGIN]
    .map((v, i) => (i < 2 ? Math.floor(v / SNAP) : Math.ceil(v / SNAP)) * SNAP);
  const [clon, clat] = fromGlobal((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);
  let id = null, best = Infinity;
  for (const [rid, r] of Object.entries(REGIONS)) {
    const d = Math.hypot(r.lon0 - clon, r.lat0 - clat);
    if (d < best && !out[rid]) { best = d; id = rid; }
  }
  if (best > 3) id = 'p' + ps.filter((p) => p.main).map((p) => p.s).join('');
  out[id] = {
    name: REGIONS[id]?.name || ps.filter((p) => p.main).map((p) => p.s).join(''),
    rect, cities: ps.filter((p) => p.main).map((p) => p.s),
    hmax: old[id]?.rect?.join() === rect.join() ? old[id].hmax : REGIONS[id]?.hmax ?? null,   // set by the bake
  };
}
fs.writeFileSync(OUT, '{\n' + Object.entries(out).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
for (const [k, v] of Object.entries(out)) console.log(k, v.name, v.rect.join(','), `${v.rect[2] - v.rect[0]}×${v.rect[3] - v.rect[1]} km`, v.cities.join(' '));
