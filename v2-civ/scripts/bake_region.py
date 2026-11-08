# Bake one or more 3D map regions listed in src/data/regions.json.
# Usage (from v2-civ/): python scripts/bake_region.py jingjin chengyu ...   (needs numpy, Pillow, scipy)
# Downloads Natural Earth 10m (land, lakes, rivers) into bake-raw/ne/ and Terrarium elevation into bake-raw/dem/<id>/,
# writes public/data/regions/<id>/{height.png, water.png, rivers.json, meta.json} and updates hmax in regions.json.
import json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, 'scripts')
NE = os.path.join(ROOT, 'bake-raw', 'ne')
REGIONS = os.path.join(ROOT, 'src', 'data', 'regions.json')
NE_URL = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/'  # raw.githubusercontent 在国内常连不上


def fetch_ne():
    os.makedirs(NE, exist_ok=True)
    for name in ('ne_10m_land', 'ne_10m_lakes', 'ne_10m_rivers_lake_centerlines'):
        p = os.path.join(NE, name + '.geojson')
        if not os.path.exists(p):
            print('download', name, flush=True)
            open(p, 'wb').write(urllib.request.urlopen(NE_URL + name + '.geojson', timeout=300).read())


def bake(rid, table):
    r = table[rid]
    env = dict(os.environ, REGION_ID=rid, LON0=str(r['lon0']), LAT0=str(r['lat0']))
    dem = os.path.join(ROOT, 'bake-raw', 'dem', rid)
    out = os.path.join(ROOT, 'public', 'data', 'regions', rid)
    os.makedirs(out, exist_ok=True)
    print(f'== {rid} {r["name"]}', flush=True)
    subprocess.run([sys.executable, os.path.join(SCRIPTS, 'fetch_dem.py'), SCRIPTS, dem], env=env, check=True)
    subprocess.run([sys.executable, os.path.join(SCRIPTS, 'bake.py'), SCRIPTS, dem, NE, out], env=env, check=True)
    r['hmax'] = json.load(open(os.path.join(out, 'meta.json')))['hmax']


if __name__ == '__main__':
    table = json.load(open(REGIONS, encoding='utf-8'))
    fetch_ne()
    for rid in sys.argv[1:] or [k for k in table if k != 'yrd']:
        bake(rid, table)
        with open(REGIONS, 'w', encoding='utf-8') as f:  # keep hmax in step with the baked height.png
            f.write('{\n' + ',\n'.join(f'  "{k}": ' + json.dumps(v, ensure_ascii=False) for k, v in table.items()) + '\n}\n')
