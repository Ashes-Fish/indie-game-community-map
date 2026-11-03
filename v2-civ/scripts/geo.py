import math
LON0, LAT0 = 120.1, 31.1
KX = 111.32 * math.cos(math.radians(LAT0))
KZ = 110.6
XMIN, XMAX, ZMIN, ZMAX = -300.0, 300.0, -270.0, 270.0
RES = 0.75
W = int(round((XMAX - XMIN) / RES)); H = int(round((ZMAX - ZMIN) / RES))
def to_world(lon, lat): return ((lon - LON0) * KX, (LAT0 - lat) * KZ)
def to_px(x, z): return ((x - XMIN) / RES, (z - ZMIN) / RES)
def to_lonlat(x, z): return (LON0 + x / KX, LAT0 - z / KZ)
