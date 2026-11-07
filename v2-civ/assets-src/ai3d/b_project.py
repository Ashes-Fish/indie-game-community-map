# B 版后处理第一步：减面 + 把概念图投影成贴图（本机没有 CUDA，混元的贴图模型跑不了）。
# 1) pymeshlab 二次误差减面到目标面数；
# 2) 用 rembg 抠出概念图的剪影，在 (方位角, 仰角) 网格上搜正交视角，找和网格剪影 IoU 最高的那个；
# 3) 按这个视角把每个顶点投到概念图上当 UV（背面和被挡住的面会拿到前面的颜色，地图镜头只从南面看，影响小）；
# 4) 把模型转到「概念图视角 = 地图镜头方向（南）」，导出带贴图的 GLB 给 Blender 加底座、烘焙。
# 用法：/tmp/igcm-work/hy3d/.venv/bin/python -I b_project.py raw.glb concept.webp out.glb [目标面数]
import math
import sys

import numpy as np
import pymeshlab
import trimesh
from PIL import Image, ImageDraw
from rembg import new_session, remove

raw, concept, out = sys.argv[1:4]
target = int(sys.argv[4]) if len(sys.argv) > 4 else 12000


def decimate(mesh, n):
    ms = pymeshlab.MeshSet()
    ms.add_mesh(pymeshlab.Mesh(mesh.vertices, mesh.faces))
    ms.meshing_decimation_quadric_edge_collapse(targetfacenum=n, preservenormal=True, preservetopology=False,
                                                optimalplacement=True, qualitythr=0.4, planarquadric=True)
    m = ms.current_mesh()
    return trimesh.Trimesh(m.vertex_matrix(), m.face_matrix(), process=True)


src = trimesh.load(raw, force='mesh')  # glTF：Y 向上
src.vertices -= src.bounds.mean(0)
mesh = decimate(src, target)
coarse = decimate(src, 2500)
print('faces', len(src.faces), '->', len(mesh.faces))

img = Image.open(concept).convert('RGB')
W, H = img.size
cut = remove(img, session=new_session('u2net'))
alpha = np.array(cut)[..., 3] > 128
ys, xs = np.nonzero(alpha)
mb = np.array([xs.min(), ys.min(), xs.max(), ys.max()], float)  # 概念图剪影包围盒


def view_rot(az, el):
    """先绕 Y 转 az，再绕 X 转 el（相机从 +Z 方向、抬高 el 往下看）。"""
    a, e = math.radians(az), math.radians(el)
    Ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(e), -math.sin(e)], [0, math.sin(e), math.cos(e)]])
    return Rx @ Ry


def project(v, R):
    p = v @ R.T
    x, y = p[:, 0], -p[:, 1]
    bb = np.array([x.min(), y.min(), x.max(), y.max()])
    s = (mb[3] - mb[1]) / (bb[3] - bb[1])  # 按高度对齐，中心对齐
    px = (x - (bb[0] + bb[2]) / 2) * s + (mb[0] + mb[2]) / 2
    py = (y - (bb[1] + bb[3]) / 2) * s + (mb[1] + mb[3]) / 2
    return np.stack([px, py], 1), p[:, 2]


S = 4  # 搜索时缩小 4 倍
small = Image.fromarray(alpha).resize((W // S, H // S))
am = np.array(small) > 0


def iou(az, el):
    uv, _ = project(coarse.vertices, view_rot(az, el))
    im = Image.new('1', (W // S, H // S), 0)
    d = ImageDraw.Draw(im)
    for f in coarse.faces:
        d.polygon([tuple(uv[i] / S) for i in f], fill=1)
    m = np.array(im)
    return (m & am).sum() / max(1, (m | am).sum())


best = max(((iou(az, el), az, el) for az in range(-180, 180, 10) for el in range(0, 61, 10)))
_, az0, el0 = best
best = max(((iou(az, el), az, el) for az in range(az0 - 8, az0 + 9, 2) for el in range(max(0, el0 - 8), el0 + 9, 2)))
score, az, el = best
print(f'best view az={az} el={el} IoU={score:.3f}')

uv, depth = project(mesh.vertices, view_rot(az, el))
# 稍微往剪影里收一点，避免边缘采到白底
uvn = np.stack([uv[:, 0] / W, 1 - uv[:, 1] / H], 1).clip(0.002, 0.998)
# 转成：概念图视角朝向地图镜头。地图镜头在南（glTF +Z），只保留方位角，仰角不动
a = math.radians(az)
Ry = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]])
v = mesh.vertices @ Ry.T
v[:, 1] -= v[:, 1].min()
tex = Image.fromarray(np.array(img))
out_mesh = trimesh.Trimesh(v, mesh.faces, visual=trimesh.visual.TextureVisuals(uv=uvn, image=tex), process=False)
out_mesh.export(out)
print('wrote', out, 'extent', np.ptp(v, 0))
