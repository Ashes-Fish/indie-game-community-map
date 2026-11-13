// Entry: one national 3D world (scene.js). ?view=<city> / ?open=<community> / ?region=<patch> start close up;
// the old 2D national map (china.js) is retired, see docs/全国一张世界方案.md.
// Without WebGL2 (or with ?lite=1) the flat paper map with the community list runs instead (lite.js).
import './style.css';
import { hasWebGL2 } from './tiers.js';

const qs = new URLSearchParams(location.search);
if (qs.get('lite') === '1' || !hasWebGL2()) import('./lite.js').then((m) => m.startLite(qs.get('lite') === '1' ? 'url' : 'webgl'));
else import('./scene.js');
