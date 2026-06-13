/* The Nine Heavens -- life-event library (the BitLife-style heart of the game).
 *
 * Each year you "age up", a few of these fire as narrative cards. Some just
 * happen (auto); many present a choice with real consequences. Events mutate the
 * character directly for simple stats and use the injected api `A` for things
 * that need engine internals (combat, treasures, qi, meeting people).
 *
 * An event:  { id, weight, minAge, maxAge, minRealm, maxRealm, awakened,
 *              once, cond(c), text(c)->str,
 *              choices:[{label, result(c,rng,A)-> str | str[]}]   // a choice card
 *              | auto(c,rng,A)-> str | str[] }                    // a passive card
 */

import * as D from "./data.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap = (c, k, v) => { c[k] = Math.min(160, c[k] + v); };

export const EVENTS = [
  /* ----------------------------- childhood ------------------------------ */
  {
    id: "child_creature", weight: 8, minAge: 2, maxAge: 6, awakened: false,
    text: () => "Behind your home you find a shivering little spirit-creature, its leg caught in a snare.",
    choices: [
      { label: "Free and nurse it", result: (c, rng, A) => { A.happy(8); c.charm = Math.min(160, c.charm + 2); c._kindBeast = true; return "You free it and share your supper. It nuzzles you and slips away — you feel a warmth that lingers."; } },
      { label: "Sell it at market", result: (c, rng, A) => { A.stones(rng.randint(2, 6)); A.karma(-2); return "A travelling merchant pays a few spirit stones for the creature. Your parents are pleased; something in you feels a little colder."; } },
      { label: "Ignore it", result: () => "You walk past. The snare is empty by morning. Such is the wild." },
    ],
  },
  {
    id: "child_fever", weight: 7, minAge: 1, maxAge: 7, awakened: false,
    text: () => "A burning fever grips you for days. The village has no healer.",
    choices: [
      { label: "Let mother nurse you", result: (c, rng, A) => { A.heal(-6); A.happy(4); const m = A.kin("mother"); return `${m ? m.name + " sits" : "Your mother sits"} by your bed each night. You pull through, weak but loved.`; } },
      { label: "Endure it alone", result: (c, rng, A) => { if (rng.random() < 0.5) { A.heal(-14); c.constitution = Math.min(160, c.constitution + 3); return "You sweat it out in silence. The illness tempers something in you. (+Constitution)"; } A.heal(-20); A.happy(-6); return "The fever nearly takes you. You recover, but it leaves a frailty behind."; } },
    ],
  },
  {
    id: "child_bully", weight: 7, minAge: 4, maxAge: 12, awakened: false,
    text: () => "Older village children corner you and mock your family.",
    choices: [
      { label: "Fight back", result: (c, rng, A) => { if (rng.random() < 0.45 + c.constitution / 300) { c.constitution = Math.min(160, c.constitution + 2); A.happy(6); return "You bloody a nose and they scatter. You ache, but you stood your ground. (+Constitution)"; } A.heal(-10); A.happy(-4); return "They thrash you and leave you in the dirt. You swallow your tears and your pride."; } },
      { label: "Endure quietly", result: (c, rng, A) => { A.happy(-6); cap(c, "soul", 1); return "You take their cruelty without a word. In stillness, your spirit hardens a little."; } },
      { label: "Outwit them", result: (c, rng, A) => { if (rng.random() < c.comprehension / 120) { cap(c, "comprehension", 2); A.happy(5); return "A clever word turns them against each other. They leave you alone. (+Comprehension)"; } A.happy(-3); return "Your scheme falls flat and they laugh all the harder."; } },
    ],
  },
  {
    id: "child_scripture", weight: 5, minAge: 3, maxAge: 6, awakened: false,
    auto: (c, rng, A) => { cap(c, "comprehension", rng.randint(1, 3)); return "You overhear a wandering monk reciting a sutra and repeat it back, word-perfect. He studies you strangely. (+Comprehension)"; },
  },
  {
    id: "child_dream", weight: 5, minAge: 2, maxAge: 8, awakened: false,
    auto: (c, rng, A) => { A.qi(0.15); return "You dream of a white-robed immortal standing on a sea of cloud, beckoning. You wake with your heart pounding."; },
  },

  /* --------------------------- awakening era ---------------------------- */
  {
    id: "scout_visit", weight: 9, minAge: 6, maxAge: 15, awakened: true, once: true,
    cond: c => !c.sectKey && (c.root.key !== "none"),
    text: c => `A robed recruiter from a nearby sect hears of your ${c.root.display.split(" (")[0]} and comes knocking.`,
    choices: [
      { label: "Beg to take the entrance trial", result: (c, rng, A) => {
        const tier = ({ none: 0, waste: 0, quad: 1, triple: 2, dual: 3, heavenly: 4, variant: 5, chaos: 6 })[c.root.key] || 0;
        if (rng.random() < 0.35 + tier * 0.12) { c._scouted = true; A.happy(12); return "They test your meridians, nod once, and bid you present yourself at the sect gates. A door to the heavens cracks open. (Visit the Sect tab.)"; }
        A.happy(-6); return "They frown at your foundation and move on. Not yet, they say. Not yet.";
      } },
      { label: "Refuse — stay with family", result: (c, rng, A) => { A.happy(4); const f = A.kin("father"); return `You choose home over glory. ${f ? f.name : "Your father"} grips your shoulder, proud and sad at once.`; } },
    ],
  },
  {
    id: "youth_chores", weight: 6, minAge: 6, maxAge: 15,
    text: () => "Your family needs help: water to haul, fields to tend, debts to work off.",
    choices: [
      { label: "Work hard for the family", result: (c, rng, A) => { A.stones(rng.randint(1, 4)); c.constitution = Math.min(160, c.constitution + 1); A.kinAdjust("father", 3); A.kinAdjust("mother", 3); return "Honest sweat. Your body strengthens and your parents lean on you with pride."; } },
      { label: "Sneak away to cultivate", result: (c, rng, A) => { if (c.awakened && c.root.key !== "none") { A.qi(0.4); A.kinAdjust("father", -3); return "You hide in the bamboo and breathe the dao. Your qi deepens — but your chores go undone, and your father scowls."; } A.happy(3); return "You laze by the river dreaming of immortals. A pleasant, useless afternoon."; } },
    ],
  },

  /* ----------------------- friends, rivals, love ------------------------ */
  {
    id: "make_friend", weight: 6, minAge: 6, maxAge: 9000,
    cond: c => c.relationships.filter(n => n.role === "friend" && n.alive).length < 3,
    text: () => "A kindred soul crosses your path — quick to laugh, quicker to share their last bun.",
    choices: [
      { label: "Befriend them", result: (c, rng, A) => { const n = A.meet("friend", { affinity: 18 + Math.floor(c.charm / 10) }); A.happy(6); return `You and ${n.name} swear a bond over cheap wine. A friend in this cruel world is no small thing.`; } },
      { label: "Keep your distance", result: (c, rng, A) => { A.happy(-2); cap(c, "soul", 1); return "Attachments are chains, you tell yourself. You walk the lonelier road."; } },
    ],
  },
  {
    id: "romance", weight: 5, minAge: 16, maxAge: 9000,
    cond: c => !c.relationships.some(n => n.role === "companion" && n.alive) && c.charm > 30,
    text: c => `Beneath the lantern-light at a gathering, ${c.sex === "female" ? "a striking young cultivator" : "a graceful young cultivator"} catches your eye — and holds it.`,
    choices: [
      { label: "Pursue them", result: (c, rng, A) => { if (rng.random() < 0.35 + c.charm / 200) { const n = A.meet("companion", { affinity: 30 }); A.happy(12); return `Words become walks, walks become promises. ${n.name} may yet become your dao companion.`; } A.happy(-5); return "Your heart races; their eyes slide past you to another. Rejection stings like cold rain."; } },
      { label: "Focus on the dao", result: (c, rng, A) => { A.qi(0.2); cap(c, "soul", 1); return "Love is a beautiful distraction you cannot afford. You return to your cultivation."; } },
    ],
  },
  {
    id: "marriage", weight: 7, minAge: 16, maxAge: 9000, once: true,
    cond: c => c.relationships.some(n => n.role === "companion" && n.alive && n.affinity >= 60),
    text: c => { const n = c.relationships.find(x => x.role === "companion" && x.alive); return `Under a blood-red moon, ${n ? n.name : "your beloved"} takes your hands: "Walk the long road to immortality at my side — forever."`; },
    choices: [
      { label: "Pledge yourselves as dao companions", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive); if (n) { n.kin = "Dao Partner"; n.affinity = Math.min(100, n.affinity + 20); } if (!c.titles.includes("Dao Companion")) c.titles.push("Dao Companion"); A.happy(20); return `You are bound, soul to soul. Two dao-hearts beating as one against the indifferent heavens.`; } },
      { label: "You are not ready", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive); if (n) n.affinity = Math.max(-100, n.affinity - 15); A.happy(-8); return "You hesitate, and something in their eyes dims. The moment passes, perhaps forever."; } },
    ],
  },
  {
    id: "have_child", weight: 5, minAge: 18, maxAge: 9000, once: false,
    cond: c => c.relationships.some(n => n.role === "companion" && n.alive && n.affinity >= 50) && c.relationships.filter(n => n.kin === "Son" || n.kin === "Daughter").length < 4,
    text: () => "Your dao companion shares joyful news: a child is coming.",
    choices: [
      { label: "Welcome the child", result: (c, rng, A) => { const child = A.meet("family", { kin: rng.random() < 0.5 ? "Son" : "Daughter", affinity: 70, born: c.age }); A.happy(15); return `A child is born to your line — ${child.name}. A spark of your blood to carry the dao onward.`; } },
    ],
  },

  /* --------------------------- adventure & fate ------------------------- */
  {
    id: "duel", weight: 6, minAge: 12, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    text: () => "A swaggering cultivator blocks your path and demands a duel to 'test your worthless foundation'.",
    choices: [
      { label: "Accept the challenge", result: (c, rng, A) => ["You draw your qi and meet them blade to blade."].concat(A.fight()) },
      { label: "Talk your way out", result: (c, rng, A) => { if (rng.random() < 0.4 + c.charm / 200) { A.happy(2); return "A few smooth words and a saved-face exit. No blood spilled today."; } A.happy(-4); return ["They sneer and strike anyway — you have no choice but to fight!"].concat(A.fight()); } },
    ],
  },
  {
    id: "ruin", weight: 6, minAge: 12, maxAge: 9000, awakened: true,
    text: () => "Rumour spreads of an ancient ruin uncovered after a landslide, its wards already failing.",
    choices: [
      { label: "Venture inside", result: (c, rng, A) => { const r = rng.random(); if (r < 0.35) return ["You delve the ruin..."].concat(A.giveArtifact()); if (r < 0.6) { const t = A.learnTech(); return t ? `In a dusty jade slip you find a manual: ${t}!` : "You find only crumbling, illegible carvings."; } if (r < 0.8) { A.herbs(rng.randint(4, 10)); A.stones(rng.randint(10, 40)); return "You loot a cache of spirit herbs and stones before the ruin groans shut."; } return ["A guardian puppet still stalks the halls!"].concat(A.fight()); } },
      { label: "Too dangerous — stay away", result: (c, rng, A) => { cap(c, "comprehension", 1); return "You let the treasure-mad fools rush in. Some never come out. Caution is its own wisdom."; } },
    ],
  },
  {
    id: "demonic_offer", weight: 4, minAge: 14, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    text: () => "A pale figure in black appears in your dreams, offering a blood-art that promises power overnight — for a price paid in others' lives.",
    choices: [
      { label: "Accept the dark power", result: (c, rng, A) => { A.karma(-25); A.qi(1.2); if (!c.techniques.includes("blood_refine")) c.techniques.push("blood_refine"); A.happy(-4); return "You carve the forbidden art into your soul. Power floods you, cold and hungry. The heavens will remember this."; } },
      { label: "Refuse the devil", result: (c, rng, A) => { A.karma(8); cap(c, "soul", 2); A.happy(4); return "You banish the apparition with a clear heart. Your dao remains your own. (+Karma, +Soul)"; } },
    ],
  },
  {
    id: "save_villager", weight: 5, minAge: 10, maxAge: 9000,
    text: () => "A spirit-beast rampages through a mortal village; screaming families flee before it.",
    choices: [
      { label: "Defend the innocent", result: (c, rng, A) => { const res = A.fight(); if (c.alive) { A.karma(12); A.happy(8); c.reputation += 3; res.push("The villagers kowtow in tearful gratitude. Word of your virtue spreads. (+Karma, +Reputation)"); } return ["You plant yourself between the beast and the fleeing crowd."].concat(res); } },
      { label: "Save yourself", result: (c, rng, A) => { A.karma(-6); A.happy(-5); return "You slip away as the screams fade behind you. Survival has a taste, and it is ash."; } },
    ],
  },
  {
    id: "windfall", weight: 5, minAge: 6, maxAge: 9000,
    auto: (c, rng, A) => { const g = rng.randint(5, 20) * (c.realm + 1); A.stones(g); return `Fortune smiles: you stumble on a lost coin-pouch of ${g} spirit stones by the roadside.`; },
  },
  {
    id: "robbed", weight: 5, minAge: 8, maxAge: 9000,
    cond: c => c.spiritStones > 5,
    auto: (c, rng, A) => { if (rng.random() > c.luck / 250) { const lost = Math.max(1, Math.floor(c.spiritStones * rng.uniform(0.2, 0.5))); A.stones(-lost); A.happy(-5); return `Rogue cultivators waylay you and strip you of ${lost} spirit stones. You are lucky to keep your life.`; } return "A pickpocket reaches for your pouch — your spirit sense flares and they flee empty-handed."; },
  },
  {
    id: "spirit_spring", weight: 4, minAge: 8, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    auto: (c, rng, A) => { A.qi(rng.uniform(0.5, 1.0)); A.heal(10); return "You discover a hidden spirit spring and bathe in its dense qi for days. Your cultivation surges and your body is cleansed."; },
  },
  {
    id: "bottleneck", weight: 6, minRealm: 2, awakened: true,
    text: () => "Your cultivation has stagnated for years. The next layer feels like a wall of solid jade.",
    choices: [
      { label: "Seek a flash of insight (meditate)", result: (c, rng, A) => { if (rng.random() < 0.3 + c.comprehension / 250) { A.qi(0.8); cap(c, "comprehension", 2); A.happy(6); return "Watching water wear stone, understanding breaks over you like dawn. The bottleneck dissolves. (+Comprehension)"; } A.happy(-3); return "You sit in meditation for a season and grasp... nothing. The wall remains."; } },
      { label: "Pound through with raw qi", result: (c, rng, A) => { if (rng.random() < 0.5) { A.qi(0.5); return "Brute persistence chips the wall thinner. Progress, of a kind."; } A.heal(-12); A.happy(-4); return "You force your meridians too hard; qi backlashes and you cough blood. (-Health)"; } },
    ],
  },
  {
    id: "old_master", weight: 4, minAge: 12, maxAge: 9000,
    cond: c => !c.relationships.some(n => n.role === "master" && n.alive),
    text: () => "A ragged old drunk slumped outside a wine-shop fixes you with a gaze far too clear for a beggar.",
    choices: [
      { label: "Show respect, offer wine", result: (c, rng, A) => { if (rng.random() < 0.3 + c.charm / 250) { const n = A.meet("master", { affinity: 25 }); cap(c, "comprehension", 4); return `The 'beggar' is a hidden expert. Impressed by your humility, ${n.name} takes you as a disciple! (+Comprehension)`; } cap(c, "comprehension", 1); return "He drains your wine, belches a riddle about 'the uncarved block', and staggers off."; } },
      { label: "Walk past", result: () => "Just another drunk. You have cultivation to attend to." },
    ],
  },
  {
    id: "betrayal", weight: 4, minAge: 14, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "friend" && n.alive),
    text: c => { const f = c.relationships.find(n => n.role === "friend" && n.alive); return `${f ? f.name : "A friend"} you trusted has been spreading poison about you — and stole a cultivation resource on their way out.`; },
    choices: [
      { label: "Confront them", result: (c, rng, A) => { const f = c.relationships.find(n => n.role === "friend" && n.alive); if (f) { f.role = "enemy"; f.affinity = -50; } A.stones(-Math.min(c.spiritStones, 5)); A.happy(-6); return "Harsh words, a shattered friendship, a new enemy made. Trust is a luxury of the weak, you decide."; } },
      { label: "Let it go", result: (c, rng, A) => { cap(c, "soul", 2); A.happy(-3); return "You release the grudge like sand through open fingers. Your dao heart grows calmer for it. (+Soul)"; } },
    ],
  },
  {
    id: "enemy_strikes", weight: 5, minAge: 14, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "enemy" && n.alive),
    text: c => { const e = c.relationships.find(n => n.role === "enemy" && n.alive); return `Your enemy ${e ? e.name : ""} ambushes you on a lonely road, blade already drawn!`; },
    choices: [
      { label: "Stand and fight", result: (c, rng, A) => { const e = c.relationships.find(n => n.role === "enemy" && n.alive); const res = A.fight(e ? [e.name, A.power() * rng.uniform(0.8, 1.3), (c.realm + 1) * 6, "rogue"] : undefined); if (c.alive && e && rng.random() < 0.6) { e.alive = false; res.push(`You end ${e.name}'s grudge for good.`); } return res; } },
    ],
  },
  {
    id: "auction", weight: 5, minAge: 14, maxAge: 9000,
    cond: c => c.spiritStones >= 50,
    text: c => { const cost = 50 * (c.realm + 1); return `An underground auction is selling a sealed treasure-chest of unknown grade. Bidding opens at ${cost} stones.`; },
    choices: [
      { label: "Bid on the mystery treasure", result: (c, rng, A) => { const cost = 50 * (c.realm + 1); if (c.spiritStones < cost) return "You can no longer afford the bid."; A.stones(-cost); if (rng.random() < 0.7) return ["The hammer falls to you. You crack the seal..."].concat(A.giveArtifact()); A.happy(-5); return "The chest holds nothing but mocking laughter scrawled on silk. Swindled."; } },
      { label: "Watch and leave", result: () => "You pocket your stones and slip out before temptation wins." },
    ],
  },
  {
    id: "gamble", weight: 4, minAge: 12, maxAge: 9000,
    cond: c => c.spiritStones >= 10,
    text: () => "A rowdy gambling den beckons, dice clattering, fortunes won and lost in a breath.",
    choices: [
      { label: "Try your luck", result: (c, rng, A) => { const bet = Math.min(c.spiritStones, 20); if (rng.random() < 0.42 + c.luck / 400) { A.stones(bet); A.happy(5); return `The dice love you tonight — you double your stake, winning ${bet} stones!`; } A.stones(-bet); A.happy(-5); return `The dice are cruel. You lose ${bet} stones and your dignity.`; } },
      { label: "Resist", result: (c) => { cap(c, "soul", 1); return "You know a fool's road when you see one. You walk on."; } },
    ],
  },

  /* ---------------------------- family & loss --------------------------- */
  {
    id: "parent_illness", weight: 5, minAge: 8, maxAge: 60,
    cond: c => c.relationships.some(n => n.role === "family" && (n.kin === "Father" || n.kin === "Mother") && n.alive),
    text: c => { const p = c.relationships.find(n => n.role === "family" && (n.kin === "Father" || n.kin === "Mother") && n.alive); return `${p.name}, your ${p.kin.toLowerCase()}, has fallen gravely ill. A cure exists — but it is costly.`; },
    choices: [
      { label: "Spend everything to heal them", result: (c, rng, A) => { const p = c.relationships.find(n => n.role === "family" && (n.kin === "Father" || n.kin === "Mother") && n.alive); const cost = Math.min(c.spiritStones, 30 + c.realm * 10); A.stones(-cost); if (p) { p.affinity = Math.min(100, p.affinity + 15); } A.happy(4); return `You pour ${cost} stones into spirit-medicine. ${p ? p.name : "They"} recovers, gripping your hand in wordless thanks.`; } },
      { label: "You cannot afford it", result: (c, rng, A) => { const p = c.relationships.find(n => n.role === "family" && (n.kin === "Father" || n.kin === "Mother") && n.alive); if (p && rng.random() < 0.5) { p.alive = false; A.happy(-18); A.note(`${p.name} passed away.`); return `Without the cure, ${p.name} fades. You kneel at the graveside, helpless and grieving.`; } A.happy(-6); return `${p ? p.name : "They"} clings to life through sheer will. You vow to never be this powerless again.`; } },
    ],
  },
  {
    id: "parent_pride", weight: 4, minAge: 8, maxAge: 50, awakened: true,
    cond: c => c.realm >= 2 && c.relationships.some(n => n.role === "family" && n.alive),
    auto: (c, rng, A) => { A.happy(8); A.kinAdjust("father", 4); A.kinAdjust("mother", 4); return "You return home in fine robes, your cultivation plain to see. Your family weeps with pride; the whole village comes to gawk."; },
  },

  /* ----------------------------- high realm ----------------------------- */
  {
    id: "epiphany", weight: 4, minRealm: 4, awakened: true,
    auto: (c, rng, A) => { A.qi(rng.uniform(0.6, 1.4)); cap(c, "comprehension", 2); return "Beneath a sky of falling stars, a fragment of the great dao reveals itself to you. Your foundation deepens. (+Comprehension)"; },
  },
  {
    id: "sect_war", weight: 4, minRealm: 3, awakened: true,
    cond: c => c.sectKey,
    text: () => "War-drums sound: a rival sect marches on your mountain. The elders call every disciple to the front.",
    choices: [
      { label: "Fight for your sect", result: (c, rng, A) => { const res = A.fight(); if (c.alive) { c.contribution += 40; c.reputation += 4; res.push("Your sect repels the invaders. Your valour earns contribution and renown."); } return ["You take your place in the battle-line."].concat(res); } },
      { label: "Hide until it passes", result: (c, rng, A) => { c.reputation -= 6; A.happy(-4); return "You cower in the herb-cellar while others bleed. The sect remembers cowards."; } },
    ],
  },
  /* ------------------------------ nemesis ------------------------------- */
  {
    id: "destined_rival", weight: 8, minAge: 8, maxAge: 18, awakened: true, once: true,
    cond: c => !c.relationships.some(n => n.role === "nemesis" && n.alive),
    text: () => "A gifted, arrogant peer humiliates you before a watching crowd, sneering that you will never amount to anything. The shame burns.",
    choices: [
      { label: "Swear to surpass them", result: (c, rng, A) => { const n = A.makeNemesis("a public humiliation in your youth"); cap(c, "comprehension", 2); A.happy(-4); return `You meet ${n.name}'s eyes and silently vow to grind their pride to dust. A lifelong rivalry is born. (See them in Relationships.)`; } },
      { label: "Swallow it calmly", result: (c, rng, A) => { const n = A.makeNemesis("a public humiliation in your youth"); cap(c, "soul", 2); return `You bow your head and walk away — but ${n.name} marks you as a rival, and will not let it rest. (+Soul)`; } },
    ],
  },
  {
    id: "nemesis_surge", weight: 4, awakened: true,
    cond: c => c.relationships.some(n => n.role === "nemesis" && n.alive),
    auto: (c, rng, A) => { const n = A.nemesis(); if (n) n.power *= rng.uniform(1.12, 1.28); return `Word reaches you: your nemesis ${n ? n.name : ""} has stumbled into a fortuitous chance and surged in power. The gap yawns wider.`; },
  },
  {
    id: "nemesis_taunt", weight: 5, awakened: true,
    cond: c => c.relationships.some(n => n.role === "nemesis" && n.alive),
    text: c => { const n = c.relationships.find(x => x.role === "nemesis" && x.alive); return `${n ? n.name : "Your nemesis"} struts past with a retinue, loudly mocking your "pitiful" cultivation for all to hear.`; },
    choices: [
      { label: "Redouble your training", result: (c, rng, A) => { cap(c, "comprehension", 2); A.happy(-3); return "You answer with silence and sweat. Their scorn becomes fuel. (+Comprehension)"; } },
      { label: "Answer their challenge now", result: (c, rng, A) => { const n = A.nemesis(); return ["Blood rushes to your head — you call them out on the spot!"].concat(A.fight([n.name, n.power, (c.realm + 1) * 6, "rogue"])); } },
    ],
  },
  {
    id: "nemesis_ambush", weight: 4, minRealm: 2, awakened: true,
    cond: c => c.relationships.some(n => n.role === "nemesis" && n.alive),
    auto: (c, rng, A) => { const n = A.nemesis(); return ["Your nemesis " + n.name + " ambushes you on a lonely mountain road!"].concat(A.fight([n.name, n.power, (c.realm + 1) * 7, "rogue"])); },
  },
  /* ----------------------- reputation & world standing ------------------ */
  {
    id: "sect_invitation", weight: 6, awakened: true, once: true,
    cond: c => c.reputation >= 45 && !c.sectKey && c.realm >= 1,
    text: () => "Your name has spread. Envoys from a great sect arrive bearing jade tokens, inviting you to join as a core disciple on the spot.",
    choices: [
      { label: "Accept the honour", result: (c, rng, A) => { const key = c.realm >= 2 ? "heavensword" : "azure"; c.sectKey = key; c.sectRank = 0; c.contribution = 0; c.reputation += 10; const nm = D.SECT_BY_KEY[key][1]; A.note(`Invited into the ${nm}.`); return `You don the robes of the ${nm} as an honoured guest-disciple. Doors open across the realm.`; } },
      { label: "Decline — walk your own road", result: (c, rng, A) => { cap(c, "soul", 1); c.reputation += 2; return "You bow and refuse. A rogue cultivator beholden to none — the elders leave impressed despite themselves."; } },
    ],
  },
  {
    id: "grand_banquet", weight: 5, awakened: true,
    cond: c => c.reputation >= 40,
    text: () => "You are seated as a guest of honour at a grand cultivators' banquet, wine flowing and dao-debate sparkling.",
    choices: [
      { label: "Mingle with the elite", result: (c, rng, A) => { c.reputation += 3; A.happy(6); if (!c.relationships.some(n => n.role === "companion" && n.alive) && rng.random() < 0.3) { const n = A.meet("companion", { affinity: 26 }); return `Amid the lanterns, ${n.name} seeks you out, and something kindles.`; } const f = A.meet("friend", { affinity: 18 }); return `You trade dao insights with ${f.name}; a useful friendship forms.`; } },
      { label: "Watch from the shadows", result: (c, rng, A) => { cap(c, "comprehension", 1); return "You observe the powerful and learn the shape of their ambitions. (+Comprehension)"; } },
    ],
  },
  {
    id: "admirer_gifts", weight: 4, awakened: true, cond: c => c.reputation >= 80,
    auto: (c, rng, A) => { const g = rng.randint(20, 60); A.stones(g); c.pills += 1; A.happy(3); return `Admirers and hangers-on shower the famous you with gifts. (+${g} stones, +1 pill)`; },
  },
  {
    id: "bounty_hunter", weight: 6, awakened: true, minRealm: 1,
    cond: c => c.reputation <= -25 || c.karma <= -60,
    auto: (c, rng, A) => ["A bounty hunter, lured by the price on your head, falls upon you!"].concat(A.fight(["a Bounty Hunter", A.power() * rng.uniform(1.0, 1.4), (c.realm + 1) * 8, "rogue"])),
  },
  {
    id: "shunned", weight: 4, awakened: true, cond: c => c.reputation <= -15,
    auto: (c, rng, A) => { A.happy(-4); return "Doors slam as you pass; merchants refuse your custom and mothers usher their children indoors. Infamy has its price."; },
  },
  /* ------------------------- disciples & lineage ------------------------ */
  {
    id: "grateful_disciple", weight: 4, awakened: true,
    cond: c => c.relationships.some(n => n.role === "disciple" && n.alive),
    auto: (c, rng, A) => { const d = c.relationships.find(n => n.role === "disciple" && n.alive); const g = rng.randint(10, 30) * (c.realm + 1); A.stones(g); c.reputation += 2; A.happy(3); return `Your disciple ${d ? d.name : ""} returns from a journey laden with gifts and tales of upholding your name. (+${g} stones, +2 reputation)`; },
  },
  {
    id: "heart_demon_whisper", weight: 5, awakened: true,
    cond: c => typeof c.happiness === "number" && c.happiness < 30,
    text: () => "In the small hours, a voice that sounds like your own whispers that the dao is a lie, that none of it matters.",
    choices: [
      { label: "Sit and confront the doubt", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 200) { A.happy(15); cap(c, "soul", 3); return "You meet the heart-demon's eyes and name it for what it is. It dissolves. Your dao heart emerges tempered. (+Soul)"; } A.happy(-8); A.heal(-8); return "The doubt sinks its teeth deep. You spiral, your qi growing turbid and unstable."; } },
      { label: "Drown it in cultivation", result: (c, rng, A) => { A.qi(0.3); A.happy(-3); return "You bury the whisper under relentless work. It quiets — for now. But it is not gone."; } },
    ],
  },
];

/* ----------------------- eligibility & rolling --------------------------- */
function eligible(c, e) {
  if (!c.alive) return false;
  if (e.minAge != null && c.age < e.minAge) return false;
  if (e.maxAge != null && c.age > e.maxAge) return false;
  if (e.minRealm != null && c.realm < e.minRealm) return false;
  if (e.maxRealm != null && c.realm > e.maxRealm) return false;
  if (e.awakened === true && !c.awakened) return false;
  if (e.awakened === false && c.awakened) return false;
  if (e.once !== false && (c.firedEvents || []).includes(e.id) && (e.once === true)) return false;
  if (e.cond && !e.cond(c)) return false;
  return true;
}

function instantiate(c, rng, A, e) {
  if (!c.firedEvents) c.firedEvents = [];
  if (e.once === true && !c.firedEvents.includes(e.id)) c.firedEvents.push(e.id);
  const text = typeof e.text === "function" ? e.text(c) : e.text;
  if (e.choices) {
    return {
      id: e.id, text,
      choices: e.choices.map(ch => ({
        label: typeof ch.label === "function" ? ch.label(c) : ch.label,
        fn: () => ch.result(c, rng, A),
      })),
    };
  }
  // Auto event: resolve immediately and attach its narration.
  const out = e.auto(c, rng, A);
  return { id: e.id, auto: true, text: Array.isArray(out) ? out : [out] };
}

export function rollYearEvents(c, rng, A) {
  const out = [];
  let pool = EVENTS.filter(e => eligible(c, e));
  if (pool.length) out.push(instantiate(c, rng, A, rng.choices(pool, pool.map(e => e.weight || 1))));
  // A modest chance of a second, different event in the same year.
  if (c.alive && rng.random() < 0.3) {
    pool = EVENTS.filter(e => eligible(c, e) && !out.some(o => o.id === e.id));
    if (pool.length) out.push(instantiate(c, rng, A, rng.choices(pool, pool.map(e => e.weight || 1))));
  }
  return out;
}
