import math
import os
# Region origin comes from the environment (bake_region.py sets it from src/data/regions.json); default = 长三角.
REGION_ID = os.environ.get('REGION_ID', 'yrd')
LON0, LAT0 = float(os.environ.get('LON0', 120.1)), float(os.environ.get('LAT0', 31.1))
KX = 111.32 * math.cos(math.radians(LAT0))
KZ = 110.6
XMIN, XMAX, ZMIN, ZMAX = -300.0, 300.0, -270.0, 270.0
RES = 0.75
W = int(round((XMAX - XMIN) / RES)); H = int(round((ZMAX - ZMIN) / RES))
def to_world(lon, lat): return ((lon - LON0) * KX, (LAT0 - lat) * KZ)
def to_px(x, z): return ((x - XMIN) / RES, (z - ZMIN) / RES)
def to_lonlat(x, z): return (LON0 + x / KX, LAT0 - z / KZ)
def bounds(margin_km=30.0):
    """(west, south, east, north) of the region plus a margin, in degrees."""
    w, n = to_lonlat(XMIN - margin_km, ZMIN - margin_km)
    e, s = to_lonlat(XMAX + margin_km, ZMAX + margin_km)
    return w, s, e, n
