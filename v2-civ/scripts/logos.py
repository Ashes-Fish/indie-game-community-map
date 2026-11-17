"""社团 logo → public/logos/<key>.webp（256×256，非正方形补边居中）。
用法：在 v2-civ 下运行  python scripts/logos.py
communities.json 里每条有 logo 的社团都会生成一张；文件名用社团在地图上的 key（与 src/data.js 的规则一致），
data.js 看到 logo 字段就会去读这张图。已存在、且源图没变的不重做。
"""
import json, hashlib, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent          # v2-civ
DATA = ROOT.parent / 'site/data/communities.json'
SRC = ROOT.parent / 'site'
OUT = ROOT / 'public/logos'
SIZE = 256

# 与 data.js 里 META 手写的 key 保持一致（这些社团的 logo 文件名早已固定）
KEYS = {
    'Ludere独游互助社区': 'ludere', '游戏客厅': 'keting', '赛博利亚': 'cyberia', '星游集游戏人据点': 'xingyouji',
    '创乐坊': 'chuanglefang', '存档点': 'cundang', 'The Pinewood Lab艺术游戏社区': 'pinewood',
    '冻土回声': 'dongtu', '纽约大学游戏社': 'nyugame',
}

def str_hash(s):
    """data.js strHash：FNV-1a 32 位，按 Unicode 码点"""
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h

def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'; s = ''
    while True:
        n, r = divmod(n, 36); s = d[r] + s
        if not n: return s

def key_of(name):
    return KEYS.get(name) or 'c' + b36(str_hash(name))

def square(im):
    im = im.convert('RGBA')
    w, h = im.size; s = max(w, h)
    # 补边颜色取四角平均（logo 多是纯色底），透明图补透明再压到白底
    px = [im.getpixel(p) for p in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    if min(p[3] for p in px) < 250:
        bg = (255, 255, 255, 255)
    else:
        bg = tuple(sum(p[i] for p in px) // 4 for i in range(3)) + (255,)
    sq = Image.new('RGBA', (s, s), bg)
    sq.paste(im, ((s - w) // 2, (s - h) // 2), im)
    flat = Image.new('RGB', (s, s), (255, 255, 255)); flat.paste(sq, (0, 0), sq)
    return flat.resize((SIZE, SIZE), Image.LANCZOS)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = kept = 0
    for r in json.loads(DATA.read_text('utf-8')):
        if not r.get('logo'):
            continue
        src = SRC / r['logo']
        if not src.exists():
            print('找不到 logo：', r['name'], src, file=sys.stderr); continue
        key = key_of(r['name'])
        dst = OUT / f'{key}.webp'
        stamp = OUT / f'.{key}.src'
        digest = hashlib.sha256(src.read_bytes()).hexdigest()[:16]
        if dst.exists() and stamp.exists() and stamp.read_text() == digest:
            kept += 1; continue
        if dst.exists() and not stamp.exists():
            # 早先手工做的那几张：保留，只记下源图指纹
            stamp.write_text(digest); kept += 1; continue
        square(Image.open(src)).save(dst, 'WEBP', quality=82, method=6)
        stamp.write_text(digest)
        made += 1
        print(f'{r["name"]} → logos/{key}.webp')
    print(f'新生成 {made} 张，保留 {kept} 张')

if __name__ == '__main__':
    main()
