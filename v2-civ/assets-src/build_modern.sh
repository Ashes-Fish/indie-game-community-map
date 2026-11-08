#!/bin/sh
# 烘焙并压缩全部现代建筑，产物放进 ../public/models/m_*.glb。
# 用法：BLENDER=/path/to/blender sh build_modern.sh [模型名 ...]   （不给模型名就全部重做）
# 预览图在 $OUT（默认系统临时目录下的 igcm-modern/）里，名为 m_<名>_preview.png。
set -e
cd "$(dirname "$0")"
B="${BLENDER:-blender}"
OUT="${OUT:-${TMPDIR:-${TEMP:-/tmp}}/igcm-modern}"
ALL="guild tulou cyber observatory paifang savepoint pinewood cbd_town cbd_city_a cbd_city_b cbd_big_a cbd_big_b cbd_metro"
mkdir -p "$OUT" ../public/models
for n in ${@:-$ALL}; do
  case "$n" in cbd_*) size=2048 ;; *) size=1024 ;; esac
  "$B" -b --factory-startup -P blender/build.py -- "m_$n" "$OUT" "$size" | grep -E "^\[|^OK|Error|Traceback" || true
  # 城市中心面积大，贴图保留 2048 才看得清幕墙格子
  npx -y @gltf-transform/cli@4 optimize "$OUT/m_$n.glb" "../public/models/m_$n.glb" --compress meshopt \
    --texture-compress webp --texture-size "$size" --simplify false --instance false --palette false --flatten false >/dev/null
  ls -l "../public/models/m_$n.glb" | awk '{print $5, $NF}'
done
