# 公用工具：材质、基本体、中式屋顶、烘焙、导出。Blender 5.2，-b 无界面运行。
# 约定：Blender 单位 = 地图世界单位；Z 向上；正面朝 -Y（导出 glTF 后即地图的南 / +Z，镜头一侧）。
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- 色板（sRGB）
PAL = {
    'stone': '#ab9f87', 'stone_dk': '#857a68', 'paving': '#a1957d', 'path': '#8c8170',
    'wall_white': '#ece4d3', 'wall_ochre': '#c46a3e', 'wall_red': '#9e3b2d',
    'pillar': '#a8322a', 'wood_dk': '#4a2c22', 'lattice': '#7a3a26',
    'roof': '#4f5e72', 'roof_dk': '#5d5f66', 'roof_rim': '#7d8794', 'soffit': '#6e3328', 'ridge': '#2e3541',
    'gold': '#dcaa45', 'bracket': '#3b6f66', 'bronze': '#7b6440',
    'leaf': '#5f9136', 'leaf2': '#4b7c2c', 'trunk': '#5a3e28', 'screen': '#b8382a',
    'lantern': '#ff5a2a', 'earth': '#a48e66',
}


def lin(hexs):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1.0,)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


# ---------------------------------------------------------------- 材质（程序化，最后烘焙进一张贴图）
MATS = {}
KIND = {  # 名称 -> 类型
    'stone': 'stone', 'stone_dk': 'plain', 'paving': 'paving', 'path': 'paving',
    'wall_white': 'wall', 'wall_ochre': 'wall', 'wall_red': 'wall', 'pillar': 'wall',
    'wood_dk': 'plain', 'lattice': 'lattice', 'roof': 'roof', 'roof_dk': 'roof', 'roof_rim': 'plain', 'soffit': 'plain',
    'ridge': 'plain', 'gold': 'plain', 'bracket': 'plain', 'bronze': 'plain', 'leaf': 'leaf', 'leaf2': 'leaf',
    'trunk': 'plain', 'screen': 'plain', 'earth': 'leaf',
}


def _mix(nt, a, b, fac, blend='MIX'):
    n = nt.nodes.new('ShaderNodeMix')
    n.data_type = 'RGBA'
    n.blend_type = blend
    ins = {s.identifier: s for s in n.inputs}
    for key, v in (('Factor_Float', fac), ('A_Color', a), ('B_Color', b)):
        if isinstance(v, bpy.types.NodeSocket):
            nt.links.new(v, ins[key])
        else:
            ins[key].default_value = v
    return [o for o in n.outputs if o.identifier == 'Result_Color'][0]


def _math(nt, op, a, b=0.0, c=0.0, clamp=False):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if isinstance(v, bpy.types.NodeSocket):
            nt.links.new(v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def MAT(name):
    if name in MATS:
        return MATS[name]
    if name == 'lantern':  # 发光件不烘焙，单独材质
        m = bpy.data.materials.new('lantern')
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = lin(PAL['lantern'])
        b.inputs['Emission Color'].default_value = lin(PAL['lantern'])
        b.inputs['Emission Strength'].default_value = 2.5
        b.inputs['Roughness'].default_value = 0.9
        MATS[name] = m
        return m
    kind = KIND.get(name, 'plain')
    col = lin(PAL[name])
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    N = nt.nodes
    N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    bsdf = N.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord')
    geo = N.new('ShaderNodeNewGeometry')
    dark = tuple(c * 0.78 for c in col[:3]) + (1,)
    light = tuple(min(1, c * 1.18) for c in col[:3]) + (1,)
    # 低频色差：手绘感
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0 if kind != 'leaf' else 9.0
    nz.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    amt = 0.35 if kind == 'leaf' else 0.22
    c = _mix(nt, dark, light, nz.outputs['Fac'])
    c = _mix(nt, col, c, amt)
    if kind == 'roof':  # 瓦垄：沿屋面坡向的条纹 + 横向瓦行
        uv = N.new('ShaderNodeUVMap')
        uv.uv_map = 'TileUV'
        sep = N.new('ShaderNodeSeparateXYZ')
        nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
        s = _math(nt, 'SINE', _math(nt, 'MULTIPLY', sep.outputs['X'], 2 * math.pi / 0.13))
        s = _math(nt, 'POWER', _math(nt, 'MULTIPLY_ADD', s, 0.5, 0.5), 0.6)
        r = _math(nt, 'SINE', _math(nt, 'MULTIPLY', sep.outputs['Y'], 2 * math.pi / 0.11))
        r = _math(nt, 'MULTIPLY_ADD', r, 0.06, 0.94)
        f = _math(nt, 'MULTIPLY', s, r)
        groove = tuple(x * 0.55 for x in col[:3]) + (1,)
        ridge = tuple(min(1, x * 1.3) for x in col[:3]) + (1,)
        c = _mix(nt, _mix(nt, groove, ridge, f), c, 0.25)
    if kind in ('stone', 'paving', 'lattice'):
        br = N.new('ShaderNodeTexBrick')
        mp = N.new('ShaderNodeMapping')
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        if kind == 'stone':  # 立面石块：用 (x+y, z) 近似展开
            sep = N.new('ShaderNodeSeparateXYZ')
            nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
            comb = N.new('ShaderNodeCombineXYZ')
            nt.links.new(_math(nt, 'ADD', sep.outputs['X'], sep.outputs['Y']), comb.inputs['X'])
            nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
            nt.links.new(comb.outputs['Vector'], br.inputs['Vector'])
            br.inputs['Scale'].default_value = 1.0
            br.inputs['Brick Width'].default_value = 0.42
            br.inputs['Row Height'].default_value = 0.14
        elif kind == 'paving':
            nt.links.new(mp.outputs['Vector'], br.inputs['Vector'])
            br.inputs['Scale'].default_value = 1.0
            br.inputs['Brick Width'].default_value = 0.34
            br.inputs['Row Height'].default_value = 0.22
        else:  # 格扇门窗
            nt.links.new(mp.outputs['Vector'], br.inputs['Vector'])
            br.squash = 1.0
            br.inputs['Scale'].default_value = 1.0
            br.inputs['Brick Width'].default_value = 0.07
            br.inputs['Row Height'].default_value = 0.07
            br.offset = 0.0
        br.inputs['Mortar Size'].default_value = 0.012 if kind != 'lattice' else 0.014
        br.inputs['Color1'].default_value = col
        br.inputs['Color2'].default_value = tuple(x * 0.9 for x in col[:3]) + (1,)
        mortar = tuple(x * (0.62 if kind != 'lattice' else 1.9) for x in col[:3]) + (1,)
        br.inputs['Mortar'].default_value = tuple(min(1, x) for x in mortar)
        c = _mix(nt, br.outputs['Color'], c, 0.35)
    if kind == 'wall':  # 墙脚脏旧渐变
        sep = N.new('ShaderNodeSeparateXYZ')
        nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
        mr = N.new('ShaderNodeMapRange')
        nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
        mr.inputs['From Min'].default_value = WALL_Z0[0]
        mr.inputs['From Max'].default_value = WALL_Z0[0] + 0.45
        mr.inputs['To Min'].default_value = 0.0
        mr.inputs['To Max'].default_value = 1.0
        c = _mix(nt, dark, c, mr.outputs['Result'])
    # 边缘提亮：手绘描边的感觉
    bev = N.new('ShaderNodeBevel')
    bev.inputs['Radius'].default_value = 0.025
    dot = N.new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    nt.links.new(bev.outputs['Normal'], dot.inputs[0])
    nt.links.new(geo.outputs['Normal'], dot.inputs[1])
    edge = _math(nt, 'MULTIPLY', _math(nt, 'SUBTRACT', 1.0, dot.outputs['Value']), 6.0, clamp=True)
    c = _mix(nt, c, light, _math(nt, 'MULTIPLY', edge, 0.55))
    nt.links.new(c, bsdf.inputs['Base Color'])
    MATS[name] = m
    return m


WALL_Z0 = [0.0]  # 墙脚渐变的地面高度（各模型自己设）

# ---------------------------------------------------------------- 基本体
PARTS = []  # 所有待合并、待烘焙的对象
GLOW = []   # 发光件


def _finish(bm, name, mats, bevel=0.0, seg=1, glow=False, smooth=False):
    if not bm.loops.layers.uv.get('TileUV'):
        bm.loops.layers.uv.new('TileUV')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(MAT(m))
    if smooth:
        me.shade_smooth()
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(35)
    (GLOW if glow else PARTS).append(ob)
    return ob


def _xf(bm, loc=(0, 0, 0), rz=0.0, rx=0.0, ry=0.0, scale=None):
    M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
    if scale:
        M = M @ Matrix.Diagonal(Vector(scale + (1,)))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)


def box(w, d, h, x, y, z, mat, rz=0.0, bevel=0.02, glow=False):
    """底面中心在 (x,y,z)。"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    _xf(bm, (x, y, z), rz, scale=(w, d, h))
    if min(w, d, h) < 0.13:  # 小件不倒角，省面
        bevel = 0.0
    return _finish(bm, 'box', [mat], min(bevel, min(w, d, h) * 0.3), glow=glow)


def cyl(r1, r2, h, seg, x, y, z, mat, rz=0.0, bevel=0.0, glow=False, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    _xf(bm, (x, y, z), rz)
    return _finish(bm, 'cyl', [mat], bevel, glow=glow, smooth=smooth)


def ball(r, x, y, z, mat, sub=1, glow=False, sz=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    _xf(bm, (x, y, z), scale=(1, 1, sz))
    return _finish(bm, 'ball', [mat], glow=glow, smooth=True)


def ngon(n, r, rot=None):
    """正 n 边形顶点（逆时针）。默认让一条边正对 -Y。"""
    if rot is None:
        rot = -math.pi / 2 + math.pi / n
    return [(r * math.cos(rot + 2 * math.pi * k / n), r * math.sin(rot + 2 * math.pi * k / n)) for k in range(n)]


def prism(poly_bot, poly_top, z0, z1, mat, bevel=0.02):
    bm = bmesh.new()
    vb = [bm.verts.new((x, y, z0)) for x, y in poly_bot]
    vt = [bm.verts.new((x, y, z1)) for x, y in poly_top]
    n = len(vb)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    bm.faces.new(list(reversed(vb)))
    bm.faces.new(vt)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(bm, 'prism', [mat], bevel)


def sweep(pts, w, h, mat, bevel=0.0):
    """沿折线扫一个 w×h 的方截面（脊、扶手）。"""
    bm = bmesh.new()
    pts = [Vector(p) for p in pts]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(t).normalized()
        rings.append([bm.verts.new(p + side * sx * w / 2 + up * sy * h / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(bm, 'sweep', [mat], bevel)


# ---------------------------------------------------------------- 中式屋顶
def roof(eave, top, z0, H, *, lift=0.25, flare=0.12, corner=0.4, curve=0.45, S=8, T=6, thick=0.07,
         mats=('roof', 'roof_rim', 'soffit'), ridges=True, ridge_mat='ridge', ridge_w=0.07, tip=0.16,
         gold_tips=False):
    """eave：檐口多边形（逆时针 xy）；top：每个檐角对应的顶部点（同序）。
    相邻两角的 top 相同则该面为三角形（庑殿山面 / 攒尖）。
    返回 dict(hips=[每条垂脊的点列], top_z)。"""
    n = len(eave)
    E = [Vector((x, y)) for x, y in eave]
    Tp = [Vector((x, y)) for x, y in top]
    cen = sum(E, Vector((0, 0))) / n

    def pt(i, s, t):
        j = (i + 1) % n
        a = E[i].lerp(E[j], s)
        b = Tp[i].lerp(Tp[j], s)
        p = a.lerp(b, t)
        Le = (E[j] - E[i]).length
        d = min(s, 1 - s) * Le
        k = E[i] if s < 0.5 else E[j]
        w = max(0.0, 1 - d / (corner * Le))
        w = w * w * (3 - 2 * w)
        fall = (1 - t) ** 2
        out = (k - cen).normalized() * flare * w * fall
        z = z0 + H * ((1 - curve) * t + curve * t * t) + lift * w * w * (1 - t) ** 2.2
        return Vector((p.x + out.x, p.y + out.y, z))

    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('TileUV')
    for i in range(n):
        j = (i + 1) % n
        Le = (E[j] - E[i]).length
        slope = ((E[i] + E[j]) / 2 - (Tp[i] + Tp[j]) / 2).length
        grid = [[bm.verts.new(pt(i, s / S, t / T)) for s in range(S + 1)] for t in range(T + 1)]
        for t in range(T):
            for s in range(S):
                vs = (grid[t][s], grid[t][s + 1], grid[t + 1][s + 1], grid[t + 1][s])
                if len(set(vs)) < 3:
                    continue
                f = bm.faces.new(vs)
                for lp, (ss, tt) in zip(f.loops, ((s, t), (s + 1, t), (s + 1, t + 1), (s, t + 1))):
                    lp[uvl].uv = (ss / S * Le, tt / T * slope)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-4, edges=bm.edges)
    bm.normal_update()
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    ob = _finish(bm, 'roof', list(mats), smooth=True)
    ob.data.set_sharp_from_angle(angle=math.radians(40))
    sol = ob.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = -1
    sol.use_even_offset = False
    sol.use_quality_normals = True
    sol.use_rim = True
    sol.material_offset = 2
    sol.material_offset_rim = 1
    hips = []
    for i in range(n):
        line = [pt(i, 0.0, t / T) + Vector((0, 0, thick * 0.35)) for t in range(T + 1)]
        hips.append(line)
        if ridges:
            # 翘角：檐角再向外上方挑出一截
            d = (line[0] - line[1]).normalized()
            d = (Vector((d.x, d.y, 0)).normalized() + Vector((0, 0, 1.25))).normalized()
            tipp = line[0] + d * tip
            sweep([tipp] + line, ridge_w, ridge_w * 1.3, ridge_mat)
            if gold_tips:
                ball(ridge_w * 0.7, tipp.x, tipp.y, tipp.z, 'gold', sub=0)
    return {'hips': hips, 'top_z': z0 + H}


def hip_roof(cx, cy, z0, w, d, H, ridge_frac=1.0, ridge_gold=True, **kw):
    """矩形庑殿顶（屋脊沿 x）。w,d 为檐口尺寸。"""
    rh = max(0.0, (w - d) / 2) * ridge_frac
    eave = [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]
    top = [(cx - rh, cy), (cx + rh, cy), (cx + rh, cy), (cx - rh, cy)]
    r = roof(eave, top, z0, H, **kw)
    zt = z0 + H + kw.get('thick', 0.07) * 0.35
    rw = kw.get('ridge_w', 0.07)
    if rh > 0.01:
        box(2 * rh + rw * 2, rw * 1.6, rw * 2.2, cx, cy, zt - rw * 0.6, kw.get('ridge_mat', 'ridge'), bevel=0.01)
    if ridge_gold:  # 正吻 + 宝珠
        for sx in (-1, 1):
            box(rw * 1.6, rw * 1.6, rw * 3.6, cx + sx * (rh + rw * 0.4), cy, zt - rw * 0.4, 'gold', bevel=0.01)
        if rh > 0.2:
            ball(rw * 1.3, cx, cy, zt + rw * 1.9, 'gold', sub=1)
    return r


def gable_roof(cx, cy, z0, w, d, H, along='x', overhang=0.08, **kw):
    """两坡顶（悬山）。along：屋脊方向。"""
    if along == 'x':
        eave = [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]
        top = [(cx - w / 2, cy), (cx + w / 2, cy), (cx + w / 2, cy), (cx - w / 2, cy)]
    else:
        eave = [(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)]
        top = [(cx, cy - d / 2), (cx, cy - d / 2), (cx, cy + d / 2), (cx, cy + d / 2)]
    kw.setdefault('ridges', False)
    r = roof(eave, top, z0, H, **kw)
    rw = kw.get('ridge_w', 0.06)
    zt = z0 + H + kw.get('thick', 0.07) * 0.35
    if along == 'x':
        box(w + 0.04, rw * 1.6, rw * 1.8, cx, cy, zt - rw * 0.5, kw.get('ridge_mat', 'ridge'), bevel=0.01)
    else:
        box(rw * 1.6, d + 0.04, rw * 1.8, cx, cy, zt - rw * 0.5, kw.get('ridge_mat', 'ridge'), bevel=0.01)
    return r


# ---------------------------------------------------------------- 合并、烘焙、导出
def _join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.convert(target='MESH')  # 应用修改器
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def setup_cycles(samples=64):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # noqa
        print('Metal 不可用，用 CPU', e)
    sc.cycles.samples = samples
    if sc.world is None:
        sc.world = bpy.data.worlds.new('W')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)


def bake_and_export(name, out_dir, size=1024, ao_dist=0.9, ao_strength=0.85, extra_export=(), smart_angle=60):
    """把 PARTS 合并成一个网格，智能展 UV，烘焙 底色×AO 到一张贴图，导出 GLB。
    extra_export：不参与合并和烘焙、但在场景里参与 AO 遮挡并一起导出的对象（B 版的 AI 网格）。"""
    ob = _join(PARTS, name)
    me = ob.data
    me.set_sharp_from_angle(angle=math.radians(38))
    # 烘焙 UV
    bake_uv = me.uv_layers.new(name='BakeUV')
    me.uv_layers.active = bake_uv
    bake_uv.active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(smart_angle), island_margin=0.004, area_weight=0.6, scale_to_bounds=True)
    bpy.ops.uv.pack_islands(margin=0.003, rotate=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    setup_cycles(64)
    sc = bpy.context.scene
    sc.world.light_settings.distance = ao_dist
    sc.render.bake.margin = 6
    imgs = {}
    for kind in ('DIFFUSE', 'AO'):
        img = bpy.data.images.new(f'{name}_{kind}', size, size, alpha=False, float_buffer=True)
        for m in me.materials:
            nt = m.node_tree
            tn = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
            tn.name = 'BAKE'
            tn.image = img
            nt.nodes.active = tn
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        if kind == 'DIFFUSE':
            bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=6, use_clear=True)
        else:
            bpy.ops.object.bake(type='AO', margin=6, use_clear=True)
        buf = np.empty(size * size * 4, np.float32)
        img.pixels.foreach_get(buf)
        imgs[kind] = buf.reshape(size, size, 4)
    alb, ao = imgs['DIFFUSE'], imgs['AO']
    a = ao[..., :1]
    a = 1 - ao_strength * (1 - np.power(np.clip(a, 0, 1), 0.8))
    rgb = alb[..., :3] * a
    # 线性 → sRGB 存 8 位
    rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.clip(rgb, 0, None), 1 / 2.4) - 0.055)
    out = bpy.data.images.new(f'{name}_tex', size, size, alpha=False)
    px = np.concatenate([np.clip(rgb, 0, 1), np.ones((size, size, 1), np.float32)], -1)
    out.pixels.foreach_set(px.ravel())
    out.file_format = 'PNG'
    out.filepath_raw = os.path.join(out_dir, f'{name}_tex.png')
    out.save()
    # 换成导出材质：一张贴图，粗糙度 0.9，金属度 0
    em = bpy.data.materials.new(f'{name}_mat')
    em.use_nodes = True
    nt = em.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    bsdf.inputs['Metallic'].default_value = 0.0
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = out
    nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.clear()
    me.materials.append(em)
    for p in me.polygons:
        p.material_index = 0
    me.uv_layers.remove(me.uv_layers['TileUV'])
    print(f'[{name}] tris={tri_count(ob)}')
    exp = [ob] + list(extra_export)
    if GLOW:
        g = _join(GLOW, name + '_glow')
        exp.append(g)
        print(f'[{name}] glow tris={tri_count(g)}')
    bpy.ops.object.select_all(action='DESELECT')
    for o in exp:
        o.select_set(True)
    path = os.path.join(out_dir, f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
                              export_materials='EXPORT', export_image_format='AUTO', export_animations=False,
                              export_vertex_color='ACTIVE' if extra_export else 'MATERIAL')
    return ob, path


def render_preview(path, objs=None, res=900, elev=38, azim=0, dist=None, target=None):
    """快速用 EEVEE 渲一张预览（地图镜头方向：从南面斜上方看）。"""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.8, 0.9, 1)
    sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.45
    sc.view_settings.view_transform = 'AgX'
    objs = objs or [o for o in sc.objects if o.type == 'MESH']
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    cen = target or (lo + hi) / 2
    rad = (hi - lo).length / 2
    cam = bpy.data.objects.get('PrevCam')
    if not cam:
        cam = bpy.data.objects.new('PrevCam', bpy.data.cameras.new('PrevCam'))
        sc.collection.objects.link(cam)
        sun = bpy.data.objects.new('PrevSun', bpy.data.lights.new('PrevSun', 'SUN'))
        sun.data.energy = 4.5
        sun.rotation_euler = (math.radians(45), 0, math.radians(-35))
        sc.collection.objects.link(sun)
    cam.data.lens = 50
    e, a = math.radians(elev), math.radians(azim)
    dist = dist or rad * 3.2
    cam.location = cen + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    cam.rotation_euler = (cen - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
