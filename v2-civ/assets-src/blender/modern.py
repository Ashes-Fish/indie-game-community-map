# 现代建筑（2026）：社群据点 7 种 + 城市中心 CBD 天际线。和 models.py 共用 lib 的材质、基本体和烘焙流程。
# 约定同 lib：1 单位 = 地图 1 单位，Z 向上，正面朝 -Y（地图的南，镜头一侧）。
# 据点：底座外接圆 0.7·HEX_R，主体 ≤ 4.7×4.7、限高 4；旗杆点 (±2.7,-2.0)、(±2.6,2.3) 留空。
# 城市：底座外接圆 5.45；南侧中轴（中华门这类城门地标）和半径 4 以外（东方明珠、宝塔等地标）留空。
import math
import random

import bmesh
import lib
from lib import PARTS, WALL_Z0, _finish, ball, box, cyl, ngon, prism, sweep  # noqa: F401
from mathutils import Quaternion, Vector

HEX_R = 6.5

lib.PAL.update({
    'plaza': '#cdc8bd', 'plaza_dk': '#a8a397', 'curb': '#8d8981', 'walk': '#bdb5a5',
    'concrete': '#bcb7ad', 'concrete_dk': '#878279', 'roof_flat': '#9b968c',
    'panel': '#ece8e0', 'panel_warm': '#e2d0b4', 'white': '#f3f2ee',
    'glass': '#5b8cb0', 'glass_teal': '#4e9a9e', 'glass_dk': '#2e4156', 'glass_gold': '#b89755', 'mullion': '#dde3e8',
    'metal': '#7d848c', 'metal_dk': '#3c424a', 'dark': '#262a35',
    'asphalt': '#595c60', 'lane': '#e6dfc3', 'grass': '#77a23d', 'solar': '#2a3c5b',
    'brick': '#a5583c', 'timber': '#c48e57', 'timber_dk': '#7a5638',
    'red': '#d2483a', 'yellow': '#e7b53b', 'blue': '#3c7bc8', 'teal': '#2fb39e', 'pink': '#df5f99', 'orange': '#e5793a',
    'glow_cyan': '#3ff2ff', 'glow_pink': '#ff4fd8', 'glow_warm': '#ffcf73', 'glow_white': '#e6f4ff',
    'glow_red': '#ff3048', 'glow_screen': '#58c2ff', 'glow_green': '#5dff9c', 'glow_amber': '#ffb03a',
})
lib.KIND.update({
    'plaza': 'paving', 'plaza_dk': 'paving', 'walk': 'paving',
    'panel': 'wall', 'panel_warm': 'wall', 'white': 'wall',
    'glass': 'glass', 'glass_teal': 'glass', 'glass_dk': 'glass', 'glass_gold': 'glass',
    'grass': 'leaf', 'brick': 'brick', 'timber': 'plank', 'timber_dk': 'plank',
})


# ---------------------------------------------------------------- 通用件
def base_plaza(R=HEX_R * 0.7, h=0.22, below=0.35, lawn=True):
    """现代版地块底座：尖角朝南北的六边形，混凝土侧壁 + 浅色铺地 + 路缘石，南角一条步道，角上草坪。"""
    poly = ngon(6, R, rot=math.pi / 2)
    inner = ngon(6, R - 0.26, rot=math.pi / 2)
    prism([(x * 1.03, y * 1.03) for x, y in poly], poly, -below, h - 0.06, 'concrete_dk', bevel=0.03)
    prism(inner, inner, h - 0.1, h, 'plaza', bevel=0.0)
    for i in range(6):
        a, b = Vector(poly[i]), Vector(poly[(i + 1) % 6])
        ia, ib = Vector(inner[i]), Vector(inner[(i + 1) % 6])
        quad = [tuple(a), tuple(b), tuple(ib), tuple(ia)]
        prism(quad, quad, h - 0.1, h + 0.03, 'curb', bevel=0.015)
    box(0.9, R - 1.6, 0.02, 0, -(R + 1.6) / 2 + 0.05, h, 'walk', bevel=0.0)
    if lawn:  # 东西两角的草坪
        for i in (1, 4):
            p = Vector(poly[i]) * 0.72
            box(1.2, 1.0, 0.04, p.x, p.y, h, 'grass', bevel=0.0)
    return h


def pine(x, y, z0, s=1.0):
    cyl(0.05 * s, 0.07 * s, 0.35 * s, 5, x, y, z0, 'trunk')
    for k, (r, hh) in enumerate(((0.42, 0.75), (0.32, 0.62), (0.2, 0.5))):
        cyl(r * s, 0.0, hh * s, 6, x, y, z0 + (0.2 + k * 0.35) * s, 'leaf2' if k else 'leaf')


def street_tree(x, y, z0, s=1.0):
    cyl(0.04 * s, 0.06 * s, 0.4 * s, 5, x, y, z0, 'trunk')
    ball(0.3 * s, x, y, z0 + 0.62 * s, 'leaf', sub=1, sz=0.9)


def lamp(x, y, z0, h=0.75):
    cyl(0.025, 0.03, h, 5, x, y, z0, 'metal_dk')
    box(0.16, 0.06, 0.04, x, y, z0 + h, 'metal_dk', bevel=0.0)
    box(0.12, 0.05, 0.03, x, y, z0 + h - 0.03, 'glow_white', bevel=0.0, glow=True)


def bench(x, y, z0, w=0.6, rz=0.0):
    box(w, 0.16, 0.05, x, y, z0 + 0.14, 'timber', rz=rz, bevel=0.0)
    box(w * 0.9, 0.12, 0.14, x, y, z0, 'concrete', rz=rz, bevel=0.0)


def car(x, y, z0, rz, color):
    box(0.42, 0.2, 0.1, x, y, z0 + 0.03, color, rz=rz, bevel=0.02)
    box(0.24, 0.17, 0.08, x, y, z0 + 0.13, 'glass_dk', rz=rz, bevel=0.0)


def planter(x, y, z0, w, d):
    box(w, d, 0.12, x, y, z0, 'concrete', bevel=0.02)
    box(w - 0.08, d - 0.08, 0.03, x, y, z0 + 0.12, 'grass', bevel=0.0)


def rooftop(x, y, z, w, d, rng, solar=False):
    """屋顶：女儿墙压顶 + 设备箱 + 可选太阳能板。"""
    box(w + 0.04, d + 0.04, 0.06, x, y, z, 'roof_flat', bevel=0.0)
    for _ in range(2 if w * d > 0.6 else 1):
        bw, bd = 0.18 + rng.random() * 0.2, 0.18 + rng.random() * 0.2
        box(bw, bd, 0.14, x + (rng.random() - 0.5) * (w - bw - 0.1), y + (rng.random() - 0.5) * (d - bd - 0.1), z + 0.06, 'metal',
            bevel=0.0)
    if solar:
        for k in range(3):
            box(w * 0.7, 0.14, 0.03, x, y - d * 0.3 + k * 0.2, z + 0.1, 'solar', bevel=0.0)


def floor_lines(x, y, z0, w, d, h, rz=0.0, step=0.32, mat='panel'):
    """玻璃楼外的楼板线：每隔一层一圈浅色横带，强调层数和体量。"""
    n = int(h / step)
    for k in range(1, n):
        box(w + 0.03, d + 0.03, 0.035, x, y, z0 + k * step, mat, rz=rz, bevel=0.0)


def extrude_x(profile, x0, x1, mat, bevel=0.0):
    """把 yz 平面的多边形沿 x 拉伸（锯齿屋顶、斜顶）。profile 逆时针 [(y, z), ...]。"""
    bm = bmesh.new()
    va = [bm.verts.new((x0, y, z)) for y, z in profile]
    vb = [bm.verts.new((x1, y, z)) for y, z in profile]
    n = len(va)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    bm.faces.new(list(reversed(va)))
    bm.faces.new(vb)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(bm, 'ext', [mat], bevel)


def torus(R, r, x, y, z, mat, rx=0.0, seg=24, sides=8):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(sides):
            b = 2 * math.pi * j / sides
            p = Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
            if rx:
                p.rotate(Quaternion((1, 0, 0), rx))
            ring.append(bm.verts.new(p + Vector((x, y, z))))
        rings.append(ring)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for j in range(sides):
            k = (j + 1) % sides
            bm.faces.new((a[j], b[j], b[k], a[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(bm, 'torus', [mat], smooth=True)


# ---------------------------------------------------------------- 塔楼（CBD 和据点共用）
def tower_box(x, y, z0, w, d, h, rng, mat='glass', tiers=None, crown=False):
    """方塔：1–3 段退台，楼板线，屋顶设备；crown 加顶冠和避雷针。"""
    tiers = tiers or (1 if h < 1.6 else (2 if h < 3.2 else 3))
    zz, ww, dd = z0, w, d
    for t in range(tiers):
        seg = h / tiers * (1.15 if t == 0 else 0.95 if t < tiers - 1 else 0.9)
        if t == tiers - 1:
            seg = z0 + h - zz
        box(ww, dd, seg, x, y, zz, mat, bevel=0.02)
        floor_lines(x, y, zz, ww, dd, seg, step=0.42 if mat != 'panel' else 0.3)
        zz += seg
        if t < tiers - 1:
            box(ww + 0.02, dd + 0.02, 0.05, x, y, zz, 'roof_flat', bevel=0.0)
            ww, dd = ww * 0.78, dd * 0.78
    if crown:
        box(ww * 0.7, dd * 0.7, 0.25, x, y, zz, 'metal', bevel=0.015)
        cyl(0.02, 0.035, 0.6, 5, x, y, zz + 0.25, 'metal_dk')
        ball(0.04, x, y, zz + 0.86, 'glow_red', sub=0, glow=True)
    else:
        rooftop(x, y, zz, ww, dd, rng)
    return zz


def tower_round(x, y, z0, r, h, mat='glass_teal'):
    cyl(r, r * 0.92, h, 14, x, y, z0, mat, smooth=False)
    for k in range(1, int(h / 0.42)):
        cyl(r * 1.02, r * 1.02, 0.035, 14, x, y, z0 + k * 0.42 * (1 - 0.08 * k * 0.42 / h), 'panel')
    cyl(r * 0.92, r * 0.6, 0.18, 14, x, y, z0 + h, 'metal')
    return z0 + h + 0.18


def tower_twist(x, y, z0, r, h, twist=0.9, mat='glass'):
    """扭转塔：逐段旋转并收分的四边形截面。"""
    n = max(3, int(h / 0.45))
    for k in range(n):
        za, zb = z0 + h * k / n, z0 + h * (k + 1) / n
        ra, rb = r * (1 - 0.25 * k / n), r * (1 - 0.25 * (k + 1) / n)
        pa = ngon(4, ra, rot=math.pi / 4 + twist * k / n)
        pb = ngon(4, rb, rot=math.pi / 4 + twist * (k + 1) / n)
        prism([(x + px, y + py) for px, py in pa], [(x + px, y + py) for px, py in pb], za, zb, mat, bevel=0.0)
        box(rb * 1.2, rb * 1.2, 0.03, x, y, zb - 0.015, 'panel', rz=math.pi / 4 + twist * (k + 1) / n, bevel=0.0)
    cyl(0.03, 0.04, 0.7, 5, x, y, z0 + h, 'metal_dk')
    return z0 + h + 0.7


def slab(x, y, z0, w, d, h, rz=0.0, mat='panel'):
    """住宅 / 办公板楼：实墙 + 前后通长窗带。"""
    box(w, d, h, x, y, z0, mat, rz=rz, bevel=0.02)
    n = int(h / 0.22)
    c, s = math.cos(rz), math.sin(rz)
    for k in range(n):
        zz = z0 + 0.1 + k * 0.22
        for side in (-1, 1):
            ox, oy = -s * side * (d / 2 + 0.005), c * side * (d / 2 + 0.005)
            box(w * 0.88, 0.02, 0.09, x + ox, y + oy, zz, 'glass_dk', rz=rz, bevel=0.0)
    box(w + 0.03, d + 0.03, 0.05, x, y, z0 + h, 'roof_flat', rz=rz, bevel=0.0)
    return z0 + h


# ---------------------------------------------------------------- 社群据点 7 种
def incubator():
    """独立游戏孵化器（原 会馆戏台 / Ludere 互助社区）：后面一栋玻璃办公楼，前面带大屏的路演厅。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    rng = random.Random(1)
    # 办公楼：玻璃体 + 白色楼板 + 屋顶花园 + 招牌
    tower_box(-0.4, 1.25, z0, 3.0, 1.45, 1.9, rng, mat='glass', tiers=1)
    box(3.1, 1.55, 0.06, -0.4, 1.25, z0 + 1.9, 'panel', bevel=0.0)
    box(2.6, 1.1, 0.04, -0.4, 1.25, z0 + 1.96, 'grass', bevel=0.0)
    for x in (-1.3, -0.2, 0.7):
        street_tree(x, 1.4, z0 + 1.96, 0.55)
    box(1.3, 0.06, 0.28, -0.4, 0.45, z0 + 2.0, 'metal_dk', bevel=0.0)
    box(1.15, 0.03, 0.18, -0.4, 0.42, z0 + 2.05, 'glow_amber', bevel=0.0, glow=True)
    # 路演厅：低矮白盒子 + 悬挑屋面 + 南立面大屏
    box(1.9, 1.25, 0.72, 0.75, -0.55, z0, 'white', bevel=0.03)
    box(2.3, 1.6, 0.1, 0.75, -0.6, z0 + 0.72, 'panel', bevel=0.02)
    box(1.5, 0.03, 0.5, 0.75, -1.19, z0 + 0.14, 'glass', bevel=0.0)
    box(0.95, 0.04, 0.42, 0.75, -1.43, z0 + 0.86, 'metal_dk', bevel=0.0)
    box(0.85, 0.03, 0.34, 0.75, -1.46, z0 + 0.9, 'glow_screen', bevel=0.0, glow=True)
    for sx in (-0.05, 1.55):
        cyl(0.03, 0.03, 0.72, 6, sx, -1.35, z0, 'metal')
    # 广场：长凳、花坛、路灯、自行车
    for x in (-1.6, -0.9):
        bench(x, -1.1, z0, 0.55)
    planter(-1.25, -0.4, z0, 0.9, 0.35)
    for x in (-1.9, 1.9):
        lamp(x, -2.9, z0)
    for k in range(4):
        box(0.05, 0.3, 0.16, 1.85 + k * 0.12, 0.55, z0, k % 2 and 'blue' or 'red', bevel=0.0)
    street_tree(-2.9, 0.4, z0, 1.0)
    street_tree(2.95, 0.6, z0, 0.95)
    return z0


def ring():
    """环形社区客厅（原 土楼 / 游戏客厅）：多边形环楼、屋顶草坪、中庭大树，南面玻璃门厅。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    n, rm, dep, H = 18, 1.72, 0.62, 1.05
    for k in range(n):
        a = -math.pi / 2 + (k + 0.5) * 2 * math.pi / n
        if k in (0, n - 1):  # 南面正中两段留作门洞
            continue
        x, y = math.cos(a) * rm, math.sin(a) * rm
        w = 2 * math.pi * rm / n * 1.04
        rz = a + math.pi / 2
        box(w, dep, H, x, y, z0, 'white', rz=rz, bevel=0.0)
        ox, oy = math.cos(a) * (dep / 2 + 0.01), math.sin(a) * (dep / 2 + 0.01)
        box(w * 0.98, 0.03, 0.26, x + ox, y + oy, z0 + 0.18, 'glass_teal', rz=rz, bevel=0.0)
        box(w * 0.98, 0.03, 0.26, x + ox, y + oy, z0 + 0.62, 'glass_teal', rz=rz, bevel=0.0)
        box(w * 1.0, dep * 0.8, 0.04, x, y, z0 + H, 'grass', rz=rz, bevel=0.0)
        if k % 3 == 1:  # 内圈暖光窗：大家在家
            ix, iy = -math.cos(a) * (dep / 2 + 0.01), -math.sin(a) * (dep / 2 + 0.01)
            box(w * 0.5, 0.03, 0.2, x + ix, y + iy, z0 + 0.62, 'glow_warm', rz=rz, bevel=0.0, glow=True)
    # 南面门厅：玻璃盒子 + 白色雨篷
    box(1.1, 0.7, 0.62, 0, -1.72, z0, 'glass', bevel=0.02)
    box(1.5, 0.95, 0.07, 0, -1.8, z0 + 0.62, 'panel', bevel=0.0)
    box(0.7, 0.04, 0.16, 0, -2.29, z0 + 0.5, 'glow_warm', bevel=0.0, glow=True)
    # 中庭：草地、大树、环形长椅
    cyl(1.05, 1.05, 0.03, 18, 0, 0, z0, 'grass')
    street_tree(0, 0.1, z0, 1.35)
    for k in range(5):
        a = k * 2 * math.pi / 5 + 0.3
        bench(math.cos(a) * 0.75, math.sin(a) * 0.75, z0, 0.35, rz=a + math.pi / 2)
    for x, y in ((-2.9, 0.3), (2.9, 0.3)):
        street_tree(x, y, z0, 1.0)
    for x in (-1.4, 1.4):
        lamp(x, -2.7, z0)
    return z0


def neon():
    """霓虹电竞塔 · 咖啡馆（原 赛博塔 / 赛博利亚）：深色玻璃塔、霓虹腰线、竖屏、屋顶天线；玻璃咖啡馆和外摆伞。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    rng = random.Random(3)
    tx, ty, w, H = -0.7, 0.9, 1.45, 3.5
    box(w, w, H, tx, ty, z0, 'glass_dk', bevel=0.03)
    for k in range(6):  # 四面霓虹腰线
        zz = z0 + 0.45 + k * 0.52
        mat = 'glow_cyan' if k % 2 else 'glow_pink'
        box(w + 0.04, w + 0.04, 0.05, tx, ty, zz, mat, bevel=0.0, glow=True)
    box(0.55, 0.04, 1.3, tx + 0.3, ty - w / 2 - 0.02, z0 + 1.1, 'glow_screen', bevel=0.0, glow=True)  # 南面竖屏
    box(w * 0.7, w * 0.7, 0.35, tx, ty, z0 + H, 'dark', bevel=0.02)
    box(w * 0.72, w * 0.72, 0.05, tx, ty, z0 + H + 0.2, 'glow_cyan', bevel=0.0, glow=True)
    cyl(0.03, 0.05, 1.0, 5, tx, ty, z0 + H + 0.35, 'metal')
    ball(0.07, tx, ty, z0 + H + 1.38, 'glow_red', sub=0, glow=True)
    # 塔下裙楼
    box(2.0, 1.0, 0.45, tx + 0.2, ty - 0.2, z0, 'dark', bevel=0.02)
    rooftop(tx + 0.9, ty - 0.2, z0 + 0.45, 0.5, 0.9, rng)
    # 咖啡馆：玻璃盒（里面暖光）+ 深色屋面 + 霓虹招牌
    cx, cy = 1.15, -0.75
    box(1.6, 1.05, 0.62, cx, cy, z0, 'glow_warm', bevel=0.0, glow=True)
    for dx in (-0.8, -0.4, 0.0, 0.4, 0.8):
        box(0.05, 1.07, 0.62, cx + dx, cy, z0, 'metal_dk', bevel=0.0)
    box(1.8, 1.25, 0.09, cx, cy, z0 + 0.62, 'metal_dk', bevel=0.0)
    box(0.9, 0.04, 0.2, cx, cy - 0.64, z0 + 0.72, 'glow_pink', bevel=0.0, glow=True)
    # 外摆：遮阳伞 + 小桌
    for k, (x, y) in enumerate(((0.55, -1.75), (1.25, -1.85), (1.95, -1.7))):
        cyl(0.02, 0.02, 0.5, 5, x, y, z0, 'metal_dk')
        cyl(0.32, 0.02, 0.14, 8, x, y, z0 + 0.42, ('red', 'teal', 'yellow')[k])
        cyl(0.12, 0.12, 0.04, 8, x, y, z0 + 0.22, 'white')
    for x, y in ((-2.85, -0.4), (2.9, 0.9)):
        street_tree(x, y, z0, 0.95)
    box(0.3, 0.2, 0.42, -1.75, -0.6, z0, 'red', bevel=0.02)  # 自动售货机
    box(0.22, 0.03, 0.26, -1.75, -0.71, z0 + 0.1, 'glow_white', bevel=0.0, glow=True)
    return z0


def dome():
    """穹顶科技馆（原 观星台 / 星游集）：白色天象厅穹顶坐在玻璃裙楼上，前庭立一颗发光的星。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    dy, zp = 0.9, z0 + 0.55
    box(3.4, 2.6, 0.55, 0, dy, z0, 'panel', bevel=0.03)
    box(3.0, 0.03, 0.3, 0, dy - 1.31, z0 + 0.12, 'glass', bevel=0.0)
    box(3.5, 2.7, 0.05, 0, dy, zp, 'roof_flat', bevel=0.0)
    cyl(1.25, 1.25, 0.14, 24, 0, dy, zp + 0.05, 'metal_dk')
    ball(1.18, 0, dy, zp + 0.19, 'white', sub=3)
    # 穹顶开缝：从顶点向南的一条深色带
    sweep([(0, dy - 1.2 * math.sin(t), zp + 0.19 + 1.2 * math.cos(t)) for t in [k * 0.22 for k in range(7)]], 0.18, 0.04, 'metal_dk')
    # 东侧：低矮玻璃展厅；裙楼屋顶西北角：射电小天线
    box(1.2, 1.0, 0.5, 1.9, -0.55, z0, 'glass_teal', bevel=0.02)
    box(1.35, 1.15, 0.06, 1.9, -0.55, z0 + 0.5, 'panel', bevel=0.0)
    cyl(0.05, 0.07, 0.55, 6, -1.35, 1.85, zp + 0.05, 'metal')
    cyl(0.42, 0.08, 0.16, 12, -1.35, 1.85, zp + 0.6, 'white')
    # 前庭的星：细杆 + 发光八面体
    cyl(0.03, 0.04, 1.3, 5, -1.1, -1.25, z0, 'metal_dk')
    ball(0.26, -1.1, -1.25, z0 + 1.55, 'glow_white', sub=0, glow=True, sz=1.5)
    for k in range(6):
        a = k * math.pi / 3
        ball(0.04, -1.1 + math.cos(a) * 0.5, -1.25 + math.sin(a) * 0.5, z0 + 0.04, 'glow_white', sub=0, glow=True)
    for x, y in ((-2.9, -0.2), (2.95, 0.7)):
        street_tree(x, y, z0, 1.0)
    for x in (-0.5, 0.5):
        bench(x, -1.6, z0, 0.5)
    return z0


def street():
    """潮玩街区（原 牌坊市街 / 创乐坊）：南口 LED 门架，步行街两侧彩色集装箱小店，街心串灯，尽头一栋潮玩商场。"""
    z0 = base_plaza(lawn=False)
    WALL_Z0[0] = z0
    # 门架
    for sx in (-1.3, 1.3):
        box(0.16, 0.16, 1.35, sx, -2.05, z0, 'metal_dk', bevel=0.01)
    box(2.9, 0.18, 0.3, 0, -2.05, z0 + 1.35, 'metal_dk', bevel=0.01)
    box(2.4, 0.04, 0.2, 0, -2.16, z0 + 1.4, 'glow_screen', bevel=0.0, glow=True)
    # 步行街
    box(1.0, 3.9, 0.02, 0, 0.0, z0, 'plaza_dk', bevel=0.0)
    colors = ['red', 'yellow', 'blue', 'teal', 'pink', 'orange']
    k = 0
    for side in (-1, 1):
        for j in range(4):
            y = -1.25 + j * 0.92
            x = side * 1.12
            c = colors[k % len(colors)]
            k += 1
            box(0.95, 0.78, 0.46, x, y, z0, c, bevel=0.02)
            box(0.03, 0.5, 0.3, x - side * 0.49, y, z0 + 0.04, 'glow_warm', bevel=0.0, glow=True)  # 朝街的店面
            for rr in range(3):  # 集装箱瓦楞
                box(0.97, 0.02, 0.42, x, y - 0.3 + rr * 0.3, z0 + 0.02, 'metal_dk', bevel=0.0)
            if (j + (side > 0)) % 2 == 0 and j < 3:  # 叠第二层
                c2 = colors[(k + 2) % len(colors)]
                box(0.95, 0.78, 0.44, x, y + 0.05, z0 + 0.46, c2, rz=side * 0.08, bevel=0.02)
                box(0.03, 0.45, 0.22, x - side * 0.49, y + 0.05, z0 + 0.56, 'glow_warm', bevel=0.0, glow=True)
        k += 1
    # 串灯：横跨街道的灯泡
    for j in range(4):
        y = -1.25 + j * 0.92
        for t in range(7):
            u = -0.6 + t * 0.2
            ball(0.03, u, y, z0 + 0.95 - 0.12 * (1 - (u / 0.6) ** 2), 'glow_amber', sub=0, glow=True)
    # 尽头商场：两层，玻璃 + 屋顶广告牌
    rng2 = random.Random(6)
    box(2.8, 0.95, 1.0, 0, 2.35, z0, 'glass', bevel=0.03)
    floor_lines(0, 2.35, z0, 2.8, 0.95, 1.0, step=0.5)
    rooftop(0, 2.35, z0 + 1.0, 2.8, 0.95, rng2)
    box(1.6, 0.08, 0.5, 0, 2.0, z0 + 1.06, 'metal_dk', bevel=0.0)
    box(1.5, 0.04, 0.42, 0, 1.95, z0 + 1.1, 'glow_pink', bevel=0.0, glow=True)
    for x in (-2.2, 2.2):
        street_tree(x, 0.0, z0, 0.85)
    return z0


def save():
    """存档站（原 存档亭 / 存档点）：六柱白色雨篷下的休息区，上空悬浮发光存档水晶，旁边售货机和充电桩。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    hexr = 1.45
    cyl(hexr + 0.1, hexr + 0.15, 0.12, 6, 0, 0.2, z0, 'concrete', rz=math.pi / 6)
    for x, y in ngon(6, hexr * 0.92, rot=math.pi / 2):
        cyl(0.05, 0.05, 1.05, 6, x, y + 0.2, z0 + 0.12, 'white')
    prism([(x, y + 0.2) for x, y in ngon(6, hexr + 0.35, rot=math.pi / 2)],
          [(x, y + 0.2) for x, y in ngon(6, hexr + 0.2, rot=math.pi / 2)], z0 + 1.17, z0 + 1.32, 'white', bevel=0.02)
    cyl(hexr * 0.85, hexr * 0.85, 0.02, 6, 0, 0.2, z0 + 1.15, 'glow_cyan', glow=True, rz=math.pi / 6)
    # 底下：圆形长椅围着一个发光台
    cyl(0.32, 0.38, 0.28, 8, 0, 0.2, z0 + 0.12, 'metal_dk')
    cyl(0.28, 0.28, 0.03, 8, 0, 0.2, z0 + 0.4, 'glow_cyan', glow=True)
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        bench(math.cos(a) * 0.95, 0.2 + math.sin(a) * 0.95, z0 + 0.12, 0.45, rz=a + math.pi / 2)
    # 悬浮存档水晶（在雨篷上方，远处也能看到）
    ball(0.42, 0, 0.2, z0 + 2.15, 'glow_green', sub=0, glow=True, sz=1.7)
    torus(0.62, 0.035, 0, 0.2, z0 + 1.62, 'glow_green', seg=24, sides=6)
    # 售货机、充电桩
    for k, c in enumerate(('red', 'blue')):
        box(0.32, 0.22, 0.48, -1.85 + k * 0.38, 1.3, z0, c, bevel=0.02)
        box(0.24, 0.03, 0.3, -1.85 + k * 0.38, 1.18, z0 + 0.1, 'glow_white', bevel=0.0, glow=True)
    for x in (1.7, 2.05):
        box(0.14, 0.12, 0.42, x, 1.35, z0, 'white', bevel=0.01)
        box(0.08, 0.03, 0.06, x, 1.28, z0 + 0.3, 'glow_green', bevel=0.0, glow=True)
    for x, y in ((-2.9, 0.1), (2.95, 0.2)):
        street_tree(x, y, z0, 0.95)
    for x in (-1.3, 1.3):
        lamp(x, -2.6, z0)
    return z0


def studio():
    """松林艺术工坊（原 松林画室 / Pinewood Lab）：木构锯齿屋顶工作室、整面落地窗，松林环绕，红色环形雕塑。"""
    z0 = base_plaza()
    WALL_Z0[0] = z0
    x0, x1, y0, y1, H = -1.75, 1.15, -0.2, 1.4, 0.75
    box(x1 - x0, y1 - y0, H, (x0 + x1) / 2, (y0 + y1) / 2, z0, 'timber', bevel=0.02)
    box(x1 - x0 - 0.3, 0.03, H - 0.15, (x0 + x1) / 2, y0 - 0.01, z0 + 0.05, 'glass', bevel=0.0)
    for k in range(5):  # 落地窗竖梃
        box(0.05, 0.05, H - 0.1, x0 + 0.2 + k * (x1 - x0 - 0.4) / 4, y0 - 0.03, z0 + 0.05, 'timber_dk', bevel=0.0)
    # 锯齿屋顶：三道，陡面朝北
    n = 3
    span = (y1 - y0) / n
    for k in range(n):
        a, b = y0 + k * span, y0 + (k + 1) * span
        extrude_x([(a, z0 + H), (b, z0 + H), (b, z0 + H + 0.42)], x0 - 0.05, x1 + 0.05, 'timber_dk')
        box(x1 - x0 - 0.2, 0.03, 0.3, (x0 + x1) / 2, b + 0.005, z0 + H + 0.06, 'glass_teal', bevel=0.0)
    # 东侧小木屋（A 字形）
    ax, ay = 2.0, -0.3
    extrude_x([(ay - 0.5, z0), (ay + 0.5, z0), (ay, z0 + 0.95)], ax - 0.45, ax + 0.45, 'timber_dk')
    box(0.03, 0.4, 0.4, ax - 0.46, ay, z0, 'glow_warm', bevel=0.0, glow=True)
    # 红色环形雕塑
    box(0.5, 0.3, 0.1, -1.4, -1.5, z0, 'concrete', bevel=0.01)
    torus(0.42, 0.08, -1.4, -1.5, z0 + 0.52, 'red', rx=math.pi / 2, seg=28, sides=8)
    # 松林
    rng = random.Random(7)
    for k in range(11):
        a = k / 11 * 2 * math.pi + rng.random() * 0.3
        r = 3.0 + rng.random() * 0.6
        x, y = math.cos(a) * r, math.sin(a) * r
        if (abs(x - 2.7) < 0.5 and abs(y + 2.0) < 0.5) or (abs(x + 2.8) < 0.5 and abs(y + 1.9) < 0.5):
            continue  # 旗杆点
        pine(x, y, z0, 0.8 + rng.random() * 0.4)
    for x, y in ((0.4, -1.4), (1.0, -1.7)):
        bench(x, y, z0, 0.5)
    return z0


# ---------------------------------------------------------------- 城市中心：CBD 天际线
def cbd(seed, hmax, n_target, core_r=3.95, supertall=0.0, extra_super=0.0):
    """六边形城市广场上的一片 CBD：十字大道分出四个街区，越往中心、越往北越高；可选一栋地标超高层。"""
    R = 5.45
    z0 = base_plaza(R=R, lawn=False)
    WALL_Z0[0] = z0
    rng = random.Random(seed)
    # 十字大道（南北向只到入城广场为止）+ 车道线 + 车
    ns0, ns1 = -1.9, R * 0.86
    box(0.55, ns1 - ns0, 0.03, 0, (ns0 + ns1) / 2, z0, 'asphalt', bevel=0.0)
    box(2 * R * 0.86, 0.55, 0.03, 0, 0.0, z0, 'asphalt', bevel=0.0)
    for k in range(-7, 8):
        if ns0 + 0.2 < k * 0.6 < ns1 - 0.2:
            box(0.03, 0.18, 0.005, 0, k * 0.6, z0 + 0.03, 'lane', bevel=0.0)
        box(0.18, 0.03, 0.005, k * 0.6, 0.0, z0 + 0.03, 'lane', bevel=0.0)
    for k in range(5):
        car(0.13 * (1 if k % 2 else -1), -1.5 + k * 1.2, z0 + 0.03, math.pi / 2, ('white', 'red', 'blue', 'yellow', 'metal')[k])
    for k in range(6):
        car(-3.2 + k * 1.25, 0.13 * (1 if k % 2 else -1), z0 + 0.03, 0.0, ('blue', 'white', 'dark', 'red', 'yellow', 'metal')[k])
    # 南侧中轴：入城广场 + 喷泉，留给城门类地标
    cyl(0.45, 0.45, 0.08, 16, 0, -2.6, z0, 'concrete')
    cyl(0.35, 0.35, 0.02, 16, 0, -2.6, z0 + 0.08, 'glass_teal')
    # 候选地块：街区网格
    cells = []
    step = 0.95
    for i in range(-5, 6):
        for j in range(-5, 6):
            x, y = i * step + (0.25 if i > 0 else -0.25), j * step + (0.25 if j > 0 else -0.25)
            if i == 0 or j == 0:
                continue
            d = math.hypot(x, y)
            if d > core_r or abs(x) < 0.55 or abs(y) < 0.55:
                continue
            if abs(x) < 1.7 and y < -2.0:  # 南侧中轴
                continue
            cells.append((x, y, d))
    rng.shuffle(cells)
    cells = cells[:n_target]
    # 地标超高层：北侧中心
    tallest = 0.0
    if supertall:
        sx, sy = 0.95, 1.05
        tallest = tower_box(sx, sy, z0, 0.85, 0.85, supertall, rng, mat='glass_gold', tiers=3, crown=True)
        cells = [c for c in cells if math.hypot(c[0] - sx, c[1] - sy) > 0.9]
    if extra_super:
        ex, ey = -1.05, 1.5
        tallest = max(tallest, tower_twist(ex, ey, z0, 0.5, extra_super, twist=1.1, mat='glass_teal'))
        cells = [c for c in cells if math.hypot(c[0] - ex, c[1] - ey) > 0.85]
    glass = ('glass', 'glass', 'glass_teal', 'glass_dk', 'glass')
    for x, y, d in cells:
        f = (1 - d / core_r) * 0.65 + (y / core_r + 1) / 2 * 0.35
        h = max(0.5, hmax * (0.3 + 0.7 * f) * (0.8 + rng.random() * 0.4))
        fp = 0.66 + rng.random() * 0.2
        if h > 1.9:
            box(fp + 0.22, fp + 0.22, 0.32, x, y, z0, rng.choice(('concrete', 'panel_warm', 'glass_dk')), bevel=0.02)  # 裙房
            kind = rng.random()
            if kind < 0.55:
                top = tower_box(x, y, z0, fp, fp * (0.8 + rng.random() * 0.3), h, rng, mat=rng.choice(glass),
                                crown=rng.random() < 0.4)
            elif kind < 0.8:
                top = tower_round(x, y, z0, fp * 0.47, h, mat=rng.choice(('glass_teal', 'glass')))
            else:
                top = tower_twist(x, y, z0, fp * 0.52, h, twist=0.6 + rng.random() * 0.6, mat=rng.choice(glass))
        elif h > 0.95:
            if d > core_r * 0.65 and rng.random() < 0.45:  # 外围：住宅板楼
                top = slab(x, y, z0, fp * 1.3, fp * 0.75, h, rz=rng.choice((0.0, math.pi / 2)),
                           mat=rng.choice(('panel', 'panel_warm')))
            else:
                top = tower_box(x, y, z0, fp, fp, h, rng, mat=rng.choice(glass), tiers=1)
        else:  # 裙楼：屋顶花园
            box(fp * 1.15, fp * 1.15, h, x, y, z0, rng.choice(('panel', 'concrete', 'brick')), bevel=0.02)
            box(fp * 1.05, fp * 1.05, 0.04, x, y, z0 + h, 'grass', bevel=0.0)
            street_tree(x, y, z0 + h + 0.04, 0.45)
            top = z0 + h
        tallest = max(tallest, top)
    # 外圈绿带：六段梯形草地，行道树和路灯
    outer = ngon(6, R - 0.4, rot=math.pi / 2)
    inner = ngon(6, core_r + 0.35, rot=math.pi / 2)
    for i in range(6):
        quad = [outer[i], outer[(i + 1) % 6], inner[(i + 1) % 6], inner[i]]
        prism(quad, quad, z0, z0 + 0.015, 'grass', bevel=0.0)
    for k in range(24):
        a = k / 24 * 2 * math.pi
        x, y = math.cos(a) * (core_r + 0.75), math.sin(a) * (core_r + 0.75)
        if abs(x) < 1.8 and y < -2.0 or abs(y) < 0.45:
            continue
        if k % 4 == 0:
            lamp(x, y, z0)
        else:
            street_tree(x, y, z0, 0.7 + rng.random() * 0.25)
    print(f'[cbd {seed}] buildings={len(cells)} tallest={tallest:.2f}')
    return z0


MODELS = {
    # 据点：文件名 = m_<内置造型 key>，key 沿用旧名，数据里不用改
    'guild': incubator, 'tulou': ring, 'cyber': neon, 'observatory': dome,
    'paifang': street, 'savepoint': save, 'pinewood': studio,
    # 城市中心：按档位
    'cbd_town': lambda: cbd(11, 1.7, 18, core_r=3.3),
    'cbd_city_a': lambda: cbd(21, 3.2, 26),
    'cbd_city_b': lambda: cbd(22, 3.2, 26),
    'cbd_big_a': lambda: cbd(31, 4.0, 30, supertall=5.2),
    'cbd_big_b': lambda: cbd(32, 4.0, 30, supertall=4.6, extra_super=4.2),
    'cbd_metro': lambda: cbd(41, 4.8, 38, core_r=4.2, supertall=6.2, extra_super=5.2),
}
