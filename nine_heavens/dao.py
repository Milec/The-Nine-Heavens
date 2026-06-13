"""Dao / Law comprehension (法则·大道): the lofty road to ascension."""

from __future__ import annotations

import random

from . import data
from .character import Character

# Only Nascent Soul cultivators and above can perceive the great Daos.
MIN_REALM = 5


def insight_threshold(c: Character) -> float:
    """Insight needed to grasp the next Dao -- each one harder than the last."""
    return 100.0 * (1 + len(c.daos) * 0.85)


def can_comprehend(c: Character) -> bool:
    return c.realm >= MIN_REALM and len(c.daos) < len(data.DAOS)


def meditate(c: Character, rng: random.Random, years: int = 1) -> list:
    """Sit in profound meditation, accruing insight toward a new Dao."""
    if not c.alive:
        return ["You are dead."]
    if c.realm < MIN_REALM:
        return [f"Your soul is too unrefined to perceive the Daos. "
                f"(requires {data.REALMS[MIN_REALM][0]})"]
    if len(c.daos) >= len(data.DAOS):
        return ["You have already comprehended every Dao under heaven."]
    msgs = []
    for _ in range(years):
        if not c.alive:
            break
        gain = (c.comprehension + c.soul) / 18.0 * rng.uniform(0.7, 1.3)
        gain *= (1 + c.luck / 300.0)
        if "karma" in c.daos:
            gain *= 1.15
        if rng.random() < c.comprehension / 2500.0:
            gain *= rng.uniform(2.0, 4.0)
            msgs.append("✦ The veil thins -- a flash of profound enlightenment!")
        c.dao_insight += gain
        c.age += 1
        if c.dao_insight >= insight_threshold(c):
            msgs += _comprehend_new_dao(c, rng)
        if c.age > c.max_age:
            c.alive = False
            c.cause_of_death = "old age deep in Dao meditation"
            msgs.append(f"☠ Your lifespan ends at {c.age}, mid-revelation.")
            break
    if not msgs:
        msgs.append(f"You meditate on the nature of the Dao. "
                    f"(insight {c.dao_insight:.0f}/{insight_threshold(c):.0f})")
    return msgs


def _comprehend_new_dao(c: Character, rng: random.Random) -> list:
    c.dao_insight = 0.0
    unknown = [d for d in data.DAOS if d[0] not in c.daos]
    if not unknown:
        return []
    # Sin draws a soul toward the Dao of Slaughter; otherwise it is open.
    weights = []
    for d in unknown:
        w = 1.0
        if d[0] == "slaughter" and c.karma < -30:
            w = 3.0
        if d[0] == "karma" and c.karma > 60:
            w = 2.5
        weights.append(w)
    dao = rng.choices(unknown, weights=weights, k=1)[0]
    c.daos.append(dao[0])
    c.note(f"Comprehended the {dao[1]}.")
    return ["", f"☯ You comprehend the {dao[1]}!", f"  {dao[4]}", ""]
