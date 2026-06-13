"""The wider world: random adventures, fortunes, encounters and combat.

Exploring the Nine Heavens is where standing and luck really bite -- a low-born
cultivator wanders into more danger and fewer guardians than a clan heir, but
fortune (气运) can overturn any disadvantage.
"""

from __future__ import annotations

import random

from . import data
from .character import Character


# ---------------------------------------------------------------------------
# Combat -- abstracted, fast, lethal.
# ---------------------------------------------------------------------------

def _enemy_for(c: Character, rng: random.Random):
    """Generate a roughly level-appropriate foe (name, power, reward_stones)."""
    beasts = [
        "Iron-Fang Wolf", "Rock-Shell Tortoise", "Cloud Leopard",
        "Venom Spirit Serpent", "Crimson Ape", "Ghost-Faced Spider",
        "Flame Mane Lion", "Abyssal Eel", "Thunder Roc", "Nine-Tailed Fox Spirit",
    ]
    rogues = [
        "Masked Rogue Cultivator", "Demonic Sect Outrider", "Bandit Qi-user",
        "Rival Sect Disciple", "Fallen Immortal's Puppet", "Corpse Refiner",
    ]
    name = rng.choice(beasts + rogues)
    # Foe power scatters around the player's. Truly overwhelming foes are rare,
    # and when they appear you usually get a chance to flee.
    factor = rng.choices([0.5, 0.8, 1.0, 1.3, 1.8],
                         weights=[28, 34, 22, 11, 5])[0]
    power = max(5.0, c.power * factor * rng.uniform(0.85, 1.15))
    reward = int((c.realm + 1) * factor * rng.randint(2, 8))
    return name, power, reward


def fight(c: Character, rng: random.Random, enemy=None) -> list:
    """Resolve a duel. Returns message lines; mutates the character."""
    if enemy is None:
        enemy = _enemy_for(c, rng)
    name, e_power, reward = enemy
    msgs = [f"⚔ A {name} bars your path! (foe power ≈ {int(e_power)}, you ≈ {int(c.power)})"]

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
        # Player strikes.
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

    if c.hp > 0 and e_hp <= 0:
        c.spirit_stones += reward
        c.reputation += 1
        c.hp = max(1.0, c.hp)
        msgs.append(f"  You slay the {name}! (+{reward} spirit stones, +1 reputation)")
        # Rare drops.
        if rng.random() < 0.12 + c.luck / 1000.0:
            drop = rng.choice(["a Qi-Gathering Pill", "a shard of spirit jade",
                               "a tattered technique manual", "a spirit beast core"])
            if "Pill" in drop:
                c.pills += 1
            else:
                c.inventory.append(drop.replace("a ", "").replace("an ", "").title())
            msgs.append(f"  You loot {drop}.")
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


# ---------------------------------------------------------------------------
# Random adventures -- each returns message lines and mutates the character.
# ---------------------------------------------------------------------------

def _ev_spirit_herb(c, rng):
    if rng.random() < 0.5 + c.luck / 400.0:
        gain = rng.randint(1, 3) * (c.realm + 1)
        c.spirit_stones += gain
        c.pills += 1
        return [f"You find a patch of spirit herbs and harvest a pill's worth. "
                f"(+{gain} stones, +1 pill)"]
    return ["You spot a spirit herb, but a beast got there first. Nothing gained."]


def _ev_ruin(c, rng):
    msgs = ["You stumble on the entrance to an ancient ruin, qi humming within."]
    if rng.random() < 0.45 + c.luck / 300.0:
        roll = rng.random()
        if roll < 0.3:
            tech = rng.choice([k for k in data.TECHNIQUES if k not in c.techniques] or ["azure_cloud"])
            if tech not in c.techniques:
                c.techniques.append(tech)
                msgs.append(f"  In a jade slip you find: {data.TECHNIQUES[tech][0]}! "
                            f"({data.TECHNIQUES[tech][4]})")
        elif roll < 0.7:
            gain = rng.randint(10, 40) * (c.realm + 1)
            c.spirit_stones += gain
            msgs.append(f"  A cache of spirit stones! (+{gain})")
        else:
            c.pills += rng.randint(1, 3)
            msgs.append("  A dusty pill bottle, still potent. (+pills)")
    else:
        msgs.append("  ...but it is a guardian's lair. " )
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
    if c.spirit_stones >= 20:
        if rng.random() < 0.5 + c.luck / 500.0:
            c.spirit_stones -= 20
            c.pills += 2
            return ["At a night market you buy two pills cheap. (-20 stones, +2 pills)"]
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
