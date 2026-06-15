/* The Nine Heavens -- static game data (mirror of the Python nine_heavens/data.py).
 * Pure data plus a couple of tiny lookup helpers; no game logic here. */

export const REALMS = [
  // [name, cn, stages, lifespan, qiPerStage, breakthroughDiff]
  ["Mortal",                   "凡夫",     1,        80,       10, 1.00],
  ["Body Tempering",           "炼体",     9,       180,       40, 0.95],
  ["Qi Condensation",          "炼气",    13,       300,      120, 0.85],
  ["Foundation Establishment", "筑基",     4,       600,      500, 0.55],
  ["Golden Core",              "金丹",     9,       800,     2200, 0.40],
  ["Nascent Soul",             "元婴",     9,      2000,     9000, 0.28],
  ["Spirit Severing",          "化神",     9,      5000,    38000, 0.20],
  ["Void Refinement",          "炼虚",     9,     12000,   160000, 0.14],
  ["Dao Seeking",              "合体",     9,     30000,   700000, 0.09],
  ["Mahayana",                 "大乘",     9,    100000,  3200000, 0.05],
  ["Immortal Ascension",       "渡劫飞升", 1, 1000000000, 100000000, 0.02],
];

export function stageLabel(stage, total) {
  if (total <= 1) return "";
  if (stage >= total - 1) return "Peak";
  if (stage === 0) return "Early";
  return `${stage} Layer`;
}

export const ELEMENTS = ["Metal", "Wood", "Water", "Fire", "Earth"];
export const VARIANT_ELEMENTS =
  ["Ice", "Lightning", "Wind", "Thunder", "Dark", "Light", "Void", "Chaos"];

// [key, display, multiplier, comprehensionBonus, weight, blurb]
export const ROOT_TYPES = [
  ["none", "Mortal Veins (无灵根)", 0.15, -5, 60,
    "No spiritual root at all. The heavens have shut their door -- only the brutal path of body tempering remains open to you."],
  ["waste", "False Five Root (伪灵根)", 0.45, -2, 120,
    "All five elements muddied together. Sneered at as a 'waste root', your cultivation will crawl where others fly."],
  ["quad", "Quad Root (四灵根)", 0.70, 0, 150,
    "Four elements. Serviceable, common, unremarkable -- the lot of most outer-sect disciples."],
  ["triple", "Triple Root (三灵根)", 1.00, 2, 110,
    "Three elements in balance. A respectable foundation a diligent disciple can ride to the Golden Core."],
  ["dual", "Dual Root (双灵根)", 1.55, 5, 70,
    "Two harmonised elements. The kind of talent that earns a seat among a sect's core disciples."],
  ["heavenly", "Heavenly Root (天灵根)", 2.60, 10, 28,
    "A single pure element. A genius once in a generation, courted by every great sect under heaven."],
  ["variant", "Variant Root (异灵根)", 3.40, 14, 8,
    "A mutated root channeling a power beyond the five elements. Prophecies are written about children like you."],
  ["chaos", "Chaos Root (混沌灵根)", 5.00, 22, 2,
    "The legendary primordial root that devours all elements. Such a soul is born to shake the Nine Heavens themselves."],
];

// [key, display, blurb, bodyMult, qiMult, soulMult, luckBonus, weight]
export const PHYSIQUES = [
  ["ordinary", "Ordinary Body (凡体)", "An unremarkable mortal frame.", 1.0, 1.0, 1.0, 0, 820],
  ["sturdy", "Iron-Boned Body (铁骨体)", "Born with unusually dense bones and tendons.", 1.35, 1.0, 1.0, 0, 70],
  ["spirit", "Numinous Spirit Body (灵觉体)", "Your spirit sense is preternaturally sharp.", 1.0, 1.0, 1.45, 0, 45],
  ["yang", "Nine-Yang Divine Body (九阳神体)", "A blazing yang constitution that scorches all poisons and demons.", 1.5, 1.4, 1.1, 2, 18],
  ["yin", "Grand-Yin Mystic Body (太阴玄体)", "A still, cold body that drinks moonlight and soothes the soul.", 1.1, 1.5, 1.4, 2, 16],
  ["dao", "Innate Dao Embryo (先天道胎)", "A body the heavens themselves seem to have shaped for cultivation.", 1.6, 1.7, 1.6, 4, 6],
  ["immortal", "Undying Golden Body (不灭金身)", "Legends say such flesh cannot truly die while a single drop of blood remains.", 2.2, 1.3, 1.2, 5, 2],
];

// [key, display, blurb, reputation, spiritStones, items, weight]
export const BACKGROUNDS = [
  ["slave", "Bond-Slave (奴籍)", "You were born property in a cultivator's household. You own nothing -- not even your name.", -20, 0, [], 70],
  ["beggar", "Gutter Orphan (孤儿)", "Abandoned in a mortal city's slums, you survived on scraps and spite.", -10, 1, [], 110],
  ["peasant", "Peasant Child (农户)", "A farming family's child, far from any sect, ignorant of cultivation.", 0, 3, [], 200],
  ["hunter", "Hunter's Child (猎户)", "Raised in a mountain hamlet on game and old martial drills.", 0, 6, ["Coarse Iron Saber"], 150],
  ["merchant", "Merchant Family (商贾)", "Born to traders with coin enough to buy a cultivating child a foothold.", 8, 30, ["Spirit-Gathering Charm"], 120],
  ["martial", "Martial Clan (武宗)", "A clan of body-cultivators with drills, weapons and old grudges.", 12, 18, ["Tiger-Bone Manual"], 90],
  ["scholar", "Scholar House (书香门第)", "A learned family -- ink, classics, and a quiet talent for comprehension.", 10, 22, ["Annotated Dao Classic"], 80],
  ["sect", "Cultivation Sect Disciple (宗门弟子)", "Born within a proper sect's walls, expected to cultivate from the cradle.", 25, 60, ["Outer-Sect Robes", "Qi-Gathering Pill"], 70],
  ["noble", "Noble Cultivation Clan (世家)", "An ancient family of golden cores and ancestral techniques.", 40, 150, ["Clan Spirit Sword", "Foundation Pill"], 35],
  ["royal", "Imperial Bloodline (皇族)", "A child of an immortal-blooded dynasty that rules ten thousand li.", 60, 400, ["Dragon-Pattern Jade", "Imperial Body Lotion"], 14],
  ["demon", "Demonic Sect Scion (魔道传人)", "Heir to a hunted devil-path lineage -- feared, powerful, and alone.", -5, 120, ["Blood Refining Manual", "Soul-Eating Talisman"], 25],
  ["hermit", "Hidden Master's Heir (隐世传人)", "Found and raised by a reclusive ancient who saw something in you.", 5, 40, ["Mysterious Jade Slip", "Spirit Herb Bundle"], 18],
];

// [text, comp, body, soul, luck, weight]
export const BIRTH_OMENS = [
  ["The midwife swore the room smelled of plum blossom though it was deep winter.", 0, 0, 1, 1, 60],
  ["You were born without crying, eyes already open and strangely calm.", 2, 0, 1, 0, 40],
  ["A white crane circled the roof three times and flew east.", 0, 0, 0, 2, 35],
  ["Lightning split a clear sky the moment you drew breath.", 1, 1, 0, 1, 25],
  ["A wandering fortune-teller fled the village, babbling of a 'star out of place'.", 1, 0, 1, -1, 30],
  ["You were born under a blood moon -- the elders made warding signs.", 0, 1, 0, -2, 28],
  ["Nothing unusual happened at all. The heavens did not deign to notice.", 0, 0, 0, 0, 220],
  ["A spring bubbled up in the dry courtyard and ran sweet for a day.", 0, 0, 1, 2, 22],
  ["Crows gathered by the hundred and would not be driven off.", 0, 0, 1, -3, 18],
  ["An old turtle climbed from the river and bowed its head toward the house.", 1, 0, 1, 3, 10],
];

export const SURNAMES = ["Li","Wang","Zhang","Han","Mu","Lin","Ye","Xiao","Chu","Bai","Gu","Jiang","Yun","Ji","Su","Tang","Feng","Ling","Shen","Qin"];
export const GIVEN_FIRST = ["Tian","Yun","Xuan","Ling","Chen","Yu","Hao","Jian","Wu","Zhen","Bei","Fei","Qing","Han","Yan","Mo","Xi","Lan","Rou","Shu"];
export const GIVEN_SECOND = ["feng","long","yu","xue","er","ming","yan","shan","hai","chuan","yao","xin","zhi","ge","yi","lei","guang","yin","lou","ce"];

// key -> [display, tier, qiMultBonus, atkBonus, blurb]
export const TECHNIQUES = {
  basic_breathing: ["Mortal Breathing Art", 0, 0.00, 0, "The crudest method of drawing qi -- better than nothing."],
  azure_cloud: ["Azure Cloud Scripture", 1, 0.15, 4, "A clean, orthodox circulation art favoured by righteous sects."],
  five_beasts: ["Five Beasts Body Sutra", 1, 0.05, 10, "Hardens flesh and bone through animal forms."],
  blood_refine: ["Blood Refining Manual", 2, 0.25, 14, "A demonic art -- swift, potent, and a little hungry for life."],
  nine_yang: ["Nine-Yang Profound Art", 2, 0.30, 12, "A blazing yang scripture that pairs perfectly with a yang body."],
  moon_mirror: ["Moon-Mirror Heart Sutra", 2, 0.28, 8, "Stills the mind to a silver pool, sharpening the soul."],
  great_void: ["Great Void Immortal Canon", 3, 0.55, 22, "A near-mythical immortal canon said to lead all the way to ascension."],
  sword_rain: ["Myriad Sword Rain Art", 2, 0.20, 14, "A storm of flying swords that strikes again and again."],
  mirror_parry: ["Mirror-Light Body Art", 2, 0.18, 8, "A defensive art that turns a foe's own force back upon them."],
  spirit_bind: ["Spirit-Binding Seal", 2, 0.16, 6, "Soul-script that shackles an enemy's qi and will."],
  frost_lotus: ["Frost Lotus Palm", 2, 0.22, 11, "A blossoming palm of killing frost that can freeze a foe mid-step."],
  thunder_step: ["Nine-Heaven Thunder Step", 2, 0.24, 13, "Blink between thunderclaps, striking twice and quickening your own movements."],
  vajra_body: ["Vajra Indestructible Body", 2, 0.10, 6, "A Buddhist body-art of golden, unbreakable flesh that regenerates wounds."],
  tide_palm: ["Tide-Calling Palm", 2, 0.22, 12, "A surging Water art whose drowning pressure saps a foe's strength."],
  mountain_seal: ["Mountain-Bearing Seal", 2, 0.20, 14, "An Earth art that drops a mountain's weight on a foe, crushing and pinning them."],
  heaven_slash: ["Heaven-Splitting Sabre", 3, 0.42, 20, "A single annihilating cut that leaves you spent."],
  samsara_palm: ["Samsara Heaven-Turning Palm", 3, 0.50, 18, "Turn the wheel of life and death; void force that rends the foe and mends you."],
};

// [key, display, charmBonus, blurb, weight]
export const APPEARANCES = [
  ["hideous", "Hideous (丑陋)", -25, "Scarred and misshapen; strangers flinch and look away.", 35],
  ["plain", "Plain (相貌平平)", -8, "An utterly forgettable face in any crowd.", 180],
  ["ordinary", "Ordinary (寻常)", 0, "Neither handsome nor homely -- simply unremarkable.", 320],
  ["comely", "Comely (清秀)", 10, "Pleasant to look upon, with clear bright eyes.", 200],
  ["striking", "Striking (俊美)", 22, "Strikingly handsome; heads turn when you pass.", 110],
  ["peerless", "Peerless Beauty (倾国倾城)", 38, "A face from a master's painting -- a beauty to topple cities.", 35],
  ["immortal", "Immortal Grace (谪仙之姿)", 55, "An otherworldly presence that stills a room the moment you enter.", 12],
];

// [key, name, alignment, element, prestige, joinMinRealm, joinTier, speedBonus, repOnJoin, blurb]
export const SECTS = [
  ["cloudmist", "Cloud Mist Sect (云雾宗)", "righteous", null, 1, 1, 0, 0.15, 5,
    "A humble mountain sect that takes in nearly any youth with a flicker of talent. A gentle first rung on the ladder."],
  ["fiveelem", "Five Elements Pavilion (五行阁)", "neutral", null, 2, 1, 1, 0.25, 8,
    "A pragmatic order that welcomes every spiritual root, prizing balance over purity. Rich in resources, poor in glory."],
  ["spiritbeast", "Spirit Beast Valley (灵兽谷)", "neutral", "Earth", 2, 1, 1, 0.30, 6,
    "Beast-tamers who roam the wild ranges with monstrous companions at heel."],
  ["azure", "Azure Cloud Sect (青云宗)", "righteous", "Wood", 3, 1, 3, 0.42, 18,
    "One of the great orthodox sects; its azure robes open doors across ten thousand li. It accepts only genuine talent."],
  ["heavensword", "Heavenly Sword Sect (天剑宗)", "righteous", "Metal", 4, 2, 4, 0.58, 25,
    "An elite sword sect of cold-eyed killers that admits only the very sharpest blades. To wear its crest is to be feared."],
  ["bloodcult", "Blood Demon Cult (血魔教)", "demonic", "Dark", 2, 1, 1, 0.55, -20,
    "A hunted devil-path cult. Power comes fast and red, but every righteous sect under heaven will want your head."],
];
export const SECT_BY_KEY = Object.fromEntries(SECTS.map(s => [s[0], s]));

export const ROOT_TIER = { none:0, waste:0, quad:1, triple:2, dual:3, heavenly:4, variant:5, chaos:6 };

// [name, minRealm, minContribution, speedBonus, stipend]
export const SECT_RANKS = [
  ["Outer Disciple (外门弟子)", 0, 0, 0.00, 2],
  ["Inner Disciple (内门弟子)", 2, 60, 0.10, 6],
  ["Core Disciple (核心弟子)", 3, 220, 0.22, 16],
  ["Elder (长老)", 4, 650, 0.38, 45],
  ["Grand Elder (太上长老)", 6, 2200, 0.58, 120],
  ["Sect Master (宗主)", 7, 6500, 0.85, 300],
];

// [name, minRank, contribution, stones, danger, blurb]
export const SECT_QUESTS = [
  ["Tend the Spirit Herb Gardens", 0, 8, 4, 0.05, "Quiet, patient work weeding the sect's spirit fields."],
  ["Patrol the Outer Mountain", 0, 14, 8, 0.25, "Walk the boundary wards and chase off stray beasts."],
  ["Gather Frost Lotus on the Cold Peak", 0, 20, 12, 0.30, "Climb the freezing summit for a rare alchemical bloom."],
  ["Hunt a Rampaging Spirit Beast", 1, 38, 26, 0.55, "A horned beast has been savaging the foothill villages."],
  ["Subjugate a Rogue Cultivator", 1, 55, 42, 0.60, "A masked rogue has been robbing the sect's outer disciples."],
  ["Escort an Elder's Caravan", 2, 90, 64, 0.45, "Guard a treasure caravan across bandit-haunted passes."],
  ["Cleanse a Demonic Nest", 2, 150, 115, 0.72, "Burn out a corpse-refiner's lair festering in the marsh."],
  ["Chart a Secret Realm Rift", 3, 280, 210, 0.66, "Enter a newly-opened ruin and map its perils for the sect."],
];

export function relationshipLabel(a) {
  if (a <= -60) return "Sworn Enemy";
  if (a <= -25) return "Hostile";
  if (a < 25) return "Acquaintance";
  if (a < 55) return "Friendly";
  if (a < 80) return "Close";
  return "Inseparable";
}

export const ROLE_LABEL = { master:"Master", rival:"Rival", friend:"Sworn Friend", companion:"Dao Companion", enemy:"Enemy" };
// A married companion's kin label, by their sex.
export const spouseLabel = n => n.sex === "female" ? "Wife" : n.sex === "male" ? "Husband" : "Dao Partner";
export const HAREM_CAP = 6;   // how many dao companions you may gather at once

/* World Eras (天时): the realm turns through long ages that colour every life —
 * shifting how fast qi gathers, how dangerous the roads are, and which fates
 * tend to befall a cultivator. The world keeps turning across reincarnations. */
// [key, name, cn, blurb, cultMult, dangerMult, breakBonus, priceMult]
export const ERAS = [
  ["abundance", "Age of Abundance", "盛世", "Spirit qi runs thick and the realm is at peace; cultivation flourishes and fortune comes easily.", 1.15, 0.85, 0.00, 0.80],
  ["warring",   "Warring Era",      "乱世", "The great sects clash and war-bands roam; blood is cheap and the strong devour the weak.", 1.00, 1.30, 0.00, 1.25],
  ["demontide", "Demon Tide",       "魔潮", "Devil-path cultivators and corpse-fiends surge from the wastes; the righteous stand besieged.", 0.95, 1.45, 0.00, 1.20],
  ["drought",   "Spiritual Drought","灵气枯竭", "The heavens' qi thins to a trickle; every breakthrough is dearly bought and lifespans matter.", 0.78, 1.00, -0.03, 1.50],
  ["dawn",      "Dawn of Ascension","飞升之兆", "Auspicious signs fill the sky; the long-shut path to immortality seems, for a while, to stand open.", 1.25, 1.10, 0.06, 1.00],
];
export const ERA_BY_KEY = Object.fromEntries(ERAS.map(e => [e[0], e]));
export const eraAt = key => ERA_BY_KEY[key] || ERAS[0];
export const TOURNAMENT_TITLES = [[1,"Champion"],[2,"Runner-up"],[4,"Top Four"],[8,"Top Eight"]];

export const ARTIFACT_GRADES = ["Mortal","Spirit","Earth","Heaven","Immortal"];
export const ARTIFACT_GRADE_RANK = Object.fromEntries(ARTIFACT_GRADES.map((g,i)=>[g,i]));

// [key, name, grade, atkPct, qiBonus, blurb]
export const ARTIFACTS = [
  ["iron_sword", "Chipped Iron Sword", "Mortal", 0.06, 0.00, "A mortal-forged blade, barely a cut above a farmer's tool."],
  ["talisman", "Yellow Paper Talisman", "Mortal", 0.05, 0.02, "A bundle of crude warding charms."],
  ["azure_sword", "Azure Flying Sword", "Spirit", 0.16, 0.04, "A true flying sword that hums and circles at its master's will."],
  ["cloud_boots", "Cloud-Striding Boots", "Spirit", 0.12, 0.03, "Tread the wind itself; foes struggle to pin you down."],
  ["flame_gourd", "Crimson Flame Gourd", "Earth", 0.30, 0.05, "Belches a torrent of spirit-fire that melts iron and beast alike."],
  ["element_pagoda", "Five Elements Pagoda", "Earth", 0.28, 0.10, "A layered treasure-pagoda that grinds enemies between the five elements."],
  ["frost_mirror", "Frost-Moon Mirror", "Spirit", 0.14, 0.06, "A cold silver disc that drinks moonlight and turns a foe's spells back as ice."],
  ["bone_banner", "Ten-Thousand Ghost Banner", "Earth", 0.30, 0.08, "A demonic banner that looses a howling tide of vengeful spirits."],
  ["thunder_drum", "Nine-Heaven Thunder Drum", "Earth", 0.34, 0.06, "One beat looses the wrath of heaven; thunder rolls across the field."],
  ["dragon_cauldron", "Nine Dragon Cauldron", "Heaven", 0.55, 0.16, "Nine dragons coil its rim; it can smelt mountains and refine pills."],
  ["stars_banner", "River-of-Stars Banner", "Heaven", 0.50, 0.20, "Unfurls a galaxy of killing starlight across the battlefield."],
  ["phoenix_plume", "Vermilion Phoenix Plume", "Heaven", 0.52, 0.18, "A single undying feather wreathed in nirvanic flame that burns and reblooms."],
  ["chaos_bell", "Primordial Chaos Bell", "Immortal", 0.95, 0.32, "A bell from the dawn of the world; one toll unmakes ten thousand spells."],
  ["samsara_disk", "Wheel-of-Samsara Disk", "Immortal", 0.88, 0.34, "An immortal artifact that turns the wheel of rebirth, grinding all things back to dust."],
];
export const ARTIFACT_BY_KEY = Object.fromEntries(ARTIFACTS.map(a => [a[0], a]));

export const SPIRIT_BEASTS = [
  "Spirit Fox","Cloud Leopard","Crimson Fire Python","Thunder Hawk","Jade-Maned Lion",
  "Frost Wolf","Black Tortoise","Six-Eared Macaque","Azure Dragonling","Golden-Winged Roc",
  "Nine-Tailed Fox","Qilin Calf","White Tiger Cub","Vermilion Sparrow","Moonlight Jade Hare",
  "Stone Qilin","Abyssal Serpent","Wind-Roc Fledgling","Three-Eyed Spirit Ape","Bone-Crown Lizard",
];

// [key, name, herbCost, baseSuccess, blurb]
export const PILL_RECIPES = [
  ["qi", "Qi-Gathering Pill", 2, 0.88, "The alchemist's bread and butter; speeds a year of cultivation."],
  ["heal", "Spirit Healing Pill", 3, 0.78, "Knits wounds and meridians; auto-used when battle turns against you."],
  ["body", "Marrow-Cleansing Pill", 5, 0.55, "Tempers the flesh, permanently raising Constitution."],
  ["soul", "Soul-Nourishing Pill", 5, 0.55, "Refines the spirit, permanently raising Soul Sense."],
  ["breakthrough", "Foundation Breakthrough Pill", 7, 0.45, "Consumed on your next breakthrough to greatly improve its odds."],
  ["longevity", "Nine-Turn Longevity Pill", 12, 0.30, "The grandmaster's art -- adds precious years to your lifespan."],
];
export const PILL_BY_KEY = Object.fromEntries(PILL_RECIPES.map(p => [p[0], p]));

// [key, name, powerBonus, breakthroughBonus, blurb]
export const DAOS = [
  ["sword", "Dao of the Sword (剑道)", 0.18, 0.03, "All things may be cut; your every strike sharpens toward the one true edge."],
  ["flame", "Dao of Flame (火道)", 0.16, 0.03, "The burning law of transformation and ruin."],
  ["space", "Dao of Space (空间)", 0.14, 0.05, "Fold distance; step a thousand li, and let blows find only afterimages."],
  ["time", "Dao of Time (时间)", 0.12, 0.06, "The rarest law -- moments stretch and your cultivation quickens."],
  ["vitality", "Dao of Vitality (生机)", 0.10, 0.04, "The law of life unending; the years bow and your lifespan lengthens."],
  ["slaughter", "Dao of Slaughter (杀戮)", 0.22, 0.02, "A blood-soaked law of killing intent that terrifies the heavens."],
  ["karma", "Dao of Karma (因果)", 0.12, 0.07, "Perceive the threads of cause and effect; tribulation reads you kindly."],
  ["void", "Dao of the Void (虚无)", 0.16, 0.05, "The empty law underlying all; the foundation of true immortality."],
  ["thunder", "Dao of Thunder (雷道)", 0.20, 0.03, "The punishing law of heaven's judgment; your strikes carry the sky's own wrath."],
  ["devour", "Dao of Devouring (吞噬)", 0.20, 0.02, "A ravenous law that swallows qi, spells and life alike to feed your own."],
  ["dream", "Dao of Dreams (幻梦)", 0.12, 0.06, "The law of illusion and mind; reality bends, and the heavens lose sight of you."],
];
export const DAO_BY_KEY = Object.fromEntries(DAOS.map(d => [d[0], d]));

export function karmaLabel(k) {
  if (k <= -120) return "Heaven-Defying Devil";
  if (k <= -40) return "Blood-Soaked";
  if (k < 40) return "Unremarkable";
  if (k < 120) return "Virtuous";
  return "Living Saint";
}

/* ===================================================================
 * BitLife-style life-sim layer: family, life stages, vitals, activities.
 * =================================================================== */

export const AWAKENING_AGE = 6;     // spiritual root revealed (测灵根)
export const COMING_OF_AGE = 16;    // adulthood; free to leave home

// What your parents do, and roughly how cultivated they are, by birth standing.
// [father_occupation, mother_occupation, parent_realm_index]
export const PARENT_PROFILE = {
  slave:    ["a bond-servant", "a kitchen maid", 0],
  beggar:   ["unknown", "unknown", 0],
  peasant:  ["a rice farmer", "a weaver", 0],
  hunter:   ["a mountain hunter", "an herb-gatherer", 1],
  merchant: ["a spice merchant", "a shopkeeper", 1],
  martial:  ["a martial instructor", "a clan matron", 2],
  scholar:  ["a village teacher", "a calligrapher", 1],
  sect:     ["an outer-sect disciple", "a sect handmaiden", 2],
  noble:    ["a clan elder", "a clan lady", 4],
  royal:    ["an imperial prince", "an imperial consort", 5],
  demon:    ["a devil-path cultivator", "a blood witch", 3],
  hermit:   ["a reclusive master", "a wandering immortal", 5],
};

// Sibling relation labels by sex.
export const KIN = {
  father: "Father", mother: "Mother",
  brother: "Brother", sister: "Sister",
  son: "Son", daughter: "Daughter",
  spouse: "Dao Partner",
};

// Avatar emoji by life stage / realm tier.
export function avatarFor(c) {
  if (!c.awakened && c.age < AWAKENING_AGE) return c.age < 2 ? "👶" : "🧒";
  if (c.realm >= 9) return "😇";
  if (c.realm >= 7) return "🧝";
  if (c.realm >= 5) return "🧙";
  if (c.realm >= 3) return "🧘";
  if (c.age < COMING_OF_AGE) return "🧒";
  return c.sex === "female" ? "👩" : "🧑";
}

// Vital-stat descriptive bands.
export function vitalLabel(v) {
  if (v >= 85) return "Excellent";
  if (v >= 65) return "Good";
  if (v >= 40) return "Fair";
  if (v >= 20) return "Poor";
  return "Critical";
}

/* Technique mastery (功法精通): proficiency grows with use, boosting a skill. */
// [rank name, min points, damage/effect bonus]
export const MASTERY_RANKS = [
  ["Untrained", 0, 0.00],
  ["Novice", 25, 0.06],
  ["Adept", 80, 0.14],
  ["Master", 200, 0.24],
  ["Grand Master", 450, 0.36],
  ["Perfected", 900, 0.50],
];
export function masteryRank(points) {
  let r = MASTERY_RANKS[0];
  for (const m of MASTERY_RANKS) if (points >= m[1]) r = m;
  return r;
}
export function masteryNext(points) {
  for (const m of MASTERY_RANKS) if (points < m[1]) return m;
  return null;
}

/* World standing (声望) -- how the cultivation world regards your name. */
export function standingLabel(rep) {
  if (rep <= -40) return "Notorious";
  if (rep <= -12) return "Disreputable";
  if (rep < 15) return "Unknown";
  if (rep < 40) return "Known";
  if (rep < 90) return "Renowned";
  if (rep < 180) return "Famous";
  return "Legendary";
}

/* Regions of the world (地域) -- travel scales danger and reward. */
// [key, name, cn, dangerFactor, blurb]
export const REGIONS = [
  ["azuredomain", "Azure Heartlands", "青云腹地", 0.85, "Tranquil orthodox heartlands; gentle foes, modest spoils. A safe place to begin."],
  ["cloudmarsh", "Misty Cloud Marsh", "云泽", 1.0, "Trackless wetlands prowled by venomous spirit-beasts."],
  ["frostpeaks", "Ten-Thousand Frost Peaks", "万寒峰", 1.25, "Killing cold and frost-beasts — richer pickings for those strong enough."],
  ["demonwastes", "Demon-Haunted Wastes", "魔渊", 1.6, "Devil-path cultivators and corpse-fiends roam freely. Deadly, but lucrative."],
  ["starfall", "Starfall Frontier", "星陨之地", 2.0, "A shattered immortal battlefield at the edge of the map. Death and fortune in equal measure."],
];
export const REGION_BY_KEY = Object.fromEntries(REGIONS.map(r => [r[0], r]));

/* Cave Abode (洞府): a personal home-base staked on a spirit vein. You establish
 * one and upgrade it across a lifetime; each year it yields spirit herbs and
 * spirit stones and quickens your cultivation, and you can seclude in it for a
 * stronger bout of cultivation. Level 0 means you have no abode yet. */
// [level, name, cn, cost, qiBonus, herbsPerYear, stonesPerYear, seclusion, blurb]
export const ABODES = [
  [1, "Humble Cave Dwelling", "石洞",     50,    0.04,  1,   2, 0.16, "A dry cave with a crude qi-gathering array scratched into the stone."],
  [2, "Mountain Spirit Cottage", "山居",  180,   0.08,  2,   6, 0.18, "A tidy cottage on a thin spirit vein, with a small herb plot out back."],
  [3, "Spirit-Gathering Abode", "聚灵洞府", 600,  0.12,  4,  16, 0.21, "A true cave-abode astride a living spirit vein; arrays hum day and night."],
  [4, "Cloud-Veined Estate", "云脉别业",  2000,  0.16,  7,  40, 0.24, "A walled estate over a rich vein — herb fields, spirit ponds, a guardian array."],
  [5, "Earthly Blessed Land", "洞天福地", 7000,  0.20, 12,  95, 0.28, "A blessed land where qi falls like rain and rare herbs grow wild."],
  [6, "Cave Heaven", "大洞天",          24000,  0.25, 20, 240, 0.33, "A pocket paradise folded out of the world itself, where immortals are forged."],
];
// abodeAt(level): the row for your current level (null if none).
export const abodeAt = lvl => (lvl > 0 && lvl <= ABODES.length) ? ABODES[lvl - 1] : null;
// abodeNext(level): the row for the next tier up (null if already at the peak).
export const abodeNext = lvl => (lvl || 0) < ABODES.length ? ABODES[lvl || 0] : null;

/* Founding your own sect (开宗立派): once you are a recognized power with a
 * worthy abode to serve as its mountain seat, you may raise your own sect. It
 * gathers members and prestige over the years, spreading your name and feeding
 * you a stipend. The abode's grade caps how large the sect can grow. */
// [minPrestige, name, cn, speedBonus, repPerYear]
export const SECT_TIERS = [
  [0,    "Fledgling Sect",  "新立小宗", 0.05, 1],
  [40,   "Minor Sect",      "三流宗门", 0.10, 2],
  [120,  "Established Sect", "二流宗门", 0.16, 3],
  [300,  "Great Sect",      "一流大宗", 0.24, 5],
  [700,  "Dominant Sect",   "超然巨擘", 0.34, 8],
  [1600, "Holy Land",       "圣地",     0.48, 12],
];
export function sectTier(prestige) {
  let t = SECT_TIERS[0];
  for (const s of SECT_TIERS) if (prestige >= s[0]) t = s;
  return t;
}
export function sectTierNext(prestige) {
  for (const s of SECT_TIERS) if (prestige < s[0]) return s;
  return null;
}
// How many followers an abode-seat of each grade can house (index by abode tier 0..6).
export const SECT_CAPACITY = [0, 30, 80, 200, 500, 1200, 3000];
// Parts for auto-generating a sect name when the founder leaves it to fate.
export const SECT_NAME_ADJ = ["Azure", "Cloud", "Heaven", "Nine-Heaven", "Profound", "Jade", "Golden", "Mystic", "Boundless", "Crimson", "Spirit", "Void", "Thousand-Star", "Purple", "Divine", "Immortal", "Eternal", "Cangming"];
export const SECT_NAME_NOUN = ["Cloud Sect", "Sword Sect", "Sky Pavilion", "Heaven Palace", "Dao Sect", "Spirit Hall", "Mystic Gate", "Origin Sect", "Star Pavilion", "Sacred Hall", "Profound Sect", "Cloud Pavilion", "Sword Pavilion"];

/* Spirit beast companions (灵兽) grow with you: feed them and fight at their side
 * to raise their bond and exp, evolving them through five ranks into ever
 * mightier forms with their own elemental bite. */
export const BEAST_EXP_REQ = [0, 25, 70, 160, 340];   // exp to advance FROM rank r (1..4)
export const beastRankName = rank => ["Mortal Beast", "Spirit Beast", "Earth Beast", "Heaven Beast", "Mythic Beast"][Math.max(0, Math.min(4, (rank || 1) - 1))];
export function beastEvolvedName(base, rank) {
  switch (rank) {
    case 2: return `Awakened ${base}`;
    case 3: return `Elder ${base}`;
    case 4: return `${base} Sovereign`;
    case 5: return `Mythic ${base}`;
    default: return base;
  }
}
// Infer a beast's innate element from its species name (null if none fits).
export function beastElement(species) {
  const s = (species || "").toLowerCase();
  if (/fire|flame|crimson|ember|phoenix|vermilion/.test(s)) return "Fire";
  if (/frost|ice|snow|cold/.test(s)) return "Ice";
  if (/thunder|lightning|storm|roc|bolt/.test(s)) return "Lightning";
  if (/wind|cloud|gale|leopard/.test(s)) return "Wind";
  if (/stone|rock|tortoise|qilin|bone|earth/.test(s)) return "Earth";
  if (/python|serpent|jade|macaque|hare|wood/.test(s)) return "Wood";
  if (/water|tide|abyss|kraken|dragon/.test(s)) return "Water";
  if (/fox|shadow|ghost|dark/.test(s)) return "Dark";
  if (/tiger|metal|sword|iron|fang|wolf/.test(s)) return "Metal";
  if (/light|sparrow|crane|roc/.test(s)) return "Light";
  return null;
}

/* Body Cultivation (炼体): a path parallel to qi cultivation, tempering the
 * mortal frame into something monstrous. It needs no spiritual root — so it is
 * the salvation of the rootless and the waste-rooted — and stacks atop qi
 * cultivation for those who would walk both roads. Driven by constitution and
 * physique, not your root. */
// [name, cn, temperReq(cumulative), martialBase, hpFrac, lifespanBonus, mitig]
// Note: martialBase is deliberately kept well below the comparable qi realm's
// power — a body cultivator's strength is survivability, not raw offense. Even a
// maxed God-Body (~5500) sits below Nascent Soul/Spirit-Severing qi power and far
// under the true immortal realms; their edge is monstrous HP and damage-reduction.
export const BODY_REALMS = [
  ["Mortal Body",            "凡体",     0,     0,    0.00,    0, 0.00],
  ["Tempered Flesh",         "淬体境",   50,    5,    0.10,   30, 0.02],
  ["Iron Body",              "铁皮境",   180,   30,   0.22,   80, 0.05],
  ["Steel Bone",             "钢骨境",   500,   120,  0.36,  200, 0.08],
  ["Silver Marrow",          "银髓境",   1300,  400,  0.50,  500, 0.11],
  ["Golden Body",            "金身境",   3200,  1100, 0.68, 1300, 0.14],
  ["Diamond Sun-Body",       "琉璃金身", 8000,  2600, 0.90, 3500, 0.18],
  ["Indestructible God-Body","不灭神体", 20000, 5500, 1.20, 9000, 0.24],
];
export const bodyRealmAt = i => BODY_REALMS[Math.max(0, Math.min(BODY_REALMS.length - 1, i || 0))];
export const bodyRealmName = i => bodyRealmAt(i)[0];
// Your physique is your destiny on the body axis: it caps how far you may temper.
// Only the legendary Undying Golden Body can ever become a true God-Body.
export const PHYSIQUE_BODY_CAP = { ordinary: 4, sturdy: 5, spirit: 5, yin: 6, yang: 6, dao: 6, immortal: 7 };

/* Ongoing physique (体质) effects, beyond the birth-stat multipliers. These bite
 * throughout life — cultivation speed, breakthroughs, Dao insight, and combat. */
export const PHYSIQUE_EFFECTS = {
  ordinary: { desc: "An ordinary frame — no special boons." },
  sturdy:   { mitig: 0.10, hp: 0.25, desc: "Iron bones: +10% combat damage-reduction and +25% battle stamina." },
  spirit:   { dodge: 0.10, qiPool: 0.30, dao: 0.25, desc: "Keen spirit sense: +10% dodge, +30% combat qi, and far faster Dao insight." },
  yang:     { cultivate: 0.15, burnImmune: true, vsDemon: 0.30, element: "Fire", desc: "Nine-Yang body: +15% cultivation, immune to burning, +30% damage vs demons, innate Fire." },
  yin:      { cultivate: 0.10, healBonus: 0.6, element: "Ice", desc: "Grand-Yin body: +10% cultivation, +60% to healing arts, innate Ice." },
  dao:      { cultivate: 0.30, breakthrough: 0.08, dao: 0.45, desc: "Innate Dao Embryo: +30% cultivation, +8% breakthrough odds, greatly faster Dao insight." },
  immortal: { mitig: 0.18, hp: 0.50, deathSave: 0.25, desc: "Undying Golden Body: heavy damage-reduction, +50% battle stamina, and a chance to cheat death." },
};
export const physEffect = c => PHYSIQUE_EFFECTS[c.physiqueKey] || PHYSIQUE_EFFECTS.ordinary;
