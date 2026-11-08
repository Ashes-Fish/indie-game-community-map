// City size, territory and community placement. Pure logic on the hex grid: no three.js.
// See docs/城市规模与据点方案.md for the rules.
import { HEX_DIRS, hexCenter, hexIndex, hexDist, toWorld } from './config.js';

// community count -> radius. `max` is the largest count a tier holds.
export const TIERS = [
  { r: 2, max: 8, name: '城' },
  { r: 3, max: 18, name: '府城' },
  { r: 4, max: 30, name: '大都会' },
  { r: 5, max: 45, name: '都城' },
  { r: 6, max: Infinity, name: '超大都城' },
];
export const TIER_SMALL = { r: 1, name: '小镇' };
export const MAX_RADIUS = 6;
const SHRINK_SLACK = 2;        // shrink only once the count is this far below the tier's lower bound
const SQUEEZE_DIST = 3;        // a one-community city this close (in hexes) to another city stays at radius 1
const CLUSTER_FILL = 0.6;      // above this share of usable hexes, communities start sharing hexes
export const CLUSTER_MAX = 4;  // communities per cluster hex before overflowing to the next one
const LAND = 0.45;             // max water fraction for a hex to take a district

const tierByR = (r) => (r === 1 ? TIER_SMALL : TIERS.find((t) => t.r === r) || TIERS[TIERS.length - 1]);
const lowerBound = (r) => { const i = TIERS.findIndex((t) => t.r === r); return i <= 0 ? 0 : TIERS[i - 1].max + 1; };

// Radius from count alone (before the squeeze/override rules).
export function radiusForCount(n) { return TIERS.find((t) => n <= t.max).r; }

function baseRadius(city, n, cities) {
  if (city.radiusOverride) return city.radiusOverride;
  if (n <= 1) {
    if (city.county) return 1;
    const near = Math.min(...cities.filter((c) => c !== city).map((c) => hexDist(c.hex, city.hex)));
    if (near <= SQUEEZE_DIST) return 1;
  }
  let r = radiusForCount(n);
  // hysteresis: keep a previously published larger radius until the count clearly drops
  const prev = city.pinnedRadius;
  if (prev && prev > r && !city.radiusOverride && n >= lowerBound(prev) - SHRINK_SLACK) r = prev;
  return r;
}

// Territory: every hex within some city's radius goes to the city with the smallest distance/radius;
// each city always keeps its own first ring.
function claim(hx, cities) {
  for (const h of hx) {
    let best = 0, bk = Infinity;
    cities.forEach((c, ci) => {
      const d = hexDist([h.q, h.r], c.hex);
      if (d > c.radius) return;
      const k = d <= 1 ? d - 10 : d / c.radius - c.radius * 1e-3;
      if (k < bk) { bk = k; best = ci + 1; }
    });
    h.owner = best;
  }
}

const usable = (h, cityIdx) => h.waterFrac < LAND && !h.isCity && h.owner === cityIdx;

export function layoutCities(hx, cities, communities, pins = {}) {
  const pinC = pins.communities || {}, pinR = pins.cities || {};
  const byCity = new Map(cities.map((c) => [c.id, communities.filter((m) => m.cityId === c.id)]));
  for (const c of cities) c.pinnedRadius = pinR[c.id];
  for (const c of cities) c.radius = baseRadius(c, byCity.get(c.id).length, cities);
  const cityAt = new Set(cities.map((c) => hexIndex(c.hex[0], c.hex[1])));
  for (const h of hx) h.isCity = cityAt.has(h.i);

  // squeezed cities grow one ring at a time (never past MAX_RADIUS) until their communities fit
  for (let pass = 0; pass < MAX_RADIUS; pass++) {
    claim(hx, cities);
    let grew = false;
    cities.forEach((c, ci) => {
      const n = byCity.get(c.id).length;
      const free = hx.filter((h) => usable(h, ci + 1)).length;
      if (n > Math.floor(free * CLUSTER_FILL) * CLUSTER_MAX && c.radius < MAX_RADIUS) { c.radius++; grew = true; }
    });
    if (!grew) break;
  }
  for (const c of cities) c.tier = tierByR(c.radius);

  const sites = [];
  cities.forEach((city, ci) => {
    const members = byCity.get(city.id);
    const pool = hx.filter((h) => usable(h, ci + 1));
    const slots = Math.max(1, Math.min(members.length, Math.floor(pool.length * CLUSTER_FILL) || 1));
    const taken = new Map(); // hex index -> site
    const open = (h) => { const s = { hex: [h.q, h.r], cityId: city.id, members: [] }; [s.x, s.z] = hexCenter(h.q, h.r); taken.set(h.i, s); sites.push(s); return s; };
    const score = (h, cm) => {
      let s = -hexDist([h.q, h.r], city.hex) * 3 - h.waterFrac * 6 - h.slope * 0.5;
      const [cx, cz] = hexCenter(h.q, h.r), [ox, oz] = hexCenter(city.hex[0], city.hex[1]);
      const ux = cx - ox, uz = cz - oz, lu = Math.hypot(ux, uz) || 1;
      if (cm.toward) {
        const [tx, tz] = toWorld(cm.toward[0], cm.toward[1]);
        const vx = tx - ox, vz = tz - oz, l = Math.hypot(vx, vz) || 1;
        s += ((vx * ux + vz * uz) / (l * lu)) * 2;
      } else if (cm.prefDir != null) {
        const [dq, dr] = HEX_DIRS[cm.prefDir];
        const [px, pz] = hexCenter(dq, dr), lp = Math.hypot(px, pz);
        s += ((px * ux + pz * uz) / (lp * lu)) * 1.5;
      }
      return s;
    };
    const join = (s, cm) => { s.members.push(cm); cm.site = s; cm.hex = s.hex; cm.x = s.x; cm.z = s.z; };

    // 1. pinned communities keep their hex while it is still valid for their city
    const rest = [];
    for (const cm of members) {
      const p = pinC[cm.key];
      const i = p ? hexIndex(p[0], p[1]) : -1;
      const h = i >= 0 ? hx[i] : null;
      if (h && usable(h, ci + 1)) join(taken.get(h.i) || open(h), cm);
      else rest.push(cm);
    }
    // 2. the rest take the best free hex while there are slots, then pile into clusters
    for (const cm of rest) {
      if (taken.size < slots) {
        let best = null, bs = -Infinity;
        for (const h of pool) { if (taken.has(h.i)) continue; const s = score(h, cm); if (s > bs) { bs = s; best = h; } }
        if (best) { join(open(best), cm); continue; }
      }
      const cands = [...taken.values()];
      let site = null, bs = -Infinity;
      for (const s of cands) {
        const full = s.members.length >= CLUSTER_MAX;
        const v = score(hx[hexIndex(s.hex[0], s.hex[1])], cm) - (full ? 1e3 : 0) - s.members.length * 0.5;
        if (v > bs) { bs = v; site = s; }
      }
      if (!site) site = open(hx[hexIndex(city.hex[0] + 1, city.hex[1])]); // degenerate: no usable land at all
      join(site, cm);
    }
  });
  return sites;
}

// Snapshot to commit as layout-pins.json so later uploads never move existing districts or shrink cities.
export function dumpPins(cities, communities) {
  return {
    cities: Object.fromEntries(cities.map((c) => [c.id, c.radius])),
    communities: Object.fromEntries(communities.map((c) => [c.key, c.hex])),
  };
}
