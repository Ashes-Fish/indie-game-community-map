// Ribbons draped on the terrain: thin rivers (canal, Huangpu…), roads, and the Ludere trade route with caravans.
import * as THREE from 'three';
import { GLSL_COMMON } from './glsl.js';
import { toWorld } from './config.js';
import { Builder, makeMaterials } from './kit.js';
import { fogPatch } from './props.js';

function smoothPath(pts, step) {
  const v = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / step));
  return { curve, pts: curve.getSpacedPoints(n), len };
}

// ribbon geometry along points; uv.x = distance (km), uv.y = 0..1 across
function ribbon(points, width, yOf, lift) {
  const pos = [], uv = [], idx = [];
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l, nz = tx / l;
    if (i > 0) acc += p.distanceTo(points[i - 1]);
    for (const s of [-1, 1]) {
      const x = p.x + nx * width * 0.5 * s, z = p.z + nz * width * 0.5 * s;
      pos.push(x, Math.max(yOf(x, z), yOf(p.x, p.z)) + lift, z);
      uv.push(acc, s < 0 ? 0 : 1);
    }
    if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function fogFade(mat, shared, body) {
  mat.customProgramCacheKey = () => 'fogFade:' + body;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec3 vRW;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${body}\n diffuseColor.a *= smoothstep(0.5, 0.62, fogField(vRW.xz));`);
  };
  return mat;
}

export function buildRivers(world, rivers, shared) {
  const group = new THREE.Group();
  const mat = fogFade(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), shared, `
    float across = abs(vUv.y - 0.5) * 2.0;
    float flow = 0.5 + 0.5 * sin(vUv.x * 2.2 - uTime * 2.4 + sin(vUv.y * 9.0) * 0.6);
    vec3 deep = vec3(0.03, 0.30, 0.50), shallow = vec3(0.10, 0.55, 0.62);
    diffuseColor.rgb = mix(deep, shallow, across * 0.8) + vec3(0.18, 0.22, 0.2) * smoothstep(0.82, 1.0, flow) * (1.0 - across);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.85, 0.75), smoothstep(0.72, 1.0, across) * 0.5);
    diffuseColor.a = 1.0 - smoothstep(0.82, 1.0, across);`);
  // ensure uv varying exists
  mat.defines = { USE_UV: '' };
  for (const r of rivers) {
    if (r.water) continue;
    const w = r.name === 'canal' ? 0.75 : r.name === 'Huangpu' ? 1.1 : 0.8;
    const { pts } = smoothPath(r.pts, 0.35);
    const keep = pts; // terrain is flat where these run
    const g = ribbon(keep, w, (x, z) => world.heightY(x, z), 0.07);
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 2; m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

export function buildRoads(world, cities, shared) {
  const C = Object.fromEntries(cities.map((c) => [c.id, [c.x, c.z]]));
  const W = (lo, la) => toWorld(lo, la);
  const routes = [
    [C.nanjing, W(119.15, 32.08), W(119.45, 32.05), W(119.7, 31.93), C.changzhou],
    [C.changzhou, W(120.3, 31.6), W(120.6, 31.33), W(121.0, 31.3), C.shanghai],
    [W(120.6, 31.33), W(120.7, 31.5), C.changshu],
    [W(120.6, 31.33), W(120.66, 31.0), W(120.75, 30.75), W(120.45, 30.55), C.hangzhou],
    [W(120.75, 30.75), W(121.1, 30.9), C.shanghai],
  ];
  const mat = fogFade(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }), shared, `
    float across = abs(vUv.y - 0.5) * 2.0;
    vec3 dirt = vec3(0.50, 0.38, 0.24);
    float stones = step(0.5, fract(vUv.x * 2.4 + step(0.5, vUv.y) * 0.5));
    diffuseColor.rgb = mix(dirt, dirt * 0.82, stones * (1.0 - across) * 0.6);
    diffuseColor.a = (1.0 - smoothstep(0.5, 1.0, across)) * 0.8;`);
  mat.defines = { USE_UV: '' };
  const group = new THREE.Group();
  for (const r of routes) {
    const { pts } = smoothPath(r, 0.5);
    const keep = pts.filter((p) => world.sdf(p.x, p.z) < -0.2);
    // split where the path leaves land
    let seg = [];
    const flush = () => { if (seg.length > 3) { const m = new THREE.Mesh(ribbon(seg, 0.3, (x, z) => world.heightY(x, z), 0.05), mat); m.renderOrder = 1; m.receiveShadow = true; group.add(m); } seg = []; };
    for (const p of pts) { if (world.sdf(p.x, p.z) < -0.25) seg.push(p); else flush(); }
    flush();
  }
  return group;
}

export function buildTrade(world, from, to, shared) {
  const pts = [[from.x, from.z], [from.x - 8, from.z - 9], ...[[121.1, 31.42], [120.9, 31.56]].map(([a, b]) => toWorld(a, b)), [to.x, to.z]];
  const { curve, pts: sp, len } = smoothPath(pts, 0.3);
  const yOf = (x, z) => world.heightY(x, z);
  const g = ribbon(sp, 0.55, yOf, 0.16);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: shared.uniforms.uTime, uLen: { value: len }, uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uLen; uniform float uA;
      void main(){ float across = abs(vUv.y - 0.5) * 2.0;
        float dash = step(0.45, fract(vUv.x * 0.9 - uTime * 0.9));
        float chev = 1.0 - smoothstep(0.0, 0.12, abs(fract(vUv.x * 0.45 - uTime * 0.45) - 0.5 - across * 0.18));
        vec3 gold = vec3(1.0, 0.78, 0.32);
        float a = (1.0 - smoothstep(0.55, 1.0, across)) * (0.35 + 0.65 * dash) + chev * 0.6;
        float endFade = smoothstep(0.0, 1.5, vUv.x) * smoothstep(0.0, 1.5, uLen - vUv.x);
        gl_FragColor = vec4(gold * (0.85 + chev * 0.6), a * 0.85 * uA * endFade); }`,
  });
  const line = new THREE.Mesh(g, mat);
  line.renderOrder = 3;
  // caravans: little covered carts with lanterns
  const mats = makeMaterials();
  const cart = () => {
    const b = new Builder();
    b.box(0.7, 0.32, 0.42, '#8a5a32', 0, 0.16, 0);
    b.roof(0.82, 0.55, 0.25, '#b5392e', 0, 0.48, 0, 0, { ridgeColor: '#d9a842', lift: 0.1 });
    for (const sx of [-0.22, 0.22]) for (const sz of [-0.24, 0.24]) b.geo(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 8).rotateX(Math.PI / 2), '#3b2a1e', sx, 0.13, sz);
    b.box(0.38, 0.3, 0.2, '#e8dcc6', 0.62, 0.16, 0); // ox / horse (abstract)
    b.box(0.14, 0.14, 0.16, '#e8dcc6', 0.84, 0.38, 0);
    b.sphere(0.08, '#ffcc66', -0.42, 0.62, 0, 'emis', 0);
    return b.build(mats);
  };
  const group = new THREE.Group();
  group.add(line);
  const carts = [];
  for (let k = 0; k < 3; k++) {
    const c = cart();
    c.scale.setScalar(2.1);
    group.add(c);
    carts.push({ obj: c, u: k / 3, dir: k % 2 ? 1 : -1, speed: 0.035 + k * 0.004 });
  }
  const tmp = new THREE.Vector3(), tan = new THREE.Vector3();
  return {
    group, mat,
    update(dt) {
      for (const c of carts) {
        c.u += c.dir * c.speed * dt;
        if (c.u > 1) { c.u = 1; c.dir = -1; } if (c.u < 0) { c.u = 0; c.dir = 1; }
        curve.getPointAt(c.u, tmp); curve.getTangentAt(c.u, tan);
        c.obj.position.set(tmp.x, yOf(tmp.x, tmp.z) + 0.05, tmp.z);
        c.obj.rotation.y = Math.atan2(-tan.z * c.dir, tan.x * c.dir);
        c.obj.visible = mat.uniforms.uA.value > 0.5;
      }
    },
  };
}

// little sampans drifting along the Grand Canal
export function buildBoats(world, canal) {
  const { curve } = smoothPath(canal.pts, 0.35);
  const mats = makeMaterials();
  const boat = () => {
    const b = new Builder();
    b.geo(new THREE.CylinderGeometry(0.16, 0.1, 0.9, 6, 1).rotateZ(Math.PI / 2).scale(1, 0.6, 1.3), '#7a5232', 0, 0.06, 0);
    // arched bamboo canopy (乌篷)
    b.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.38, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), '#2f3238', 0, 0.12, 0);
    b.sphere(0.04, '#ffcc66', 0.38, 0.18, 0, 'emis', 0);
    return b.build(mats);
  };
  const group = new THREE.Group();
  const list = [];
  for (let k = 0; k < 6; k++) {
    const o = boat(); o.scale.setScalar(1.6);
    group.add(o);
    list.push({ o, u: k / 6 + 0.03, sp: (0.004 + k * 0.0006) * (k % 2 ? 1 : -1) });
  }
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  return {
    group,
    update(dt) {
      for (const b of list) {
        b.u = (b.u + b.sp * dt + 1) % 1;
        curve.getPointAt(b.u, p); curve.getTangentAt(b.u, t);
        b.o.position.set(p.x, world.heightY(p.x, p.z) + 0.1, p.z);
        const dir = Math.sign(b.sp);
        b.o.rotation.y = Math.atan2(-t.z * dir, t.x * dir);
        b.o.visible = world.sdf(p.x, p.z) < 0.5;
      }
    },
  };
}
