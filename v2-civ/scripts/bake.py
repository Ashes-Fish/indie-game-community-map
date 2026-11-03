# Bake height.png, water.png (signed distance field), rivers.json for the Yangtze-delta Civ-style map
import sys, json, math, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
sys.path.insert(0, sys.argv[1]); import geo
D, NE, OUT = sys.argv[2], sys.argv[3], sys.argv[4]
mos = np.load(D + '/mosaic.npy'); Z, X0, Y0 = map(int, open(D + '/mosaic.txt').read().split())
SS = 3; RS = geo.RES / SS; WS, HS = geo.W * SS, geo.H * SS
xs = geo.XMIN + (np.arange(WS) + 0.5) * RS; zs = geo.ZMIN + (np.arange(HS) + 0.5) * RS
lon = geo.LON0 + xs / geo.KX; lat = geo.LAT0 - zs / geo.KZ
px = ((lon + 180) / 360 * 2**Z - X0) * 256 - 0.5
py = ((1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * 2**Z - Y0) * 256 - 0.5
PX, PY = np.meshgrid(px, py)
x0 = np.floor(PX).astype(int); y0 = np.floor(PY).astype(int); fx = PX - x0; fy = PY - y0
def g(yy, xx): return mos[np.clip(yy, 0, mos.shape[0]-1), np.clip(xx, 0, mos.shape[1]-1)]
hs = (g(y0, x0) * (1-fx) + g(y0, x0+1) * fx) * (1-fy) + (g(y0+1, x0) * (1-fx) + g(y0+1, x0+1) * fx) * fy
del PX, PY, x0, y0, fx, fy

def ss_px(lo, la):
    x, z = geo.to_world(lo, la); return ((x - geo.XMIN) / RS, (z - geo.ZMIN) / RS)
def polys(geom):
    if geom['type'] == 'Polygon': return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon': return geom['coordinates']
    return []
def raster(features, filt=lambda p: True):
    im = Image.new('L', (WS, HS), 0); dr = ImageDraw.Draw(im)
    for f in features:
        if not filt(f['properties']): continue
        for poly in polys(f['geometry']):
            for i, ring in enumerate(poly):
                pts = [ss_px(lo, la) for lo, la in ring]
                if max(p[0] for p in pts) < 0 or min(p[0] for p in pts) > WS or max(p[1] for p in pts) < 0 or min(p[1] for p in pts) > HS: continue
                dr.polygon(pts, fill=255 if i == 0 else 0)
    return np.asarray(im) > 127
land = raster(json.load(open(NE + '/ne_10m_land.geojson'))['features'])
lakes = raster(json.load(open(NE + '/ne_10m_lakes.geojson'))['features'])

# rivers: NE centerlines in region + hand-authored canal / Huangpu
riv = []
B = (117.0, 28.7, 123.2, 33.5)
for f in json.load(open(NE + '/ne_10m_rivers_lake_centerlines.geojson'))['features']:
    p = f['properties']; gm = f['geometry']
    lines = gm['coordinates'] if gm['type'] == 'MultiLineString' else [gm['coordinates']]
    for ln in lines:
        ln = [c for c in ln if B[0] <= c[0] <= B[2] and B[1] <= c[1] <= B[3]]
        if len(ln) < 2: continue
        name = p.get('name') or ''
        if p.get('featurecla') == 'Lake Centerline': continue
        w = {'Yangtze': 2.4, 'Fuchun': 1.0}.get(name, 0.7)
        riv.append({'name': name, 'w': w, 'pts': ln, 'carve': name in ('Yangtze', 'Fuchun')})
canal = [(120.15,30.30),(120.21,30.46),(120.40,30.55),(120.62,30.70),(120.75,30.77),(120.70,30.90),(120.64,31.02),(120.64,31.16),(120.61,31.29),(120.45,31.43),(120.30,31.57),(120.12,31.69),(119.97,31.79),(119.75,31.90),(119.58,32.00),(119.45,32.18)]
huangpu = [(120.95,31.06),(121.10,31.00),(121.27,30.96),(121.38,30.99),(121.45,31.05),(121.48,31.14),(121.50,31.22),(121.53,31.28),(121.51,31.37),(121.50,31.41)]
qinhuai = [(118.85,31.95),(118.82,32.00),(118.78,32.02),(118.74,32.04)]
riv.append({'name': 'canal', 'w': 0.55, 'pts': canal, 'carve': False})
riv.append({'name': 'Huangpu', 'w': 0.9, 'pts': huangpu, 'carve': False})
# West Lake (exaggerated) as polygon
wl = [(120.122 + 0.026 * math.cos(a) * (1 + 0.12 * math.sin(3 * a)), 30.236 + 0.026 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)]
im = Image.new('L', (WS, HS), 0); dr = ImageDraw.Draw(im)
dr.polygon([ss_px(*c) for c in wl], fill=255)
for r in riv:
    if not r['carve']: continue
    pts = [ss_px(*c) for c in r['pts']]
    dr.line(pts, fill=255, width=max(1, int(round(r['w'] / RS))), joint='curve')
    rr = r['w'] / RS / 2
    for p in pts: dr.ellipse([p[0]-rr, p[1]-rr, p[0]+rr, p[1]+rr], fill=255)
extra = np.asarray(im) > 127

water = (hs < -0.5) | (~land & (hs < 2.0)) | lakes | extra
# clean specks
lab, n = ndimage.label(water); sizes = ndimage.sum(np.ones_like(water), lab, range(1, n + 1))
keep = np.zeros(n + 1, bool); keep[1:] = sizes >= 80; keep[np.unique(lab[lakes | extra])] = True; keep[0] = False
water = keep[lab]
lab2, n2 = ndimage.label(~water); s2 = ndimage.sum(np.ones_like(water), lab2, range(1, n2 + 1))
small_land = np.zeros(n2 + 1, bool); small_land[1:] = s2 < 12; water = water | small_land[lab2]

# lake surface levels: inland water components get the 15th pct of their shoreline height
lab, n = ndimage.label(water)
sea_lab = set(np.unique(lab[:, -1])) | set(np.unique(lab[-1, -40:]))
level = np.zeros(n + 1, np.float32)
shore = ndimage.binary_dilation(water, iterations=2) & ~water
for i in range(1, n + 1):
    if i in sea_lab: continue
    sl = ndimage.find_objects((lab == i).astype(int))[0]
    sub = lab[sl] == i
    ring = ndimage.binary_dilation(sub, iterations=3) & ~sub & ~water[sl]
    vals = hs[sl][ring]
    level[i] = max(0.0, float(np.percentile(vals, 10))) if vals.size else 0.0
hland = np.where(water, level[lab], np.maximum(hs, 0.0))
# carve slight valley next to rivers so water sits below banks
# downsample heights
h = hland.reshape(geo.H, SS, geo.W, SS).mean(axis=(1, 3))
hmx = hland.reshape(geo.H, SS, geo.W, SS).max(axis=(1, 3))
h = 0.7 * h + 0.3 * hmx  # keep peaks a bit sharper
HMAX = 1900.0
enc = np.clip(np.sqrt(np.clip(h, 0, HMAX) / HMAX) * 255 + 0.5, 0, 255).astype(np.uint8)
Image.fromarray(enc).save(OUT + '/height.png', optimize=True)

# signed distance (km), positive in water; sample at 0.5 km
dw = ndimage.distance_transform_edt(water) * RS
dl = ndimage.distance_transform_edt(~water) * RS
sdf = np.where(water, dw - RS * 0.5, -(dl - RS * 0.5))
# downsample 0.25 -> 0.5 km via 2x2 mean (SS=3 grid is 0.25 km)
H2, W2 = HS // 2, WS // 2
sd2 = sdf[:H2 * 2, :W2 * 2].reshape(H2, 2, W2, 2).mean(axis=(1, 3))
enc2 = np.clip(128 + sd2 * 10, 0, 255).astype(np.uint8)  # +-12.8 km range, 0.1 km steps
labw, nw = ndimage.label(water)
sea_ids = np.unique(np.concatenate([labw[:, -1], labw[-1, int(WS*0.7):], labw[0, int(WS*0.8):]]))
sea = np.isin(labw, sea_ids[sea_ids > 0])
seaf = ndimage.gaussian_filter(sea.astype(np.float32), 6)
sea2 = seaf[:H2 * 2, :W2 * 2].reshape(H2, 2, W2, 2).mean(axis=(1, 3))
rgb = np.stack([enc2, np.clip(sea2 * 255 + 0.5, 0, 255).astype(np.uint8), np.zeros_like(enc2)], -1)
Image.fromarray(rgb).save(OUT + '/water.png', optimize=True)

# rivers json in world coords (simplified)
def simp(pts, tol):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); d = b - a; L = np.hypot(*d) or 1e-9
    dist = [abs(d[0] * (a[1] - p[1]) - d[1] * (a[0] - p[0])) / L for p in pts[1:-1]]
    i = int(np.argmax(dist)) + 1
    if dist[i - 1] > tol: return simp(pts[:i + 1], tol)[:-1] + simp(pts[i:], tol)
    return [pts[0], pts[-1]]
out = []
for r in riv:
    w = [geo.to_world(*c) for c in r['pts']]
    w = simp(w, 0.25)
    out.append({'name': r['name'], 'w': r['w'], 'water': r['carve'], 'pts': [[round(x, 2), round(z, 2)] for x, z in w]})
json.dump({'rivers': out, 'westLake': [[round(v, 2) for v in geo.to_world(*c)] for c in wl]}, open(OUT + '/rivers.json', 'w'), separators=(',', ':'))
print('height', enc.shape, 'water', enc2.shape, 'rivers', len(out))
