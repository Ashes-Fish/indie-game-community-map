// Ink-map drawing helpers shared by the national paper (natdraw.js, which
// also runs in a worker): plain 2D-canvas code, no three.js.
export const KAI = '"Kaiti SC","STKaiti","KaiTi","楷体","Songti SC","STSong",serif';

// pal: wash colours top → foot and ink (default = the 长三角 青绿 wash)
const PAL = { high: 'rgba(88,128,122,0.95)', low: 'rgba(112,142,110,0.92)', mid: 'rgba(176,182,140,0.85)', foot: 'rgba(226,212,176,0.9)', ink: '34,26,18' };
export function drawMountain(g, x, y, w, h, R, high, pal = PAL) {
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
    gr.addColorStop(0, high ? pal.high : pal.low);
    gr.addColorStop(0.65, pal.mid);
    gr.addColorStop(1, pal.foot);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = `rgba(${pal.ink},0.9)`; g.lineWidth = Math.max(0.9, pk.pw * 0.045); g.stroke();
    // texture strokes (皴法) on the shaded right flank
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const sx = pk.cx + pk.pw * (0.06 + k * 0.1), sy = top + pk.ph * (0.18 + k * 0.12);
      g.moveTo(sx, sy); g.quadraticCurveTo(sx + pk.pw * 0.08, sy + pk.ph * 0.25, sx + pk.pw * 0.03, sy + pk.ph * 0.5);
    }
    g.strokeStyle = `rgba(${pal.ink},0.5)`; g.lineWidth = Math.max(0.6, pk.pw * 0.025); g.stroke();
  }
}

export function compass(g, x, y, r) {
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

export function cloud(g, x, y, r) {
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
