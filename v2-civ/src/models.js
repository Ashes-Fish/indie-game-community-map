// District models. Every community has `model: { kind, ... }`; each kind registers a builder that
// returns a THREE.Group sitting on the hex centre with its base at y = 0. Flags, highlight and picking
// are added by places.js / main.js and do not depend on the model.
import * as THREE from 'three';
import { HEX_R } from './config.js';

// 用户自定义模型：接口已就绪，暂未开放（UI 上显示"敬请期待"）。?custommodels=1 可在本地打开调试。
export const FEATURES = { customModels: new URLSearchParams(location.search).has('custommodels') };

export const BUILTIN_STYLES = ['guild', 'tulou', 'cyber', 'observatory', 'paifang', 'savepoint', 'pinewood'];
export const STYLE_NAMES = {
  guild: '会馆戏台', tulou: '土楼', cyber: '赛博塔 · 咖啡馆', observatory: '观星台',
  paifang: '牌坊市街', savepoint: '存档亭', pinewood: '松林画室',
};

export const CUSTOM_LIMITS = { bytes: 2 * 1024 * 1024, triangles: 20000, texture: 1024, radius: HEX_R * 0.54 };

const KINDS = {};
export function registerModelKind(kind, build) { KINDS[kind] = build; }

export function buildModel(cm, ctx) {
  const m = cm.model || { kind: 'builtin', style: BUILTIN_STYLES[0] };
  return (KINDS[m.kind] || KINDS.builtin)(m, cm, ctx);
}

export function modelLabel(m) {
  if (!m || m.kind === 'builtin') return STYLE_NAMES[m?.style] || '内置造型';
  return '自定义模型';
}

// custom: show the fallback built-in look at once, swap in the uploaded .glb once it loads and validates
registerModelKind('custom', (m, cm, ctx) => {
  const holder = new THREE.Group();
  const fb = KINDS.builtin({ kind: 'builtin', style: m.fallback || BUILTIN_STYLES[0] }, cm, ctx);
  holder.add(fb);
  if (FEATURES.customModels && m.url) {
    loadCustom(m, ctx)
      .then((obj) => { holder.remove(fb); holder.add(obj); })
      .catch((e) => console.warn(`[model] ${cm.key}: ${e.message}, keeping fallback`));
  }
  return holder;
});

// Reads the JSON chunk of a binary glTF so external resources are rejected before anything is fetched.
function glbJson(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file');
  const len = dv.getUint32(12, true);
  if (dv.getUint32(16, true) !== 0x4e4f534a) throw new Error('missing glTF JSON chunk');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, len)));
}

async function loadCustom(m, ctx) {
  const res = await fetch(/^(https?:|blob:|data:)/.test(m.url) ? m.url : ctx.base + m.url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > CUSTOM_LIMITS.bytes) throw new Error(`file too large (${buf.byteLength} bytes)`);
  if (m.sha256) {
    const d = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (d !== m.sha256.toLowerCase()) throw new Error('sha256 mismatch');
  }
  const json = glbJson(buf);
  for (const r of [...(json.buffers || []), ...(json.images || [])]) {
    if (r.uri && !r.uri.startsWith('data:')) throw new Error('external resources are not allowed');
  }
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const root = (await new GLTFLoader().parseAsync(buf, '')).scene;

  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mt of mats) for (const k of ['map', 'normalMap', 'emissiveMap']) {
      const img = mt[k]?.image;
      if (img && Math.max(img.width, img.height) > CUSTOM_LIMITS.texture) throw new Error(`texture larger than ${CUSTOM_LIMITS.texture}px`);
    }
    // default: restyle to the site's flat low-poly look; keepTextures keeps the original materials
    if (!m.keepTextures) {
      o.material = mats.map((mt) => new THREE.MeshStandardMaterial({ color: mt.color || '#c9b48a', roughness: 0.85, flatShading: true }));
      if (o.material.length === 1) o.material = o.material[0];
    }
    o.castShadow = o.receiveShadow = true;
  });
  if (tris > CUSTOM_LIMITS.triangles) throw new Error(`${Math.round(tris)} triangles (limit ${CUSTOM_LIMITS.triangles})`);

  // fit inside one hex, base on the ground
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const k = CUSTOM_LIMITS.radius / (Math.hypot(size.x, size.z) / 2 || 1);
  root.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
  root.scale.setScalar(k);
  const g = new THREE.Group();
  g.add(root);
  return g;
}
