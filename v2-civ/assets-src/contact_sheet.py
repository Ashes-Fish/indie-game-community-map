# 把截图转成 JPEG 存进 lab-shots，并拼一张三版并排对比图。
# 用法：python3 contact_sheet.py 原始截图目录 lab-shots目录
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
V = [('old', '旧版：代码拼基本体'), ('a', 'A：Blender 脚本建模'), ('b', 'B：AI 图生 3D')]
for a, _ in V:
    for n in ('pagoda', 'guild'):
        Image.open(src / f'{a}_{n}_desktop.png').convert('RGB').resize((1600, 900), Image.LANCZOS) \
            .save(dst / f'{a}_{n}_desktop.jpg', quality=90)
        Image.open(src / f'{a}_{n}_mobile.png').convert('RGB').save(dst / f'{a}_{n}_mobile.jpg', quality=88)


def crop(im, fw, aspect, dy=-0.03):
    """按宽度比例 fw 和目标宽高比 aspect（宽/高）从中心裁切。"""
    w, h = im.size
    cw = int(w * fw)
    ch = int(cw / aspect)
    x0, y0 = (w - cw) // 2, int((h - ch) / 2 + h * dy)
    return im.crop((x0, y0, x0 + cw, y0 + ch))


font = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 34)
small = ImageFont.truetype('/System/Library/Fonts/Hiragino Sans GB.ttc', 24)
CW, CH, MW, MH, HEAD = 640, 480, 300, 650, 64
W = 3 * CW
sheet = Image.new('RGB', (W, HEAD + 2 * CH + MH + 20), '#1d1b18')
d = ImageDraw.Draw(sheet)
for i, (a, label) in enumerate(V):
    x = i * CW
    d.text((x + CW / 2, HEAD / 2), label, font=font, fill='#f2e6c8', anchor='mm')
    for j, n in enumerate(('pagoda', 'guild')):
        im = Image.open(src / f'{a}_{n}_desktop.png').convert('RGB')
        sheet.paste(crop(im, 0.4, CW / CH).resize((CW, CH), Image.LANCZOS), (x, HEAD + j * CH))
    for k, n in enumerate(('pagoda', 'guild')):
        im = Image.open(src / f'{a}_{n}_mobile.png').convert('RGB')
        sheet.paste(crop(im, 0.86, MW / MH, -0.04).resize((MW, MH), Image.LANCZOS),
                    (x + 10 + k * (MW + 20), HEAD + 2 * CH + 10))
d.text((10, HEAD + 2 * CH - 34), '桌面 1600×900，镜头拉到最近（d=30）后的中心裁切；下排为手机竖屏 375×812', font=small, fill='#f2e6c8')
sheet.save(dst / 'compare_old_a_b.jpg', quality=90)
print('ok', sheet.size)
