# 用法：~/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build.py -- 模型名 输出目录 [贴图边长]
# 模型名：leifeng | guild | base。输出 <名>.glb、<名>_tex.png、<名>_preview.png（未压缩；压缩见 ../compress.sh）。
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402

import lib  # noqa: E402
import models  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:]
name, out = argv[0], os.path.abspath(argv[1])
size = int(argv[2]) if len(argv) > 2 else 1024
os.makedirs(out, exist_ok=True)
lib.clear_scene()
lib.PARTS.clear()
lib.GLOW.clear()
models.MODELS[name]()
ob, path = lib.bake_and_export(name, out, size=size, ao_dist=0.8 if name != 'leifeng' else 0.7, ao_strength=0.9)
lib.render_preview(os.path.join(out, f'{name}_preview.png'))
print('OK', path, 'tris', lib.tri_count(ob))
