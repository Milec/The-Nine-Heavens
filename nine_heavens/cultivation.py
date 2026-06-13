"""Cultivation mechanics: gaining qi, breaking through stages and realms,
and surviving the Heavenly Tribulation between major realms."""

from __future__ import annotations

import random

from . import data
from .character import Character


def cultivate(c: Character, rng: random.Random, years: int = 1,
              use_pill: bool = False) -> list:
    """Spend `years` in seclusion drawing qi. Returns a list of message lines."""
    msgs = []
    if not c.alive:
        return ["You are dead. The dao is closed to you."]

    pill_mult = 1.0
    if use_pill and c.pills > 0:
        c.pills -= 1
        pill_mult = 2.5
        msgs.append("You swallow a Qi-Gathering Pill; warmth floods your meridians.")

    for _ in range(years):
        if not c.alive:
            break
        # Luck causes occasional epiphanies (顿悟).
        epiphany = rng.random() < (c.luck / 1500.0 + c.comprehension / 4000.0)
        gain = c.cultivation_speed * pill_mult * rng.uniform(0.85, 1.2)
        if epiphany:
            gain *= rng.uniform(2.5, 5.0)
            msgs.append("✦ A sudden epiphany! Heavenly insight pours into you.")
        c.qi += gain
        # Seclusion mends body and meridians -- HP recovers over a year or two.
        if c.hp < c.max_hp:
            c.hp = min(c.max_hp, c.hp + c.max_hp * 0.55 + c.constitution * 0.5)
        # A sect disciple draws a yearly stipend of spirit stones by rank.
        if c.sect_key:
            c.spirit_stones += data.SECT_RANKS[c.sect_rank][4]
        _advance_age(c, rng, msgs)
        # Auto-fill stages until we hit a realm wall or run out of qi.
        while c.alive and c.qi >= c.qi_to_next and not _at_realm_wall(c):
            _advance_stage(c, msgs)
    return msgs


def _at_realm_wall(c: Character) -> bool:
    """True if the next step would cross into a new major realm (needs a
    deliberate, risky breakthrough rather than passive accumulation)."""
    return c.stage >= c.realm_stages - 1


def _advance_stage(c: Character, msgs: list) -> None:
    c.qi -= c.qi_to_next
    c.stage += 1
    c.recompute_max_hp()
    msgs.append(f"⮝ Advanced to {c.realm_label}.")


def _advance_age(c: Character, rng: random.Random, msgs: list) -> None:
    c.age += 1
    if c.age > c.max_age:
        # A grace roll -- great luck/soul can squeeze out a few more years.
        if rng.random() > (c.luck + c.soul) / 400.0:
            c.alive = False
            c.cause_of_death = "old age, lifespan exhausted"
            msgs.append(
                f"☠ At {c.age}, your lifespan runs dry. You return to dust "
                f"having reached {c.realm_label}.")
            c.note("Died of old age.")


def can_breakthrough(c: Character) -> bool:
    return _at_realm_wall(c) and c.realm < len(data.REALMS) - 1 \
        and c.qi >= c.qi_to_next


def breakthrough_chance(c: Character) -> float:
    """Probability of a successful realm breakthrough, 0..1."""
    base = data.REALMS[c.realm + 1][5]
    comp = c.comprehension / 200.0
    luck = c.luck / 300.0
    soul = c.soul / 400.0
    chance = base + comp + luck + soul
    # Surplus qi gives a cushion.
    if c.qi > c.qi_to_next * 1.5:
        chance += 0.08
    return max(0.02, min(0.97, chance))


def attempt_breakthrough(c: Character, rng: random.Random) -> list:
    """Try to cross into the next major realm. Higher realms invite a
    Heavenly Tribulation that can outright kill an underprepared cultivator."""
    msgs = []
    if not can_breakthrough(c):
        if not _at_realm_wall(c):
            return ["You have not yet reached the peak of this realm."]
        if c.qi < c.qi_to_next:
            return ["Your qi is not yet condensed enough to attempt a breakthrough."]
        return ["You stand at the very apex of cultivation. There is no higher heaven."]

    next_realm = data.REALMS[c.realm + 1]
    chance = breakthrough_chance(c)
    msgs.append(
        f"You marshal your qi to break into {next_realm[0]} ({next_realm[1]})... "
        f"[{int(chance * 100)}% chance]")

    c.qi -= c.qi_to_next
    roll = rng.random()
    if roll <= chance:
        c.realm += 1
        c.stage = 0
        c.max_age = next_realm[3]
        c.recompute_max_hp()
        c.hp = c.max_hp
        msgs.append(f"☯ BREAKTHROUGH! You have ascended to {c.realm_label}!")
        c.note(f"Broke through to {c.realm_name}.")

        # Tribulation for the loftier realms.
        if c.realm >= 4:
            msgs.extend(_tribulation(c, rng))
    else:
        # Failure -- always painful, sometimes fatal, harder at high realms.
        backlash = (c.realm + 1) * 0.04
        msgs.append("✗ The breakthrough fails; qi-deviation tears through your meridians.")
        if rng.random() < backlash and rng.random() > (c.luck + c.soul) / 500.0:
            c.alive = False
            c.cause_of_death = f"qi deviation while assaulting {next_realm[0]}"
            msgs.append("☠ The backlash is too violent. Your soul scatters. You die.")
            c.note("Died from a failed breakthrough.")
        else:
            dmg = c.max_hp * rng.uniform(0.3, 0.7)
            c.hp = max(1, c.hp - dmg)
            c.stage = max(0, c.stage - 1)
            msgs.append("You survive, gravely wounded, and slip back a stage.")
    return msgs


def _tribulation(c: Character, rng: random.Random) -> list:
    """The Heavenly Tribulation -- nine waves of heavenly lightning."""
    msgs = ["", "⚡ The sky darkens. Tribulation clouds gather above you. ⚡"]
    waves = min(9, c.realm)
    survived = 0
    # A strong body shields the flesh; a keen spirit sense reads each bolt before
    # it falls. The well-prepared walk through heavenly fire; the rest are ash.
    defense = c.power * (1 + c.constitution / 80.0 + c.soul / 110.0)
    for w in range(1, waves + 1):
        bolt = c.power * rng.uniform(0.7, 1.35) * (1 + w * 0.10)
        if bolt <= defense * rng.uniform(0.85, 1.3):
            survived += 1
            msgs.append(f"   Wave {w}/{waves}: you endure the heavenly fire.")
        else:
            dmg = c.max_hp * rng.uniform(0.18, 0.42)
            c.hp -= dmg
            msgs.append(f"   Wave {w}/{waves}: lightning sears you ({int(dmg)} dmg).")
            if c.hp <= 0:
                # One last clutch on life from luck.
                if rng.random() < c.luck / 350.0:
                    c.hp = c.max_hp * 0.1
                    msgs.append("   ...a hidden reserve of fortune drags you back from death!")
                else:
                    c.alive = False
                    c.cause_of_death = f"struck down by the {c.realm_name} tribulation"
                    msgs.append("   ☠ The final bolt scatters your soul. The tribulation claims you.")
                    c.note("Died crossing the Heavenly Tribulation.")
                    return msgs
    c.hp = max(c.hp, c.max_hp * 0.2)
    msgs.append(f"⚡ You weathered {survived}/{waves} waves. The clouds disperse. ⚡")
    msgs.append("")
    return msgs
