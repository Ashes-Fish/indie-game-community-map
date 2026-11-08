// 全国古舆图: the national 2D map. Relief is baked into relief.webp (scripts/bake_china.py, Albers); borders, rivers,
// lakes and names are drawn from map.json each time the view changes. Cities that host communities carry a banner;
// clicking one zooms in and opens its 3D region (scene.js) — 远看是古舆图，近看是 3D.
// 边界数据来自 DataV.GeoAtlas，仅用于开发；正式公开前按《全国版规划方案》3.2 节换成标准地图数据。
import './style.css';
import raw from '../../site/data/communities.json';
import { albers, albersInv } from './albers.js';
import { REGIONS, regionOf } from './regions.js';
import { CN_CITIES, resolveCity, cityId } from './cn.js';
import { icon, FRAME, FRAME_S } from './icons.js';

const BASE = import.meta.env.BASE_URL;
const qs = new URLSearchParams(location.search);
const KAI = '"Kaiti SC","STKaiti","KaiTi","楷体","Songti SC","STSong",serif';
const TITLE = '"IGCM Serif","Source Han Serif SC","Songti SC",serif';
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// province name positions where the centroid lands on a neighbour or a capital
const LABEL_AT = { 河北: [115.4, 38.3], 内蒙古: [112.5, 42.6], 甘肃: [100.8, 38.6], 北京: null, 天津: null, 上海: null, 香港: null, 澳门: null };
const COLORS = ['#8e5ad6', '#e8862e', '#1fb39a', '#3a78c8', '#c2457a', '#2e9e5b', '#c9a227', '#d43f3a'];

// ---------- communities by city ----------
const byCity = new Map();
for (const r of raw) {
  const res = resolveCity(r);
  if (!res) continue;
  const id = cityId(res.city);
  if (!byCity.has(id)) byCity.set(id, { city: res.city, id, region: regionOf(res.city.lon, res.city.lat), list: [] });
  byCity.get(id).list.push({ ...r, others: res.others });
}
const hubs = [...byCity.values()].sort((a, b) => b.list.length - a.list.length || a.city.lon - b.city.lon);
hubs.forEach((hb, i) => { hb.color = COLORS[i % COLORS.length]; [hb.x, hb.y] = albers(hb.city.lon, hb.city.lat); });

// ---------- canvas + view ----------
const canvas = document.getElementById('gl');
const g = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const view = { cx: 0, cy: 0, k: 0.2 };          // centre in Albers km, scale in css px per km
let kMin = 0.05, kMax = 1.2;
const toS = (x, y) => [(x - view.cx) * view.k + W / 2, (view.cy - y) * view.k + H / 2];
const toW = (sx, sy) => [(sx - W / 2) / view.k + view.cx, view.cy - (sy - H / 2) / view.k];

let map, relief, reliefImg, dirty = true;
const proj = (ring) => ring.map(([lo, la]) => albers(lo, la));

async function load() {
  const tip = document.getElementById('loadtip');
  tip.textContent = '正在展开全国舆图…';
  document.querySelector('#loader .sub').textContent = '全国';
  document.title = '中国独立游戏社团地图 · 全国';
  const [m, rj, img] = await Promise.all([
    fetch(BASE + 'data/china/map.json').then((r) => r.json()),
    fetch(BASE + 'data/china/relief.json').then((r) => r.json()),
    new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = BASE + 'data/china/relief.webp'; }),
  ]);
  document.getElementById('loadbar').style.width = '80%';
  // pre-project everything once (Albers km)
  map = {
    provinces: m.provinces.map((p) => ({ n: p.n, c: p.c, r: p.r.map(proj) })),
    country: m.country.map(proj),
    jd: m.jd.map(proj),
    rivers: m.rivers.map((r) => ({ n: r.n, rank: r.r, p: proj(r.p) })),
    lakes: m.lakes.map((l) => ({ n: l.n, r: l.r.map(proj) })),
  };
  relief = rj; reliefImg = img;
  buildUI();
  resize();
  fit(qs.get('focus'));
  const ld = document.getElementById('loader');
  ld.classList.add('done'); ld.style.pointerEvents = 'none';
  setTimeout(() => { ld.style.display = 'none'; }, 1000);
  requestAnimationFrame(frame);
}

function resize() {
  DPR = Math.min(devicePixelRatio, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  // the whole country (mainland + Hainan) fits with room for the panels
  const fw = relief.xmax - relief.xmin, fh = relief.ymax - relief.ymin;
  kMin = Math.min(W / fw, H / fh) * 0.9;
  kMax = Math.max(kMin * 14, 0.9);
  // a page opened while the window had no size (background tab) gets its first real fit here
  if (W && H && !(view.k >= kMin * 0.8)) fit(qs.get('focus'));
  dirty = true;
}

// initial view: the whole country, or one region when coming back from 3D (?focus=yrd)
function fit(focus) {
  const r = REGIONS[focus];
  if (r) {
    [view.cx, view.cy] = albers(r.lon0, r.lat0);
    view.k = Math.min(kMax, Math.min(W, H) / 1100);
  } else {
    const [x0, y0] = albers(73.5, 18), [x1, y1] = albers(135, 53.5);
    view.cx = (relief.xmin + relief.xmax) / 2 + (W < H ? 0 : (relief.xmax - relief.xmin) * 0.02);
    view.cy = (Math.min(y0, y1) + Math.max(relief.ymax, y1)) / 2;
    view.k = Math.min(W / (x1 - x0 + 600), H / (relief.ymax - relief.ymin + 120)) * (W < H ? 1.25 : 1);
    view.k = Math.max(view.k, kMin);
  }
  dirty = true;
}

// ---------- drawing ----------
function path(pts, close) {
  pts.forEach(([x, y], i) => { const [sx, sy] = toS(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); });
  if (close) g.closePath();
}

function draw() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#e8dab4';
  g.fillRect(0, 0, W, H);
  const [rx, ry] = toS(relief.xmin, relief.ymax);
  g.drawImage(reliefImg, rx, ry, (relief.xmax - relief.xmin) * view.k, (relief.ymax - relief.ymin) * view.k);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const z = view.k / kMin; // 1 = whole country

  // lakes
  g.fillStyle = 'rgba(150,178,176,0.85)'; g.strokeStyle = 'rgba(46,70,80,0.7)'; g.lineWidth = 0.8;
  for (const l of map.lakes) { g.beginPath(); for (const r of l.r) path(r, true); g.fill('evenodd'); g.stroke(); }
  // rivers: the big ones always, smaller ones as you zoom in
  for (const r of map.rivers) {
    if (r.rank > (z < 1.8 ? 3 : z < 4 ? 5 : 6)) continue;
    g.beginPath(); path(r.p);
    g.strokeStyle = 'rgba(52,84,98,0.8)';
    g.lineWidth = (r.rank <= 2 ? 1.9 : r.rank <= 4 ? 1.2 : 0.8) * Math.min(1.8, 0.8 + z * 0.12);
    g.stroke();
  }
  // province borders: dashed ink
  g.setLineDash([4, 3]); g.strokeStyle = 'rgba(92,60,34,0.5)'; g.lineWidth = 0.9;
  for (const p of map.provinces) { g.beginPath(); for (const r of p.r) path(r, true); g.stroke(); }
  g.setLineDash([]);
  // national border: dark outer line with a red-brown inner line
  g.beginPath(); for (const r of map.country) path(r, true);
  g.strokeStyle = 'rgba(40,26,16,0.85)'; g.lineWidth = 2.4; g.stroke();
  g.strokeStyle = 'rgba(176,58,46,0.55)'; g.lineWidth = 1; g.stroke();

  // province names
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `400 ${Math.round(13 + Math.min(6, z * 1.2))}px ${KAI}`;
  for (const p of map.provinces) {
    const at = p.n in LABEL_AT ? LABEL_AT[p.n] : p.c;
    if (!at) continue;
    const [sx, sy] = toS(...albers(at[0], at[1]));
    g.fillStyle = 'rgba(66,44,26,0.62)';
    const t = [...p.n].join(z < 1.6 ? '' : ' ');
    g.fillText(t, sx, sy);
  }
  // prefecture seats without communities, once zoomed in: small ink squares like the 3D parchment
  if (z > 2.2) {
    g.font = `400 12px ${KAI}`; g.textAlign = 'left';
    for (const c of CN_CITIES) {
      if (byCity.has(cityId(c)) || (!c.cap && z < 4)) continue;
      const [sx, sy] = toS(...albers(c.lon, c.lat));
      if (sx < -40 || sy < -20 || sx > W + 40 || sy > H + 20) continue;
      g.fillStyle = 'rgba(176,58,46,0.5)'; g.strokeStyle = 'rgba(45,30,20,0.8)'; g.lineWidth = 0.7;
      g.fillRect(sx - 2.5, sy - 2.5, 5, 5); g.strokeRect(sx - 2.5, sy - 2.5, 5, 5);
      g.fillStyle = 'rgba(38,28,20,0.82)'; g.fillText(c.s, sx + 6, sy);
    }
  }
  drawCompass();
  drawInset();
}

function drawCompass() {
  const r = 30, x = W < H ? W - 52 : W - 88, y = W < H ? 120 : H - 290; // above the 南海诸岛 inset
  g.save(); g.translate(x, y);
  g.strokeStyle = 'rgba(45,30,20,0.75)'; g.fillStyle = 'rgba(45,30,20,0.75)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, r * 0.62, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.16, 0); g.lineTo(-r * 0.16, 0); g.closePath();
    i === 3 ? g.fill() : g.stroke();
  }
  g.font = `700 13px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('北', 0, -r - 10);
  g.restore();
}

// 南海诸岛 inset (standard-map convention): nine-dash line and the islands drawn at their own scale, bottom right
function drawInset() {
  const iw = W < H ? 104 : 132, ih = iw * 1.45, x = W - iw - (W < H ? 10 : 22), y = H - ih - (W < H ? 64 : 26);
  const [bx0, by0] = albers(105.5, 2.5), [bx1, by1] = albers(123.5, 24.5);
  const k = Math.min(iw / (bx1 - bx0), ih / (by1 - by0));
  const T = ([px, py]) => [x + (px - bx0) * k, y + ih - (py - by0) * k];
  g.save();
  g.fillStyle = 'rgba(205,210,190,0.96)'; g.fillRect(x, y, iw, ih);
  g.beginPath(); g.rect(x, y, iw, ih); g.clip();
  g.fillStyle = '#e4d0a4'; g.strokeStyle = 'rgba(40,26,16,0.7)'; g.lineWidth = 0.7;
  for (const p of map.provinces) {
    if (!['海南', '广东', '广西', '台湾', '福建', '云南'].includes(p.n)) continue;
    g.beginPath();
    for (const r of p.r) r.forEach((pt, i) => { const [sx, sy] = T(pt); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); });
    g.fill('evenodd'); g.stroke();
  }
  g.strokeStyle = 'rgba(40,26,16,0.9)'; g.lineWidth = 1.4;
  for (const d of map.jd) { g.beginPath(); d.forEach((pt, i) => { const [sx, sy] = T(pt); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke(); }
  g.restore();
  g.strokeStyle = 'rgba(40,26,16,0.85)'; g.lineWidth = 1.2; g.strokeRect(x, y, iw, ih);
  g.font = `400 11px ${KAI}`; g.fillStyle = 'rgba(38,28,20,0.9)'; g.textAlign = 'right'; g.textBaseline = 'bottom';
  g.fillText('南海诸岛', x + iw - 4, y + ih - 3);
}

// ---------- UI: title, list, city banners, tooltip ----------
let ui, banners = [], tipEl, listEl;
function buildUI() {
  ui = document.getElementById('ui');
  ui.style.setProperty('--frame', FRAME); ui.style.setProperty('--frame-s', FRAME_S);
  document.body.appendChild(h('div', 'vignette'));
  const n = raw.length;
  ui.appendChild(h('div', 'title civ-panel', `<div class="seal">游</div><div><h1>中国独立游戏社团地图</h1><div class="sub">全国 · ${n} 个社团 · ${hubs.length} 座城市</div></div>`));
  const lb = h('div', 'listbtn civ-panel', `${icon('list')}<span>社团列表</span><span class="n">${n}</span>`);
  listEl = h('div', 'list civ-panel');
  for (const hb of hubs) {
    listEl.appendChild(h('h3', null, `<i style="--c:${hb.color}"></i><span>${hb.city.s}</span>`));
    for (const c of hb.list) {
      const it = h('div', 'item', `<span class="ph">${esc([...(c.name || '社')][0])}</span><div><b>${esc(c.name)}</b><small>${esc(hb.city.s)}${c.others.length ? ' · ' + esc(c.others.join(' ')) : ''}${c.sizeRaw ? ` · ${icon('pop')}${esc(c.sizeRaw)}` : ''}</small></div>`);
      it.onclick = () => { listEl.classList.remove('open'); enter(hb); };
      listEl.appendChild(it);
    }
  }
  lb.onclick = () => listEl.classList.toggle('open');
  ui.append(lb, listEl);
  for (const hb of hubs) {
    const el = h('div', 'banner', `<div class="bar"><div class="pop">${hb.list.length}</div><div class="nm">${hb.city.s}</div></div>`);
    el.style.setProperty('--c', hb.color);
    const b = { el, hb, merged: [] };
    el.onclick = (e) => { e.stopPropagation(); enter(hb, b.merged.length > 0); };
    el.onpointerenter = () => showTip(hb, b.merged);
    el.onpointerleave = () => showTip(null);
    ui.appendChild(el);
    banners.push(b);
  }
  tipEl = h('div', 'tip'); tipEl.style.display = 'none';
  ui.appendChild(tipEl);
  ui.appendChild(h('div', 'credit', '边界：DataV.GeoAtlas · 高程：AWS Terrain Tiles · 水系：Natural Earth · 社团数据：社团自填'));
  const help = h('div', 'help civ-panel', (matchMedia('(pointer: coarse)').matches ? [['drag', '单指拖动'], ['zoom', '双指缩放'], ['tap', '点城市进入']] : [['drag', '拖拽平移'], ['zoom', '滚轮缩放'], ['tap', '点击城市进入 3D']])
    .map(([k, t]) => `<span>${icon(k)}${t}</span>`).join(''));
  ui.appendChild(help);
  setTimeout(() => { help.style.opacity = '0'; }, 9000);
}

function showTip(hb, merged = []) {
  if (!hb) { tipEl.style.display = 'none'; return; }
  const [sx, sy] = toS(hb.x, hb.y);
  const reg = REGIONS[hb.region];
  const rows = [hb, ...merged].map((x) => `<b>${esc(x.city.s)}</b> · ${x.list.map((c) => esc(c.name)).join('、')}`).join('<br>');
  tipEl.innerHTML = `${rows}<br><small>${reg ? `点击进入「${reg.name}」3D 地图` : '这一带的 3D 地图还在绘制中'}</small>`;
  tipEl.style.display = 'block';
  tipEl.style.transform = `translate(${Math.min(sx + 16, W - 280)}px,${sy + 10}px)`;
}

function placeBanners() {
  const sc = Math.max(0.72, Math.min(1, 0.7 + view.k / kMin * 0.08));
  // cities closer than a banner's width fold into the bigger one (长三角 · 7) until you zoom in
  const shown = [];
  for (const b of banners) {
    const [sx, sy] = toS(b.hb.x, b.hb.y);
    const host = shown.find((o) => Math.abs(o.sx - sx) < 78 && Math.abs(o.sy - sy) < 36);
    if (host) { host.b.merged.push(b.hb); b.el.style.display = 'none'; continue; }
    b.merged = [];
    shown.push({ sx, sy, b });
    const vis = sx > -60 && sx < W + 60 && sy > -20 && sy < H + 60;
    b.el.style.display = vis ? '' : 'none';
    if (vis) b.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-100%) scale(${sc})`;
  }
  for (const { b } of shown) {
    const all = [b.hb, ...b.merged];
    const same = all.every((x) => x.region && x.region === b.hb.region);
    const name = !b.merged.length ? b.hb.city.s : same ? REGIONS[b.hb.region].name : `${b.hb.city.s}等`;
    const n = all.reduce((s, x) => s + x.list.length, 0);
    if (b.shownAs !== name + n) {
      b.shownAs = name + n;
      b.el.querySelector('.nm').textContent = name;
      b.el.querySelector('.pop').textContent = n;
    }
  }
}

// ---------- entering a region: zoom toward the city, fade, then load its 3D page ----------
let leaving = null;
// wide: a folded banner (several cities) opens the region's overview with its 建城 tour instead of one city
function enter(hb, wide = false) {
  if (!hb.region || leaving) { showTip(hb); return; }
  leaving = { t: 0, from: { ...view }, to: { cx: hb.x, cy: hb.y, k: Math.min(kMax * 1.6, view.k * 6, Math.max(view.k * 2.5, 1.4)) } };
  const fade = h('div', 'fade-out');
  document.body.appendChild(fade);
  requestAnimationFrame(() => fade.classList.add('on'));
  setTimeout(() => { location.href = `${BASE}?region=${hb.region}${wide ? '' : `&fly=${hb.id}`}`; }, 900);
}

// ---------- input: drag, wheel, pinch, double click ----------
const ptrs = new Map();
let drag = null, pinch = null, moved = false;
function zoomAt(sx, sy, f) {
  const [wx, wy] = toW(sx, sy);
  view.k = Math.max(kMin * 0.8, Math.min(kMax, view.k * f));
  const [nx, ny] = toW(sx, sy);
  view.cx += wx - nx; view.cy += wy - ny;
  dirty = true;
}
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
canvas.addEventListener('dblclick', (e) => zoomAt(e.clientX, e.clientY, 2));
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = false;
  if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; drag = null; }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const f = (pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d) / view.k;
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, f);
  } else if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) moved = true;
    view.cx = drag.cx - dx / view.k; view.cy = drag.cy + dy / view.k;
    dirty = true;
  }
});
const up = (e) => {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (!ptrs.size) {
    if (!moved && drag) { listEl?.classList.remove('open'); hitCity(e.clientX, e.clientY); }
    drag = null;
  }
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
// a tap near a city (not just on its banner) enters it
function hitCity(sx, sy) {
  let best = null, bd = 28;
  for (const b of banners) {
    if (b.el.style.display === 'none') continue;
    const [x, y] = toS(b.hb.x, b.hb.y);
    const d = Math.hypot(x - sx, y - sy);
    if (d < bd) { bd = d; best = b; }
  }
  if (best) enter(best.hb, best.merged.length > 0);
}
addEventListener('resize', () => { resize(); dirty = true; });

function frame() {
  if (leaving) {
    leaving.t = Math.min(1, leaving.t + 1 / 50);
    const u = 1 - (1 - leaving.t) ** 3, f = leaving.from, t = leaving.to;
    view.cx = f.cx + (t.cx - f.cx) * u; view.cy = f.cy + (t.cy - f.cy) * u;
    view.k = f.k * Math.pow(t.k / f.k, u);
    dirty = true;
  }
  if (dirty) { dirty = false; draw(); placeBanners(); }
  requestAnimationFrame(frame);
}

window.__china = { view, hubs, toS, albersInv };
load();
