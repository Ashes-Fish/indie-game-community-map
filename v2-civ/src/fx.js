// Build-animation effects: dust bursts, golden light pillars, eased growth.
import * as THREE from 'three';

export class Dust {
  constructor(max = 600) {
    this.max = max; this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.age = new Float32Array(max); this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 400 }, uColor: { value: new THREE.Color('#d9c49a') } },
      vertexShader: `attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale;
        void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`,
      fragmentShader: `varying float vA; uniform vec3 uColor; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.1, r) * vA; if (a < 0.01) discard; gl_FragColor = vec4(uColor * (0.85 + 0.3 * (0.5 - d.y)), a); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  burst(x, y, z, count = 60, radius = 3.2) {
    for (let k = 0; k < count; k++) {
      const i = this.n++ % this.max;
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      this.pos[i * 3] = x + Math.cos(a) * r * 0.6; this.pos[i * 3 + 1] = y + 0.2 + Math.random() * 0.5; this.pos[i * 3 + 2] = z + Math.sin(a) * r * 0.6;
      const sp = 1.5 + Math.random() * 3.0;
      this.vel[i * 3] = Math.cos(a) * sp; this.vel[i * 3 + 1] = 0.6 + Math.random() * 1.8; this.vel[i * 3 + 2] = Math.sin(a) * sp;
      this.life[i] = 1.2 + Math.random() * 1.0; this.age[i] = 0; this.size[i] = (0.8 + Math.random() * 1.4) * Math.max(1, radius / 3.2);
    }
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.life[i] = 0; this.alpha[i] = 0; continue; }
      const drag = Math.exp(-dt * 2.6);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 2] *= drag; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - dt * 0.6;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.sin(Math.min(1, t * 4) * Math.PI / 2) * (1 - t) * 0.75;
      this.size[i] += dt * 1.6;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}

export class Beams {
  constructor() {
    this.group = new THREE.Group();
    this.list = [];
    this.geo = new THREE.CylinderGeometry(1.0, 2.6, 46, 24, 1, true).translate(0, 23, 0);
    this.base = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uA: { value: 1 }, uColor: { value: new THREE.Color(1.0, 0.78, 0.38) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uA; uniform vec3 uColor;
        void main(){ float v = vUv.y; float a = pow(1.0 - v, 1.6) * (0.55 + 0.45 * sin(vUv.x * 6.2832 * 3.0 + v * 8.0)) * uA;
          gl_FragColor = vec4(uColor * 1.6, a * 0.55); }`,
    });
  }
  spawn(x, y, z, k = 1) {
    const m = new THREE.Mesh(this.geo, this.base.clone());
    m.position.set(x, y, z);
    m.userData.k = k;
    m.renderOrder = 6;
    this.group.add(m);
    this.list.push({ m, t: 0 });
  }
  update(dt) {
    for (const b of this.list) {
      b.t += dt;
      const u = b.t / 2.2;
      b.m.material.uniforms.uA.value = Math.max(0, Math.sin(Math.min(1, u * 5) * Math.PI / 2) * (1 - u));
      const k = b.m.userData.k;
      b.m.scale.set((1 - u * 0.5) * k, (0.6 + u * 0.6) * Math.sqrt(k), (1 - u * 0.5) * k);
      if (u >= 1) { this.group.remove(b.m); b.m.material.dispose(); b.dead = true; }
    }
    this.list = this.list.filter((b) => !b.dead);
  }
}

export const easeOutBack = (t, s = 2.2) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
