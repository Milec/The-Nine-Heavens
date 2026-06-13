"""Magic treasures (法宝): acquiring, grading and binding signature weapons."""

from __future__ import annotations

import random

from . import data
from .character import Character


def grade_for_realm(c: Character, rng: random.Random) -> str:
    """A realm-appropriate treasure grade, with rare lucky upgrades."""
    base = min(len(data.ARTIFACT_GRADES) - 1, c.realm // 2)
    roll = rng.random() + c.luck / 600.0
    if roll > 1.15:
        base += 2
    elif roll > 0.9:
        base += 1
    return data.ARTIFACT_GRADES[min(base, len(data.ARTIFACT_GRADES) - 1)]


def random_artifact(c: Character, rng: random.Random, grade: str = None) -> str:
    """Pick an artifact key, optionally constrained to a grade."""
    grade = grade or grade_for_realm(c, rng)
    pool = [a for a in data.ARTIFACTS if a[2] == grade]
    if not pool:  # fall back to the nearest lower grade that exists
        gi = data.ARTIFACT_GRADE_RANK[grade]
        while gi >= 0 and not pool:
            pool = [a for a in data.ARTIFACTS
                    if a[2] == data.ARTIFACT_GRADES[gi]]
            gi -= 1
    return rng.choice(pool)[0]


def _better(key_a: str, key_b: str) -> bool:
    """True if artifact key_a is strictly stronger than key_b."""
    a, b = data.ARTIFACT_BY_KEY[key_a], data.ARTIFACT_BY_KEY[key_b]
    return (data.ARTIFACT_GRADE_RANK[a[2]], a[3]) > \
           (data.ARTIFACT_GRADE_RANK[b[2]], b[3])


def acquire(c: Character, key: str, auto_equip: bool = True) -> list:
    """Add an artifact to the cultivator and bind it if it is an upgrade."""
    art = data.ARTIFACT_BY_KEY.get(key)
    if not art:
        return []
    c.artifacts.append(key)
    msgs = [f"  You obtain a treasure: {art[1]} ({art[2]} grade)!"]
    if auto_equip and (not c.equipped_artifact or _better(key, c.equipped_artifact)):
        c.equipped_artifact = key
        msgs.append(f"  You bind the {art[1]} as your signature treasure.")
        c.note(f"Bound the {art[1]} ({art[2]} grade).")
    return msgs


def equip(c: Character, key: str) -> list:
    if key not in c.artifacts:
        return ["You do not possess that treasure."]
    c.equipped_artifact = key
    art = data.ARTIFACT_BY_KEY[key]
    return [f"You bind the {art[1]} ({art[2]} grade) as your treasure."]


def describe(key: str) -> str:
    art = data.ARTIFACT_BY_KEY[key]
    return (f"{art[1]} ({art[2]}) — +{int(art[3] * 100)}% power"
            + (f", +{int(art[4] * 100)}% cultivation" if art[4] else ""))
