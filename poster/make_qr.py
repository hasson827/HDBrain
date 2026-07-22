"""
make_qr.py — turn the poster's QR placeholders into real, printable codes.

    pip install segno
    python make_qr.py

Fill in TARGETS below, run it, and the SVGs land in assets/qr/. poster.html
picks them up by filename; a target left as None keeps its dashed placeholder,
so this is safe to run before every URL exists.

Why SVG and not PNG: the codes print at 26mm. A raster code that small needs
~310px just to hit 300dpi, and any resampling softens the module edges, which
is exactly what a phone camera needs to be crisp. SVG is resolution-free and
Chrome's PDF export keeps it vector.

Why error correction M: the poster is printed, flat, and well lit, so the extra
redundancy of Q or H buys nothing and costs modules. Fewer modules means each
module is physically bigger, which is what actually drives scan distance.

Rule of thumb for scan distance: roughly 10x the code's width. At 26mm a phone
locks on from ~26cm, which is the distance someone reads a poster panel from.
Shorter URLs produce lower QR versions (fewer, larger modules), so prefer a
short link over a raw YouTube watch URL.
"""

from pathlib import Path

import segno

HERE = Path(__file__).parent
OUT = HERE / "assets" / "qr"

# filename stem -> URL. None leaves the placeholder in place.
TARGETS = {
    "repo": "https://github.com/hasson827/HDBrain",
    "site": "https://hasson827.github.io/HDBrain/",
    "demo": "https://hasson827.github.io/HDBrain/demo.html",
}

# Dark modules on a light tile, which is the polarity the QR spec assumes.
#
# The first version of this drew the modules in --ink-1 and left the quiet zone
# transparent, so the codes sat on the glass and read as part of the poster's
# type. They also did not scan: rendered at 300dpi and fed to OpenCV, all three
# failed as printed and decoded only after inverting the image. Phone cameras
# are often more forgiving than that, but "often" is not a property a printed
# poster can rely on.
#
# So the colours are swapped and both come from the poster's own palette
# (--bg-0 modules on an --ink-1 tile) rather than pure black on pure white:
# correct polarity, ~17:1 contrast, and still in the poster's ink.
DARK = "#0a1220"
LIGHT = "#eef2f8"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stem, url in TARGETS.items():
        if not url:
            print(f"  {stem:6s} skipped (no URL yet)")
            continue
        qr = segno.make(url, error="m")
        path = OUT / f"{stem}.svg"
        qr.save(path, scale=10, border=2, dark=DARK, light=LIGHT)
        modules = qr.symbol_size(border=2)[0]
        print(f"  {stem:6s} v{qr.version:<2d} {modules} modules  "
              f"{26 / modules:.2f}mm per module at 26mm  ->  {path.name}")


if __name__ == "__main__":
    main()
