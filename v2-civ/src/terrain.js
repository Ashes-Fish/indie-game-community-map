import * as THREE from 'three';
import { XMIN, XMAX, ZMIN, ZMAX, EXAG, EXP } from './config.js';
import { GLSL_COMMON } from './glsl.js';

const S = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };

const FRAG_PARS = /* glsl */`
${GLSL_COMMON}
uniform sampler2D uWater;
uniform sampler2D uNormalTex;
uniform sampler2D uInk;
uniform float uCamDist;
uniform vec3 uOwnCol[8];
uniform vec3 uOwnCol2[8];
uniform vec2 uHiHex;
uniform float uHi;
uniform float uGrid;
varying vec3 vWP;
varying float vLift;
varying float vH0;
#define EXAG ${EXAG.toFixed(3)}
#define EXPO ${EXP.toFixed(3)}
const vec3 C_OCEAN = ${S('#0e4a84')};
const vec3 C_COAST = ${S('#1fb2ba')};
const vec3 C_LAKE  = ${S('#1f9fb0')};
const vec3 C_GRASS = ${S('#6c9c2a')};
const vec3 C_PLAIN = ${S('#a19c3a')};
const vec3 C_FARM  = ${S('#7aa334')};
const vec3 C_WOOD  = ${S('#58892a')};
const vec3 C_HILL  = ${S('#487326')};
const vec3 C_MOUNT = ${S('#5f7040')};
const vec3 C_MARSH = ${S('#5b8b4b')};
const vec3 C_URBAN = ${S('#8d8466')};
const vec3 C_DIST  = ${S('#a39674')};
const vec3 C_SAND  = ${S('#dccb8a')};
const vec3 C_ROCK  = ${S('#7d766a')};
const vec3 C_PAPER = ${S('#e4d0a4')};

vec3 biomeCol(float id, float rn){
  vec3 c;
  if (id < 0.5) c = C_OCEAN; else if (id < 1.5) c = C_COAST; else if (id < 2.5) c = C_LAKE;
  else if (id < 3.5) c = C_GRASS; else if (id < 4.5) c = C_PLAIN; else if (id < 5.5) c = C_FARM;
  else if (id < 6.5) c = C_WOOD; else if (id < 7.5) c = C_HILL; else if (id < 8.5) c = C_MOUNT;
  else if (id < 9.5) c = C_MARSH; else if (id < 10.5) c = C_URBAN; else c = C_DIST;
  return c * (0.92 + 0.16 * rn);
}

vec3 farmPattern(vec2 p, vec2 hc, float seed, float fw, out float wet){
  float ang = seed * 3.1416;
  float cs = cos(ang), sn = sin(ang);
  vec2 lp = mat2(cs, -sn, sn, cs) * (p - hc);
  lp += (vec2(vnoise(p * 0.45 + 3.0), vnoise(p * 0.45 + 9.0)) - 0.5) * 0.9;
  vec2 cell = vec2(1.9, 1.15);
  vec2 g = lp / cell; vec2 id = floor(g); vec2 f = fract(g);
  float h = hash12(id + seed * 91.0);
  vec3 c;
  if (h < 0.30) c = ${S('#6f9f27')}; else if (h < 0.50) c = ${S('#98ac2e')};
  else if (h < 0.62) c = ${S('#d9b43a')}; else if (h < 0.70) c = ${S('#e9cf2b')};
  else if (h < 0.84) c = ${S('#5e9330')}; else c = ${S('#5fa39a')};
  wet = step(0.84, h);
  float detail = 1.0 - smoothstep(0.06, 0.2, fw);
  float furrow = 0.5 + 0.5 * sin(f.y * cell.y * 30.0 + h * 6.0);
  c *= 1.0 - 0.12 * furrow * detail * (1.0 - wet);
  vec2 e = min(f, 1.0 - f) * cell; float dike = min(e.x, e.y);
  float dk = 1.0 - smoothstep(0.05, 0.05 + max(fw, 0.02) * 1.2, dike);
  c = mix(c, ${S('#7d8a3c')}, dk * 0.9 * (1.0 - smoothstep(0.12, 0.3, fw)));
  vec3 avg = ${S('#88a634')};
  return mix(avg, c, 1.0 - smoothstep(0.1, 0.28, fw));
}
`;

const FRAG_MAIN = /* glsl */`
  vec2 p = vWP.xz;
  vec2 fwv = fwidth(p); float fw = max(max(fwv.x, fwv.y), 1e-4);
  vec2 uvH = vec2((p.x - WXMIN) / WXSPAN, (p.y - WZMIN) / WZSPAN);
  vec4 wt = texture2D(uWater, uvH);
  float sdf = (wt.r * 255.0 - 128.0) / 10.0;
  float seaF = smoothstep(0.3, 0.7, wt.g);
  vec3 nT = normalize(texture2D(uNormalTex, uvH).xyz * 2.0 - 1.0);
  float hM = vH0 > 0.0 ? 1000.0 * pow(vH0 / EXAG, 1.0 / EXPO) : 0.0;

  // ---- hex lookup ----
  vec2 ha = hexRound(hexAxial(p)); vec2 hc = hexCenter(ha); vec2 lp = p - hc;
  vec4 d0 = hexData(ha);
  vec4 dn[6];
  float edgeD = 1e3;
  for (int i = 0; i < 6; i++) { dn[i] = hexData(ha + HD[i]); edgeD = min(edgeD, APO - dot(lp, HN[i])); }
  float own = floor(d0.r * 255.0 + 0.5);

  // ---- biome blend ----
  vec2 pb = p + (vec2(vnoise(p * 0.21), vnoise(p * 0.21 + 19.1)) - 0.5) * 6.0 + (vec2(vnoise(p * 0.7 + 5.0), vnoise(p * 0.7 + 41.0)) - 0.5) * 1.6;
  vec3 bc = vec3(0.0); float bw = 0.0, oceanW = 0.0;
  vec2 hb = hexRound(hexAxial(pb));
  for (int i = 0; i < 7; i++) {
    vec2 na = i == 6 ? hb : hb + HD[i];
    vec4 dd = hexData(na);
    float id = floor(dd.r * 255.0 + 0.5);
    float w = max(0.0, 1.0 - length(pb - hexCenter(na)) / 12.9); w = w * w * (1.0 + w);
    bc += w * biomeCol(id, hash12(na * 1.37 + 0.5));
    oceanW += w * (id < 0.5 ? 1.0 : 0.0);
    bw += w;
  }
  bc /= max(bw, 1e-4); oceanW /= max(bw, 1e-4);

  float slope = clamp(1.0 - nT.y, 0.0, 1.0);
  float m1 = fbm3(p * 0.85), m2 = vnoise(p * 4.5);
  float detail = 1.0 - smoothstep(0.08, 0.3, fw);
  vec3 col = bc * (0.9 + 0.16 * m1 * (0.5 + 0.5 * detail) + 0.1 * (m2 - 0.5) * detail);
  col = mix(col, col * vec3(0.86, 0.94, 0.86), smoothstep(80.0, 600.0, hM));
  // close-up grass brush strokes and tiny wildflowers
  float closeD = 1.0 - smoothstep(0.03, 0.09, fw);
  if (closeD > 0.001 && own > 2.5 && own < 9.5) {
    float strokes = vnoise(vec2(p.x * 7.0 + p.y * 2.0, p.y * 2.6 - p.x * 0.8));
    col *= 1.0 + (strokes - 0.5) * 0.16 * closeD;
    vec2 fc = floor(p * 5.0); vec2 ff = fract(p * 5.0) - 0.5;
    float fl = step(0.965, hash12(fc + 7.7)) * (1.0 - smoothstep(0.06, 0.12, length(ff - (vec2(hash12(fc + 1.3), hash12(fc + 2.9)) - 0.5) * 0.6)));
    col = mix(col, hash12(fc + 4.1) < 0.5 ? vec3(0.95, 0.92, 0.8) : vec3(0.95, 0.75, 0.2), fl * closeD * 0.8 * step(own, 4.5));
  }
  float rock = smoothstep(0.3, 0.6, slope + (m1 - 0.5) * 0.25) * smoothstep(250.0, 700.0, hM);
  col = mix(col, C_ROCK * (0.82 + 0.3 * m2), rock * 0.85);
  col = mix(col, C_ROCK * 1.18, smoothstep(950.0, 1500.0, hM) * 0.55);
  float rough = 0.9, wet = 0.0;

  // farmland
  if (abs(own - 5.0) < 0.5) {
    float fade = smoothstep(0.42, 0.6, vnoise(p * 0.22 + ha * 3.7) * 0.75 + edgeD / APO * 0.55) * smoothstep(0.25, 0.9, -sdf);
    float w2; vec3 fc = farmPattern(p, hc, hash12(ha + 3.1), fw, w2);
    col = mix(col, fc, fade);
    wet = w2 * fade;
  }
  // city / district ground
  if (own > 9.5) {
    float r = length(lp);
    vec3 pave = own > 10.5 ? C_DIST : C_URBAN;
    col = mix(col, pave * (0.9 + 0.15 * m2), smoothstep(5.0, 3.0, r + (m1 - 0.5) * 2.0) * 0.85);
  }
  // shores
  float beach = (1.0 - smoothstep(0.05, 0.42 + fw, -sdf + (m2 - 0.5) * 0.15)) * seaF;
  col = mix(col, C_SAND * (0.95 + 0.1 * m2), beach);
  float bank = (1.0 - smoothstep(0.0, 0.32 + fw, -sdf)) * (1.0 - seaF);
  col = mix(col, col * vec3(0.78, 0.86, 0.72), bank * 0.6);

  col = mix(col, col * 0.78, wet * 0.35);
  rough = mix(rough, 0.32, wet);

  // ---- water ----
  float aa = fw * 0.8;
  float wm = smoothstep(-aa, aa, sdf);
  float deep = clamp(max(smoothstep(0.6, 10.0, sdf) * 0.7, oceanW * smoothstep(0.5, 3.0, sdf)), 0.0, 1.0) * seaF;
  vec3 wc = mix(C_COAST, C_OCEAN, deep);
  vec3 lakeC = mix(C_LAKE, C_LAKE * vec3(0.7, 0.85, 0.95), smoothstep(0.5, 9.0, sdf));
  wc = mix(lakeC, wc, seaF);
  wc = mix(wc, wc * 1.18 + vec3(0.03, 0.06, 0.05), (1.0 - smoothstep(0.0, 1.4, sdf)));
  wc *= 0.94 + 0.12 * fbm3(p * 0.25 + vec2(uTime * 0.02, 0.0));
  float band = fract(sdf * 0.95 - uTime * 0.16);
  float waveL = smoothstep(0.0, 0.05, band) * (1.0 - smoothstep(0.05, 0.13, band));
  float waveMask = (1.0 - smoothstep(0.25, 2.6, sdf)) * smoothstep(0.4, 0.75, vnoise(p * 0.7 + vec2(uTime * 0.04, 0.0)));
  float foamShore = 1.0 - smoothstep(0.0, 0.16 + fw * 1.5, sdf - 0.05 * sin(uTime * 1.3 + p.x * 0.9));
  float lineVis = 1.0 - smoothstep(0.08, 0.3, fw);
  float foam = max(waveL * waveMask * 0.8 * lineVis * mix(0.35, 1.0, seaF), foamShore * mix(0.3, 0.9, seaF));
  wc = mix(wc, vec3(0.93, 0.97, 0.96), foam);
  vec2 wq = p * 1.4 + vec2(uTime * 0.11, uTime * 0.07);
  float n0 = vnoise(wq), nx = vnoise(wq + vec2(0.08, 0.0)), nz = vnoise(wq + vec2(0.0, 0.08));
  vec2 wq2 = p * 4.2 - vec2(uTime * 0.21, -uTime * 0.15);
  float k0 = vnoise(wq2), kx = vnoise(wq2 + vec2(0.06, 0.0)), kz = vnoise(wq2 + vec2(0.0, 0.06));
  vec3 wn = normalize(vec3(-(nx - n0) * 1.1 - (kx - k0) * 0.6, 1.0, -(nz - n0) * 1.1 - (kz - k0) * 0.6));
  vec2 spc = floor(p * 5.0); float sparkle = step(0.9975, hash12(spc + floor(uTime * 2.0 + hash12(spc) * 7.0) * 0.37)) * (1.0 - smoothstep(0.08, 0.25, fw)) * smoothstep(1.0, 3.0, sdf) * seaF;
  col = mix(col, wc, wm);
  rough = mix(rough, 0.16, wm * (1.0 - foam));
  vec3 nS = normalize(mix(nT, wn, wm));
  vec3 emis = vec3(1.0, 0.95, 0.8) * sparkle * wm * 1.2;

  // ---- grid ----
  float gw = 0.045 + fw * 0.45;
  float gl = 1.0 - smoothstep(gw, gw + fw * 1.3, edgeD);
  float gridA = uGrid * (1.0 - 0.6 * smoothstep(200.0, 420.0, uCamDist));
  col = mix(col, mix(col * 0.55, col * 1.1 + 0.025, wm), gl * gridA * (1.0 - 0.35 * wm));

  // ---- territory borders ----
  float ownI = floor(d0.g * 255.0 + 0.5);
  if (ownI > 0.5) {
    float bd = 1e3;
    for (int i = 0; i < 6; i++) { float oi = floor(dn[i].g * 255.0 + 0.5); if (abs(oi - ownI) > 0.5) bd = min(bd, APO - dot(lp, HN[i])); }
    vec3 oc = uOwnCol[int(ownI)], oc2 = uOwnCol2[int(ownI)];
    float bwid = 0.36 + fw * 1.5;
    float solid = 1.0 - smoothstep(bwid, bwid + fw * 1.4, bd);
    float inner = (1.0 - smoothstep(0.0, 3.2, bd)) * 0.5 * (0.7 + 0.3 * (1.0 - wm));
    float trim = (1.0 - smoothstep(0.06, 0.06 + fw * 1.3, abs(bd - bwid - 0.16))) * (1.0 - smoothstep(0.2, 0.5, fw));
    col = mix(col, oc, inner * inner * 1.4);
    col = mix(col, oc, solid);
    col = mix(col, oc2, trim * 0.9);
    emis += oc * solid * 0.18;
  }
  // ---- hover highlight ----
  if (uHi > 0.001 && length(ha - uHiHex) < 0.1) {
    float e = 1.0 - smoothstep(0.15, 0.55 + fw * 1.5, edgeD);
    float pulse = 0.7 + 0.3 * sin(uTime * 3.0);
    col = mix(col, ${S('#ffd978')}, e * 0.8 * uHi);
    col *= 1.0 + 0.08 * uHi;
    emis += ${S('#ffb733')} * e * 0.35 * pulse * uHi;
  }

  // ---- fog of war: paper map ----
  float ff = fogField(p);
  float edgeN = (fbm3(p * 0.55) - 0.5) * 0.26 + (vnoise(p * 2.6) - 0.5) * 0.07;
  float fv = ff + edgeN;
  float rev = smoothstep(0.475, 0.525, fv);
  vec3 pap = C_PAPER;
  pap *= 0.9 + 0.13 * fbm3(p * 0.03 + 7.0);
  pap = mix(pap, pap * vec3(0.93, 0.85, 0.7), smoothstep(0.58, 0.85, fbm3(p * 0.018 + 3.0)) * 0.7);
  pap *= 0.97 + 0.06 * vnoise(p * vec2(5.0, 1.3)) * detail + 0.03 * (vnoise(p * 1.7) - 0.5);
  float sdA = abs(sdf);
  float inkW = 0.07 + fw * 0.6;
  float coastInk = 1.0 - smoothstep(inkW, inkW + fw * 1.4, sdA);
  float rip = 0.0;
  for (int k = 1; k <= 3; k++) { float off = float(k) * 0.8; rip += (1.0 - smoothstep(0.035 + fw * 0.4, 0.035 + fw * 1.8, abs(sdf - off))) * (1.0 - float(k) * 0.24); }
  rip *= step(0.0, sdf);
  float row = floor(p.y / 1.9);
  float yy = p.y - row * 1.9 - 0.95;
  float cur = 0.33 * sin(p.x * 1.7 + row * 2.3) + 0.12 * sin(p.x * 4.1 + row);
  float wv = (1.0 - smoothstep(0.03 + fw * 0.4, 0.03 + fw * 1.8, abs(yy - cur))) * smoothstep(3.2, 5.0, sdf) * step(0.42, vnoise(vec2(p.x * 0.16, row * 0.71)));
  wv *= 1.0 - smoothstep(0.25, 0.6, fw);
  pap = mix(pap, pap * vec3(0.84, 0.9, 0.93), smoothstep(-0.1, 0.5, sdf) * 0.6);
  pap = mix(pap, ${S('#4c5a62')}, clamp(rip * 0.42 + wv * 0.38, 0.0, 1.0));
  pap = mix(pap, ${S('#2b2219')}, coastInk * 0.82);
  vec4 ink = texture2D(uInk, uvH);
  pap = mix(pap, ink.rgb, ink.a);
  float burn = smoothstep(0.18, 0.475, fv) * (1.0 - rev);
  pap = mix(pap, ${S('#7a4a22')}, burn * burn * 0.75);
  float charL = smoothstep(0.40, 0.472, fv) * (1.0 - rev);
  pap = mix(pap, ${S('#1d1007')}, charL * 0.92);
  // drifting mist hugging the unexplored side of the border
  float mist = smoothstep(0.26, 0.44, fv) * (1.0 - smoothstep(0.44, 0.49, fv)) * (1.0 - rev);
  float mn = fbm3(p * 0.09 + vec2(uTime * 0.012, -uTime * 0.008));
  pap = mix(pap, vec3(0.95, 0.93, 0.88), mist * smoothstep(0.4, 0.75, mn) * 0.35);
  // glowing ember rim right at the edge
  emis += ${S('#ff7a2a')} * smoothstep(0.455, 0.474, fv) * (1.0 - rev) * 0.35 * (0.6 + 0.4 * sin(uTime * 2.0 + p.x * 0.7));

  diffuseColor.rgb = mix(pap, col, rev);
  tRough = mix(1.0, rough, rev);
  tN = normalize(mix(vec3(0.0, 1.0, 0.0), nS, clamp(rev * vLift, 0.0, 1.0)));
  tEmis = emis * max(rev, 0.0) + ${S('#ff7a2a')} * smoothstep(0.455, 0.474, fv) * (1.0 - rev) * 0.3;
`;

export function makeTerrainMaterial(shared) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\nvarying vec3 vWP;\nvarying float vLift;\nvarying float vH0;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wq4 = modelMatrix * vec4(transformed, 1.0);
        float ffv = fogField(wq4.xz);
        float liftV = smoothstep(0.30, 0.80, ffv);
        vH0 = transformed.y;
        transformed.y = mix(0.03, transformed.y, liftV);
        vWP = vec3(wq4.x, transformed.y, wq4.z);
        vLift = liftV;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat tRough; vec3 tN; vec3 tEmis;\n${FRAG_MAIN}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tN, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmis;');
  };
  return mat;
}

export function makeTerrainDepthMaterial(shared) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wq4 = modelMatrix * vec4(transformed, 1.0);
        transformed.y = mix(0.03, transformed.y, smoothstep(0.30, 0.80, fogField(wq4.xz)));`);
  };
  return m;
}

export function buildTerrainMesh(world, shared, step) {
  const nx = Math.round((XMAX - XMIN) / step) + 1, nz = Math.round((ZMAX - ZMIN) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = XMIN + i * step, z = ZMIN + j * step, k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = world.heightY(x, z); pos[k + 2] = z;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let t = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mat = makeTerrainMaterial(shared);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.customDepthMaterial = makeTerrainDepthMaterial(shared);

  // outer paper ring
  const outer = new THREE.Shape();
  const E = 2600;
  outer.moveTo(-E, -E); outer.lineTo(E, -E); outer.lineTo(E, E); outer.lineTo(-E, E); outer.lineTo(-E, -E);
  const hole = new THREE.Path();
  hole.moveTo(XMIN + 0.5, ZMIN + 0.5); hole.lineTo(XMIN + 0.5, ZMAX - 0.5); hole.lineTo(XMAX - 0.5, ZMAX - 0.5); hole.lineTo(XMAX - 0.5, ZMIN + 0.5); hole.lineTo(XMIN + 0.5, ZMIN + 0.5);
  outer.holes.push(hole);
  const rg = new THREE.ShapeGeometry(outer);
  rg.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(rg, mat);
  ring.position.y = 0.03;
  ring.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh, ring);
  return { group, mesh, material: mat };
}
