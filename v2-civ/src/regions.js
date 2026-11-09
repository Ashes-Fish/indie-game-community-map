// 城市群 (regions): the middle level of 全国 → 城市群 → 城市. Each region is a fixed box in lon/lat; cities fall into the
// first region whose box contains them. Regions without a community yet are reserved: they still get a national banner
// (greyed, "暂无社团") so the map shows where the country's other clusters are, and a city added there later simply lands
// in the right region. One region may hold several land patches (华东 holds 长三角 and 闽南闽东).
import { toWorld } from './config.js';

// [id, name, lon0, lat0, lon1, lat1, anchor lon, anchor lat (where the banner sits and the camera centres)]
const TABLE = [
  ['jjj',     '京津冀',   113.5, 36.0, 119.9, 42.5, 116.6, 39.5],
  ['liaozhongnan', '辽中南', 119.9, 38.6, 126.0, 43.5, 123.4, 41.5],
  ['haha',    '哈长',     122.5, 43.5, 135.0, 53.5, 126.0, 45.5],
  ['shandong', '山东半岛', 114.8, 34.4, 122.9, 38.6, 118.6, 36.5],
  ['zhongyuan', '中原',   110.3, 31.4, 116.7, 36.4, 113.6, 34.4],
  ['guanzhong', '关中',   104.3, 32.6, 111.2, 37.6, 108.9, 34.3],
  ['yrd',     '长三角',   116.2, 27.2, 123.4, 34.4, 120.0, 31.0],
  ['changzhongyou', '长江中游', 108.8, 26.0, 116.2, 31.4, 113.0, 29.6],
  ['chengyu', '成渝',     101.0, 27.5, 110.3, 32.6, 105.5, 30.0],
  ['haixia',  '海峡西岸', 115.0, 23.4, 121.0, 28.4, 118.5, 25.9],
  ['prd',     '珠三角',   109.6, 20.0, 117.5, 25.3, 113.5, 22.8],
  ['beibuwan', '北部湾',  104.0, 20.0, 110.4, 25.3, 108.3, 22.3],
  ['dianzhong', '滇中',   97.5, 21.0, 106.2, 29.5, 102.7, 25.0],
  ['qianzhong', '黔中',   103.6, 24.6, 109.6, 29.3, 106.7, 26.6],
  ['lanxi',   '兰西',     95.0, 34.5, 107.0, 40.0, 103.8, 36.1],
  ['ningxia', '宁夏沿黄', 104.3, 35.2, 107.7, 39.4, 106.3, 38.5],
  ['hubao',   '呼包鄂榆', 107.7, 37.6, 114.0, 42.2, 111.6, 40.8],
  ['tianshan', '天山北坡', 79.0, 40.0, 92.0, 48.0, 87.6, 43.8],
  ['xizang',  '藏中',     85.0, 27.0, 95.0, 32.5, 91.1, 29.7],
  ['hainan',  '海南',     108.0, 18.0, 111.5, 20.2, 110.3, 19.9],
  ['taiwan',  '台湾',     119.5, 21.5, 122.5, 25.5, 121.0, 24.2],
];

export const REGIONS = TABLE.map(([id, name, lon0, lat0, lon1, lat1, alon, alat]) => {
  const [ax, az] = toWorld(alon, alat);
  return { id, name, lon0, lat0, lon1, lat1, ax, az, cities: [], patches: new Set() };
});
export const regionById = (id) => REGIONS.find((r) => r.id === id);
export const regionOfLonLat = (lon, lat) => REGIONS.find((r) => lon >= r.lon0 && lon < r.lon1 && lat >= r.lat0 && lat < r.lat1) || null;

// attach the cities (with world coordinates and patch ids) once they are known; returns the regions in use
export function assignRegions(cities) {
  for (const r of REGIONS) { r.cities = []; r.patches.clear(); }
  for (const c of cities) {
    const r = regionOfLonLat(c.lon, c.lat);
    if (!r) continue;
    c.region = r.id;
    r.cities.push(c);
    if (c.patch) r.patches.add(c.patch);
  }
  return REGIONS.filter((r) => r.cities.length);
}

// camera framing for one region: centred on its cities (anchor if none), far enough to show all of them
export function regionView(r, portrait) {
  if (!r.cities.length) return { x: r.ax, z: r.az, d: portrait ? 1500 : 900 };
  const xs = r.cities.map((c) => c.x), zs = r.cities.map((c) => c.z);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
  const span = Math.max(w, h * (portrait ? 0.9 : 1.5), 260);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 + span * 0.08, d: Math.min(1080, span * 1.75 + 220) * (portrait ? 1.5 : 1) };
}
