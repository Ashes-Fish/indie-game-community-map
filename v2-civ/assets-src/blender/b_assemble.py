# B 版组装：AI 网格（已减面、已投影贴图）+ 统一调色 + 顶点 AO + 系统底座（烘焙 AO），导出 GLB。
# 用法：Blender -b --factory-startup -P b_assemble.py -- guild|pagoda  b_proj.glb  输出目录
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import lib  # noqa: E402
import models  # noqa: E402

kind, src, out = sys.argv[sys.argv.index('--') + 1:][:3]
out = os.path.abspath(out)
os.makedirs(out, exist_ok=True)
lib.clear_scene()
lib.PARTS.clear()
lib.GLOW.clear()

bpy.ops.import_scene.gltf(filepath=src)
ai = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.ops.object.select_all(action='DESELECT')
ai.select_set(True)
bpy.context.view_layer.objects.active = ai
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ai.parent = None
me = ai.data
v = np.empty(len(me.vertices) * 3, np.float32)
me.vertices.foreach_get('co', v)
v = v.reshape(-1, 3)
lo, hi = v.min(0), v.max(0)
low = v[v[:, 2] < lo[2] + (hi[2] - lo[2]) * 0.06]  # 贴地那一圈：AI 自带台基 / 底层的占地
flo, fhi = low.min(0), low.max(0)
c = (flo + fhi) / 2
if kind == 'guild':
    z0 = models.base_hex()
    models.WALL_Z0[0] = z0
    models.clutter(z0)  # 和 A 版同一套地块杂物
    s = 4.4 / max(hi[0] - lo[0], hi[1] - lo[1])
    # 统一台基：AI 网格底层常是一圈乱柱子，垫一个石台把它埋掉一截
    pw, pd, ph = (fhi[0] - flo[0]) * s * 0.92, (fhi[1] - flo[1]) * s * 0.92, 0.3
    lib.box(pw, pd, ph, 0, 0, z0, 'stone', bevel=0.04)
    lib.box(pw + 0.06, pd + 0.06, 0.06, 0, 0, z0 + ph - 0.06, 'stone_dk', bevel=0.02)
    dz = z0 + ph - 0.18
else:
    s = 6.0 / (hi[2] - lo[2])  # 和 A 版塔同高
    # 统一底座：贴着 AI 自带方台垫一圈往下延伸的石台，适应山坡
    w = max(fhi[0] - flo[0], fhi[1] - flo[1]) * s * 1.04
    lib.box(w, w, 0.6, 0, 0, -0.5, 'stone', bevel=0.04)
    dz = 0.02
v = (v - np.array([c[0], c[1], lo[2]])) * s + np.array([0, 0, dz])
me.vertices.foreach_set('co', v.ravel())
me.update()
me.shade_smooth()
me.set_sharp_from_angle(angle=math.radians(45))

# 统一调色：压对比、降饱和、向官方色板靠拢 35%
mat = me.materials[0]
tn = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0]
img = tn.image
W, H = img.size
px = np.empty(W * H * 4, np.float32)
img.pixels.foreach_get(px)
px = px.reshape(H, W, 4)
rgb = px[..., :3]
pal = np.array([[int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)] for h in
                [lib.PAL[k] for k in ('roof', 'roof_dk', 'wall_ochre', 'wall_red', 'pillar', 'gold', 'stone', 'stone_dk',
                                      'wall_white', 'bracket', 'leaf', 'wood_dk', 'soffit')]], np.float32)
lum = rgb @ np.array([0.3, 0.59, 0.11], np.float32)
rgb = lum[..., None] + (rgb - lum[..., None]) * 0.88
rgb = 0.5 + (rgb - 0.5) * 0.86
d = ((rgb[..., None, :] - pal) ** 2 * np.array([0.3, 0.59, 0.11])).sum(-1)
near = pal[d.argmin(-1)]
rgb = np.clip(rgb * 0.65 + near * 0.35, 0, 1)
px[..., :3] = rgb
img.pixels.foreach_set(px.ravel())
img.update()
img.file_format = 'PNG'
img.filepath_raw = os.path.join(out, f'b_{kind}_ai_tex.png')
img.save()
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.9
bsdf.inputs['Metallic'].default_value = 0.0
mat.name = f'b_{kind}_ai'

# 顶点 AO（AI 网格的 UV 是投影的、有重叠，不能烘到贴图）
lib.setup_cycles(64)
bpy.context.scene.world.light_settings.distance = 0.6
ca = me.color_attributes.new('AO', 'BYTE_COLOR', 'POINT')
me.color_attributes.active_color = ca
bpy.ops.object.select_all(action='DESELECT')
ai.select_set(True)
bpy.context.view_layer.objects.active = ai
bpy.context.scene.render.bake.target = 'VERTEX_COLORS'
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
cols = np.empty(len(ca.data) * 4, np.float32)
ca.data.foreach_get('color', cols)
cols = cols.reshape(-1, 4)
a = 1 - 0.6 * (1 - cols[:, 0])
cols[:, :3] = a[:, None]
ca.data.foreach_set('color', cols.ravel())
bpy.context.scene.render.bake.target = 'IMAGE_TEXTURES'
print('[ai] tris', lib.tri_count(ai))
ob, path = lib.bake_and_export(f'b_{kind}', out, size=512, ao_dist=0.8, extra_export=[ai])
lib.render_preview(os.path.join(out, f'b_{kind}_preview.png'))
print('OK', path, 'base tris', lib.tri_count(ob), 'ai tris', lib.tri_count(ai))
