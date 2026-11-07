// Civ-style cumulus puffs along the fog-of-war edge, plus an intro cloud bank that parts as the map is revealed.
// One instanced billboard draw; all motion in the vertex shader.
import * as THREE from 'three';
import { HEX_DIRS, HEX_R, hexIndex, rng } from './config.js';

// 2×2 atlas of soft cumulus heaps, lit from the upper left, painted once on a canvas (no download)
function cloudAtlas() {
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S * 2;
  const g = c.getContext('2d');
  const R = rng(5);
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * S, oy = (k >> 1) * S;
    // a mound of overlapping balls: wide flat base, rounded crown
    const lobes = [];
    const n = 9 + k * 2;
    for (let i = 0; i < n; i++) {
      const t = (R() - 0.5) * 2;                       // −1..1 across
      const crown = 1 - t * t;                         // taller in the middle
      const r = S * (0.075 + 0.085 * crown + R() * 0.035);
      lobes.push([ox + S / 2 + t * S * 0.3, oy + S * 0.7 - crown * S * 0.2 - R() * S * 0.06, r]);
    }
    lobes.sort((a, b) => b[1] - a[1]);
    g.save();
    g.beginPath(); g.rect(ox, oy, S, S); g.clip();
    g.translate(0, 0);
    // shadowed body
    g.filter = 'blur(3px)';
    g.fillStyle = '#aab6c8';
    g.beginPath(); for (const [x, y, r] of lobes) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); } g.fill();
    g.fillRect(ox + S * 0.2, oy + S * 0.62, S * 0.6, S * 0.1);
    g.filter = 'blur(1.5px)';
    g.globalCompositeOperation = 'source-atop';
    // sunlit caps, each lobe offset towards the light
    for (const [x, y, r] of lobes) {
      const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.05, x - r * 0.25, y - r * 0.3, r * 1.0);
      gr.addColorStop(0, 'rgba(255,255,253,1)'); gr.addColorStop(0.5, 'rgba(250,247,240,0.95)'); gr.addColorStop(1, 'rgba(236,236,238,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x - r * 0.15, y - r * 0.2, r, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    const bg = g.createLinearGradient(0, oy + S * 0.45, 0, oy + S * 0.74);
    bg.addColorStop(0, 'rgba(110,128,160,0)'); bg.addColorStop(1, 'rgba(110,128,160,0.5)');
    g.fillStyle = bg; g.fillRect(ox, oy, S, S);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec4 iP;   // size, atlas cell, reveal threshold, kind (0 edge, 1 intro)
attribute vec3 iD;   // drift dir xz, seed
uniform float uRevealB, uTime, uCamDist;
varying vec2 vUv; varying float vA;
#include <common>
#include <fog_pars_vertex>
void main(){
  float size = iP.x * clamp(uCamDist / 170.0, 0.45, 1.0) * max(1.0, uCamDist / 560.0), kind = iP.w;   // smaller up close, bigger on the far phone overview
  vec3 c = iPos;
  c.x += sin(uTime * 0.045 + iD.z * 6.28) * 1.6;
  c.y += sin(uTime * 0.27 + iD.z * 20.0) * 0.18;
  float a;
  if (kind < 0.5) {            // edge cloud: billows up as the reveal front reaches its border
    float k = smoothstep(iP.z - 26.0, iP.z + 2.0, uRevealB);
    a = k; size *= 0.55 + 0.45 * k;
  } else {                     // intro cloud: parts and blows outward once its spot is revealed
    float k = smoothstep(iP.z - 8.0, iP.z + 16.0, uRevealB);
    a = 1.0 - k; c.xz += iD.xy * k * 30.0; c.y += k * 4.0; size *= 1.0 + 0.5 * k;
  }
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  a *= smoothstep(size * 0.7, size * 2.2, -mv.z);   // thin out when the camera dives into them
  mv.xy += position.xy * size * vec2(1.0, 0.72);
  gl_Position = projectionMatrix * mv;
  float cell = iP.y;
  vUv = vec2(uv.x * 0.5 + mod(cell, 2.0) * 0.5, uv.y * 0.5 + (1.0 - floor(cell / 2.0)) * 0.5);
  vA = a;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */`
uniform sampler2D uTex; uniform vec3 uTint;
varying vec2 vUv; varying float vA;
#include <common>
#include <fog_pars_fragment>
void main(){
  vec4 t = texture2D(uTex, vUv);
  float a = t.a * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(t.rgb * uTint, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildClouds(world, cities, shared, Q) {
  const R = rng(4242);
  const edge = [], intro = [];
  const H = world.hex;
  const nearestCity = (x, z) => { let b = cities[0], bd = 1e9; for (const c of cities) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; b = c; } } return b; };
  for (const h of H) {
    if (h.orderKm < 0) {
      // intro bank over the land that will be revealed
      if (R() < (Q.mobile ? 0.35 : 0.6)) {
        const c = nearestCity(h.cx, h.cz);
        let dx = h.cx - c.x, dz = h.cz - c.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        intro.push([h.cx + (R() - 0.5) * HEX_R, 5 + R() * 4, h.cz + (R() - 0.5) * HEX_R, (Q.mobile ? 30 : 24) + R() * 8, (R() * 4) | 0, h.order, 1, dx + (R() - 0.5) * 0.6, dz + (R() - 0.5) * 0.6, R()]);
      }
      continue;
    }
    // edge ring: unrevealed hexes touching revealed land; puffs pushed outward, away from the land
    let thr = 1e9, ring = 0, ox = 0, oz = 0;
    for (const [dq, dr] of HEX_DIRS) {
      const j = hexIndex(h.q + dq, h.r + dr);
      if (j >= 0 && H[j].orderKm < 0) { thr = Math.min(thr, H[j].order); ring++; ox += h.cx - H[j].cx; oz += h.cz - H[j].cz; }
    }
    if (!ring) {
      let near = false;
      for (const [dq, dr] of HEX_DIRS) { const j = hexIndex(h.q + dq, h.r + dr); if (j >= 0 && H[j].orderKm >= 0 && H[j].orderKm < 4) near = true; }
      if (!near || R() > (Q.mobile ? 0.12 : 0.28)) continue;
      thr = h.order - 8;
    } else if (R() < (Q.mobile ? 0.35 : 0.15)) continue;
    const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
    const push = ring ? HEX_R * (0.35 + R() * 0.4) : 0;
    edge.push([h.cx + ox * push + (R() - 0.5) * HEX_R * 0.8, (ring ? 2.5 : 4) + R() * 2.5, h.cz + oz * push + (R() - 0.5) * HEX_R * 0.6,
      (ring ? 13 : 22) + R() * (ring ? 16 : 10) + (Q.mobile ? 4 : 0), (R() * 4) | 0, thr, 0, 0, 0, R()]);
  }
  // back-to-front for a camera that always looks north (−z): far (small z) first; edge clouds before the intro bank
  edge.sort((a, b) => a[2] - b[2]); intro.sort((a, b) => a[2] - b[2]);
  const all = [...edge, ...intro];
  const N = all.length;
  const pos = new Float32Array(N * 3), P = new Float32Array(N * 4), D = new Float32Array(N * 3);
  all.forEach((c, i) => {
    pos.set([c[0], c[1], c[2]], i * 3);
    P.set([c[3], c[4], c[5], c[6]], i * 4);
    D.set([c[7], c[8], c[9]], i * 3);
  });
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('iP', new THREE.InstancedBufferAttribute(P, 4));
  g.setAttribute('iD', new THREE.InstancedBufferAttribute(D, 3));
  g.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: null }, uTint: { value: new THREE.Color(0.93, 0.92, 0.9) } }]),
  });
  mat.uniforms.uTex.value = cloudAtlas();
  mat.uniforms.uRevealB = shared.uniforms.uRevealB;
  mat.uniforms.uTime = shared.uniforms.uTime;
  mat.uniforms.uCamDist = shared.uniforms.uCamDist;
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  return {
    mesh, counts: { edge: edge.length, intro: intro.length },
    // the intro bank is only drawn while the reveal is running
    update(revealB, final) { g.instanceCount = revealB < final - 0.5 ? N : edge.length; },
  };
}
