// The national paper map as a tile pyramid (M2): level L splits the map into 2^L columns of square tiles of TILE_PX
// pixels, drawn on demand by the painter (natink.js createPainter, usually in a worker). Each frame a quadtree picks,
// for every visible part of the map, the level whose texels are about one screen pixel; a tile that isn't drawn yet
// shows its nearest drawn ancestor meanwhile. Tiles are flat quads just under the land patches (which discard their
// own pure-paper pixels), using the terrain shader's paper branch.
import * as THREE from 'three';
import { makeTerrainMaterial } from './terrain.js';

const TILE_PX = 512, MAX_L = 6, Y = -0.3;

export class PaperTiles {
  constructor(painter, shared, mobile, renderer = null) {
    this.painter = painter; this.mobile = mobile; this.renderer = renderer;
    const [x0, z0, x1, z1] = painter.rect;
    this.x0 = x0; this.z0 = z0; this.W = x1 - x0; this.H = z1 - z0;
    this.cap = mobile ? 28 : 56;                // tiles kept on the GPU
    this.cache = new Map();                     // 'L/i/j' → { tex, rect, used }
    this.wanted = new Map();                    // tiles to draw: key → [L, i, j, priority]
    this.pending = new Set();                   // tiles being drawn
    this.frame = 0;
    // an empty patch: nothing revealed and no patch rect, so the terrain shader draws only the national paper
    this.base = { ...shared.uniforms,
      uHex: { value: null }, uWater: { value: null }, uNormalTex: { value: null }, uRevealB: { value: 0 },
      uRect: { value: new THREE.Vector4(1e5, 1e5, 1, 1) }, uHexGrid: { value: new THREE.Vector4(0, 0, 0, 0) }, uIsPaper: { value: 1 } };
    this.group = new THREE.Group();
    this.pool = [];
    this._f = new THREE.Frustum(); this._m = new THREE.Matrix4(); this._b = new THREE.Box3();
  }
  // the coarsest tile, needed before the first frame (it stands in for everything else)
  async init() {
    this.root = await this.draw(0, 0, 0);
    const { x0, z0 } = this;
    // beyond the map: one big sheet under everything, fading to plain paper (terrain shader, uNatBounds)
    const out = this.quad(this.root);   // renderOrder 2 below: drawn last, so it costs only where nothing covers it
    out.position.set(x0 + this.W / 2, Y - 0.3, z0 + this.H / 2); out.scale.set(this.W + 16000, 1, this.H + 16000);
    out.renderOrder = 2;
    this.group.add(out);
  }
  key(L, i, j) { return `${L}/${i}/${j}`; }
  rect(L, i, j) { const S = this.W / 2 ** L; return [this.x0 + i * S, this.z0 + j * S, this.x0 + (i + 1) * S, this.z0 + (j + 1) * S]; }
  async draw(L, i, j) {
    const r = this.rect(L, i, j), k = this.key(L, i, j);
    this.pending.add(k);
    const t = { tex: await this.painter.paint(r, TILE_PX, TILE_PX), rect: new THREE.Vector4(...r), used: this.frame };
    if (this.renderer) this.renderer.initTexture(t.tex);
    this.pending.delete(k);
    this.cache.set(k, t);
    this.evict();
    return t;
  }
  quad(tile) {
    const u = { ...this.base, uNat: { value: tile.tex }, uNatRect: { value: tile.rect.clone() } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), makeTerrainMaterial({ uniforms: u }, this.mobile));
    m.receiveShadow = true; m.userData.u = u; m.renderOrder = 1;
    return m;
  }
  // choose tiles for this camera, show them (or their stand-ins), queue the missing ones
  update(camera, viewH) {
    this.frame++;
    camera.updateMatrixWorld();
    this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._f.setFromProjectionMatrix(this._m);
    const p = camera.position, k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, viewH);   // km per screen px per km of distance
    const leaves = [];
    const rows = (L) => Math.ceil(this.H / (this.W / 2 ** L));
    const visit = (L, i, j) => {
      const r = this.rect(L, i, j);
      this._b.min.set(r[0], Y - 1, r[1]); this._b.max.set(r[2], Y + 1, r[3]);
      if (!this._f.intersectsBox(this._b)) return;
      const dx = Math.max(r[0] - p.x, 0, p.x - r[2]), dz = Math.max(r[1] - p.z, 0, p.z - r[3]);
      const d = Math.hypot(dx, dz, p.y - Y);
      const texel = (r[2] - r[0]) / TILE_PX;
      if (L < MAX_L && texel > 1.3 * k * d) {
        for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) if (2 * j + b < rows(L + 1)) visit(L + 1, 2 * i + a, 2 * j + b);
      } else leaves.push([L, i, j, d]);
    };
    for (let j = 0; j < rows(0); j++) visit(0, 0, j);
    leaves.forEach(([L, i, j, d], n) => {
      // the tile itself if drawn, else queue it and show the nearest drawn ancestor
      let t = this.cache.get(this.key(L, i, j));
      if (!t) {
        this.wanted.set(this.key(L, i, j), [L, i, j, L * 1e6 + d]);
        for (let l = L - 1, a = i, b = j; l >= 0 && !t; l--) { a >>= 1; b >>= 1; t = this.cache.get(this.key(l, a, b)); }
        t = t || this.root;
      }
      t.used = this.frame;
      if (!this.pool[n]) { const q = this.quad(t); this.group.add(q); this.pool.push(q); }
      const m = this.pool[n];
      const r = this.rect(L, i, j);
      m.position.set((r[0] + r[2]) / 2, Y, (r[1] + r[3]) / 2); m.scale.set(r[2] - r[0], 1, r[3] - r[1]);
      m.userData.u.uNat.value = t.tex; m.userData.u.uNatRect.value.copy(t.rect);
      m.visible = true;
    });
    for (let n = leaves.length; n < this.pool.length; n++) this.pool[n].visible = false;
    this.leaves = leaves.length;
  }
  // start drawing the most wanted missing tiles (coarse first, then nearest); call once per frame
  step() {
    const todo = [...this.wanted.entries()].filter(([k]) => !this.pending.has(k)).sort((a, b) => a[1][3] - b[1][3]);
    this.wanted.clear();   // re-collected by the next update()
    const slots = (this.painter.worker ? 2 : 1) - this.pending.size;
    for (const [, [L, i, j]] of todo.slice(0, Math.max(0, slots))) this.draw(L, i, j);
    return todo.length > 0;
  }
  // keep the GPU budget: drop the least recently used tiles (never the root)
  evict() {
    if (this.cache.size > this.cap) {
      const old = [...this.cache.entries()].filter(([, t]) => t !== this.root).sort((a, b) => a[1].used - b[1].used);
      for (const [kk, t] of old.slice(0, this.cache.size - this.cap)) { if (t.used === this.frame) break; t.tex.dispose(); this.cache.delete(kk); }
    }
  }
}
