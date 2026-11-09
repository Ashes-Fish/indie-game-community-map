// Ink drawing for the fog-of-war "old Chinese map" (古舆图) layer, drawn once into a canvas texture.
import * as THREE from 'three';
import { toWorld, rng } from './config.js';
import { CN_CITIES } from './cn.js';
import { KAI, drawMountain, compass, cloud } from './inkdraw.js';

export { KAI, drawMountain, compass, cloud };

// skip: names of cities that get their own 3D city (banners), so the ink map doesn't label them twice
// Covers the land patch's rectangle (world.x0…z1); beyond it the national paper map (natink.js) takes over.
export async function buildInkTexture(world, rivers, maxSize, skip = [], pal = undefined) {
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));
  const { x0: XMIN, z0: ZMIN, x1: XMAX, z1: ZMAX } = world;
  const CW = maxSize, CH = Math.round(maxSize * (ZMAX - ZMIN) / (XMAX - XMIN));
  const s = CW / (XMAX - XMIN); // px per km
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  const P = (x, z) => [(x - XMIN) * s, (z - ZMIN) * s];
  const LL = (lon, lat) => P(...toWorld(lon, lat));
  const R = rng(20251103);
  g.lineCap = 'round'; g.lineJoin = 'round';

  // --- thin rivers (not in the water SDF) ---
  for (const r of rivers) {
    if (r.water) continue;
    g.beginPath();
    r.pts.forEach(([x, z], i) => { const [px, py] = P(x, z); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.strokeStyle = 'rgba(52,72,84,0.75)'; g.lineWidth = 1.3 * s * 0.5 + 0.8; g.stroke();
  }

  // --- mountains: rows of rounded ink peaks with mineral-green wash ---
  const glyphs = [];
  const sp = 6.2;
  for (let z = ZMIN + 3; z < ZMAX - 3; z += sp * 0.8) {
    for (let x = XMIN + 3; x < XMAX - 3; x += sp) {
      const jx = x + (R() - 0.5) * sp * 0.9, jz = z + (R() - 0.5) * sp * 0.7;
      if (world.sdf(jx, jz) > -1.2) continue;
      const e = world.relM(jx, jz);
      if (e < 140 + R() * 80) continue;
      glyphs.push({ x: jx, z: jz, e });
    }
  }
  glyphs.sort((a, b) => a.z - b.z);
  let n = 0;
  for (const m of glyphs) {
    const [px, py] = P(m.x, m.z);
    const w = (4.2 + Math.min(m.e, 1500) / 260) * s * (0.85 + R() * 0.3);
    const h = w * (0.48 + Math.min(m.e, 1500) / 3200 + R() * 0.1);
    drawMountain(g, px, py, w, h, R, m.e > 700, pal);
    if (++n % 100 === 0) await yieldNow();
  }
  await yieldNow();

  // --- labels ---
  const label = (lon, lat, text, size, opt = {}) => {
    const [px, py] = LL(lon, lat);
    g.save();
    g.font = `${opt.bold ? 700 : 400} ${size * s}px ${KAI}`;
    g.fillStyle = opt.color || 'rgba(38,28,20,0.86)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (opt.vertical) {
      [...text].forEach((ch, i) => g.fillText(ch, px, py + (i - (text.length - 1) / 2) * size * s * 1.15));
    } else {
      if (opt.spacing) {
        const chars = [...text]; const step = size * s * (1 + opt.spacing);
        chars.forEach((ch, i) => g.fillText(ch, px + (i - (chars.length - 1) / 2) * step, py));
      } else g.fillText(text, px, py);
    }
    g.restore();
  };
  const city = (lon, lat, name, dx = 1) => {
    const [px, py] = LL(lon, lat);
    const k = 1.6 * s;
    g.save();
    g.strokeStyle = 'rgba(45,30,20,0.9)'; g.lineWidth = 0.35 * s;
    g.fillStyle = 'rgba(176,58,46,0.55)';
    g.fillRect(px - k, py - k, 2 * k, 2 * k);
    g.strokeRect(px - k, py - k, 2 * k, 2 * k);
    g.strokeRect(px - k * 1.5, py - k * 1.5, 3 * k, 3 * k);
    g.restore();
    g.save();
    g.font = `400 ${4.2 * s}px ${KAI}`; g.fillStyle = 'rgba(38,28,20,0.9)';
    g.textBaseline = 'middle'; g.textAlign = dx > 0 ? 'left' : 'right';
    g.fillText(name, px + dx * k * 2.4, py);
    g.restore();
  };
  if (world.id === 'yrd') {
    label(123.05, 30.75, '東海', 13, { vertical: true, bold: true, color: 'rgba(40,52,62,0.8)' });
    label(122.55, 33.15, '黄海', 11, { vertical: true, bold: true, color: 'rgba(40,52,62,0.75)' });
    label(117.55, 31.6, '巢湖', 4.5, { color: 'rgba(30,50,60,0.85)' });
    label(119.25, 32.82, '高邮湖', 4.2, { color: 'rgba(30,50,60,0.85)' });
    label(118.6, 33.32, '洪泽湖', 4.6, { color: 'rgba(30,50,60,0.85)' });
    label(118.95, 29.58, '千岛湖', 4.0, { color: 'rgba(30,50,60,0.85)' });
    label(117.82, 30.5, '九华山', 4.6, { spacing: 0.15 });
    label(120.62, 29.72, '会稽山', 4.6, { spacing: 0.15 });
    label(121.15, 29.62, '四明山', 4.6, { spacing: 0.15 });
    label(120.95, 29.05, '天台山', 4.6, { spacing: 0.15 });
    label(117.7, 31.15, '长 江', 5.2, { color: 'rgba(30,50,60,0.85)' });
    label(119.75, 29.62, '富春江', 4.0, { color: 'rgba(30,50,60,0.85)' });
    label(120.4, 33.0, '淮 扬', 6, { spacing: 0.3, color: 'rgba(38,28,20,0.6)' });
    city(119.42, 32.39, '扬州'); city(120.86, 32.01, '南通'); city(119.92, 32.46, '泰州');
    city(118.32, 32.30, '滁州', -1); city(118.38, 31.33, '芜湖', -1); city(118.76, 30.94, '宣城');
    city(117.27, 31.86, '合肥'); city(120.58, 30.00, '绍兴'); city(121.55, 29.87, '宁波');
    city(122.2, 30.0, '舟山'); city(118.33, 29.71, '屯溪', -1); city(120.16, 33.35, '盐城');
    city(119.65, 29.08, '金华'); city(117.06, 30.53, '安庆');

  } else {
    // other patches: every prefecture seat that has no community of its own
    for (const cc of CN_CITIES) {
      if (skip.includes(cc.s)) continue;
      const [x, z] = toWorld(cc.lon, cc.lat);
      if (world.contains(x, z, 15) && world.sdf(x, z) < 0) city(cc.lon, cc.lat, cc.s, x > XMAX - 60 ? -1 : 1);
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
