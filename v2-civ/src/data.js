import raw from '../../site/data/communities.json';

// Cities in this sample region. color = territory (civ) colour, color2 = secondary trim
export const CITIES = [
  { id: 'nanjing', name: '南京', lon: 118.79, lat: 32.04, color: '#8e5ad6', color2: '#f3d27a', radius: 2, landmark: 'gate' },
  { id: 'changzhou', name: '常州', lon: 119.97, lat: 31.80, color: '#e8862e', color2: '#1d2a48', radius: 2, landmark: 'tianning' },
  { id: 'changshu', name: '常熟', lon: 120.75, lat: 31.65, color: '#d43f3a', color2: '#f6d36b', radius: 1, landmark: 'fangta' },
  { id: 'shanghai', name: '上海', lon: 121.47, lat: 31.23, color: '#d43f3a', color2: '#f6d36b', radius: 2, landmark: 'pearl' },
  { id: 'hangzhou', name: '杭州', lon: 120.19, lat: 30.28, color: '#1fb39a', color2: '#f4f1e4', radius: 2, landmark: 'leifeng' },
];

// Communities in the region. style = district look; toward = real address direction (lon,lat)
const META = {
  'Ludere独游互助社区': { key: 'ludere', cityId: 'shanghai', style: 'guild', prefDir: 3, logo: 'ludere', short: 'Ludere' },
  '游戏客厅': { key: 'keting', cityId: 'hangzhou', style: 'tulou', toward: [120.25, 30.28], logo: 'keting' },
  '赛博利亚': { key: 'cyberia', cityId: 'hangzhou', style: 'cyber', toward: [120.02, 30.36], logo: 'cyberia' },
  '星游集游戏人据点': { key: 'xingyouji', cityId: 'hangzhou', style: 'observatory', toward: [120.02, 30.42], logo: 'xingyouji', short: '星游集' },
  '创乐坊': { key: 'chuanglefang', cityId: 'changzhou', style: 'paifang', prefDir: 2, logo: 'chuanglefang' },
  '存档点': { key: 'cundang', cityId: 'nanjing', style: 'savepoint', toward: [118.9, 32.05], logo: null },
  'The Pinewood Lab艺术游戏社区': { key: 'pinewood', cityId: 'nanjing', style: 'pinewood', toward: [118.63, 32.15], logo: 'pinewood', short: 'Pinewood Lab' },
};

export const COMMUNITIES = raw
  .filter((r) => META[r.name])
  .map((r) => ({ ...r, ...META[r.name] }))
  .sort((a, b) => Object.keys(META).indexOf(a.name) - Object.keys(META).indexOf(b.name));


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
