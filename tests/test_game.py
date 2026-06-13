"""Smoke and invariant tests for The Nine Heavens.

These run the simulation headlessly over many randomised lives to ensure the
game never crashes, the progression curve behaves, and birth randomness
actually produces a wide spread of fates. Run with: `python -m pytest` or
`python tests/test_game.py`.
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nine_heavens import cultivation, data, sect, social, world  # noqa: E402
from nine_heavens.character import generate_character  # noqa: E402
from nine_heavens.game import render_sheet  # noqa: E402


def _auto_life(seed, adventure_rate=0.2, max_turns=3000):
    """Play one life automatically and return the finished character."""
    rng = random.Random(seed)
    c = generate_character(rng)
    turns = 0
    while c.alive and c.realm < len(data.REALMS) - 1 and turns < max_turns:
        turns += 1
        if cultivation.can_breakthrough(c):
            cultivation.attempt_breakthrough(c, rng)
        elif rng.random() < adventure_rate:
            world.adventure(c, rng)
        else:
            cultivation.cultivate(c, rng, years=1,
                                  use_pill=(c.pills > 0 and rng.random() < 0.4))
    return c


def test_birth_is_well_formed():
    """Every birth produces valid, in-range attributes and state."""
    for seed in range(500):
        c = generate_character(random.Random(seed))
        assert c.root is not None
        assert 1 <= c.comprehension <= 160
        assert 1 <= c.constitution <= 160
        assert 1 <= c.soul <= 160
        assert 1 <= c.luck <= 160
        assert c.max_hp > 0 and c.hp > 0
        assert c.realm == 0 and c.stage == 0
        # The sheet must always render without error.
        assert c.name in render_sheet(c)


def test_no_crashes_over_many_lives():
    """A few hundred full auto-played lives must never raise."""
    for seed in range(300):
        c = _auto_life(seed)
        assert c.age >= 0
        assert 0 <= c.realm < len(data.REALMS)
        # A dead character must carry a cause of death.
        if not c.alive:
            assert c.cause_of_death


def test_birth_randomness_spreads_fates():
    """Birth rolls should yield meaningfully different roots and outcomes."""
    roots = set()
    realms_reached = set()
    for seed in range(400):
        c = generate_character(random.Random(seed))
        roots.add(c.root.key)
        realms_reached.add(_auto_life(seed).realm)
    # We expect a real variety of starting talent...
    assert len(roots) >= 5
    # ...and a real spread of final attainment.
    assert len(realms_reached) >= 3


def test_talent_matters():
    """On average, better spiritual roots should out-cultivate worse ones."""
    def avg_realm_for(root_key, sample=60):
        reached, found, seed = [], 0, 0
        while found < sample and seed < 100000:
            c = generate_character(random.Random(seed))
            seed += 1
            if c.root.key != root_key:
                continue
            found += 1
            reached.append(_auto_life(seed, adventure_rate=0.0).realm)
        return sum(reached) / len(reached)

    waste = avg_realm_for("waste")
    heavenly = avg_realm_for("heavenly")
    assert heavenly > waste, (heavenly, waste)


def test_breakthrough_chance_bounded():
    """Breakthrough probability must always stay a sane probability."""
    for seed in range(200):
        c = generate_character(random.Random(seed))
        c.stage = c.realm_stages - 1
        c.qi = c.qi_to_next
        p = cultivation.breakthrough_chance(c)
        assert 0.0 <= p <= 1.0


def test_appearance_rolled_and_affects_charm():
    """Every birth has a valid appearance, and looks correlate with charm."""
    keys = set()
    homely, lovely = [], []
    for seed in range(600):
        c = generate_character(random.Random(seed))
        assert c.appearance_key in {a[0] for a in data.APPEARANCES}
        keys.add(c.appearance_key)
        if c.appearance_key in ("hideous", "plain"):
            homely.append(c.charm)
        if c.appearance_key in ("striking", "peerless", "immortal"):
            lovely.append(c.charm)
    assert len(keys) >= 4
    if homely and lovely:
        assert sum(lovely) / len(lovely) > sum(homely) / len(homely)


def test_sect_join_rank_quest_tournament():
    """Exercise the full sect lifecycle without crashing or going invalid."""
    rng = random.Random(1)
    c = generate_character(rng)
    c.realm, c.stage = 3, 2
    c.root.key = "heavenly"
    c.root.multiplier = 2.6
    c.recompute_max_hp()
    c.hp = c.max_hp

    # Joining must succeed eventually for a high realm + good root.
    for s in data.SECTS:
        if sect.join_chance(c, s) > 0:
            sect.attempt_join(c, rng, s[0])
            if c.sect_key:
                break
    assert c.sect_key is not None
    assert c.sect_speed_bonus > 0

    # Quests award contribution and never produce a negative balance.
    quests = sect.available_quests(c)
    assert quests
    for _ in range(10):
        if not c.alive:
            break
        sect.do_quest(c, rng, quests[0])
    assert c.contribution >= 0

    # Promotion respects requirements.
    c.contribution = 100000
    c.realm = 8
    before = c.sect_rank
    sect.attempt_promotion(c, rng)
    assert c.sect_rank == before + 1

    # Tournament resolves and bestows valid rewards.
    c.hp = c.max_hp
    sect.tournament(c, rng)
    assert c.contribution >= 0


def test_relationships_form_and_interact():
    """Socialising creates NPCs and interacting stays within affinity bounds."""
    rng = random.Random(5)
    c = generate_character(rng)
    c.realm = 2
    for _ in range(20):
        if not c.alive:
            break
        social.socialize(c, rng)
    for n in c.relationships:
        assert -100 <= n.affinity <= 100
        assert n.role in data.ROLE_LABEL
        assert n.status  # label always resolves
    # Sheet must render with bonds present.
    assert isinstance(render_sheet(c), str)


if __name__ == "__main__":
    test_birth_is_well_formed()
    test_no_crashes_over_many_lives()
    test_birth_randomness_spreads_fates()
    test_talent_matters()
    test_breakthrough_chance_bounded()
    test_appearance_rolled_and_affects_charm()
    test_sect_join_rank_quest_tournament()
    test_relationships_form_and_interact()
    print("All tests passed.")
