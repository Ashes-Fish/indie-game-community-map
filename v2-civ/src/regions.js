// 地理大区 (regions): the middle level of 全国 → 大区 → 城市. The seven customary geographic regions of China, each
// a fixed list of provinces; a city belongs to its province's region. Regions without a community yet are reserved:
// they still appear on the country view (grey seal, "暂无社群"), so the map shows the whole country's shape, and a
// city added there later lands in the right region without code changes. One region may hold several land patches
// (华东 holds 长三角 and 闽南闽东; 华北 holds 京津 and, later, anything in 山西 or 内蒙古).
import { toWorld } from './config.js';

// [id, name, provinces, anchor lon, anchor lat (where the reserved seal sits and an empty region's camera centres)]
const TABLE = [
  ['huabei',   '华北', ['北京', '天津', '河北', '山西', '内蒙古'], 114.5, 40.3],
  ['dongbei',  '东北', ['辽宁', '吉林', '黑龙江'], 126.0, 45.0],
  ['huadong',  '华东', ['上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '台湾'], 118.8, 30.4],
  ['huazhong', '华中', ['河南', '湖北', '湖南'], 113.2, 31.2],
  ['huanan',   '华南', ['广东', '广西', '海南', '香港', '澳门'], 111.8, 22.8],
  ['xinan',    '西南', ['重庆', '四川', '贵州', '云南', '西藏'], 102.2, 28.4],
  ['xibei',    '西北', ['陕西', '甘肃', '青海', '宁夏', '新疆'], 97.5, 38.0],
];

export const REGIONS = TABLE.map(([id, name, provinces, alon, alat]) => {
  const [ax, az] = toWorld(alon, alat);
  return { id, name, provinces, ax, az, cities: [], patches: new Set() };
});
export const regionById = (id) => REGIONS.find((r) => r.id === id);
export const regionOfProvince = (p) => REGIONS.find((r) => r.provinces.includes((p || '').replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, ''))) || null;

// attach the cities (with world coordinates, province and patch ids) once they are known
export function assignRegions(cities) {
  for (const r of REGIONS) { r.cities = []; r.patches.clear(); }
  for (const c of cities) {
    const r = regionOfProvince(c.province);
    if (!r) continue;
    c.region = r.id;
    r.cities.push(c);
    if (c.patch) r.patches.add(c.patch);
  }
  return REGIONS.filter((r) => r.cities.length);
}

// camera framing for one region: centred on its cities (anchor if none), far enough to show all of them.
// A region is big (华东 spans 1100 km north–south), so the frame may sit above FAR_D; that is fine, the paper and
// city banners carry this level.
export function regionView(r, portrait) {
  if (!r.cities.length) return { x: r.ax, z: r.az, d: portrait ? 2000 : 1300 };
  const xs = r.cities.map((c) => c.x), zs = r.cities.map((c) => c.z);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
  const span = Math.max(w, h * (portrait ? 0.9 : 1.5), 300);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 + span * 0.03, d: Math.min(2300, span * 1.75 + 260) * (portrait ? 1.5 : 1) };
}
