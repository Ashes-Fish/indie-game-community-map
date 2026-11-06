# assets-src：建筑资产源脚本（P1 对比测试）

地图里 `?asset=old|a|b` 切换雷峰塔和 Ludere 会馆（`src/assets.js`）。产物在 `public/models/`，截图在 `lab-shots/`，规范见 `../ART-SPEC.md`。

## A：Blender 脚本建模（`blender/`）

Blender 5.2（`~/Applications/Blender.app`），无界面运行：

```sh
B=~/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup -P blender/build.py -- leifeng /tmp/out 768
$B -b --factory-startup -P blender/build.py -- guild   /tmp/out 1024
sh compress.sh /tmp/out/leifeng.glb ../public/models/a_leifeng.glb
sh compress.sh /tmp/out/guild.glb   ../public/models/a_guild.glb
```

- `lib.py`：程序化材质、基本体、中式屋顶生成器（任意凸多边形檐口，曲面坡、翘角、出翘、垂脊）、合并 → 智能展 UV → Cycles 烘焙「底色 × AO」到一张贴图 → 导出 GLB。
- `models.py`：雷峰塔、会馆 + 戏台、六边形底座、地块杂物（A、B 共用）。

## B：AI 图生 3D（`ai3d/` + `blender/b_assemble.py`）

1. 概念图：`ai3d/concept.py`（HF 上的 FLUX.1-schnell，免登录，但匿名每天只有 2 分钟 GPU）；额度用完时用 `ai3d/concept_local.py`（本机 SDXL-Turbo）。P1 用到的两张在 `ai3d/concepts/`：塔是 FLUX 的 `pagoda_0`，会馆是 SDXL-Turbo 的 `guild_sd5`。
2. 几何：`ai3d/shape_local.py`，本机 MPS 跑 Hunyuan3D-2 turbo，只出白模（贴图模型要 CUDA）。环境见 `ai3d/README.md`。
3. 减面 + 上色：`ai3d/b_project.py raw.glb concept.webp out.glb 12000`，减到 1.2 万面，搜出概念图的视角，把概念图投影成贴图，并把这个视角转到地图镜头方向（南）。
4. 组装：`$B -b --factory-startup -P blender/b_assemble.py -- guild|pagoda out.glb /tmp/out`，统一调色（降饱和、压对比、向色板靠 35%）、顶点 AO、加系统底座和杂物。再 `compress.sh`。

## 其他

- `compress.sh`：meshopt + WebP。
- `contact_sheet.py`：截图转 JPEG、拼三版对比图。
