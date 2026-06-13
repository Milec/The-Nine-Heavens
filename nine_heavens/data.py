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
