# 用 HF 上的 FLUX.1-schnell（免登录 ZeroGPU）生成概念图。
# 用法：uv run --python 3.12 --with gradio_client --with socksio python concept.py OUTDIR [pagoda|guild] [张数]
import shutil
import sys
from pathlib import Path

from gradio_client import Client

STYLE = ("Civilization VI style 3D game asset, stylized hand-painted, chunky exaggerated proportions, "
         "matte clay look, isometric three-quarter view from above, plain white background, single object, "
         "centered, entire object visible, soft studio light")
PROMPTS = {
    "pagoda": "Leifeng Pagoda, Chinese octagonal five-storey brick pagoda, warm red-brown walls, dark grey tiled "
              "eaves with strongly upturned corners on every storey, golden spire finial, on a square stone plinth, " + STYLE,
    "guild": "Chinese guild hall compound with a small opera stage in front, red lacquered pillars, dark blue-grey "
             "curved tiled hip roofs with strongly upturned eave corners, white plaster walls, golden ridge ornaments, "
             "on a raised grey stone terrace, compact courtyard, " + STYLE,
}

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
kinds = [sys.argv[2]] if len(sys.argv) > 2 else list(PROMPTS)
n = int(sys.argv[3]) if len(sys.argv) > 3 else 4
c = Client("black-forest-labs/FLUX.1-schnell")
for kind in kinds:
    for i in range(n):
        img, seed = c.predict(PROMPTS[kind], 1000 + i * 77, False, 1024, 1024, 4, api_name="/infer")
        p = img if isinstance(img, str) else img["path"]
        dst = out / f"{kind}_{i}.webp"
        shutil.copy(p, dst)
        print(dst, seed, flush=True)
