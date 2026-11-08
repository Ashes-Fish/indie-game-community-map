# Bake frame for one land patch (地块): a rectangle in the national Albers frame (see src/albers.js toGlobal),
# 1 unit = 1 km, x east, z south. bake_patch.py sets PATCH_ID and RECT=x0,z0,x1,z1 from src/data/patches.json.
import math
import os
import numpy as np
REGION_ID = os.environ.get('PATCH_ID', 'yrd')
XMIN, ZMIN, XMAX, ZMAX = map(float, os.environ.get('RECT', '1095,345,1689,867').split(','))
RES = 0.75
W = int(round((XMAX - XMIN) / RES)); H = int(round((ZMAX - ZMIN) / RES))

# Albers equal-area conic, keep in step with src/albers.js
R_E, LAM0 = 6371.0, math.radians(105.0)
P1, P2 = math.radians(25.0), math.radians(47.0)
NN = (math.sin(P1) + math.sin(P2)) / 2
CC = math.cos(P1) ** 2 + 2 * NN * math.sin(P1)
RHO0 = R_E * math.sqrt(CC) / NN
Z0 = 4000.0


def to_world(lon, lat):
    """lon/lat (deg, scalars or arrays) -> (x, z) km in the national frame."""
    th = NN * (np.radians(lon) - LAM0)
    rho = R_E * np.sqrt(CC - 2 * NN * np.sin(np.radians(lat))) / NN
    return rho * np.sin(th), Z0 - (RHO0 - rho * np.cos(th))


def to_lonlat(x, z):
    y = Z0 - np.asarray(z, dtype=np.float64)
    x = np.asarray(x, dtype=np.float64)
    rho = np.sqrt(x * x + (RHO0 - y) ** 2)
    th = np.arctan2(x, RHO0 - y)
    lat = np.degrees(np.arcsin(np.clip((CC - (rho * NN / R_E) ** 2) / (2 * NN), -1, 1)))
    return np.degrees(LAM0 + th / NN), lat


def to_px(x, z): return ((x - XMIN) / RES, (z - ZMIN) / RES)


def bounds(margin_km=30.0):
    """(west, south, east, north) degrees covering the patch plus a margin."""
    t = np.linspace(0, 1, 41)
    x0, x1, z0, z1 = XMIN - margin_km, XMAX + margin_km, ZMIN - margin_km, ZMAX + margin_km
    xs = np.concatenate([x0 + (x1 - x0) * t, np.full_like(t, x1), x0 + (x1 - x0) * t, np.full_like(t, x0)])
    zs = np.concatenate([np.full_like(t, z0), z0 + (z1 - z0) * t, np.full_like(t, z1), z0 + (z1 - z0) * t])
    lon, lat = to_lonlat(xs, zs)
    return float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())
