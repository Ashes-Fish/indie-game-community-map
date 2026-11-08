// National city table and community → city resolution.
import CN from './data/china-cities.json';
import COUNTY from './data/county-cities.json';

// county-level cities that host communities live in data/county-cities.json (规则同常熟：有社群就单独成城)
const SUB_PROVINCIAL = new Set(['深圳', '厦门', '宁波', '青岛', '大连', '苏州']);

export const CN_CITIES = [...CN, ...COUNTY].map((c) => ({ ...c, big: c.cap || SUB_PROVINCIAL.has(c.s) }));
const byName = new Map();
for (const c of CN_CITIES) { byName.set(c.n, c); byName.set(c.s, c); }
const PROVINCES = new Set(CN.map((c) => c.p));

// stable ids for cities that appear in URLs (?view=hangzhou); others fall back to their adcode
export const CITY_SLUGS = {
  北京: 'beijing', 天津: 'tianjin', 上海: 'shanghai', 重庆: 'chongqing', 南京: 'nanjing', 常州: 'changzhou',
  常熟: 'changshu', 杭州: 'hangzhou', 成都: 'chengdu', 西安: 'xian', 深圳: 'shenzhen', 广州: 'guangzhou',
  沈阳: 'shenyang', 厦门: 'xiamen', 福州: 'fuzhou', 苏州: 'suzhou', 武汉: 'wuhan', 长沙: 'changsha',
};
export const cityId = (c) => CITY_SLUGS[c.s] || `c${c.a}`;
export const findCity = (name) => byName.get((name || '').trim());
export const cityById = (id) => CN_CITIES.find((c) => cityId(c) === id);

// A record's main city and the other cities it lists. A province-level entry ("福建", with otherCities "厦门 福州")
// is placed in the first listed city; the rest stay as other cities.
export function resolveCity(r) {
  let city = findCity(r.city);
  let others = (r.otherCities || '').split(/[\s,，、/]+/).filter(Boolean);
  const prov = (r.city || '').replace(/(省|市|自治区)$/, '');
  if (!city && PROVINCES.has(prov)) {
    const first = others.find((n) => findCity(n));
    if (first) { city = findCity(first); others = others.filter((n) => n !== first); }
  }
  return city ? { city, others } : null;
}
