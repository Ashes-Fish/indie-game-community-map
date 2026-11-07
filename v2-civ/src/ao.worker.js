// AO worker: voxelise the building, then march a cosine-weighted hemisphere of rays from every unique vertex.
self.onmessage = (e) => {
  const { id, meshes, radius, rays } = e.data;
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const m of meshes) for (let i = 0; i < m.pos.length; i += 3) {
    const x = m.pos[i], y = m.pos[i + 1], z = m.pos[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const ground = y0;
  x0 -= radius; z0 -= radius; x1 += radius; y1 += radius; z1 += radius; y0 -= 0.01;
  let vs = radius / 14;
  const vol = (x1 - x0) * (y1 - y0) * (z1 - z0);
  vs = Math.max(vs, Math.cbrt(vol / 6e6));
  const nx = Math.ceil((x1 - x0) / vs) + 1, ny = Math.ceil((y1 - y0) / vs) + 1, nz = Math.ceil((z1 - z0) / vs) + 1;
  const grid = new Uint8Array(nx * ny * nz);
  const mark = (x, y, z) => { grid[(((z - z0) / vs) | 0) * nx * ny + (((y - y0) / vs) | 0) * nx + (((x - x0) / vs) | 0)] = 1; };
  // voxelise: sample each triangle on a barycentric grid finer than a voxel
  for (const m of meshes) {
    const P = m.pos, I = m.idx, nt = I ? I.length / 3 : P.length / 9;
    for (let t = 0; t < nt; t++) {
      const a = (I ? I[t * 3] : t * 3) * 3, b = (I ? I[t * 3 + 1] : t * 3 + 1) * 3, c = (I ? I[t * 3 + 2] : t * 3 + 2) * 3;
      const l = Math.max(Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]), Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]), Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]));
      const n = Math.max(1, Math.ceil(l / (vs * 0.6)));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
        const u = i / n, v = j / n, w = 1 - u - v;
        mark(P[a] * w + P[b] * u + P[c] * v, P[a + 1] * w + P[b + 1] * u + P[c + 1] * v, P[a + 2] * w + P[b + 2] * u + P[c + 2] * v);
      }
    }
  }
  // cosine-weighted hemisphere directions (Fibonacci spiral), in tangent space (z = normal)
  const dirs = [];
  for (let k = 0; k < rays; k++) {
    const r = Math.sqrt((k + 0.5) / rays), phi = k * 2.39996323;
    dirs.push([r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(Math.max(0, 1 - r * r))]);
  }
  const occAt = (x, y, z) => {
    if (y < ground) return 1;
    const ix = ((x - x0) / vs) | 0, iy = ((y - y0) / vs) | 0, iz = ((z - z0) / vs) | 0;
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return 0;
    return grid[iz * nx * ny + iy * nx + ix];
  };
  const memo = new Map();
  const out = meshes.map((m) => {
    const P = m.pos, N = m.nrm, n = P.length / 3, ao = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], qx = N[i * 3], qy = N[i * 3 + 1], qz = N[i * 3 + 2];
      const key = `${Math.round(px / vs * 2)},${Math.round(py / vs * 2)},${Math.round(pz / vs * 2)},${Math.round(qx * 8)},${Math.round(qy * 8)},${Math.round(qz * 8)}`;
      const hit = memo.get(key);
      if (hit !== undefined) { ao[i] = hit; continue; }
      // tangent frame
      let tx, ty, tz;
      if (Math.abs(qy) < 0.9) { tx = qz; ty = 0; tz = -qx; } else { tx = 0; ty = -qz; tz = qy; }
      const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl;
      const bx = qy * tz - qz * ty, by = qz * tx - qx * tz, bz = qx * ty - qy * tx;
      // trace both hemispheres and keep the open one: robust to flipped normals (inside a solid everything is blocked)
      let occ = rays;
      for (const sg of [1, -1]) {
        const ox = px + sg * qx * vs * 1.6, oy = py + sg * qy * vs * 1.6, oz = pz + sg * qz * vs * 1.6;
        let o = 0;
        for (const [a, b, c] of dirs) {
          const dx = tx * a + bx * b + sg * qx * c, dy = ty * a + by * b + sg * qy * c, dz = tz * a + bz * b + sg * qz * c;
          let t = vs * 0.5, step = vs * 0.7;
          while (t < radius) {
            if (occAt(ox + dx * t, oy + dy * t, oz + dz * t)) { o += 1 - 0.7 * (t / radius) * (t / radius); break; }
            t += step; step *= 1.07;
          }
          if (o >= occ) break;
        }
        occ = Math.min(occ, o);
      }
      const v = Math.min(1, Math.max(0, 1 - occ / rays) * 1.08);
      memo.set(key, v);
      ao[i] = v;
    }
    return ao;
  });
  self.postMessage({ id, ao: out }, out.map((a) => a.buffer));
};
