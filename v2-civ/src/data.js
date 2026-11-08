import raw from '../../site/data/communities.json';

import { BUILTIN_STYLES } from './models.js';
import { REGION_ID } from './config.js';
import { resolveCity, cityId, regionOfCity } from './cn.js';

// Cities of the current 3D region. color = territory (civ) colour, color2 = secondary trim.
// Radius is computed from the community count (layout.js); county = 县级市, radiusOverride = manual size.
// 长三角 is hand-tuned (colours, landmarks); other regions list every city that hosts a community there.
const YRD_CITIES = [
  { id: 'nanjing', name: '南京', lon: 118.79, lat: 32.04, color: '#8e5ad6', color2: '#f3d27a', landmark: 'gate', big: true },
  { id: 'changzhou', name: '常州', lon: 119.97, lat: 31.80, color: '#e8862e', color2: '#1d2a48', landmark: 'tianning' },
  { id: 'changshu', name: '常熟', lon: 120.75, lat: 31.65, color: '#d43f3a', color2: '#f6d36b', landmark: 'fangta', county: true },
  { id: 'shanghai', name: '上海', lon: 121.47, lat: 31.23, color: '#d43f3a', color2: '#f6d36b', landmark: 'pearl', big: true },
  { id: 'hangzhou', name: '杭州', lon: 120.19, lat: 30.28, color: '#1fb39a', color2: '#f4f1e4', landmark: 'leifeng', big: true },
];
const PALETTE = [['#8e5ad6', '#f3d27a'], ['#e8862e', '#1d2a48'], ['#1fb39a', '#f4f1e4'], ['#3a78c8', '#f2d27a'],
  ['#c2457a', '#f6e7c8'], ['#2e9e5b', '#f3d27a'], ['#c9a227', '#1d2a48'], ['#d43f3a', '#f6d36b']];
function regionCities() {
  const out = new Map();
  for (const r of raw) {
    const res = resolveCity(r);
    if (!res || regionOfCity(res.city) !== REGION_ID) continue;
    const c = res.city, id = cityId(c);
    if (!out.has(id)) out.set(id, { id, name: c.s, lon: c.lon, lat: c.lat, big: c.big, county: !!c.county });
  }
  return [...out.values()].map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length][0], color2: PALETTE[i % PALETTE.length][1] }));
}
export const CITIES = REGION_ID === 'yrd' ? YRD_CITIES : regionCities();
// every city in the country that hosts a community (short names), for the national ink map
export const HUB_CITIES = [...new Set(raw.map((r) => resolveCity(r)).filter(Boolean).map((r) => r.city.s))];

// Hand-tuned extras for known communities: model = district look; toward = real address direction (lon,lat).
// Communities without an entry get a key and a built-in model derived from their name.
const META = {
  'Ludere独游互助社区': { key: 'ludere', model: { kind: 'builtin', style: 'guild' }, prefDir: 3, logo: 'ludere', short: 'Ludere' },
  '游戏客厅': { key: 'keting', model: { kind: 'builtin', style: 'tulou' }, toward: [120.25, 30.28], logo: 'keting' },
  '赛博利亚': { key: 'cyberia', model: { kind: 'builtin', style: 'cyber' }, toward: [120.02, 30.36], logo: 'cyberia' },
  '星游集游戏人据点': { key: 'xingyouji', model: { kind: 'builtin', style: 'observatory' }, toward: [120.02, 30.42], logo: 'xingyouji', short: '星游集' },
  '创乐坊': { key: 'chuanglefang', model: { kind: 'builtin', style: 'paifang' }, prefDir: 2, logo: 'chuanglefang' },
  '存档点': { key: 'cundang', model: { kind: 'builtin', style: 'savepoint' }, toward: [118.9, 32.05], logo: null },
  'The Pinewood Lab艺术游戏社区': { key: 'pinewood', model: { kind: 'builtin', style: 'pinewood' }, toward: [118.63, 32.15], logo: 'pinewood', short: 'Pinewood Lab' },
};

function strHash(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h >>> 0; }

export function normalizeCommunity(r) {
  const res = resolveCity(r);
  const city = res && CITIES.find((c) => c.id === cityId(res.city));
  if (!city) return null;
  const m = META[r.name] || {};
  const key = m.key || r.key || 'c' + strHash(r.name).toString(36);
  const model = m.model || r.model || { kind: 'builtin', style: BUILTIN_STYLES[strHash(r.name) % BUILTIN_STYLES.length] };
  const short = m.short || r.short;
  return { ...r, ...m, otherCities: res.others.join(' '), key, model, cityId: city.id, logo: m.logo ?? null, short, glyph: [...(short || r.name)][0] };
}

// Append-only order matters: placement walks communities in this order, so new entries never displace old ones.
export const COMMUNITIES = raw.map(normalizeCommunity).filter(Boolean);

// ?mock=shanghai:40,hangzhou:12 adds placeholder communities to try out city tiers and cluster hexes.
const mock = new URLSearchParams(location.search).get('mock');
if (mock) {
  for (const part of mock.split(',')) {
    const [id, n] = part.split(':');
    const city = CITIES.find((c) => c.id === id);
    for (let i = 0; city && i < +n; i++) {
      COMMUNITIES.push(normalizeCommunity({ name: `测试社群 ${city.name}${i + 1}`, city: city.name, intro: '用于测试城市分档的占位社群。' }));
    }
  }
}

export function parseContact(s) {
  if (!s) return [];
  const out = [];
  const parts = s.split(/\n/);
  for (const p of parts) {
    const m = p.match(/^\s*(微信|wx\/qq|wechat|Wechat|QQ|qq)\s*[:：]?\s*(.+)$/i);
    if (m) {
      const k = /qq/i.test(m[1]) && !/wx/i.test(m[1]) ? 'QQ' : '微信';
      out.push({ label: k, value: m[2].trim() });
    } else out.push({ label: '微信', value: p.trim() });
  }
  return out;
}
