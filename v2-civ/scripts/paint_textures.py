"""程序化绘制地表手绘风无缝贴图 → public/tex/terrain-hd.webp（每层 1024²，进入画面后后台换上）
                                 + public/tex/terrain.webp（同一张缩到 512²，首屏和低档设备用）
6 层竖排（RGB = 颜色，A = 高度，用于高度混合）：
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
N = 2048          # 绘制分辨率（输出时缩到 1024，相当于抗锯齿）
OUT = 1024        # 输出 1024：近景能看清笔触（原 512）
QUALITY = 62
HD_QUALITY, HD_ALPHA = 50, 40
S = N / 1024      # 笔触尺寸按绘制分辨率缩放（尺寸写的是 1024 画布上的像素）


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
    k2 = int(2 * S)
    dx = (np.roll(h, -k2, 1) - np.roll(h, k2, 1)) * 0.25 / S
    dy = (np.roll(h, -k2, 0) - np.roll(h, k2, 0)) * 0.25 / S
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
    for _ in range(int(n * S * S)):
        x, y = r.random() * N, r.random() * N
        ix, iy = int(x) % N, int(y) % N
        if mask is not None and r.random() > mask[iy, ix]: continue
        L = r.uniform(*length) * S; W = r.uniform(*width) * S
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


# ---------------------------------------------------------------- 各层（卡通风，2026-11-18 重画）
# 风格：大块平涂色面（3–4 个色阶，边缘柔和但清楚），大而圆润的形状，少量干净的高光 / 暗部笔触，
# 不要照片式的细碎噪点。A 通道（高度）用同样的大形状，让层与层之间的高度混合沿着形状边缘咬合。

def bands(x, cols, soft=0.06):
    """x（任意范围）按 len(cols) 个阈值平涂上色：相邻色块之间一条窄的柔边"""
    q = np.quantile(x, np.linspace(0, 1, len(cols) + 1)[1:-1])
    out = np.broadcast_to(hexc(cols[0]), x.shape + (3,)).copy()
    for t, c in zip(q, cols[1:]):
        out = lerp(out, hexc(c), sstep(t - soft, t + soft, x))
    return out


def blobs(img_rgb, n, seed, r_rng, color_at, squash=1.0, mask=None, rot=None):
    """圆润色块（卡通的草团 / 树冠 / 石块）：上半亮、下半暗的两色块，带一条深色描边"""
    r = np.random.default_rng(seed)
    img = to_img(img_rgb)
    d = ImageDraw.Draw(img)
    for _ in range(int(n * S * S)):
        x, y = r.random() * N, r.random() * N
        ix, iy = int(x) % N, int(y) % N
        if mask is not None and r.random() > mask[iy, ix]: continue
        rad = r.uniform(*r_rng) * S
        base = color_at(ix, iy)
        k = 10
        a0 = rot if rot is not None else r.random() * np.pi
        jit = 1 + r.normal(0, 0.06, k)
        def poly(sc, dx=0.0, dy=0.0):
            return [(x + dx + np.cos(t + a0) * rad * sc * jit[i], y + dy + np.sin(t + a0) * rad * sc * squash * jit[i])
                    for i, t in enumerate(np.linspace(0, 2 * np.pi, k, endpoint=False))]
        col = lambda c: tuple(int(v) for v in np.clip(c * 255, 0, 255))
        wrap_draw(d, poly(1.08, 0, rad * 0.12), col(base * 0.55))          # 描边 / 投影（略向下）
        wrap_draw(d, poly(1.0), col(base * 0.86))                           # 暗面
        wrap_draw(d, poly(0.72, -rad * 0.12, -rad * 0.16), col(base))       # 亮面
        wrap_draw(d, poly(0.3, -rad * 0.3, -rad * 0.34), col(np.minimum(base * 1.18 + 0.03, 1)))   # 高光
    return from_img(img)


def grass():
    # 平涂草地：三个色阶的大色块 + 稀疏的“草簇”记号（Λ 形三笔），远看干净，近看有手绘感
    n1, n2 = noise(1, 4, 101), noise(4, 10, 102)
    f = n1 + n2 * 0.45
    c = bands(f, ['#5f9a32', '#74ad3a', '#86bc43', '#9bc94c'], 0.05)
    h = sstep(-1.6, 1.6, f)
    img = to_img(c); d = ImageDraw.Draw(img)
    r = np.random.default_rng(103)
    for _ in range(int(650 * S * S)):
        x, y = r.random() * N, r.random() * N
        ix, iy = int(x) % N, int(y) % N
        base = c[iy, ix]
        L = r.uniform(15, 24) * S; W = 2.6 * S
        dark = r.random() < 0.6
        col = tuple(int(v) for v in np.clip((base * (0.78 if dark else 1.16) + (0 if dark else 0.02)) * 255, 0, 255))
        for a in (-0.45, 0.0, 0.45):            # 三片叶：中间高、两边斜，从同一个根部长出
            l = L * (1.0 if a == 0 else 0.7)
            aa = -np.pi / 2 + a + r.normal(0, 0.08)
            tip = (x + np.cos(aa) * l, y + np.sin(aa) * l)
            nx, ny = -np.sin(aa) * W, np.cos(aa) * W
            mid = (x + np.cos(aa) * l * 0.45, y + np.sin(aa) * l * 0.45)
            wrap_draw(d, [(x - nx, y - ny), (mid[0] - nx * 0.8, mid[1] - ny * 0.8), tip, (mid[0] + nx * 0.8, mid[1] + ny * 0.8), (x + nx, y + ny)], col)
    # 小花：少量、成簇
    for _ in range(int(40 * S * S)):
        cx, cy = r.random() * N, r.random() * N
        col = [(250, 244, 222), (250, 214, 84), (238, 140, 150)][r.integers(3)]
        for _ in range(r.integers(3, 7)):
            x, y = cx + r.normal(0, 14 * S), cy + r.normal(0, 14 * S); s = r.uniform(2.6, 3.8) * S
            wrap_draw(d, [(x + np.cos(t) * s, y + np.sin(t) * s) for t in np.linspace(0, 6.28, 6, endpoint=False)], col)
    return from_img(img), h


def paddy():
    # 水田：平涂的秧苗行（两种绿）+ 行间亮青色水面，行稍有弯曲；不再是细密条纹
    n1 = noise(1, 3, 121)
    rows = 18
    yy = (np.arange(N)[:, None] + n1 * 10 * S) / N * rows
    fr = yy % 1
    rowm = sstep(0.16, 0.24, fr) * (1 - sstep(0.76, 0.84, fr))
    tone = sstep(-1.0, 1.0, noise(2, 6, 122))
    plant = lerp(hexc('#6eaa36'), hexc('#8cc24a'), tone)
    plant = lerp(plant, plant * 1.12, sstep(0.25, 0.4, fr) * (1 - sstep(0.4, 0.55, fr)))   # 每行上沿亮
    water = lerp(hexc('#6fb0a6'), hexc('#8ccac0'), sstep(-1, 1, noise(3, 8, 123)))
    c = lerp(water, plant, rowm)
    h = np.clip(rowm * 0.85 + 0.1, 0, 1)
    return c, h


def forest():
    # 林下：深绿平涂底 + 大小两级圆润“灌木团”（亮面 / 暗面 / 高光三色），落叶色点少量
    n1, n2 = noise(1, 4, 131), noise(4, 10, 132)
    base = bands(n1 + n2 * 0.4, ['#2f6326', '#3b7429', '#4a842f'], 0.05)
    c = blobs(base, 230, 133, (24, 38), lambda x, y: base[y, x] * 1.25 + np.array([0.02, 0.03, 0.0]))
    c = blobs(c, 380, 134, (12, 19), lambda x, y: base[y, x] * 1.45 + np.array([0.04, 0.05, 0.0]))
    img = to_img(c); d = ImageDraw.Draw(img); r = np.random.default_rng(135)
    for _ in range(int(160 * S * S)):
        x, y = r.random() * N, r.random() * N; s = r.uniform(3, 5) * S
        col = [(214, 160, 66), (196, 110, 52)][r.integers(2)]
        wrap_draw(d, [(x + np.cos(t) * s, y + np.sin(t) * s * 0.8) for t in np.linspace(0, 6.28, 7, endpoint=False)], col)
    c = from_img(img)
    h = sstep(0.18, 0.5, c.mean(2))
    return c, h


def rock():
    # 卡通岩石：大的多边形石块（Voronoi），每块平涂一色，上沿一条亮边、下沿一条暗边，缝隙深色；无细碎纹理
    r = np.random.default_rng(141)
    K = 1.6
    P = r.random((46, 2)) * [1, K]
    tree = cKDTree(P, boxsize=[1, K])
    g = (np.arange(N) + 0.5) / N
    Y, X = np.meshgrid(g, g, indexing='ij')
    warp = noise(1, 3, 142) * 0.02
    d, i = tree.query(np.stack([X.ravel(), ((Y + warp) % 1).ravel() * K], 1), k=2)
    f1, f2, idx = d[:, 0].reshape(N, N), d[:, 1].reshape(N, N), i[:, 0].reshape(N, N)
    edge = f2 - f1
    tone = r.random(len(P))
    pal = [hexc('#8c8579'), hexc('#9d9585'), hexc('#ada38f'), hexc('#857c6e')]
    c = np.stack([pal[int(t * 4) % 4] for t in tone])[idx]
    crack = 1 - sstep(0.004, 0.012, edge)
    # 每块的“顶面”：沿裂缝往上一段亮边，往下一段暗边（像 Civ 式的厚石块）
    above = (1 - sstep(0.012, 0.03, edge)) * (np.roll(edge, int(10 * S), 0) > edge)
    c = lerp(c, np.minimum(c * 1.2 + 0.03, 1), np.clip(above, 0, 1) * 0.9)
    below = np.roll(crack, int(9 * S), 0) * (1 - crack)
    c = lerp(c, c * 0.68, np.clip(below, 0, 1))
    c = lerp(c, hexc('#4a433b'), crack)
    c = lerp(c, hexc('#7d8a52'), sstep(0.9, 1.6, noise(2, 6, 143)) * 0.55 * (1 - crack))   # 苔藓色块
    h = np.clip(sstep(0.0, 0.05, edge), 0, 1)
    return c, h


def sand():
    # 沙：两色平涂 + 宽而柔的沙纹（亮带），几颗小贝壳 / 石子
    n1 = noise(1, 4, 151)
    warp = noise(1, 3, 152) * 30 * S
    yy = (np.arange(N)[:, None] + warp + np.arange(N)[None, :] * 0.2) / N * 9
    rip = sstep(0.55, 0.75, 0.5 + 0.5 * np.sin(yy * 2 * np.pi))
    c = bands(n1, ['#dcc58b', '#e7d39c', '#f0dfae'], 0.06)
    c = lerp(c, np.minimum(c * 1.07, 1), rip * 0.8)
    h = np.clip(rip * 0.6 + sstep(-1.5, 1.5, n1) * 0.4, 0, 1)
    img = to_img(c); d = ImageDraw.Draw(img); r = np.random.default_rng(153)
    for _ in range(int(90 * S * S)):
        x, y = r.random() * N, r.random() * N; s = r.uniform(3, 5.5) * S
        col = [(246, 238, 220), (190, 162, 120), (238, 196, 170)][r.integers(3)]
        wrap_draw(d, [(x + np.cos(t) * s, y + np.sin(t) * s * 0.7) for t in np.linspace(0, 6.28, 7, endpoint=False)], col)
    return from_img(img), h


def snow():
    # 雪：白与浅蓝两色平涂的雪堆，背光一侧浅蓝；少量亮点
    n1, n2 = noise(1, 4, 161), noise(4, 10, 162)
    f = n1 + n2 * 0.5
    h = sstep(-1.4, 1.4, f)
    lit = shade(h, 1.2)
    c = lerp(hexc('#c3d3e8'), hexc('#f3f7fc'), sstep(0.92, 1.02, lit))
    c = lerp(c, hexc('#ffffff'), sstep(1.1, 1.2, lit) * 0.7)
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
    out = ROOT / 'public/tex/terrain-hd.webp'
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out, 'WEBP', quality=HD_QUALITY, alpha_quality=HD_ALPHA, method=6, exact=True)
    print(f'→ {out.relative_to(ROOT)}  {out.stat().st_size / 1024:.0f} KB')
    # 首屏用的 512² 版：同一张图缩小（RGB 和 A 分开缩，同上）
    small = Image.new('RGBA', (512, 512 * len(tiles)))
    for i, t in enumerate(tiles):
        rgb = t.convert('RGB').resize((512, 512), Image.LANCZOS)
        al = t.getchannel('A').resize((512, 512), Image.LANCZOS)
        rgb.putalpha(al); small.paste(rgb, (0, i * 512))
    out2 = ROOT / 'public/tex/terrain.webp'
    small.save(out2, 'WEBP', quality=QUALITY, alpha_quality=45, method=6, exact=True)
    print(f'→ {out2.relative_to(ROOT)}  {out2.stat().st_size / 1024:.0f} KB')
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
