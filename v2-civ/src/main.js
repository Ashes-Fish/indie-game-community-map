// Entry: the national ancient map (china.js) by default; a 3D region (scene.js) with ?region=<id>.
// Older links (?view=hangzhou, ?open=cyberia, ?mock=…) open the region that contains them.
import { REGIONS } from './regions.js';
import { cityById, regionOfCity } from './cn.js';

const qs = new URLSearchParams(location.search);
const want3D = ['region', 'view', 'open', 'mock', 'cx'].some((k) => qs.has(k));
if (want3D && !REGIONS[qs.get('region')]) {
  const city = qs.get('view') && cityById(qs.get('view'));
  qs.set('region', (city && regionOfCity(city)) || 'yrd');
  history.replaceState(null, '', `${location.pathname}?${qs}${location.hash}`);
}
if (want3D) import('./scene.js');
else import('./china.js');
