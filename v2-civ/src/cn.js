// National city table and community → city resolution, shared by the national map and the 3D regions.
import CN from './data/china-cities.json';
import { CITY_SLUGS, regionOf } from './regions.js';

// county-level cities that host communities (the national table is prefecture-level); 规则同常熟：有社群就单独成城
const COUNTY = [{ a: 320581, n: '常熟市', s: '常熟', p: '江苏', lon: 120.7525, lat: 31.6538, cap: false, county: true }];
const SUB_PROVINCIAL = new Set(['深圳', '厦门', '宁波', '青岛', '大连', '苏州']);

export const CN_CITIES = [...CN, ...COUNTY].map((c) => ({ ...c, big: c.cap || SUB_PROVINCIAL.has(c.s) }));
const byName = new Map();
for (const c of CN_CITIES) { byName.set(c.n, c); byName.set(c.s, c); }
const PROVINCES = new Set(CN.map((c) => c.p));

export const cityId = (c) => CITY_SLUGS[c.s] || `c${c.a}`;
export const findCity = (name) => byName.get((name || '').trim());
export const cityById = (id) => CN_CITIES.find((c) => cityId(c) === id);
export const regionOfCity = (c) => regionOf(c.lon, c.lat);

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
