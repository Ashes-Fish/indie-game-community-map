// World: 1 unit = 1 km. x = east, z = south. Origin at 120.1E 31.1N.
export const LON0 = 120.1, LAT0 = 31.1;
export const KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KZ = 110.6;
export const XMIN = -300, XMAX = 300, ZMIN = -270, ZMAX = 270;
export const HW = 800, HH = 720;            // heightmap size (0.75 km/px)
export const WW = 1200, WH = 1080;          // water SDF size (0.5 km/px)
export const HMAX = 1900;                   // metres for height.png value 255
export const EXAG = 5.4, EXP = 0.78;        // y = EXAG * (h/1000)^EXP
export const HEX_R = 6.5;                   // pointy-top hex circumradius
export const SQ3 = Math.sqrt(3);
export const HEX_W = HEX_R * SQ3;           // flat-to-flat
export const HEX_A = HEX_W / 2;             // apothem
export const HEX_N = 64, HEX_OFF = 32;      // hex data texture size / index offset
export const REGION = { w: 117.8, e: 122.4, s: 29.4, n: 32.8 };

export const toWorld = (lon, lat) => [(lon - LON0) * KX, (LAT0 - lat) * KZ];
export const elevToY = (m) => (m <= 0 ? 0 : EXAG * Math.pow(m / 1000, EXP));

// --- hex math (axial q,r ; pointy-top) ---
export const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export function hexCenter(q, r) { return [HEX_R * (SQ3 * q + SQ3 / 2 * r), HEX_R * 1.5 * r]; }
export function worldToHex(x, z) {
  const qf = (SQ3 / 3 * x - z / 3) / HEX_R, rf = (2 / 3 * z) / HEX_R, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}
export function hexIndex(q, r) {
  const col = q + (r - (r & 1)) / 2;
  const ix = col + HEX_OFF, iy = r + HEX_OFF;
  if (ix < 0 || iy < 0 || ix >= HEX_N || iy >= HEX_N) return -1;
  return iy * HEX_N + ix;
}
export function hexFromIndex(i) {
  const ix = i % HEX_N, iy = (i / HEX_N) | 0;
  const r = iy - HEX_OFF, col = ix - HEX_OFF;
  return [col - (r - (r & 1)) / 2, r];
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
