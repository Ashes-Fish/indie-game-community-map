# ai3d

- `concept.py`：HF 上的 FLUX.1-schnell 生成白底概念图（免登录；匿名 ZeroGPU 每天 2 分钟，约 3 张就用完）。
- `concept_local.py`：本机 SDXL-Turbo 生成概念图（权重约 7GB）。
- `shape_local.py`：本机（Apple Silicon，MPS）用 Hunyuan3D-2 turbo + FlashVDM 把概念图转成未减面的白模 GLB，不贴图。
- `b_project.py`：减面 + 把概念图投影成贴图。

装环境：照 `shape_local.py` 开头注释，在 `/tmp/igcm-work/hy3d/` 克隆仓库、`uv venv`、装依赖（约 1.4GB；transformers 要 <5、diffusers 要 <0.36）。权重首次运行自动下到 `~/.cache/hy3dgen/`（约 5GB），抠图模型 u2net 在 `~/.rembg/models/`。

```sh
PY=/tmp/igcm-work/hy3d/.venv/bin/python
$PY -I shape_local.py 概念图.webp raw.glb --seed 12345      # 约 35 秒，峰值内存约 8.6GB
$PY -I b_project.py raw.glb 概念图.webp proj.glb 12000
```
