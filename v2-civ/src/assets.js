// Blender 烘焙的 GLB 建筑（assets-src/）。现代建筑：public/models/m_*.glb。
// P1 资产对比：?asset=old|a|b 把雷峰塔换成 GLB 版本（a = Blender 脚本建模，b = AI 图生 3D）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const v = new URLSearchParams(location.search).get('asset');
export const ASSET = v === 'a' || v === 'b' ? v : 'old';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let renderer = null;
// KTX2 (Basis Universal) textures stay compressed on the GPU: about a quarter of the memory of the same WebP decoded, and
// no mipmap generation on upload. The transcoder (wasm) is fetched only when the first KTX2 texture arrives.
const ktx2 = new KTX2Loader();
export function setRenderer(r) { renderer = r; ktx2.detectSupport(r); loader.setKTX2Loader(ktx2); }

// Upload a model's textures one per task: a 2048² texture with mipmaps costs tens of ms, and a city's worth landing
// in the first frame that draws them is a visible hitch. Resolves once every texture is on the GPU.
const uploadQ = []; let uploading = false;
function uploadTextures(root) {
  const texs = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) texs.add(m[k]);
  });
  if (!renderer || !texs.size) return Promise.resolve();
  return new Promise((res) => { uploadQ.push({ texs: [...texs], res }); pump(); });
}
function pump() {
  if (uploading) return;
  uploading = true;
  const step = () => {
    const job = uploadQ[0];
    if (!job) { uploading = false; return; }
    const t = job.texs.shift();
    if (t) renderer.initTexture(t); else { uploadQ.shift(); job.res(); }
    setTimeout(step, 0);
  };
  step();
}
const cache = new Map(); // 文件名 -> Promise<scene>：同一个模型只下载、解析一次，各处克隆（共享几何和材质）

function load(file) {
  if (!cache.has(file)) {
    cache.set(file, loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}.glb`).then((gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (m.map) m.map.anisotropy = 4;
        if (m.emissiveIntensity > 1) m.emissiveIntensity *= 1.2; // 灯笼、霓虹进辉光
        o.userData.noAO = true;   // AO is baked into the texture in Blender
      });
      return uploadTextures(gltf.scene).then(() => gltf.scene);
    }));
  }
  return cache.get(file);
}

// 先返回一个空组，加载完再把模型挂进去（位置、建城动画都作用在这个组上）。
export function modelSlot(file) {
  const slot = new THREE.Group();
  load(file).then((scene) => { slot.add(scene.clone()); slot.userData.loaded = true; })
    .catch((e) => console.warn(`[model] ${file}: ${e.message}`));
  return slot;
}

export const glbSlot = (name) => modelSlot(`${ASSET}_${name}`);
