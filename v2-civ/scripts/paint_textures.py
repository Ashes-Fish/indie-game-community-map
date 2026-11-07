"""程序化绘制地表手绘风无缝贴图 → public/tex/terrain.webp
6 层竖排（每层 512×512，RGB = 颜色，A = 高度，用于高度混合）：
0 草地  1 水田  2 林地  3 山石  4 沙滩  5 雪地
用法：python3 scripts/paint_textures.py [--preview]（--preview 另存 2×2 平铺预览到 /tmp/igcm-tex/）
所有噪声用 FFT 生成（天然周期），笔触绕边重画，所以四方连续。
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
N = 1024          # 绘制分辨率（输出时缩到 512，相当于抗锯齿）
OUT = 512
QUALITY = 62


def noise(lo, hi, seed, beta=1.0, n=N):
    """周期带通噪声，零均值单位方差。lo/hi = 每张图的周期数"""
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((n, n)))
    f = np.hypot(np.fft.fftfreq(n)[:, None] * n, np.fft.fftfreq(n)[None, :] * n)
    amp = np.where((f >= lo) & (f <= hi), 1.0 / np.maximum(f, 1) ** beta, 0)
    x = np.real(np.fft.ifft2(F * amp))
    return (x - x.mean()) / (x.std() + 1e-9)


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hexc(s):
    s = s.lstrip('#')
    return np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def lerp(a, b, t):
    return a + (b - a) * t[..., None]


def poster(x, levels, soft=0.25):
    """柔和色阶：手绘的“色块”感"""
    y = x * levels
    f = y - np.floor(y)
    return (np.floor(y) + sstep(0.5 - soft, 0.5 + soft, f)) / levels


def shade(h, k=1.0, light=(-0.6, -0.8)):
    """由高度场算假光照（左上来光）"""
    dx = (np.roll(h, -2, 1) - np.roll(h, 2, 1)) * 0.25
    dy = (np.roll(h, -2, 0) - np.roll(h, 2, 0)) * 0.25
    return np.clip(1 + k * (dx * light[0] + dy * light[1]) * N / 64, 0.55, 1.45)


def wrap_draw(draw, pts, fill):
    """多边形在四周重画，保证无缝"""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    for ox in (-N, 0, N):
        if min(xs) + ox > N or max(xs) + ox < 0: continue
        for oy in (-N, 0, N):
            if min(ys) + oy > N or max(ys) + oy < 0: continue
            draw.polygon([(x + ox, y + oy) for x, y in pts], fill=fill)


def strokes(img, color_at, n, seed, length, width, angle_at=None, jitter=0.08, shape='blade', mask=None):
    """在 img 上画 n 个笔触；颜色从 color_at(x,y) 取，带抖动"""
    r = np.random.default_rng(seed)
    d = ImageDraw.Draw(img)
    for _ in range(n):
        x, y = r.random() * N, r.random() * N
        ix, iy = int(x) % N, int(y) % N
        if mask is not None and r.random() > mask[iy, ix]: continue
        L = r.uniform(*length); W = r.uniform(*width)
        a = angle_at(ix, iy) if angle_at else r.random() * np.pi
        a += r.normal(0, 0.25)
        c = color_at(ix, iy) * (1 + r.normal(0, jitter, 3) * 0.6 + r.normal(0, jitter))
        c = tuple(int(v) for v in np.clip(c * 255, 0, 255))
        ca, sa = np.cos(a), np.sin(a)
        if shape == 'blade':   # 细长叶片：一头尖
            pts = [(-L * 0.5, 0), (-L * 0.1, -W * 0.5), (L * 0.5, -W * 0.15), (L * 0.55, 0), (L * 0.5, W * 0.15), (-L * 0.1, W * 0.5)]
        else:                  # 圆润色块
            k = 8
            pts = [(np.cos(t) * L * 0.5 * (1 + r.normal(0, 0.08)), np.sin(t) * W * 0.5 * (1 + r.normal(0, 0.08))) for t in np.linspace(0, 2 * np.pi, k, endpoint=False)]
        pts = [(x + px * ca - py * sa, y + px * sa + py * ca) for px, py in pts]
        wrap_draw(d, pts, c)
    return img


def to_img(rgb):
    return Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))


def from_img(img):
    return np.asarray(img, np.float32) / 255


def voronoi(n_pts, seed):
    """周期 Voronoi：返回 F1、F2 距离和最近点编号（坐标单位 = 图宽）"""
    r = np.random.default_rng(seed)
    P = r.random((n_pts, 2))
    tree = cKDTree(P, boxsize=1.0)
    g = (np.arange(N) + 0.5) / N
    Y, X = np.meshgrid(g, g, indexing='ij')
    d, i = tree.query(np.stack([X.ravel(), Y.ravel()], 1), k=2)
    return d[:, 0].reshape(N, N), d[:, 1].reshape(N, N), i[:, 0].reshape(N, N), r


# ---------------------------------------------------------------- 各层
def grass():
    n1, n2, n3 = noise(2, 6, 1), noise(6, 18, 2), noise(18, 60, 3)
    base = lerp(hexc('#4f8c2c'), hexc('#79ad3c'), sstep(-1.2, 1.2, n1 * 0.8 + n2 * 0.4))
    base = lerp(base, hexc('#9fb84a'), sstep(0.9, 1.8, n1 + n3 * 0.3) * 0.7)   # 偏黄的亮斑
    base = lerp(base, hexc('#3b7428'), sstep(0.6, 1.6, -n2 + n3 * 0.3) * 0.8)  # 深色草丛
    base *= poster(sstep(-2, 2, n2 + n3 * 0.5), 5, 0.3)[..., None] * 0.22 + 0.89
    ang = noise(1, 4, 9) * 0.9 - np.pi / 2  # 叶片大体朝上，局部有流向
    img = to_img(base)
    strokes(img, lambda x, y: base[y, x], 26000, 11, (10, 22), (3, 6), lambda x, y: ang[y, x], 0.07)
    strokes(img, lambda x, y: base[y, x] * 1.16, 5000, 12, (8, 16), (2.5, 4.5), lambda x, y: ang[y, x], 0.05)   # 高光叶
    strokes(img, lambda x, y: base[y, x] * 0.72, 4000, 13, (8, 16), (3, 5), lambda x, y: ang[y, x], 0.05)    # 暗叶
    c = from_img(img)
    h = sstep(-1.5, 1.5, n2 * 0.7 + n3 * 0.6 + (c.mean(2) - c.mean()) * 6)
    c *= shade(h, 0.5)[..., None]
    # 小花
    r = np.random.default_rng(14); d = ImageDraw.Draw(img := to_img(c))
    for _ in range(260):
        x, y = r.random() * N, r.random() * N
        col = [(244, 238, 214), (246, 206, 70), (236, 150, 160)][r.integers(3)]
        s = r.uniform(2.2, 3.6)
        wrap_draw(d, [(x - s, y), (x, y - s), (x + s, y), (x, y + s)], col)
    return from_img(img), h


def paddy():
    # 一排排秧苗（纹理里横向成行），行间露水；A 通道 = 秧苗覆盖
    n1, n2 = noise(2, 8, 21), noise(10, 40, 22)
    rows = 40                       # 每张图 40 行
    yy = (np.arange(N)[:, None] + noise(1, 3, 23) * 6) / N * rows
    rowm = sstep(0.18, 0.42, 0.5 - np.abs((yy % 1) - 0.5)) * np.ones((1, N))
    base = lerp(hexc('#5d9a33'), hexc('#8fbd45'), sstep(-1.5, 1.5, n1 + n2 * 0.4))
    water = lerp(hexc('#5a8c84'), hexc('#8ab8b0'), sstep(-1, 1.5, n2))
    c = lerp(water, base, rowm)
    img = to_img(c)
    r = np.random.default_rng(24)
    d = ImageDraw.Draw(img)
    # 每行上的秧苗簇：几片向上张开的叶
    for row in range(rows):
        y0 = (row + 0.5) / rows * N
        x = r.random() * 8
        while x < N:
            ix = int(x) % N; iy = int(y0) % N
            col0 = base[iy, ix]
            for k in range(4):
                a = -np.pi / 2 + r.normal(0, 0.55)
                L, W = r.uniform(7, 13), r.uniform(2, 3.5)
                cx, cy = x + r.normal(0, 1.2), y0 + r.normal(0, 1.5) + 2
                col = tuple(int(v) for v in np.clip(col0 * (1 + r.normal(0, 0.09)) * (1.1 if k == 0 else 0.92) * 255, 0, 255))
                ca, sa = np.cos(a), np.sin(a)
                pts = [(0, 0), (L * 0.45, -W * 0.5), (L, 0), (L * 0.45, W * 0.5)]
                wrap_draw(d, [(cx + px * ca - py * sa, cy + px * sa + py * ca) for px, py in pts], col)
            x += r.uniform(9, 14)
    c = from_img(img)
    h = np.clip(rowm * 0.75 + sstep(-1, 1, n2) * 0.2 + (c.mean(2) - water.mean(2)) * 0.8, 0, 1)
    c *= shade(h, 0.35)[..., None]
    return c, h


def forest():
    n1, n2, n3 = noise(2, 6, 31), noise(6, 20, 32), noise(20, 60, 33)
    base = lerp(hexc('#2f5e26'), hexc('#4f7f2e'), sstep(-1.2, 1.2, n1 + n2 * 0.5))
    base = lerp(base, hexc('#6b6a34'), sstep(0.8, 1.8, n2 + n3 * 0.4) * 0.7)   # 落叶
    base = lerp(base, hexc('#22441f'), sstep(0.7, 1.6, -n1 * 0.7 - n2 * 0.6) * 0.8)
    img = to_img(base)
    strokes(img, lambda x, y: base[y, x], 9000, 34, (12, 26), (8, 16), None, 0.09, 'blob')
    strokes(img, lambda x, y: base[y, x] * 1.22 + np.array([0.03, 0.02, -0.01]), 2600, 35, (6, 12), (5, 9), None, 0.08, 'blob')
    strokes(img, lambda x, y: hexc('#8a6a3a') * (0.8 + 0.4 * (n3[y, x] > 0)), 900, 36, (5, 10), (3, 5), None, 0.1, 'blob')  # 枯叶
    c = from_img(img)
    h = sstep(-1.6, 1.6, n2 * 0.8 + n3 * 0.5 + (c.mean(2) - c.mean()) * 5)
    c *= shade(h, 0.6)[..., None]
    return c, h


def rock():
    # 层理岩：横向拉长的岩块（各向异性 Voronoi）+ 色带 + 裂隙下方的阴影、上沿的亮边
    r = np.random.default_rng(41)
    K = 2.6
    P = r.random((90, 2)) * [1, K]
    tree = cKDTree(P, boxsize=[1, K])
    g = (np.arange(N) + 0.5) / N
    Y, X = np.meshgrid(g, g, indexing='ij')
    warp = noise(1, 4, 46) * 0.03
    d, i = tree.query(np.stack([X.ravel(), ((Y + warp) % 1).ravel() * K], 1), k=2)
    f1, f2, idx = d[:, 0].reshape(N, N), d[:, 1].reshape(N, N), i[:, 0].reshape(N, N)
    n1, n2, n3 = noise(2, 8, 42), noise(8, 30, 43), noise(30, 90, 44)
    tone = r.random(len(P))
    edge = f2 - f1
    crack = 1 - sstep(0.002, 0.014, edge + n3 * 0.002)
    bevel = sstep(0.0, 0.07, edge)
    band = np.floor(((Y + warp * 2 + n1 * 0.02) % 1) * 9)
    bt = (np.sin(band * 12.9898) * 43758.5453) % 1
    c = lerp(hexc('#7f786c'), hexc('#a59a86'), np.clip(tone[idx] * 0.6 + bt * 0.4, 0, 1))
    c = lerp(c, hexc('#9a7f5e'), (bt > 0.72) * 0.45)                     # 赭石色带
    c = lerp(c, hexc('#68704c'), sstep(0.7, 1.6, n1 + n2 * 0.5) * 0.45)  # 苔藓
    h = np.clip(bevel * 0.75 + sstep(-2, 2, n2 + n3 * 0.4) * 0.25, 0, 1)
    lit = shade(h, 1.0)
    c *= poster(np.clip((lit - 0.55) / 0.9, 0, 1), 4, 0.35)[..., None] * 0.4 + 0.8
    below = np.roll(crack, 7, 0) * (1 - crack)      # 裂隙下方阴影（岩檐）
    above = np.roll(crack, -3, 0) * (1 - crack)     # 上沿亮边
    c = lerp(c, c * 0.62, np.clip(below, 0, 1) * 0.8)
    c = lerp(c, c * 1.18, np.clip(above, 0, 1) * 0.6)
    c = lerp(c, hexc('#3a352e'), crack * 0.85)
    img = to_img(c)
    strokes(img, lambda x, y: c[y, x], 6000, 45, (10, 24), (3, 6), lambda x, y: 0.05, 0.04, 'blob', mask=1 - crack)
    c = from_img(img)
    c = lerp(c, hexc('#3a352e'), crack * 0.5)
    return c, h


def sand():
    n1, n2, n3 = noise(2, 6, 51), noise(6, 20, 52), noise(40, 160, 53)
    warp = noise(1, 4, 54) * 18
    yy = (np.arange(N)[:, None] + warp + np.arange(N)[None, :] * 0.18) / N * 22
    rip = 0.5 + 0.5 * np.sin(yy * 2 * np.pi + n2 * 0.8)
    c = lerp(hexc('#d9c48c'), hexc('#ecdcaa'), sstep(-1.4, 1.4, n1 + n2 * 0.3))
    c = lerp(c, hexc('#c4a874'), sstep(0.7, 1.6, -n1) * 0.6)
    h = np.clip(rip * 0.6 + sstep(-1.5, 1.5, n2) * 0.4, 0, 1)
    c *= shade(h, 0.4)[..., None]
    c *= 1 + n3[..., None] * 0.045
    img = to_img(c)
    r = np.random.default_rng(55); d = ImageDraw.Draw(img)
    for _ in range(420):   # 小石子/贝壳
        x, y = r.random() * N, r.random() * N
        s = r.uniform(2, 4.5)
        col = tuple(int(v) for v in np.clip(hexc(['#b39a72', '#f6efe0', '#9a8466'][r.integers(3)]) * 255, 0, 255))
        wrap_draw(d, [(x + np.cos(t) * s, y + np.sin(t) * s * 0.7) for t in np.linspace(0, 6.28, 7, endpoint=False)], col)
    return from_img(img), h


def snow():
    n1, n2, n3 = noise(2, 6, 61), noise(6, 24, 62), noise(30, 120, 63)
    drift = sstep(-1.2, 1.4, n1 * 0.7 + n2 * 0.6)
    h = drift
    lit = shade(h, 1.4)
    c = lerp(hexc('#b7c6dc'), hexc('#f4f7fb'), np.clip(poster(np.clip((lit - 0.5), 0, 1), 4, 0.35), 0, 1))
    c *= 1 + n3[..., None] * 0.02
    img = to_img(c)
    strokes(img, lambda x, y: c[y, x], 5000, 64, (14, 30), (5, 9), lambda x, y: 0.25, 0.03, 'blob')
    c = from_img(img)
    sp = (noise(150, 300, 65) > 3.0).astype(np.float32)   # 闪点
    c = c + sp[..., None] * 0.25
    return c, h


def main():
    layers = [grass(), paddy(), forest(), rock(), sand(), snow()]
    names = ['grass', 'paddy', 'forest', 'rock', 'sand', 'snow']
    tiles = []
    for (c, h), nm in zip(layers, names):
        # RGB 和 A 分开缩放（PIL 缩放 RGBA 会预乘，透明处颜色会丢）；A 映射到 0.25..1，避开浏览器预乘误差
        rgb = Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8)).resize((OUT, OUT), Image.LANCZOS)
        al = Image.fromarray(((0.25 + 0.75 * np.clip(h, 0, 1)) * 255).astype(np.uint8)).resize((OUT, OUT), Image.LANCZOS)
        im = rgb.copy(); im.putalpha(al)
        tiles.append(im)
        print(nm, 'mean rgb', np.asarray(im)[..., :3].reshape(-1, 3).mean(0).round(1))
    strip = Image.new('RGBA', (OUT, OUT * len(tiles)))
    for i, t in enumerate(tiles): strip.paste(t, (0, i * OUT))
    out = ROOT / 'public/tex/terrain.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out, 'WEBP', quality=QUALITY, alpha_quality=45, method=6, exact=True)
    print(f'→ {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB')
    if '--preview' in sys.argv:
        pv = Path('/tmp/igcm-tex'); pv.mkdir(exist_ok=True)
        for t, nm in zip(tiles, names):
            rgb = t.convert('RGB'); big = Image.new('RGB', (OUT * 2, OUT * 2))
            for i in range(2):
                for j in range(2): big.paste(rgb, (i * OUT, j * OUT))
            big.save(pv / f'{nm}.jpg', quality=88)
        sheet = Image.new('RGB', (OUT * 3, OUT * 2))
        for i, t in enumerate(tiles): sheet.paste(t.convert('RGB'), ((i % 3) * OUT, (i // 3) * OUT))
        sheet.save(pv / 'sheet.jpg', quality=88)


if __name__ == '__main__':
    main()
