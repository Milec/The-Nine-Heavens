"""Entry point: `python -m nine_heavens`."""

from __future__ import annotations

import argparse

from .game import play


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="nine_heavens",
        description="The Nine Heavens — a text-based Chinese cultivation RPG.")
    parser.add_argument("--seed", type=int, default=None,
                        help="Seed the RNG for a reproducible fate.")
    args = parser.parse_args()
    play(seed=args.seed)


if __name__ == "__main__":
    main()
