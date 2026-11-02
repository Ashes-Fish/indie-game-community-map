"""示范图用地形烘焙：ETOPO 高程 + china.json 轮廓 + Natural Earth 河流 → terrain.json
仅用于示范样片；正式版按开发文档用 TypeScript 重写并输出二进制。
"""
import json, math, re, os
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, '..', 'terrain.json')

# ---------- 网格与投影 ----------
LON0, LON1, LAT0, LAT1 = 71.0, 137.0, 14.5, 54.5
KX = math.cos(math.radians(35))
COLS = 156
W_DEG = (LON1 - LON0) * KX / COLS          # 六边形宽（投影度）
S_DEG = W_DEG / math.sqrt(3)               # 六边形半径（投影度）
ROWS = int((LAT1 - LAT0) / (1.5 * S_DEG)) + 1
SQ3 = math.sqrt(3)
N = COLS * ROWS
print('grid', COLS, ROWS, N, 'hex km≈', round(W_DEG / KX * 111 * KX, 1))

def center(col, row):
    return ((col + 0.5 * (row & 1)) * SQ3, row * 1.5)   # 世界坐标，半径 = 1

def to_lonlat(x, y):
    return (x * S_DEG / KX + LON0, LAT1 - y * S_DEG)

def from_lonlat(lon, lat):
    return ((lon - LON0) * KX / S_DEG, (LAT1 - lat) / S_DEG)

def axial(col, row):
    return col - (row - (row & 1)) // 2, row

def offset(q, r):
    return q + (r - (r & 1)) // 2, r

def idx(col, row):
    return row * COLS + col if 0 <= col < COLS and 0 <= row < ROWS else -1

DIRS = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]
def neighbors(i):
    col, row = i % COLS, i // COLS
    q, r = axial(col, row)
    out = []
    for dq, dr in DIRS:
        c, rr = offset(q + dq, r + dr)
        j = idx(c, rr)
        if j >= 0:
            out.append(j)
    return out

def pixel_to_tile(x, y):
    q = (SQ3 / 3 * x - y / 3)
    r = (2 / 3 * y)
    xx, zz = q, r
    yy = -xx - zz
    rx, ry, rz = round(xx), round(yy), round(zz)
    dx, dy, dz = abs(rx - xx), abs(ry - yy), abs(rz - zz)
    if dx > dy and dx > dz: rx = -ry - rz
    elif dy > dz: ry = -rx - rz
    else: rz = -rx - ry
    c, rr = offset(int(rx), int(rz))
    return idx(c, rr)

cx = np.zeros(N); cy = np.zeros(N); lon = np.zeros(N); lat = np.zeros(N)
for row in range(ROWS):
    for col in range(COLS):
        i = row * COLS + col
        x, y = center(col, row)
        cx[i], cy[i] = x, y
        lon[i], lat[i] = to_lonlat(x, y)

# ---------- 高程 ----------
raw = np.loadtxt(os.path.join(HERE, 'etopo.csv'), delimiter=',', skiprows=2)
lats = np.unique(raw[:, 0]); lons = np.unique(raw[:, 1])
E = np.full((len(lats), len(lons)), np.nan)
li = np.searchsorted(lats, raw[:, 0]); lj = np.searchsorted(lons, raw[:, 1])
E[li, lj] = raw[:, 2]
DLAT = lats[1] - lats[0]; DLON = lons[1] - lons[0]
def sample_block(lo, la, rlat=0.2, rlon=0.24):
    a = max(0, int((la - rlat - lats[0]) / DLAT)); b = min(len(lats), int((la + rlat - lats[0]) / DLAT) + 2)
    c = max(0, int((lo - rlon - lons[0]) / DLON)); d = min(len(lons), int((lo + rlon - lons[0]) / DLON) + 2)
    blk = E[a:b, c:d]
    return blk
emean = np.zeros(N); emax = np.zeros(N); emin = np.zeros(N); landfrac = np.zeros(N)
for i in range(N):
    blk = sample_block(lon[i], lat[i])
    emean[i] = np.nanmean(blk); emax[i] = np.nanmax(blk); emin[i] = np.nanmin(blk)
    landfrac[i] = np.mean(blk > 0)

# ---------- 中国轮廓栅格 ----------
RES = 0.04
RW, RH = int((LON1 - LON0) / RES), int((LAT1 - LAT0) / RES)
mask = Image.new('L', (RW, RH), 0)
dr = ImageDraw.Draw(mask)
geo = json.load(open(os.path.join(ROOT, 'site', 'data', 'china.json'), encoding='utf-8'))
for f in geo['features']:
    if not f['properties'].get('name'):
        continue   # 跳过非省级要素
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        for k, ring in enumerate(poly):
            pts = [((p[0] - LON0) / RES, (LAT1 - p[1]) / RES) for p in ring]
            if len(pts) > 2:
                dr.polygon(pts, fill=0 if k else 255)
M = np.array(mask) > 0
def china_at(lo, la):
    u = int((lo - LON0) / RES); v = int((LAT1 - la) / RES)
    return 0 <= u < RW and 0 <= v < RH and M[v, u]
china = np.zeros(N, bool)
OFFS = [(0, 0)] + [(0.55 * math.cos(math.radians(30 + 60 * k)), 0.55 * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
for i in range(N):
    hits = 0
    for ox, oy in OFFS:
        lo, la = to_lonlat(cx[i] + ox, cy[i] + oy)
        hits += china_at(lo, la)
    china[i] = hits >= 3 or (hits >= 2 and landfrac[i] >= .5)

# ---------- 海陆 ----------
land = china | (landfrac >= 0.5)
# 内陆的孤立水格：与外海不连通的并入陆地（湖泊另行指定）
ocean = np.zeros(N, bool); dq0 = deque(i for i in range(N) if not land[i] and (i % COLS in (0, COLS - 1) or i // COLS in (0, ROWS - 1)))
for i in dq0: ocean[i] = True
while dq0:
    i = dq0.popleft()
    for j in neighbors(i):
        if not land[j] and not ocean[j]: ocean[j] = True; dq0.append(j)
for i in range(N):
    if not land[i] and not ocean[i]:
        land[i] = True
        if any(china[j] for j in neighbors(i)): china[i] = True

# 南海诸岛：示意性小岛群（不按真实比例）
SOUTH_SEA_ISLANDS = []
rng = np.random.default_rng(7)
for (clo, cla, n, spread) in [(112.2, 16.6, 7, 0.9), (116.7, 20.7, 2, 0.25), (114.3, 15.4, 5, 0.8), (111.3, 15.7, 3, 0.5)]:
    for _ in range(n):
        lo = clo + rng.uniform(-spread, spread); la = cla + rng.uniform(-spread * .6, spread * .6)
        x, y = from_lonlat(lo, la)
        j = pixel_to_tile(x, y)
        if j >= 0 and not land[j]:
            SOUTH_SEA_ISLANDS.append(j)
islands = set(SOUTH_SEA_ISLANDS)
for j in islands:
    land[j] = True; china[j] = True

# ---------- 高度分级 ----------
BOUNDS = [100, 300, 700, 1200, 2000, 3000, 4200, 5200]
level = np.zeros(N, int)
for i in range(N):
    if land[i]:
        level[i] = 1 + sum(emean[i] >= b for b in BOUNDS)
for j in islands:
    level[j] = 1

# 湖泊
LAKES = [(100.2, 36.9, .38), (116.25, 29.05, .26), (112.95, 29.3, .2), (120.2, 31.2, .2), (118.7, 33.3, .16),
         (117.55, 31.6, .1), (90.6, 30.7, .3), (89.0, 31.8, .3), (117.4, 49.0, .2), (87.0, 42.0, .22),
         (132.4, 45.0, .35), (102.7, 24.85, .1), (84.3, 45.9, .15), (99.5, 31.3, .12), (88.5, 34.5, .2)]
lake = np.zeros(N, bool)
for lo, la, rad in LAKES:
    x, y = from_lonlat(lo, la)
    j0 = pixel_to_tile(x, y)
    if j0 >= 0: lake[j0] = True
    d = np.hypot((lon - lo) * KX, lat - la)
    lake |= (d < rad) & land

# ---------- 地貌 ----------
def hnoise(i, s=0):
    v = math.sin(i * 12.9898 + s * 78.233) * 43758.5453
    return v - math.floor(v)

def vnoise(lo, la, f=1.0, s=0):
    x, y = lo * f, la * f
    xi, yi = math.floor(x), math.floor(y)
    u, v = x - xi, y - yi
    u, v = u * u * (3 - 2 * u), v * v * (3 - 2 * v)
    h = lambda a, b: hnoise(a * 7919 + b * 104729, s)
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v

B = dict(OCEAN=0, SHALLOW=1, LAKE=2, PLAIN=3, FARMLAND=4, PADDY=5, STEPPE=6, MEADOW=7, DESERT=8, GOBI=9,
         LOESS=10, TUNDRA=11, SNOW=12, KARST=13, FORESTFLOOR=14, JUNGLEFLOOR=15)
F = dict(NONE=0, CONIFER=1, BROADLEAF=2, MIXED=3, BAMBOO=4, JUNGLE=5, PALM=6, TERRACE=7, OASIS=8, TEA=9)
inbox = lambda lo, la, a, b, c, d: a <= lo <= b and c <= la <= d

def classify(i):
    # 分区边界加噪声扰动，避免出现方块状的地貌边界
    lo = lon[i] + (vnoise(lon[i], lat[i], .55, 21) - .5) * 2.4
    la = lat[i] + (vnoise(lon[i], lat[i], .55, 37) - .5) * 1.6
    e = emean[i]
    n = vnoise(lon[i], lat[i], 1.3, 1); n2 = hnoise(i, 3)
    if e >= 5300: return B['SNOW'], F['NONE']
    # 青藏高原
    if e >= 3000 and lo < 104:
        if inbox(lo, la, 97, 103.5, 26, 33.5) and e < 4300:       # 横断山
            return B['FORESTFLOOR'], F['CONIFER'] if n2 < .75 else F['NONE']
        if la < 29.8 and lo > 91 and e < 4200:                    # 藏东南谷地
            return B['FORESTFLOOR'], F['CONIFER'] if n2 < .6 else F['NONE']
        if lo > 94 and la < 35.5 and n < .62: return B['MEADOW'], F['NONE']   # 东部高寒草甸
        return B['TUNDRA'], F['NONE']                                       # 羌塘高寒荒原
    if inbox(lo, la, 90, 98.5, 36, 38.6) and e < 3300: return B['GOBI'], F['NONE']     # 柴达木
    # 新疆
    if inbox(lo, la, 76.5, 89.8, 36.8, 41.3) and e < 1700:                              # 塔克拉玛干
        edge = (la > 40.6 or la < 37.3 or lo < 77.6)
        if edge and n2 < .35: return B['PLAIN'], F['OASIS']
        return B['DESERT'], F['NONE']
    if inbox(lo, la, 91, 96, 39.5, 41.5) and e < 1500: return B['DESERT'], F['NONE']    # 库姆塔格
    if inbox(lo, la, 84.5, 89.8, 44.2, 46.2) and e < 800: return B['DESERT'], F['NONE'] # 古尔班通古特
    if lo < 96 and la > 34:
        if e >= 2200: return B['STEPPE'], F['CONIFER'] if (n2 < .35 and la > 42) else F['NONE']
        if la > 46.3: return B['STEPPE'], F['NONE']
        return (B['GOBI'], F['NONE']) if n > .35 else (B['STEPPE'], F['NONE'])
    # 阿拉善、河西
    if inbox(lo, la, 99.5, 105.8, 37.6, 42.6) and e < 1800: return (B['DESERT'] if n > .38 else B['GOBI']), F['NONE']
    if inbox(lo, la, 96, 108, 37.5, 43.5) and e < 2200:
        if inbox(lo, la, 97, 103, 38, 40.5) and n2 < .25: return B['PLAIN'], F['OASIS']
        return B['GOBI'], F['NONE']
    # 内蒙古高原
    if la > 40.3 and inbox(lo, la, 105, 121, 38, 50) and e > 600:
        if lo < 110.5 and n > .5: return B['GOBI'], F['NONE']
        return B['STEPPE'], F['NONE']
    if inbox(lo, la, 107, 111.3, 37.6, 40.6): return B['STEPPE'], F['NONE']            # 鄂尔多斯
    if inbox(lo, la, 115, 121, 46.5, 51): return B['PLAIN'] if e < 900 else B['STEPPE'], F['NONE']  # 呼伦贝尔
    # 东北
    if inbox(lo, la, 119, 127, 46, 54) and e > 350: return B['FORESTFLOOR'], F['CONIFER']        # 大兴安岭
    if inbox(lo, la, 126.5, 131, 46.5, 50.5) and e > 250: return B['FORESTFLOOR'], F['MIXED']    # 小兴安岭
    if inbox(lo, la, 125.5, 135, 40.5, 46.5) and e > 380: return B['FORESTFLOOR'], F['MIXED']    # 长白山
    if lo > 121 and la > 41 and e < 400:
        if la > 47 and lo > 130: return B['PLAIN'], F['NONE']                                   # 三江平原
        return B['FARMLAND'], F['NONE']
    # 黄土高原
    if inbox(lo, la, 103.5, 114.2, 34.0, 39.8) and 700 <= e < 2300:
        if lo > 110.3 and la > 35.5 and e < 1100 and n2 < .5: return B['FARMLAND'], F['NONE']  # 汾河谷地
        return B['LOESS'], F['NONE']
    # 华北平原
    if 31.8 <= la <= 41 and 112.5 <= lo <= 123 and e < 220:
        return B['FARMLAND'], F['NONE']
    if inbox(lo, la, 115.5, 122.8, 35, 37.8) and e >= 220:
        return B['PLAIN'], F['BROADLEAF'] if n2 < .45 else F['NONE']                          # 山东丘陵
    # 四川盆地
    if inbox(lo, la, 103.3, 108.8, 28.3, 32.6) and e < 850:
        if n2 < .13: return B['FARMLAND'], F['BAMBOO']
        return B['PADDY'] if n2 < .55 else B['FARMLAND'], F['NONE']
    # 台湾
    if inbox(lo, la, 119.8, 122.5, 21.8, 25.5):
        if e >= 700: return B['FORESTFLOOR'], F['BROADLEAF']
        return B['PADDY'], F['NONE']
    # 热带
    if la < 21.9 or (inbox(lo, la, 99, 102.2, 21, 22.6) and e < 1500):
        if la < 21.9 and lo > 108 and e < 80 and n2 < .45: return B['PLAIN'], F['PALM']
        return B['JUNGLEFLOOR'], F['JUNGLE'] if n2 < .8 else F['PALM']
    # 云贵喀斯特
    if inbox(lo, la, 103.5, 111.5, 22.3, 27.8) and 150 <= e < 1900:
        if n > .42: return B['KARST'], F['NONE']
        if n2 < .3: return B['FORESTFLOOR'], F['TERRACE']
        return B['FORESTFLOOR'], F['BROADLEAF']
    if inbox(lo, la, 97.5, 106, 22, 28.5) and e >= 700:
        if n2 < .25: return B['FORESTFLOOR'], F['TERRACE']
        return B['FORESTFLOOR'], F['BROADLEAF'] if n2 < .75 else F['CONIFER']
    # 长江中下游
    if inbox(lo, la, 110.8, 122.5, 27.2, 33.3) and e < 130:
        return B['PADDY'], F['NONE']
    # 江南、东南丘陵
    if la < 30.5 and lo > 106:
        if e < 120: return B['PADDY'], F['NONE']
        if n2 < .16 and la > 26: return B['FORESTFLOOR'], F['TEA']
        if n2 < .3: return B['FORESTFLOOR'], F['BAMBOO']
        return B['FORESTFLOOR'], F['BROADLEAF']
    # 秦岭、大巴山、太行
    if e >= 1100: return B['FORESTFLOOR'], F['MIXED'] if la > 32 else F['BROADLEAF']
    if la >= 33: return B['FARMLAND'], F['NONE']
    return B['FORESTFLOOR'], F['BROADLEAF'] if n2 < .7 else F['NONE']

def classify_foreign(i):
    lo, la, e = lon[i], lat[i], emean[i]; n2 = hnoise(i, 3)
    if e >= 5000: return B['SNOW'], F['NONE']
    if e >= 3000: return B['TUNDRA'], F['NONE']
    if la > 50: return B['FORESTFLOOR'], F['CONIFER']
    if lo < 120 and la > 42: return (B['STEPPE'] if la > 45 or lo > 108 else B['GOBI']), F['NONE']
    if lo < 75 and la > 36: return B['STEPPE'], F['NONE']
    if lo >= 124 and la > 33: return B['FORESTFLOOR'], F['MIXED'] if n2 < .7 else F['NONE']
    if la < 24 and lo > 92: return B['JUNGLEFLOOR'], F['JUNGLE']
    if la < 28 and lo < 92: return B['FARMLAND'], F['NONE']
    return B['PLAIN'], F['BROADLEAF'] if n2 < .5 else F['NONE']

biome = np.zeros(N, int); feat = np.zeros(N, int); relief = np.zeros(N, int)
for i in range(N):
    if not land[i]:
        biome[i] = B['SHALLOW'] if emean[i] > -150 else B['OCEAN']
        continue
    if lake[i]:
        biome[i] = B['LAKE']; continue
    b, f = classify(i) if china[i] else classify_foreign(i)
    if i in islands: b, f = B['PLAIN'], F['PALM'] if hnoise(i, 5) < .6 else F['NONE']
    biome[i], feat[i] = b, f
    rel = emax[i] - emean[i]
    if emax[i] > 6000 or (level[i] >= 4 and rel > 950) or (level[i] >= 3 and rel > 1300) or (level[i] >= 8 and rel > 550):
        relief[i] = 2
    elif rel > 380 and level[i] >= 2 and b not in (B['DESERT'],):
        relief[i] = 1
    if relief[i] == 2 and f in (F['TERRACE'], F['TEA'], F['OASIS'], F['PALM']): feat[i] = F['NONE']

# 海岸：邻接陆地的海洋一律视为浅海
for i in range(N):
    if not land[i] and (emean[i] > -120 or any(land[j] and not lake[j] for j in neighbors(i))):
        biome[i] = B['SHALLOW']
# 湖泊水位取周边最低陆地高度
for i in range(N):
    if lake[i]:
        ls = [level[j] for j in neighbors(i) if land[j] and not lake[j]]
        level[i] = min(ls) if ls else level[i]

# ---------- 视野 / 迷雾 ----------
vis = china.copy()
dist = np.full(N, 99)
q = deque()
for i in range(N):
    if china[i]: dist[i] = 0; q.append(i)
while q:
    i = q.popleft()
    for j in neighbors(i):
        if dist[j] > dist[i] + 1: dist[j] = dist[i] + 1; q.append(j)
def sea_d(i):   # 南海示意区：椭圆形，边缘带噪声
    return math.hypot((lon[i] - 113.4) / 5.6, (lat[i] - 17.6) / 4.2) + (vnoise(lon[i], lat[i], 1.1, 5) - .5) * .35
south_sea = np.array([(not land[i]) and sea_d(i) < 1.0 for i in range(N)])
fog = np.zeros(N)        # 0 = 全彩, 1 = 完全羊皮纸
drawn = np.zeros(N, bool)
for i in range(N):
    jit = (vnoise(lon[i], lat[i], .9, 9) - .5) * 3.0
    east_sea = (not land[i]) and lon[i] > 105 and dist[i] <= 16
    if china[i]:
        fog[i] = 0; drawn[i] = True
    elif not land[i] and (dist[i] + jit * .5 <= 4.5 or south_sea[i]):
        fog[i] = 0; drawn[i] = True
    elif east_sea:   # 东部、南部海域保持为海，逐渐淡出
        drawn[i] = True
        fog[i] = float(np.clip((dist[i] + jit - 8) / 8, 0, .8))
    else:
        d = dist[i] + jit
        if d <= 7.5:
            drawn[i] = True
            fog[i] = float(np.clip((d - 0.5) / 3.0, .4, 1.0)) if land[i] else float(np.clip((d - 4) / 3.0, .3, 1.0))
# 南海示意区外缘也做渐隐
for i in range(N):
    if south_sea[i] and not china[i] and dist[i] > 4:
        fog[i] = max(fog[i], float(np.clip((sea_d(i) - .7) / .3, 0, .85)))

# ---------- 河流（吸附到六边形边） ----------
def corner(i, k):
    a = math.radians(60 * k + 30)
    return cx[i] + math.cos(a), cy[i] + math.sin(a)
vkey = lambda x, y: (round(x * 50), round(y * 50))
vpos = {}; vadj = {}; edge_tiles = {}
for i in range(N):
    ks = [vkey(*corner(i, k)) for k in range(6)]
    for k in range(6):
        vpos[ks[k]] = corner(i, k)
        a, b = ks[k], ks[(k + 1) % 6]
        vadj.setdefault(a, set()).add(b); vadj.setdefault(b, set()).add(a)
        e = (a, b) if a < b else (b, a)
        edge_tiles.setdefault(e, []).append((i, k))

def nearest_vertex(x, y):
    i = pixel_to_tile(x, y)
    if i < 0: return None
    best = None; bd = 9
    for k in range(6):
        px, py = corner(i, k); d = (px - x) ** 2 + (py - y) ** 2
        if d < bd: bd, best = d, vkey(px, py)
    return best

def bfs(a, b, lim=6):
    prev = {a: None}; dq = deque([a])
    while dq:
        u = dq.popleft()
        if u == b: break
        for v in vadj.get(u, ()):
            if v not in prev:
                prev[v] = u; dq.append(v)
        if len(prev) > 400: break
    if b not in prev: return [a, b]
    path = [b]
    while path[-1] != a: path.append(prev[path[-1]])
    return path[::-1]

RIVER_NAMES = {'Tuotuo': 1, 'Tongtian': 1, 'Jinsha': 1, 'Chang Jiang': 1, 'Yangtze': 1, 'Huang': 1, 'Yarlung': 1,
               'Heilong Jiang': 1, 'Songhua': 2, 'Di’er Songhua': 2, 'Liao': 2, 'Xi': 1, 'Hongshui': 2, 'Xun': 2,
               'Han': 2, 'Gan': 2, 'Xiang': 2, 'Yuan': 3, 'Min': 3, 'Jialing': 2, 'Wu': 3, 'Tarim': 2,
               'Yarkant': 3, 'Huai': 2, 'Lancang': 2, 'Nu': 2, 'Dadu': 3, 'Yalong': 3, 'Ertix': 3, 'Ertis': 3,
               'Nanpan': 3, 'Fuchun': 3, 'Ou': 3, 'Wujia': 3, 'Yongding': 3, 'Hai': 3, 'Konqi': 3, 'Bei': 3,
               'Dong': 3, 'You': 3, 'Yu': 3, 'Maquan': 2, 'Za': 3}
rv = json.load(open(os.path.join(HERE, 'rivers.geojson'), encoding='utf-8'))
# Natural Earth 的长江止于镇江，钱塘江止于杭州；手动补上入海段
rv['features'] += [
    {'properties': {'name': 'Yangtze'}, 'geometry': {'type': 'LineString', 'coordinates': [[119.6, 32.2], [120.3, 32.0], [120.9, 31.8], [121.5, 31.5], [121.95, 31.3]]}},
    {'properties': {'name': 'Fuchun'}, 'geometry': {'type': 'LineString', 'coordinates': [[120.15, 30.2], [120.6, 30.35], [121.0, 30.45]]}},
]
river = {}
for f in rv['features']:
    p = f['properties']; name = p.get('name')
    if name not in RIVER_NAMES or not f['geometry']: continue
    tier = RIVER_NAMES[name]
    g = f['geometry']
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    for line in lines:
        pts = []
        for a, b in zip(line, line[1:]):
            n = max(1, int(math.hypot((b[0] - a[0]) * KX, b[1] - a[1]) / (S_DEG * .35)))
            for t in range(n):
                pts.append((a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n))
        pts.append(tuple(line[-1]))
        seq = []
        for lo, la in pts:
            if not (LON0 < lo < LON1 and LAT0 < la < LAT1) or not china_at(lo, la):
                seq.append(None); continue
            v = nearest_vertex(*from_lonlat(lo, la))
            if v and (not seq or seq[-1] != v): seq.append(v)
        for a, b in zip(seq, seq[1:]):
            if a is None or b is None: continue
            path = bfs(a, b)
            for u, v in zip(path, path[1:]):
                e = (u, v) if u < v else (v, u)
                river[e] = min(river.get(e, 9), tier)
river_edges = []
for e, tier in river.items():
    ts = edge_tiles.get(e, [])
    if len(ts) != 2: continue
    (i, ki), (j, kj) = ts
    if not (drawn[i] and drawn[j]): continue
    if not (land[i] or land[j]): continue
    if lake[i] and lake[j]: continue
    (x1, y1), (x2, y2) = vpos[e[0]], vpos[e[1]]
    river_edges.append([round(x1, 3), round(y1, 3), round(x2, 3), round(y2, 3), i, j, tier])
print('river edges', len(river_edges))

# ---------- 社团落点 ----------
txt = open(os.path.join(ROOT, 'site', 'data.js'), encoding='utf-8').read()
comms = json.loads(re.sub(r'^\s*window\.COMMUNITIES\s*=\s*', '', txt).rstrip().rstrip(';'))
used = set(); sites = []
for c in comms:
    x, y = from_lonlat(c['lng'], c['lat'])
    start = pixel_to_tile(x, y)
    seen = {start}; dq = deque([start]); pick = None
    while dq:
        i = dq.popleft()
        if china[i] and land[i] and not lake[i] and relief[i] < 2 and i not in used and i not in islands:
            pick = i; break
        for j in neighbors(i):
            if j not in seen: seen.add(j); dq.append(j)
    used.add(pick)
    feat[pick] = F['NONE']
    sites.append(dict(name=c['name'], city=c['city'], founded=c.get('founded') or '', tile=int(pick),
                      logo=c.get('logo') or '', intro=c.get('intro') or ''))

out = dict(cols=COLS, rows=ROWS, level=level.tolist(), biome=biome.tolist(), feat=feat.tolist(),
           relief=relief.tolist(), fog=[round(float(v), 2) for v in fog], drawn=drawn.astype(int).tolist(),
           china=china.astype(int).tolist(), rivers=river_edges, sites=sites,
           islands=sorted(int(i) for i in islands),
           lon=[round(float(v), 2) for v in lon], lat=[round(float(v), 2) for v in lat])
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
with open(OUT.replace('.json', '.js'), 'w', encoding='utf-8') as fh:
    fh.write('window.TERRAIN=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';')
print('china tiles', int(china.sum()), 'drawn', int(drawn.sum()), 'lakes', int(lake.sum()),
      'mountains', int((relief == 2).sum()), 'hills', int((relief == 1).sum()), 'sites', len(sites))
print('size KB', os.path.getsize(OUT) // 1024)
