// The national paper on the page side: style tint for the patches' own paper, and a painter that turns any rectangle
// of the national frame into a texture. Drawing (natdraw.js) runs in a worker when OffscreenCanvas is available, so
// zooming in never stalls on it; otherwise on the page.
import * as THREE from 'three';
import { PAPER_STYLES, loadNational } from './natdraw.js';

export { PAPER_STYLES };

// paper colour of the patches' own fog paper (terrain.js C_PAPER), to tint it toward the chosen style
const C_PAPER = new THREE.Color('#e4d0a4');
export function paperMul(style) {
  const c = new THREE.Color(PAPER_STYLES[style].paper);
  return new THREE.Vector3(c.r / C_PAPER.r, c.g / C_PAPER.g, c.b / C_PAPER.b);
}

function texture(img) {
  const t = img instanceof HTMLCanvasElement ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.flipY = false;   // row 0 is the northern edge, like uv.y = 0
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

// { rect, paint(r, w, h) → Promise<THREE.Texture> }
export async function createPainter(base, style, hubs = []) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined' && new URLSearchParams(location.search).get('paperworker') !== '0') {
    try {
      const w = new Worker(new URL('./paperWorker.js', import.meta.url), { type: 'module' });
      const waiting = new Map();
      let id = 0, ready;
      const rect = await new Promise((res, rej) => {
        ready = res;
        w.onerror = (e) => rej(e);
        w.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'ready') ready(m.rect);
          else if (m.type === 'tile') { waiting.get(m.id)(texture(m.bmp)); waiting.delete(m.id); }
        };
        w.postMessage({ type: 'init', base: new URL(base, location.href).href, style, hubs });
      });
      return {
        rect, worker: true,
        paint(r, pw, ph) { return new Promise((res) => { waiting.set(++id, res); w.postMessage({ type: 'draw', id, rect: r, w: pw, h: ph }); }); },
      };
    } catch (e) { console.warn('[paper] worker unavailable, drawing on the page', e); }
  }
  const nat = await loadNational(base, style, hubs);
  return {
    rect: nat.rect, worker: false,
    paint(r, pw, ph) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      nat.draw(c.getContext('2d'), r, pw, ph);
      return Promise.resolve(texture(c));
    },
  };
}
