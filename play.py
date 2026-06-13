#!/usr/bin/env python3
"""Convenience launcher for The Nine Heavens.

Equivalent to `python -m nine_heavens`. Run me from the repo root:

    python play.py
    python play.py --seed 1234
"""

from nine_heavens.__main__ import main

if __name__ == "__main__":
    main()
