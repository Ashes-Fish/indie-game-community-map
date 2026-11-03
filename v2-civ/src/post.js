// Desktop post-processing: N8AO ambient occlusion → bloom → tilt-shift miniature blur → tone mapping → SMAA → grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';

const TiltShift = (horizontal) => ({
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0 }, uFocus: { value: 0.55 }, uWidth: { value: 0.16 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmount; uniform float uFocus; uniform float uWidth; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      float d = max(0.0, abs(vUv.y - uFocus) - uWidth);
      float r = uAmount * smoothstep(0.0, 0.42, d) * 20.0;
      vec2 dir = ${horizontal ? 'vec2(1.0, 0.0)' : 'vec2(0.0, 1.0)'} / uRes * (r / 6.0);
      vec4 c = vec4(0.0); float ws = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 18.0);
        c += texture2D(tDiffuse, vUv + dir * fi) * w; ws += w;
      }
      gl_FragColor = c / ws;
    }`,
});

const Grade = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.1 }, uWarm: { value: 0.025 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uWarm; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, uSat); c.rgb += vec3(uWarm, uWarm * 0.4, -uWarm);
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.18);
      gl_FragColor = c; }`,
};

export function makePost(renderer, scene, camera) {
  const w = innerWidth, h = innerHeight;
  const composer = new EffectComposer(renderer);
  const ao = new N8AOPass(scene, camera, w, h);
  ao.configuration.gammaCorrection = false;
  ao.configuration.aoRadius = 2.2;
  ao.configuration.distanceFalloff = 1.2;
  ao.configuration.intensity = 2.6;
  ao.configuration.color = new THREE.Color(0.08, 0.06, 0.03);
  ao.configuration.halfRes = false; // n8ao half-res path is incompatible with three r187
  ao.setQualityMode('Medium');
  const plain = new RenderPass(scene, camera);
  plain.enabled = false;
  composer.addPass(plain);
  composer.addPass(ao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.55, 0.92);
  composer.addPass(bloom);
  const th = new ShaderPass(TiltShift(true)), tv = new ShaderPass(TiltShift(false));
  composer.addPass(th); composer.addPass(tv);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);
  const setSize = (W, H) => {
    composer.setSize(W, H);
    const pr = renderer.getPixelRatio();
    th.uniforms.uRes.value.set(W * pr, H * pr); tv.uniforms.uRes.value.set(W * pr, H * pr);
  };
  setSize(w, h);
  return {
    composer, ao, bloom,
    setSize,
    update(dist) {
      const amt = THREE.MathUtils.clamp(1 - (dist - 45) / 170, 0, 1);
      th.uniforms.uAmount.value = tv.uniforms.uAmount.value = 0.25 + amt * 1.0;
      th.uniforms.uWidth.value = tv.uniforms.uWidth.value = 0.12 + (1 - amt) * 0.14;
      ao.configuration.aoRadius = THREE.MathUtils.clamp(dist * 0.03, 1.2, 6);
      // AO matters close up; at strategic zoom swap to a plain render pass to save GPU
      const useAO = dist < 300;
      if (ao.enabled !== useAO) { ao.enabled = useAO; plain.enabled = !useAO; }
    },
    render() { composer.render(); },
  };
}
