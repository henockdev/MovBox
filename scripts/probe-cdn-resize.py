"""
Probe the aoneroom image CDN's resize support.

The catalogue's poster URLs are full-resolution WebP (1.1 MB each) and the
site serves them straight through (`images.unoptimized = true`), so a 44 px
thumbnail in the hero strip costs a megabyte. The CDN is Alibaba Cloud OSS,
which supports the `x-oss-process` image pipeline — first measurement:
1 109 732 B -> 25 780 B for `image/resize,w_500`.

This checks the hosts the site actually uses, and what the resized file
really contains, before anything is changed.

Usage: py scripts/probe-cdn-resize.py
"""

import io
import urllib.request

from PIL import Image

HOSTS = [
    "https://pbcdn.aoneroom.com/image/2026/11/06/8a851d81a92520e6979c7984e757e3fe.webp",
    "https://pbcdnw.aoneroom.com/image/2026/10/27/227e8d8e6d09ef96c206c52ffb0f924b.webp",
]

PARAMS = [
    "",
    "?x-oss-process=image/resize,w_500",
    "?x-oss-process=image/resize,w_200",
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "movbox-probe/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.status, r.read()


for host in HOSTS:
    print(f"\n=== {host}")
    for p in PARAMS:
        try:
            status, blob = fetch(host + p)
            im = Image.open(io.BytesIO(blob))
            label = p or "(none)"
            print(
                f"  {label:<44} {status} {len(blob):>9} B  {im.size[0]}x{im.size[1]} {im.format}"
            )
        except Exception as e:  # noqa: BLE001
            print(f"  {p or '(none)':<44} ERROR {e}")
