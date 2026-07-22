# -*- coding: utf-8 -*-
"""
prepare_background.py — turn clips/poster_background.png into the print-ready
backdrop the poster actually loads.

    python prepare_background.py

Why this exists rather than doing it in CSS:

  1. RATIO. The source is 1024x1536 (h/w = 1.500). A1 portrait is 594x841
     (h/w = 1.4158). Letting object-fit: cover crop it works on screen but
     throws away control over WHICH 5.6% of the image is lost. We crop it
     here, symmetrically, taking a sliver of sky off the top and a sliver of
     shadow off the bottom - both edges, never the tower band in the middle.

  2. FILE SIZE. Applying `filter: blur()` in CSS forces Chrome's print
     pipeline to rasterise the image at full canvas resolution. The first
     export came out at 77 MB, essentially all of it one 75 MB bitmap. Baking
     the blur in here and dropping the CSS filter gets the same picture for a
     fraction of the bytes.

  3. RESAMPLING QUALITY. poster.md C7.4.1 warns that letting the browser
     stretch 1024px across an A1 canvas gives blocky interpolation, which
     reads differently from a soft blur - and the two stacked look wrong.
     Lanczos upscaling before the blur avoids that.

Output resolution is deliberately not 300 dpi. The image ends up behind a 62%
scrim and a heavy blur, so detail beyond ~130 dpi is invisible; 3000px wide
keeps the file small while leaving headroom if the scrim is ever lightened.
"""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).parent
SRC = HERE.parent / "clips" / "poster_background.png"
DST = HERE / "assets" / "poster_background.jpg"

A1_RATIO = 841 / 594  # height / width = 1.4158
OUT_W = 3000
BLUR_PX = 8  # ~1.6mm at the output scale
SATURATION = 1.25
CONTRAST = 1.05


def main():
    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    print(f"source      {w}x{h}  (h/w = {h / w:.4f})")

    # ---- 1. crop to the A1 aspect ratio, symmetrically ---------------------
    target_h = round(w * A1_RATIO)
    if target_h < h:
        cut = h - target_h
        top = cut // 2
        img = img.crop((0, top, w, top + target_h))
        print(f"cropped     {img.size[0]}x{img.size[1]}  (-{cut}px height, "
              f"{cut / h:.1%}, split top/bottom)")
    elif target_h > h:
        target_w = round(h / A1_RATIO)
        cut = w - target_w
        left = cut // 2
        img = img.crop((left, 0, left + target_w, h))
        print(f"cropped     {img.size[0]}x{img.size[1]}  (-{cut}px width)")

    # ---- 2. upscale before blurring, so the blur radius is in final pixels -
    out_h = round(OUT_W * A1_RATIO)
    img = img.resize((OUT_W, out_h), Image.LANCZOS)
    print(f"upscaled    {OUT_W}x{out_h}  ({OUT_W * 25.4 / 594:.0f} dpi at A1)")

    # ---- 3. grade, then blur ----------------------------------------------
    img = ImageEnhance.Color(img).enhance(SATURATION)
    img = ImageEnhance.Contrast(img).enhance(CONTRAST)
    img = img.filter(ImageFilter.GaussianBlur(BLUR_PX))

    DST.parent.mkdir(parents=True, exist_ok=True)
    img.save(DST, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"wrote       {DST.relative_to(HERE)}  "
          f"({DST.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
