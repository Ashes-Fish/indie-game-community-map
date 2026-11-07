import * as THREE from 'three';
import { XMIN, XMAX, ZMIN, ZMAX, EXAG, EXP, rng } from './config.js';
import { GLSL_COMMON } from './glsl.js';
import { loadImage } from './world.js';

const S = (hex) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };
// mean colour of each painted layer (sRGB 0-255, printed by scripts/paint_textures.py) → used to re-tint the layers
const M = (r, g, b) => { const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; };

// Painted terrain layers (public/tex/terrain.webp, a vertical strip of 512² tiles, alpha = height) → one 2D array texture.
export async function loadTerrainTextures(url) {
  const img = await loadImage(url);
  const t = new THREE.DataArrayTexture(img, img.width, img.width, Math.round(img.height / img.width));
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

// Tileable water ripple map built at load time (no download): RG = normal xy, B = foam breakup, A = height.
export function makeRippleTexture(n = 256) {
  const R = rng(77);
  const waves = (count, k0, k1, p) => Array.from({ length: count }, () => {
    let kx, ky, k;
    do { kx = Math.round((R() * 2 - 1) * k1); ky = Math.round((R() * 2 - 1) * k1); k = Math.hypot(kx, ky); } while (k < k0 || k > k1);
    return [kx, ky, Math.pow(k, -p), R() * Math.PI * 2];
  });
  const W = waves(28, 3, 16, 1.3), F = waves(18, 6, 26, 0.8);
  const d = new Uint8Array(n * n * 4), TAU = Math.PI * 2;
  let hmin = 1e9, hmax = -1e9, fmin = 1e9, fmax = -1e9;
  const H = new Float32Array(n * n), DX = new Float32Array(n * n), DY = new Float32Array(n * n), FO = new Float32Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let h = 0, dx = 0, dy = 0, f = 0;
    for (const [kx, ky, a, ph] of W) { const t = TAU * (kx * x + ky * y) / n + ph; const s = Math.sin(t), c = Math.cos(t); h += a * s; dx += a * c * kx; dy += a * c * ky; }
    for (const [kx, ky, a, ph] of F) f += a * Math.sin(TAU * (kx * x + ky * y) / n + ph);
    const i = y * n + x; H[i] = h; DX[i] = dx; DY[i] = dy; FO[i] = f;
    hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); fmin = Math.min(fmin, f); fmax = Math.max(fmax, f);
  }
  for (let i = 0; i < n * n; i++) {
    let nx = -DX[i] * 0.09, ny = -DY[i] * 0.09; const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
    d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255;
    d[i * 4 + 2] = (FO[i] - fmin) / (fmax - fmin) * 255; d[i * 4 + 3] = (H[i] - hmin) / (hmax - hmin) * 255;
  }
  const t = new THREE.DataTexture(d, n, n, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const FRAG_PARS = /* glsl */`
${GLSL_COMMON}
uniform sampler2D uWater;
uniform sampler2D uNormalTex;
uniform sampler2D uInk;
uniform sampler2DArray uTerr;
uniform sampler2D uRipple;
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
const vec3 C_OCEAN = ${S('#0b3f78')};
const vec3 C_OCEAN2 = ${S('#123f86')};
const vec3 C_COAST = ${S('#1db3bd')};
const vec3 C_LAKE  = ${S('#1fa2b4')};
const vec3 C_GRASS = ${S('#62922e')};
const vec3 C_PLAIN = ${S('#a39d3e')};
const vec3 C_MARSH = ${S('#5b8b55')};
const vec3 C_WOODG = ${S('#466f2a')};
const vec3 C_URBAN = ${S('#8d8466')};
const vec3 C_DIST  = ${S('#a39674')};
const vec3 C_SAND  = ${S('#dfcc90')};
const vec3 C_ROCK  = ${S('#8a8274')};
const vec3 C_PAPER = ${S('#e4d0a4')};
const vec3 M_GRASS = ${M(97.4, 149.9, 50.9)};
const vec3 M_PADDY = ${M(111.7, 161.8, 103.0)};
const vec3 M_FOREST = ${M(68.3, 109.6, 42.4)};
const vec3 M_ROCK = ${M(127.2, 119.6, 103.8)};
const vec3 M_SAND = ${M(218.3, 203.3, 152.4)};
const vec3 M_SNOW = ${M(213.1, 222.0, 234.8)};

vec2 gdx, gdy; // screen derivatives of world xz, taken once in uniform control flow
vec4 layer(float L, vec2 p, float tile){ return textureGrad(uTerr, vec3(p / tile, L), gdx / tile, gdy / tile); }
// near sample + rotated macro sample to break up tiling
vec4 layer2(float L, vec2 p, float tile){
  vec4 a = layer(L, p, tile);
#ifndef MOBILE
  vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p + 13.7;
  vec4 b = textureGrad(uTerr, vec3(q / (tile * 3.3), L), mat2(0.8, -0.6, 0.6, 0.8) * gdx / (tile * 3.3), mat2(0.8, -0.6, 0.6, 0.8) * gdy / (tile * 3.3));
  a = mix(a, b, 0.32);
#endif
  return a;
}
float hgt(vec4 t){ return (t.a - 0.25) / 0.75; }
// height-aware blend: the top layer first fills where it is high and the base is low
float hblend(float w, float hTop, float hBase){ return smoothstep(0.0, 1.0, clamp((w - 0.5) * 3.2 + (hTop - hBase) * 1.1 + 0.5, 0.0, 1.0)); }
vec4 biomeA(float id){ return vec4(1.0 - step(0.5, abs(id - 3.0)), 1.0 - step(0.5, abs(id - 4.0)), 1.0 - step(0.5, abs(id - 5.0)), 1.0 - step(0.5, abs(id - 6.0))); }
vec4 biomeB(float id){ return vec4(1.0 - step(0.5, abs(id - 7.0)), 1.0 - step(0.5, abs(id - 8.0)), 1.0 - step(0.5, abs(id - 9.0)), step(9.5, id)); }

// rice plots: per-hex rotated grid of fields; returns plot colour, wet flag, plot-space coords and dike mask
vec3 farmPlot(vec2 p, vec2 hc, float seed, float fw, out float wet, out vec2 luv, out float dk){
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
  else if (h < 0.84) c = ${S('#5e9330')}; else c = ${S('#6fae5a')};
  wet = step(0.84, h);
  luv = hash12(id + 5.3) < 0.5 ? lp : lp.yx;
  vec2 e = min(f, 1.0 - f) * cell; float dike = min(e.x, e.y);
  dk = (1.0 - smoothstep(0.05, 0.05 + max(fw, 0.02) * 1.2, dike)) * 0.9 * (1.0 - smoothstep(0.12, 0.3, fw));
  // plots smaller than a few pixels → coarse patchwork of average field tones (no speckle)
  float far = smoothstep(0.1, 0.3, fw);
  float hc2 = hash12(floor(g / 3.0) + seed * 17.0);
  vec3 farC = hc2 < 0.45 ? ${S('#7fa636')} : hc2 < 0.75 ? ${S('#9aae3a')} : hc2 < 0.9 ? ${S('#c4b048')} : ${S('#6a9a3a')};
  wet *= 1.0 - far;
  return mix(c, farC, far);
}
`;

const FRAG_MAIN = /* glsl */`
  vec2 p = vWP.xz;
  gdx = dFdx(p); gdy = dFdy(p);
  vec2 fwv = abs(gdx) + abs(gdy); float fw = max(max(fwv.x, fwv.y), 1e-4);
  vec2 uvH = vec2((p.x - WXMIN) / WXSPAN, (p.y - WZMIN) / WZSPAN);
  vec4 wt = texture2D(uWater, uvH);
  float sdf = (wt.r * 255.0 - 128.0) / 10.0;
  float seaF = smoothstep(0.3, 0.7, wt.g);
  float detail = 1.0 - smoothstep(0.08, 0.3, fw);

  // ---- fog of war first: fully papered pixels skip the whole land/water shading ----
  float ff = fogField(p);
  float edgeN = (fbm3(p * 0.55) - 0.5) * 0.26 + (vnoise(p * 2.6) - 0.5) * 0.07;
  float fv = ff + edgeN;
  float rev = smoothstep(0.475, 0.525, fv);

  vec3 col = vec3(0.0), emis = vec3(0.0), nS = vec3(0.0, 1.0, 0.0);
  float rough = 0.9, cloudK = 1.0;
  if (rev > 0.001) {
  vec3 nT = normalize(texture2D(uNormalTex, uvH).xyz * 2.0 - 1.0);
  float hM = vH0 > 0.0 ? 1000.0 * pow(vH0 / EXAG, 1.0 / EXPO) : 0.0;

  // ---- hex lookup ----
  vec2 ha = hexRound(hexAxial(p)); vec2 hc = hexCenter(ha); vec2 lp = p - hc;
  vec4 d0 = hexData(ha);
  vec4 dn[6];
  float edgeD = 1e3;
  for (int i = 0; i < 6; i++) { dn[i] = hexData(ha + HD[i]); edgeD = min(edgeD, APO - dot(lp, HN[i])); }
  float own = floor(d0.r * 255.0 + 0.5);

  // ---- soft biome weights: hex kernel sampled through a strong domain warp (no hex mosaic) ----
  vec2 pb = p + (vec2(vnoise(p * 0.12), vnoise(p * 0.12 + 19.1)) - 0.5) * 10.0 + (vec2(vnoise(p * 0.5 + 5.0), vnoise(p * 0.5 + 41.0)) - 0.5) * 2.4;
  vec4 bA = vec4(0.0), bB = vec4(0.0); float bw = 0.0, oceanW = 0.0;
  vec2 hb = hexRound(hexAxial(pb));
  for (int i = 0; i < 7; i++) {
    vec2 na = i == 6 ? hb : hb + HD[i];
    float id = floor(hexData(na).r * 255.0 + 0.5);
    float w = max(0.0, 1.0 - length(pb - hexCenter(na)) / 13.5); w = w * w * (1.0 + w);
    bA += w * biomeA(id); bB += w * biomeB(id);
    oceanW += w * (id < 0.5 ? 1.0 : 0.0);
    bw += w;
  }
  bA /= max(bw, 1e-4); bB /= max(bw, 1e-4); oceanW /= max(bw, 1e-4);

  float slope = clamp(1.0 - nT.y, 0.0, 1.0);
  float m1 = fbm3(p * 0.085), m2 = vnoise(p * 0.9);

  // ---- base: painted grass, tinted continuously (lush ↔ dry plains ↔ marsh) ----
  float lowland = 1.0 - smoothstep(60.0, 260.0, hM);
  float dry = clamp(bA.y * 0.4 + smoothstep(0.56, 0.8, fbm3(p * 0.026 + 3.7)) * 0.6 * lowland, 0.0, 1.0);
  vec3 gTint = mix(C_GRASS, C_PLAIN, dry * 0.65);
  gTint = mix(gTint, C_MARSH, clamp(bB.z * 1.2, 0.0, 0.8));
  gTint = mix(gTint, gTint * vec3(0.86, 0.94, 0.86), smoothstep(80.0, 600.0, hM));
  float lush = smoothstep(0.35, 0.7, fbm3(p * 0.045 + 21.0));
  gTint = mix(gTint, ${S('#457f2c')}, lush * (1.0 - dry) * 0.6);
  gTint *= 0.84 + 0.3 * m1;
  vec4 tG = layer2(0.0, p, 6.5);
  float hB = hgt(tG);
  // texture brings mostly value (light/dark strokes) and only a little of its own hue, so the tint stays in charge
  vec3 gr = tG.rgb / M_GRASS;
  vec3 gDet = mix(vec3(dot(gr, vec3(0.3, 0.55, 0.15))), gr, 0.35);
  col = gTint * mix(vec3(1.0), gDet, mix(0.45, 0.75, detail));

  // forest floor under woods and hills, with clearings
  float wF = clamp((bA.w + bB.x * 0.85 + bB.y * 0.5) * smoothstep(0.32, 0.6, fbm3(p * 0.11 + 11.0) + 0.12), 0.0, 1.0);
  if (wF > 0.02) {
    vec4 t = layer2(2.0, p + 2.3, 5.5);
    float m = hblend(wF, hgt(t), hB);
    col = mix(col, t.rgb * C_WOODG / M_FOREST * (0.9 + 0.2 * m1), m); hB = mix(hB, hgt(t), m);
  }
  // rock on steep / high ground
  float wR = clamp(smoothstep(0.3, 0.6, slope + (m1 - 0.5) * 0.25) * smoothstep(250.0, 700.0, hM) * 0.95
    + bB.y * 0.3 * smoothstep(0.45, 0.75, m2) + smoothstep(950.0, 1500.0, hM) * 0.6, 0.0, 1.0);
  if (wR > 0.02) {
    vec4 t = layer2(3.0, p, 3.4);
    float m = hblend(wR, hgt(t), hB);
    col = mix(col, t.rgb * C_ROCK / M_ROCK * (0.9 + 0.25 * m2), m); hB = mix(hB, hgt(t), m);
  }
  // snow (reserved for the national map; only the very highest ground here)
  float wS = smoothstep(1750.0, 1900.0, hM + (m2 - 0.5) * 220.0) * (1.0 - smoothstep(0.5, 0.75, slope));
  if (wS > 0.02) {
    vec4 t = layer(5.0, p, 5.0);
    col = mix(col, t.rgb, hblend(wS, hgt(t), hB));
  }
  float wet = 0.0;
  // marsh: scattered reed ponds
  if (bB.z > 0.05) {
    float pn = vnoise(p * 0.9 + 3.3) * 0.7 + vnoise(p * 2.3) * 0.3;
    float pond = smoothstep(0.62, 0.66 + fw * 0.3, pn) * smoothstep(0.05, 0.5, bB.z);
    col = mix(col, ${S('#3f8f8a')} * (0.9 + 0.2 * m2), pond * 0.85);
    wet = max(wet, pond);
  }

  // farmland: paddies with rows that follow each plot, rippling in the wind
  if (abs(own - 5.0) < 0.5) {
    float fade = smoothstep(0.42, 0.6, vnoise(p * 0.22 + ha * 3.7) * 0.75 + edgeD / APO * 0.55) * smoothstep(0.25, 0.9, -sdf);
    if (fade > 0.01) {
      float w2, dk; vec2 luv;
      vec3 fc = farmPlot(p, hc, hash12(ha + 3.1), fw, w2, luv, dk);
      vec4 t = textureGrad(uTerr, vec3(luv / 2.4, 1.0), vec2(fw / 2.4, 0.0), vec2(0.0, fw / 2.4));
      vec3 rice = mix(vec3(1.0), t.rgb / M_PADDY, detail);
      vec3 fcol = fc * rice;
      vec3 flooded = mix(${S('#4f8f8c')} * (0.9 + 0.2 * m2), fc * rice, smoothstep(0.5, 0.85, hgt(t)) * detail * 0.8);
      fcol = mix(fcol, flooded, w2);
      float wave = sin(dot(p, vec2(0.62, 0.36)) * 1.6 - uTime * 1.7 + vnoise(p * 0.32) * 5.0);
      fcol *= 1.0 + 0.085 * wave * (1.0 - w2) * (0.4 + 0.6 * detail);
      fcol = mix(fcol, ${S('#7d8a3c')}, dk);
      fcol = mix(fcol, mix(col, fcol, 0.5), smoothstep(0.1, 0.3, fw));   // far away: fields melt into the land, no hex blotches
      col = mix(col, fcol, fade);
      wet = w2 * fade;
    }
  }
  // city / district ground
  if (own > 9.5) {
    float r = length(lp);
    vec3 pave = own > 10.5 ? C_DIST : C_URBAN;
    col = mix(col, pave * (0.9 + 0.15 * m2), smoothstep(5.0, 3.0, r + (m1 - 0.5) * 2.0) * 0.85);
  }
  // sandy shores and river banks
  float beach = (1.0 - smoothstep(0.05, 0.6 + fw, -sdf + (m2 - 0.5) * 0.25)) * mix(0.35, 1.0, seaF);
  vec4 tSand = layer(4.0, p, 2.6);
  vec3 sandC = tSand.rgb * C_SAND / M_SAND;
  if (beach > 0.01) col = mix(col, sandC, hblend(beach, hgt(tSand), hB));

  col = mix(col, col * 0.78, wet * 0.35);
  rough = mix(rough, 0.35, wet);
  nS = nT;

  // ---- water ----
  float aa = fw * 0.8;
  float wm = smoothstep(-aa, aa, sdf);
  if (wm > 0.001) {
    // flow along the shore / river channel: tangent of the distance field, oriented east (Yangtze, Qiantang flow east)
    float e = 0.5;
    float sx = (texture2D(uWater, uvH + vec2(e / WXSPAN, 0.0)).r * 255.0 - 128.0) / 10.0 - sdf;
    float sz = (texture2D(uWater, uvH + vec2(0.0, e / WZSPAN)).r * 255.0 - 128.0) / 10.0 - sdf;
    vec2 gr = vec2(sx, sz); gr /= max(length(gr), 1e-4);
    vec2 tng = vec2(-gr.y, gr.x); tng *= sign(tng.x + 0.001);
    float spd = mix(0.55, 0.12, seaF);
    float ph0 = fract(uTime * 0.07), ph1 = fract(uTime * 0.07 + 0.5);
    float fw0 = 1.0 - abs(1.0 - 2.0 * ph0);
    vec2 rq = p * 0.42;
    vec4 r0 = textureGrad(uRipple, rq - tng * ph0 * spd * 6.0, gdx * 0.42, gdy * 0.42);
    vec4 r1 = textureGrad(uRipple, rq + 0.37 - tng * ph1 * spd * 6.0, gdx * 0.42, gdy * 0.42);
    vec4 rf = mix(r1, r0, fw0);
    vec2 rq2 = p * 1.25 + uTime * vec2(0.035, 0.022);
    vec4 r2 = textureGrad(uRipple, rq2, gdx * 1.25, gdy * 1.25);
    float ripA = (0.9 - 0.6 * smoothstep(0.08, 0.5, fw));
    vec2 wnxy = ((rf.xy - 0.5) * 1.0 + (r2.xy - 0.5) * 0.7) * ripA;
    vec3 wn = normalize(vec3(wnxy.x, 1.0, wnxy.y));

    // colour by depth: sand shows through the shallows, coast turquoise, deep ocean navy
    float deep = clamp(max(smoothstep(0.8, 11.0, sdf) * 0.75, oceanW * smoothstep(0.6, 3.2, sdf)), 0.0, 1.0) * seaF;
    vec3 wc = mix(C_COAST, mix(C_OCEAN, C_OCEAN2, smoothstep(14.0, 40.0, sdf)), deep);
    vec3 lakeC = mix(C_LAKE, C_LAKE * vec3(0.66, 0.84, 0.96), smoothstep(0.6, 9.0, sdf));
    wc = mix(lakeC, wc, seaF);
    wc *= 0.93 + 0.12 * fbm3(p * 0.22 + vec2(uTime * 0.02, 0.0));
    // painted ripples: wave bodies a touch darker, crests catching light (visible whatever the sun angle)
    float rh = rf.w * 0.6 + r2.w * 0.4;
    wc *= 0.9 + 0.16 * rh * ripA;
    wc += vec3(0.05, 0.08, 0.08) * smoothstep(0.66, 0.86, rh) * ripA;
    float shallow = 1.0 - smoothstep(0.0, 1.3, sdf);
    vec3 under = mix(sandC * vec3(0.78, 0.92, 0.9), col * 0.75, 1.0 - seaF * 0.6);
    wc = mix(wc, mix(under, wc, 0.42), shallow * shallow);
    wc = mix(wc, wc * 1.14 + vec3(0.02, 0.05, 0.05), 1.0 - smoothstep(0.0, 2.2, sdf));
#ifndef MOBILE
    // caustic light net in the shallows
    float ca = smoothstep(0.6, 0.95, 1.0 - abs(rf.x + r2.y - 1.0) * 2.2) * (1.0 - smoothstep(0.3, 3.0, sdf)) * detail;
    wc += vec3(0.16, 0.26, 0.24) * ca * 0.6;
#endif
    // waves rolling onto the shore, broken up by foam noise drifting along the coast
    float band = fract(sdf * 0.85 + uTime * 0.14);
    float waveL = smoothstep(0.0, 0.06, band) * (1.0 - smoothstep(0.06, 0.16, band));
    float brk = smoothstep(0.42, 0.68, rf.z * 0.8 + vnoise(p * 0.6) * 0.4);
    float waveMask = (1.0 - smoothstep(0.3, 2.8, sdf)) * brk;
    float foamShore = 1.0 - smoothstep(0.0, 0.14 + fw * 1.5, sdf - 0.06 * sin(uTime * 1.3 + p.x * 0.9) - (rf.z - 0.5) * 0.14);
    float lineVis = 1.0 - smoothstep(0.1, 0.32, fw);
    float foamLace = smoothstep(0.55, 0.75, rf.z) * (1.0 - smoothstep(0.1, 0.55, sdf)) * lineVis;
    float foam = clamp(max(waveL * waveMask * 0.85 * lineVis * mix(0.45, 1.0, seaF), foamShore * mix(0.45, 0.95, seaF)) + foamLace * 0.5, 0.0, 1.0);
    wc = mix(wc, vec3(0.93, 0.97, 0.96), foam);
    // sun glitter: reflect against a light placed where the strategic camera can catch it
    vec3 V = normalize(cameraPosition - vWP);
    vec3 Rf = reflect(-V, normalize(vec3(wnxy.x * 2.2, 1.0, wnxy.y * 2.2)));
    float gl = pow(max(dot(Rf, normalize(vec3(-0.3, 0.62, -0.72))), 0.0), 420.0);
    float glZone = smoothstep(0.45, 0.75, vnoise(p * 0.08 + vec2(uTime * 0.01, 0.0)));   // glitter comes in patches
    gl *= smoothstep(0.55, 0.85, r2.w) * (1.0 - foam) * smoothstep(0.4, 1.4, sdf) * glZone;
    vec2 spq = p * 7.0, spc = floor(spq);
    float star = 1.0 - smoothstep(0.0, 0.09, length(fract(spq) - 0.5 - (vec2(hash12(spc + 3.1), hash12(spc + 8.7)) - 0.5) * 0.6));
    float twinkle = step(0.996, hash12(spc + floor(uTime * 2.0 + hash12(spc) * 7.0) * 0.37)) * star * detail * smoothstep(1.0, 3.0, sdf) * seaF;
    emis += vec3(1.0, 0.93, 0.78) * (gl * 1.8 + twinkle * 1.4) * wm;
    col = mix(col, wc, wm);
    rough = mix(rough, 0.14, wm * (1.0 - foam));
    nS = normalize(mix(nT, wn, wm));
  }

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
  cloudK = cloudShade(p);
  }

  // ---- fog of war: paper map ----
  vec3 pap = C_PAPER;
  if (rev < 0.999) {
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
  }

  diffuseColor.rgb = mix(pap, col, rev);
  tRough = mix(1.0, rough, rev);
  tN = normalize(mix(vec3(0.0, 1.0, 0.0), nS, clamp(rev * vLift, 0.0, 1.0)));
  tEmis = emis * max(rev, 0.0) + ${S('#ff7a2a')} * smoothstep(0.455, 0.474, fv) * (1.0 - rev) * (0.3 + 0.35 * (0.6 + 0.4 * sin(uTime * 2.0 + p.x * 0.7)));
  tCloud = mix(1.0, cloudK, rev);
`;

export function makeTerrainMaterial(shared, mobile) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
  if (mobile) mat.defines = { MOBILE: '' };
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
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat tRough; vec3 tN; vec3 tEmis; float tCloud;\n${FRAG_MAIN}`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tN, 0.0)).xyz);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += tEmis;')
      .replace('#include <aomap_fragment>', 'reflectedLight.directDiffuse *= tCloud; reflectedLight.directSpecular *= tCloud;\n#include <aomap_fragment>');
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

export function buildTerrainMesh(world, shared, step, mobile) {
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
  const mat = makeTerrainMaterial(shared, mobile);
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
