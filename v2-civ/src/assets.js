// P1 资产对比：?asset=old|a|b 把雷峰塔和 Ludere 会馆换成 GLB 版本（a = Blender 脚本建模，b = AI 图生 3D）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const v = new URLSearchParams(location.search).get('asset');
export const ASSET = v === 'a' || v === 'b' ? v : 'old';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// 先返回一个空组，加载完再把模型挂进去（位置、建城动画都作用在这个组上）。
export function glbSlot(name) {
  const slot = new THREE.Group();
  loader.load(`${import.meta.env.BASE_URL}models/${ASSET}_${name}.glb`, (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const m = o.material;
      if (m.map) m.map.anisotropy = 4;
      if (m.emissiveIntensity > 1) m.emissiveIntensity *= 1.2; // 灯笼进辉光
    });
    slot.add(gltf.scene);
    slot.userData.loaded = true;
  });
  return slot;
}
