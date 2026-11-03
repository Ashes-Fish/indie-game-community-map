// Ink drawing for the fog-of-war "old Chinese map" (古舆图) layer, drawn once into a canvas texture.
import * as THREE from 'three';
import { XMIN, ZMIN, XMAX, ZMAX, toWorld, rng } from './config.js';

const KAI = '"Kaiti SC","STKaiti","KaiTi","楷体","Songti SC","STSong",serif';

export function buildInkTexture(world, rivers, maxSize) {
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
      const e = world.elevM(jx, jz);
      if (e < 140 + R() * 80) continue;
      glyphs.push({ x: jx, z: jz, e });
    }
  }
  glyphs.sort((a, b) => a.z - b.z);
  for (const m of glyphs) {
    const [px, py] = P(m.x, m.z);
    const w = (4.2 + Math.min(m.e, 1500) / 260) * s * (0.85 + R() * 0.3);
    const h = w * (0.48 + Math.min(m.e, 1500) / 3200 + R() * 0.1);
    drawMountain(g, px, py, w, h, R, m.e > 700);
  }

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

  // compass rose
  compass(g, ...LL(123.0, 29.55), 14 * s);
  // decorative clouds
  for (const [lo, la, k] of [[122.9, 32.2, 1], [117.4, 29.3, 0.9], [121.9, 28.85, 1.1], [117.3, 33.2, 0.8]]) cloud(g, ...LL(lo, la), 9 * s * k);

  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function drawMountain(g, x, y, w, h, R, high) {
  const n = high ? 3 : 2 + (R() < 0.5 ? 1 : 0);
  const peaks = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const ph = h * (i === Math.floor(n / 2) ? 1 : 0.62 + R() * 0.2);
    const pw = w * (n === 3 ? 0.46 : 0.6);
    peaks.push({ cx: x + t * w * 0.55, ph, pw });
  }
  // draw side peaks first, centre last
  peaks.sort((a, b) => a.ph - b.ph);
  for (const pk of peaks) {
    const l = pk.cx - pk.pw / 2, r = pk.cx + pk.pw / 2, top = y - pk.ph;
    g.beginPath();
    g.moveTo(l, y);
    g.bezierCurveTo(l + pk.pw * 0.12, y - pk.ph * 0.55, pk.cx - pk.pw * 0.28, top, pk.cx, top);
    g.bezierCurveTo(pk.cx + pk.pw * 0.28, top, r - pk.pw * 0.12, y - pk.ph * 0.55, r, y);
    g.closePath();
    const gr = g.createLinearGradient(0, top, 0, y);
    gr.addColorStop(0, high ? 'rgba(88,128,122,0.95)' : 'rgba(112,142,110,0.92)');
    gr.addColorStop(0.65, 'rgba(176,182,140,0.85)');
    gr.addColorStop(1, 'rgba(226,212,176,0.9)');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(34,26,18,0.9)'; g.lineWidth = Math.max(0.9, pk.pw * 0.045); g.stroke();
    // texture strokes (皴法) on the shaded right flank
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const sx = pk.cx + pk.pw * (0.06 + k * 0.1), sy = top + pk.ph * (0.18 + k * 0.12);
      g.moveTo(sx, sy); g.quadraticCurveTo(sx + pk.pw * 0.08, sy + pk.ph * 0.25, sx + pk.pw * 0.03, sy + pk.ph * 0.5);
    }
    g.strokeStyle = 'rgba(34,26,18,0.5)'; g.lineWidth = Math.max(0.6, pk.pw * 0.025); g.stroke();
  }
}

function compass(g, x, y, r) {
  g.save();
  g.strokeStyle = 'rgba(40,30,22,0.85)'; g.fillStyle = 'rgba(40,30,22,0.85)';
  g.lineWidth = r * 0.03;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.86, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, L = i % 2 ? r * 0.55 : r * 0.82;
    const a1 = a + Math.PI / 2, w = r * (i % 2 ? 0.07 : 0.11);
    g.beginPath();
    g.moveTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.lineTo(x + Math.cos(a1) * w, y + Math.sin(a1) * w);
    g.lineTo(x - Math.cos(a1) * w, y - Math.sin(a1) * w);
    g.closePath();
    g.fillStyle = i === 0 ? 'rgba(170,48,38,0.9)' : 'rgba(40,30,22,0.8)';
    g.fill();
  }
  g.font = `700 ${r * 0.34}px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(40,30,22,0.9)';
  g.fillText('北', x, y - r * 1.2);
  g.restore();
}

function cloud(g, x, y, r) {
  g.save();
  g.strokeStyle = 'rgba(60,48,36,0.7)'; g.lineWidth = r * 0.05; g.fillStyle = 'rgba(246,238,215,0.75)';
  const lobes = [[-0.6, 0.1, 0.35], [-0.2, -0.15, 0.45], [0.3, -0.05, 0.4], [0.7, 0.12, 0.28]];
  g.beginPath();
  for (const [dx, dy, rr] of lobes) { g.moveTo(x + dx * r + rr * r, y + dy * r); g.arc(x + dx * r, y + dy * r, rr * r, 0, Math.PI * 2); }
  g.fill();
  for (const [dx, dy, rr] of lobes) {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, rr * r, Math.PI * 0.95, Math.PI * 2.05);
    g.stroke();
    g.beginPath();
    g.arc(x + dx * r + rr * r * 0.2, y + dy * r, rr * r * 0.45, Math.PI * 1.0, Math.PI * 2.4);
    g.stroke();
  }
  g.beginPath(); g.moveTo(x - r * 1.0, y + r * 0.42); g.quadraticCurveTo(x, y + r * 0.62, x + r * 1.0, y + r * 0.4); g.stroke();
  g.restore();
}
