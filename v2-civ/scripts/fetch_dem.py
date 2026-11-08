# Download Terrarium tiles covering the bake extent (z9) and mosaic into a float32 npy (web mercator grid)
# Usage: fetch_dem.py <scripts dir> <out dir>   (region from geo.py / environment)
import math, os, sys, time, urllib.request
import numpy as np
from PIL import Image
sys.path.insert(0, sys.argv[1]); import geo
OUT = sys.argv[2]
Z = 9
W, S, E, N = geo.bounds(30.0)
def tx(lon): return (lon + 180) / 360 * 2**Z
def ty(lat):
    r = math.radians(lat); return (1 - math.asinh(math.tan(r)) / math.pi) / 2 * 2**Z
x0, x1 = int(tx(W)), int(tx(E)); y0, y1 = int(ty(N)), int(ty(S))
print('tiles', x0, x1, y0, y1, flush=True)
os.makedirs(OUT, exist_ok=True)
mos = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1):
        p = os.path.join(OUT, f'{Z}_{x}_{y}.png')
        try:  # cached tile; an interrupted earlier download is re-fetched
            img = Image.open(p).convert('RGB')
        except (OSError, Image.UnidentifiedImageError):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
            for k in range(6):  # the handshake to S3 times out now and then from mainland networks
                try:
                    data = urllib.request.urlopen(url, timeout=60).read()
                    break
                except OSError as e:
                    if k == 5: raise
                    print('retry', x, y, e, flush=True); time.sleep(3 + k * 3)
            open(p + '.part', 'wb').write(data)
            os.replace(p + '.part', p)
            img = Image.open(p).convert('RGB')
        a = np.asarray(img).astype(np.float32)
        h = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        mos[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = h
np.save(os.path.join(OUT, 'mosaic.npy'), mos)
open(os.path.join(OUT, 'mosaic.txt'), 'w').write(f'{Z} {x0} {y0}')
print(mos.shape, mos.min(), mos.max())
