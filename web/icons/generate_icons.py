#!/usr/bin/env python3
"""Generate the PWA icons for The Nine Heavens using only the Python stdlib.

Draws a small xianxia scene -- a golden moon over dark mountain peaks -- at the
sizes the manifest and iOS expect. Run from this directory:  python generate_icons.py
"""

import math
import struct
import zlib


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _pixel(u, v, pad=0.0):
    """Return an (r, g, b) for normalized coords u, v in [0, 1].

    `pad` shrinks the scene toward the centre (for maskable safe-zone)."""
    # Apply maskable padding by scaling coords about the centre.
    if pad:
        scale = 1.0 - 2 * pad
        u = 0.5 + (u - 0.5) / scale
        v = 0.5 + (v - 0.5) / scale
        if u < 0 or u > 1 or v < 0 or v > 1:
            return (14, 18, 32)

    # Background: vertical gradient with a soft glow up top.
    top = (16, 20, 36)
    bot = (10, 13, 24)
    col = list(_lerp(top, bot, v))
    glow = max(0.0, 1.0 - math.hypot(u - 0.5, v - 0.32) / 0.55)
    for i, g in enumerate((40, 44, 70)):
        col[i] += (g - col[i]) * glow * 0.5

    # Moon.
    mx, my, mr = 0.5, 0.34, 0.18
    d = math.hypot((u - mx), (v - my))
    if d < mr:
        moon = (236, 206, 130)
        edge = min(1.0, (mr - d) / 0.02)
        # Subtle inner shading toward the lower-right.
        shade = 1.0 - 0.12 * ((u - mx) + (v - my)) / mr
        moon = tuple(c * shade for c in moon)
        col = list(_lerp(col, moon, edge))
    else:
        # Faint halo around the moon.
        halo = max(0.0, 1.0 - (d - mr) / 0.10)
        for i, g in enumerate((150, 130, 80)):
            col[i] += (g - col[i]) * halo * 0.10

    # Mountains: three peaks plus a foothill baseline.
    peaks = [(0.27, 0.58, 0.26), (0.5, 0.46, 0.30), (0.74, 0.60, 0.24)]
    horizon = 0.80
    for px, py, w in peaks:
        if abs(u - px) <= w:
            line = py + (abs(u - px) / w) * (1.05 - py)
            horizon = min(horizon, line)
    if v >= horizon:
        depth = (v - horizon) / max(1e-6, (1.02 - horizon))
        ridge = (74, 60, 40)
        deep = (22, 20, 30)
        col = list(_lerp(ridge, deep, min(1.0, depth)))
        # A thin bright rim where mountain meets sky.
        if v - horizon < 0.012:
            col = list(_lerp(col, (210, 175, 110), 0.6))

    return tuple(int(max(0, min(255, c))) for c in col)


def _render(size, pad=0.0, ss=2):
    """Render an RGBA bytes buffer, supersampled ss x ss for smoothness."""
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0 for this scanline
        for x in range(size):
            r = g = b = 0
            for sy in range(ss):
                for sx in range(ss):
                    u = (x + (sx + 0.5) / ss) / size
                    v = (y + (sy + 0.5) / ss) / size
                    pr, pg, pb = _pixel(u, v, pad)
                    r += pr; g += pg; b += pb
            n = ss * ss
            raw += bytes((r // n, g // n, b // n, 255))
    return bytes(raw)


def _chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def _write_png(path, size, pad=0.0):
    raw = _render(size, pad)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n"
           + _chunk(b"IHDR", ihdr)
           + _chunk(b"IDAT", zlib.compress(raw, 9))
           + _chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


if __name__ == "__main__":
    _write_png("icon-192.png", 192)
    _write_png("icon-512.png", 512)
    _write_png("icon-180.png", 180)               # iOS apple-touch-icon
    _write_png("icon-512-maskable.png", 512, pad=0.12)
