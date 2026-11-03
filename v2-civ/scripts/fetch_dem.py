# Download Terrarium tiles covering the bake extent (z9) and mosaic into a float32 npy (web mercator grid)
import math, os, sys, urllib.request, io
import numpy as np
from PIL import Image
OUT = sys.argv[1]
Z = 9
W, S, E, N = 116.85, 28.6, 123.35, 33.6
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat):
    r = math.radians(lat); return (1 - math.asinh(math.tan(r)) / math.pi) / 2 * 2**Z
x0, x1 = int(tx(W)), int(tx(E)); y0, y1 = int(ty(N)), int(ty(S))
print('tiles', x0, x1, y0, y1)
os.makedirs(OUT, exist_ok=True)
mos = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        p = os.path.join(OUT, f'{Z}_{x}_{y}.png')
        if not os.path.exists(p):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
            open(p, 'wb').write(urllib.request.urlopen(url, timeout=60).read())
        a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
        h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        mos[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x1 + x1 - x0 + 1) * 256 if False else (x - x0 + 1) * 256] = h
np.save(os.path.join(OUT, 'mosaic.npy'), mos)
open(os.path.join(OUT, 'mosaic.txt'), 'w').write(f'{Z} {x0} {y0}')
print(mos.shape, mos.min(), mos.max())
