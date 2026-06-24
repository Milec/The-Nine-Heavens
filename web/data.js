/* The Nine Heavens -- static game data (mirror of the Python nine_heavens/data.py).
 * Pure data plus a couple of tiny lookup helpers; no game logic here. */

import { icon } from "./icons.js";

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
  ["swordroot", "Sword-Bone Root (剑骨灵根)", 2.75, 11, 10,
    "Born with sword-bones — a single killing edge of Metal affinity that takes to the blade as breath to the lungs. Sword sects would war over you."],
  ["variant", "Variant Root (异灵根)", 3.40, 14, 8,
    "A mutated root channeling a power beyond the five elements. Prophecies are written about children like you."],
  ["thunderroot", "Heavenly Thunder Root (天雷灵根)", 3.35, 13, 4,
    "A variant root crackling with the heavens' own lightning; tribulations recognise their own, and the sky's wrath answers your call."],
  ["iceroot", "Profound Ice Root (玄冰灵根)", 3.35, 13, 4,
    "A variant root of glacial cold and stillness — your qi runs clear and merciless as a winter river, and your dao heart with it."],
  ["voidroot", "Void Spirit Root (虚灵根)", 3.45, 16, 3,
    "A variant root attuned to the empty Void that underlies all things — rarer even than the prophecies that foretell it."],
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
  ["phoenix", "Vermilion Phoenix Body (朱雀涅槃体)", "A body of fire and renewal that rises from its own ashes.", 1.3, 1.4, 1.2, 2, 10],
  ["gale", "Gale-Spirit Body (罡风之体)", "Quicksilver flesh, light as wind and twice as hard to pin.", 1.1, 1.2, 1.2, 1, 12],
  ["swordheart", "Sword-Heart Body (剑心通明体)", "A body and mind honed for the blade; killing intent comes as easily as breath.", 1.2, 1.2, 1.4, 1, 11],
  ["titan", "Earth-Titan Body (后土巨灵体)", "Flesh like living mountain-rock — slow to gather qi, but all but unbreakable.", 1.9, 0.9, 1.0, 0, 9],
  ["dragon", "True Dragon Body (真龙之躯)", "The blood of dragons runs in you — overwhelming in body and qi alike.", 1.7, 1.5, 1.2, 3, 4],
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
  ["fallen", "Fallen Noble (没落世家)", "Your once-great clan crumbled before you were grown; you carry an old name, old debts, and one heirloom blade.", 5, 20, ["Clan Spirit Sword"], 55],
  ["corsair", "Sea-Raider's Child (海寇遗孤)", "Raised on a reaver fleet among salt, blood and stolen relics, you learned the knife before the brush.", -8, 24, ["Coarse Iron Saber"], 45],
  ["temple", "Temple Foundling (古刹弃儿)", "Left at a mountain monastery's gate and raised on sutras and cold gruel; the bells still ring in your dreams.", 6, 4, ["Annotated Dao Classic"], 60],
  ["physician", "Physician's Child (杏林之家)", "Raised among herbs and silver needles, you could tell a poppy from a poison blindfold before you could read.", 8, 18, ["Spirit Herb Bundle"], 55],
  ["nomad", "Steppe Nomad (草原牧民)", "Born to the horse-clans under open sky — hardy, far-wandering, and a stranger to every sect.", 0, 8, [], 70],
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
  ["Every flower in the valley bloomed at once the night you were born, then withered by dawn.", 1, 0, 1, 1, 18],
  ["A two-headed serpent was found coiled on the threshold, and could not be killed.", 0, 1, 0, -2, 16],
  ["Nine cranes flew down and kept vigil on the roof-ridge until you were named.", 1, 0, 1, 2, 9],
  ["The dry well ran with sweet wine for the space of a single breath.", 0, 0, 0, 3, 12],
  ["A meteor fell into the western hills the hour of your birth; treasure-hunters dig for it still.", 1, 1, 0, 1, 14],
  ["Your grandmother dreamed of a golden dragon coiling into your mother's womb.", 2, 1, 1, 1, 7],
  ["The family's old blind dog stared at your cradle and howled for three nights running.", 0, 0, 1, -3, 20],
  ["Frost-flowers spread across every window though it was the height of summer.", 1, 0, 1, 0, 16],
  ["You did not breathe for a full minute — then laughed, instead of crying.", 2, 0, 1, -1, 12],
  ["A wandering monk left a single copper coin in your swaddling and walked away without a word.", 0, 0, 1, 2, 14],
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
  mountain_render: ["Mountain-Splitting Sunder (裂山诀)", 2, 0.20, 14, "An Earth art that shatters a foe's guard, leaving their defenses rent and open."],
  flowing_light: ["Flowing-Light Sword (流光剑诀)", 2, 0.22, 12, "Quicksilver sword-light that scores a foe's armour with every glittering pass."],
  soul_reap: ["Soul-Reaping Scythe (夺魂镰)", 3, 0.40, 18, "A demonic scythe that reaps a faltering foe's very soul — death to the near-dead."],
  // — sect-exclusive signature arts (taught only by their sect, at high rank) —
  cloudmist_veil: ["Cloud-Mist Veiling Art (云雾隐)", 3, 0.30, 12, "Cloud Mist's hidden art — wreathe yourself in mist, shielded, serene, untouchable."],
  fiveelem_cycle: ["Five Elements Rotation (五行轮转)", 3, 0.42, 20, "Turn the five phases in endless cycle, each blow striking a foe's weakness."],
  spiritbeast_primal: ["Primal Beast Descent (蛮兽降世)", 3, 0.40, 22, "Call the savage spirit of the primordial beasts down into your own flesh."],
  azure_formation: ["Azure Sword Formation (青云剑阵)", 3, 0.55, 26, "The Azure Cloud Sect's grand formation of ten thousand azure flying swords."],
  heavensword_myriad: ["Ten-Thousand Swords Return (万剑归宗)", 3, 0.60, 30, "The Heavenly Sword Sect's supreme art — every blade under heaven heeds your call."],
  bloodcult_sea: ["Boundless Blood Sea (血海无边)", 3, 0.45, 22, "Drown the world in a sea of blood that feeds your every wound. The heavens recoil."],
};

/* Movement arts (轻功): a light-body discipline letting a cultivator skim rivers
 * and leap whole mountains. The more you practise, the more road-stages you
 * cover with each travel deed — so the realm shrinks as your footwork ripens.
 * [key, name, cn, tier (price band), maxSpeed (extra stages/deed at mastery), blurb] */
export const MOVEMENT_ARTS = [
  ["windstep",   "Wind-Treading Step",  "微风踏",   0, 1, "A basic light-body skill — skim a half-step above the dust, tireless on the road."],
  ["cloudstride","Cloud-Soaring Stride","踏云步",   1, 2, "Tread the empty air as if on cloud, crossing a valley in a single bound."],
  ["shrink_inch","Inch-Shrinking Step", "缩地成寸", 2, 3, "Fold the road beneath your feet — a thousand li shrink to a single inch."],
  ["void_rift",  "Void-Rift Shift",     "虚空挪移", 3, 4, "Tear a seam in space and step through it; mountains are no barrier at all."],
];
export const MOVEMENT_BY_KEY = Object.fromEntries(MOVEMENT_ARTS.map(m => [m[0], m]));

// [key, display, charmBonus, blurb, weight]
export const APPEARANCES = [
  ["hideous", "Hideous (丑陋)", -25, "Scarred and misshapen; strangers flinch and look away.", 35],
  ["weathered", "Weathered (沧桑)", -3, "A hard, careworn face that has seen too much too young — but there's a flinty appeal in it.", 120],
  ["plain", "Plain (相貌平平)", -8, "An utterly forgettable face in any crowd.", 180],
  ["ordinary", "Ordinary (寻常)", 0, "Neither handsome nor homely -- simply unremarkable.", 320],
  ["comely", "Comely (清秀)", 10, "Pleasant to look upon, with clear bright eyes.", 200],
  ["roguish", "Roguish (风流)", 16, "A wicked, careless handsomeness that charms even as it warns.", 95],
  ["striking", "Striking (俊美)", 22, "Strikingly handsome; heads turn when you pass.", 110],
  ["ethereal", "Ethereal Fairness (空灵之美)", 30, "A delicate, otherworldly fairness, as though you were not quite made for this world.", 50],
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

export const ROOT_TIER = { none:0, waste:0, quad:1, triple:2, dual:3, heavenly:4, swordroot:4, variant:5, thunderroot:5, iceroot:5, voidroot:5, chaos:6 };
// Representative root for a given tier (used by bloodline genetics).
export const ROOT_BY_TIER = { 0:"waste", 1:"quad", 2:"triple", 3:"dual", 4:"heavenly", 5:"variant", 6:"chaos" };

// [name, minRealm, minContribution, speedBonus, stipend, minMissions, minReputation]
// Promotion now also demands missions run for the sect and a name worth the rank;
// from Core Disciple up, a promotion trial-by-combat stands between the ranks.
export const SECT_RANKS = [
  ["Outer Disciple (外门弟子)", 0, 0,    0.00, 2,    0,  0],
  ["Inner Disciple (内门弟子)", 2, 60,   0.10, 6,    2,  0],
  ["Core Disciple (核心弟子)", 3, 220,  0.22, 16,   5,  25],
  ["Elder (长老)",             4, 650,  0.38, 45,   9,  60],
  ["Grand Elder (太上长老)",   6, 2200, 0.58, 120,  14, 120],
  ["Sect Master (宗主)",       7, 6500, 0.85, 300,  20, 200],
];
// A promotion trial pits you against a rank-guardian whose strength scales with
// the rank you reach into (index by the target rank). 0 = no trial (auto).
export const SECT_TRIAL_FACTOR = [0, 0, 0.85, 1.0, 1.2, 1.5];

// Each sect teaches its own arts, unlocked as you climb its ranks and paid for in
// contribution. The last entry of each is the sect's exclusive signature art.
// [techKey, minRank (index into SECT_RANKS), contributionCost]
export const SECT_ARTS = {
  cloudmist:   [["azure_cloud", 0, 35], ["moon_mirror", 1, 110], ["mirror_parry", 2, 220], ["cloudmist_veil", 3, 460]],
  fiveelem:    [["frost_lotus", 0, 45], ["tide_palm", 1, 110], ["mountain_seal", 1, 130], ["mountain_render", 2, 240], ["nine_yang", 2, 230], ["fiveelem_cycle", 3, 480]],
  spiritbeast: [["five_beasts", 0, 35], ["spirit_bind", 1, 120], ["vajra_body", 2, 220], ["spiritbeast_primal", 3, 470]],
  azure:       [["azure_cloud", 0, 45], ["sword_rain", 1, 140], ["flowing_light", 2, 250], ["great_void", 3, 430], ["azure_formation", 4, 820]],
  heavensword: [["sword_rain", 0, 55], ["thunder_step", 1, 150], ["flowing_light", 2, 250], ["heaven_slash", 3, 440], ["heavensword_myriad", 4, 920]],
  bloodcult:   [["blood_refine", 0, 45], ["spirit_bind", 1, 120], ["soul_reap", 2, 260], ["samsara_palm", 3, 440], ["bloodcult_sea", 3, 480]],
};

// [name, minRank, contribution, stones, danger, blurb, reward?]
// reward (optional): "herbs" | "pill" | "rep" | "treasure" — a flavourful bonus
// beyond the usual stones, so missions vary in what they give as well as ask.
export const SECT_QUESTS = [
  // — Outer Disciple chores —
  ["Tend the Spirit Herb Gardens", 0, 8, 4, 0.05, "Quiet, patient work weeding the sect's spirit fields.", "herbs"],
  ["Patrol the Outer Mountain", 0, 14, 8, 0.25, "Walk the boundary wards and chase off stray beasts."],
  ["Gather Frost Lotus on the Cold Peak", 0, 20, 12, 0.30, "Climb the freezing summit for a rare alchemical bloom.", "herbs"],
  ["Sweep the Ancestral Hall", 0, 10, 5, 0.02, "Dust the patriarchs' tablets and trim ten thousand candle-wicks."],
  ["Carry a Message to a Branch Hall", 0, 16, 10, 0.18, "Run a sealed dispatch down the mountain roads before the new moon."],
  // — Inner Disciple duties —
  ["Hunt a Rampaging Spirit Beast", 1, 38, 26, 0.55, "A horned beast has been savaging the foothill villages."],
  ["Subjugate a Rogue Cultivator", 1, 55, 42, 0.60, "A masked rogue has been robbing the sect's outer disciples."],
  ["Guard the Treasury by Night", 1, 44, 30, 0.40, "Stand the midnight watch over the sect's vault of relics."],
  ["Recover Stolen Sect Manuals", 1, 62, 40, 0.58, "Thieves made off with three jade slips of the sect's arts — get them back.", "rep"],
  // — Core Disciple charges —
  ["Escort an Elder's Caravan", 2, 90, 64, 0.45, "Guard a treasure caravan across bandit-haunted passes."],
  ["Cleanse a Demonic Nest", 2, 150, 115, 0.72, "Burn out a corpse-refiner's lair festering in the marsh."],
  ["Win Face at an Allied Sect's Feast", 2, 110, 70, 0.20, "Represent the sect at a grand banquet; do not lose face.", "rep"],
  ["Tend the Grand Alchemy Furnace", 2, 120, 60, 0.35, "Mind a month-long refining; the elders will share the pills.", "pill"],
  // — Elder commissions —
  ["Chart a Secret Realm Rift", 3, 280, 210, 0.66, "Enter a newly-opened ruin and map its perils for the sect."],
  ["Slay a Devil-Path Elder", 3, 360, 240, 0.80, "A demonic elder has cursed the sect's water; end them.", "treasure"],
  ["Negotiate a Border Truce", 3, 300, 180, 0.30, "Broker peace with a jealous neighbour sect before blood is spilled.", "rep"],
  // — Grand Elder undertakings —
  ["Lead a Punitive Expedition", 4, 620, 460, 0.78, "Take a war-band to humble a sect that slighted yours."],
  ["Seal a Rampaging Earth Dragon", 4, 760, 520, 0.85, "An ancient dragon stirs beneath the spirit vein; bind it or die.", "treasure"],
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

// Equipment slots — a cultivator binds one treasure per slot.
// [key, name, cn, icon, blurb]
export const EQUIP_SLOTS = [
  ["weapon",    "Weapon",         "兵器", "⚔️", "Flying swords, blades and spears — your raw killing power."],
  ["treasure",  "Magic Treasure", "法宝", "🔮", "Offensive dharma treasures that channel spells and qi."],
  ["robe",      "Robe",           "法袍", "🥋", "Defensive robes and armour that turn aside blows and harden the body."],
  ["headpiece", "Headpiece",      "宝冠", "👑", "Crowns and diadems that sharpen the spirit and quicken cultivation."],
  ["boots",     "Boots",          "灵靴", "🥾", "Footwork treasures — evade blows and outpace any foe."],
  ["ring",      "Ring & Pendant", "戒指", "💍", "Rings and pendants holding varied arts: qi, lifesteal, fortune."],
];
export const EQUIP_SLOT_KEYS = EQUIP_SLOTS.map(s => s[0]);
export const EQUIP_SLOT_BY_KEY = Object.fromEntries(EQUIP_SLOTS.map(s => [s[0], s]));

// [key, name, slot, grade, effects, blurb]
// effects keys (all optional, fractions unless noted):
//   atk  — % combat power           qi   — % cultivation/qi speed
//   def  — flat combat mitigation    hp   — % max battle HP
//   dodge— flat dodge chance         crit — flat crit chance
//   life — passive lifesteal on hits qiMax— % max qi pool
export const ARTIFACTS = [
  // ── Weapons (兵器) ──────────────────────────────────────────────────────
  ["iron_sword",      "Chipped Iron Sword",        "weapon", "Mortal",   { atk: 0.06, crit: 0.02 },                     "A mortal-forged blade, barely a cut above a farmer's tool."],
  ["bronze_saber",    "Bronze Ringed Saber",       "weapon", "Mortal",   { atk: 0.07 },                                 "A heavy ring-pommel saber; ungainly, but it bites."],
  ["green_spear",     "Greenwood Spirit Spear",    "weapon", "Spirit",   { atk: 0.15, crit: 0.03 },                     "A spear grown from a thousand-year spirit-bamboo; light, swift and keen."],
  ["azure_sword",     "Azure Flying Sword",        "weapon", "Spirit",   { atk: 0.16, qi: 0.02, crit: 0.04 },           "A true flying sword that hums and circles at its master's will."],
  ["python_whip",     "Coiling Python Whip",       "weapon", "Spirit",   { atk: 0.14, dodge: 0.04 },                    "A barbed spirit-whip that lashes and recoils, hard to corner against."],
  ["moonfrost_sabre", "Moon-Frost Sabre",          "weapon", "Earth",    { atk: 0.30, crit: 0.06 },                     "A curved sabre wreathed in cold light that bites deeper with every draw."],
  ["vermilion_blade", "Vermilion Blood Blade",     "weapon", "Earth",    { atk: 0.32, life: 0.06 },                     "A devil-path blade slick with old blood that feeds on the wounds it makes."],
  ["thunder_halberd", "Thunderclap Halberd",       "weapon", "Earth",    { atk: 0.33, crit: 0.05 },                     "A great halberd that cracks like a thunderhead with every sweep."],
  ["seven_star_sword","Seven-Star Northern Sword", "weapon", "Heaven",   { atk: 0.52, crit: 0.10 },                     "Forged under the seven stars of the north; its edge splits starlight."],
  ["heaven_cleaver",  "Heaven-Cleaving Greatsword","weapon", "Heaven",   { atk: 0.58, crit: 0.05, hp: 0.05 },           "A colossal blade said to have once parted a mountain in a single stroke."],
  ["dragonbone_spear","Dragonbone War Spear",      "weapon", "Heaven",   { atk: 0.54, hp: 0.06 },                       "Wrought from a true dragon's spine; it strikes with the weight of a leviathan."],
  ["glacial_sword",   "Glacial Tide Sword",        "weapon", "Heaven",   { atk: 0.53, crit: 0.08 },                     "A blade of everfrost that sheathes the foe in killing rime with each stroke."],
  ["thunderbolt_spear","Thunderbolt Sky-Spear",    "weapon", "Heaven",   { atk: 0.54, crit: 0.07 },                     "A spear that draws down the sky's own thunder at the thrust."],
  ["taibai_sword",    "Tai-Bai Immortal Sword",    "weapon", "Immortal", { atk: 0.94, crit: 0.14 },                     "An immortal's sword-spirit; one cut severs cause from effect."],
  ["mountain_axe",    "Mountain-Splitting Axe",    "weapon", "Immortal", { atk: 0.90, def: 0.08 },                      "A primordial axe that cleaves peaks; its haft alone could anchor a sect."],
  ["blood_scythe",    "Abyssal Blood Scythe",      "weapon", "Immortal", { atk: 0.90, life: 0.10 },                     "A devil-immortal's scythe that reaps life and pours it into its wielder."],
  // ── Magic Treasures (法宝) ──────────────────────────────────────────────
  ["talisman",        "Yellow Paper Talisman",     "treasure", "Mortal",   { atk: 0.05, def: 0.02 },                    "A bundle of crude warding charms."],
  ["spirit_bottle",   "Azure Spirit-Gathering Bottle","treasure","Spirit", { atk: 0.10, qi: 0.08 },                     "A slender vase that inhales ambient spirit-qi and breathes it back into you."],
  ["frost_mirror",    "Frost-Moon Mirror",         "treasure", "Spirit",   { atk: 0.14, qi: 0.05, def: 0.04 },          "A cold silver disc that drinks moonlight and turns a foe's spells back as ice."],
  ["wood_vine",       "Verdant Wood-Spirit Vine",  "treasure", "Spirit",   { atk: 0.15, life: 0.04 },                   "A living vine-treasure that snares the foe and siphons their vitality."],
  ["flame_gourd",     "Crimson Flame Gourd",       "treasure", "Earth",    { atk: 0.30, qi: 0.05 },                     "Belches a torrent of spirit-fire that melts iron and beast alike."],
  ["element_pagoda",  "Five Elements Pagoda",      "treasure", "Earth",    { atk: 0.28, qi: 0.10 },                     "A layered treasure-pagoda that grinds enemies between the five elements."],
  ["bone_banner",     "Ten-Thousand Ghost Banner", "treasure", "Earth",    { atk: 0.30, life: 0.06 },                   "A demonic banner that looses a howling tide of vengeful spirits."],
  ["thunder_drum",    "Nine-Heaven Thunder Drum",  "treasure", "Earth",    { atk: 0.34, crit: 0.05 },                   "One beat looses the wrath of heaven; thunder rolls across the field."],
  ["soulbind_mirror", "Soul-Binding Bronze Mirror","treasure", "Earth",    { atk: 0.26, def: 0.06 },                    "An ancient mirror that pins a foe's spirit in place and dulls their blows."],
  ["dragon_cauldron", "Nine Dragon Cauldron",      "treasure", "Heaven",   { atk: 0.55, qi: 0.16 },                     "Nine dragons coil its rim; it can smelt mountains and refine pills."],
  ["stars_banner",    "River-of-Stars Banner",     "treasure", "Heaven",   { atk: 0.50, qi: 0.20 },                     "Unfurls a galaxy of killing starlight across the battlefield."],
  ["phoenix_plume",   "Vermilion Phoenix Plume",   "treasure", "Heaven",   { atk: 0.52, hp: 0.10, life: 0.05 },         "A single undying feather wreathed in nirvanic flame that burns and reblooms."],
  ["quaking_seal",    "Heaven-Quaking Mountain Seal","treasure","Heaven",  { atk: 0.50, def: 0.10 },                    "A jade seal heavy as a mountain range; it crushes foes and steadies its bearer."],
  ["bodhi_seed",      "World-Tree Bodhi Seed",     "treasure", "Heaven",   { atk: 0.50, hp: 0.12, life: 0.05 },         "A seed of the world-tree that buds endless verdant life around its bearer."],
  ["deluge_pearl",    "Great Deluge Pearl",        "treasure", "Heaven",   { atk: 0.52, qi: 0.10 },                     "A pearl that calls a drowning deluge to sweep the battlefield clean."],
  ["demon_pagoda",    "Demon-Sealing Pagoda",      "treasure", "Heaven",   { atk: 0.52, def: 0.10 },                    "A black pagoda that swallows devil-qi and seals fiends within its tiers."],
  ["chaos_bell",      "Primordial Chaos Bell",     "treasure", "Immortal", { atk: 0.95, def: 0.10, qiMax: 0.20 },       "A bell from the dawn of the world; one toll unmakes ten thousand spells."],
  ["samsara_disk",    "Wheel-of-Samsara Disk",     "treasure", "Immortal", { atk: 0.88, qi: 0.20, life: 0.10 },         "An immortal artifact that turns the wheel of rebirth, grinding all things back to dust."],
  ["taiyi_vase",      "Taiyi Purifying-Water Vase","treasure", "Immortal", { atk: 0.85, hp: 0.15, life: 0.06 },         "Pours the immortal waters of Taiyi; they drown calamity and mend the body."],
  ["glacial_coffin",  "Glacial Soul Coffin",       "treasure", "Immortal", { atk: 0.84, def: 0.12 },                    "An immortal coffin of black ice that entombs a foe's spirit in eternal winter."],
  ["nine_thunder_gourd","Nine-Thunder Calabash",   "treasure", "Immortal", { atk: 0.88, crit: 0.10 },                   "A calabash that brews nine heavenly thunders and pours them out as ruin."],
  // ── Robes & Armour (法袍) ───────────────────────────────────────────────
  ["cloth_robe",      "Coarse Cloth Robe",         "robe", "Mortal",   { def: 0.03, hp: 0.03 },                        "Plain spun cloth — better than baring your skin to a blade."],
  ["hide_vest",       "Beast-Hide Vest",           "robe", "Mortal",   { def: 0.04 },                                  "Cured hide from a low spirit-beast; coarse, but it turns a claw."],
  ["spirit_silk_robe","Spirit-Silk Robe",          "robe", "Spirit",   { def: 0.06, hp: 0.06 },                        "Woven from spirit-silkworm thread; light, cool, and quietly tough."],
  ["mistcloud_robe",  "Mistcloud Daoist Robe",     "robe", "Spirit",   { def: 0.07, qi: 0.04 },                        "A drifting grey robe that blurs your outline and settles a restless qi."],
  ["goldscale_robe",  "Golden-Scale War Robe",     "robe", "Earth",    { def: 0.12, hp: 0.12, atk: 0.04 },             "Overlapping spirit-gold scales that shrug off both blade and spell."],
  ["tortoise_robe",   "Black-Tortoise Profound Robe","robe","Earth",   { def: 0.16, hp: 0.15 },                        "Bears the sigil of the Black Tortoise; its wearer endures like a mountain."],
  ["vermilion_armor", "Vermilion Battle Armor",    "robe", "Earth",    { def: 0.13, hp: 0.10, crit: 0.03 },            "Lacquered blood-red plate favoured by devil-path warriors; built to trade blows."],
  ["star_robe",       "Star-Patterned Celestial Robe","robe","Heaven", { def: 0.20, hp: 0.20, qi: 0.05 },              "Constellations drift across its silk, sheltering you beneath the heavens."],
  ["nirvana_robe",    "Nirvana Phoenix Feather-Robe","robe","Heaven",  { def: 0.22, hp: 0.22, life: 0.05 },            "Plumed with phoenix down; wounds close as fast as they open."],
  ["dragonscale_mail","Azure Dragon Scale Mail",   "robe", "Heaven",   { def: 0.21, hp: 0.18, atk: 0.05 },             "Mail forged from a true dragon's shed scales; it answers blows with menace."],
  ["chaos_lotus_robe","Chaos Azure-Lotus Robe",    "robe", "Immortal", { def: 0.30, hp: 0.30, qiMax: 0.15 },           "An immortal lotus folded into a robe; calamity slides off its petals."],
  ["yinyang_robe",    "Primordial Yin-Yang Robe",  "robe", "Immortal", { def: 0.28, hp: 0.26, qi: 0.10 },              "Woven of intertwined yin and yang; it balances every force turned against you."],
  // ── Headpieces (宝冠) ───────────────────────────────────────────────────
  ["jade_pin",        "Jade Hairpin",              "headpiece", "Mortal",   { qi: 0.02, qiMax: 0.04 },                  "A cool jade pin that steadies a restless mind."],
  ["bronze_helm",     "Bronze War Helm",           "headpiece", "Mortal",   { def: 0.03, hp: 0.03 },                    "A dented foot-soldier's helm; humble protection for a hard head."],
  ["soulsense_circlet","Soul-Sense Circlet",       "headpiece", "Spirit",   { qi: 0.05, qiMax: 0.10, crit: 0.02 },      "A silver circlet that widens the spirit's eye."],
  ["spirit_band",     "Spirit-Eye Headband",       "headpiece", "Spirit",   { qi: 0.06, crit: 0.03 },                   "A woven band that opens the spirit-eye, spotting the gap before a strike."],
  ["cloud_crown",     "Purple-Gold Cloud Crown",   "headpiece", "Earth",    { qi: 0.10, qiMax: 0.15, def: 0.04 },       "A heavy crown of purple-gold that gathers ambient qi while you sit in meditation."],
  ["thunder_helm",    "Thunder-Pattern Battle Helm","headpiece","Earth",   { hp: 0.10, def: 0.05, crit: 0.05 },        "A war-helm graven with thunder sigils; it steels the body and sharpens the killing blow."],
  ["phoenix_coronet", "Nine-Phoenix Coronet",      "headpiece", "Heaven",   { qi: 0.16, qiMax: 0.20, crit: 0.05 },      "Nine phoenixes take wing about its brow, kindling insight."],
  ["starlit_crown",   "Starlit Phoenix Crown",     "headpiece", "Heaven",   { qi: 0.14, qiMax: 0.18, hp: 0.08 },        "A crown crowned with starfire that nourishes both spirit and flesh."],
  ["frostmoon_coronet","Frost-Moon Coronet",       "headpiece", "Heaven",   { qi: 0.14, qiMax: 0.18, def: 0.05 },       "A coronet of unmelting ice-jade that cools the mind to perfect, cutting clarity."],
  ["dao_diadem",      "Heavenly Dao Diadem",       "headpiece", "Immortal", { qi: 0.28, qiMax: 0.30, crit: 0.08 },      "A diadem inscribed with the Great Dao itself; comprehension flows like water."],
  ["primal_crown",    "Primordial Spirit Crown",   "headpiece", "Immortal", { qi: 0.26, qiMax: 0.28, crit: 0.06 },      "Bound to a primordial spirit; it floods the sea of consciousness with insight."],
  // ── Boots (灵靴) ────────────────────────────────────────────────────────
  ["straw_sandals",   "Straw Sandals",             "boots", "Mortal",   { dodge: 0.02 },                                "Humble woven sandals — light enough for a quick step aside."],
  ["travel_boots",    "Leather Travel Boots",      "boots", "Mortal",   { dodge: 0.02, hp: 0.02 },                      "Sturdy boots broken in on a thousand li of road; they keep you upright and moving."],
  ["cloud_boots",     "Cloud-Striding Boots",      "boots", "Spirit",   { dodge: 0.10, qi: 0.03 },                      "Tread the wind itself; foes struggle to pin you down."],
  ["mistwalk_slippers","Mist-Walking Slippers",    "boots", "Spirit",   { dodge: 0.09, qi: 0.04 },                      "Silent slippers that leave no print; mist gathers at the heel."],
  ["windwalk_greaves","Wind-Walking Greaves",      "boots", "Earth",    { dodge: 0.15, crit: 0.04 },                    "Each stride blurs into wind; you strike from where you are not."],
  ["flametread_boots","Flame-Tread War Boots",     "boots", "Earth",    { dodge: 0.13, atk: 0.06 },                     "Boots that scorch the ground at a sprint, carrying you into the foe like a comet."],
  ["shadowstep_boots","Shadow-Step Boots",         "boots", "Heaven",   { dodge: 0.20, atk: 0.06 },                     "Step through your own shadow to flank and vanish at will."],
  ["ninecloud_boots", "Nine-Cloud Soaring Boots",  "boots", "Heaven",   { dodge: 0.19, qi: 0.06 },                      "Ride nine layered clouds; the higher you soar, the freer your qi flows."],
  ["void_boots",      "Void-Treading Sky Boots",   "boots", "Immortal", { dodge: 0.28, crit: 0.08, atk: 0.08 },         "Walk on nothing at all; the void itself yields the road."],
  ["starstep_boots",  "Star-Stepping Immortal Boots","boots","Immortal",{ dodge: 0.26, qiMax: 0.15 },                   "Stride from star to star; distance means nothing, and the heavens lend their qi."],
  ["gale_boots",      "Gale-Riding Immortal Boots","boots", "Immortal", { dodge: 0.27, atk: 0.08 },                     "Ride a screaming gale into the fray; the wind itself flanks for you."],
  // ── Rings & Pendants (戒指) ─────────────────────────────────────────────
  ["copper_ring",     "Plain Copper Ring",         "ring", "Mortal",   { qi: 0.02 },                                   "A nameless ring with a faint qi-gathering array etched inside."],
  ["jade_ring",       "Jade Spirit Ring",          "ring", "Mortal",   { qi: 0.03, hp: 0.02 },                         "A smooth jade band, cool against the skin, that quiets and steadies the qi."],
  ["storage_ring",    "Spirit Storage Ring",       "ring", "Spirit",   { qi: 0.05, qiMax: 0.08 },                      "A storage ring whose hidden world hums with gathered spirit qi."],
  ["taming_pendant",  "Beast-Taming Jade Pendant", "ring", "Spirit",   { atk: 0.05, qi: 0.04 },                        "A pendant carved with a beast-soothing array; spirit-beasts heed its bearer."],
  ["bloodjade_ring",  "Blood-Jade Ring",           "ring", "Earth",    { life: 0.10, atk: 0.06 },                      "Carved from blood-jade; it drinks a foe's vitality back into yours."],
  ["fortune_pendant", "Fortune Dragon Pendant",    "ring", "Earth",    { crit: 0.06, qi: 0.06 },                       "A coiled-dragon pendant that nudges fate toward the telling blow."],
  ["lifewood_ring",   "Verdant Lifewood Ring",     "ring", "Earth",    { hp: 0.10, life: 0.06 },                       "A ring grown from world-tree heartwood; it nurses the body through any wound."],
  ["heaven_ring",     "Heaven-Refining Ring",      "ring", "Heaven",   { qi: 0.14, qiMax: 0.18, atk: 0.06 },           "A ring-furnace that refines raw heaven-and-earth qi as you wear it."],
  ["astral_ring",     "Astral Star Ring",          "ring", "Heaven",   { crit: 0.08, qi: 0.08 },                       "Set with a captured star; it sharpens the eye to the one fatal opening."],
  ["tidewater_ring",  "Tidewater Spirit Ring",     "ring", "Heaven",   { qi: 0.12, hp: 0.10 },                         "A ring brimming with an inner sea; its tides buoy both qi and flesh."],
  ["samsara_ring",    "Samsara True-Spirit Ring",  "ring", "Immortal", { qi: 0.20, life: 0.12, crit: 0.06 },           "An immortal ring binding a true-spirit that mends and sharpens its master."],
  ["chaos_ring",      "Chaos Spirit-Treasure Ring","ring", "Immortal", { qi: 0.16, qiMax: 0.16, def: 0.08 },           "A ring holding a sliver of primordial chaos; it shores up body, qi and soul alike."],
];
export const ARTIFACT_BY_KEY = Object.fromEntries(ARTIFACTS.map(a => [a[0], a]));

// Elemental affinity (五行 / 灵属性): many treasures carry an element. Equipping
// them attunes you to it — your matching-element arts strike harder and you
// resist that element in turn (see combat). Kept as a side-map so the item rows
// stay a clean fixed shape. Themed sets share an element, so a full set deepens
// one attunement (Five-Thunder → Lightning, Vermilion Blood Path → Dark, …).
export const ARTIFACT_ELEMENT = {
  // weapons
  green_spear: "Wood", azure_sword: "Metal", python_whip: "Wood", moonfrost_sabre: "Ice",
  vermilion_blade: "Dark", thunder_halberd: "Lightning", seven_star_sword: "Metal",
  heaven_cleaver: "Metal", dragonbone_spear: "Earth", glacial_sword: "Ice", thunderbolt_spear: "Lightning",
  taibai_sword: "Metal", mountain_axe: "Earth", blood_scythe: "Dark",
  // treasures
  flame_gourd: "Fire", frost_mirror: "Ice", bone_banner: "Dark", thunder_drum: "Lightning",
  dragon_cauldron: "Fire", stars_banner: "Light", phoenix_plume: "Fire", quaking_seal: "Earth",
  bodhi_seed: "Wood", deluge_pearl: "Water", demon_pagoda: "Dark", chaos_bell: "Chaos",
  samsara_disk: "Void", wood_vine: "Wood", soulbind_mirror: "Light", taiyi_vase: "Water",
  glacial_coffin: "Ice", nine_thunder_gourd: "Lightning",
  // robes
  tortoise_robe: "Water", vermilion_armor: "Dark", nirvana_robe: "Fire", dragonscale_mail: "Metal",
  // headpieces
  thunder_helm: "Lightning", phoenix_coronet: "Fire", starlit_crown: "Light", frostmoon_coronet: "Ice",
  // boots
  flametread_boots: "Fire", windwalk_greaves: "Wind", ninecloud_boots: "Wind", gale_boots: "Wind",
  // rings
  bloodjade_ring: "Dark", lifewood_ring: "Wood", astral_ring: "Light", chaos_ring: "Chaos", tidewater_ring: "Water",
};
// Effect accessors (index-independent so the data shape can evolve safely).
export const artifactSlot    = key => { const a = ARTIFACT_BY_KEY[key]; return a ? a[2] : null; };
export const artifactGrade   = key => { const a = ARTIFACT_BY_KEY[key]; return a ? a[3] : null; };
export const artifactEffects = key => { const a = ARTIFACT_BY_KEY[key]; return (a && a[4]) || {}; };
export const artifactElement = key => ARTIFACT_ELEMENT[key] || null;

// Equipment sets (套装): bind matched treasures across slots for escalating
// bonuses (keyed by how many pieces are equipped). Members must sit in distinct
// slots so a full set can be worn at once.
// { key, name, cn, blurb, members:[artifactKey…], bonuses:{ count: effects } }
export const EQUIP_SETS = [
  { key: "azure_cloud", name: "Azure Cloud Wanderer", cn: "青云游侠", blurb: "The travelling sword-cultivator's kit: a keen flying sword, wind-treading boots and a humming storage ring.",
    members: ["azure_sword", "cloud_boots", "storage_ring"],
    bonuses: { 2: { dodge: 0.05 }, 3: { atk: 0.08, crit: 0.05 } } },
  { key: "nirvana_phoenix", name: "Nirvana Phoenix Regalia", cn: "涅槃神凰", blurb: "Plume, feather-robe and coronet of the undying phoenix — wounds close as fast as they open.",
    members: ["phoenix_plume", "nirvana_robe", "phoenix_coronet"],
    bonuses: { 2: { hp: 0.08 }, 3: { hp: 0.12, life: 0.10 } } },
  { key: "samsara_dao", name: "Samsara Immortal Dao", cn: "轮回仙道", blurb: "The wheel-disk, true-spirit ring and dao diadem turning as one — the great cycle bends to your will.",
    members: ["samsara_disk", "samsara_ring", "dao_diadem"],
    bonuses: { 2: { qi: 0.10, qiMax: 0.08 }, 3: { atk: 0.15, life: 0.10 } } },
  { key: "vermilion_path", name: "Vermilion Blood Path", cn: "赤血魔道", blurb: "Blood-blade, blood-red plate and blood-jade ring — a devil-path kit that turns every wound into your gain.",
    members: ["vermilion_blade", "vermilion_armor", "bloodjade_ring"],
    bonuses: { 2: { life: 0.06 }, 3: { atk: 0.10, life: 0.10 } } },
  { key: "five_thunder", name: "Five-Thunder Panoply", cn: "五雷战甲", blurb: "Halberd, war-helm and thunder-drum sounding as one storm — every blow lands like a falling bolt.",
    members: ["thunder_halberd", "thunder_helm", "thunder_drum"],
    bonuses: { 2: { crit: 0.06 }, 3: { atk: 0.10, crit: 0.08 } } },
  { key: "primordial_chaos", name: "Primordial Chaos Vestments", cn: "混元道袍", blurb: "Chaos bell, azure-lotus robe and chaos spirit-ring — relics from the dawn of the world, worn as one.",
    members: ["chaos_bell", "chaos_lotus_robe", "chaos_ring"],
    bonuses: { 2: { qiMax: 0.12, def: 0.06 }, 3: { atk: 0.18, def: 0.12, qiMax: 0.15 } } },
];
// member artifact key -> set key
export const SET_OF_ARTIFACT = Object.fromEntries(
  EQUIP_SETS.flatMap(s => s.members.map(k => [k, s.key])));
export const SET_BY_KEY = Object.fromEntries(EQUIP_SETS.map(s => [s.key, s]));

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
  ["comprehension", "Spirit-Enlightening Pill", 6, 0.50, "Clears the sea of consciousness; permanently sharpens Comprehension."],
  ["charm", "Jade-Countenance Pill", 4, 0.58, "Refines the flesh to an immortal's grace; permanently raises Charm."],
  ["daoheart", "Heart-Calming Pill", 5, 0.52, "Stills the turbid heart; permanently steels your Dao Heart against demons."],
  ["fortune", "Heaven-Fortune Pill", 9, 0.32, "A near-mythical pill said to coax the threads of fate; permanently nudges Fortune."],
  ["longevity", "Nine-Turn Longevity Pill", 12, 0.30, "The grandmaster's art -- adds precious years to your lifespan."],
];
export const PILL_BY_KEY = Object.fromEntries(PILL_RECIPES.map(p => [p[0], p]));

/* Talismans (符箓): one-use paper charms inscribed with spirit-script. In battle
 * each is a powerful instant action that costs no qi — but once spent, it's gone.
 * Bought at the Market or inscribed yourself (costs herbs; soul eases success). */
export const TALISMANS = {
  flame:   { name: "Flame-Burst Talisman", cn: "火符", kind: "attack", value: 0.85, element: "Fire", herbs: 3, price: 30, desc: "Erupts in a gout of spirit-fire." },
  frost:   { name: "Frost-Seal Talisman", cn: "冰封符", kind: "attack", value: 0.70, element: "Ice", herbs: 3, price: 34, desc: "Killing frost; may freeze the foe." },
  thunder: { name: "Thunderbolt Talisman", cn: "雷符", kind: "attack", value: 0.98, element: "Lightning", herbs: 4, price: 40, desc: "Calls down heaven's lightning." },
  sword:   { name: "Flying-Sword Talisman", cn: "飞剑符", kind: "attack", value: 0.90, element: "Metal", herbs: 4, price: 38, desc: "Looses a phantom flying sword." },
  shield:  { name: "Golden-Bell Talisman", cn: "金钟符", kind: "shield", value: 0.65, element: null, herbs: 2, price: 26, desc: "A golden bell of qi absorbs blows." },
  heal:    { name: "Spirit-Mending Talisman", cn: "回春符", kind: "heal", value: 0.45, element: null, herbs: 3, price: 32, desc: "Knits your wounds in warm light." },
  bind:    { name: "Binding Talisman", cn: "缚灵符", kind: "bind", value: 2, element: null, herbs: 3, price: 36, desc: "Soul-script locks the foe in place." },
  escape:  { name: "Escape Talisman", cn: "遁符", kind: "escape", value: 0, element: null, herbs: 2, price: 24, desc: "Tear space and vanish from any fight." },
};
export const TALISMAN_ORDER = ["flame", "frost", "thunder", "sword", "shield", "heal", "bind", "escape"];

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

/* 道之境界 — a comprehended Dao is not static. Through patient meditation it
 * deepens across four tiers of insight, each scaling the law's power and
 * breakthrough bonuses — and from Great Mastery upward, manifesting in battle.
 * A character's per-Dao tier (1..4) lives in c.daoLevels; 1 = freshly Glimpsed. */
export const DAO_MAX_TIER = 4;
// [english, 中文, bonus-scaling factor applied to the Dao's base bonuses]
export const DAO_TIERS = [
  null,                                 // index 0 unused — tiers are 1-based
  ["Glimpsed",      "初窥", 1.00],
  ["Minor Mastery", "小成", 1.60],
  ["Great Mastery", "大成", 2.30],
  ["Consummate",    "圆满", 3.20],
];
const daoTierClamp = lvl => Math.max(1, Math.min(DAO_MAX_TIER, lvl || 1));
export const daoTierFactor = lvl => DAO_TIERS[daoTierClamp(lvl)][2];
export function daoTierLabel(lvl) { const t = DAO_TIERS[daoTierClamp(lvl)]; return `${t[0]} (${t[1]})`; }
export const daoTierName = lvl => DAO_TIERS[daoTierClamp(lvl)][0];

/* Battle manifestations — unlocked at Great Mastery (tier 3) and intensified at
 * Consummation (tier 4). The label shows on a Dao's card; the numbers live in
 * one place, engine.daoBattleMods, so combat just reads the aggregate. */
export const DAO_MANIFEST = {
  sword:     "Sword-heart — a keener edge: +crit in battle.",
  flame:     "Burning law — searing strikes: +crit.",
  thunder:   "Heaven's wrath — punishing blows: +crit and armour-pierce.",
  space:     "Folded space — your form blurs: +dodge.",
  dream:     "Illusion — the foe's eyes deceive them: +dodge.",
  time:      "Stretched moments: +dodge in battle, faster cultivation.",
  vitality:  "Life unending: +battle HP and steady regeneration.",
  void:      "Void edge: your strikes pierce more of the foe's defense.",
  devour:    "Ravenous law: passive lifesteal on every blow.",
  karma:     "Cause & effect — heaven shields you as the battle joins.",
  slaughter: "Killing intent — the foe enters cowed and bleeding.",
};

/* Themed Secret Realms (秘境): a delve is no longer a generic elemental rift but
 * one of these archetypes, lending its element, the mist-wreathed foes that
 * haunt it, the fortunes its rooms tend to hold (fortune bias), a signature
 * between-stage hazard, and a thematically-named guardian at its heart.
 *   element  — drives foe/treasure attunement and the guardian's arts.
 *   kind     — "beast" | "rogue" | null (mixed); shapes the foes within.
 *   foes     — flavour names drawn for the stage battles.
 *   fortune  — which fortune-room this realm favours (see realmFortune):
 *              "treasure" | "spring" | "herb" | "pill" | "insight".
 *   hazard   — signature peril fired between stages (see realmHazard).
 *   guardian — the named boss barring the inner sanctum.
 *   rewardSlot — (optional) treasure slot the realm's spoils favour. */
export const SECRET_REALMS = [
  { key: "swordtomb", name: "Ancient Sword Tomb", cn: "上古剑冢", element: "Metal", kind: "rogue",
    foes: ["Sword Spirit", "Rusted Sword-Puppet", "Tomb Blade-Cultivator", "Vengeful Sabre-Wraith"],
    fortune: "treasure", hazard: "blades", guardian: "the Sword-Tomb Warden", rewardSlot: "weapon",
    blurb: "ten thousand buried blades hum in the dark, each hungry for a worthy hand." },
  { key: "naga", name: "Sunken Naga Palace", cn: "蛟龙水府", element: "Water", kind: "beast",
    foes: ["Naga Sentinel", "Abyssal Drake", "Tide-Maned Hippocamp", "Pearl-Eyed Serpent"],
    fortune: "spring", hazard: "flood", guardian: "the Drowned Naga Lord",
    blurb: "a drowned immortal palace whose halls still brim with cold, living water." },
  { key: "demonabyss", name: "Demon-Sealing Abyss", cn: "镇魔渊", element: "Dark", kind: "rogue",
    foes: ["Corpse Refiner", "Shackled Devil", "Blood-Soaked Revenant", "Whispering Heart-Demon"],
    fortune: "treasure", hazard: "miasma", guardian: "the Unsealed Devil Ancestor",
    blurb: "a black pit where the old sects buried devils too vile to slay — and the seals are failing." },
  { key: "frostcave", name: "Frostmere Immortal Cave", cn: "冰寒仙府", element: "Ice", kind: "beast",
    foes: ["Frost Python", "Glacial Ape", "Hoarfrost Crane", "Rime-Bound Wolf"],
    fortune: "insight", hazard: "frost", guardian: "the Frostmere Immortal's Shade",
    blurb: "a cave-heaven sealed in eternal ice, where a dead immortal's serenity still lingers." },
  { key: "pillfurnace", name: "Volcanic Pill-Furnace Ruins", cn: "丹火遗址", element: "Fire", kind: "rogue",
    foes: ["Flame-Mane Lion", "Furnace-Guard Puppet", "Cinder Alchemist", "Magma Salamander"],
    fortune: "pill", hazard: "flame", guardian: "the Pill-Furnace Spirit",
    blurb: "the wreck of a grand alchemist's mountain, its furnaces still roaring with spirit-fire." },
  { key: "thunderpagoda", name: "Skyhigh Thunder Pagoda", cn: "九霄雷塔", element: "Lightning", kind: "rogue",
    foes: ["Thunder Roc", "Lightning-Forged Sentinel", "Storm Sword-Cultivator", "Voltaic Wraith"],
    fortune: "insight", hazard: "thunder", guardian: "the Pagoda's Thunder Sovereign",
    blurb: "a storm-wreathed pagoda that climbs into the clouds, each tier judged by heaven's lightning." },
  { key: "spiritgarden", name: "Verdant Spirit Garden", cn: "灵植秘园", element: "Wood", kind: "beast",
    foes: ["Venom Serpent", "Thornbark Treant", "Pollen Sprite-Swarm", "Vine-Coiled Beast"],
    fortune: "herb", hazard: "pollen", guardian: "the Ten-Thousand-Year Flower Demon",
    blurb: "a runaway immortal garden gone wild, thick with spirit-herbs — and the things that guard them." },
  { key: "godtreasury", name: "Earthen God-Treasury", cn: "后土宝库", element: "Earth", kind: "rogue",
    foes: ["Stone-Hide Rhino", "Clay Tomb-Guard", "Gilded Treasury-Puppet", "Jade-Armoured Sentinel"],
    fortune: "treasure", hazard: "quake", guardian: "the Treasury's Earthen Colossus", rewardSlot: "ring",
    blurb: "a buried vault of an old earth-god, its vaults heavy with hoarded immortal gold." },
];
export const SECRET_REALM_BY_KEY = Object.fromEntries(SECRET_REALMS.map(r => [r.key, r]));

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
export const PARENTHOOD_AGE = 18;   // old enough to raise children of your own

// Descriptions for free-form sundry items that land in c.inventory.
// Keys are the exact string pushed into the array.
export const SUNDRY_DESCRIPTIONS = {
  // Hunter's Child
  "Coarse Iron Saber":      { icon: "🗡️", desc: "A heavy iron saber, rough-forged but battle-proven. Your family hunted mountain spirits with it for generations. No qi refinement — pure edge and weight." },
  // Martial Clan
  "Tiger-Bone Manual":      { icon: "📜", desc: "A clan scripture transcribed on oiled hide, detailing bone-forging exercises passed down through three generations of mortal warriors." },
  // Scholar House
  "Annotated Dao Classic":  { icon: "📖", desc: "A well-thumbed copy of the Dao De Jing annotated in your grandfather's hand. Each marginal note hints at a cultivation insight beyond the plain text." },
  // Sect Disciple
  "Outer-Sect Robes":       { icon: "🥋", desc: "Plain grey robes marked with your sect's outer-ring sigil. Ordinary cloth — no qi refinement — but wearing them marks you as a cultivator of record." },
  "Qi-Gathering Pill":      { icon: "⚗️", desc: "A pale-green spirit pill issued to new outer disciples. One dose — taken at a breakthrough moment — floods the meridians with ambient qi to ease the crossing." },
  // Noble Clan
  "Clan Spirit Sword":      { icon: "⚔️", desc: "A spirit-grade flying sword passed down your cultivation clan's ancestral line. Its qi pathways are worn smooth from generations of use — still keenly sharp." },
  "Foundation Pill":        { icon: "💊", desc: "A rare crimson pill refined from ten-year spirit herbs. Swallowing it at the right cultivation stage fortifies the meridians and all but guarantees Foundation establishment." },
  // Imperial Bloodline
  "Dragon-Pattern Jade":    { icon: "🐉", desc: "A thumb-sized jade tablet carved with a coiling imperial dragon. Its faint pulse resonates with bloodline arts and opens doors no amount of gold can buy." },
  "Imperial Body Lotion":   { icon: "🫙", desc: "A lacquered jar of golden salve refined for the imperial family. Applied nightly it nourishes the spirit channels and maintains the bloodline's natural cultivation lustre." },
  // Demon Scion
  "Blood Refining Manual":  { icon: "📕", desc: "A demonic scripture inked in dried lifeblood. Its techniques are swift and brutally potent — and quietly hungry for vital force. Orthodox sects will execute a bearer on sight." },
  "Soul-Eating Talisman":   { icon: "🧧", desc: "Ghost-script etched on bone-yellow paper. On detonation it tears a sliver of the target's soul. One use only — even the handle is cold to the touch." },
  // Hidden Master's Heir
  "Mysterious Jade Slip":   { icon: "💚", desc: "A slender jade slab carved with techniques your reclusive master left without explanation. Meditating on it reveals new layers each year; its full depth has yet to surface." },
  "Spirit Herb Bundle":     { icon: "🌿", desc: "Rare spirit herbs wrapped in oil-paper, still fragrant with earth-qi. Enough to start an alchemy session, or barter for spirit stones at any market." },
  // Merchant Family
  "Spirit-Gathering Charm": { icon: "🔮", desc: "A paper charm inscribed with qi-condensing arrays. Hang it in your cultivation chamber to thin the veil between your meridians and ambient spirit-qi." },
  // Loot drop
  "Spirit Jade Shard":      { icon: "💠", desc: "A fragment of pure spirit jade dense with latent qi. Accepted as currency by most cultivators, useful as a talisman anchor, or readily sold at market." },
};

// Canonical minimum ages for the game's endeavours — the single source of
// truth for age-appropriate gating, shared by the UI (which greys out a button
// too soon) and the model layer (which refuses the action outright, however it
// is reached). A six-year-old shouldn't be raiding Secret Realms, courting a
// dao companion, or travelling the world alone. Keyed by endeavour.
export const AGE_MIN = {
  train: 4, study: 5, spar: 6, oddjobs: 10, alchemy: 10, wander: 12, hunt: 12,
  arena: 12, duel: 12, quest: 12, mingle: 12, travel: 14, tournament: 14,
  romance: COMING_OF_AGE, boss: 16, secret: 16, abode: COMING_OF_AGE, disciple: 18, child: PARENTHOOD_AGE,
};
// The minimum age for an endeavour (0 if ungated).
export const ageMin = key => AGE_MIN[key] || 0;
// True if the character is old enough for the endeavour.
export const oldEnoughFor = (c, key) => (c.age || 0) >= ageMin(key);

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
// A hand-drawn portrait that grows with the soul: an unawakened child, a youth,
// a grown mortal, then ever more rarefied cultivators as the realms climb.
export function avatarKey(c) {
  if (!c.awakened && c.age < AWAKENING_AGE) return "avChild";
  if (c.realm >= 9) return "avImmortal";
  if (c.realm >= 7) return "avElder";
  if (c.realm >= 5) return "avSage";
  if (c.realm >= 3) return "avAdept";
  if (c.age < COMING_OF_AGE) return "avYouth";
  return c.sex === "female" ? "avAdultF" : "avAdultM";
}
export function avatarFor(c, size = 30) {
  return icon(avatarKey(c), { size, cls: "av" });
}

/* The five innate attributes, named in tiers so a raw number reads as a
 * standing relative to an ordinary mortal (rolled around ~50). Eight bands,
 * each flavoured per attribute; the shared index drives the banner's colour. */
export const ATTR_TIER_CUTS = [15, 30, 45, 60, 80, 100, 125]; // -> bands 0..7
export function attrTierIndex(v) {
  let i = 0;
  for (const cut of ATTR_TIER_CUTS) { if (v >= cut) i++; else break; }
  return i;
}
const ATTR_TIER_NAMES = {
  comprehension: ["Dull", "Slow", "Plain", "Apt", "Keen", "Sharp", "Enlightened", "Sage-Minded"],
  constitution:  ["Frail", "Weak", "Sound", "Hardy", "Robust", "Ironclad", "Adamant", "Indestructible"],
  soul:          ["Dim", "Faint", "Clear", "Aware", "Deep", "Profound", "Boundless", "Heaven-Spanning"],
  luck:          ["Cursed", "Hapless", "Even", "Favoured", "Lucky", "Blessed", "Fated", "Heaven-Chosen"],
  charm:         ["Plain", "Modest", "Pleasing", "Comely", "Alluring", "Captivating", "Peerless", "Nation-Toppling"],
};
// `attr` is the character field key: comprehension|constitution|soul|luck|charm.
export function attrTier(attr, v) {
  const i = attrTierIndex(v);
  const names = ATTR_TIER_NAMES[attr] || ATTR_TIER_NAMES.comprehension;
  return { idx: i, name: names[i], of: ATTR_TIER_CUTS.length + 1 };
}
// Coarse banding for colour: low / middling / high / peak.
export function attrTierClass(idx) {
  if (idx <= 1) return "tier-lo";
  if (idx <= 3) return "tier-mid";
  if (idx <= 5) return "tier-hi";
  return "tier-top";
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
// Each region's elemental character — treasures found there (ruins, caches,
// quest spoils) lean toward this element, so where you hunt shapes what you find.
export const REGION_ELEMENT = {
  azuredomain: "Metal",   // orthodox sword-cultivation heartlands
  cloudmarsh: "Water",    // trackless wetlands
  frostpeaks: "Ice",      // killing cold
  demonwastes: "Dark",    // devil-path and corpse-fiends
  starfall: "Light",      // a shattered immortal battlefield of fallen stars
};

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
/* Innate beast traits (天赋): every spirit beast is born with one, a quirk of
 * its blood that shapes how it fights at your side and forages at your abode.
 * [key, name, cn, blurb, weight] */
export const BEAST_TRAITS = [
  ["ferocious", "Ferocious", "凶悍", "Born for the kill — its battle assists strike far harder.", 26],
  ["vigilant",  "Vigilant",  "机警", "Ever-watchful — it throws itself between you and harm, shielding you in battle.", 18],
  ["nimble",    "Nimble",    "灵巧", "Quicksilver and sure-footed — its presence sharpens your own evasion.", 16],
  ["auspicious","Auspicious","祥瑞", "A lucky omen of a beast — it forages far richer at your abode.", 20],
  ["devoted",   "Devoted",   "忠勇", "Bonds fast and deep — it trusts you sooner and treasures every kindness.", 20],
];
export const BEAST_TRAIT_BY_KEY = Object.fromEntries(BEAST_TRAITS.map(t => [t[0], t]));
export const beastTraitName = key => BEAST_TRAIT_BY_KEY[key] ? `${BEAST_TRAIT_BY_KEY[key][1]} (${BEAST_TRAIT_BY_KEY[key][2]})` : "";

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
  phoenix:  { cultivate: 0.12, healBonus: 0.6, burnImmune: true, deathSave: 0.12, element: "Fire", desc: "Vermilion Phoenix body: +12% cultivation, +60% to healing arts, immune to burning, a chance to rise from death, innate Fire." },
  gale:     { dodge: 0.16, qiPool: 0.20, element: "Wind", desc: "Gale-Spirit body: +16% dodge, +20% combat qi, innate Wind." },
  swordheart: { dodge: 0.06, crit: 0.10, dao: 0.20, element: "Metal", desc: "Sword-Heart body: +10% crit, +6% dodge, faster Dao insight, innate Metal." },
  titan:    { mitig: 0.20, hp: 0.55, element: "Earth", desc: "Earth-Titan body: heavy damage-reduction, +55% battle stamina, innate Earth." },
  dragon:   { cultivate: 0.12, mitig: 0.12, hp: 0.30, vsDemon: 0.2, element: "Water", desc: "True Dragon body: +12% cultivation, strong mitigation, +30% battle stamina, innate Water." },
  immortal: { mitig: 0.18, hp: 0.50, deathSave: 0.25, desc: "Undying Golden Body: heavy damage-reduction, +50% battle stamina, and a chance to cheat death." },
};
export const physEffect = c => PHYSIQUE_EFFECTS[c.physiqueKey] || PHYSIQUE_EFFECTS.ordinary;
