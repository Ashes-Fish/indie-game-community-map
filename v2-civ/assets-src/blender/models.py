# 三个模型：雷峰塔、Ludere 会馆（含戏台）、六边形地块底座。
import math

from lib import (GLOW, PARTS, WALL_Z0, ball, box, cyl, gable_roof, hip_roof, ngon, prism, roof, sweep)
from mathutils import Vector

HEX_R = 6.5


# ---------------------------------------------------------------- 底座（地块第一层）
def base_hex(R=HEX_R * 0.7, h=0.22, below=0.35):
    """尖顶朝南北的六边形台基，和地图六边形网格对齐。顶面铺石，外圈压边石，南角一条甬道。"""
    poly = ngon(6, R, rot=math.pi / 2)  # 顶点朝 ±Y
    inner = ngon(6, R - 0.32, rot=math.pi / 2)
    prism([(x * 1.03, y * 1.03) for x, y in poly], poly, -below, h - 0.06, 'stone', bevel=0.04)
    prism(inner, inner, h - 0.1, h, 'paving', bevel=0.0)
    # 压边石：一圈稍高的条石
    for i in range(6):
        a, b = Vector(poly[i]), Vector(poly[(i + 1) % 6])
        ia, ib = Vector(inner[i]), Vector(inner[(i + 1) % 6])
        prism([tuple(a), tuple(b), tuple(ib), tuple(ia)], [tuple(a), tuple(b), tuple(ib), tuple(ia)], h - 0.1, h + 0.03,
              'stone_dk', bevel=0.02)
    # 甬道：南角到大门
    box(0.95, R - 2.0, 0.025, 0, -(R + 2.0) / 2 + 0.05, h, 'path', bevel=0.0)
    return h


# ---------------------------------------------------------------- 雷峰塔（地标）
def leifeng():
    WALL_Z0[0] = 0.0
    z = 0.0
    # 台基：两层八角石台，向下延伸以适应山坡
    for R, hh in ((1.95, 0.32), (1.62, 0.26)):
        p = ngon(8, R)
        prism([(x * 1.04, y * 1.04) for x, y in p], p, z - (0.5 if R > 1.9 else 0), z + hh, 'stone', bevel=0.04)
        z += hh
    top = ngon(8, 1.62)
    prism(ngon(8, 1.5), ngon(8, 1.5), z - 0.02, z + 0.02, 'paving', bevel=0)
    # 台基栏杆
    for i in range(8):
        a, b = Vector(top[i]) * 0.97, Vector(top[(i + 1) % 8]) * 0.97
        if i == 7:  # 南面留出台阶口
            continue
        for t in (0.0, 0.5):
            p = a.lerp(b, t)
            box(0.08, 0.08, 0.2, p.x, p.y, z, 'stone_dk', bevel=0.015)
        sweep([(a.x, a.y, z + 0.16), (b.x, b.y, z + 0.16)], 0.05, 0.05, 'stone_dk')
    # 南面台阶
    for k in range(5):
        box(0.9, 0.17, z * (1 - k / 5), 0, -1.5 - 0.085 - k * 0.16, 0, 'stone', bevel=0.015)
    WALL_Z0[0] = z
    radii = [0.98, 0.85, 0.74, 0.64, 0.55]
    hb = [0.84, 0.64, 0.58, 0.54, 0.5]
    for s, (r, h) in enumerate(zip(radii, hb)):
        body = ngon(8, r)
        prism(body, body, z, z + h, 'wall_ochre', bevel=0.02)
        # 八根角柱
        for x, y in body:
            cyl(0.075, 0.085, h, 6, x * 1.01, y * 1.01, z, 'pillar', bevel=0.0)
        # 门 / 窗：四正面开门，四斜面开窗
        for k in range(8):
            ang = -math.pi / 2 + k * math.pi / 4
            nx, ny = math.cos(ang), math.sin(ang)
            ap = r * math.cos(math.pi / 8)
            if k % 2 == 0:
                w, hh = (0.34, 0.44) if s == 0 else (0.26, 0.3)
            else:
                w, hh = 0.2, 0.18
            zc = z + (h - hh) * (0.25 if k % 2 == 0 else 0.55)
            box(w + 0.08, 0.04, hh + 0.08, nx * (ap + 0.005), ny * (ap + 0.005), zc - 0.04, 'pillar', rz=ang + math.pi / 2, bevel=0.01)
            box(w, 0.05, hh, nx * (ap + 0.02), ny * (ap + 0.02), zc, 'lattice' if k % 2 else 'wood_dk', rz=ang + math.pi / 2, bevel=0.01)
        z += h
        # 斗拱层：外扩的松石绿额枋 + 一圈斗拱块
        band = ngon(8, r * 1.13)
        prism(body, band, z, z + 0.11, 'bracket', bevel=0.015)
        for k in range(16):
            ang = -math.pi / 2 + math.pi / 8 + k * math.pi / 8
            rr = r * 1.1
            box(0.09, 0.09, 0.07, math.cos(ang) * rr, math.sin(ang) * rr, z + 0.1, 'gold' if k % 2 else 'bracket', rz=ang, bevel=0.01)
        z += 0.14
        # 屋檐：出檐大、翘角高
        Re = r * 1.13 + 0.38
        last = s == len(radii) - 1
        if last:
            H = 0.9
            topp = [(0, 0)] * 8
        else:
            H = 0.3
            topp = ngon(8, radii[s + 1] * 1.08)
        rf = roof(ngon(8, Re), topp, z - 0.06, H, lift=0.34, flare=0.12, corner=0.5,
                  curve=0.5, S=4, T=5 if last else 3, thick=0.08, ridge_w=0.07, tip=0.2, gold_tips=True)
        # 檐角风铃
        for hp in rf['hips']:
            p = hp[0]
            box(0.05, 0.05, 0.12, p.x * 1.0, p.y * 1.0, p.z - 0.2, 'gold', bevel=0.0)
        if not last:
            z = z - 0.06 + H
            # 平座：一圈挑台 + 栏杆
            pr = ngon(8, radii[s + 1] * 1.26)
            prism(pr, pr, z - 0.02, z + 0.05, 'stone_dk', bevel=0.015)
            for i in range(8):
                a, b = Vector(pr[i]) * 0.97, Vector(pr[(i + 1) % 8]) * 0.97
                box(0.05, 0.05, 0.14, a.x, a.y, z + 0.05, 'pillar', bevel=0.0)
                sweep([(a.x, a.y, z + 0.17), (b.x, b.y, z + 0.17)], 0.035, 0.035, 'pillar')
            z += 0.05
        else:
            z = z - 0.06 + H
    # 塔刹
    cyl(0.17, 0.2, 0.12, 8, 0, 0, z - 0.05, 'ridge', rz=math.pi / 8)
    cyl(0.24, 0.12, 0.12, 8, 0, 0, z + 0.06, 'gold', rz=math.pi / 8, bevel=0.01)
    cyl(0.035, 0.035, 0.95, 6, 0, 0, z + 0.15, 'gold')
    for k in range(5):
        rr = 0.17 - k * 0.018
        cyl(rr, rr, 0.045, 10, 0, 0, z + 0.25 + k * 0.105, 'gold', bevel=0.012)
    ball(0.12, 0, 0, z + 0.88, 'gold', sub=1, sz=1.15)
    ball(0.06, 0, 0, z + 1.06, 'gold', sub=1)
    # 整体缩到地图里约 6 个单位高（倒角、屋檐厚度不缩，显得更敦实）
    from mathutils import Matrix
    for o in PARTS + GLOW:
        o.data.transform(Matrix.Scale(0.82, 4))
    return (z + 1.1) * 0.82


# ---------------------------------------------------------------- 会馆 + 戏台（Ludere）
def hall_facade(x0, x1, y, z, h, n, mat_wall='wall_red', door='lattice'):
    """正面：n 根粗红柱 + 柱间格扇门。y 为立面位置（朝 -Y）。"""
    for k in range(n):
        x = x0 + (x1 - x0) * k / (n - 1)
        cyl(0.075, 0.085, h, 8, x, y - 0.03, z, 'pillar', bevel=0.0)
        if k < n - 1:
            xm = (x + x0 + (x1 - x0) * (k + 1) / (n - 1)) / 2
            w = (x1 - x0) / (n - 1) - 0.18
            box(w, 0.04, h * 0.78, xm, y - 0.01, z + 0.02, door, bevel=0.008)
    box(x1 - x0 + 0.2, 0.08, 0.1, (x0 + x1) / 2, y - 0.04, z + h - 0.1, 'bracket', bevel=0.01)


def lantern(x, y, z, r=0.085):
    cyl(r * 0.5, r * 0.5, 0.03, 6, x, y, z + r * 1.9, 'gold')
    ball(r, x, y, z + r, 'lantern', sub=1, glow=True, sz=1.25)


def tree(x, y, s=1.0, mat='leaf'):
    cyl(0.06 * s, 0.09 * s, 0.45 * s, 6, x, y, 0.2, 'trunk')
    ball(0.42 * s, x, y, 0.2 + 0.72 * s, mat, sub=1, sz=0.85)
    ball(0.3 * s, x + 0.22 * s, y - 0.12 * s, 0.2 + 0.52 * s, 'leaf2', sub=1, sz=0.85)
    ball(0.26 * s, x - 0.25 * s, y + 0.05 * s, 0.2 + 0.5 * s, 'leaf2', sub=1, sz=0.85)


def wall_run(pts, h, z0, t=0.18):
    """白墙 + 小青瓦墙帽。pts 为折线顶点 (x,y)。"""
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, by - ay)
        ang = math.atan2(by - ay, bx - ax)
        cx, cy = (ax + bx) / 2, (ay + by) / 2
        box(L + t, t, h, cx, cy, z0, 'wall_white', rz=ang, bevel=0.015)
        # 墙帽：沿墙方向的两坡小顶
        if abs(math.sin(ang)) < 0.5:
            gable_roof(cx, cy, z0 + h, L + t + 0.12, t + 0.26, 0.12, along='x', S=4, T=2, thick=0.04, lift=0.0, flare=0.0, ridge_w=0.04)
        else:
            gable_roof(cx, cy, z0 + h, t + 0.26, L + t + 0.12, 0.12, along='y', S=4, T=2, thick=0.04, lift=0.0, flare=0.0, ridge_w=0.04)


def bench(x, y, w=0.6):
    box(w, 0.14, 0.04, x, y, 0.36, 'wood_dk', bevel=0)
    for sx in (-1, 1):
        box(0.04, 0.12, 0.14, x + sx * (w / 2 - 0.06), y, 0.22, 'wood_dk', bevel=0)


def bush(x, y, s=1.0):
    ball(0.2 * s, x, y, 0.3, 'leaf', sub=1, sz=0.8)
    ball(0.15 * s, x + 0.16 * s, y + 0.05, 0.28, 'leaf2', sub=1, sz=0.8)


def clutter(z0, front=-3.05):
    """地块第二层（系统统一生成）：角上的树、灌木、戏台前的长凳和灯笼柱、几只箱子。A、B 两版共用。"""
    tree(-3.05, 0.2, 1.1)
    tree(-2.7, 2.35, 0.9, 'leaf2')
    tree(3.05, 0.6, 1.05)
    tree(2.75, 2.5, 0.85, 'leaf2')
    for x, y in ((-2.0, -1.35), (2.0, -1.35), (-1.55, -1.3), (1.6, -1.3), (-3.2, -1.2), (3.25, -0.6)):
        bush(x, y, 1.0)
    for row in range(2):  # 露天看戏的长凳
        for x in (-0.7, 0.7):
            bench(x, front - row * 0.42, 0.75)
    for sx in (-1, 1):  # 灯笼柱
        cyl(0.04, 0.05, 0.75, 6, sx * 1.15, front - 0.25, z0, 'wood_dk')
        box(0.3, 0.04, 0.04, sx * 1.07, front - 0.25, z0 + 0.72, 'wood_dk', bevel=0)
        lantern(sx * 0.98, front - 0.25, z0 + 0.48, r=0.08)
    for x, y, r in ((-2.6, -2.3, 0.3), (-2.42, -2.5, -0.2), (2.5, -2.45, 0.5)):  # 货箱
        box(0.2, 0.2, 0.18, x, y, z0, 'lattice', rz=r, bevel=0.0)


def guild():
    z0 = base_hex()
    WALL_Z0[0] = z0
    X, YF, YB = 2.35, -0.95, 2.65
    # ---- 第二层：院墙、树、灌木、看戏的长凳、香炉、灯笼柱
    wall_run([(-1.0, YF), (-X, YF), (-X, YB), (X, YB), (X, YF), (1.0, YF)], 0.5, z0)
    clutter(z0)
    cyl(0.17, 0.14, 0.18, 8, 0, 0.55, z0, 'bronze', bevel=0.02)  # 香炉
    cyl(0.21, 0.21, 0.05, 8, 0, 0.55, z0 + 0.18, 'bronze', bevel=0.01)
    # ---- 第三层：主体建筑
    # 戏台：在前，朝南（对着镜头）。高台 + 四根粗红柱 + 后屏 + 大翘角歇山顶
    sy = -1.75
    box(2.0, 1.55, 0.55, 0, sy, z0, 'stone', bevel=0.04)
    box(2.06, 1.6, 0.07, 0, sy, z0 + 0.48, 'stone_dk', bevel=0.02)
    box(1.7, 0.04, 0.32, 0, sy - 0.79, z0 + 0.1, 'screen', bevel=0.0)  # 台口红裙板
    for k in range(4):  # 台口金色花板
        box(0.32, 0.03, 0.18, -0.6 + k * 0.4, sy - 0.81, z0 + 0.17, 'gold', bevel=0.0)
    zs = z0 + 0.55
    for sx in (-0.78, 0.78):
        for dy in (-0.62, 0.62):
            cyl(0.095, 0.11, 0.9, 8, sx, sy + dy, zs, 'pillar')
    box(1.5, 0.08, 0.78, 0, sy + 0.6, zs, 'screen', bevel=0.01)
    box(1.1, 0.09, 0.5, 0, sy + 0.56, zs + 0.14, 'gold', bevel=0.01)
    box(0.36, 0.1, 0.62, -0.95 + 0.0, sy + 0.62, zs, 'lattice', bevel=0.0)
    box(0.36, 0.1, 0.62, 0.95, sy + 0.62, zs, 'lattice', bevel=0.0)
    box(1.75, 1.42, 0.13, 0, sy, zs + 0.82, 'bracket', bevel=0.02)
    for k in range(7):  # 斗拱
        box(0.1, 0.12, 0.08, -0.75 + k * 0.25, sy - 0.72, zs + 0.92, 'gold', bevel=0)
    box(0.64, 0.05, 0.2, 0, sy - 0.74, zs + 0.6, 'gold', bevel=0.0)  # 台口匾
    box(0.56, 0.06, 0.14, 0, sy - 0.75, zs + 0.63, 'wood_dk', bevel=0.0)
    hip_roof(0, sy, zs + 0.95, 2.55, 2.05, 0.78, ridge_frac=1.6, lift=0.48, flare=0.2, corner=0.45, S=8, T=5,
             thick=0.09, tip=0.3, ridge_w=0.085, gold_tips=True)
    for sx in (-1, 1):
        lantern(sx * 0.98, sy - 0.75, zs + 0.5, r=0.1)
    # 两厢：矮、暗瓦，衬托主体
    for sx in (-1, 1):
        x = sx * 1.75
        box(0.7, 1.5, 0.6, x, 0.85, z0, 'wall_white', bevel=0.02)
        for k in range(4):
            cyl(0.06, 0.07, 0.6, 6, x - sx * 0.37, 0.2 + k * 0.43, z0, 'pillar')
        box(0.04, 1.3, 0.42, x - sx * 0.36, 0.85, z0 + 0.06, 'lattice', bevel=0.0)
        gable_roof(x, 0.85, z0 + 0.6, 1.1, 1.8, 0.4, along='y', S=6, T=3, thick=0.06, lift=0.06, flare=0.0,
                   corner=0.3, mats=('roof_dk', 'roof_rim', 'soffit'))
    # 正殿：月台 + 重檐歇山，比戏台更高
    hy = 1.75
    box(3.3, 1.55, 0.32, 0, hy, z0, 'stone', bevel=0.04)
    for k in range(3):
        box(0.9, 0.18, 0.32 - k * 0.1, 0, hy - 0.86 - k * 0.17, z0, 'stone', bevel=0.015)
    zh = z0 + 0.32
    box(2.6, 0.95, 1.0, 0, hy + 0.12, zh, 'wall_red', bevel=0.02)
    hall_facade(-1.2, 1.2, hy - 0.38, zh, 1.0, 6)
    roof([(-1.72, hy - 0.78), (1.72, hy - 0.78), (1.72, hy + 0.98), (-1.72, hy + 0.98)],
         [(-1.1, hy - 0.3), (1.1, hy - 0.3), (1.1, hy + 0.52), (-1.1, hy + 0.52)],
         zh + 1.0, 0.32, lift=0.3, flare=0.14, corner=0.28, S=10, T=3, thick=0.08, tip=0.22, gold_tips=True)
    zu = zh + 1.0 + 0.28
    box(2.0, 0.8, 0.42, 0, hy + 0.12, zu, 'wall_red', bevel=0.02)
    for k in range(5):
        box(0.26, 0.03, 0.26, -0.72 + k * 0.36, hy - 0.29, zu + 0.08, 'lattice', bevel=0.0)
    box(2.1, 0.9, 0.11, 0, hy + 0.12, zu + 0.36, 'bracket', bevel=0.015)
    box(0.7, 0.05, 0.22, 0, hy - 0.36, zu + 0.12, 'gold', bevel=0.0)  # 匾
    hip_roof(0, hy + 0.12, zu + 0.45, 3.0, 1.75, 0.95, ridge_frac=0.9, lift=0.42, flare=0.18, corner=0.36, S=10, T=5,
             thick=0.09, tip=0.3, ridge_w=0.095, gold_tips=True)
    return z0


MODELS = {'leifeng': leifeng, 'guild': guild, 'base': base_hex}
