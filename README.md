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

### On your phone (iOS & Android) — no install required

The Nine Heavens ships as a **mobile-first web app (PWA)** in [`web/`](web/): a
self-contained, **BitLife-style xianxia life-sim** in vanilla JavaScript with a
touch interface, offline support, and automatic save. It runs in any modern
mobile browser and can be **added to your home screen** to play like a native app.

You are **born into a family** and live your cultivator's life **one year at a
time**: tap **Age Up** and narrative events unfold — childhood, the **Spiritual
Root Awakening** at age 6 that reveals your talent, sect recruiters, duels,
ruins, romance, demonic temptations, betrayals, and loss — many with **choices
that shape your fate**. Within each year you may perform a few **deeds** — use
the tabs to **Cultivate** (seclusion, breakthroughs, the Dao), tend
**Relationships** (family, masters, rivals, dao companions, even children of
your own), pursue **Activities** (train, study, rest, alchemy, adventure), and
climb your **Sect**. Only **Age Up** passes a year and fires events; it also
refreshes your deeds, so there's no rush — do what you can, then live another year. Two new vital stats —
**Health** and **Happiness** — rise and fall with your choices and steady (or
shake) your breakthroughs. Die, and your soul may **reincarnate** into a fresh
life carrying its hard-won legacy.

- **Hosted:** enable GitHub Pages for this repo (Settings → Pages → deploy from
  the default branch, root folder). The root [`index.html`](index.html)
  redirects to the game at `/web/`. Open the Pages URL on your phone, then:
  - **iOS (Safari):** Share → *Add to Home Screen*.
  - **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home Screen*.
  Once added it works **offline**.
- **Locally / over your home Wi-Fi:** serve the folder and open it on your phone
  using your computer's LAN IP:
  ```bash
  cd web && python3 -m http.server 8000
  # then on your phone visit  http://<your-computer-ip>:8000
  ```
  (Serving over HTTP is required — ES modules don't load from `file://`.)

Combat is a **turn-based minigame**: your learned **techniques become usable
skills** (Azure Cloud Palm, Nine-Yang Burst with a burn DoT, Blood Spike that
lifesteals but stains your karma, the defense-piercing Great Void Rend…), spent
from a **qi pool** you must manage. Your **spiritual-root element** drives a Wu
Xing advantage/weakness cycle — and **attunes** you: arts of your own element(s)
strike harder (the purer the root, the bigger the bonus) and you resist that
element in turn. Your **full equipment loadout** — a treasure bound into each of
**six slots** (weapon, magic treasure, robe, headpiece, boots, ring) — and your
**tamed beast** join the fight, their bonuses stacking into power, defense,
battle HP, dodge, crit, lifesteal and qi. Stats decide crits, dodges and
shields. Enemies wield their own
**signature moves and elements** (a Demonic Outrider drains your blood; a
Flame-Mane Lion sets you ablaze). Pick fights via **Wander the World**, **Hunt
Spirit Beasts** (tameable), the non-lethal **Arena**, **dueling** a rival, or by
seeking a **boss** — a fearsome named cultivator that enrages near death and
always drops a treasure. And from the Golden Core up, every **breakthrough
summons an interactive Heavenly Tribulation**: a survival battle against
escalating lightning you must endure with shields, heals and nerve.

Your techniques have **mastery** that deepens every time you use them in battle
(or drill them) — Untrained → Novice → … → Perfected — raising their power, so a
favoured art grows with you. And early in life a **destined nemesis (宿敌)** is
born: an arrogant rival who taunts, ambushes and **cultivates in lockstep with
you** across the years, until you finally hunt them down for a climactic boss
showdown — the classic xianxia grudge, paid in full.

The sect **Grand Tournament** is a four-round gauntlet of **interactive duels**
against rival disciples, capped by a fight with the **Reigning Champion**, for
contribution, renown, titles and a shot at catching an admirer's eye. Beyond the
orthodox arts you can learn techniques with distinct combat mechanics — a
**multi-hit** sword storm, a **reflecting parry** that turns a blow back on the
foe, a **binding seal** that weakens and may stun, and a **recoil ultimate** that
hits like a mountain but leaves you spent.

You can also **delve a Secret Realm (秘境)**: a multi-stage expedition of
escalating battles and fortune-rooms where **wounds carry between fights**.
Each delve is one of eight **themed archetypes** — the **Ancient Sword Tomb**,
**Sunken Naga Palace**, **Demon-Sealing Abyss**, **Frostmere Immortal Cave**,
**Volcanic Pill-Furnace Ruins**, **Skyhigh Thunder Pagoda**, **Verdant Spirit
Garden** or **Earthen God-Treasury** — each lending its **element**, the
**mist-wreathed foes** that haunt it, the **fortune-rooms it favours** (a sword
tomb hoards treasure, a garden teems with herbs, a furnace caches pills…), and
a **thematically-named guardian**. Between stages a **signature hazard** may
strike — a corridor of flying swords, soul-rending miasma (worse for the
sin-heavy), heaven's judging lightning, collapsing vaults — wounds that carry
forward but never kill outright (a steady soul and fortune help you slip them,
and some hide a boon). After each cleared stage you choose to **press deeper**
for richer spoils or **withdraw** with what you hold — and the realm's
**Guardian** waits at the heart, hoarding a **guaranteed themed relic** (richer
the deeper you dared) for those bold or greedy enough to reach it.

Three more systems round out a cultivator's life:

- **Romance, marriage & family (道侣)** — meet potential loves by mingling or at
  gatherings, **court** them with sweet words until their heart is yours, then
  **propose and wed** them as your dao companion. Take **more than one** — a full
  xianxia **harem** of up to six spouses (with jealousy to manage, or harmony to
  cherish). **Try for children** with any spouse: sons and daughters who carry
  your bloodline, take your surname, awaken their own roots, learn your arts, and
  — through reincarnation — sharpen the soul of your next life. And when you die,
  you may **play on as your grown heir** — a true bloodline succession that
  **inherits the family estate, a share of the fortune, and the very sect your
  forebear founded** — carrying the dynasty across the generations.
- **Lineage (传承)** — at the Golden Core you may **take disciples**, and **teach
  your techniques** to disciples, children and your dao companion. Your students
  carry your arts onward, and the teaching **echoes across reincarnation**,
  sharpening the talent of your next life. Tend them deeply: **impart cultivation
  insight**, **send them on trial missions**, **bestow a treasure**, or spar — and
  with **your own master**, ask to be taught an art, seek their guidance, beg a
  parting gift, or test yourself against them.
- **Market (坊市)** — a proper trading bazaar: **buy** spirit herbs, finished pills,
  technique manuals and magic treasures, and **sell** your spare herbs and surplus
  treasures. Prices **float with the world era** — dear in a Spiritual Drought,
  cheap in an Age of Abundance — so spirit stones finally have somewhere to go.
- **Equipment & inventory (装备)** — your treasure trove is no longer a single
  bound artifact but a **full loadout across six slots** — **weapon (兵器)**,
  **magic treasure (法宝)**, **robe (法袍)**, **headpiece (宝冠)**, **boots (灵靴)**
  and **ring (戒指)**. Each slot has its own deep family of treasures (**70+ in
  all**, every slot stocked at every grade) from crude *Mortal* gear to
  world-shaking *Immortal* relics, each with **distinct effects**
  — raw power, defense, battle HP, dodge, crit, passive lifesteal, faster
  cultivation and a deeper qi pool — and their bonuses **stack across the whole
  set**. Find them in ruins, win them at auction or loot them from fallen foes;
  the strongest find for an empty slot **auto-equips**, and you can freely
  re-bind, unbind or sell spares from the **Equipment & Beast** screen. Tap any
  treasure for its card, where you can **refine it (祭炼)** — feed spirit stones
  into its spirit-fire to temper it up to **+6**, each level raising *all* of its
  effects, with a success chance that falls as the treasure resists and rises
  with a steady soul, fortune and alchemical skill (a refined treasure also fetches
  a richer price). Matched treasures also form **equipment sets (套装)** — bind, say,
  the whole **Samsara Immortal Dao** (wheel-disk, true-spirit ring and dao diadem)
  or **Nirvana Phoenix Regalia** and earn **escalating set bonuses** stacked on top
  of each piece's own effects. Many treasures also carry an **elemental affinity
  (五行/灵属性)**: equipping them **attunes** you to that element, so your matching-element
  arts strike harder and you resist that element in turn — and because a themed set
  shares one element (Five-Thunder → Lightning, Vermilion Blood Path → Dark), a full
  loadout deepens a single attunement, even granting one to a rootless body-cultivator.
  Drops are **themed (主题掉落)**, too: a slain foe yields a treasure of **its own
  element**, each **region** favours its character (the Frost Peaks give Ice, the
  Demon-Haunted Wastes give Dark, the orthodox heartlands give Metal…), and a
  **Secret Realm** drops gear matching the realm's own attunement — so *where* and
  *whom* you hunt shapes *what* you find. Your heir inherits your loadout, refinement
  and all, and a reborn soul may carry one signature treasure across the wheel.
- **Talismans (符箓)** — one-use paper charms inscribed with spirit-script: loose a
  **Flame-Burst, Thunderbolt or Flying-Sword** for a no-qi damage burst, raise a
  **Golden-Bell** shield, **mend** your wounds, **bind** a foe in place, or tear
  space with an **Escape** talisman to flee any fight. **Buy** them at the Market
  or **inscribe** your own (costs herbs; Soul Sense steadies the brush); they
  appear as extra actions in the combat menu.
- **Alchemy furnace minigame (炼丹)** — refining is now hands-on: keep the heat
  needle inside a drifting jade band over several phases to build **pill
  quality** (Crude → Fine → Flawless, scaling the effect) while avoiding the
  instability that blows up your furnace. Soul, comprehension and skill widen
  your margin for error.
- **World standing (声望)** — your name climbs from *Unknown* to *Legendary* (or
  sinks to *Notorious*). Fame draws **sect invitations, grand banquets and
  admirers' gifts**; infamy and heavy sin mark you **Wanted**, summoning bounty
  hunters and slamming doors in your face.
- **World Eras (天时)** — the realm turns through long ages that colour every
  life: an **Age of Abundance** (qi flows thick, cultivation flourishes), a
  **Warring Era** and **Demon Tide** (the world grows far deadlier, with their own
  perils and temptations), a **Spiritual Drought** (every breakthrough dearly
  bought), and a rare **Dawn of Ascension** (the heavens ease your breakthroughs).
  An era shifts the global pace of cultivation, the danger of the roads, and
  which fates befall you — and the world keeps turning across your reincarnations.
- **Regions of the world (地域)** — **travel** from the gentle Azure Heartlands to
  the Demon-Haunted Wastes and the Starfall Frontier; the deeper you roam, the
  **deadlier the foes and the richer the spoils** of every wander, hunt, boss and
  Secret Realm.
- **Body Cultivation (炼体)** — a path **parallel to qi**, and the **salvation of the
  rootless**: temper your flesh through eight body realms (Mortal Body → Iron Body
  → Steel Bone → … → **Indestructible God-Body**) for raw power, battle stamina,
  damage-reduction and **vastly extended life** — no spiritual root required. It
  stacks atop qi cultivation for those who walk both roads, and is driven by
  **Constitution and physique** rather than your root, so **your physique is your
  ceiling**: an ordinary frame tops out at Silver Marrow, while only the legendary
  **Undying Golden Body** can ever forge a true God-Body. A rootless child the
  heavens spurned can still temper themselves into a power immortals must respect.
- **Allies at your side** — bonds aren't only sentiment: the dao companion or
  disciple who **lives with you** (and your spirit beast) **fights alongside you**
  each round in battle, the harder the deeper your bond — though a Heavenly
  Tribulation you must still face alone.
- **Spirit beast companions (灵兽)** — tame a wild beast, then **raise it**: feed it
  herbs and pills to build its **bond and experience**, and **evolve it through five
  ranks** (Mortal → Spirit → Earth → Heaven → **Mythic Beast**) into ever mightier
  forms. Each beast has an **innate element**, so in battle its every-round assist
  lands with Wu Xing advantage — and from the Earth-Beast rank up it inflicts its
  own **elemental bite** (burn, freeze, bleed…). A beast also **forages at your
  abode**, better the higher its rank.
- **Multi-phase bosses** — boss-tier foes (named cultivators, realm guardians, the
  tournament champion, your nemesis) **enter a second phase at half health** and
  **telegraph a devastating element-themed ultimate** — guard, heal, or be
  shattered when it lands.
- **The great Daos (大道)** — from Nascent Soul, **meditate** to comprehend the
  Laws of heaven, then **deepen each through four tiers (初窥·小成·大成·圆满)**,
  steering your insight toward a favoured Law or out across many. Every tier
  scales the Law's power and breakthrough bonuses, and **from Great Mastery up a
  Dao manifests in your fights** — killing intent that cows and bleeds the foe,
  a void-edge that pierces armour, life-force that swells your battle vigour, a
  sword-heart that sharpens your crits. A **Daos 道之境界** screen shows each Law's
  tier, bonuses and battle manifestation, and lets you set your meditation focus.
- **A living world of cultivators** — every NPC (family, friends, rivals, masters,
  disciples, dao companions) is a **full cultivator** with their own root, physique,
  realm and techniques; they **advance along their own road** (capped by their
  talent), **age and die** by a realm-given lifespan (mortals wither, immortals
  endure), and **fight you with their actual arts**. The **Heaven Board (天骄榜)**
  ranks the era's young geniuses by power — see where you stand and **challenge
  rivals above you** to climb the roll of heaven's pride.
- **Cave Abode (洞府)** — **stake a claim on a spirit vein** and raise a personal
  home base, from a Humble Cave Dwelling all the way to a legendary **Cave
  Heaven**. The abode is the **hub that ties the world together**: it is **rooted
  in the region** where you raise it (wilder lands yield richer veins — but draw
  **raiders** you must fight off), your **dao companion and disciples can live
  there** (disciples tend the fields and grow in its dense qi; a companion makes
  seclusion *dual cultivation*), your **spirit beast forages and guards** it, and
  from the Spirit-Gathering tier up a **pill room steadies your alchemy furnace**.
  Each year it **yields herbs and stones** and **quickens your cultivation**, and
  you can **seal yourself in for a deep seclusion** — a home that grows with you.
- **Found your own sect (开宗立派)** — once you are a recognized power (Nascent
  Soul) with a worthy abode for a seat, **raise your own banner**. Name your sect;
  it gathers **members and prestige** over the years (Fledgling Sect → … → **Holy
  Land**), **spreads your fame**, **quickens your dao**, and pays a **stipend** from
  its treasury. Your **abode is its mountain seat** — a grander abode houses more
  disciples — **resident disciples become your founding core**, and when raiders
  come, your **whole sect rushes to its defense**. A thriving sect even **outlives
  you**: it endures under a steward disciple, and your **reincarnated soul can
  return to reclaim it** — its prestige and disciples a lifetime's head-start —
  or watch it slowly fade across the generations if you never come back.
- **Ascension to the Nine Heavens (飞升)** — the rarest end of the whole climb.
  Survive the final tribulation into **Immortal Ascension** and a Heavenly Gate
  opens: a triumphant capstone where you may **step through in glory** (a victory
  ending that carries on through your legacy) or **linger** among mortals a while
  longer. Every Ascension echoes down the ages, gifting **all your future souls**
  greater talent — the ultimate prize of the meta-game.
- **Achievements & Legacy** — feats persist across **every reincarnation and new
  soul**. Each achievement earns **Heavenly Favor** that blesses the innate
  Comprehension and Fortune of all your future lives — true meta-progression.

Under the hood it reuses the same cultivation engine and balance as the Python
version (the eleven realms, sects, alchemy, treasures, spirit beasts, Daos,
karma, tribulations and reincarnation) and wraps it in a life-sim layer of
family, life stages, vitals, 95+ branching life events and interactive combat.

### In a terminal (desktop)

The original text version needs nothing beyond Python 3.8+. From the repo root:

```bash
python play.py
# or
python -m nine_heavens

# Re-roll the exact same fate with a seed:
python play.py --seed 1234
```

## The wheel of destiny — randomness at birth

At the start you can **🎲 Roll a Soul** for a fully random birth (the classic
mode, where your spiritual root stays a mystery until the age-6 Awakening), or
**✎ Create Your Soul** to hand-pick any of the birth traits below — spiritual
root, physique, appearance, standing, omen, name and sex — leaving any of them
on *Random*, with a live preview and a reroll for the attributes.

Everything that defines your potential is rolled the instant you are born:

- **Spiritual Root (灵根)** — the single biggest talent factor, from the
  sneered-at *False Five Root* through the *Heavenly* and *Variant* roots up to
  the near-mythical *Chaos Root*. It multiplies every scrap of qi you ever
  absorb. A *Mortal Veins* roll means no spiritual root at all.
- **Physique (体质)** — usually an ordinary body, but rarely a destiny-altering
  constitution like the *Nine-Yang Divine Body* (faster cultivation, immune to
  burning, lethal to demons) or the *Innate Dao Embryo* (much faster cultivation
  and Dao insight, easier breakthroughs). Special physiques grant **lasting
  bonuses** to cultivation, combat, healing or survival — not just birth stats.
  Tap any stat (or the **ⓘ Glossary** in your character sheet) to learn what it does.
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

## Alchemy, treasures & spirit beasts

- **Alchemy (炼丹, option a)** — gather **spirit herbs** in the wild and refine
  them at the pill furnace. Success rides on your Soul Sense, Comprehension and
  growing alchemy skill. Brew qi, healing and breakthrough pills, permanent
  body/soul tonics, and the prized **Nine-Turn Longevity Pill** that adds
  precious years to your lifespan.
- **Magic treasures (法宝, option t)** — bind your strongest artifact, graded
  from crude *Mortal* tools to world-shaking *Immortal* relics, for a flat boost
  to combat power and cultivation speed. Found in ruins, won at auction, or
  looted from fallen foes.
- **Spirit beasts (灵宠)** — best a wild beast while wandering and you may tame
  it into a companion that fights at your side and grows ever stronger as you
  cultivate.

Crucially, enemies, tournament rivals and tribulation bolts are scaled against
your **base** strength, so treasures, Daos and beasts grant a *real* edge over
your peers instead of being matched away.

## Daos, karma & the heart demon

- **Dao comprehension (法则·大道, option d)** — from **Nascent Soul** upward,
  meditate to grasp the great Laws — Sword, Flame, Space, Time, Vitality,
  Slaughter, Karma, the Void and more — each permanently magnifying your power and
  smoothing every breakthrough. A grasped Law is not static: it **deepens through
  four tiers of insight** — *Glimpsed → Minor Mastery → Great Mastery →
  Consummation* (初窥·小成·大成·圆满) — and you **choose where to focus your
  meditation**, racing to deepen a favoured Law or spreading wide to seek new
  ones. Each tier scales the Law's bonuses, and **from Great Mastery upward it
  manifests in battle** — the Dao of Slaughter's killing intent cows the foe, the
  Void's edge pierces armour, Vitality's life-force swells your battle vigour, the
  Sword's heart sharpens your crits. They are the true road to ascension.
- **Karma (业力)** — slaying devils and rogues earns merit; demonic paths and
  cruelty stain your soul. Merit softens the Heavenly Tribulation (the heavens
  favour the virtuous), while a blood-soaked cultivator must also overcome the
  **heart demon (心魔)** that rises mid-breakthrough to devour the unprepared.

## Reincarnation (转世重生)

Death need not be the end. When your thread is cut, your soul may **reincarnate**
— reborn into a fresh, fully re-rolled life that carries a dim **legacy** of the
last: sharpened innate talent, a head start of insight, residual karma, and, for
a truly attained soul, even a single treasure smuggled across the wheel of
rebirth. Each saga can climb higher than the last.

## Project layout

```
nine_heavens/
  data.py         # all lore tables, weights and progression curves
  character.py    # the cultivator + heavily-randomised birth generation
  cultivation.py  # qi, breakthroughs and the Heavenly Tribulation
  world.py        # adventures, encounters and combat
  sect.py         # sects, ranks, contribution quests and tournaments
  social.py       # relationships: masters, rivals, friends, dao companions
  alchemy.py      # refining spirit herbs into pills
  artifacts.py    # magic treasures: grades, acquisition and binding
  beasts.py       # taming and growing spirit beast companions
  dao.py          # comprehending the great Daos / Laws
  game.py         # interactive menu loop and rendering
  __main__.py     # `python -m nine_heavens`
play.py           # convenience launcher (terminal)
tests/            # headless simulation tests
index.html        # root redirect to the web app (for GitHub Pages)
web/              # mobile-first PWA port (iOS & Android)
  index.html      # app shell           manifest.webmanifest  # PWA manifest
  style.css       # mobile-first theme   sw.js               # offline service worker
  data.js         # data tables (mirror of data.py) + life-sim tables
  engine.js       # cultivation engine (port of the Python package)
  events.js       # branching year-by-year life events
  life.js         # family, vitals, awakening, the "age up" loop, activities
  combat.js       # turn-based combat minigame (technique skills, elements)
  ui.js           # BitLife-style tabbed touch UI, event modals, save/resume
  icons/          # generated app icons (+ generate_icons.py)
```

## Tests

```bash
python tests/test_game.py      # the terminal/Python build  (or: python -m pytest)
node   tests/test_web.mjs       # the mobile web (PWA) build  (Node 18+)
```

Both suites play hundreds of randomised lives headlessly to guarantee the game
never crashes, the difficulty curve holds, and birth randomness produces a wide
spread of fates. The web suite additionally asserts that **age-appropriate
gating holds at the model layer** — a minor can never stumble into a romance,
wed, or bear a child, however the action is reached — and that the large systems
(combat, cultivation, alchemy, Dao, treasures, reincarnation) interlock without
crashing. Minimum ages for every endeavour live in one shared table
(`web/data.js` → `AGE_MIN`), read by both the interface and the rules engine.
