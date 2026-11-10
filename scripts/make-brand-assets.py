"""
Build the Movbox brand assets from the transparent master mark.

## Why this exists

The header's wordmark shipped as `public/movbox_logo_nav.png`, but that file
was really a **JPEG** (1536x1024) with **no alpha channel** — a big black
plate sitting behind the mark on a near-black header. It read as a black box
with a logo stuck on it.

The master mark (`assets/brand/movbox-mark.png`) is a real RGBA PNG, so this
script:

  - trims the transparent padding away (alpha bounding box),
  - re-saves the mark as a transparent PNG,
  - rebuilds the icon set (favicon, apple touch, PWA icons) with the mark on
    a brand-coloured rounded plate, because an icon with no plate disappears
    into a browser tab on a light background,
  - writes a scaled-down copy for the header so the page does not ship a
    1300 px PNG for a 46 px logo.

Run from the repo root:

    py scripts/make-brand-assets.py

Re-run it whenever the master mark changes.
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "assets", "brand", "movbox-mark.png")
PUBLIC = os.path.join(ROOT, "public")
APP = os.path.join(ROOT, "app")

# The brand burgundy the plate is painted in.
BRAND = (128, 0, 32)


def trimmed_master():
    im = Image.open(MASTER).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def save_scaled(im, path, width, quantize=False):
    height = round(im.size[1] * width / im.size[0])
    out = im.resize((width, height), Image.LANCZOS)
    if quantize:
        # The mark is a smooth gradient, and the site serves images
        # unoptimized — so the file that reaches the browser is the file on
        # disk. Quantising to 200 colours keeps the gradient clean and cuts
        # the payload to a third.
        out = out.quantize(colors=200, method=Image.FASTOCTREE).convert("RGBA")
    out.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, ROOT)}  {out.size[0]}x{out.size[1]}"
          f"  {os.path.getsize(path)} B")


def plate_with_mark(im, size, radius_ratio=0.22, padding_ratio=0.16):
    """The mark on a rounded brand-coloured plate."""
    pad = round(size * padding_ratio)
    inner = size - pad * 2
    scale = inner / max(im.size)
    mark = im.resize(
        (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale))),
        Image.LANCZOS,
    )
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    draw.rounded_rectangle(
        (0, 0, size - 1, size - 1),
        radius=round(size * radius_ratio),
        fill=BRAND + (255,),
    )
    plate.alpha_composite(
        mark, ((size - mark.size[0]) // 2, (size - mark.size[1]) // 2)
    )
    return plate


def save_plate(im, path, size):
    plate = plate_with_mark(im, size)
    plate.save(path, "PNG", optimize=True)
    print(f"  {os.path.relpath(path, ROOT)}  {size}x{size}")


def main():
    if not os.path.exists(MASTER):
        raise SystemExit(f"master mark not found: {MASTER}")

    print("master mark:")
    mark = trimmed_master()
    print(f"  trimmed to {mark.size}")

    print("\nthe mark (transparent):")
    # The header lockup renders the mark at 46 px, so 256 px is ample even on
    # a 2x screen.
    save_scaled(mark, os.path.join(PUBLIC, "movbox_logo_nav.png"), 256, quantize=True)
    save_scaled(mark, os.path.join(PUBLIC, "movbox_icon.png"), 512, quantize=True)

    print("\nicon set (the mark on a brand plate):")
    save_plate(mark, os.path.join(PUBLIC, "favicon-32x32.png"), 32)
    save_plate(mark, os.path.join(PUBLIC, "favicon-16x16.png"), 16)
    save_plate(mark, os.path.join(PUBLIC, "apple-touch-icon.png"), 180)
    save_plate(mark, os.path.join(PUBLIC, "icon-192.png"), 192)
    save_plate(mark, os.path.join(PUBLIC, "icon-512.png"), 512)

    # Next.js serves app/icon.* and app/favicon.ico from the app directory and
    # they win over public/. app/icon.png is the one the browser actually
    # requests for the tab, so the brand mark has to be there.
    save_plate(mark, os.path.join(APP, "icon.png"), 512)

    # The .ico the browser asks for by default.
    ico = plate_with_mark(mark, 48)
    ico.save(
        os.path.join(PUBLIC, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("  public/favicon.ico  (16, 32, 48)")

    ico.save(
        os.path.join(APP, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("  app/favicon.ico  (16, 32, 48)")


if __name__ == "__main__":
    main()
