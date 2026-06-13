"""Spirit beasts (灵宠): taming wild creatures into companions that grow."""

from __future__ import annotations

import random
from dataclasses import dataclass

from . import data
from .character import Character


@dataclass
class SpiritBeast:
    name: str
    species: str
    power: float
    loyalty: int = 50    # 0..100
    alive: bool = True

    @property
    def tier(self) -> str:
        # A loose flavour label based on raw strength.
        if self.power < 200:
            return "Rank 1"
        if self.power < 2000:
            return "Rank 2"
        if self.power < 20000:
            return "Rank 3"
        if self.power < 200000:
            return "Rank 4"
        return "Rank 5"


def tame_chance(c: Character, beast_power: float, rng: random.Random) -> float:
    """Odds of subduing and binding a defeated beast."""
    if c.beast is not None:
        return 0.0  # one companion at a time
    ratio = c.power / max(1.0, beast_power)
    base = 0.20 + c.soul / 400.0 + c.charm / 500.0
    base += min(0.3, (ratio - 1) * 0.15)        # easier if it's weaker than you
    if c.sect_key == "spiritbeast":
        base += 0.20                            # beast-tamers' speciality
    return max(0.02, min(0.85, base))


def try_tame(c: Character, species: str, beast_power: float,
             rng: random.Random) -> list:
    """Attempt to tame a beast you have just bested in the wild."""
    if c.beast is not None:
        return []
    if rng.random() < tame_chance(c, beast_power, rng):
        beast = SpiritBeast(name=_beast_name(species, rng), species=species,
                            power=beast_power * rng.uniform(0.6, 0.9))
        c.beast = beast
        c.note(f"Tamed a {species} as a spirit beast companion.")
        return [f"  ✦ You subdue the {species} and bind it as a spirit beast "
                f"companion! ({beast.name}, {beast.tier})"]
    return ["  The beast breaks free and flees before you can bind it."]


def grow(c: Character, rng: random.Random) -> None:
    """A bound beast slowly strengthens as its master cultivates."""
    b = c.beast
    if b and b.alive:
        b.power *= rng.uniform(1.0, 1.04)
        # It also tends to grow toward its master's own strength.
        target = c.power * 0.6
        if b.power < target:
            b.power += (target - b.power) * 0.05


def _beast_name(species: str, rng: random.Random) -> str:
    prefixes = ["Little", "Old", "Snowy", "Ember", "Shadow", "Jade", "Storm",
                "Cloud", "Ink", "Gold"]
    return f"{rng.choice(prefixes)} {species.split()[-1]}"
