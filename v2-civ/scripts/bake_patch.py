# Bake the land patches listed in src/data/patches.json (run scripts/patches.mjs first).
# Usage (from v2-civ/): python scripts/bake_patch.py [id ...]   (needs numpy, Pillow, scipy; default = every patch)
# Downloads Natural Earth 10m (land, lakes, rivers) into bake-raw/ne/ and Terrarium elevation into bake-raw/dem/<id>/,
# writes public/data/patches/<id>/{height.png, water.png, rivers.json, meta.json} and updates hmax in patches.json.
import json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, 'scripts')
NE = os.path.join(ROOT, 'bake-raw', 'ne')
PATCHES = os.path.join(ROOT, 'src', 'data', 'patches.json')
NE_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/'  # raw.githubusercontent 在国内常连不上


def fetch_ne():
    os.makedirs(NE, exist_ok=True)
    for name in ('ne_10m_land', 'ne_10m_lakes', 'ne_10m_rivers_lake_centerlines'):
        p = os.path.join(NE, name + '.geojson')
        if not os.path.exists(p):
            print('download', name, flush=True)
            open(p, 'wb').write(urllib.request.urlopen(NE_URL + name + '.geojson', timeout=300).read())


def bake(pid, p):
    env = dict(os.environ, PATCH_ID=pid, RECT=','.join(str(v) for v in p['rect']))
    dem = os.path.join(ROOT, 'bake-raw', 'dem', pid)
    out = os.path.join(ROOT, 'public', 'data', 'patches', pid)
    os.makedirs(out, exist_ok=True)
    print(f'== {pid} {p["name"]} {p["rect"]}', flush=True)
    subprocess.run([sys.executable, os.path.join(SCRIPTS, 'fetch_dem.py'), SCRIPTS, dem], env=env, check=True)
    subprocess.run([sys.executable, os.path.join(SCRIPTS, 'bake.py'), SCRIPTS, dem, NE, out], env=env, check=True)
    p['hmax'] = json.load(open(os.path.join(out, 'meta.json')))['hmax']


if __name__ == '__main__':
    table = json.load(open(PATCHES, encoding='utf-8'))
    fetch_ne()
    for pid in sys.argv[1:] or list(table):
        bake(pid, table[pid])
        with open(PATCHES, 'w', encoding='utf-8') as f:  # keep hmax in step with the baked height.png
            f.write('{\n' + ',\n'.join(f'  "{k}": ' + json.dumps(v, ensure_ascii=False, separators=(',', ':')) for k, v in table.items()) + '\n}\n')
