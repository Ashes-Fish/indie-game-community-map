# Bake the national (全国) ancient-map layer and the national city table.
# Usage (from v2-civ/): python scripts/bake_china.py   (needs numpy, Pillow, scipy; run bake_region.py first for Natural Earth)
# Sources: DataV.GeoAtlas (阿里云, 高德数据) province/city boundaries and seats, Natural Earth 10m rivers/lakes/land,
# AWS Terrarium elevation (z6). Outputs:
#   src/data/china-cities.json        every prefecture-level unit (+ municipalities, SARs, 省直辖县): adcode, name, seat
#   public/data/china/map.json        simplified provinces, national outline, nine-dash line, rivers, lakes (lon/lat)
#   public/data/china/elev.png        elevation + inside-China mask for the national ink map (src/natink.js), Albers frame
#   public/data/china/relief.json     that frame (relief.webp, the old 2D map's shading, is only written with --relief)
# 注意：正式公开发布前，边界数据要按《全国版规划方案》3.2 节换成标准地图服务数据并走审图流程。
import json, math, os, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'bake-raw')
DV = os.path.join(RAW, 'datav')
NE = os.path.join(RAW, 'ne')
OUT = os.path.join(ROOT, 'public', 'data', 'china')
DATAV = 'https://geo.datav.aliyun.com/areas_v3/bound/'

# ---------------------------------------------------------------- Albers (keep in step with src/albers.js)
R_E, LAM0 = 6371.0, math.radians(105.0)
P1, P2 = math.radians(25.0), math.radians(47.0)
NN = (math.sin(P1) + math.sin(P2)) / 2
CC = math.cos(P1) ** 2 + 2 * NN * math.sin(P1)
RHO0 = R_E * math.sqrt(CC) / NN


def albers(lon, lat):
    """lon/lat (deg, scalars or arrays) -> x east, y north in km."""
    th = NN * (np.radians(lon) - LAM0)
    rho = R_E * np.sqrt(CC - 2 * NN * np.sin(np.radians(lat))) / NN
    return rho * np.sin(th), RHO0 - rho * np.cos(th)


def albers_inv(x, y):
    rho = np.sqrt(x * x + (RHO0 - y) ** 2)
    th = np.arctan2(x, RHO0 - y)
    lat = np.degrees(np.arcsin(np.clip((CC - (rho * NN / R_E) ** 2) / (2 * NN), -1, 1)))
    return np.degrees(LAM0 + th / NN), lat


# ---------------------------------------------------------------- download helpers
def get_json(name):
    p = os.path.join(DV, name)
    if not os.path.exists(p):
        for k in range(3):
            try:
                data = urllib.request.urlopen(DATAV + name, timeout=60).read()
                break
            except Exception as e:  # noqa
                if k == 2:
                    print('skip', name, e)
                    return None
                time.sleep(1.5)
        open(p, 'wb').write(data)
        time.sleep(0.15)
    return json.load(open(p, encoding='utf-8'))


def simplify(pts, tol):
    """Douglas–Peucker on lon/lat pairs (tolerance in degrees)."""
    if len(pts) < 3:
        return pts
    keep = [0, len(pts) - 1]
    stack = [(0, len(pts) - 1)]
    a = np.asarray(pts)
    while stack:
        i, j = stack.pop()
        if j - i < 2:
            continue
        p, q = a[i], a[j]
        d = q - p
        L = math.hypot(*d) or 1e-12
        seg = a[i + 1:j]
        if L < 1e-9:  # closed ring: the chord is a point, measure plain distance from it
            dist = np.hypot(seg[:, 0] - p[0], seg[:, 1] - p[1])
        else:
            dist = np.abs(d[0] * (p[1] - seg[:, 1]) - d[1] * (p[0] - seg[:, 0])) / L
        k = int(np.argmax(dist))
        if dist[k] > tol:
            m = i + 1 + k
            keep.append(m)
            stack += [(i, m), (m, j)]
    return [pts[k] for k in sorted(keep)]


def rings_of(geom, tol, min_pts=4):
    out = []
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']] if geom['type'] == 'Polygon' else []
    for poly in polys:
        for ring in poly:
            s = simplify([(round(x, 3), round(y, 3)) for x, y in ring], tol)
            if len(s) >= min_pts:
                out.append(s)
    return out


SUFFIX = ('特别行政区', '维吾尔自治区', '壮族自治区', '回族自治区', '自治区', '自治州', '地区', '林区', '盟', '省', '市')


def short(name):
    for s in SUFFIX:
        if name.endswith(s) and len(name) > len(s) + 1:
            return name[:-len(s)]
    return name


def main():
    os.makedirs(DV, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    nat = get_json('100000_full.json')
    outline = get_json('100000.json')
    provinces, jd, cities = [], [], []
    for f in nat['features']:
        p = f['properties']
        if str(p.get('adcode')) == '100000_JD':  # 九段线：每一段是一个细长多边形，取外环
            jd += [poly[0] for poly in f['geometry']['coordinates']]
            continue
        ad = int(p['adcode'])
        pshort = short(p['name'])
        provinces.append({'a': ad, 'n': pshort, 'c': [round(v, 3) for v in (p.get('centroid') or p['center'])],  # label at centroid
                          'r': rings_of(f['geometry'], 0.02)})
        seat = p.get('center')
        if ad in (110000, 120000, 310000, 500000, 810000, 820000):  # 直辖市、特别行政区：本身就是一座城市
            cities.append({'a': ad, 'n': p['name'], 's': pshort, 'p': pshort, 'lon': seat[0], 'lat': seat[1], 'cap': True})
            continue
        sub = get_json(f'{ad}_full.json')
        if not sub:
            continue
        for g in sub['features']:
            q = g['properties']
            if not q.get('name') or not q.get('center'):
                continue
            c = q['center']
            cap = bool(seat) and abs(c[0] - seat[0]) < 0.02 and abs(c[1] - seat[1]) < 0.02
            cities.append({'a': int(q['adcode']), 'n': q['name'], 's': short(q['name']), 'p': pshort,
                           'lon': round(c[0], 4), 'lat': round(c[1], 4), 'cap': cap})
    print('provinces', len(provinces), 'cities', len(cities), 'nine-dash segments', len(jd))
    json.dump(cities, open(os.path.join(ROOT, 'src', 'data', 'china-cities.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))

    # rivers and lakes inside a generous China box
    BX = (72.0, 15.0, 136.0, 54.5)
    inside = lambda c: BX[0] <= c[0] <= BX[2] and BX[1] <= c[1] <= BX[3]
    rivers = []
    for f in json.load(open(os.path.join(NE, 'ne_10m_rivers_lake_centerlines.geojson'), encoding='utf-8'))['features']:
        p, gm = f['properties'], f['geometry']
        if gm is None or (p.get('scalerank') or 9) > 6 or p.get('featurecla') == 'Lake Centerline':
            continue
        for ln in gm['coordinates'] if gm['type'] == 'MultiLineString' else [gm['coordinates']]:
            ln = [c for c in ln if inside(c)]
            if len(ln) >= 2:
                rivers.append({'n': p.get('name_zh') or p.get('name') or '', 'r': p.get('scalerank') or 9,
                               'p': simplify([(round(x, 3), round(y, 3)) for x, y in ln], 0.015)})
    lakes = []
    for f in json.load(open(os.path.join(NE, 'ne_10m_lakes.geojson'), encoding='utf-8'))['features']:
        p, gm = f['properties'], f['geometry']
        if gm is None or (p.get('scalerank') or 9) > 5:
            continue
        rs = [r for r in rings_of(gm, 0.01) if inside(r[0])]
        if rs:
            lakes.append({'n': p.get('name_zh') or p.get('name') or '', 'r': rs})
    country = rings_of(outline['features'][0]['geometry'], 0.015)
    json.dump({'provinces': provinces, 'country': country,
               'jd': [simplify([(round(x, 3), round(y, 3)) for x, y in ln], 0.01) for ln in jd],
               'rivers': rivers, 'lakes': lakes},
              open(os.path.join(OUT, 'map.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('map.json', os.path.getsize(os.path.join(OUT, 'map.json')) // 1024, 'KB; rivers', len(rivers), 'lakes', len(lakes))
    relief(country, BX)


def relief(country, BX):
    """Paper + elevation tint + hill shading, resampled into Albers. China is drawn strongly, neighbours faintly."""
    Z = 6
    DBX = (58.0, 4.0, 158.0, 64.0)  # elevation for the whole Albers frame (its corners reach past the China box)
    tx = lambda lon: (lon + 180) / 360 * 2 ** Z
    ty = lambda lat: (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z
    x0, x1, y0, y1 = int(tx(DBX[0])), int(tx(DBX[2])), int(ty(DBX[3])), int(ty(DBX[1]))
    dem_dir = os.path.join(RAW, 'dem', 'china_z6')
    os.makedirs(dem_dir, exist_ok=True)
    mos = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = os.path.join(dem_dir, f'{Z}_{x}_{y}.png')
            if not os.path.exists(p):
                for k in range(6):  # the handshake to S3 times out now and then from mainland networks
                    try:
                        data = urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', timeout=60).read()
                        break
                    except OSError as e:
                        if k == 5:
                            raise
                        print('retry', x, y, e, flush=True)
                        time.sleep(3 + k * 3)
                open(p + '.part', 'wb').write(data)
                os.replace(p + '.part', p)
            a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
            mos[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    # Albers frame around the mainland + Hainan (the South China Sea islands go in an inset drawn from vectors)
    lons = np.linspace(BX[0], BX[2], 200)
    fx, fy = [], []
    for la in np.linspace(17.0, 54.0, 60):
        X, Y = albers(lons, np.full_like(lons, la))
        fx += list(X); fy += list(Y)
    xmin, xmax, ymin, ymax = min(fx), max(fx), min(fy), max(fy)
    W = 2400
    res = (xmax - xmin) / W
    H = int((ymax - ymin) / res)
    gx = xmin + (np.arange(W) + 0.5) * res
    gy = ymax - (np.arange(H) + 0.5) * res
    GX, GY = np.meshgrid(gx, gy)
    lon, lat = albers_inv(GX, GY)
    px = (((lon + 180) / 360 * 2 ** Z) - x0) * 256 - 0.5
    py = ((1 - np.arcsinh(np.tan(np.radians(np.clip(lat, -85, 85)))) / math.pi) / 2 * 2 ** Z - y0) * 256 - 0.5
    h = ndimage.map_coordinates(mos, [py, px], order=1, mode='nearest')

    def mask(polygons):
        """polygons: list of [outer ring, hole, ...] in lon/lat."""
        im = Image.new('L', (W, H), 0)
        dr = ImageDraw.Draw(im)
        for rings in polygons:
            for i, ring in enumerate(rings):
                X, Y = albers(np.array([c[0] for c in ring]), np.array([c[1] for c in ring]))
                dr.polygon(list(zip((X - xmin) / res, (ymax - Y) / res)), fill=255 if i == 0 else 0)
        return np.asarray(im) > 127

    cn = mask([[r] for r in country])
    # neighbours' land straight from the elevation (Terrarium bathymetry is negative); keeps islands, no 180° seams
    land = ndimage.binary_opening(h > 0.5, iterations=1) | cn
    # shading: NW light, exaggerated so ranges read at this scale
    gy_, gx_ = np.gradient(np.maximum(h, 0) / 1000.0 * 22.0, res)
    sl = np.pi / 2 - np.arctan(np.hypot(gx_, gy_))
    asp = np.arctan2(-gx_, gy_)
    az, alt = math.radians(315), math.radians(42)
    shade = np.clip(np.sin(alt) * np.sin(sl) + np.cos(alt) * np.cos(sl) * np.cos(az - asp), 0, 1)
    shade = ndimage.gaussian_filter(shade, 0.6)
    e = np.clip(h / 4500.0, 0, 1)
    paper = np.array([228, 208, 164], np.float32) / 255
    paper2 = np.array([236, 224, 194], np.float32) / 255     # neighbours: paler, lighter shading
    hill = np.array([170, 168, 120], np.float32) / 255       # 青绿山水的赭绿
    high = np.array([150, 132, 104], np.float32) / 255       # 高原褐
    sea = np.array([186, 196, 180], np.float32) / 255
    tint = paper + (hill - paper) * np.clip(e * 2.2, 0, 1)[..., None]
    tint = tint + (high - tint) * np.clip((e - 0.45) * 1.6, 0, 1)[..., None]
    k = (0.55 + 0.6 * shade)[..., None]
    cn_rgb = np.clip(tint * k, 0, 1)
    nb_rgb = np.clip(paper2 * (0.82 + 0.25 * shade)[..., None], 0, 1)
    rgb = np.where(cn[..., None], cn_rgb, np.where(land[..., None], nb_rgb, sea))
    beyond = (lon < DBX[0]) | (lon > DBX[2]) | (lat < DBX[1]) | (lat > DBX[3])  # no elevation downloaded there
    rgb = np.where(beyond[..., None], paper2, rgb)
    # paper grain
    rng = np.random.default_rng(7)
    grain = ndimage.gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), 1.2) * 0.025
    rgb = np.clip(rgb + grain[..., None], 0, 1)
    if '--relief' in sys.argv:
        Image.fromarray((rgb * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, 'relief.webp'), quality=82, method=6)
    json.dump({'xmin': xmin, 'xmax': xmax, 'ymin': ymin, 'ymax': ymax, 'w': W, 'h': H},
              open(os.path.join(OUT, 'relief.json'), 'w'))
    print('relief frame', W, H)
    # elevation grid for the ink map (mountain glyphs, sea): half resolution, same Albers frame as relief.json.
    # R = sqrt(elevation / 6000 m) on land (at least 1), 0 = sea; G = 255 inside China, 0 outside
    eh = ndimage.zoom(np.maximum(h, 0), 0.5, order=1)
    lh = ndimage.zoom(land.astype(np.float32), 0.5, order=1) > 0.5
    ch = ndimage.zoom(cn.astype(np.float32), 0.5, order=1) > 0.5
    r = np.where(lh, np.maximum(1, np.sqrt(np.clip(eh / 6000.0, 0, 1)) * 255 + 0.5), 0).astype(np.uint8)
    Image.fromarray(np.stack([r, np.where(ch, 255, 0).astype(np.uint8), np.zeros_like(r)], -1)).save(
        os.path.join(OUT, 'elev.png'), optimize=True)
    print('elev', r.shape, os.path.getsize(os.path.join(OUT, 'elev.png')) // 1024, 'KB')


if __name__ == '__main__':
    main()
