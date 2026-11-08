// Cities (modern CBD skyline + landmarks) and community districts (one modern venue per community, with a logo flag).
// The buildings themselves are Blender-baked GLBs (assets-src/blender/modern.py → public/models/m_*.glb).
import * as THREE from 'three';
import { Builder, makeMaterials } from './kit.js';
import { rng } from './config.js';
import { ASSET, glbSlot, modelSlot } from './assets.js';
import { registerModelKind, buildModel, BUILTIN_STYLES } from './models.js';

const STYLE_KEYS = new Set(BUILTIN_STYLES);

// colours for the procedural landmarks (pagodas, gate)
const C = { roofD: '#2f353f', gold: '#d9a842', stone: '#b6aa94' };

// CBD variant per city tier; two looks for ordinary and big cities so neighbours don't match.
// top = roughly the tallest roof, so the city banner floats above the skyline.
const CBD = {
  cbd_town: 1.5, cbd_city_a: 2.9, cbd_city_b: 3.0, cbd_big_a: 5.4, cbd_big_b: 5.1, cbd_metro: 6.4,
};
function cityModel(city, i) {
  const r = city.radius || 2;
  if (r <= 1) return 'cbd_town';
  if (r >= 4) return 'cbd_metro';
  return (city.big || r >= 3 ? 'cbd_big_' : 'cbd_city_') + (i % 2 ? 'b' : 'a');
}
// half-width of the old walled city; landmarks are still placed relative to it, outside the CBD core
const cityHalf = (city) => (city.big ? 6.6 : 5.6) + Math.min(Math.max(0, (city.radius || 2) - 2), 2) * 0.6;

function landmark(b, city, L, R) {
  if (city.landmark === 'pearl') { // 东方明珠
    const x = L / 2 + 2.1, z = 0.6;
    b.cyl(0.9, 1.1, 0.25, 8, C.stone, x, 0, z);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.09, 0.12, 2.6, 6);
      g.rotateZ(0.32); g.rotateY(a); g.translate(x + Math.cos(a) * 0.45, 1.25, z - Math.sin(a) * 0.45);
      b.geo(g, '#e8e2dc');
    }
    b.cyl(0.13, 0.16, 5.4, 8, '#ede7df', x, 0, z);
    b.sphere(0.62, '#c8326a', x, 2.25, z, 'std', 1);
    b.sphere(0.42, '#c8326a', x, 4.25, z, 'std', 1);
    b.sphere(0.2, '#d24a7d', x, 5.5, z, 'std', 1);
    b.cyl(0.03, 0.05, 1.2, 5, '#e6e0d8', x, 5.6, z);
    for (const yy of [2.25, 4.25]) b.torus(0.64 * (yy < 3 ? 1 : 0.68), 0.03, '#ffe2a8', x, yy, z, Math.PI / 2, 0, 'emis');
    return [x, z];
  }
  if (city.landmark === 'tianning') { b.pagoda(9, 0.85, 0.42, '#c98a3a', C.roofD, L / 2 + 1.6, 0, -1.2, { spire: C.gold }); return; }
  if (city.landmark === 'fangta') { b.pagoda(7, 0.75, 0.4, '#d9cfbd', C.roofD, -L / 2 - 1.3, 0, 1.0, { spire: C.gold }); return; }
  if (city.landmark === 'gate') { // Nanjing 中华门: a massive stacked south gate
    b.box(2.6, 1.0, 1.4, '#8b8273', 0, 0, L / 2 + 0.35);
    b.box(2.0, 0.4, 1.0, '#8b8273', 0, 1.0, L / 2 + 0.35);
    for (const dx of [-0.6, 0, 0.6]) b.box(0.36, 0.55, 0.06, '#2f2620', dx, 0, L / 2 + 1.06);
    return;
  }
  if (city.landmark === 'leifeng') return; // built at West Lake separately
}

export function buildCities(world, cities, shared) {
  const mats = makeMaterials();
  const group = new THREE.Group();
  cities.forEach((city, i) => {
    const R = rng(100 + i * 31);
    const b = new Builder();
    landmark(b, city, cityHalf(city), R);
    const g = b.build(mats);
    const model = cityModel(city, i);
    g.add(modelSlot('m_' + model));
    city.top = Math.max(5.2, CBD[model] + 1.0);
    g.position.set(city.x, city.y - 0.02, city.z);
    city.group = g;
    group.add(g);
  });
  return { group, mats };
}

// ---- West Lake extras: Leifeng pagoda, Su causeway, Broken bridge ----
export function buildWestLake(world, rivers) {
  const mats = makeMaterials();
  const pts = rivers.westLake; // polygon
  let cx = 0, cz = 0; for (const [x, z] of pts) { cx += x; cz += z; } cx /= pts.length; cz /= pts.length;
  const b = new Builder();
  // Su causeway: a green strip with willows crossing north-south on the west side
  const y0 = world.heightY(cx, cz) + 0.02;
  const g = new THREE.BoxGeometry(0.18, 0.1, 5.4);
  b.geo(g, '#6aa040', cx - 0.7, y0, cz, 0.15);
  for (let k = -5; k <= 5; k++) {
    b.sphere(0.16, '#7fbf4a', cx - 0.7 + Math.sin(0.15) * k * 0.45, y0 + 0.2, cz + k * 0.45, 'std', 0);
  }
  // Leifeng pagoda on the south shore hill
  const px = cx + 1.2, pz = cz + 3.9;
  const py = world.heightY(px, pz);
  if (ASSET === 'old') b.pagoda(5, 0.9, 0.5, '#b5652e', C.roofD, px, py, pz, { round: true, spire: C.gold, plinthColor: C.stone });
  const grp = b.build(mats);
  if (ASSET !== 'old') { const t = glbSlot('leifeng'); t.position.set(px, py - 0.05, pz); grp.add(t); }
  return grp;
}

// ---- districts ----
function makeFlagTexture(cm, color, img) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 170;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 170);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 150, 256, 20);
  g.strokeStyle = '#f2cf72'; g.lineWidth = 8; g.strokeRect(6, 6, 244, 158);
  g.fillStyle = '#f7eedb';
  const S = 120, x = 128 - S / 2, y = 85 - S / 2;
  g.beginPath(); g.roundRect(x - 4, y - 4, S + 8, S + 8, 16); g.fill();
  if (img) {
    g.save(); g.beginPath(); g.roundRect(x, y, S, S, 12); g.clip(); g.drawImage(img, x, y, S, S); g.restore();
  } else {
    g.fillStyle = '#1b2a48'; g.beginPath(); g.roundRect(x, y, S, S, 12); g.fill();
    g.fillStyle = '#f2cf72'; g.font = '700 84px "Songti SC","STSong","Noto Serif SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(cm.glyph || '社', 128, 90);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, canvas: c };
}

export function makeFlag(cm, color, img, shared) {
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 6).translate(0, 2.3, 0), new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.6 }));
  pole.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6).translate(0, 4.66, 0), new THREE.MeshStandardMaterial({ color: '#e0b04a', metalness: 0.6, roughness: 0.3 }));
  const { tex } = makeFlagTexture(cm, color, img);
  const geo = new THREE.PlaneGeometry(2.4, 1.6, 16, 6).translate(1.2, 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fx = position.x / 2.4;
        transformed.z += sin(position.x * 3.2 - uTime * 4.2) * 0.13 * fx + sin(position.x * 5.1 - uTime * 6.3 + position.y * 2.0) * 0.04 * fx;
        transformed.y -= fx * fx * 0.08;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float fx0 = position.x / 2.4;
        objectNormal = normalize(vec3(-cos(position.x * 3.2 - uTime * 4.2) * 0.42 * fx0, 0.0, 1.0));`);
  };
  const cloth = new THREE.Mesh(geo, mat);
  cloth.position.set(0.06, 3.7, 0);
  cloth.castShadow = true;
  grp.add(pole, knob, cloth);
  return grp;
}

// built-in looks are modern venues baked in Blender; the base stays aligned to the hex grid, facing south
registerModelKind('builtin', (m) => modelSlot('m_' + (STYLE_KEYS.has(m.style) ? m.style : 'guild')));

// flag spots around a district hex: the first is the site's own flag, the rest are for cluster members
const FLAG_SPOTS = [[2.7, 2.0, -0.35], [-2.8, 1.9, 0.35], [2.6, -2.3, -0.6], [-2.6, -2.3, 0.6]];

export function buildDistricts(world, sites, cities, shared, logos, base) {
  const group = new THREE.Group();
  for (const site of sites) {
    const city = cities.find((c) => c.id === site.cityId);
    const [lead] = site.members;
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(buildModel(lead, { base }));
    holder.add(inner);
    site.members.forEach((cm, i) => {
      const [fx, fz, fr] = FLAG_SPOTS[i % FLAG_SPOTS.length];
      const flag = makeFlag(cm, city.color, logos[cm.logo], shared);
      // cluster members' flags sit in a smaller wrapper so the intro can still animate flag.scale
      const node = i ? new THREE.Group().add(flag) : flag;
      if (i) node.scale.setScalar(0.82);
      node.position.set(fx, 0, fz);
      node.rotation.y = fr;
      node.visible = i < FLAG_SPOTS.length; // beyond four the panel lists them
      holder.add(node);
      cm.group = holder; cm.inner = inner; cm.flag = flag;
    });
    holder.position.set(site.x, world.heightY(site.x, site.z) - 0.02, site.z);
    site.group = holder; site.inner = inner;
    group.add(holder);
  }
  return group;
}
