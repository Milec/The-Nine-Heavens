"""Alchemy (炼丹): refining gathered spirit herbs into pills."""

from __future__ import annotations

import random

from . import data
from .character import Character


def success_chance(c: Character, recipe) -> float:
    """Odds of refining a given pill cleanly."""
    _key, _name, _cost, base, _blurb = recipe
    skill = c.alchemy_skill * 0.006
    sense = (c.soul + c.comprehension) / 600.0
    return max(0.05, min(0.97, base + sense + skill))


def refine(c: Character, rng: random.Random, recipe_key: str) -> list:
    """Attempt to refine one batch of a pill. Costs herbs and a year."""
    recipe = data.PILL_BY_KEY.get(recipe_key)
    if not recipe:
        return ["No such recipe."]
    key, name, cost, _base, _blurb = recipe
    if c.herbs < cost:
        return [f"You need {cost} spirit herbs to attempt {name}; "
                f"you have {c.herbs}."]
    c.age += 1
    c.herbs -= cost
    chance = success_chance(c, recipe)
    msgs = [f"You light the pill furnace and refine {name}... "
            f"[{int(chance * 100)}% success]"]
    if rng.random() <= chance:
        c.alchemy_skill += 1
        msgs += _apply_pill(c, key, rng)
    else:
        # A botched batch -- some herbs survive the flames.
        salvage = cost // 3
        c.herbs += salvage
        c.alchemy_skill += 1  # you still learn from failure
        msgs.append(f"  The furnace erupts and the batch is ruined. "
                    f"(salvaged {salvage} herbs)")
    if c.age > c.max_age and c.alive:
        c.alive = False
        c.cause_of_death = "old age at the pill furnace"
        msgs.append(f"☠ Your lifespan ends at {c.age}, furnace still warm.")
    return msgs


def _apply_pill(c: Character, key: str, rng: random.Random) -> list:
    name = data.PILL_BY_KEY[key][1]
    if key == "qi":
        n = rng.randint(1, 2)
        c.pills += n
        return [f"  Success! You refine {n} {name}(s)."]
    if key == "heal":
        n = rng.randint(1, 2)
        c.healing_pills += n
        return [f"  Success! You refine {n} {name}(s)."]
    if key == "breakthrough":
        c.breakthrough_pills += 1
        return [f"  Success! A {name} -- save it for your next breakthrough."]
    if key == "body":
        gain = rng.randint(1, 3)
        c.constitution = min(160, c.constitution + gain)
        c.recompute_max_hp()
        return [f"  Success! The {name} tempers your body. (+{gain} Constitution)"]
    if key == "soul":
        gain = rng.randint(1, 3)
        c.soul = min(160, c.soul + gain)
        return [f"  Success! The {name} refines your spirit. (+{gain} Soul Sense)"]
    if key == "longevity":
        gain = int(c.max_age * rng.uniform(0.05, 0.11)) + 20
        c.max_age += gain
        c.note(f"Refined a {name}, extending lifespan by {gain} years.")
        return [f"  ✦ Success! The {name} adds {gain} years to your lifespan!"]
    return ["  Success!"]
