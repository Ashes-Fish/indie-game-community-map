// Albers equal-area conic used by the national map (central meridian 105°E, standard parallels 25°N / 47°N,
// spherical earth, km). Keep in step with scripts/bake_china.py, which bakes relief.webp in this projection.
const R = 6371, LAM0 = (105 * Math.PI) / 180;
const P1 = (25 * Math.PI) / 180, P2 = (47 * Math.PI) / 180;
const N = (Math.sin(P1) + Math.sin(P2)) / 2;
const C = Math.cos(P1) ** 2 + 2 * N * Math.sin(P1);
const RHO0 = (R * Math.sqrt(C)) / N;

// lon/lat (degrees) -> [x east, y north] in km
export function albers(lon, lat) {
  const th = N * ((lon * Math.PI) / 180 - LAM0);
  const rho = (R * Math.sqrt(C - 2 * N * Math.sin((lat * Math.PI) / 180))) / N;
  return [rho * Math.sin(th), RHO0 - rho * Math.cos(th)];
}

export function albersInv(x, y) {
  const rho = Math.hypot(x, RHO0 - y);
  const th = Math.atan2(x, RHO0 - y);
  const lat = Math.asin(Math.max(-1, Math.min(1, (C - ((rho * N) / R) ** 2) / (2 * N))));
  return [((LAM0 + th / N) * 180) / Math.PI, (lat * 180) / Math.PI];
}
