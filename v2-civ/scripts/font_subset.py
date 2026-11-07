"""思源宋体 Bold 子集化 → public/fonts/igcm-serif-bold.woff2（OFL 保留名 Source，子集改名为 IGCM Serif）
用法：python3 scripts/font_subset.py（在 v2-civ 下跑；改了社团数据或界面文案后重跑）
"""
import json, subprocess, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # v2-civ
URL = 'https://github.com/adobe-fonts/source-han-serif/raw/release/SubsetOTF/CN/SourceHanSerifCN-Bold.otf'
SRC = ROOT / 'scripts/.cache/SourceHanSerifCN-Bold.otf'
OUT = ROOT / 'public/fonts/igcm-serif-bold.woff2'

if not SRC.exists():
    SRC.parent.mkdir(parents=True, exist_ok=True)
    print('下载', URL)
    urllib.request.urlretrieve(URL, SRC)

chars = set(chr(c) for c in range(0x20, 0x7f))
for r in json.loads((ROOT.parent / 'site/data/communities.json').read_text('utf-8')):
    for k in ('name', 'city', 'otherCities'):
        chars |= set(r.get(k) or '')
for f in ['src/data.js', 'src/ui.js', 'src/main.js', 'src/icons.js', 'index.html']:
    p = ROOT / f
    if p.exists():
        chars |= {c for c in p.read_text('utf-8') if ord(c) > 0x7f}
chars -= set('\n\r\t')

OUT.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([sys.executable, '-m', 'fontTools.subset', str(SRC), '--text=' + ''.join(sorted(chars)),
                '--flavor=woff2', '--output-file=' + str(OUT), '--no-hinting', '--desubroutinize',
                '--layout-features=kern,palt,vpal', '--name-IDs=1,2,3,4,6'], check=True)
# OFL：改过的字体不能再叫 Source，改名
from fontTools.ttLib import TTFont
f = TTFont(OUT)
for rec in f['name'].names:
    if rec.nameID in (1, 3, 4, 6):
        rec.string = {1: 'IGCM Serif', 3: 'IGCM Serif Bold subset', 4: 'IGCM Serif Bold', 6: 'IGCMSerif-Bold'}[rec.nameID]
f.flavor = 'woff2'
f.save(OUT)
print(f'{len(chars)} 字 → {OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.1f} KB')
