// Shared GLSL: noise, hex math, fog-of-war field
import { HEX_R, HEX_N, HEX_OFF, XMIN, ZMIN, XMAX, ZMAX } from './config.js';

const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

export const GLSL_COMMON = /* glsl */`
#define HEX_R ${f(HEX_R)}
#define SQ3 1.7320508
#define APO ${f(HEX_R * Math.sqrt(3) / 2)}
#define HEXN ${f(HEX_N)}
#define HEXOFF ${f(HEX_OFF)}
#define WXMIN ${f(XMIN)}
#define WZMIN ${f(ZMIN)}
#define WXSPAN ${f(XMAX - XMIN)}
#define WZSPAN ${f(ZMAX - ZMIN)}
uniform sampler2D uHex;
uniform float uRevealB;
uniform float uTime;
uniform float uCamDist;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm3(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<3;i++){ s += a*vnoise(p); p = p*2.07 + vec2(17.1, 9.2); a *= 0.5; } return s / 0.875; }
float fbm5(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + vec2(11.7, 23.1); a *= 0.5; } return s / 0.96875; }

const vec2 HD[6] = vec2[6](vec2(1.0,0.0), vec2(1.0,-1.0), vec2(0.0,-1.0), vec2(-1.0,0.0), vec2(-1.0,1.0), vec2(0.0,1.0));
const vec2 HN[6] = vec2[6](vec2(1.0,0.0), vec2(0.5,-0.8660254), vec2(-0.5,-0.8660254), vec2(-1.0,0.0), vec2(-0.5,0.8660254), vec2(0.5,0.8660254));
vec2 hexAxial(vec2 p){ return vec2((SQ3/3.0*p.x - p.y/3.0)/HEX_R, (2.0/3.0*p.y)/HEX_R); }
vec2 hexRound(vec2 a){
  vec3 c = vec3(a.x, a.y, -a.x-a.y); vec3 r = floor(c + 0.5); vec3 d = abs(r - c);
  if (d.x > d.y && d.x > d.z) r.x = -r.y - r.z; else if (d.y > d.z) r.y = -r.x - r.z;
  return r.xy;
}
vec2 hexCenter(vec2 a){ return vec2(HEX_R*(SQ3*a.x + SQ3*0.5*a.y), HEX_R*1.5*a.y); }
vec4 hexData(vec2 a){
  float r = a.y; float col = a.x + (r - mod(r, 2.0))*0.5;
  vec2 ij = vec2(col + HEXOFF, r + HEXOFF);
  if (ij.x < 0.0 || ij.y < 0.0 || ij.x > HEXN-1.0 || ij.y > HEXN-1.0) return vec4(0.0, 0.0, 1.0, 0.0);
  return texture2D(uHex, (ij + 0.5)/HEXN);
}
// slow drifting cloud shadows on the ground (1 = full sun); faded out at strategic zoom where they'd read as smudges
float cloudShade(vec2 p){
  vec2 q = p * 0.032 + uTime * vec2(0.012, 0.005);
  float n = vnoise(q) * 0.65 + vnoise(q * 2.9 + 7.1) * 0.35;
  return 1.0 - 0.45 * smoothstep(0.54, 0.63, n) * (1.0 - smoothstep(200.0, 420.0, uCamDist));
}
float hexRevealed(vec4 d){ return step(d.b*255.0, uRevealB); }
// smooth reveal field (1 = revealed). Kernel blend of the 7 nearest hexes with a domain warp.
float fogField(vec2 p){
  vec2 pn = p + (vec2(vnoise(p*0.11), vnoise(p*0.11 + 31.7)) - 0.5) * 7.0;
  vec2 a = hexRound(hexAxial(pn));
  float sw = 0.0, sr = 0.0;
  for (int i = 0; i < 7; i++){
    vec2 na = i == 6 ? a : a + HD[i];
    float w = max(0.0, 1.0 - length(pn - hexCenter(na)) / 12.9); w *= w;
    sw += w; sr += w * hexRevealed(hexData(na));
  }
  return sr / max(sw, 1e-4);
}
`;
