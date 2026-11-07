// Small signs of life, all cheap: chimney smoke, bird flocks, walkers and ox carts on the roads,
// flickering lanterns and drifting cloud shadows on buildings.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_COMMON } from './glsl.js';
import { paint } from './kit.js';
import { rng } from './config.js';

// ---------- chimney smoke: one Points draw, particles animated entirely in the vertex shader ----------
export function buildSmoke(emitters, shared, Q) {
  const per = Q.mobile ? 4 : 6;
  const n = emitters.length * per;
  const E = new Float32Array(n * 4), K = new Float32Array(n);
  emitters.forEach((e, i) => { for (let k = 0; k < per; k++) { E.set([e.x, e.y, e.z, e.ph], (i * per + k) * 4); K[i * per + k] = k / per; } });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aE', new THREE.BufferAttribute(E, 4));
  g.setAttribute('aK', new THREE.BufferAttribute(K, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 500 }, uCamDist: shared.uniforms.uCamDist, uTime: shared.uniforms.uTime, uRevealB: shared.uniforms.uRevealB, uHex: shared.uniforms.uHex },
    vertexShader: `${GLSL_COMMON}
      attribute vec4 aE; attribute float aK; uniform float uScale; varying float vA; varying float vT;
      void main(){
        float t = fract(uTime * 0.085 + aE.w + aK);
        vec3 p = aE.xyz;
        p.y += t * 2.4;
        p.x += t * t * 1.7 + sin(t * 5.0 + aE.w * 30.0) * 0.12 * t;
        p.z -= t * t * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(0.3, 1.5, t) * uScale / -mv.z;
        vA = smoothstep(0.0, 0.1, t) * (1.0 - t) * (1.0 - smoothstep(120.0, 200.0, uCamDist)) * smoothstep(0.66, 0.82, fogField(aE.xz));
        vT = t;
      }`,
    fragmentShader: `varying float vA; varying float vT;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float a = smoothstep(0.5, 0.12, r) * vA * 0.62; if (a < 0.004) discard;
        vec3 c = mix(vec3(0.58, 0.58, 0.62), vec3(0.96, 0.95, 0.92), clamp(0.55 - d.y * 1.4 - d.x * 0.6, 0.0, 1.0));
        gl_FragColor = vec4(mix(c, vec3(0.9, 0.9, 0.9), vT * 0.5), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return { points: pts, mat };
}

// ---------- bird flocks: instanced V-formations circling over lakes and fields, wings flap in the vertex shader ----------
function birdGeo() {
  // body + two wings; aWing = 1 on wing tips (they flap), 0 on the body line
  const P = [
    0.16, 0, 0, -0.12, 0.012, 0.03, -0.12, 0.012, -0.03,     // body
    0.05, 0, 0, -0.07, 0, 0, -0.02, 0, 0.32,                 // left wing
    -0.07, 0, 0, 0.05, 0, 0, -0.02, 0, -0.32,                // right wing
  ];
  const W = [0, 0, 0, 0, 0, 1, 0, 0, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(W, 1));
  g.computeVertexNormals();
  return g;
}

export function buildBirds(world, centers, shared, Q) {
  const R = rng(99);
  const flocks = centers.slice(0, Q.mobile ? 3 : 6).map((c, i) => ({
    cx: c.x, cz: c.z, r: 9 + R() * 12, w: (0.06 + R() * 0.04) * (i % 2 ? 1 : -1), a0: R() * 6.28,
    y: world.heightY(c.x, c.z) + 6 + R() * 3, n: Q.mobile ? 5 : 5 + ((R() * 4) | 0),
  }));
  const total = flocks.reduce((s, f) => s + f.n, 0);
  const geo = birdGeo();
  const phase = new Float32Array(total);
  for (let i = 0; i < total; i++) phase[i] = R() * 6.28;
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.MeshBasicMaterial({ color: '#2a2e36', side: THREE.DoubleSide, fog: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uniforms.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; attribute float aWing; attribute float aPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float fa = sin(uTime * 11.0 + aPhase) * 0.75 + 0.15;
        float zz = transformed.z;
        transformed.y += abs(zz) * sin(fa) * aWing;
        transformed.z = mix(zz, sign(zz) * abs(zz) * cos(fa), aWing);`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  return {
    mesh,
    update(t, dist) {
      mesh.visible = dist < 260;
      if (!mesh.visible) return;
      const sc = THREE.MathUtils.clamp(dist / 70, 1, 2.2);   // read at a distance, stay small up close
      s.setScalar(sc);
      let k = 0;
      for (const f of flocks) {
        const a = f.a0 + t * f.w;
        const hx = -Math.sin(a) * Math.sign(f.w), hz = Math.cos(a) * Math.sign(f.w); // heading (tangent of the circle)
        const head = Math.atan2(-hz, hx);
        const cx = f.cx + Math.cos(a) * f.r, cz = f.cz + Math.sin(a) * f.r * 0.7;
        for (let i = 0; i < f.n; i++) {
          const side = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
          const back = Math.abs(side) * 0.55 * sc, lat = side * 0.5 * sc;
          const wob = Math.sin(t * 1.3 + i * 1.7) * 0.12 * sc;
          v.set(cx - hx * back - hz * lat + wob, f.y + Math.sin(t * 0.8 + i) * 0.25 + Math.abs(side) * 0.05, cz - hz * back + hx * lat);
          e.set(0, head, Math.sin(t * 0.7 + i) * 0.15); q.setFromEuler(e);
          m4.compose(v, q, s);
          mesh.setMatrixAt(k++, m4);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- walkers in straw hats and ox carts along the roads ----------
function walkerGeo() {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.05, 0.085, 0.2, 6).translate(0, 0.1, 0), '#ffffff'),   // robe (instance colour)
    paint(new THREE.SphereGeometry(0.045, 6, 4).translate(0, 0.245, 0), '#e9c9a0'),
    paint(new THREE.ConeGeometry(0.11, 0.06, 8).translate(0, 0.3, 0), '#d8b464'),             // 斗笠
  ]);
}
function cartGeo() {
  const wheel = (z) => paint(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 10).rotateX(Math.PI / 2).translate(-0.12, 0.1, z), '#4a3524');
  return mergeGeometries([
    paint(new THREE.BoxGeometry(0.36, 0.1, 0.24).translate(-0.12, 0.17, 0), '#9a6a3c'),     // cart bed
    paint(new THREE.BoxGeometry(0.3, 0.1, 0.2).translate(-0.12, 0.26, 0), '#d9c08a'),      // load (hay)
    wheel(0.13), wheel(-0.13),
    paint(new THREE.BoxGeometry(0.26, 0.13, 0.12).translate(0.22, 0.15, 0), '#6b4b32'),     // ox
    paint(new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(0.37, 0.17, 0), '#5a3e2a'),
    paint(new THREE.BoxGeometry(0.02, 0.05, 0.16).translate(0.37, 0.23, 0), '#efe6d2'),     // horns
    ...[[0.14, 0.04], [0.14, -0.04], [0.3, 0.04], [0.3, -0.04]].map(([x, z]) => paint(new THREE.BoxGeometry(0.03, 0.09, 0.03).translate(x, 0.045, z), '#5a3e2a')),
  ]);
}

export function buildWalkers(world, paths, Q) {
  const R = rng(321);
  const robes = ['#3b5f8a', '#6d4a3a', '#2f4f5f', '#8a3b32', '#5b6b3a', '#e8e0cc'];
  const items = [];
  for (const pts of paths) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const len = cum[cum.length - 1];
    if (len < 4) continue;
    const nw = Math.max(1, Math.round(len / (Q.mobile ? 22 : 12)));
    for (let k = 0; k < nw; k++) items.push({ pts, cum, len, s: R() * len, dir: R() < 0.5 ? 1 : -1, sp: 0.18 + R() * 0.12, cart: false, col: robes[(R() * robes.length) | 0], ph: R() * 6 });
    if (len > 15 && R() < 0.8) items.push({ pts, cum, len, s: R() * len, dir: R() < 0.5 ? 1 : -1, sp: 0.12, cart: true, ph: R() * 6 });
  }
  const ws = items.filter((i) => !i.cart), cs = items.filter((i) => i.cart);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const wm = new THREE.InstancedMesh(walkerGeo(), mat, ws.length);
  const cm = new THREE.InstancedMesh(cartGeo(), mat, Math.max(1, cs.length));
  const col = new THREE.Color();
  ws.forEach((w, i) => wm.setColorAt(i, col.set(w.col)));
  wm.castShadow = cm.castShadow = true;
  wm.frustumCulled = cm.frustumCulled = false;
  cm.count = cs.length;
  const group = new THREE.Group();
  group.add(wm, cm);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const at = (it) => {
    const { pts, cum } = it;
    let i = 1; while (i < cum.length - 1 && cum[i] < it.s) i++;
    const t = (it.s - cum[i - 1]) / Math.max(1e-4, cum[i] - cum[i - 1]);
    const a = pts[i - 1], b = pts[i];
    return [a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, Math.atan2(-(b.z - a.z) * it.dir, (b.x - a.x) * it.dir)];
  };
  return {
    group,
    update(dt, t, dist) {
      group.visible = dist < 180;
      if (!group.visible) return;
      const k = THREE.MathUtils.clamp(dist / 55, 1, 2.0);   // a little bigger when seen from further away
      const upd = (list, mesh, bob) => {
        list.forEach((it, i) => {
          it.s += it.dir * it.sp * dt;
          if (it.s > it.len) { it.s = it.len; it.dir = -1; } else if (it.s < 0) { it.s = 0; it.dir = 1; }
          const [x, z, ry] = at(it);
          v.set(x, world.heightY(x, z) + 0.06 + (bob ? Math.abs(Math.sin(t * 7 + it.ph)) * 0.025 : 0), z);
          e.set(0, ry, 0); q.setFromEuler(e); sc.setScalar(k);
          mesh.setMatrixAt(i, m4.compose(v, q, sc));
        });
        mesh.instanceMatrix.needsUpdate = true;
      };
      upd(ws, wm, true); upd(cs, cm, false);
    },
  };
}

// ---------- buildings: cloud shadows on lit materials, candle flicker on lanterns / windows ----------
export function livenBuildings(root, shared) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material || o.material.userData.livened) return;
    const m = o.material;
    m.userData.livened = true;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
    const basic = m.isMeshBasicMaterial;
    if (!basic && !m.isMeshStandardMaterial) return;
    m.customProgramCacheKey = () => `liven:${basic}:${prevKey}`;
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      Object.assign(sh.uniforms, { uTime: shared.uniforms.uTime, uRevealB: shared.uniforms.uRevealB, uHex: shared.uniforms.uHex, uCamDist: shared.uniforms.uCamDist });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vLW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vLW = (modelMatrix * vec4(transformed, 1.0)).xyz;
          #endif`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec3 vLW;`);
      if (basic) {
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float hs = hash12(floor(vLW.xz * 6.0) + floor(vLW.y * 6.0) * 7.1);
          float warm = step(diffuseColor.b * 1.35, diffuseColor.r);
          float candle = 0.84 + 0.16 * sin(uTime * (6.0 + hs * 5.0) + hs * 40.0) * sin(uTime * 2.1 + hs * 13.0);
          float blink = 1.0 - 0.55 * step(0.992, hash12(vec2(floor(uTime * 8.0), hs * 91.0)));
          diffuseColor.rgb *= mix(blink, candle, warm);`);
      } else {
        sh.fragmentShader = sh.fragmentShader.replace('#include <aomap_fragment>', `float cS = cloudShade(vLW.xz);
          reflectedLight.directDiffuse *= cS; reflectedLight.directSpecular *= cS;
          #include <aomap_fragment>`);
      }
    };
    m.needsUpdate = true;
  });
}
