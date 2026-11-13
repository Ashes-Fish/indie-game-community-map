// Device tiers (全国版优化方案 O3): low / mid / high decide resolution, post-processing, shadows, scenery density and
// the paper tile budget. Picked once from what the browser reports, remembered in localStorage, overridden by ?q=,
// and stepped down (never up) when the measured frame rate stays low. Phones never start above mid.
const KEY = 'igcm.tier.v1';

// q: 'low' | 'mid' | 'high' (URL). Older links used ?q=low / ?q=high for mobile / desktop: same meaning.
export function pickTier(qs) {
  const q = qs.get('q');
  if (q === 'low' || q === 'mid' || q === 'high') return { tier: q, why: 'url' };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    // a saved tier is only reused on the same screen class (a laptop docked to a monitor gets re-measured)
    if (saved && saved.screen === screenClass() && TIERS[saved.tier]) return { tier: saved.tier, why: 'saved' };
  } catch (e) { /* private mode: no storage */ }
  return { tier: guess(), why: 'guess' };
}

export function rememberTier(tier) {
  try { localStorage.setItem(KEY, JSON.stringify({ tier, screen: screenClass(), at: Date.now() })); } catch (e) { /* ignore */ }
}

const phoneLike = () => matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900;
const screenClass = () => (phoneLike() ? 'touch' : 'desk') + ':' + Math.round(Math.max(innerWidth, innerHeight) / 200);

// best effort: memory, cores and the GPU's name; anything unknown counts as "mid"
function guess() {
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  const gpu = gpuName().toLowerCase();
  const weakGpu = /mali-[gt]?[1-7]\d\b|adreno \(tm\) [1-5]\d\d\b|adreno [1-5]\d\d\b|powervr|swiftshader|llvmpipe|basic render|intel\(r\) (hd|uhd) graphics [1-6]\d\d\b/.test(gpu);
  const software = /swiftshader|llvmpipe|basic render/.test(gpu);
  if (software || mem <= 2 || cores <= 2) return 'low';
  if (phoneLike()) return weakGpu || mem <= 3 ? 'low' : 'mid';
  if (weakGpu || mem <= 4) return 'mid';
  return 'high';
}

let _gpu = null;
export function gpuName() {
  if (_gpu !== null) return _gpu;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    _gpu = gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '' : '';
    gl && gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (e) { _gpu = ''; }
  return _gpu;
}
export const hasWebGL2 = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };

// dpr: render pixel ratio cap; post: bloom / tilt-shift / SMAA / screen-space AO; shadow: shadow map size (0 = off);
// trees: scenery density; life: smoke, walkers, birds; paperCache: paper tiles kept on the GPU; paperPerKm: patch crop
// resolution; idleFps: frame rate on a still map.
export const TIERS = {
  low: { dpr: 1, minDpr: 0.6, post: false, shadow: 0, trees: 0.35, life: 0.5, paperCache: 24, paperPerKm: 0.9, idleFps: 12, cropCap: 1024 },
  mid: { dpr: 1.5, minDpr: 0.75, post: false, shadow: 1024, trees: 0.6, life: 0.75, paperCache: 40, paperPerKm: 1.3, idleFps: 20, cropCap: 1536 },
  high: { dpr: 1.5, minDpr: 1, post: true, shadow: 2048, trees: 1, life: 1, paperCache: 80, paperPerKm: 2.2, idleFps: 30, cropCap: 2048 },
};
export const lower = (t) => (t === 'high' ? 'mid' : 'low');
