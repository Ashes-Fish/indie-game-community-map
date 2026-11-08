// Land patches (地块): where the 3D world rises out of the national paper map. Generated from the community
// cities by scripts/patches.mjs and baked by scripts/bake_patch.py into public/data/patches/<id>/.
import TABLE from './data/patches.json';
import { toWorld } from './config.js';

export const PATCHES = Object.entries(TABLE).map(([id, p]) => {
  const [x0, z0, x1, z1] = p.rect;
  return { id, ...p, x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
});
export const patchById = (id) => PATCHES.find((p) => p.id === id);

// the patch whose rectangle contains the point with the most margin (null if none)
export function patchAt(x, z, margin = 40) {
  let best = null, bestM = -Infinity;
  for (const p of PATCHES) {
    const m = Math.min(x - p.x0, p.x1 - x, z - p.z0, p.z1 - z);
    if (m > margin && m > bestM) { best = p; bestM = m; }
  }
  return best;
}
export const patchOfLonLat = (lon, lat) => patchAt(...toWorld(lon, lat));
