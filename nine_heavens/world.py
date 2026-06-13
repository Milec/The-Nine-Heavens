"""The wider world: random adventures, fortunes, encounters and combat.

Exploring the Nine Heavens is where standing and luck really bite -- a low-born
cultivator wanders into more danger and fewer guardians than a clan heir, but
fortune (气运) can overturn any disadvantage.
"""

from __future__ import annotations

import random

from . import artifacts, beasts, data
from .character import Character


BEAST_FOES = [
    "Iron-Fang Wolf", "Rock-Shell Tortoise", "Cloud Leopard",
    "Venom Spirit Serpent", "Crimson Ape", "Ghost-Faced Spider",
    "Flame Mane Lion", "Abyssal Eel", "Thunder Roc", "Nine-Tailed Fox Spirit",
]
ROGUE_FOES = [
    "Masked Rogue Cultivator", "Demonic Sect Outrider", "Bandit Qi-user",
    "Rival Sect Disciple", "Fallen Immortal's Puppet", "Corpse Refiner",
]


# ---------------------------------------------------------------------------
# Combat -- abstracted, fast, lethal.
# ---------------------------------------------------------------------------

def _enemy_for(c: Character, rng: random.Random):
    """Generate a level-appropriate foe (name, power, reward, kind).

    Foes are scaled against your *base* power, so a treasure or beast is a true
    advantage rather than something the world simply matches."""
    kind = "beast" if rng.random() < 0.6 else "rogue"
    name = rng.choice(BEAST_FOES if kind == "beast" else ROGUE_FOES)
    factor = rng.choices([0.5, 0.8, 1.0, 1.3, 1.8],
                         weights=[28, 34, 22, 11, 5])[0]
    power = max(5.0, c.base_power * factor * rng.uniform(0.85, 1.15))
    reward = int((c.realm + 1) * factor * rng.randint(2, 8))
    return name, power, reward, kind


def _normalize_enemy(enemy):
    """Accept 3- or 4-field enemy tuples (older callers pass three)."""
    if len(enemy) == 4:
        return enemy
    name, power, reward = enemy
    return name, power, reward, "rogue"


def fight(c: Character, rng: random.Random, enemy=None) -> list:
    """Resolve a duel. Returns message lines; mutates the character."""
    if enemy is None:
        enemy = _enemy_for(c, rng)
    name, e_power, reward, kind = _normalize_enemy(enemy)
    msgs = [f"⚔ A {name} bars your path! "
            f"(foe power ≈ {int(e_power)}, you ≈ {int(c.power)})"]
    if c.beast_power > 0:
        msgs.append(f"  Your spirit beast {c.beast.name} bares its fangs at your side.")

    # Badly outmatched? Fortune and spirit sense offer an escape.
    if e_power > c.power * 1.45:
        flee_chance = 0.45 + c.luck / 250.0 + c.soul / 400.0
        if rng.random() < flee_chance:
            msgs.append("  Sensing a foe far beyond you, you wisely flee. "
                        "(no spoils, but you live)")
            return msgs
        msgs.append("  It is far stronger than you, and you cannot break away!")

    e_hp = e_power * 1.2
    rounds = 0
    while c.hp > 0 and e_hp > 0 and rounds < 30:
        rounds += 1
        # Player strikes (c.power already includes any beast and treasure).
        crit = rng.random() < (c.luck / 400.0 + 0.05)
        atk = c.power * rng.uniform(0.30, 0.46) * (2.0 if crit else 1.0)
        e_hp -= atk
        if crit:
            msgs.append(f"  ✦ Critical! You hit for {int(atk)}.")
        if e_hp <= 0:
            break
        # Enemy strikes back.
        dodge = rng.random() < (c.luck / 600.0 + c.soul / 800.0)
        if dodge:
            msgs.append("  You flow aside, untouched.")
            continue
        dmg = e_power * rng.uniform(0.09, 0.17)
        c.hp -= dmg
        # A Spirit Healing Pill is gulped down when the tide turns dire.
        if c.hp < c.max_hp * 0.25 and c.healing_pills > 0:
            c.healing_pills -= 1
            c.hp = min(c.max_hp, c.hp + c.max_hp * 0.5)
            msgs.append("  You gulp a Spirit Healing Pill mid-battle and rally.")

    if c.hp > 0 and e_hp <= 0:
        c.spirit_stones += reward
        c.reputation += 1
        c.hp = max(1.0, c.hp)
        msgs.append(f"  You slay the {name}! (+{reward} spirit stones, +1 reputation)")
        # Felling a devil or rogue earns merit; slaughtering beasts does not.
        if kind == "rogue" and ("Demonic" in name or "Corpse" in name
                                or "Bandit" in name or rng.random() < 0.5):
            c.karma += 2
        # Rare loot: a treasure, a pill, herbs or a manual.
        if rng.random() < 0.14 + c.luck / 900.0:
            msgs += _loot(c, rng)
        # A bested wild beast may be tamed into a companion.
        if kind == "beast" and c.beast is None:
            msgs += beasts.try_tame(c, name, e_power, rng)
    elif c.hp <= 0:
        # Death save from sheer fortune.
        if rng.random() < c.luck / 300.0:
            c.hp = c.max_hp * 0.15
            msgs.append("  At death's door, blind luck lets you escape with your life!")
        else:
            c.alive = False
            c.cause_of_death = f"slain by a {name}"
            msgs.append(f"  ☠ The {name} strikes you down. Your journey ends here.")
            c.note(f"Killed by a {name}.")
    else:
        msgs.append("  Neither can fell the other; you disengage, breathing hard.")
    c.recompute_max_hp()
    return msgs


def _loot(c: Character, rng: random.Random) -> list:
    roll = rng.random()
    if roll < 0.22:
        key = artifacts.random_artifact(c, rng)
        return artifacts.acquire(c, key)
    if roll < 0.5:
        n = rng.randint(2, 5)
        c.herbs += n
        return [f"  You gather {n} spirit herbs from the corpse's lair."]
    if roll < 0.75:
        c.pills += 1
        return ["  You loot a Qi-Gathering Pill."]
    c.inventory.append("Spirit Jade Shard")
    return ["  You loot a shard of spirit jade."]


# ---------------------------------------------------------------------------
# Random adventures -- each returns message lines and mutates the character.
# ---------------------------------------------------------------------------

def _ev_spirit_herb(c, rng):
    if rng.random() < 0.5 + c.luck / 400.0:
        herbs = rng.randint(2, 5) + c.realm
        stones = rng.randint(1, 3) * (c.realm + 1)
        c.herbs += herbs
        c.spirit_stones += stones
        return [f"You find a patch of spirit herbs and harvest a full basket. "
                f"(+{herbs} herbs, +{stones} stones)"]
    return ["You spot a spirit herb, but a beast got there first. Nothing gained."]


def _ev_ruin(c, rng):
    msgs = ["You stumble on the entrance to an ancient ruin, qi humming within."]
    if rng.random() < 0.45 + c.luck / 300.0:
        roll = rng.random()
        if roll < 0.25:
            tech = rng.choice([k for k in data.TECHNIQUES if k not in c.techniques] or ["azure_cloud"])
            if tech not in c.techniques:
                c.techniques.append(tech)
                msgs.append(f"  In a jade slip you find: {data.TECHNIQUES[tech][0]}! "
                            f"({data.TECHNIQUES[tech][4]})")
        elif roll < 0.45:
            # A slumbering treasure in the ruin's heart.
            key = artifacts.random_artifact(c, rng)
            msgs += artifacts.acquire(c, key)
        elif roll < 0.75:
            gain = rng.randint(10, 40) * (c.realm + 1)
            c.spirit_stones += gain
            msgs.append(f"  A cache of spirit stones! (+{gain})")
        else:
            c.pills += rng.randint(1, 3)
            c.herbs += rng.randint(2, 6)
            msgs.append("  A dusty pill bottle and a bundle of dried herbs, still potent.")
    else:
        msgs.append("  ...but it is a guardian's lair. ")
        msgs += fight(c, rng)
    return msgs


def _ev_master(c, rng):
    if c.realm <= 2 and rng.random() < 0.4 + c.charm / 400.0:
        boost = rng.randint(4, 10)
        c.comprehension = min(160, c.comprehension + boost)
        c.reputation += 5
        return [f"A wandering senior takes a liking to you and imparts pointers. "
                f"(+{boost} comprehension, +5 reputation)"]
    return ["A reclusive senior eyes you, then walks on without a word."]

def _ev_robbery(c, rng):
    if c.spirit_stones > 0 and rng.random() > c.luck / 250.0:
        lost = max(1, int(c.spirit_stones * rng.uniform(0.2, 0.6)))
        c.spirit_stones -= lost
        return [f"Bandits ambush you on the road and rob you of {lost} spirit stones."]
    return ["Bandits move to ambush you -- but think better of it and flee."]


def _ev_auction(c, rng):
    # Occasionally a real treasure comes under the hammer.
    treasure_cost = 60 * (c.realm + 1)
    if rng.random() < 0.3 and c.spirit_stones >= treasure_cost:
        c.spirit_stones -= treasure_cost
        key = artifacts.random_artifact(c, rng)
        return [f"A treasure auction! You win the bidding for {treasure_cost} stones."] \
            + artifacts.acquire(c, key)
    if c.spirit_stones >= 20:
        if rng.random() < 0.5 + c.luck / 500.0:
            c.spirit_stones -= 20
            c.pills += 2
            c.herbs += rng.randint(1, 4)
            return ["At a night market you buy pills and herbs cheap. (-20 stones)"]
        return ["The night market's prices are robbery. You buy nothing."]
    return ["You pass a bustling cultivator market but cannot afford a thing."]


def _ev_insight(c, rng):
    if rng.random() < 0.4 + c.comprehension / 400.0:
        c.qi += c.qi_to_next * rng.uniform(0.2, 0.6)
        return ["Watching a waterfall, you grasp a sliver of the dao. Your qi surges."]
    return ["You meditate by a waterfall, but enlightenment does not come today."]


def _ev_nothing(c, rng):
    flavour = rng.choice([
        "You travel for days through quiet mountains. Nothing of note occurs.",
        "Rain keeps you sheltered in a cave; you cultivate a little.",
        "You trade rumours with travellers at a roadside inn.",
        "A flock of spirit cranes passes overhead, and is gone.",
    ])
    c.qi += c.cultivation_speed * 0.5
    return [flavour]


ADVENTURES = [
    (_ev_spirit_herb, 18),
    (_ev_ruin, 12),
    (_ev_master, 8),
    (_ev_robbery, 12),
    (_ev_auction, 10),
    (_ev_insight, 12),
    (lambda c, rng: ["You are set upon in the wilds!"] + fight(c, rng), 16),
    (_ev_nothing, 12),
]


def adventure(c: Character, rng: random.Random) -> list:
    """Run one random adventure event. Costs one year."""
    if not c.alive:
        return ["You are dead."]
    c.age += 1
    funcs = [a[0] for a in ADVENTURES]
    weights = [a[1] for a in ADVENTURES]
    # Fortune subtly tilts you toward the better events.
    ev = rng.choices(funcs, weights=weights, k=1)[0]
    msgs = ev(c, rng)
    if c.age > c.max_age and c.alive:
        c.alive = False
        c.cause_of_death = "old age on the road"
        msgs.append(f"☠ Your lifespan runs out at {c.age}. The road claims you at last.")
    return msgs
