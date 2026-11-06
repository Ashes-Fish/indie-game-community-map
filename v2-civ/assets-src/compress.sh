#!/bin/sh
# 压缩：meshopt 几何压缩 + 贴图转 WebP（最大 1024）。不做自动减面（减面在 Blender / b_project.py 里做过了）。
# 用法：sh compress.sh 输入.glb 输出.glb
set -e
npx -y @gltf-transform/cli@4 optimize "$1" "$2" --compress meshopt --texture-compress webp --texture-size 1024 \
  --simplify false --instance false --palette false --flatten false
