// 兜底模式（全国版优化方案 O3）: no WebGL2, or ?lite=1. The national paper map is painted once onto a 2D canvas by the same
// painter as the 3D version's paper tiles (natdraw.js), with a seal per community city; the 社群列表 and the community
// panel are the regular UI. Pan by dragging, zoom with the wheel or a pinch: the map is redrawn at the new scale.
import { CITIES, COMMUNITIES, HUB_CITIES } from './data.js';
import { PATCHES } from './patches.js';
import { toWorld } from './config.js';
import { fetchNationalData, loadNational } from './natdraw.js';
import { UI } from './ui.js';

const BASE = import.meta.env.BASE_URL;

export async function startLite(reason) {
  const loadtip = document.getElementById('loadtip');
  const loadbar = document.getElementById('loadbar');
  loadtip.textContent = '正在展开舆图…'; loadbar.style.width = '30%';
  document.documentElement.dataset.tier = 'lite';
  const gl = document.getElementById('gl');
  const canvas = document.createElement('canvas');
  canvas.id = 'lite'; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none;cursor:grab';
  gl.replaceWith(canvas);
  const data = await fetchNationalData(BASE, PATCHES);
  loadbar.style.width = '70%';
  const nat = await loadNational(data, 'qinglv', HUB_CITIES, PATCHES);
  for (const c of CITIES) [c.x, c.z] = toWorld(c.lon, c.lat);

  // view: centre (km) and km per CSS pixel
  // the mainland, roughly 73–135°E, 18–53.5°N: fitted into the screen below the title bar
  const corners = [[73, 40], [135, 48], [110, 18], [123, 53.5], [80, 30], [125, 25]].map(([lo, la]) => toWorld(lo, la));
  const mx0 = Math.min(...corners.map((c) => c[0])), mx1 = Math.max(...corners.map((c) => c[0]));
  const mz0 = Math.min(...corners.map((c) => c[1])), mz1 = Math.max(...corners.map((c) => c[1]));
  const TOP = 110;   // px taken by the title / list button
  const view = { x: 0, z: 0, k: 1 };
  const fit = () => {
    const H = innerHeight - TOP;
    view.k = Math.max((mx1 - mx0) / innerWidth, (mz1 - mz0) / H) * 1.06;
    view.x = (mx0 + mx1) / 2; view.z = (mz0 + mz1) / 2 - (TOP / 2) * view.k;
  };
  fit();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const g = canvas.getContext('2d');
  const seals = CITIES.filter((c) => COMMUNITIES.some((m) => m.cityId === c.id));
  let pending = false;
  function draw() {
    pending = false;
    const W = innerWidth, H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const r = [view.x - (W / 2) * view.k, view.z - (H / 2) * view.k, view.x + (W / 2) * view.k, view.z + (H / 2) * view.k];
    nat.draw(g, r, canvas.width, canvas.height);
    // community city seals with their count
    const s = canvas.width / (r[2] - r[0]);
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const R = 10 * dpr, labelled = [];
    const ranked = seals.map((c) => ({ c, n: COMMUNITIES.filter((m) => m.cityId === c.id).length })).sort((a, b) => b.n - a.n);
    for (const { c, n } of ranked) {
      const px = (c.x - r[0]) * s, py = (c.z - r[1]) * s;
      if (px < -40 || py < -40 || px > canvas.width + 40 || py > canvas.height + 40) continue;
      g.fillStyle = c.color; g.strokeStyle = '#f3d58a'; g.lineWidth = 1.5 * dpr;
      g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.font = `700 ${11 * dpr}px Georgia,serif`; g.fillText(String(n), px, py + 0.5 * dpr);
      // the name to the right of the seal, unless it would overlap a name already drawn
      g.font = `700 ${13 * dpr}px "Songti SC","STSong","Noto Serif SC",serif`;
      const w = g.measureText(c.name).width, box = [px + R + 3 * dpr, py - 8 * dpr, px + R + 3 * dpr + w, py + 8 * dpr];
      if (labelled.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      labelled.push(box);
      g.textAlign = 'left'; g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(240,226,190,0.85)'; g.strokeText(c.name, box[0], py);
      g.fillStyle = 'rgba(40,26,14,0.92)'; g.fillText(c.name, box[0], py); g.textAlign = 'center';
    }
    g.restore();
  }
  const redraw = () => { if (!pending) { pending = true; requestAnimationFrame(draw); } };
  // a city above the panel (bottom sheet on a portrait phone, side panel on a wide screen), about 900 km across
  function focus(city) {
    if (!city) return;
    const portrait = innerHeight > innerWidth;
    view.k = Math.min(view.k, 900 / Math.min(innerWidth, innerHeight));
    view.x = city.x + (portrait ? 0 : 190 * view.k);
    view.z = city.z + (portrait ? innerHeight * 0.22 * view.k : 0);
    redraw();
  }

  // the regular UI, without the 3D-only parts
  const sites = COMMUNITIES.map((c) => ({ cityId: c.cityId, members: [c], x: 0, y: 0, z: 0, hex: [0, 0] }));
  const ui = new UI({
    cities: CITIES, communities: COMMUNITIES, sites, base: BASE, mobile: matchMedia('(pointer: coarse)').matches, regionName: '全国', regions: [],
    onPick: (c) => { ui.openPanel(c); focus(CITIES.find((k) => k.id === c.cityId)); },
    onSite: (s) => ui.openPanel(s.members[0]), onCity: () => {}, onReplay: () => {}, onChina: () => { ui.closePanel(); fit(); redraw(); },
    onHub: () => {}, onRegion: () => {},
  });
  for (const el of [...ui.root.querySelectorAll('.banner,.dtag,.rseal,.replay,.pname,.cname,.help')]) el.style.display = 'none';
  const note = document.createElement('div');
  note.className = 'credit lite-note';
  note.textContent = reason === 'webgl' ? '当前浏览器不支持 3D，已切换到平面古舆图' : '平面古舆图模式';
  ui.root.appendChild(note);

  // tap a seal → that city's first community (the list has all of them)
  const at = (cx, cy) => [view.x + (cx - innerWidth / 2) * view.k, view.z + (cy - innerHeight / 2) * view.k];
  const ptrs = new Map(); let pinch = null, moved = 0;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k }; } });
  canvas.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 2 && pinch) { ptrs.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...ptrs.values()]; view.k = Math.min(8, Math.max(0.15, pinch.k * pinch.d / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])))); redraw(); return; }
    view.x -= (e.clientX - p[0]) * view.k; view.z -= (e.clientY - p[1]) * view.k; moved += Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]); redraw();
  });
  const up = (e) => {
    if (ptrs.size === 1 && moved < 6) {
      const [wx, wz] = at(e.clientX, e.clientY);
      const hit = seals.find((c) => Math.hypot(c.x - wx, c.z - wz) < 18 * view.k);
      if (hit) ui.openPanel(COMMUNITIES.find((m) => m.cityId === hit.id));
    }
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [wx, wz] = at(e.clientX, e.clientY), f = Math.exp(e.deltaY * 0.0015);
    view.k = Math.min(8, Math.max(0.15, view.k * f));
    view.x = wx - (e.clientX - innerWidth / 2) * view.k; view.z = wz - (e.clientY - innerHeight / 2) * view.k; redraw();
  }, { passive: false });
  addEventListener('resize', redraw);

  draw();
  loadbar.style.width = '100%';
  window.__readyAt = performance.now();
  const ld = document.getElementById('loader'); ld.classList.add('done'); ld.style.pointerEvents = 'none'; setTimeout(() => { ld.style.display = 'none'; }, 1000);
  window.__dbg = { lite: true, view, ui, CITIES, COMMUNITIES };
}
