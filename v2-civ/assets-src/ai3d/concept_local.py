# HF 免费额度用完时的本地兜底：SDXL-Turbo（MPS）生成白底概念图。
# 环境同 shape_local.py 的虚拟环境（diffusers<0.36）。权重约 7GB，首次运行下到 ~/.cache/huggingface。
# 用法：/tmp/igcm-work/hy3d/.venv/bin/python -I concept_local.py OUTDIR guild [张数]
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
import torch
from diffusers import AutoPipelineForText2Image

# CLIP 只读前 77 个 token：关键约束放最前面
PROMPTS = {
    "guild": "single isolated Chinese opera stage pavilion and guild hall, game asset on plain white background, "
             "Civilization VI style, isometric, red pillars, blue-grey tiled roofs with upturned eaves, gold trim, "
             "stone terrace, stylized hand-painted, chunky",
    "pagoda": "single isolated Chinese octagonal pagoda, game asset on plain white background, Civilization VI style, "
              "isometric, red-brown walls, dark tiled upturned eaves, golden spire, stone plinth, stylized hand-painted",
}
NEG = "scene, landscape, city, many buildings, ground, grass, trees, people, photo, text, watermark, cropped"

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
kind = sys.argv[2]; n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
pipe = AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.float16, variant="fp16").to("mps")
for i in range(n):
    g = torch.Generator("cpu").manual_seed(500 + i * 31)
    img = pipe(PROMPTS[kind], negative_prompt=NEG, num_inference_steps=4, guidance_scale=0.0,
               width=768, height=768, generator=g).images[0]
    p = out / f"{kind}_sd{i}.webp"; img.save(p, quality=92); print(p, flush=True)
