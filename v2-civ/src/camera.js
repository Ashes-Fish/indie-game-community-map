// Civ-style strategy camera: fixed yaw (north up), pitch tied to zoom, drag-pan with inertia, wheel / pinch zoom to cursor.
import * as THREE from 'three';

const smooth = (t) => t * t * (3 - 2 * t);

export class CivCamera {
  constructor(camera, dom, opts = {}) {
    this.cam = camera; this.dom = dom;
    this.minD = opts.minD ?? 30; this.maxD = opts.maxD ?? 470;
    this.bounds = opts.bounds ?? { x0: -215, x1: 195, z0: -175, z1: 165 };
    this.target = new THREE.Vector3(-15, 0, 0);
    this.dist = 380; this.goalDist = 380;
    this.vel = new THREE.Vector2();
    this.pointers = new Map();
    this.fly = null;
    this.onTap = null; this.onHover = null;
    this.enabled = true;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.zoomAnchor = null;
    this.bind();
    this.apply();
  }

  pitch(d = this.dist) {
    const t = smooth(Math.min(1, Math.max(0, (d - this.minD) / (this.maxD - this.minD))));
    return THREE.MathUtils.degToRad(38 + 30 * t);
  }

  apply() {
    const p = this.pitch();
    this.cam.position.set(this.target.x, this.target.y + Math.sin(p) * this.dist, this.target.z + Math.cos(p) * this.dist);
    this.cam.lookAt(this.target);
    this.cam.updateMatrixWorld();
  }

  ground(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(v, this.cam);
    const out = new THREE.Vector3();
    this._plane.constant = -this.target.y;
    return this._ray.ray.intersectPlane(this._plane, out) ? out : null;
  }

  bind() {
    const el = this.dom;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      this.fly = null; this.vel.set(0, 0);
      if (this.pointers.size === 1) { this.grab = this.ground(e.clientX, e.clientY); this.moved = 0; this.lastMove = [] }
      if (this.pointers.size === 2) this.startPinch();
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { this.onHover && this.onHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.pointers.size === 1 && this.grab) {
        const now = this.ground(e.clientX, e.clientY);
        if (now) {
          const ddx = this.grab.x - now.x, ddz = this.grab.z - now.z;
          this.target.x += ddx; this.target.z += ddz;
          this.clamp(); this.apply();
          const t = performance.now();
          this.lastMove.push({ t, dx: ddx, dz: ddz });
          while (this.lastMove.length && t - this.lastMove[0].t > 90) this.lastMove.shift();
        }
      } else if (this.pointers.size === 2) this.movePinch();
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        const quick = performance.now() - p.t < 500;
        if (this.moved < 8 && quick && this.onTap && e.type === 'pointerup') this.onTap(e.clientX, e.clientY, e.pointerType);
        else if (this.lastMove && this.lastMove.length) {
          const span = Math.max(16, performance.now() - this.lastMove[0].t);
          let sx = 0, sz = 0; for (const m of this.lastMove) { sx += m.dx; sz += m.dz; }
          this.vel.set(sx / span * 1000, sz / span * 1000);
        }
        this.grab = null;
      } else if (this.pointers.size === 1) {
        const [q] = this.pointers.values();
        this.grab = this.ground(q.x, q.y); this.lastMove = []; this.moved = 99;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.onHover) this.onHover(-1, -1); });
    el.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.fly = null;
      const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0022);
      this.goalDist = THREE.MathUtils.clamp(this.goalDist * k, this.minD, this.maxD);
      this.zoomAnchor = { x: e.clientX, y: e.clientY };
    }, { passive: false });
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.dist, mid: this.ground((a.x + b.x) / 2, (a.y + b.y) / 2) };
    this.moved = 99;
  }
  movePinch() {
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.dist = this.goalDist = THREE.MathUtils.clamp(this.pinch.dist * this.pinch.d / Math.max(d, 1), this.minD, this.maxD);
    this.apply();
    const now = this.ground(mx, my);
    if (now && this.pinch.mid) { this.target.x += this.pinch.mid.x - now.x; this.target.z += this.pinch.mid.z - now.z; }
    this.clamp(); this.apply();
  }

  clamp() {
    const b = this.bounds;
    const k = 0.35 + 0.65 * (1 - (this.dist - this.minD) / (this.maxD - this.minD)); // allow wider pan when close
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const hx = (b.x1 - b.x0) / 2 * Math.max(0.35, k), hz = (b.z1 - b.z0) / 2 * Math.max(0.35, k);
    this.target.x = THREE.MathUtils.clamp(this.target.x, cx - hx, cx + hx);
    this.target.z = THREE.MathUtils.clamp(this.target.z, cz - hz, cz + hz);
  }

  flyTo(x, z, dist, dur = 1.6, y = 0) {
    this.fly = { t: 0, dur, from: { x: this.target.x, z: this.target.z, y: this.target.y, d: this.dist }, to: { x, z, y, d: dist } };
    this.vel.set(0, 0);
  }

  update(dt) {
    if (this.fly) {
      const f = this.fly; f.t += dt;
      const u = Math.min(1, f.t / f.dur), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      // arc out a little in the middle of long flights
      const span = Math.hypot(f.to.x - f.from.x, f.to.z - f.from.z);
      const lift = Math.sin(Math.PI * u) * Math.min(span * 0.6, 160) * (f.to.d < f.from.d * 1.5 ? 1 : 0.3);
      this.target.x = f.from.x + (f.to.x - f.from.x) * e;
      this.target.z = f.from.z + (f.to.z - f.from.z) * e;
      this.target.y = f.from.y + (f.to.y - f.from.y) * e;
      this.dist = this.goalDist = Math.min(this.maxD, f.from.d + (f.to.d - f.from.d) * e + lift);
      if (u >= 1) this.fly = null;
      this.apply();
      return true;
    }
    let moving = false;
    if (Math.abs(this.goalDist - this.dist) > 0.01) {
      const before = this.zoomAnchor ? this.ground(this.zoomAnchor.x, this.zoomAnchor.y) : null;
      this.dist += (this.goalDist - this.dist) * Math.min(1, dt * 9);
      this.apply();
      if (before) {
        const after = this.ground(this.zoomAnchor.x, this.zoomAnchor.y);
        if (after) { this.target.x += before.x - after.x; this.target.z += before.z - after.z; }
      }
      this.clamp(); this.apply();
      moving = true;
    }
    if (this.pointers.size === 0 && this.vel.lengthSq() > 0.01) {
      this.target.x += this.vel.x * dt; this.target.z += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-dt * 4.5));
      this.clamp(); this.apply();
      moving = true;
    }
    return moving;
  }
}
