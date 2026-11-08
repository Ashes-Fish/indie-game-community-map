import * as THREE from 'three';
import './style.css';
import { World, loadImage } from './world.js';
import { CITIES, COMMUNITIES, HUB_CITIES } from './data.js';
import { buildTerrainMesh, buildPaperPlane, loadTerrainTextures, makeRippleTexture, MAX_OWNERS } from './terrain.js';
import { buildInkTexture } from './parchment.js';
import { CivCamera } from './camera.js';
import { buildProps } from './props.js';
import { buildCities, buildDistricts, buildWestLake } from './places.js';
import { buildRivers, buildRoads, buildTrade, buildBoats } from './routes.js';
import { buildHuangshan } from './wonder.js';
import { Dust, Beams, easeOutBack } from './fx.js';
import { UI } from './ui.js';
import { buildSmoke, buildBirds, buildWalkers, livenBuildings } from './life.js';
import { bakeAO } from './ao.js';
import { HEX_R, toWorld } from './config.js';
import { PATCHES, patchById } from './patches.js';
import { dumpPins } from './layout.js';
import PINS from './layout-pins.json';
import { buildNationalInk, paperMul, PAPER_STYLES } from './natink.js';

// One national world (docs/全国一张世界方案.md): the national ink map is the fog-of-war paper, each land patch (地块)
// rises out of it in 3D, one camera from the whole country down to a street. 长三角 keeps its hand-made extras
// (黄山, 西湖, 运河, Ludere 商路, place labels).
const BASE = import.meta.env.BASE_URL;
const qs = new URLSearchParams(location.search);
const PAPER = PAPER_STYLES[qs.get('paper')] ? qs.get('paper') : 'qinglv';
document.title = '中国独立游戏社团地图';
document.querySelector('#loader .sub').textContent = '全国';
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = qs.get('q') === 'low' || (qs.get('q') !== 'high' && (coarse || innerWidth < 720) && Math.min(innerWidth, innerHeight) < 900);
const Q = mobile
  ? { mobile: true, dpr: Math.min(devicePixelRatio, 2), post: false, shadow: 1024, step: 1.5, inkPerKm: 2.4, trees: 0.5, nat: 2048 }
  : { mobile: false, dpr: Math.min(devicePixelRatio, 1.5), post: true, shadow: 2048, step: 1.0, inkPerKm: 3.4, trees: 1, nat: 4096 };
const FAR_D = 1100;        // beyond this camera distance a patch shows only its coarse terrain (stand-in for M2 LOD)
const COARSE_STEP = 4;     // km grid of that coarse terrain

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
const portrait = innerHeight > innerWidth * 1.15;
const camera = new THREE.PerspectiveCamera(portrait ? 40 : 30, innerWidth / innerHeight, 1, 4000);

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

// a transparent 1×1 ink layer until a patch's own ink map is drawn
const NO_INK = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
NO_INK.needsUpdate = true;

// uniforms every patch shares; each patch adds its own (World.uniforms) on top
const shared = {
  uniforms: {
    uTime: { value: 0 }, uCamDist: { value: 300 }, uGrid: { value: 0.34 }, uTerr: { value: null }, uRipple: { value: null },
    uOwnCol: { value: Array.from({ length: MAX_OWNERS }, () => new THREE.Color(0, 0, 0)) },
    uOwnCol2: { value: Array.from({ length: MAX_OWNERS }, () => new THREE.Color(1, 1, 1)) },
    uHiHex: { value: new THREE.Vector2(999, 999) }, uHi: { value: 0 },
    uNat: { value: null }, uNatRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uNatOn: { value: 1 }, uPaperMul: { value: paperMul(PAPER) },
  },
};
const REVEAL_FINAL = 80 * 1.5;
const T_REVEAL = 3.0, T_GROW = 1.1;

// old 长三角 region-local km (the hand-placed labels and tour framing were authored in it) → national frame
const yrdOld = (x, z) => toWorld(120.1 + x / (111.32 * Math.cos(31.1 * Math.PI / 180)), 31.1 - z / 110.6);

// the whole country, framed on the mainland (refit on resize; a hidden tab can start with a 0 × 0 window)
const NAT_VIEW = {};
function fitNational() {
  const [x, z] = toWorld(105.5, 35.6);
  const aspect = camera.aspect > 0.1 && camera.aspect < 10 ? camera.aspect : 16 / 9;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));   // fit ~5200 × 3700 km of mainland
  Object.assign(NAT_VIEW, { x: portrait ? x + 500 : x, z, d: Math.max((portrait ? 3300 : 5200) / (2 * tv * aspect), 3700 / (2 * tv)) * 0.98 });
}
fitNational();
// one land patch framed: all of its cities (长三角 keeps its hand-tuned framing)
function patchOverview(P) {
  if (P.id === 'yrd') {
    const [ox, oz, d] = mobile ? (portrait ? [3, -2, 950] : [-10, 5, 470]) : [-24, -3, 462];
    const [x, z] = yrdOld(ox, oz);
    return { x, z, d };
  }
  const pts = CITIES.filter((c) => c.patch === P.id).map((c) => toWorld(c.lon, c.lat));
  if (!pts.length) return { x: P.cx, z: P.cz, d: 420 };
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...zs) - Math.min(...zs)) * 1.4);
  const d = Math.min(470, Math.max(mobile ? 260 : 200, span * 1.6 + 150));
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 + 4, d: mobile && portrait ? d * 1.6 : d };
}

const cam = new CivCamera(camera, canvas, {
  maxD: NAT_VIEW.d * 1.12, minD: mobile ? 26 : 30, pitchD: 510, farPitch: 80, fixedBounds: true,
  bounds: { x0: NAT_VIEW.x - 2300, x1: NAT_VIEW.x + 2300, z0: NAT_VIEW.z - 1700, z1: NAT_VIEW.z + 1500 },
});
const patches = [];           // { world, P, cities, comms, sites, rivers, ps, coarse, fine, near, ready, t, ... }
const proxies = [];
const built = new Set();      // communities whose district has been raised (UI tags follow it)
let ui, post, dust, beams, hovered = null, farOn = null;

async function loadLogos() {
  const out = {};
  await Promise.all(COMMUNITIES.filter((c) => c.logo).map(async (c) => {
    try { out[c.logo] = await loadImage(BASE + 'logos/' + c.logo + '.webp'); } catch (e) { /* ignore */ }
  }));
  return out;
}
let logos = {};

// where the camera starts, so the nearest patch is built first
function startView() {
  const city = CITIES.find((c) => c.id === qs.get('view'));
  if (city) return { ...Object.fromEntries(['x', 'z'].map((k, i) => [k, toWorld(city.lon, city.lat)[i]])), d: +(qs.get('d') || 62) };
  const op = COMMUNITIES.find((k) => k.key === qs.get('open'));
  if (op) { const c = CITIES.find((k) => k.id === op.cityId); const [x, z] = toWorld(c.lon, c.lat); return { x, z, d: 46 }; }
  const P = patchById(qs.get('region'));
  if (P) return patchOverview(P);
  if (qs.has('cx')) return { x: +qs.get('cx'), z: +qs.get('cz'), d: +(qs.get('d') || 80) };
  return NAT_VIEW;
}

async function init() {
  const postP = Q.post ? import('./post.js') : null;
  progress(0.1, '正在展开舆图…');
  const worlds = PATCHES.map((P) => new World(P));
  const riversP = worlds.map((w) => fetch(`${BASE}data/patches/${w.id}/rivers.json`).then((r) => r.json()));
  const [nat, lg, terrTex] = await Promise.all([
    buildNationalInk(BASE, PAPER, Q.nat, HUB_CITIES), loadLogos(), loadTerrainTextures(BASE + 'tex/terrain.webp'), ...worlds.map((w) => w.load(BASE)),
  ]);
  logos = lg;
  shared.uniforms.uTerr.value = terrTex;
  shared.uniforms.uRipple.value = makeRippleTexture();
  shared.uniforms.uNat.value = nat.tex; shared.uniforms.uNatRect.value.copy(nat.rect);
  CITIES.forEach((c) => { shared.uniforms.uOwnCol.value[c.gi + 1].set(c.color).convertSRGBToLinear(); shared.uniforms.uOwnCol2.value[c.gi + 1].set(c.color2).convertSRGBToLinear(); });

  // phase 1, every patch: hex layout (cities, territory, districts), levelled sites, coarse terrain
  progress(0.5, '正在勘定疆界…');
  for (const [i, world] of worlds.entries()) {
    const cities = CITIES.filter((c) => c.patch === world.id);
    const comms = COMMUNITIES.filter((cm) => cities.some((c) => c.id === cm.cityId));
    world.buildHexes(cities, comms, PINS);
    for (const c of cities) world.flatten(c.x, c.z, 4.6);
    for (const s of world.sites) world.flatten(s.x, s.z, 3.8);
    world.buildNormalTex();
    for (const c of cities) c.y = world.heightY(c.x, c.z);
    for (const s of world.sites) { s.y = world.heightY(s.x, s.z); for (const c of s.members) c.y = s.y; }
    world.uniforms.uInk.value = NO_INK;
    const ps = world.shared(shared);
    const coarseT = buildTerrainMesh(world, ps, COARSE_STEP, Q.mobile);
    scene.add(coarseT.mesh);
    patches.push({ world, P: world.patch, cities, comms, sites: world.sites, rivers: await riversP[i], ps, coarse: coarseT.mesh, material: coarseT.material, ready: false, t: 0 });
    progress(0.5 + 0.3 * (i + 1) / worlds.length);
    await tick();
  }
  const [rx0, rz0, rx1, rz1] = nat.rect.toArray();
  scene.add(buildPaperPlane([rx0 - 6000, rz0 - 6000, rx1 + 6000, rz1 + 6000], PATCHES, shared, Q.mobile));
  dust = new Dust(); beams = new Beams();
  scene.add(dust.points, beams.group);

  ui = new UI({
    cities: CITIES, communities: COMMUNITIES, sites: patches.flatMap((pa) => pa.sites), base: BASE, mobile, regionName: '全国', onChina: goChina,
    onPick: (c, fly) => select(c, fly), onSite: (s, fly) => selectSite(s, fly), onCity: (city) => focusCity(city), onReplay: replay,
  });
  ui.onClose = () => { selected = null; };
  if (patchById('yrd')) {
    const L = (text, x, y, z, cls) => { const [wx, wz] = yrdOld(x, z); ui.addLabel(text, wx, y, wz, cls); };
    L('太 湖', 9, 0.6, -12, 'water');
    L('长 江', -40, 0.6, -101, 'water');
    L('钱塘江', 26, 0.6, 104, 'water');
    L('杭 州 湾', 98, 0.6, 78, 'water');
    L('天 目 山', -62, 5, 84);
    L('京杭大运河', 46, 0.6, 30, 'water');
    const [hx, hz] = toWorld(118.17, 30.13);
    ui.addLabel('黄山 · 自然奇观', hx + 4, 12, hz - 9, 'wonder');
  }
  if (Q.post) {
    progress(0.86, '正在调和光影…');
    await tick();
    const { makePost } = await postP;
    post = makePost(renderer, scene, camera);
  }
  progress(0.95, '即将完成…');
  // window.__dbg.pins() prints the snapshot to commit as src/layout-pins.json after adding communities
  window.__dbg = { scene, cam, shared, renderer, camera, patches, COMMUNITIES, CITIES, select, focusCity, perf, NAT_VIEW, pins: () => JSON.stringify(dumpPins(CITIES, COMMUNITIES), null, 2), get post() { return post; } };
  start();
  buildPatches();
}

// phase 2: raise each patch in 3D, the one nearest the camera first; it then grows out of the paper
async function buildPatches() {
  const todo = [...patches];
  while (todo.length) {
    const t = cam.fly ? cam.fly.to : cam.target;
    todo.sort((a, b) => Math.hypot(a.P.cx - t.x, a.P.cz - t.z) - Math.hypot(b.P.cx - t.x, b.P.cz - t.z));
    await buildPatch(todo.shift());
    await tick();
  }
  window.__allBuiltAt = performance.now();
}

async function buildPatch(pa) {
  const { world, ps, cities, comms, sites, rivers } = pa;
  const yrd = world.id === 'yrd';
  const inkSize = Math.min(2048, Math.round((world.x1 - world.x0) * Q.inkPerKm));
  world.uniforms.uInk.value = buildInkTexture(world, rivers.rivers, inkSize, CITIES.map((c) => c.name), PAPER_STYLES[PAPER].mtn);
  pa.fine = buildTerrainMesh(world, ps, Q.step, Q.mobile, pa.material).mesh;
  await tick();
  const g = pa.near = new THREE.Group();
  const [hx, hz] = toWorld(118.17, 30.13); // 黄山
  const keepOut = [...cities.map((c) => ({ x: c.x, z: c.z, r: 5.4 })), ...sites.map((s) => ({ x: s.x, z: s.z, r: 4.3 })), ...(yrd ? [{ x: hx, z: hz, r: 7 }] : [])];
  pa.props = buildProps(world, ps, Q, keepOut);
  const cityGroup = buildCities(world, cities, ps).group;
  const distGroup = buildDistricts(world, sites, cities, ps, logos, BASE);
  const westLake = yrd ? buildWestLake(world, rivers) : new THREE.Group();
  g.add(pa.props.group, cityGroup, distGroup, westLake);
  // baked vertex AO (worker, async — buildings pop in darker a moment later) + lantern flicker
  if (qs.get('ao') !== '0') {
    const strength = Q.post ? 0.5 : 0.75;   // desktop also has screen-space AO up close
    for (const c of cities) bakeAO(c.group, { radius: 0.7, strength });
    for (const s of sites) bakeAO(s.inner, { radius: 0.8, strength });
    bakeAO(westLake, { radius: 0.6, strength });
  }
  for (const gg of [cityGroup, distGroup, westLake]) livenBuildings(gg, ps);
  g.add(buildRivers(world, rivers.rivers, ps));
  const roads = buildRoads(world, cities, ps);
  g.add(roads);
  // life: chimney smoke over villages and city lanes, walkers and ox carts on the roads, birds over lakes and towns
  const R = (k) => ((Math.sin(k * 91.7) * 43758.5) % 1 + 1) % 1;
  const emit = pa.props.houses.filter((h, i) => R(i) < (Q.mobile ? 0.12 : 0.22)).map((h, i) => ({ x: h.x + 0.2 * h.s, y: h.y + 0.62 * h.s * (h.sy || 1), z: h.z, ph: R(i + 0.5) }));
  for (const c of cities) for (let k = 0; k < 3; k++) emit.push({ x: c.x + (R(k + c.x) - 0.5) * 4, y: c.y + 0.6, z: c.z + (R(k * 3 + c.z) - 0.5) * 4, ph: R(k + 7) });
  pa.smoke = buildSmoke(emit, ps, Q);
  pa.walkers = buildWalkers(world, roads.userData.paths, Q);
  const C = (id) => cities.find((c) => c.id === id);
  const birdAt = yrd && C('shanghai') && C('nanjing')
    ? [yrdOld(9, -12), toWorld(120.14, 30.24), [C('shanghai').x, C('shanghai').z], yrdOld(-20, -60), [C('nanjing').x, C('nanjing').z], yrdOld(60, 20)].map(([x, z]) => ({ x, z }))
    : cities.map((c) => ({ x: c.x, z: c.z }));
  pa.birds = buildBirds(world, birdAt, ps, Q);
  g.add(pa.smoke.points, pa.walkers.group, pa.birds.mesh);
  const lud = comms.find((c) => c.key === 'ludere');
  pa.trade = lud && C('changshu') ? buildTrade(world, lud, C('changshu'), ps)
    : { group: new THREE.Group(), mat: { uniforms: { uA: { value: 0 } } }, update() {} };
  const canal = rivers.rivers.find((r) => r.name === 'canal');
  pa.boats = canal ? buildBoats(world, canal) : { group: new THREE.Group(), update() {} };
  pa.hs = yrd ? buildHuangshan(world, hx, hz, ps) : { group: new THREE.Group(), update() {} };
  g.add(pa.trade.group, pa.boats.group, pa.hs.group);
  // pick proxies
  const pmat = new THREE.MeshBasicMaterial({ visible: false });
  const pgeo = new THREE.CylinderGeometry(HEX_R * 0.92, HEX_R * 0.92, 9, 6).rotateY(Math.PI / 6);
  for (const s of sites) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(s.x, s.y + 2, s.z); m.userData.site = s; proxies.push(m); g.add(m); }
  for (const c of cities) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(c.x, c.y + 2, c.z); m.userData.city = c; proxies.push(m); g.add(m); }
  scene.add(pa.fine, g);
  farOn = null;   // re-apply far / near visibility for the new meshes
  grow(pa);
  pa.ready = true;
}

// the patch's land grows out of the paper, then its districts rise one after another
function grow(pa) {
  pa.t = 0;
  pa.world.uniforms.uRevealB.value = 0;
  pa.comms.forEach((c, i) => { c.buildAt = T_REVEAL * 0.55 + i * 0.32; c.inner.scale.set(0.001, 0.001, 0.001); c.flag.scale.set(1, 0.001, 1); built.delete(c.key); });
  pa.trade.mat.uniforms.uA.value = 0;
}
function updatePatch(pa, dt) {
  const t = pa.t += dt;
  const u = Math.min(1, t / T_REVEAL);
  pa.world.uniforms.uRevealB.value = (1 - Math.pow(1 - u, 2.4)) * REVEAL_FINAL;
  pa.hs.group.scale.setScalar(Math.max(0.001, Math.min(1, (t - T_REVEAL * 0.6) / 0.8)));
  for (const c of pa.comms) {
    const t0 = c.buildAt;
    if (t < t0) continue;
    if (!built.has(c.key)) {
      built.add(c.key);
      if (!farOn) { const k = THREE.MathUtils.clamp(cam.dist / 110, 1, 4); dust.burst(c.x, c.y, c.z, mobile ? 40 : 70, 3.2 * Math.sqrt(k)); }
    }
    const p = Math.min(1, (t - t0) / T_GROW);
    const sxz = 0.55 + 0.45 * Math.min(1, p * 1.6);
    c.inner.scale.set(sxz, Math.max(0.001, easeOutBack(p, 2.4)), sxz);
    const pf = Math.min(1, Math.max(0, (t - t0 - 0.5) / 0.7));
    c.flag.scale.set(1, Math.max(0.001, easeOutBack(pf, 1.8)), 1);
  }
  const last = pa.comms.length ? pa.comms[pa.comms.length - 1].buildAt : 0;
  pa.trade.mat.uniforms.uA.value = Math.min(1, Math.max(0, (t - last - 0.6) / 1.0));
  pa.props.setDist(cam.dist);
  pa.trade.update(dt); pa.boats.update(dt); pa.hs.update(shared.uniforms.uTime.value);
  pa.smoke.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
  pa.birds.update(shared.uniforms.uTime.value, cam.dist);
  pa.walkers.update(dt, shared.uniforms.uTime.value, cam.dist);
}

// ---------- interaction ----------
let selected = null;
const ray = new THREE.Raycaster();
function pick(x, y) {
  if (farOn) return null;
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
// a single-community hex opens that community; a cluster hex opens its member list
function selectSite(s, fly) {
  if (s.members.length === 1) return select(s.members[0], fly);
  selected = s;
  if (fly) { const o = panelOffset(); cam.flyTo(s.x + o.dx, s.z + o.dz, o.d, 1.5, 0); }
  ui.openCluster(s);
}
function focusCity(city) {
  cam.flyTo(city.x, city.z + 4, 70, 1.4, 0);
}
cam.onTap = (x, y) => {
  if (!ui) return;
  ui.list.classList.remove('open');
  const u = pick(x, y);
  if (u && u.site) selectSite(u.site, true);
  else if (u && u.city) focusCity(u.city);
  else if (ui.openId) ui.closePanel();
};
cam.onHover = (x, y) => {
  if (!ui || mobile) return;
  const u = x < 0 ? null : pick(x, y);
  hovered = u && u.site ? u.site : null;
  canvas.style.cursor = u ? 'pointer' : 'grab';
  ui.showTip(u ? (u.site || { ...u.city, isCity: true }) : null, x, y);
};

// the 全国地图 button: back out to the whole country
function goChina() { if (ui) ui.closePanel(); cam.flyTo(NAT_VIEW.x, NAT_VIEW.z, NAT_VIEW.d, 2.2); }
// 重播建城: back to the country, every patch grows out of the paper again
function replay() {
  goChina();
  setTimeout(() => { for (const pa of patches) if (pa.ready) grow(pa); }, 1600);
}

let last = performance.now();
function start() {
  window.__readyAt = performance.now();
  document.getElementById('loader').classList.add('done');
  const ld = document.getElementById('loader');
  ld.style.pointerEvents = 'none';
  setTimeout(() => { ld.style.display = 'none'; }, qs.has('shot') ? 0 : 1000);
  const v = startView();
  cam.fly = null; cam.target.set(v.x, 0, v.z); cam.dist = cam.goalDist = v.d; cam.apply();
  const city = CITIES.find((c) => c.id === qs.get('view'));
  if (city) { cam.target.set(city.x - 2, 0, city.z + 4); cam.apply(); }
  const op = COMMUNITIES.find((k) => k.key === qs.get('open'));
  if (op) { selectSite(op.site, false); const o = panelOffset(); cam.target.set(op.x + o.dx, 0, op.z + o.dz); cam.dist = cam.goalDist = o.d; cam.apply(); }
  if (qs.has('tour')) {   // the continuous descent: country → 长三角 → 杭州 street level
    const P = patchById('yrd'), hz = CITIES.find((c) => c.id === 'hangzhou');
    if (P && hz) {
      const ov = patchOverview(P);
      setTimeout(() => cam.flyTo(ov.x, ov.z, ov.d, 4.2), 1200);
      setTimeout(() => cam.flyTo(hz.x - 2, hz.z + 4, 46, 3.2), 6000);
    }
  }
  renderer.setAnimationLoop(frame);
  if (qs.has('bench')) {
    const tReady = performance.now();
    let n = 0; const t0 = performance.now();
    const tickB = () => { n++; if (n < 120) requestAnimationFrame(tickB); else { const el = document.createElement('div'); el.id = 'bench'; el.textContent = JSON.stringify({ ready: Math.round(tReady), frameMs: +((performance.now() - t0) / n).toFixed(2), info: renderer.info.render }); document.body.appendChild(el); } };
    requestAnimationFrame(tickB);
  }
}

// adaptive resolution: if the GPU can't hold ~55 fps, drop the render pixel ratio a notch (never back up, no flicker)
const perf = { t: 0, n: 0, dpr: Q.dpr, since: 0 };
function adaptResolution(raw) {
  perf.since += raw;
  if (perf.since < 4 || raw > 0.5) return;   // skip start-up shader compiles and tab switches
  perf.t += raw; perf.n++;
  if (perf.t < 2) return;
  const fps = perf.n / perf.t;
  perf.t = perf.n = 0;
  if (fps < 52 && perf.dpr > 1) {
    perf.dpr = Math.max(1, perf.dpr - 0.25);
    renderer.setPixelRatio(perf.dpr);
    if (post) post.setPixelRatio(perf.dpr);
  }
}

function frame() {
  const now = performance.now();
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw); last = now;
  adaptResolution(raw);
  const U = shared.uniforms;
  U.uTime.value += dt;
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
  // keep depth precision across a 30 → 8000 km zoom
  const near = Math.max(1, cam.dist / 150), far = Math.max(4000, cam.dist * 4);
  if (near !== camera.near || far !== camera.far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
  // country scale: only the paper and each patch's coarse terrain, shadow map frozen (stand-in for M2 LOD)
  const isFar = cam.dist > FAR_D;
  if (isFar !== farOn) {
    farOn = isFar;
    for (const pa of patches) {
      pa.coarse.visible = isFar || !pa.ready;
      if (pa.fine) { pa.fine.visible = !isFar; pa.near.visible = !isFar; }
    }
    renderer.shadowMap.autoUpdate = !isFar; renderer.shadowMap.needsUpdate = true;
  }
  for (const pa of patches) if (pa.ready) updatePatch(pa, dt);
  dust.update(dt); beams.update(dt);
  dust.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
  ui.update(camera, cam.dist, (c) => built.has(c.key));
  if (post) { post.update(cam.dist); post.render(); } else renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  fitNational(); cam.maxD = NAT_VIEW.d * 1.12;
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.setSize(innerWidth, innerHeight);
});

init().catch((e) => { console.error(e); loadtip.textContent = '加载失败：' + e.message; });
