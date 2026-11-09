import * as THREE from 'three';
import './style.css';
import { World, loadImage } from './world.js';
import { CITIES, COMMUNITIES, HUB_CITIES } from './data.js';
import { PatchTerrain, loadTerrainTextures, makeRippleTexture, MAX_OWNERS } from './terrain.js';
import { buildInkTexture } from './parchment.js';
import { setRenderer } from './assets.js';
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
import { PATCHES, patchById, patchAt } from './patches.js';
import { REGIONS, regionById, assignRegions, regionView } from './regions.js';
import { dumpPins } from './layout.js';
import PINS from './layout-pins.json';
import { createPainter, paperMul, PAPER_STYLES } from './natink.js';
import { PaperTiles } from './paper.js';

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
  ? { mobile: true, dpr: Math.min(devicePixelRatio, 2), post: false, shadow: 1024, inkPerKm: 2.4, trees: 0.5, paperPerKm: 1.1 }
  : { mobile: false, dpr: Math.min(devicePixelRatio, 1.5), post: true, shadow: 2048, inkPerKm: 3.4, trees: 1, paperPerKm: 2.2 };
const FAR_D = 1100;        // country scale beyond this camera distance: paper, whole-patch terrain, national banners

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
setRenderer(renderer);

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
    uNat: { value: null }, uNatRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uNatBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
    uNatOn: { value: 1 }, uIsPaper: { value: 0 }, uPaperMul: { value: paperMul(PAPER) },
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
const patches = [];           // { world, P, cities, comms, sites, rivers, ps, terrain, mid, near, revealT, buildT, ... }
const proxies = [];
const built = new Set();      // communities whose district has been raised (UI tags follow it)
let ui, post, dust, beams, paper, painter, hovered = null, farOn = null;
let last = performance.now();

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
    createPainter(BASE, PAPER, HUB_CITIES), loadLogos(), loadTerrainTextures(BASE + 'tex/terrain.webp'), ...worlds.map((w) => w.load(BASE)),
  ]);
  logos = lg;
  shared.uniforms.uTerr.value = terrTex;
  shared.uniforms.uRipple.value = makeRippleTexture();
  shared.uniforms.uNatBounds.value.set(...nat.rect);
  painter = nat;
  paper = new PaperTiles(nat, shared, Q.mobile, renderer);
  await paper.init();
  scene.add(paper.group);
  shared.uniforms.uNat.value = paper.root.tex; shared.uniforms.uNatRect.value.copy(paper.root.rect);
  CITIES.forEach((c) => { shared.uniforms.uOwnCol.value[c.gi + 1].set(c.color).convertSRGBToLinear(); shared.uniforms.uOwnCol2.value[c.gi + 1].set(c.color2).convertSRGBToLinear(); });

  // phase 1, every patch: hex layout (cities, territory, districts), levelled sites, chunked terrain (coarse levels)
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
    // the national paper this patch fades into at its edges: the coarsest tile until its own crop is drawn (buildMid)
    world.uniforms.uNat = { value: paper.root.tex }; world.uniforms.uNatRect = { value: paper.root.rect.clone() };
    const ps = world.shared(shared);
    const terrain = new PatchTerrain(world, ps, Q.mobile);
    terrain.onBuild = precompileMesh;
    scene.add(terrain.group);
    patches.push({ world, P: world.patch, cities, comms, sites: world.sites, rivers: await riversP[i], ps, terrain, mid: null, near: null, revealT: -0.25 * i, buildT: 0 });
    progress(0.5 + 0.3 * (i + 1) / worlds.length);
    await tick();
  }
  dust = new Dust(); beams = new Beams();
  scene.add(dust.points, beams.group);

  assignRegions(CITIES);
  ui = new UI({
    cities: CITIES, communities: COMMUNITIES, sites: patches.flatMap((pa) => pa.sites), base: BASE, mobile, regionName: '全国', onChina: goChina,
    onPick: (c, fly) => select(c, fly), onSite: (s, fly) => selectSite(s, fly), onCity: (city) => focusCity(city), onReplay: replay,
    onHub: flyToHub, onRegion: goRegion, regions: REGIONS, patchName: (id) => patchById(id)?.name,
  });
  ui.regionD = REGION_D;
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
  // the first patch and every shader program it needs, behind the loading bar: the first frames after the loader
  // lifts then have nothing left to compile
  progress(0.88, '正在营建城郭…');
  await warmUp();
  progress(0.95, '即将完成…');
  // window.__dbg.pins() prints the snapshot to commit as src/layout-pins.json after adding communities
  window.__dbg = { scene, cam, shared, paper, frame, buildLog, buildMid, buildNear, timed, renderer, camera, patches, COMMUNITIES, CITIES, select, focusCity, goRegion, REGIONS, perf, NAT_VIEW, pins: () => JSON.stringify(dumpPins(CITIES, COMMUNITIES), null, 2), get post() { return post; } };
  start();
  scheduler();
}

// the first patch, built behind the loader: the one at the start view, else 长三角 (it has every kind of object)
async function warmUp() {
  const v = startView();
  const pa = patches.find((p) => p.P === patchAt(v.x, v.z, -400)) || patches.find((p) => p.world.id === 'yrd') || patches[0];
  if (!pa) return;
  await buildMid(pa);
  await buildNear(pa);
  // the shadow-depth variants and the close-up post passes (screen-space AO) compile on first use: render the
  // patch once from street level into an offscreen target, with the user's camera untouched
  const saved = { x: cam.target.x, z: cam.target.z, d: cam.dist, fly: cam.fly };
  const city = pa.cities[0];
  cam.fly = null; cam.target.set(city.x, 0, city.z + 4); cam.dist = cam.goalDist = 60; cam.apply();
  pa.revealT = T_REVEAL; pa.buildT = 0;
  for (const pp of patches) { pp.terrain.update(camera, false, performance.now() + 2000); if (pp.mid) pp.mid.visible = true; if (pp.near) pp.near.visible = true; }
  renderer.shadowMap.needsUpdate = true;
  const t0 = performance.now();
  // the post chain at street level (screen-space AO on, bloom, tilt-shift, SMAA) compiles its programs on this call;
  // one frame at 1 × 1 pixel costs nothing but the compiles
  if (post) { renderer.setSize(1, 1, false); post.setSize(1, 1); post.update(cam.dist); post.render(); renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight); }
  else { const rt = new THREE.WebGLRenderTarget(4, 4); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); rt.dispose(); }
  buildLog.push(['warm-render', +(performance.now() - t0).toFixed(1)]);
  cam.fly = saved.fly; cam.target.set(saved.x, 0, saved.z); cam.dist = cam.goalDist = saved.d; cam.apply();
  farOn = null;
  growDistricts(pa);
}

// ---------- detail levels (M2) ----------
// Every patch always has its chunked terrain. Its "mid" tier (ink map, cities, districts, roads, rivers, wonders) is built
// once the camera is below country scale within MID_KM of it; its "near" tier (trees, villages, smoke, walkers, birds,
// boats) once the camera is lower than NEAR_D close to it. One build at a time, nearest patch first.
const MID_KM = 700, NEAR_D = 650, NEAR_KM = 350;
const buildLog = [];
const timed = (label, fn) => { const t0 = performance.now(); const r = fn(); buildLog.push([label, +(performance.now() - t0).toFixed(1)]); return r; };
const rectDist = (P, x, z) => Math.hypot(Math.max(P.x0 - x, 0, x - P.x1), Math.max(P.z0 - z, 0, z - P.z1));
function nextBuild() {
  const t = cam.fly ? cam.fly.to : cam.target, d = cam.fly ? cam.fly.to.d : cam.goalDist;
  if (d > FAR_D) return null;
  let best = null, bd = Infinity;
  for (const pa of patches) {
    const r = rectDist(pa.P, t.x, t.z);
    if (!pa.mid && r < MID_KM && r < bd) { best = [pa, 'mid']; bd = r; }
    else if (pa.mid && !pa.near && d < NEAR_D && r < NEAR_KM && r - 1000 < bd) { best = [pa, 'near']; bd = r - 1000; }
  }
  return best;
}
async function scheduler() {
  for (;;) {
    const job = nextBuild();
    if (!job) { await new Promise((r) => setTimeout(r, 150)); continue; }
    const [pa, tier] = job;
    if (tier === 'mid') await buildMid(pa); else await buildNear(pa);
    farOn = null;   // re-apply visibility for the new objects
    await tick();
  }
}

async function buildMid(pa) {
  const { world, ps, cities, comms, sites, rivers } = pa;
  const yrd = world.id === 'yrd';
  const inkSize = Math.min(2048, Math.round((world.x1 - world.x0) * Q.inkPerKm));
  let t0 = performance.now();
  const ink = await buildInkTexture(world, rivers.rivers, inkSize, CITIES.map((c) => c.name), PAPER_STYLES[PAPER].mtn);
  buildLog.push([world.id + ' ink', +(performance.now() - t0).toFixed(1)]);
  // a canvas uploads through a slow conversion path (~300 ms for 2048²); an ImageBitmap goes straight to the GPU
  ink.image = await createImageBitmap(ink.image, { premultiplyAlpha: 'none' });
  ink.needsUpdate = true;
  world.uniforms.uInk.value = ink;
  timed(world.id + ' ink-upload', () => renderer.initTexture(ink));
  await tick();
  // a sharp crop of the national paper for the patch's edges (about the resolution of the paper tiles around it)
  const r = [world.x0, world.z0, world.x1, world.z1], cap = Q.mobile ? 1024 : 2048, k = Math.min(Q.paperPerKm, cap / Math.max(r[2] - r[0], r[3] - r[1]));
  world.uniforms.uNat.value = await painter.paint(r, Math.round((r[2] - r[0]) * k), Math.round((r[3] - r[1]) * k));
  world.uniforms.uNatRect.value.set(...r);
  timed(world.id + ' nat-upload', () => renderer.initTexture(world.uniforms.uNat.value));
  await tick();
  const g = new THREE.Group();
  const [hx, hz] = toWorld(118.17, 30.13); // 黄山
  const cityGroup = timed(world.id + ' cities', () => buildCities(world, cities, ps).group);
  await tick();
  const distGroup = timed(world.id + ' districts', () => buildDistricts(world, sites, cities, ps, logos, BASE));
  const westLake = timed(world.id + ' westlake', () => (yrd ? buildWestLake(world, rivers) : new THREE.Group()));
  g.add(cityGroup, distGroup, westLake);
  await tick();
  // baked vertex AO (worker, async — buildings pop in darker a moment later) + lantern flicker. The tessellation
  // before the worker runs on the main thread, so one building per turn.
  if (qs.get('ao') !== '0') {
    const strength = Q.post ? 0.5 : 0.75;   // desktop also has screen-space AO up close
    for (const c of cities) { timed(world.id + ' ao-prep', () => bakeAO(c.group, { radius: 0.7, strength })); await tick(); }
    for (const s of sites) { timed(world.id + ' ao-prep', () => bakeAO(s.inner, { radius: 0.8, strength })); await tick(); }
    bakeAO(westLake, { radius: 0.6, strength });
  }
  for (const gg of [cityGroup, distGroup, westLake]) livenBuildings(gg, ps);
  g.add(timed(world.id + ' rivers', () => buildRivers(world, rivers.rivers, ps)));
  await tick();
  pa.roads = timed(world.id + ' roads', () => buildRoads(world, cities, ps));
  g.add(pa.roads);
  const C = (id) => cities.find((c) => c.id === id);
  const lud = comms.find((c) => c.key === 'ludere');
  pa.trade = lud && C('changshu') ? buildTrade(world, lud, C('changshu'), ps)
    : { group: new THREE.Group(), mat: { uniforms: { uA: { value: 0 } } }, update() {} };
  pa.hs = yrd ? buildHuangshan(world, hx, hz, ps) : { group: new THREE.Group(), update() {} };
  g.add(pa.trade.group, pa.hs.group);
  // pick proxies
  const pmat = new THREE.MeshBasicMaterial({ visible: false });
  const pgeo = new THREE.CylinderGeometry(HEX_R * 0.92, HEX_R * 0.92, 9, 6).rotateY(Math.PI / 6);
  for (const s of sites) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(s.x, s.y + 2, s.z); m.userData.site = s; proxies.push(m); g.add(m); }
  for (const c of cities) { const m = new THREE.Mesh(pgeo, pmat); m.position.set(c.x, c.y + 2, c.z); m.userData.city = c; proxies.push(m); g.add(m); }
  // shaders compile in the GPU driver's background (KHR_parallel_shader_compile) while we wait here, so the first
  // frame that draws the new objects doesn't stall on them
  await compileSpread(g, world.id + ' compile', pa);
  scene.add(g);
  pa.mid = g;
  growDistricts(pa);
}

// stand-ins for what WebGLShadowMap draws: program cache keys depend on type, packing, side and the object (instancing),
// not on the material instance, so a few shared materials cover every caster. Kept alive: disposing them would drop
// the programs from the cache again.
const SHADOW_SIDE = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
const depthStandIns = new Map();
function shadowDepthFor(o) {
  const src = Array.isArray(o.material) ? o.material[0] : o.material, side = SHADOW_SIDE[src.side] ?? THREE.BackSide;
  // the shadow pass copies the caster's map and alphaTest onto the depth material (both change the program)
  const key = (o.customDepthMaterial ? o.customDepthMaterial.uuid : 'std') + ':' + side + ':' + !!src.map + ':' + (src.alphaTest || 0);
  let m = depthStandIns.get(key);
  if (!m) {
    m = o.customDepthMaterial ? o.customDepthMaterial.clone() : new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking });
    if (o.customDepthMaterial) { m.onBeforeCompile = o.customDepthMaterial.onBeforeCompile; m.customProgramCacheKey = o.customDepthMaterial.customProgramCacheKey; }
    m.side = side; m.map = src.map || null; m.alphaTest = src.alphaTest || 0;
    depthStandIns.set(key, m);
  }
  return m;
}

// Program variants depend on the render target bound at compile time (working colour space and no tone mapping when
// drawing into a target, sRGB + ACES when drawing to the canvas). The post chain and the shadow pass draw into targets,
// so compile against one, or the first real frame links everything a second time.
const compileRT = new THREE.WebGLRenderTarget(2, 2);
function compileAs(o, intoTarget) {
  const prev = renderer.getRenderTarget();
  if (intoTarget) renderer.setRenderTarget(compileRT);
  const p = renderer.compileAsync(o, camera, scene);
  renderer.setRenderTarget(prev);
  return p;
}
function compileScene(o) { return compileAs(o, !!post); }
// the shadow pass renders without the scene's fog, and fog is part of the program key: compile the stand-in the same way
function compileShadow(o) {
  const m = o.material, fog = scene.fog;
  o.material = shadowDepthFor(o); scene.fog = null;
  const p = compileAs(o, true);
  o.material = m; scene.fog = fog;
  return p;
}
// a mesh built outside the tier groups (terrain detail levels): compile its programs on creation, not on first draw
function precompileMesh(o) {
  compileScene(o);
  if (o.castShadow) compileShadow(o);
}

// Draw one object into the 2 × 2 target from a throwaway camera, with culling off: vertex buffers, instance
// matrices and textures get uploaded here rather than in the first visible frame. Cheap on the GPU at that size.
const warmCam = camera.clone();
// With shadow: true the shadow pass runs too, with the sun over this patch. The driver finishes the depth-only pipeline
// for each caster on its first real shadow draw (tens of ms for a city), so that first draw happens here.
const warmSun = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() };
function warmDraw(o, pa, shadow = false) {
  const ov = patchOverview(pa.P);
  warmCam.position.set(ov.x, ov.d, ov.z + ov.d * 0.4); warmCam.lookAt(ov.x, 0, ov.z);
  warmCam.near = camera.near; warmCam.far = camera.far; warmCam.updateProjectionMatrix(); warmCam.updateMatrixWorld();
  const culled = []; o.traverse((m) => { if (m.frustumCulled) { culled.push(m); m.frustumCulled = false; } });
  const parent = o.parent, shadows = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = shadow;
  if (shadow) {
    warmSun.pos.copy(sun.position); warmSun.tgt.copy(sun.target.position);
    sun.position.set(ov.x, 0, ov.z).addScaledVector(SUN_DIR, 400); sun.target.position.set(ov.x, 0, ov.z);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -290; sc.right = sc.top = 290; sc.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }
  scene.add(o);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(compileRT);
  renderer.render(scene, warmCam);
  renderer.setRenderTarget(prev);
  if (parent) parent.add(o); else scene.remove(o);
  if (shadow) { sun.position.copy(warmSun.pos); sun.target.position.copy(warmSun.tgt); renderer.shadowMap.needsUpdate = true; }
  renderer.shadowMap.autoUpdate = shadows;
  for (const m of culled) m.frustumCulled = true;
}

// compile each child of a group on its own turn: the main-thread part (shader source + link submission) is spread
// over frames, and the await lets the driver finish linking before the objects are first drawn
async function compileSpread(g, label, pa) {
  const t0 = performance.now();
  let main = 0;
  for (const child of g.children) {
    const t1 = performance.now();
    // districts grow in and props reveal over time: whatever is hidden now is drawn later, so compile it now
    const hidden = []; child.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const ps = [compileScene(child)];   // the main-thread part runs synchronously here
    // the shadow pass draws each caster with a depth material (its own, or the renderer's) on the flipped side:
    // compile an equivalent here so the first shadow pass that includes it links nothing
    child.traverse((o) => { if (o.isMesh && o.castShadow) ps.push(compileShadow(o)); });
    main += performance.now() - t1;
    await tick();
    await Promise.all(ps);
    if (pa) { const t2 = performance.now(); warmDraw(child, pa); main += performance.now() - t2; await tick(); }
    for (const o of hidden) o.visible = false;
  }
  if (pa) { const t3 = performance.now(); warmDraw(g, pa, true); main += performance.now() - t3; await tick(); }
  buildLog.push([label, +(performance.now() - t0).toFixed(1), 'main ' + main.toFixed(1)]);
}

async function buildNear(pa) {
  const { world, ps, cities, sites, rivers } = pa;
  const yrd = world.id === 'yrd';
  const g = new THREE.Group();
  const [hx, hz] = toWorld(118.17, 30.13); // 黄山
  const keepOut = [...cities.map((c) => ({ x: c.x, z: c.z, r: 5.4 })), ...sites.map((s) => ({ x: s.x, z: s.z, r: 4.3 })), ...(yrd ? [{ x: hx, z: hz, r: 7 }] : [])];
  const t0 = performance.now();
  pa.props = await buildProps(world, ps, Q, keepOut);
  buildLog.push([world.id + ' props', +(performance.now() - t0).toFixed(1)]);
  // life: chimney smoke over villages and city lanes, walkers and ox carts on the roads, birds over lakes and towns
  const R = (k) => ((Math.sin(k * 91.7) * 43758.5) % 1 + 1) % 1;
  const emit = pa.props.houses.filter((h, i) => R(i) < (Q.mobile ? 0.12 : 0.22)).map((h, i) => ({ x: h.x + 0.2 * h.s, y: h.y + 0.62 * h.s * (h.sy || 1), z: h.z, ph: R(i + 0.5) }));
  for (const c of cities) for (let k = 0; k < 3; k++) emit.push({ x: c.x + (R(k + c.x) - 0.5) * 4, y: c.y + 0.6, z: c.z + (R(k * 3 + c.z) - 0.5) * 4, ph: R(k + 7) });
  pa.smoke = buildSmoke(emit, ps, Q);
  pa.walkers = timed(world.id + ' walkers', () => buildWalkers(world, pa.roads.userData.paths, Q));
  const C = (id) => cities.find((c) => c.id === id);
  const birdAt = yrd && C('shanghai') && C('nanjing')
    ? [yrdOld(9, -12), toWorld(120.14, 30.24), [C('shanghai').x, C('shanghai').z], yrdOld(-20, -60), [C('nanjing').x, C('nanjing').z], yrdOld(60, 20)].map(([x, z]) => ({ x, z }))
    : cities.map((c) => ({ x: c.x, z: c.z }));
  pa.birds = timed(world.id + ' birds', () => buildBirds(world, birdAt, ps, Q));
  const canal = rivers.rivers.find((r) => r.name === 'canal');
  pa.boats = canal ? buildBoats(world, canal) : { group: new THREE.Group(), update() {} };
  g.add(pa.props.group, pa.smoke.points, pa.walkers.group, pa.birds.mesh, pa.boats.group);
  await compileSpread(g, world.id + ' compile-near', pa);
  scene.add(g);
  pa.near = g;
}

// districts rise one after another (when the patch's mid tier is built, and on 重播建城)
function growDistricts(pa) {
  pa.buildT = 0;
  pa.comms.forEach((c, i) => { c.buildAt = 0.3 + i * 0.32; c.inner.scale.set(0.001, 0.001, 0.001); c.flag.scale.set(1, 0.001, 1); built.delete(c.key); });
  pa.trade.mat.uniforms.uA.value = 0;
}
function updatePatch(pa, dt, far) {
  // land grows out of the paper (all patches, from the start)
  const u = Math.min(1, Math.max(0, (pa.revealT += dt) / T_REVEAL));
  pa.world.uniforms.uRevealB.value = (1 - Math.pow(1 - u, 2.4)) * REVEAL_FINAL;
  if (pa.mid && !far) {
    const t = pa.buildT += dt;
    pa.hs.group.scale.setScalar(Math.max(0.001, Math.min(1, (pa.revealT - T_REVEAL * 0.6) / 0.8)));
    for (const c of pa.comms) {
      const t0 = c.buildAt;
      if (t < t0) continue;
      if (!built.has(c.key)) {
        built.add(c.key);
        const k = THREE.MathUtils.clamp(cam.dist / 110, 1, 4);
        dust.burst(c.x, c.y, c.z, mobile ? 40 : 70, 3.2 * Math.sqrt(k));
      }
      const p = Math.min(1, (t - t0) / T_GROW);
      const sxz = 0.55 + 0.45 * Math.min(1, p * 1.6);
      c.inner.scale.set(sxz, Math.max(0.001, easeOutBack(p, 2.4)), sxz);
      const pf = Math.min(1, Math.max(0, (t - t0 - 0.5) / 0.7));
      c.flag.scale.set(1, Math.max(0.001, easeOutBack(pf, 1.8)), 1);
    }
    const last = pa.comms.length ? pa.comms[pa.comms.length - 1].buildAt : 0;
    pa.trade.mat.uniforms.uA.value = Math.min(1, Math.max(0, (t - last - 0.6) / 1.0));
    pa.trade.update(dt); pa.hs.update(shared.uniforms.uTime.value);
  }
  if (pa.near) {
    const show = !far && cam.dist < NEAR_D;
    pa.near.visible = show;
    if (show) {
      pa.props.setDist(cam.dist);
      pa.boats.update(dt);
      pa.smoke.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
      pa.birds.update(shared.uniforms.uTime.value, cam.dist);
      pa.walkers.update(dt, shared.uniforms.uTime.value, cam.dist);
    }
  }
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
// a 城市群 banner: frame all of its cities (a region without any yet: its anchor at region height)
const REGION_D = 1100;   // above this distance the country view shows 城市群 banners; below it, city banners
function goRegion(r) {
  if (ui) ui.closePanel();
  const v = regionView(r, portrait);
  cam.flyTo(v.x, v.z, v.d, 1.9);
}
// which 城市群 the camera is looking at (for the breadcrumb): the one whose cities are nearest the target
function regionUnderCamera() {
  let best = null, bestD = Infinity;
  for (const r of REGIONS) {
    const pts = r.cities.length ? r.cities : [{ x: r.ax, z: r.az }];
    for (const c of pts) { const d = Math.hypot(c.x - cam.target.x, c.z - cam.target.z); if (d < bestD) { bestD = d; best = r; } }
  }
  return bestD < 600 ? best : null;
}
function cityUnderCamera() {
  let best = null, bestD = 90;
  for (const c of CITIES) { const d = Math.hypot(c.x - cam.target.x, c.z - cam.target.z); if (d < bestD) { bestD = d; best = c; } }
  return best;
}
function updateCrumb() {
  const parts = [{ name: '全国', go: goChina }];
  if (cam.dist < REGION_D) {
    const r = regionUnderCamera();
    if (r) parts.push({ name: r.name, go: () => goRegion(r) });
    if (cam.dist < 260) { const c = cityUnderCamera(); if (c) parts.push({ name: c.name, go: () => focusCity(c) }); }
  }
  ui.setCrumb(parts);
}
// a national banner: one city → that city; several in one patch → the patch; otherwise frame them all
function flyToHub(g) {
  if (g.cities.length === 1) return focusCity(g.cities[0]);
  const P = patchById(g.cities[0].patch);
  if (P && g.cities.every((c) => c.patch === P.id)) { const ov = patchOverview(P); return cam.flyTo(ov.x, ov.z, ov.d, 1.8); }
  const xs = g.cities.map((c) => c.x), zs = g.cities.map((c) => c.z);
  cam.flyTo((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2, Math.min(FAR_D * 0.95, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 1.6 + 300), 1.8);
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
  setTimeout(() => { patches.forEach((pa, i) => { pa.revealT = -0.25 * i; if (pa.mid) growDistricts(pa); }); }, 1600);
}

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
  // a tab opened in the background can start at 0 × 0 and miss the resize event
  if (renderer.domElement.width !== Math.floor(innerWidth * renderer.getPixelRatio()) && innerWidth > 0) onResize();
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
  // country scale: only the paper, whole-patch terrain and national banners; shadow map frozen
  const isFar = cam.dist > FAR_D;
  if (isFar !== farOn) {
    farOn = isFar;
    for (const pa of patches) if (pa.mid) pa.mid.visible = !isFar;
    renderer.shadowMap.autoUpdate = !isFar; renderer.shadowMap.needsUpdate = true;
  }
  const deadline = performance.now() + 5;   // ms of this frame for building finer terrain chunks
  for (const pa of patches) {
    pa.terrain.update(camera, isFar, deadline);
    updatePatch(pa, dt, isFar);
  }
  dust.update(dt); beams.update(dt);
  dust.mat.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * 0.9;
  ui.update(camera, cam.dist, (c) => built.has(c.key));
  updateCrumb();
  paper.update(camera, renderer.domElement.height);
  if (post) { post.update(cam.dist); post.render(); } else renderer.render(scene, camera);
  paper.step();   // draw one missing paper tile per frame
}

function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  fitNational(); cam.maxD = NAT_VIEW.d * 1.12;
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);

init().catch((e) => { console.error(e); loadtip.textContent = '加载失败：' + e.message; });
