// 3D map regions: each is a 600 × 540 km scene centred on (lon0, lat0), baked by scripts/bake_region.py into
// public/data/regions/<id>/. The national map (china.js) links into them; a page shows one region at a time.
import REGIONS from './data/regions.json';

export { REGIONS };
export const HALF_X = 300, HALF_Z = 270; // km, same extents as config.js
const KZ = 110.6;
const kx = (lat0) => 111.32 * Math.cos((lat0 * Math.PI) / 180);

// region-local km coordinates of a point (x east, z south)
export function regionXZ(id, lon, lat) {
  const r = REGIONS[id];
  return [(lon - r.lon0) * kx(r.lat0), (r.lat0 - lat) * KZ];
}

// the region whose scene contains the point with the most margin (null if none does)
export function regionOf(lon, lat, margin = 40) {
  let best = null, bestM = -Infinity;
  for (const id of Object.keys(REGIONS)) {
    const [x, z] = regionXZ(id, lon, lat);
    const m = Math.min(HALF_X - Math.abs(x), HALF_Z - Math.abs(z));
    if (m > margin && m > bestM) { best = id; bestM = m; }
  }
  return best;
}

// stable ids for cities that appear in URLs (?view=hangzhou); others fall back to their adcode
export const CITY_SLUGS = {
  北京: 'beijing', 天津: 'tianjin', 上海: 'shanghai', 重庆: 'chongqing', 南京: 'nanjing', 常州: 'changzhou',
  常熟: 'changshu', 杭州: 'hangzhou', 成都: 'chengdu', 西安: 'xian', 深圳: 'shenzhen', 广州: 'guangzhou',
  沈阳: 'shenyang', 厦门: 'xiamen', 福州: 'fuzhou', 苏州: 'suzhou', 武汉: 'wuhan', 长沙: 'changsha',
};
