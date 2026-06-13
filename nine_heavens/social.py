"""Relationships: masters, rivals, sworn friends, dao companions and enemies.

NPCs are lightweight people who drift in and out of your life. Spending time
socialising shifts their affinity toward you and can yield real benefits --
a master's guidance, a friend's gifts, a rival's sparring, or the qi-doubling
harmony of a dao companion. Charm and appearance open these doors.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from . import data
from .character import Character


@dataclass
class NPC:
    name: str
    role: str          # 'master' | 'rival' | 'friend' | 'companion' | 'enemy'
    affinity: int = 0  # -100 .. 100
    power: float = 0.0
    alive: bool = True

    @property
    def role_label(self) -> str:
        return data.ROLE_LABEL.get(self.role, self.role.title())

    @property
    def status(self) -> str:
        return data.relationship_label(self.affinity)


def _npc_name(rng: random.Random) -> str:
    surname = rng.choice(data.SURNAMES)
    given = rng.choice(data.GIVEN_FIRST)
    if rng.random() < 0.5:
        given += rng.choice(data.GIVEN_SECOND)
    return f"{surname} {given}"


def find(c: Character, role: str):
    """Return the first living NPC of a given role, or None."""
    for n in c.relationships:
        if n.role == role and n.alive:
            return n
    return None


def _adjust(npc: NPC, delta: int) -> None:
    npc.affinity = max(-100, min(100, npc.affinity + delta))


# ---------------------------------------------------------------------------
# Meeting people -- triggered on joining a sect and while socialising.
# ---------------------------------------------------------------------------

def maybe_take_master(c: Character, rng: random.Random) -> list:
    """A talented new disciple may be accepted by a sect elder as a master."""
    if find(c, "master") or not c.sect:
        return []
    tier = data.ROOT_TIER.get(c.root.key, 0)
    chance = 0.15 + tier * 0.10 + c.comprehension / 400.0
    if rng.random() < chance:
        npc = NPC(_npc_name(rng), "master", affinity=30,
                  power=c.power * rng.uniform(20, 60))
        c.relationships.append(npc)
        c.note(f"Accepted as a personal disciple by Elder {npc.name}.")
        return [f"✦ Elder {npc.name} sees your potential and takes you as a "
                f"personal disciple! You now have a Master."]
    return []


def introduce_rival(c: Character, rng: random.Random) -> list:
    """Sects breed rivalries -- a peer who measures themselves against you."""
    if find(c, "rival"):
        return []
    npc = NPC(_npc_name(rng), "rival", affinity=-10,
              power=c.power * rng.uniform(0.8, 1.3))
    c.relationships.append(npc)
    c.note(f"Gained a rival in fellow disciple {npc.name}.")
    return [f"Fellow disciple {npc.name} sniffs at your talent. A rivalry is born."]


# ---------------------------------------------------------------------------
# Socialising -- one year spent among people, resolved as a random event.
# ---------------------------------------------------------------------------

def _finish_year(c: Character, msgs: list) -> list:
    """Apply the lifespan check after a year spent socialising."""
    if c.age > c.max_age and c.alive:
        c.alive = False
        c.cause_of_death = "old age amid friends"
        msgs.append(f"☠ Your lifespan runs out at {c.age}, surrounded by those "
                    f"you knew.")
    return msgs


def socialize(c: Character, rng: random.Random) -> list:
    """Auto-resolve a year of socialising (used by headless play and tests)."""
    if not c.alive:
        return ["You are dead. The living no longer seek your company."]
    c.age += 1
    living = [n for n in c.relationships if n.alive]
    # Either deepen an existing bond or, often, meet someone new.
    if living and rng.random() < 0.6:
        msgs = _interact(c, rng.choice(living), rng)
    else:
        msgs = _meet_someone(c, rng)
    return _finish_year(c, msgs)


def meet_new(c: Character, rng: random.Random) -> list:
    """Spend a year going out to meet new people."""
    if not c.alive:
        return ["You are dead. The living no longer seek your company."]
    c.age += 1
    return _finish_year(c, _meet_someone(c, rng))


def interact_with(c: Character, npc: "NPC", rng: random.Random) -> list:
    """Spend a year with one specific person."""
    if not c.alive:
        return ["You are dead."]
    if not npc.alive:
        return [f"{npc.name} is no longer among the living."]
    c.age += 1
    return _finish_year(c, _interact(c, npc, rng))


def _meet_someone(c: Character, rng: random.Random) -> list:
    """Charm and appearance decide who crosses your path."""
    social_pull = c.charm + (20 if c.appearance_key in
                             ("striking", "peerless", "immortal") else 0)
    roll = rng.random()
    # A dao companion is the rarest, most charm-gated meeting.
    if roll < 0.22 + social_pull / 500.0 and not find(c, "companion"):
        npc = NPC(_npc_name(rng), "companion",
                  affinity=20 + int(social_pull / 6),
                  power=c.power * rng.uniform(0.6, 1.4))
        c.relationships.append(npc)
        c.note(f"Met {npc.name}, a kindred spirit on the dao.")
        return [f"✦ You cross paths with {npc.name}, and something kindles. "
                f"A potential Dao Companion enters your life."]
    if roll < 0.62:
        npc = NPC(_npc_name(rng), "friend", affinity=15 + int(c.charm / 8),
                  power=c.power * rng.uniform(0.5, 1.5))
        c.relationships.append(npc)
        c.note(f"Befriended {npc.name}.")
        return [f"You share wine and talk of the dao with {npc.name}; a "
                f"friendship forms."]
    # Sometimes you simply make an enemy.
    npc = NPC(_npc_name(rng), "enemy", affinity=-30,
              power=c.power * rng.uniform(0.7, 1.6))
    c.relationships.append(npc)
    c.note(f"Made an enemy of {npc.name}.")
    return [f"A careless word earns you the lasting enmity of {npc.name}."]


def _interact(c: Character, npc: NPC, rng: random.Random) -> list:
    """Resolve a year spent with a specific person, by their role."""
    handler = {
        "master": _with_master,
        "rival": _with_rival,
        "friend": _with_friend,
        "companion": _with_companion,
        "enemy": _with_enemy,
    }.get(npc.role, _with_friend)
    return handler(c, npc, rng)


def _with_master(c, npc, rng):
    _adjust(npc, rng.randint(2, 6))
    msgs = [f"You attend on your master, {npc.name} ({npc.status})."]
    if npc.affinity > 40 and rng.random() < 0.5:
        gain = rng.randint(2, 7)
        c.comprehension = min(160, c.comprehension + gain)
        msgs.append(f"  Their pointers sharpen your insight. (+{gain} comprehension)")
    elif rng.random() < 0.35:
        # Master may pass down a technique you lack.
        unknown = [k for k in data.TECHNIQUES if k not in c.techniques]
        if unknown:
            tech = rng.choice(unknown)
            c.techniques.append(tech)
            msgs.append(f"  Master imparts a manual: {data.TECHNIQUES[tech][0]}!")
    else:
        c.qi += c.qi_to_next * rng.uniform(0.2, 0.5)
        msgs.append("  Guided meditation under their eye refines your qi.")
    return msgs


def _with_rival(c, npc, rng):
    msgs = [f"You spar with your rival {npc.name} ({npc.status})."]
    you = c.power * rng.uniform(0.85, 1.2) * (1 + c.luck / 400)
    them = npc.power * rng.uniform(0.85, 1.2)
    if you >= them:
        _adjust(npc, rng.randint(3, 8))  # they grudgingly respect a winner
        c.qi += c.qi_to_next * rng.uniform(0.1, 0.3)
        msgs.append("  You best them. Their respect for you grows, however sourly.")
    else:
        _adjust(npc, rng.randint(-6, -1))
        msgs.append("  They get the better of the exchange and smirk. Galling.")
        c.comprehension = min(160, c.comprehension + 1)
        msgs.append("  Still, the defeat teaches you something. (+1 comprehension)")
    return msgs


def _with_friend(c, npc, rng):
    _adjust(npc, rng.randint(2, 7))
    msgs = [f"You spend the season with your friend {npc.name} ({npc.status})."]
    if npc.affinity > 35 and rng.random() < 0.5:
        gift = rng.randint(3, 12) * (c.realm + 1)
        if rng.random() < 0.4:
            c.pills += 1
            msgs.append("  They press a Qi-Gathering Pill into your hand. (+1 pill)")
        else:
            c.spirit_stones += gift
            msgs.append(f"  They gift you spirit stones. (+{gift})")
    else:
        msgs.append("  Good company, and a few useful rumours of the wider world.")
    return msgs


def _with_companion(c, npc, rng):
    _adjust(npc, rng.randint(3, 8))
    msgs = [f"You pass time with your dao companion {npc.name} ({npc.status})."]
    # Dual cultivation -- harmonised qi accelerates you both.
    boost = c.qi_to_next * rng.uniform(0.4, 0.9) * (1 + npc.affinity / 200)
    c.qi += boost
    msgs.append("  In shared cultivation your qi surges in harmony.")
    if npc.affinity >= 80 and "Dao Companion" not in c.titles:
        c.titles.append("Dao Companion")
        c.note(f"Became dao companions with {npc.name}.")
        msgs.append(f"  ✦ You and {npc.name} pledge to walk the dao together for life.")
    return msgs


def _with_enemy(c, npc, rng):
    msgs = [f"You cross paths with your enemy {npc.name} ({npc.status})."]
    if npc.affinity <= -55 and rng.random() < 0.5:
        # An old grudge boils over into a duel.
        from . import world
        msgs.append("  Old hatred ignites -- blades are drawn!")
        msgs += world.fight(c, rng, enemy=(npc.name, npc.power, (c.realm + 1) * 6))
        if c.alive:
            npc.alive = False
            msgs.append(f"  You settle the grudge with {npc.name} for good.")
    else:
        _adjust(npc, rng.randint(-6, -2))
        msgs.append("  Hard words are exchanged; the enmity festers deeper.")
    return msgs
