"""The Nine Heavens (九重天) — a text-based Chinese cultivation RPG.

Roll a soul into the world, see what spiritual root and standing the heavens
grant you at birth, and claw your way up the cultivation realms toward the
Nine Heavens.
"""

from .character import Character, generate_character  # noqa: F401

__version__ = "1.0.0"
__all__ = ["Character", "generate_character", "play"]


def play(seed=None):
    """Launch the interactive game."""
    from .game import play as _play
    _play(seed=seed)
