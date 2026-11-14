#!/bin/sh
# 烘焙并压缩全部现代建筑，产物放进 ../public/models/m_*.glb。
# 用法：BLENDER=/path/to/blender sh build_modern.sh [模型名 ...]   （不给模型名就全部重做）
#       SKIP_BAKE=1 sh build_modern.sh [模型名 ...]               （不重新烘焙，只把 $OUT 里已有的烘焙原件重新压缩）
# 预览图在 $OUT（默认系统临时目录下的 igcm-modern/）里，名为 m_<名>_preview.png。
# 贴图压成 KTX2（Basis ETC1S，最高质量档）：显卡里一直是压缩格式，显存约为 WebP 解码后的 1/4，上传也不卡帧。
# 需要 KTX-Software 4.x 的 toktx 在 PATH 上（Windows：scoop install ktx-software；macOS：brew install ktx）。
set -e
command -v toktx >/dev/null || { echo "缺少 toktx（KTX-Software 4.x），见脚本开头的说明" >&2; exit 1; }
cd "$(dirname "$0")"
B="${BLENDER:-blender}"
OUT="${OUT:-${TMPDIR:-${TEMP:-/tmp}}/igcm-modern}"
ALL="guild tulou cyber observatory paifang savepoint pinewood cbd_town cbd_city_a cbd_city_b cbd_big_a cbd_big_b cbd_metro"
G="npx -y @gltf-transform/cli@4"
mkdir -p "$OUT" ../public/models
for n in ${@:-$ALL}; do
  # 城市中心面积大，贴图保留 2048 才看得清幕墙格子
  case "$n" in cbd_*) size=2048 ;; *) size=1024 ;; esac
  [ -n "$SKIP_BAKE" ] || "$B" -b --factory-startup -P blender/build.py -- "m_$n" "$OUT" "$size" | grep -E "^\[|^OK|Error|Traceback" || true
  T="../public/models/m_$n.glb"
  # 几何 meshopt 压缩、贴图先不动 → 贴图转 ETC1S → 再 meshopt 一次（etc1s 这一步会把几何压缩解开）
  $G optimize "$OUT/m_$n.glb" "$T" --compress meshopt --texture-compress false --texture-size "$size" \
    --simplify false --instance false --palette false --flatten false >/dev/null
  $G etc1s "$T" "$T" --quality 255 --compression 5 >/dev/null
  $G meshopt "$T" "$T" >/dev/null
  ls -l "$T" | awk '{print $5, $NF}'
done
