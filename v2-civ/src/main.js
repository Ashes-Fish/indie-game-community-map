import * as THREE from 'three';
import './style.css';
import { World, loadImage } from './world.js';
import { CITIES, COMMUNITIES } from './data.js';
import { buildTerrainMesh } from './terrain.js';
import { buildInkTexture } from './parchment.js';
import { CivCamera } from './camera.js';
import { buildProps } from './props.js';
import { buildCities, buildDistricts, buildWestLake } from './places.js';
import { buildRivers, buildRoads, buildTrade, buildBoats } from './routes.js';
import { buildHuangshan } from './wonder.js';
import { Dust, Beams, easeOutBack } from './fx.js';
import { UI } from './ui.js';
import { HEX_R, toWorld } from './config.js';

const BASE = import.meta.env.BASE_URL;
const qs = new URLSearchParams(location.search);
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = qs.get('q') === 'low' || (qs.get('q') !== 'high' && (coarse || innerWidth < 720) && Math.min(innerWidth, innerHeight) < 900);
const Q = mobile
  ? { mobile: true, dpr: Math.min(devicePixelRatio, 2), post: false, shadow: 1024, step: 1.5, ink: 2048, trees: 0.5 }
  : { mobile: false, dpr: Math.min(devicePixelRatio, 1.5), post: true, shadow: 2048, step: 1.0, ink: 2048, trees: 1 };

const loadbar = document.getElementById('loadbar');
const loadtip = document.getElementById('loadtip');
const progress = (p, t) => { loadbar.style.width = `${Math.round(p * 100)}%`; if (t) loadtip.textContent = t; };
const tick = () => new Promise((r) => setTimeout(r, 0));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !Q.post, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('shot') });
renderer.setPixelRatio(Q.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const HAZE = new THREE.Color('#d9ccaa');
scene.background = HAZE.clone();
scene.fog = new THREE.Fog(HAZE, 300, 900);
const camera = new THREE.PerspectiveCamera(innerHeight > innerWidth * 1.15 ? 40 : 30, innerWidth / innerHeight, 1, 4000);

function makeEnv() {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 top = vec3(0.32,0.52,0.85), hor = vec3(1.0,0.93,0.82), bot = vec3(0.35,0.3,0.22);
      vec3 c = h > 0.0 ? mix(hor, top, pow(h, 0.6)) : mix(hor, bot, pow(-h, 0.4));
      vec3 sd = normalize(vec3(-0.55, 0.7, 0.45)); c += vec3(6.0,5.2,4.0) * pow(max(dot(normalize(vP), sd), 0.0), 220.0);
      gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
}
scene.environment = makeEnv();
scene.environmentIntensity = 0.4;

const SUN_DIR = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();
const sun = new THREE.DirectionalLight(0xffeccc, 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x7d6c48, 0.85));

const shared = {
  uniforms: {
    uHex: { value: null }, uRevealB: { value: 0 }, uTime: { value: 0 },
    uWater: { value: null }, uNormalTex: { value: null }, uInk: { value: null },
    uCamDist: { value: 300 }, uGrid: { value: 0.34 },
    uOwnCol: { value: Array.from({ length: 8 }, () => new THREE.Color(0, 0, 0)) },
    uOwnCol2: { value: Array.from({ length: 8 }, () => new THREE.Color(1, 1, 1)) },
    uHiHex: { value: new THREE.Vector2(999, 999) }, uHi: { value: 0 },
  },
};
const REVEAL_FINAL = 80 * 1.5;
const portrait = innerHeight > innerWidth * 1.15;
const OVERVIEW = mobile ? (portrait ? { x: 3, z: -2, d: 950 } : { x: -10, z: 5, d: 470 }) : { x: -24, z: -3, d: 462 };

const cam = new CivCamera(camera, canvas, { maxD: OVERVIEW.d + 40, minD: mobile ? 26 : 30 });
let world, ui, post, trade, hs, dust, beams, props, boats, proxies = [], hovered = null;

async function loadLogos() {
  const out = {};
  await Promise.all(COMMUNITIES.filter((c) => c.logo).map(async (c) => {
    try { out[c.logo] = await loadImage(BASE + 'logos/' + c.logo + '.webp'); } catch (e) { /* ignore */ }
  }));
  return out;
}

async function init() {
  const postP = Q.post ? import('./post.js') : null;
  progress(0.15, '正在测绘山川…');
  world = new World();
  const [rivers, logos] = await Promise.all([fetch(BASE + 'data/rivers.json').then((r) => r.json()), loadLogos(), world.load(BASE)]);
  progress(0.4, '正在勘定疆界…');
  world.buildHexes(CITIES, COMMUNITIES);
  CITIES.forEach((c, i) => { shared.uniforms.uOwnCol.value[i + 1].set(c.color).convertSRGBToLinear(); shared.uniforms.uOwnCol2.value[i + 1].set(c.color2).convertSRGBToLinear(); });
  for (const c of CITIES) world.flatten(c.x, c.z, 4.6);
  for (const c of COMMUNITIES) world.flatten(c.x, c.z, 3.8);
  world.buildNormalTex();
  for (const c of CITIES) c.y = world.heightY(c.x, c.z);
  for (const c of COMMUNITIES) c.y = world.heightY(c.x, c.z);
  shared.uniforms.uHex.value = world.hexTex;
  shared.uniforms.uWater.value = world.waterTex;
  shared.uniforms.uNormalTex.value = world.normalTex;
  await tick();
  progress(0.55, '正在研墨绘图…');
  shared.uniforms.uInk.value = buildInkTexture(world, rivers.rivers, Q.ink);
  scene.add(buildTerrainMesh(world, shared, Q.step).group);
  await tick();
  progress(0.72, '正在营建城郭…');
  const [hx, hz] = toWorld(118.17, 30.13);
  const keepOut = [...CITIES.map((c) => ({ x: c.x, z: c.z, r: 5.4 })), ...COMMUNITIES.map((c) => ({ x: c.x, z: c.z, r: 4.3 })), { x: hx, z: hz, r: 7 }];
  props = buildProps(world, shared, Q, keepOut);
  scene.add(props.group);
  scene.add(buildCities(world, CITIES, shared).group);
  scene.add(buildDistricts(world, COMMUNITIES, CITIES, shared, logos));
  scene.add(buildWestLake(world, rivers));
  scene.add(buildRivers(world, rivers.rivers, shared));
  scene.add(buildRoads(world, CITIES, shared));
  const lud = COMMUNITIES.find((c) => c.key === 'ludere');
  trade = buildTrade(world, lud, CITIES.find((c) => c.id === 'changshu'), shared);
  scene.add(trade.group);
  boats = buildBoats(world, rivers.rivers.find((r) => r.name === 'canal'));
  scene.add(boats.group);
  hs = buildHuangshan(world, hx, hz, shared);
  scene.add(hs.group);
  dust = new Dust(); beams = new Beams();
  scene.add(dust.points, beams.group);
  // pick proxies
  const pmat = new THREE.MeshBasicMaterial({ visible: false });
  const pgeo = new THREE.CylinderGeometry(HEX_R * 0.92, HEX_R * 0.92, 9, 6).rotateY(Math.PI / 6);
  for (const c of COMMUNITIES) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(c.x, c.y + 2, c.z); m.userData.c = c; proxies.push(m); scene.add(m); }
  for (const c of CITIES) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(c.x, c.y + 2, c.z); m.userData.city = c; proxies.push(m); scene.add(m); }

  ui = new UI({
    cities: CITIES, communities: COMMUNITIES, base: BASE, mobile,
    onPick: (c, fly) => select(c, fly), onCity: (city) => focusCity(city), onReplay: () => startIntro(true),
  });
  ui.onClose = () => { selected = null; };
  ui.addLabel('太 湖', 9, 0.6, -12, 'water');
  ui.addLabel('长 江', -40, 0.6, -101, 'water');
  ui.addLabel('钱塘江', 26, 0.6, 104, 'water');
  ui.addLabel('杭 州 湾', 98, 0.6, 78, 'water');
  ui.addLabel('天 目 山', -62, 5, 84);
  ui.addLabel('京杭大运河', 46, 0.6, 30, 'water');
  ui.addLabel('⛰ 黄山 · 自然奇观', hx + 4, 12, hz - 9, 'wonder');

  if (Q.post) {
    progress(0.86, '正在调和光影…');
    await tick();
    const { makePost } = await postP;
    post = makePost(renderer, scene, camera);
  }
  progress(0.95, '即将完成…');
  renderer.compile(scene, camera);
  window.__dbg = { world, scene, cam, shared, renderer, camera, COMMUNITIES, CITIES, select, focusCity, intro, get post() { return post; } };
  start();
}

// ---------- interaction ----------
let selected = null;
const ray = new THREE.Raycaster();
function pick(x, y) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(proxies, false)[0];
  return hit ? hit.object.userData : null;
}
function panelOffset() {
  if (mobile) return { dx: 0, dz: portrait ? 13 : 6, d: portrait ? 40 : 42 };
  return { dx: 380 / innerWidth * 22, dz: 0, d: 46 };
}
function select(c, fly) {
  selected = c;
  if (fly) { const o = panelOffset(); cam.flyTo(c.x + o.dx, c.z + o.dz, o.d, 1.5, 0); }
  ui.openPanel(c);
}
function focusCity(city) {
  cam.flyTo(city.x, city.z + 4, 70, 1.4, 0);
}
cam.onTap = (x, y) => {
  if (!ui) return;
  ui.list.classList.remove('open');
  const u = pick(x, y);
  if (u && u.c) select(u.c, true);
  else if (u && u.city) focusCity(u.city);
  else if (ui.openId) ui.closePanel();
};
cam.onHover = (x, y) => {
  if (!ui || mobile) return;
  const u = x < 0 ? null : pick(x, y);
  hovered = u && u.c ? u.c : null;
  canvas.style.cursor = u ? 'pointer' : 'grab';
  ui.showTip(u ? (u.c || { ...u.city, isCity: true }) : null, x, y);
};

// ---------- intro: fog reveal, then a short camera tour while districts are built ----------
const intro = { t: 0, on: false, built: new Set(), userTook: false, done: new Set() };
const T_REVEAL = 3.0, T_GROW = 1.1;
const C = (id) => CITIES.find((c) => c.id === id);
const K = (k) => COMMUNITIES.find((c) => c.key === k);
// [time, type, arg]
const SCRIPT = [
  [3.0, 'fly', ['nanjing', 1.1]], [4.0, 'build', 'pinewood'], [4.5, 'build', 'cundang'],
  [5.6, 'fly', ['changzhou', 1.0]], [6.5, 'build', 'chuanglefang'],
  [7.7, 'fly', ['shanghai', 1.1]], [8.7, 'build', 'ludere'], [9.3, 'trade', null],
  [10.4, 'fly', ['hangzhou', 1.2]], [11.5, 'build', 'keting'], [11.9, 'build', 'cyberia'], [12.3, 'build', 'xingyouji'],
  [13.5, 'home', 1.6], [15.2, 'end', null],
];
const buildAt = {};
function startIntro() {
  intro.t = 0; intro.on = true; intro.built.clear(); intro.done.clear(); intro.userTook = false;
  for (const c of COMMUNITIES) { c.inner.scale.set(0.001, 0.001, 0.001); c.flag.scale.set(1, 0.001, 1); }
  trade.mat.uniforms.uA.value = 0;
  shared.uniforms.uRevealB.value = 0;
  if (ui) ui.closePanel();
  cam.fly = null;
  cam.dist = cam.goalDist = OVERVIEW.d + 45; cam.target.set(OVERVIEW.x, 0, OVERVIEW.z); cam.apply();
  cam.flyTo(OVERVIEW.x, OVERVIEW.z, OVERVIEW.d, T_REVEAL + 0.2);
}
function finishIntroNow() {
  intro.on = false;
  shared.uniforms.uRevealB.value = REVEAL_FINAL;
  for (const c of COMMUNITIES) { c.inner.scale.set(1, 1, 1); c.flag.scale.set(1, 1, 1); intro.built.add(c.key); }
  trade.mat.uniforms.uA.value = 1;
  hs.group.scale.setScalar(1);
  cam.fly = null; cam.target.set(OVERVIEW.x, 0, OVERVIEW.z); cam.dist = cam.goalDist = OVERVIEW.d; cam.apply();
}
function tourShot(city) {
  const d = mobile ? (portrait ? 150 : 110) : 96;
  return { x: city.x + (city.id === 'shanghai' ? -14 : 0), z: city.z + (city.id === 'shanghai' ? -10 : 6), d: city.id === 'shanghai' ? d * 1.35 : d };
}
function updateIntro(dt) {
  if (!intro.on) return;
  intro.t += dt;
  const t = intro.t;
  const u = Math.min(1, t / T_REVEAL);
  shared.uniforms.uRevealB.value = (1 - Math.pow(1 - u, 2.4)) * REVEAL_FINAL;
  hs.group.scale.setScalar(Math.max(0.001, Math.min(1, (t - T_REVEAL * 0.6) / 0.8)));
  SCRIPT.forEach(([t0, type, arg], i) => {
    if (t < t0 || intro.done.has(i)) return;
    intro.done.add(i);
    if (type === 'fly' && !intro.userTook) { const sh = tourShot(C(arg[0])); cam.flyTo(sh.x, sh.z, sh.d, arg[1]); }
    if (type === 'home' && !intro.userTook) cam.flyTo(OVERVIEW.x, OVERVIEW.z, OVERVIEW.d, arg);
    if (type === 'build') {
      const c = K(arg);
      buildAt[c.key] = t0;
      intro.built.add(c.key);
      const k = THREE.MathUtils.clamp(cam.dist / 110, 1, 4);
      dust.burst(c.x, c.y, c.z, mobile ? 40 : 70, 3.2 * Math.sqrt(k));
      beams.spawn(c.x, c.y, c.z, k);
      ui.toast(c);
    }
    if (type === 'end') intro.on = false;
  });
  for (const c of COMMUNITIES) {
    if (!(c.key in buildAt) || !intro.built.has(c.key)) continue;
    const t0 = buildAt[c.key];
    const p = Math.min(1, (t - t0) / T_GROW);
    const sxz = 0.55 + 0.45 * Math.min(1, p * 1.6);
    c.inner.scale.set(sxz, Math.max(0.001, easeOutBack(p, 2.4)), sxz);
    const pf = Math.min(1, Math.max(0, (t - t0 - 0.5) / 0.7));
    c.flag.scale.set(1, Math.max(0.001, easeOutBack(pf, 1.8)), 1);
  }
  const tt = SCRIPT.find((e) => e[1] === 'trade')[0];
  trade.mat.uniforms.uA.value = Math.min(1, Math.max(0, (t - tt) / 1.0));
  if (!intro.on) { for (const c of COMMUNITIES) { c.inner.scale.set(1, 1, 1); c.flag.scale.set(1, 1, 1); } trade.mat.uniforms.uA.value = 1; }
}
// any manual camera input hands control back to the user (the build animation keeps playing)
for (const ev of ['pointerdown', 'wheel']) canvas.addEventListener(ev, () => { if (intro.on) { intro.userTook = true; } }, { passive: true });

let last = performance.now();
function start() {
  window.__readyAt = performance.now();
  document.getElementById('loader').classList.add('done');
  const ld = document.getElementById('loader');
  ld.style.pointerEvents = 'none';
  setTimeout(() => { ld.style.display = 'none'; }, qs.has('shot') ? 0 : 1000);
  startIntro();
  if (qs.has('instant')) finishIntroNow();
  const v = qs.get('view');
  if (v) {
    const city = CITIES.find((c) => c.id === v);
    if (city) { cam.fly = null; cam.target.set(city.x - 2, 0, city.z + 4); cam.dist = cam.goalDist = +(qs.get('d') || 62); cam.apply(); }
    if (v === 'overview') { cam.fly = null; cam.target.set(OVERVIEW.x, 0, OVERVIEW.z); cam.dist = cam.goalDist = OVERVIEW.d; cam.apply(); }
  }
  if (qs.has('cx')) { cam.fly = null; cam.target.set(+qs.get('cx'), +(qs.get('cy') || 0), +qs.get('cz')); cam.dist = cam.goalDist = +(qs.get('d') || 80); cam.apply(); }
  const op = qs.get('open');
  if (op) {
    const c = COMMUNITIES.find((k) => k.key === op);
    if (c) { finishIntroNow(); select(c, false); const o = panelOffset(); cam.fly = null; cam.target.set(c.x + o.dx, 0, c.z + o.dz); cam.dist = cam.goalDist = o.d; cam.apply(); }
  }
  renderer.setAnimationLoop(frame);
  if (qs.has('bench')) {
    const tReady = performance.now();
    let n = 0; const t0 = performance.now();
    const tickB = () => { n++; if (n < 120) requestAnimationFrame(tickB); else { const el = document.createElement('div'); el.id = 'bench'; el.textContent = JSON.stringify({ ready: Math.round(tReady), frameMs: +((performance.now() - t0) / n).toFixed(2), info: renderer.info.render }); document.body.appendChild(el); } };
    requestAnimationFrame(tickB);
  }
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const U = shared.uniforms;
  U.uTime.value += dt;
  updateIntro(dt);
  cam.update(dt);
  U.uCamDist.value = cam.dist;
  const target = hovered || selected;
  if (target) U.uHiHex.value.set(target.hex[0], target.hex[1]);
  U.uHi.value += ((target ? 1 : 0) - U.uHi.value) * Math.min(1, dt * 8);
  const t = cam.target;
  const half = THREE.MathUtils.clamp(cam.dist * 0.62, 26, 290);
  sun.position.copy(t).addScaledVector(SUN_DIR, 400);
  sun.target.position.copy(t);
  const sc = sun.shadow.camera;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 50; sc.far = 800;
  sc.updateProjectionMatrix();
  scene.fog.near = cam.dist * 1.15; scene.fog.far = cam.dist * 3.4;
  props.setDist(cam.dist);
  dust.update(dt); beams.update(dt); trade.update(dt); boats.update(dt); hs.update(U.uTime.value);
  dust.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
  ui.update(camera, cam.dist, (c) => intro.built.has(c.key));
  if (post) { post.update(cam.dist); post.render(); } else renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.setSize(innerWidth, innerHeight);
});

init().catch((e) => { console.error(e); loadtip.textContent = '加载失败：' + e.message; });
