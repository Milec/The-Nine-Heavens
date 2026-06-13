"""Static game data for The Nine Heavens.

All of the lore tables, randomness weights and progression curves live here so
that the rest of the game logic stays readable. Nothing in this module has side
effects -- it is pure data plus a couple of small lookup helpers.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Cultivation realms -- the spine of the whole game.
#
# A character climbs from a frail mortal toward the Nine Heavens. Each realm has
# several stages, and every realm dramatically increases power, lifespan and the
# danger of the Heavenly Tribulation that guards the next threshold.
# ---------------------------------------------------------------------------

# Each realm: (name, chinese, stages, lifespan, qi_per_stage, breakthrough_difficulty)
#   stages              -> number of minor stages within the realm
#   lifespan            -> maximum age attainable once you reach this realm
#   qi_per_stage        -> base qi needed to fill one stage at this realm
#   breakthrough_diff   -> base chance modifier for crossing into the realm
REALMS = [
    ("Mortal",                "凡夫",   1,   80,      10,   1.00),
    ("Body Tempering",        "炼体",   9,  180,      40,   0.95),
    ("Qi Condensation",       "炼气",  13,  300,     120,   0.85),
    ("Foundation Establishment", "筑基", 4,  600,     500,   0.55),
    ("Golden Core",           "金丹",   9,  800,    2200,   0.40),
    ("Nascent Soul",          "元婴",   9, 2000,    9000,   0.28),
    ("Spirit Severing",       "化神",   9, 5000,   38000,   0.20),
    ("Void Refinement",       "炼虚",   9, 12000, 160000,   0.14),
    ("Dao Seeking",           "合体",   9, 30000, 700000,   0.09),
    ("Mahayana",              "大乘",   9, 100000, 3200000, 0.05),
    ("Immortal Ascension",    "渡劫飞升", 1, 10**9, 10**8,  0.02),
]

REALM_NAMES = [r[0] for r in REALMS]

STAGE_NAMES = [
    "Early", "1st", "2nd", "3rd", "4th", "5th",
    "6th", "7th", "8th", "Peak",
]


def stage_label(stage: int, total_stages: int) -> str:
    """Human friendly label for a minor stage within a realm."""
    if total_stages <= 1:
        return ""
    if stage >= total_stages - 1:
        return "Peak"
    if stage == 0:
        return "Early"
    return f"{stage} Layer"


# ---------------------------------------------------------------------------
# Spiritual roots (灵根) -- the single biggest determinant of cultivation talent.
#
# The kind of root you are born with is rolled at birth and basically never
# changes. It sets the multiplier on every scrap of qi you ever absorb.
# ---------------------------------------------------------------------------

# Pure five elements plus the rare "variant" roots prized above all heavenly roots.
ELEMENTS = ["Metal", "Wood", "Water", "Fire", "Earth"]
VARIANT_ELEMENTS = ["Ice", "Lightning", "Wind", "Thunder", "Dark", "Light", "Void", "Chaos"]

# (key, display, multiplier, comprehension_bonus, weight, blurb)
ROOT_TYPES = [
    ("none",     "Mortal Veins (无灵根)",        0.15, -5,  60,
     "No spiritual root at all. The heavens have shut their door -- only the "
     "brutal path of body tempering remains open to you."),
    ("waste",    "False Five Root (伪灵根)",      0.45, -2, 120,
     "All five elements muddied together. Sneered at as a 'waste root', your "
     "cultivation will crawl where others fly."),
    ("quad",     "Quad Root (四灵根)",            0.70,  0, 150,
     "Four elements. Serviceable, common, unremarkable -- the lot of most "
     "outer-sect disciples."),
    ("triple",   "Triple Root (三灵根)",          1.00,  2, 110,
     "Three elements in balance. A respectable foundation that a diligent "
     "disciple can ride to the Golden Core."),
    ("dual",     "Dual Root (双灵根)",            1.55,  5,  70,
     "Two harmonised elements. The kind of talent that earns a seat among a "
     "sect's core disciples."),
    ("heavenly", "Heavenly Root (天灵根)",        2.60, 10,  28,
     "A single pure element. A genius once in a generation, courted by every "
     "great sect under heaven."),
    ("variant",  "Variant Root (异灵根)",         3.40, 14,   8,
     "A mutated root channeling a power beyond the five elements. Prophecies "
     "are written about children like you."),
    ("chaos",    "Chaos Root (混沌灵根)",         5.00, 22,   2,
     "The legendary primordial root that devours all elements. Such a soul is "
     "born to shake the Nine Heavens themselves."),
]


# ---------------------------------------------------------------------------
# Special physiques (体质) -- usually nothing, occasionally destiny-altering.
# ---------------------------------------------------------------------------

# (key, display, blurb, body_mult, qi_mult, soul_mult, luck_bonus, weight)
PHYSIQUES = [
    ("ordinary", "Ordinary Body (凡体)",
     "An unremarkable mortal frame.", 1.0, 1.0, 1.0, 0, 820),
    ("sturdy", "Iron-Boned Body (铁骨体)",
     "Born with unusually dense bones and tendons.", 1.35, 1.0, 1.0, 0, 70),
    ("spirit", "Numinous Spirit Body (灵觉体)",
     "Your spirit sense is preternaturally sharp.", 1.0, 1.0, 1.45, 0, 45),
    ("yang", "Nine-Yang Divine Body (九阳神体)",
     "A blazing yang constitution that scorches all poisons and demons.",
     1.5, 1.4, 1.1, 2, 18),
    ("yin", "Grand-Yin Mystic Body (太阴玄体)",
     "A still, cold body that drinks moonlight and soothes the soul.",
     1.1, 1.5, 1.4, 2, 16),
    ("dao", "Innate Dao Embryo (先天道胎)",
     "A body the heavens themselves seem to have shaped for cultivation.",
     1.6, 1.7, 1.6, 4, 6),
    ("immortal", "Undying Golden Body (不灭金身)",
     "Legends say such flesh cannot truly die while a single drop of blood remains.",
     2.2, 1.3, 1.2, 5, 2),
]


# ---------------------------------------------------------------------------
# Birth backgrounds (出身) -- your social standing, the second great die-roll.
#
# Standing decides what resources, reputation and danger you wake up to. A
# peerless root born to a slave still has to claw out of the gutter.
# ---------------------------------------------------------------------------

# (key, display, blurb, reputation, spirit_stones, starting_items, weight)
BACKGROUNDS = [
    ("slave", "Bond-Slave (奴籍)",
     "You were born property in a cultivator's household. You own nothing -- "
     "not even your name.", -20, 0, [], 70),
    ("beggar", "Gutter Orphan (孤儿)",
     "Abandoned in a mortal city's slums, you survived on scraps and spite.",
     -10, 1, [], 110),
    ("peasant", "Peasant Child (农户)",
     "A farming family's child, far from any sect, ignorant of cultivation.",
     0, 3, [], 200),
    ("hunter", "Hunter's Child (猎户)",
     "Raised in a mountain hamlet on game and old martial drills.",
     0, 6, ["Coarse Iron Saber"], 150),
    ("merchant", "Merchant Family (商贾)",
     "Born to traders with coin enough to buy a cultivating child a foothold.",
     8, 30, ["Spirit-Gathering Charm"], 120),
    ("martial", "Martial Clan (武宗)",
     "A clan of body-cultivators with drills, weapons and old grudges.",
     12, 18, ["Tiger-Bone Manual"], 90),
    ("scholar", "Scholar House (书香门第)",
     "A learned family -- ink, classics, and a quiet talent for comprehension.",
     10, 22, ["Annotated Dao Classic"], 80),
    ("sect", "Cultivation Sect Disciple (宗门弟子)",
     "Born within a proper sect's walls, expected to cultivate from the cradle.",
     25, 60, ["Outer-Sect Robes", "Qi-Gathering Pill"], 70),
    ("noble", "Noble Cultivation Clan (世家)",
     "An ancient family of golden cores and ancestral techniques.",
     40, 150, ["Clan Spirit Sword", "Foundation Pill"], 35),
    ("royal", "Imperial Bloodline (皇族)",
     "A child of an immortal-blooded dynasty that rules ten thousand li.",
     60, 400, ["Dragon-Pattern Jade", "Imperial Body Lotion"], 14),
    ("demon", "Demonic Sect Scion (魔道传人)",
     "Heir to a hunted devil-path lineage -- feared, powerful, and alone.",
     -5, 120, ["Blood Refining Manual", "Soul-Eating Talisman"], 25),
    ("hermit", "Hidden Master's Heir (隐世传人)",
     "Found and raised by a reclusive ancient who saw something in you.",
     5, 40, ["Mysterious Jade Slip", "Spirit Herb Bundle"], 18),
]


# ---------------------------------------------------------------------------
# Auspicious / inauspicious birth omens -- pure flavour plus small stat nudges.
# ---------------------------------------------------------------------------

# (text, comprehension, body, soul, luck, weight)
BIRTH_OMENS = [
    ("The midwife swore the room smelled of plum blossom though it was deep winter.",
     0, 0, 1, 1, 60),
    ("You were born without crying, eyes already open and strangely calm.",
     2, 0, 1, 0, 40),
    ("A white crane circled the roof three times and flew east.",
     0, 0, 0, 2, 35),
    ("Lightning split a clear sky the moment you drew breath.",
     1, 1, 0, 1, 25),
    ("A wandering fortune-teller fled the village, babbling of a 'star out of place'.",
     1, 0, 1, -1, 30),
    ("You were born under a blood moon -- the elders made warding signs.",
     0, 1, 0, -2, 28),
    ("Nothing unusual happened at all. The heavens did not deign to notice.",
     0, 0, 0, 0, 220),
    ("A spring bubbled up in the dry courtyard and ran sweet for a day.",
     0, 0, 1, 2, 22),
    ("Crows gathered by the hundred and would not be driven off.",
     0, 0, 1, -3, 18),
    ("An old turtle climbed from the river and bowed its head toward the house.",
     1, 0, 1, 3, 10),
]


# ---------------------------------------------------------------------------
# Name fragments for procedurally naming your cultivator.
# ---------------------------------------------------------------------------

SURNAMES = [
    "Li", "Wang", "Zhang", "Han", "Mu", "Lin", "Ye", "Xiao", "Chu", "Bai",
    "Gu", "Jiang", "Yun", "Ji", "Su", "Tang", "Feng", "Ling", "Shen", "Qin",
]

GIVEN_FIRST = [
    "Tian", "Yun", "Xuan", "Ling", "Chen", "Yu", "Hao", "Jian", "Wu", "Zhen",
    "Bei", "Fei", "Qing", "Han", "Yan", "Mo", "Xi", "Lan", "Rou", "Shu",
]

GIVEN_SECOND = [
    "feng", "long", "yu", "xue", "er", "ming", "yan", "shan", "hai", "chuan",
    "yao", "xin", "zhi", "ge", "yi", "lei", "guang", "yin", "lou", "ce",
]


# ---------------------------------------------------------------------------
# Cultivation techniques learnable through play.
# ---------------------------------------------------------------------------

# (key, display, tier, qi_mult_bonus, atk_bonus, blurb)
TECHNIQUES = {
    "basic_breathing": ("Mortal Breathing Art", 0, 0.00, 0,
        "The crudest method of drawing qi -- better than nothing."),
    "azure_cloud": ("Azure Cloud Scripture", 1, 0.15, 4,
        "A clean, orthodox circulation art favoured by righteous sects."),
    "five_beasts": ("Five Beasts Body Sutra", 1, 0.05, 10,
        "Hardens flesh and bone through animal forms."),
    "blood_refine": ("Blood Refining Manual", 2, 0.25, 14,
        "A demonic art -- swift, potent, and a little hungry for life."),
    "nine_yang": ("Nine-Yang Profound Art", 2, 0.30, 12,
        "A blazing yang scripture that pairs perfectly with a yang body."),
    "moon_mirror": ("Moon-Mirror Heart Sutra", 2, 0.28, 8,
        "Stills the mind to a silver pool, sharpening the soul."),
    "great_void": ("Great Void Immortal Canon", 3, 0.55, 22,
        "A near-mythical immortal canon said to lead all the way to ascension."),
}


# ---------------------------------------------------------------------------
# Appearance (容貌) -- rolled at birth, and a quiet hand on every social fate.
#
# A face is its own kind of fortune in the cultivation world: it opens doors,
# attracts dao companions, and softens elders. Appearance feeds into Charm.
# ---------------------------------------------------------------------------

# (key, display, charm_bonus, blurb, weight)
APPEARANCES = [
    ("hideous",  "Hideous (丑陋)",        -25,
     "Scarred and misshapen; strangers flinch and look away.", 35),
    ("plain",    "Plain (相貌平平)",       -8,
     "An utterly forgettable face in any crowd.", 180),
    ("ordinary", "Ordinary (寻常)",         0,
     "Neither handsome nor homely -- simply unremarkable.", 320),
    ("comely",   "Comely (清秀)",          10,
     "Pleasant to look upon, with clear bright eyes.", 200),
    ("striking", "Striking (俊美)",        22,
     "Strikingly handsome; heads turn when you pass.", 110),
    ("peerless", "Peerless Beauty (倾国倾城)", 38,
     "A face from a master's painting -- a beauty to topple cities.", 35),
    ("immortal", "Immortal Grace (谪仙之姿)", 55,
     "An otherworldly presence that stills a room the moment you enter.", 12),
]


# ---------------------------------------------------------------------------
# Sects (宗门) -- the great institutions of the cultivation world.
#
# Joining a sect grants cultivation resources (a speed bonus), a rank ladder to
# climb, contribution quests, tournaments and comrades. Better sects demand
# rarer talent; the demonic path is open to all but earns the world's enmity.
# ---------------------------------------------------------------------------

# (key, name, alignment, element, prestige, join_min_realm, join_tier, speed_bonus, rep_on_join, blurb)
#   join_tier  -> minimum spiritual-root tier (see ROOT_TIER) the gate-keepers expect
#   speed_bonus-> base cultivation-speed bonus from the sect's spirit arrays
#   rep_on_join-> reputation swing in the wider world for wearing these robes
SECTS = [
    ("cloudmist", "Cloud Mist Sect (云雾宗)", "righteous", None, 1, 1, 0, 0.15, 5,
     "A humble mountain sect that takes in nearly any youth with a flicker of "
     "talent. A gentle first rung on the ladder."),
    ("fiveelem", "Five Elements Pavilion (五行阁)", "neutral", None, 2, 1, 1, 0.25, 8,
     "A pragmatic order that welcomes every spiritual root, prizing balance "
     "over purity. Rich in resources, poor in glory."),
    ("spiritbeast", "Spirit Beast Valley (灵兽谷)", "neutral", "Earth", 2, 1, 1, 0.30, 6,
     "Beast-tamers who roam the wild ranges with monstrous companions at heel."),
    ("azure", "Azure Cloud Sect (青云宗)", "righteous", "Wood", 3, 1, 3, 0.42, 18,
     "One of the great orthodox sects; its azure robes open doors across ten "
     "thousand li. It accepts only genuine talent."),
    ("heavensword", "Heavenly Sword Sect (天剑宗)", "righteous", "Metal", 4, 2, 4, 0.58, 25,
     "An elite sword sect of cold-eyed killers that admits only the very "
     "sharpest blades. To wear its crest is to be feared."),
    ("bloodcult", "Blood Demon Cult (血魔教)", "demonic", "Dark", 2, 1, 1, 0.55, -20,
     "A hunted devil-path cult. Power comes fast and red, but every righteous "
     "sect under heaven will want your head."),
]

SECT_BY_KEY = {s[0]: s for s in SECTS}

# Spiritual-root talent tiers, used for sect-entry assessments.
ROOT_TIER = {
    "none": 0, "waste": 0, "quad": 1, "triple": 2,
    "dual": 3, "heavenly": 4, "variant": 5, "chaos": 6,
}


# ---------------------------------------------------------------------------
# Sect ranks (宗门职位) -- the ladder from sweeping disciple to Sect Master.
# ---------------------------------------------------------------------------

# (name, min_realm, min_contribution, speed_bonus, stipend_per_year)
SECT_RANKS = [
    ("Outer Disciple (外门弟子)", 0,    0, 0.00,   2),
    ("Inner Disciple (内门弟子)", 2,   60, 0.10,   6),
    ("Core Disciple (核心弟子)",  3,  220, 0.22,  16),
    ("Elder (长老)",              4,  650, 0.38,  45),
    ("Grand Elder (太上长老)",    6, 2200, 0.58, 120),
    ("Sect Master (宗主)",        7, 6500, 0.85, 300),
]


# ---------------------------------------------------------------------------
# Sect contribution quests (宗门任务).
# ---------------------------------------------------------------------------

# (name, min_rank, contribution, stones, danger, blurb)
#   danger -> probability the quest erupts into a fight
SECT_QUESTS = [
    ("Tend the Spirit Herb Gardens",        0,   8,   4, 0.05,
     "Quiet, patient work weeding the sect's spirit fields."),
    ("Patrol the Outer Mountain",           0,  14,   8, 0.25,
     "Walk the boundary wards and chase off stray beasts."),
    ("Gather Frost Lotus on the Cold Peak",  0,  20,  12, 0.30,
     "Climb the freezing summit for a rare alchemical bloom."),
    ("Hunt a Rampaging Spirit Beast",       1,  38,  26, 0.55,
     "A horned beast has been savaging the foothill villages."),
    ("Subjugate a Rogue Cultivator",        1,  55,  42, 0.60,
     "A masked rogue has been robbing the sect's outer disciples."),
    ("Escort an Elder's Caravan",           2,  90,  64, 0.45,
     "Guard a treasure caravan across bandit-haunted passes."),
    ("Cleanse a Demonic Nest",              2, 150, 115, 0.72,
     "Burn out a corpse-refiner's lair festering in the marsh."),
    ("Chart a Secret Realm Rift",           3, 280, 210, 0.66,
     "Enter a newly-opened ruin and map its perils for the sect."),
]


# ---------------------------------------------------------------------------
# Relationships (人际关系) -- masters, rivals, friends, dao companions, foes.
# ---------------------------------------------------------------------------

# Affinity thresholds -> a label for how an NPC regards you.
def relationship_label(affinity: int) -> str:
    if affinity <= -60:
        return "Sworn Enemy"
    if affinity <= -25:
        return "Hostile"
    if affinity < 25:
        return "Acquaintance"
    if affinity < 55:
        return "Friendly"
    if affinity < 80:
        return "Close"
    return "Inseparable"

# Display names for NPC roles.
ROLE_LABEL = {
    "master": "Master",
    "rival": "Rival",
    "friend": "Sworn Friend",
    "companion": "Dao Companion",
    "enemy": "Enemy",
}

# Tournament rank titles awarded for placing.
TOURNAMENT_TITLES = [
    (1, "Champion"),
    (2, "Runner-up"),
    (4, "Top Four"),
    (8, "Top Eight"),
]
