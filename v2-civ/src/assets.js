// Blender 烘焙的 GLB 建筑（assets-src/）。现代建筑：public/models/m_*.glb。
// P1 资产对比：?asset=old|a|b 把雷峰塔换成 GLB 版本（a = Blender 脚本建模，b = AI 图生 3D）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const v = new URLSearchParams(location.search).get('asset');
export const ASSET = v === 'a' || v === 'b' ? v : 'old';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
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
      });
      return gltf.scene;
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
