# 本地用 Hunyuan3D-2 做「图生几何」，只出白模（不贴图），Apple Silicon 走 MPS。
#
# 装环境（一次性，代码和虚拟环境放 /tmp，可随时删）：
#   mkdir -p /tmp/igcm-work/hy3d && cd /tmp/igcm-work/hy3d
#   git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2
#   uv venv --python 3.12 .venv
#   uv pip install --python .venv/bin/python torch torchvision "diffusers<0.36" "transformers>=4.48,<5" einops \
#       omegaconf trimesh pymeshlab numpy opencv-python-headless tqdm rembg onnxruntime scikit-image safetensors \
#       accelerate pyyaml pillow pygltflib huggingface_hub socksio
#   （transformers 5 改了 DINOv2 的参数名，权重对不上；diffusers 0.36+ 要 huggingface_hub 1.x，和 transformers 4 冲突）
#   uv pip install --python .venv/bin/python --no-deps -e Hunyuan3D-2   # 只要 hy3dgen 包，不装 gradio 等演示依赖
#
# 用法（-I：别让当前目录里的同名 .py 盖掉标准库，/tmp 下就有个 inspect.py）：
#   /tmp/igcm-work/hy3d/.venv/bin/python -I shape_local.py 输入图.png 输出.glb [--seed N] [--model 2|mini]
# 权重首次运行自动下到 ~/.cache/hy3dgen/（2: ~5.3GB，mini: ~4.2GB），只下 safetensors，不下同名 ckpt。
# 输出未减面的白模 GLB，只做了去浮块和去退化面。
import argparse
import os
import time

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")  # 走本机代理时 Xet 下载会卡死，改走普通 HTTP

import torch
from huggingface_hub import hf_hub_download
from PIL import Image

MODELS = {  # --model -> (仓库, DiT 子目录, FlashVDM turbo VAE 子目录, FlashVDM topk_mode)
    "2": ("tencent/Hunyuan3D-2", "hunyuan3d-dit-v2-0-turbo", "hunyuan3d-vae-v2-0-turbo", "mean"),
    "mini": ("tencent/Hunyuan3D-2mini", "hunyuan3d-dit-v2-mini-turbo", "hunyuan3d-vae-v2-mini-turbo", "merge"),
}


def fetch(repo, sub):
    # hy3dgen 先找 ~/.cache/hy3dgen/<repo>/<sub>，找不到才整目录下载（会连 .ckpt 一起下，翻倍）
    base = os.path.join(os.environ.get("HY3DGEN_MODELS", os.path.expanduser("~/.cache/hy3dgen")), repo)
    for fn in ("config.yaml", "model.fp16.safetensors"):
        hf_hub_download(repo, f"{sub}/{fn}", local_dir=base)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--seed", type=int, default=12345)
    ap.add_argument("--model", choices=MODELS, default="2")
    ap.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu")
    ap.add_argument("--octree", type=int, default=256)
    ap.add_argument("--steps", type=int, default=5)
    a = ap.parse_args()

    repo, dit, vae, topk = MODELS[a.model]
    fetch(repo, dit)
    fetch(repo, vae)

    from rembg import new_session, remove
    from hy3dgen.shapegen import DegenerateFaceRemover, FloaterRemover, Hunyuan3DDiTFlowMatchingPipeline

    t0 = time.time()
    img = Image.open(a.input)
    if img.mode != "RGBA" or img.getchannel("A").getextrema()[0] == 255:  # 没有透明背景才抠图
        # 同 hy3dgen.rembg.BackgroundRemover，但指定 u2net：新版 rembg 默认换成 1GB 的 bria-rmbg，CPU 上极慢
        img = remove(img.convert("RGB"), session=new_session("u2net"), bgcolor=[255, 255, 255, 0])
    torch.set_default_dtype(torch.float16)  # 直接按 fp16 建模型再灌权重，加载峰值内存减半（默认先建 fp32）
    pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        repo, subfolder=dit, use_safetensors=True, device=a.device, dtype=torch.float16)
    pipe.enable_flashvdm(topk_mode=topk, mc_algo="mc")  # dmc 依赖 CUDA，Mac 用 mc
    torch.set_default_dtype(torch.float32)
    t1 = time.time()

    mesh = pipe(image=img, num_inference_steps=a.steps, octree_resolution=a.octree, num_chunks=20000,
                generator=torch.manual_seed(a.seed), output_type="trimesh")[0]
    t2 = time.time()
    mesh = DegenerateFaceRemover()(FloaterRemover()(mesh))
    os.makedirs(os.path.dirname(os.path.abspath(a.output)), exist_ok=True)
    mesh.export(a.output)
    t3 = time.time()
    print(f"[shape_local] {a.input} -> {a.output} model={a.model} device={a.device} seed={a.seed} "
          f"load={t1 - t0:.1f}s gen={t2 - t1:.1f}s post={t3 - t2:.1f}s total={t3 - t0:.1f}s "
          f"verts={len(mesh.vertices)} faces={len(mesh.faces)}")


if __name__ == "__main__":
    main()
