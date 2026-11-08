# assets-src：建筑资产源脚本

产物在 `public/models/`，由 `src/assets.js` 加载；截图在 `lab-shots/`，规范见 `../ART-SPEC.md`。

## 现代建筑（地图正式使用，`blender/modern.py`）

城市中心是 CBD 天际线，按档位分 6 个变体（`m_cbd_town`、`m_cbd_city_a/b`、`m_cbd_big_a/b`、`m_cbd_metro`）；社群据点 7 种（`m_guild` 孵化器 · 路演厅、`m_tulou` 环形社区客厅、`m_cyber` 霓虹电竞塔 · 咖啡馆、`m_observatory` 穹顶科技馆、`m_paifang` 潮玩街区、`m_savepoint` 存档站、`m_pinewood` 松林艺术工坊）。文件名沿用旧造型 key，社群数据不用改。地标（东方明珠、天宁塔、方塔、中华门、雷峰塔）不变。

一键全部重做（Blender 4.5 或 5.x 均可；有 GPU 用 GPU，没有用 CPU）：

```sh
BLENDER=/path/to/blender sh build_modern.sh            # 全部 13 个
BLENDER=/path/to/blender sh build_modern.sh cyber cbd_big_a   # 只做其中几个
```

预览图在系统临时目录的 `igcm-modern/` 里。城市中心贴图 2048（看得清幕墙格子），据点 1024。

机器上没有 Python 时，`scripts/` 下的地形烘焙脚本也可以用 Blender 自带的 Python 跑（它带 numpy），另装 Pillow 和 SciPy 到单独目录，不动 Blender 本身：

```sh
P=/path/to/blender/4.5/python/bin/python.exe
$P -m pip install --target /path/to/pydeps pillow scipy
PYTHONPATH=/path/to/pydeps $P scripts/bake_region.py xian
```

## A：Blender 脚本建模（`blender/`，P1 古建对比测试）

`?asset=a|b` 切换雷峰塔。Blender 5.2（`~/Applications/Blender.app`），无界面运行：

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
