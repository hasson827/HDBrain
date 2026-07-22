"""
prepare_assets.py — bake the three raster fixes the layout depends on.

Run once after any of the source images change:

    python prepare_assets.py

Nothing here is decorative. Each step exists because the raw asset cannot be
dropped onto the poster as-is:

  1. assets/mrt-train.png
     clips/MRT.png is a four-car SMRT set on a solid black field with no alpha.
     Dropped onto the poster as-is it would print as a black rectangle over
     the background photograph, so the set is cut out against a real alpha
     channel. The background is exactly (0,0,0) while the train's own dark
     parts are not, so the silhouette comes from a >18 luminance threshold
     plus a hole fill: the fill closes the windows and the black frames stay
     opaque, while the gaps between cars stay transparent because they reach
     the image border and are therefore not holes.

     The whole four-car set is kept, not a single car. At 9.79:1 it is 42mm
     long and 4.3mm across on the poster, which still clears the 8mm row gaps
     and the 14mm centre gutter it has to sit in.

  2. assets/blue-footer-band.png
     The supplied crop of the official Blue footer carries two rows that are
     not part of the artwork: one pure-white row and one anti-aliased blend,
     left over from lifting the band out of the source PDF. At A1 width that
     prints as a ~0.3mm white line across the full 594mm. Trimming them back
     to the first fully-#1B417C row restores the school's design rather than
     altering it; nothing is scaled, recoloured or retypeset.

  3. assets/screenshots/ST7_crop.png
     The supplied ST7 capture predates the 2026-07-22 copy fix in
     web/js/report/providers.js and still reads "9-16 % above these
     estimates". That contradicts the poster's own honest-finding panel, which
     reports a median bias of -7.2%. Cropping at the end of section 2's last
     complete sentence removes the stale claim without re-shooting.
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_fill_holes

HERE = Path(__file__).parent
CLIPS = HERE.parent / "clips"


def mrt_train() -> None:
    """The full four-car set from clips/MRT.png, cut out with an alpha channel."""
    src = Image.open(CLIPS / "MRT.png").convert("RGB")
    rgb = np.asarray(src).astype(np.uint8)

    solid = binary_fill_holes(rgb.max(axis=2) > 18)
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1

    out = np.dstack([rgb[y0:y1, x0:x1], (solid[y0:y1, x0:x1] * 255).astype(np.uint8)])
    img = Image.fromarray(out, "RGBA")
    img.save(HERE / "assets" / "mrt-train.png")
    print(f"  mrt-train.png          {img.size}  aspect {img.width / img.height:.3f}")


def footer_band() -> None:
    """Trim the crop artefacts above the official Blue footer band."""
    src = Image.open(HERE / "assets" / "blue-footer-band-src.png").convert("RGB")
    a = np.asarray(src).astype(int)

    blue = np.array([27, 65, 124])
    solid = [y for y in range(a.shape[0])
             if np.abs(a[y] - blue).max(axis=1).max() <= 2]
    top, bottom = solid[0], solid[-1] + 1

    img = src.crop((0, top, src.width, bottom))
    img.save(HERE / "assets" / "blue-footer-band.png")
    print(f"  blue-footer-band.png   {img.size}  trimmed {top} row(s) off the top; "
          f"--band-h must be {594.0 * img.height / img.width:.3f}mm")


def st7_crop() -> None:
    """Cut ST7 above the stale 9-16% sentence."""
    src = Image.open(HERE / "assets" / "screenshots" / "ST7.png")
    img = src.crop((0, 0, src.width, 1100))
    img.save(HERE / "assets" / "screenshots" / "ST7_crop.png")
    print(f"  ST7_crop.png           {img.size}  aspect {img.width / img.height:.3f}")


if __name__ == "__main__":
    mrt_train()
    footer_band()
    st7_crop()
