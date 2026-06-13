# The Nine Heavens · 九重天

A text-based **Chinese cultivation (xianxia) progression-fantasy RPG**, played
entirely in your terminal.

Your story begins at the **moment of birth** — and the heavens roll the dice.
The spiritual root you are born with, the body you inherit, the family that
raises you, and the omens over your cradle are all randomised, and together they
decide whether you start as a peerless genius courted by every great sect or a
nameless slave with the dao slammed shut in your face. From there you cultivate,
adventure, and claw your way up the realms toward the legendary **Nine Heavens**.

```
   ___ _            _  _ _              _  _
  |_   | |_  ___   | \| (_)_ _  ___    | || |___ __ ___ _____ _ _  ___
   / /| ' \/ -_)  | .` | | ' \/ -_)   | __ / -_) _` \ V / -_) ' \(_-<
  /___|_||_\___|  |_|\_|_|_||_\___|   |_||_\___\__,_|\_/\___|_||_/__/
                    九  重  天  ·  修  仙  录
```

## Play

No dependencies beyond Python 3.8+. From the repo root:

```bash
python play.py
# or
python -m nine_heavens

# Re-roll the exact same fate with a seed:
python play.py --seed 1234
```

## The wheel of destiny — randomness at birth

Everything that defines your potential is rolled the instant you are born:

- **Spiritual Root (灵根)** — the single biggest talent factor, from the
  sneered-at *False Five Root* through the *Heavenly* and *Variant* roots up to
  the near-mythical *Chaos Root*. It multiplies every scrap of qi you ever
  absorb. A *Mortal Veins* roll means no spiritual root at all.
- **Physique (体质)** — usually an ordinary body, but rarely a destiny-altering
  constitution like the *Nine-Yang Divine Body* or *Innate Dao Embryo*.
- **Birth Standing (出身)** — from *Bond-Slave* and *Gutter Orphan* to *Noble
  Cultivation Clan* and *Imperial Bloodline*. This sets your starting reputation,
  spirit stones, and heirloom items.
- **Appearance (容貌)** — from *Hideous* through *Comely* and *Peerless Beauty*
  to *Immortal Grace*, rolled at birth and a heavy thumb on the Charm scale.
  A striking face opens doors, sways elders, and draws dao companions.
- **Birth Omen** — auspicious or ill portents that nudge your core attributes.
- **Core attributes** — Comprehension (悟性), Constitution (根骨), Soul Sense
  (神识), Fortune (气运), and Charm (魅力), each rolled on a bell curve and then
  bent by everything above.

The same peerless root born to a slave still has to climb out of the gutter —
**talent and standing are rolled separately**, and Fortune quietly tilts every
later dice-roll in the game.

## The climb — eleven realms to immortality

| # | Realm | 境界 |
|---|-------|------|
| 0 | Mortal | 凡夫 |
| 1 | Body Tempering | 炼体 |
| 2 | Qi Condensation | 炼气 |
| 3 | Foundation Establishment | 筑基 |
| 4 | Golden Core | 金丹 |
| 5 | Nascent Soul | 元婴 |
| 6 | Spirit Severing | 化神 |
| 7 | Void Refinement | 炼虚 |
| 8 | Dao Seeking | 合体 |
| 9 | Mahayana | 大乘 |
| ✦ | Immortal Ascension | 渡劫飞升 |

- **Cultivate** to fill your qi and auto-advance the minor stages of a realm.
- At a realm's peak you hit a **wall** and must deliberately **attempt a
  breakthrough** — risky, occasionally fatal, and from the Golden Core upward it
  summons a nine-wave **Heavenly Tribulation** that can scatter an
  underprepared soul.
- **Wander the world** for spirit herbs, ancient ruins, hidden masters, rogue
  cultivators and spirit beasts — resources and danger in equal measure.
- Each realm extends your **lifespan**; run out of years before you break
  through and you die of old age, mid-climb.

Most cultivators wither at the lower realms — that is the genre. A blessed birth
played with care can reach Mahayana, and only the rarest talent and fortune will
ever **ascend to the Nine Heavens**.

## Sects, ranks, quests & tournaments (option 9)

Walking the dao alone is hard. Pledge yourself to one of the great **sects** —
from the humble *Cloud Mist Sect*, which takes nearly anyone, up to the elite
*Heavenly Sword Sect* and the hunted *Blood Demon Cult*. Better sects demand
rarer spiritual roots and won't test a cultivator below a minimum realm; an
element-matched root impresses an element-aligned sect.

Membership grants:

- a **cultivation-speed bonus** from the sect's spirit arrays,
- a yearly **stipend** of spirit stones,
- a **rank ladder** — Outer → Inner → Core Disciple → Elder → Grand Elder →
  **Sect Master** — climbed by accruing contribution and reaching realm
  thresholds,
- **contribution quests** (tend gardens, hunt beasts, subjugate rogues, clear
  demonic nests, chart secret realms) that pay contribution, stones and
  reputation but can erupt into combat,
- a **sect store** to exchange contribution for pills and the occasional manual,
- the **grand tournament**: a single-elimination bracket of duels where placing
  well brings renown, rewards, a lasting **title**, and sometimes admirers.

## Relationships (option 0)

People drift into your long life and change it. Spend years among them to forge
bonds, each with an affinity that shifts from *Sworn Enemy* to *Inseparable*:

- a **Master** sharpens your insight and passes down techniques,
- a **Rival** drives you to greater heights through sparring,
- **Sworn Friends** bring gifts and useful word of the world,
- a **Dao Companion** doubles your progress through harmonised dual cultivation,
- **Enemies** nurse grudges that may one day end in drawn blades.

Charm and appearance decide who you draw to your side — and joining a sect or
shining in a tournament is the surest way to meet a master, a rival, or a
kindred spirit on the dao.

## Project layout

```
nine_heavens/
  data.py         # all lore tables, weights and progression curves
  character.py    # the cultivator + heavily-randomised birth generation
  cultivation.py  # qi, breakthroughs and the Heavenly Tribulation
  world.py        # adventures, encounters and combat
  sect.py         # sects, ranks, contribution quests and tournaments
  social.py       # relationships: masters, rivals, friends, dao companions
  game.py         # interactive menu loop and rendering
  __main__.py     # `python -m nine_heavens`
play.py           # convenience launcher
tests/            # headless simulation tests
```

## Tests

```bash
python tests/test_game.py      # or: python -m pytest
```

The suite plays hundreds of randomised lives headlessly to guarantee the game
never crashes, the difficulty curve holds, and birth randomness produces a wide
spread of fates.
