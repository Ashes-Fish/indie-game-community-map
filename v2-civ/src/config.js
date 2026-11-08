import { toGlobal } from './albers.js';

// One national world (docs/全国一张世界方案.md): 1 unit = 1 km in the Albers frame of src/albers.js, x = east, z = south.
// Land patches (地块, src/data/patches.json) are rectangles in this frame; each carries its own height / water grids
// and its own window onto the global hex grid (world.js).
export const toWorld = toGlobal;
export const RES_H = 0.75, RES_W = 0.5;      // km per pixel of the baked height and water grids
export const EXAG = 5.4, EXP = 0.78;        // y = EXAG * (h/1000)^EXP
export const HEX_R = 6.5;                   // pointy-top hex circumradius
export const SQ3 = Math.sqrt(3);
export const HEX_W = HEX_R * SQ3;           // flat-to-flat
export const HEX_A = HEX_W / 2;             // apothem

export const elevToY = (m) => (m <= 0 ? 0 : EXAG * Math.pow(m / 1000, EXP));

// --- hex math (axial q,r ; pointy-top), global grid ---
export const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export function hexCenter(q, r) { return [HEX_R * (SQ3 * q + SQ3 / 2 * r), HEX_R * 1.5 * r]; }
export function worldToHex(x, z) {
  const qf = (SQ3 / 3 * x - z / 3) / HEX_R, rf = (2 / 3 * z) / HEX_R, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}
export const hexDist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[0] + a[1] - b[0] - b[1]) + Math.abs(a[1] - b[1])) / 2;

// deterministic hash/random
export function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
