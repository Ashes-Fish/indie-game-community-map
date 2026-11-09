// Draws national paper tiles off the main thread (natdraw.js on an OffscreenCanvas); see natink.js createPainter.
import { loadNational } from './natdraw.js';

let nat = null;
self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    nat = await loadNational(m.base, m.style, m.hubs);
    self.postMessage({ type: 'ready', rect: nat.rect });
  } else if (m.type === 'draw') {
    const c = new OffscreenCanvas(m.w, m.h);
    nat.draw(c.getContext('2d'), m.rect, m.w, m.h);
    const bmp = c.transferToImageBitmap();
    self.postMessage({ type: 'tile', id: m.id, bmp }, [bmp]);
  }
};
