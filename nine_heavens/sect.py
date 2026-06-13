"""Sect life: joining, the rank ladder, contribution quests and tournaments."""

from __future__ import annotations

import random

from . import data, social, world
from .character import Character


# ---------------------------------------------------------------------------
# Joining a sect.
# ---------------------------------------------------------------------------

def talent_tier(c: Character) -> int:
    return data.ROOT_TIER.get(c.root.key, 0)


def join_chance(c: Character, sect) -> float:
    """Probability the sect's gate-keepers accept you."""
    _key, _name, _align, _elem, _prestige, min_realm, join_tier, *_ = sect
    if c.realm < min_realm:
        return 0.0
    tier = talent_tier(c)
    # Meeting the talent bar makes it near-certain; falling short makes it hard.
    gap = tier - join_tier
    base = 0.55 + gap * 0.22 + c.comprehension / 400.0 + c.reputation / 300.0
    # An element-matched root impresses an element-aligned sect.
    if sect[3] and c.root.elements and sect[3] in c.root.elements:
        base += 0.15
    return max(0.0, min(0.97, base))


def attempt_join(c: Character, rng: random.Random, sect_key: str) -> list:
    sect = data.SECT_BY_KEY.get(sect_key)
    if not sect:
        return ["No such sect."]
    if c.sect_key:
        return [f"You are already a disciple of {c.sect_name}. Leave first."]
    if c.realm < sect[5]:
        return [f"The {sect[1]} will not even test a {c.realm_name} cultivator. "
                f"(requires {data.REALMS[sect[5]][0]})"]
    chance = join_chance(c, sect)
    msgs = [f"You present yourself to the {sect[1]} for assessment... "
            f"[{int(chance * 100)}% chance]"]
    if rng.random() <= chance:
        c.sect_key = sect_key
        c.sect_rank = 0
        c.contribution = 0
        c.reputation += sect[8]
        c.note(f"Joined the {sect[1]} as an Outer Disciple.")
        msgs.append(f"☯ Accepted! You don the robes of the {sect[1]}.")
        if sect[2] == "demonic":
            msgs.append("  The righteous world now eyes you with suspicion.")
        # Joining a sect opens the door to mentors and rivals.
        msgs += social.maybe_take_master(c, rng)
        if rng.random() < 0.6:
            msgs += social.introduce_rival(c, rng)
    else:
        c.reputation = max(-50, c.reputation - 2)
        msgs.append("✗ The elders find you wanting and turn you away.")
    return msgs


def leave_sect(c: Character) -> list:
    if not c.sect_key:
        return ["You belong to no sect."]
    name = c.sect_name
    c.note(f"Left the {name}.")
    c.sect_key = None
    c.sect_rank = 0
    c.contribution = 0
    return [f"You sever ties with the {name} and walk the lonely road of a "
            f"rogue cultivator once more."]


# ---------------------------------------------------------------------------
# Rank ladder.
# ---------------------------------------------------------------------------

def next_rank_requirements(c: Character):
    """Return (rank_name, min_realm, min_contribution) for the next rank, or None."""
    nxt = c.sect_rank + 1
    if not c.sect_key or nxt >= len(data.SECT_RANKS):
        return None
    name, min_realm, min_contrib, *_ = data.SECT_RANKS[nxt]
    return name, min_realm, min_contrib


def can_promote(c: Character) -> bool:
    req = next_rank_requirements(c)
    if not req:
        return False
    _name, min_realm, min_contrib = req
    return c.realm >= min_realm and c.contribution >= min_contrib


def attempt_promotion(c: Character, rng: random.Random) -> list:
    if not c.sect_key:
        return ["You belong to no sect."]
    req = next_rank_requirements(c)
    if not req:
        return ["You already sit at the very summit of your sect."]
    name, min_realm, min_contrib = req
    if c.realm < min_realm:
        return [f"Promotion to {name} requires {data.REALMS[min_realm][0]} "
                f"(you are {c.realm_name})."]
    if c.contribution < min_contrib:
        return [f"Promotion to {name} requires {min_contrib} contribution "
                f"(you have {c.contribution})."]
    # Spend contribution on the elevation; higher seats demand a real showing.
    c.contribution -= min_contrib
    c.sect_rank += 1
    c.reputation += 4 + c.sect_rank * 3
    c.note(f"Promoted to {name}.")
    return [f"☯ The sect elevates you to {name}!",
            f"  Your standing rises and the sect's arrays open wider to you."]


# ---------------------------------------------------------------------------
# Contribution quests.
# ---------------------------------------------------------------------------

def available_quests(c: Character):
    """Quests your current rank is cleared to accept."""
    if not c.sect_key:
        return []
    return [q for q in data.SECT_QUESTS if q[1] <= c.sect_rank]


def do_quest(c: Character, rng: random.Random, quest) -> list:
    """Carry out a sect quest. Costs a year; may erupt into combat."""
    name, _min_rank, contribution, stones, danger, blurb = quest
    if not c.sect_key:
        return ["You belong to no sect."]
    c.age += 1
    msgs = [f"Quest accepted: {name}.", f"  {blurb}"]
    if rng.random() < danger:
        msgs.append("  Trouble finds you on the way!")
        msgs += world.fight(c, rng)
        if not c.alive:
            return msgs
        # Survivors still complete the task.
    # Fortune and comprehension can over-deliver on a quest.
    bonus = 1.0 + (0.5 if rng.random() < c.luck / 250.0 else 0.0)
    earned_c = int(contribution * bonus)
    earned_s = int(stones * bonus)
    c.contribution += earned_c
    c.spirit_stones += earned_s
    c.reputation += 1
    msgs.append(f"  Quest complete! (+{earned_c} contribution, +{earned_s} "
                f"spirit stones, +1 reputation)")
    if bonus > 1.0:
        msgs.append("  Fortune smiled -- the elders are especially pleased.")
    if c.age > c.max_age and c.alive:
        c.alive = False
        c.cause_of_death = "old age on a sect errand"
        msgs.append(f"☠ Your lifespan ends at {c.age}, far from home.")
    return msgs


def exchange_contribution(c: Character, rng: random.Random) -> list:
    """Spend contribution at the sect store for pills (and rarely a manual)."""
    if not c.sect_key:
        return ["You belong to no sect."]
    cost = 25
    if c.contribution < cost:
        return [f"The sect store needs {cost} contribution; you have {c.contribution}."]
    c.contribution -= cost
    msgs = [f"You spend {cost} contribution at the sect store."]
    if rng.random() < 0.25:
        unknown = [k for k in data.TECHNIQUES if k not in c.techniques]
        if unknown:
            tech = rng.choice(unknown)
            c.techniques.append(tech)
            msgs.append(f"  You requisition a technique manual: {data.TECHNIQUES[tech][0]}!")
            return msgs
    gained = rng.randint(2, 4)
    c.pills += gained
    msgs.append(f"  You collect {gained} Qi-Gathering Pills.")
    return msgs


# ---------------------------------------------------------------------------
# Tournaments.
# ---------------------------------------------------------------------------

def tournament(c: Character, rng: random.Random) -> list:
    """A sect tournament: a single-elimination bracket of duels.

    Non-lethal (elders watch over the arena), but a hard loss bruises you.
    Placing well brings reputation, contribution, rewards and renown -- and may
    catch the eye of a future dao companion or sharpen a rivalry.
    """
    if not c.sect_key:
        return ["Only sect disciples may enter the sect tournament."]
    c.age += 1
    rounds = 4  # 16 contenders -> Top 8, Top 4, Final, Champion
    msgs = [f"⚑ The {c.sect_name} grand tournament begins! 16 contenders enter."]
    placement = 16
    won = 0
    for r in range(1, rounds + 1):
        remaining = 16 // (2 ** (r - 1))
        # Opponents grow stronger as the bracket narrows.
        opp = c.power * rng.uniform(0.75, 1.05) * (1 + r * 0.10)
        you = c.power * rng.uniform(0.85, 1.25) * (1 + c.luck / 350)
        label = {16: "Round of 16", 8: "Quarter-final",
                 4: "Semi-final", 2: "Final"}.get(remaining, f"Round {r}")
        if you >= opp:
            won += 1
            placement = remaining // 2
            msgs.append(f"  {label}: victory! You advance.")
        else:
            msgs.append(f"  {label}: defeated. You take a beating but survive.")
            c.hp = max(1.0, c.hp - c.max_hp * rng.uniform(0.15, 0.35))
            break
    msgs += _tournament_rewards(c, rng, placement, won)
    if c.age > c.max_age and c.alive:
        c.alive = False
        c.cause_of_death = "old age after the tournament"
        msgs.append(f"☠ Your lifespan ends at {c.age}.")
    return msgs


def _tournament_rewards(c: Character, rng: random.Random, placement: int,
                        won: int) -> list:
    title = None
    for cutoff, name in data.TOURNAMENT_TITLES:
        if placement <= cutoff:
            title = name
            break
    contribution = won * 40 + (120 if placement == 1 else 0)
    rep = won * 3 + (20 if placement == 1 else 0)
    stones = won * 15
    c.contribution += contribution
    c.reputation += rep
    c.spirit_stones += stones
    msgs = [f"  Tournament over -- you finish in the top {max(placement, 1)}.",
            f"  Rewards: +{contribution} contribution, +{rep} reputation, "
            f"+{stones} spirit stones."]
    if placement == 1:
        c.pills += 3
        msgs.append("  As Champion you are awarded a Foundation Pill and 3 pills!")
    if title:
        honour = f"Tournament {title}"
        if honour not in c.titles:
            c.titles.append(honour)
        c.note(f"Placed as {title} in the {c.sect_name} tournament.")
        msgs.append(f"  ✦ You earn the title: {title}!")
        # Glory turns heads -- a rare chance to draw a dao companion.
        if placement <= 2 and not social.find(c, "companion") \
                and rng.random() < 0.3 + c.charm / 400.0:
            npc = social.NPC(social._npc_name(rng), "companion",
                             affinity=35, power=c.power * rng.uniform(0.7, 1.3))
            c.relationships.append(npc)
            msgs.append(f"  Your brilliance catches the eye of {npc.name}, who "
                        f"seeks you out afterward...")
    return msgs
