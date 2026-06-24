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
import * as E from "./engine.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap = (c, k, v) => { c[k] = Math.min(160, c[k] + v); };

// Whoever would nurse a sick child: a parent, else a sibling, else a fellow
// orphan or friend (so even a parentless child isn't left to suffer alone).
const feverCaregiver = c => c.relationships.find(n => n.alive && n.kin === "Mother")
  || c.relationships.find(n => n.alive && n.kin === "Father")
  || c.relationships.find(n => n.alive && (n.kin === "Brother" || n.kin === "Sister"))
  || c.relationships.find(n => n.alive && n.role === "friend")
  || null;
const carerLabel = car => car.kin === "Mother" ? "your mother" : car.kin === "Father" ? "your father" : car.name;
const carerSubject = car => car.kin === "Mother" ? "Your mother" : car.kin === "Father" ? "Your father" : car.name;

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
      { label: c => { const car = feverCaregiver(c); return car ? `Let ${carerLabel(car)} nurse you` : "Be taken in by a kindly villager"; }, result: (c, rng, A) => { A.heal(-6); A.happy(4); const car = feverCaregiver(c); if (car) car.affinity = clampN((car.affinity || 0) + 2, -100, 100); const who = car ? carerSubject(car) : "A kindly old villager"; const verb = car && car.role === "friend" ? "watches over you" : "sits by your bed"; return `${who} ${verb} each night. You pull through, weak but loved.`; } },
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
    cond: c => c.charm > 25 && c.relationships.filter(n => n.role === "companion" && n.alive).length < D.HAREM_CAP,
    text: c => `Beneath the lantern-light at a gathering, a graceful young cultivator catches your eye — and holds it.`,
    choices: [
      { label: "Pursue them", result: (c, rng, A) => { if (rng.random() < 0.4 + c.charm / 200) { const n = A.meet("companion", { affinity: 28 }); A.happy(12); return `Words become walks, walks become promises. ${n.name} may yet become your dao companion — court them in your Relationships.`; } A.happy(-5); return "Your heart races; their eyes slide past you to another. Rejection stings like cold rain."; } },
      { label: "Focus on the dao", result: (c, rng, A) => { A.qi(0.2); cap(c, "soul", 1); return "Love is a beautiful distraction you cannot afford. You return to your cultivation."; } },
    ],
  },
  {
    id: "marriage", weight: 7, minAge: 16, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "companion" && n.alive && !n.married && n.affinity >= 55),
    text: c => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity >= 55); return `Under a blood-red moon, ${n ? n.name : "your beloved"} takes your hands: "Walk the long road to immortality at my side — as my spouse, forever."`; },
    choices: [
      { label: "Pledge yourselves — wed", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity >= 55); return n ? A.marry(n) : "The moment slips away."; } },
      { label: "You are not ready", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity >= 55); if (n) n.affinity = Math.max(-100, n.affinity - 12); A.happy(-8); return "You hesitate, and something in their eyes dims. Perhaps another night."; } },
    ],
  },
  {
    id: "have_child", weight: 5, minAge: 18, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "companion" && n.married && n.alive) && c.relationships.filter(n => n.kin === "Son" || n.kin === "Daughter").length < 10,
    text: c => { const sp = c.relationships.find(n => n.role === "companion" && n.married && n.alive); return `Your ${sp ? sp.kin.toLowerCase() : "spouse"} ${sp ? sp.name : ""} shares joyful news: a child is coming.`; },
    choices: [
      { label: "Welcome the child", result: (c, rng, A) => { const sp = c.relationships.find(n => n.role === "companion" && n.married && n.alive); const child = A.meet("family", { kin: rng.random() < 0.5 ? "Son" : "Daughter", affinity: 70, born: c.age, parent: sp ? sp.name : null }); if (sp) { if (!sp.geno) sp.geno = E.rollGenome(rng); child.geno = E.inheritGenome(E.playerGenome(c), sp.geno, rng); } A.happy(15); return `A child is born to your line — ${child.name}${sp ? `, ${sp.name}'s ${child.kin.toLowerCase()}` : ""}. A spark of your blood to carry the dao onward.`; } },
    ],
  },
  {
    id: "grandchild", weight: 4, minAge: 36, maxAge: 9000, cooldown: 10,
    cond: c => c.relationships.some(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && (c.age - (n.born || c.age)) >= 18),
    auto: (c, rng, A) => { const k = c.relationships.find(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && (c.age - (n.born || c.age)) >= 18); A.happy(10); c.reputation += 2; return `Joyful news from your ${k ? k.kin.toLowerCase() : "child"} ${k ? k.name : ""}: a grandchild is born, and the ${c.name.split(" ")[0]} bloodline flows on into a new generation. (+Happiness)`; },
  },
  {
    id: "harem_jealousy", weight: 4, minAge: 16, maxAge: 9000,
    cond: c => c.relationships.filter(n => n.role === "companion" && n.alive).length >= 2,
    text: c => { const ls = c.relationships.filter(n => n.role === "companion" && n.alive); return `Two of your dao companions, ${ls[0].name} and ${ls[1].name}, fall to bitter quarrelling over your divided attentions.`; },
    choices: [
      { label: "Soothe them with wisdom and grace", result: (c, rng, A) => { if (rng.random() < 0.4 + (c.charm + c.soul) / 400) { A.happy(8); for (const n of c.relationships) if (n.role === "companion" && n.alive) n.affinity = Math.min(100, n.affinity + 4); return "You speak to each heart in turn, and turn rivalry into sisterly accord. Your household finds harmony — for now."; } A.happy(-6); const ls = c.relationships.filter(n => n.role === "companion" && n.alive); ls.forEach(n => n.affinity = Math.max(-100, n.affinity - 6)); return "Your clumsy words please no one; both feel slighted, and the chill in your home deepens."; } },
      { label: "Let them sort it out themselves", result: (c, rng, A) => { A.happy(-4); const ls = c.relationships.filter(n => n.role === "companion" && n.alive); ls.forEach(n => n.affinity = Math.max(-100, n.affinity - 4)); return "You stay out of it. The feud simmers; both grow a little cooler toward you."; } },
    ],
  },
  {
    id: "harem_harmony", weight: 3, minAge: 16, maxAge: 9000,
    cond: c => c.relationships.filter(n => n.role === "companion" && n.married && n.alive).length >= 2 && (c.charm + c.soul) >= 120,
    auto: (c, rng, A) => { A.happy(7); for (const n of c.relationships) if (n.role === "companion" && n.married && n.alive) n.affinity = Math.min(100, n.affinity + 3); return "Your dao companions move through your household like one mind in many bodies — a rare and harmonious union that is the envy of the cultivation world. (+Happiness)"; },
  },
  {
    id: "lover_neglected", weight: 3, minAge: 16, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "companion" && n.alive && !n.married && n.affinity < 30),
    text: c => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity < 30); return `${n ? n.name : "A companion"}, long left wanting for your attention, asks quietly whether your heart is truly in this.`; },
    choices: [
      { label: "Rekindle the romance", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity < 30); if (n) n.affinity = Math.min(100, n.affinity + 18); A.happy(4); return `You set everything aside for them, and the warmth returns to ${n ? n.name : "their"} eyes.`; } },
      { label: "Let them go", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive && !x.married && x.affinity < 30); if (n) { n.role = "friend"; n.kin = null; } A.happy(-4); return `You part ways gently. ${n ? n.name : "They"} remains a friend, but the romance fades to memory.`; } },
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
      { label: "Fight on the front line", result: (c, rng, A) => { const res = A.fight(); if (c.alive) { const cc = 40 + c.sectRank * 12; c.contribution += cc; c.reputation += 4; c.sectMissions = (c.sectMissions || 0) + 1; res.push(`Your sect repels the invaders. Your valour earns ${cc} contribution, renown, and a mark of merit. (+contribution, counts as a mission)`); } return ["You take your place in the battle-line."].concat(res); } },
      { label: "Hold the rearguard (safer)", result: (c, rng, A) => { c.contribution += 12; A.happy(-1); return "You guard the wounded and the wards at the rear. Honest service, if no glory. (+12 contribution)"; } },
      { label: "Hide until it passes", result: (c, rng, A) => { c.reputation -= 6; A.happy(-4); return "You cower in the herb-cellar while others bleed. The sect remembers cowards."; } },
    ],
  },
  {
    id: "elder_favor", weight: 4, awakened: true, cond: c => c.sectKey && c.sectRank >= 1, cooldown: 6,
    text: c => `Word comes from your sect's inner hall: a senior elder has taken note of your diligence and offers a private word.`,
    choices: [
      { label: "Show humble respect", result: (c, rng, A) => { c.contribution += rng.randint(20, 45); if (rng.random() < 0.4) { cap(c, "comprehension", 2); return "The elder shares a fragment of dao insight and commends you to the sect master. (+contribution, +Comprehension)"; } return "The elder marks you as a disciple to watch. Your standing in the sect rises. (+contribution)"; } },
      { label: "Ask for a personal teaching", result: (c, rng, A) => { if (rng.random() < 0.35 + c.charm / 250) { const t = A.learnTech(); return t ? `Impressed by your boldness, the elder imparts an art: ${t}!` : "The elder nods and quickens your cultivation instead."; } A.happy(-2); c.contribution = Math.max(0, c.contribution - 5); return "The elder finds you presumptuous and waves you off. (−a little contribution)"; } },
    ],
  },
  {
    id: "rival_disciple", weight: 4, minRealm: 2, awakened: true, cond: c => c.sectKey, cooldown: 5,
    text: () => "A swaggering senior brother of your own sect blocks the training hall and demands you 'know your place' in a friendly bout.",
    choices: [
      { label: "Accept the bout", result: (c, rng, A) => { if (rng.random() < 0.4 + c.comprehension / 300 + c.constitution / 300) { c.contribution += 18; c.reputation += 2; cap(c, "comprehension", 1); return "You best your senior before the watching disciples; your name rises in the inner halls. (+contribution, +Comprehension)"; } A.heal(-8); A.happy(-3); return "He drubs you soundly and struts off. You nurse bruises and a grudge."; } },
      { label: "Bow out gracefully", result: (c, rng, A) => { cap(c, "soul", 1); return "You decline with a calm word. Let him crow; a still heart needs no audience. (+Soul Sense)"; } },
    ],
  },
  {
    id: "own_sect_raided", weight: 4, awakened: true, cond: c => c.ownSect && c.ownSect.prestige >= 30,
    text: c => `A jealous rival sect, galled by the rise of the ${c.ownSect.name}, raids your mountain seat in the night!`,
    choices: [
      { label: "Lead the defence yourself", result: (c, rng, A) => { const res = A.fight(); if (c.alive) { c.ownSect.prestige += 25; c.reputation += 5; res.push(`You throw back the raiders at the gates of the ${c.ownSect.name}. Your legend — and your sect's — grows. (+prestige, +fame)`); } return ["You rush to the wall as alarm-gongs ring."].concat(res); } },
      { label: "Let the elders handle it", result: (c, rng, A) => { const lost = rng.randint(10, 25); c.ownSect.prestige = Math.max(0, c.ownSect.prestige - lost); c.ownSect.members = Math.max(0, c.ownSect.members - rng.randint(2, 6)); A.happy(-4); return `Your disciples fight without you and are scattered; the ${c.ownSect.name} loses face and followers. (−${lost} prestige)`; } },
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
      { label: "Answer their challenge now", result: (c, rng, A) => { const n = A.nemesis(); if (!n) return "You spin to answer — but they have already melted back into the crowd."; return ["Blood rushes to your head — you call them out on the spot!"].concat(A.fight([n.name, n.power, (c.realm + 1) * 6, "rogue"])); } },
    ],
  },
  {
    id: "nemesis_ambush", weight: 4, minRealm: 2, awakened: true,
    cond: c => c.relationships.some(n => n.role === "nemesis" && n.alive),
    auto: (c, rng, A) => { const n = A.nemesis(); if (!n) return "You sense a hostile gaze on the road, but it fades before you can place it."; return ["Your nemesis " + n.name + " ambushes you on a lonely mountain road!"].concat(A.fight([n.name, n.power, (c.realm + 1) * 7, "rogue"])); },
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

  /* ===================== additional childhood (ages 1-10) ============== */
  {
    id: "child_firstword", weight: 5, minAge: 1, maxAge: 3, awakened: false, once: true,
    auto: (c, rng, A) => { cap(c, "comprehension", 1); return rng.choice([`Your first word isn't "mama" or "papa" — it's "dao." Your parents exchange a worried glance.`, `You babble a string of nonsense that the village monk swears is an ancient mantra.`]); },
  },
  {
    id: "child_flyby", weight: 6, minAge: 3, maxAge: 11, awakened: false,
    auto: (c, rng, A) => { A.happy(5); A.qi(0.1); return "A sword-riding cultivator streaks across the sky, robes snapping in the wind. You stare upward for hours, a longing kindling in your small chest."; },
  },
  {
    id: "child_storyteller", weight: 6, minAge: 4, maxAge: 10, awakened: false,
    auto: (c, rng, A) => { cap(c, "comprehension", rng.randint(1, 2)); return "A blind storyteller spins tales of immortals and demon-kings by the well. You hang on every word and remember them all."; },
  },
  {
    id: "child_nightmare", weight: 4, minAge: 2, maxAge: 9, awakened: false,
    auto: (c, rng, A) => { if (rng.random() < 0.5) { cap(c, "soul", 1); return "You wake screaming from a dream of a thousand eyes in the dark — but in facing it, your spirit toughens."; } A.happy(-4); return "Night terrors plague you for a week; you cling to your mother's sleeve."; },
  },
  {
    id: "child_lost", weight: 5, minAge: 3, maxAge: 8, awakened: false,
    text: () => "You wander off chasing a butterfly and find yourself lost and alone as dusk falls.",
    choices: [
      { label: "Stay calm and retrace your steps", result: (c, rng, A) => { cap(c, "comprehension", 1); A.happy(2); return "You keep your head, follow the stream home, and stride in just after dark — quietly proud."; } },
      { label: "Cry for help", result: (c, rng, A) => { const f = A.meet("friend", { affinity: 16 }); return `A kindly older child, ${f.name}, finds you and walks you home. A friendship begins.`; } },
    ],
  },
  {
    id: "child_festival", weight: 6, minAge: 4, maxAge: 11, awakened: false,
    text: () => "The harvest festival fills the village with lanterns, sweets and stilt-walkers.",
    choices: [
      { label: "Watch the fireworks, wide-eyed", result: (c, rng, A) => { A.happy(7); return "You gorge on candied hawthorn and gape at the fireworks until you fall asleep on your father's shoulders."; } },
      { label: "Pocket a vendor's coins", result: (c, rng, A) => { if (rng.random() < 0.5) { A.stones(rng.randint(1, 4)); A.karma(-2); return "Small fingers, quick work. You're a few coins richer and no one the wiser."; } A.happy(-5); return "A meaty hand seizes your wrist. You earn a thrashing and a scolding in front of everyone."; } },
    ],
  },
  {
    id: "child_river", weight: 4, minAge: 5, maxAge: 10, awakened: false,
    text: () => "The older children dare you to swim across the swift summer river.",
    choices: [
      { label: "Take the dare", result: (c, rng, A) => { if (rng.random() < 0.55 + c.constitution / 300) { cap(c, "constitution", 2); A.happy(5); return "You fight the current and haul yourself up the far bank, gasping and triumphant. (+Constitution)"; } A.heal(-12); A.happy(-4); return "The current drags you under; a farmer fishes you out half-drowned. You cough up river-water for days."; } },
      { label: "Refuse", result: (c, rng, A) => { A.happy(-2); return "They jeer and call you a coward, but you keep your dry skin and your good sense."; } },
    ],
  },
  {
    id: "child_temple", weight: 5, minAge: 4, maxAge: 11, awakened: false,
    text: () => "At the mountain temple, a wrinkled monk studies your face a moment too long.",
    choices: [
      { label: "Bow and ask his blessing", result: (c, rng, A) => { cap(c, "comprehension", 2); A.happy(3); A.karma(2); return `The monk presses a thumb to your brow. "A curious fate," he murmurs, and gives you a prayer-bead. (+Comprehension)`; } },
      { label: "Hide behind your mother", result: () => "You shy away. The monk only smiles and returns to his sweeping." },
    ],
  },
  {
    id: "child_stray", weight: 5, minAge: 3, maxAge: 9, awakened: false,
    auto: (c, rng, A) => { A.happy(6); cap(c, "charm", 1); return "A scrawny stray dog adopts you, trailing you everywhere. You share your scraps and name it after a hero from the storyteller's tales."; },
  },
  {
    id: "child_lean_year", weight: 4, minAge: 2, maxAge: 9, awakened: false,
    cond: c => ["slave", "beggar", "peasant", "hunter"].includes(c.backgroundKey),
    text: () => "Drought withers the crops and the whole household goes hungry through a long, grey winter.",
    choices: [
      { label: "Give your share to a sibling", result: (c, rng, A) => { A.karma(3); A.heal(-8); A.kinAdjust("brother", 5); A.kinAdjust("sister", 5); return "You go to bed with an empty belly so the little ones can eat. It marks you — gaunt, but good."; } },
      { label: "Forage in the hills", result: (c, rng, A) => { if (rng.random() < 0.6) { A.herbs(rng.randint(1, 3)); return "You learn which roots and berries are safe, and bring home what you can. The hills become your larder."; } A.heal(-6); return "You eat the wrong mushrooms and spend two days violently ill."; } },
    ],
  },

  /* ===================== additional youth (ages 6-17) ================== */
  {
    id: "youth_competition", weight: 6, minAge: 8, maxAge: 16,
    text: () => "A village contest of wits and strength is held; children from miles around compete for a silver tael.",
    choices: [
      { label: "Compete with all your heart", result: (c, rng, A) => { if (rng.random() < 0.35 + (c.constitution + c.comprehension) / 500) { A.stones(rng.randint(3, 8)); c.reputation += 2; A.happy(6); return "You win! The silver is yours, and the village remembers your name."; } A.happy(-2); cap(c, "constitution", 1); return "You don't place, but you give a good showing and learn from those who beat you."; } },
      { label: "Watch from the sidelines", result: (c, rng, A) => { cap(c, "comprehension", 1); return "You study every match instead, learning more about people than any prize could teach."; } },
    ],
  },
  {
    id: "youth_streetfight", weight: 5, minAge: 9, maxAge: 16,
    text: () => "A gang of older toughs corners you in an alley, demanding your coin.",
    choices: [
      { label: "Fight your way out", result: (c, rng, A) => { if (rng.random() < 0.4 + c.constitution / 250) { cap(c, "constitution", 2); c.reputation += 1; A.happy(4); return "You bloody two of them and bolt. Word spreads that you're not to be trifled with. (+Constitution)"; } A.heal(-12); A.stones(-Math.min(c.spiritStones, 3)); return "They beat you down and take what little you have. You limp home nursing your pride."; } },
      { label: "Talk fast", result: (c, rng, A) => { if (rng.random() < 0.4 + c.charm / 250) { cap(c, "charm", 1); return "A clever line and a confident grin — somehow they laugh and let you pass."; } A.stones(-Math.min(c.spiritStones, 3)); return "Your words fail; they take your coin and shove you in a puddle."; } },
    ],
  },
  {
    id: "youth_oddmentor", weight: 4, minAge: 8, maxAge: 16, once: true,
    text: () => "A one-armed veteran sharpening knives by the gate offers to teach you 'something useful.'",
    choices: [
      { label: "Accept the lesson", result: (c, rng, A) => { cap(c, "constitution", 2); cap(c, "comprehension", 1); return "For a season he drills you in footwork, breathing and the reading of an opponent's eyes. It sticks with you for life."; } },
      { label: "Politely decline", result: () => "You bow and move on. He shrugs and returns to his whetstone." },
    ],
  },
  {
    id: "youth_firstcrush", weight: 5, minAge: 13, maxAge: 17,
    cond: c => !c.relationships.some(n => n.role === "companion" && n.alive),
    text: () => "Your heart does something strange and new whenever a certain someone from the next village passes by.",
    choices: [
      { label: "Work up the courage to talk to them", result: (c, rng, A) => { if (rng.random() < 0.4 + c.charm / 200) { const n = A.meet("friend", { affinity: 22 }); A.happy(8); return `You stammer out a greeting and ${n.name} smiles back. A sweet, awkward friendship blooms.`; } A.happy(-5); return "You freeze, say something idiotic, and flee crimson-faced. Mortifying."; } },
      { label: "Admire from afar", result: (c, rng, A) => { A.happy(2); return "You compose terrible poetry in secret and never send it. Such is youth."; } },
    ],
  },
  {
    id: "youth_forbidden_book", weight: 4, minAge: 10, maxAge: 16, once: true,
    text: () => "You find a water-stained manual hidden under a loose floorboard in an abandoned house.",
    choices: [
      { label: "Study it in secret", result: (c, rng, A) => { const t = A.learnTech(); cap(c, "comprehension", 1); return t ? `The crabbed script slowly yields its secrets: you teach yourself ${t}!` : "The pages are too damaged to decipher, but puzzling over them sharpens your mind."; } },
      { label: "Hand it to the elders", result: (c, rng, A) => { c.reputation += 3; A.karma(2); return "You turn the dangerous text over to the village elders, who commend your honesty."; } },
    ],
  },

  /* ===================== additional adult / any (16+) ================== */
  {
    id: "wandering_monk_riddle", weight: 5, minAge: 12, maxAge: 9000,
    text: () => `A travelling monk bars the road with a riddle: "What grows the heavier the more you take from it?"`,
    choices: [
      { label: '"A grave."', result: (c, rng, A) => { cap(c, "comprehension", 2); A.happy(3); A.karma(1); return "The monk's eyes crinkle. 'Just so.' He gifts you a pearl of insight before walking on. (+Comprehension)"; } },
      { label: '"A debt."', result: (c, rng, A) => { cap(c, "comprehension", 1); return "'A worldly answer, but not a wrong one,' he allows, and shares a smaller wisdom."; } },
      { label: "Push past, impatient", result: (c, rng, A) => { A.happy(-2); return "You shoulder past. The monk sighs at the back of your head, disappointed."; } },
    ],
  },
  {
    id: "meteor_shower", weight: 4, minAge: 10, maxAge: 9000, awakened: true,
    auto: (c, rng, A) => { A.qi(rng.uniform(0.2, 0.5)); cap(c, "comprehension", 1); return "You cultivate beneath a sky raining silver fire. The cosmos feels close enough to touch, and your dao-heart drinks it in."; },
  },
  {
    id: "beggar_immortal", weight: 4, minAge: 12, maxAge: 9000,
    cond: c => c.spiritStones > 0,
    text: () => "A filthy beggar with strangely clear eyes holds out a cracked bowl as you pass.",
    choices: [
      { label: "Give freely", result: (c, rng, A) => { A.stones(-1); A.karma(4); if (rng.random() < 0.3) { return [...A.giveArtifact()].concat("The 'beggar' presses something into your hand, winks, and is simply... gone."); } A.happy(3); return "You drop in a coin without a second thought. The beggar murmurs a blessing that lingers warm in your chest."; } },
      { label: "Ignore them", result: (c, rng, A) => { A.karma(-1); return "You walk past. When you glance back, the beggar — and the alley — are empty."; } },
    ],
  },
  {
    id: "traveling_merchant", weight: 5, minAge: 12, maxAge: 9000,
    cond: c => c.spiritStones >= 15,
    text: () => "A grinning merchant unrolls a cloth of curios: 'For you, friend, a special price on a sealed mystery box!'",
    choices: [
      { label: "Buy the mystery box (15 stones)", result: (c, rng, A) => { A.stones(-15); const r = rng.random(); if (r < 0.35) return [...A.giveArtifact()]; if (r < 0.6) { A.herbs(rng.randint(3, 8)); return "Inside: a fragrant bundle of spirit herbs."; } if (r < 0.8) { c.pills += rng.randint(1, 2); return "Inside: a small jar of pills."; } A.happy(-3); return "Inside: sawdust and a rude note. Swindled!"; } },
      { label: "Haggle, then decline", result: (c, rng, A) => { cap(c, "charm", 1); return "You talk him in circles for sport, buy nothing, and leave him scratching his head."; } },
    ],
  },
  {
    id: "drinking_contest", weight: 4, minAge: 16, maxAge: 9000,
    text: () => "At a roadside tavern, a red-faced cultivator slams down a jug and challenges you to drink him under the table.",
    choices: [
      { label: "Accept the challenge", result: (c, rng, A) => { if (rng.random() < 0.4 + c.constitution / 250) { c.reputation += 2; A.happy(6); const f = A.meet("friend", { affinity: 20 }); return `You drink the braggart senseless. The whole tavern toasts you, and ${f.name} becomes a fast friend.`; } A.heal(-6); A.happy(-3); return "You wake in a ditch the next morning with no memory and no coin-purse."; } },
      { label: "Decline graciously", result: (c, rng, A) => { cap(c, "soul", 1); return "You raise a cup of tea instead. Clear-headed, you watch the fool drink himself into a stupor."; } },
    ],
  },
  {
    id: "old_friend", weight: 4, minAge: 18, maxAge: 9000,
    cond: c => c.relationships.some(n => n.role === "friend" && n.alive),
    auto: (c, rng, A) => { const f = c.relationships.find(n => n.role === "friend" && n.alive); A.happy(7); if (f) f.affinity = Math.min(100, f.affinity + 8); return `You cross paths with your old friend ${f ? f.name : ""} in a faraway city. You talk until dawn of all the roads you've walked apart.`; },
  },
  {
    id: "poison_plot", weight: 3, minAge: 16, maxAge: 9000, awakened: true,
    cond: c => c.reputation >= 20 || c.spiritStones >= 50,
    text: () => "At a banquet, you notice your wine-cup smells faintly of bitter almonds — poison.",
    choices: [
      { label: "Feign a drink, then expose the poisoner", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 250) { c.reputation += 4; A.karma(2); const n = A.meet("enemy", { affinity: -45 }); return `You pretend to sip, catch the culprit's eager glance, and denounce ${n.name} before the whole hall. A new enemy, and a sharpened reputation.`; } A.heal(-15); return "You misjudge the timing and swallow a mouthful. You survive, but spend a feverish month purging the toxin."; } },
      { label: "Quietly pour it out and leave", result: (c, rng, A) => { A.happy(-3); return "You tip the wine into a potted plant and slip away. Someone wants you dead — but who?"; } },
    ],
  },
  {
    id: "spirit_storm", weight: 4, minAge: 10, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    text: () => "The sky turns violet and a storm of wild, dense spirit-qi rolls over the land.",
    choices: [
      { label: "Cultivate within the storm", result: (c, rng, A) => { if (rng.random() < 0.6) { A.qi(rng.uniform(0.4, 0.9)); return "You open your meridians to the raging qi and ride the storm to a surge of progress."; } A.heal(-14); A.happy(-3); return "The qi proves too violent; it savages your meridians and you cough blood for days."; } },
      { label: "Shelter and wait it out", result: (c, rng, A) => { A.qi(0.1); return "You hunker in a cave until the storm passes. Safe, if unspectacular."; } },
    ],
  },
  {
    id: "lantern_festival", weight: 5, minAge: 14, maxAge: 9000,
    text: () => "A great lantern festival lights the river with a thousand floating flames.",
    choices: [
      { label: "Float a lantern with a wish", result: (c, rng, A) => { A.happy(8); if (!c.relationships.some(n => n.role === "companion" && n.alive) && c.age >= D.ageMin("romance") && rng.random() < 0.25) { const n = A.meet("companion", { affinity: 24 }); return `As your lantern drifts off, your hand brushes another's at the rail — ${n.name}. Fate, perhaps.`; } return "You whisper a wish and watch your light join the river of stars. Your heart eases."; } },
      { label: "Sell trinkets to the crowd", result: (c, rng, A) => { A.stones(rng.randint(4, 12)); return "You hawk paper charms to lovers and families, turning a tidy profit on the festival mood."; } },
    ],
  },

  /* ===================== high-realm trials (Golden Core+) ============== */
  {
    id: "closed_door_seclusion", weight: 5, minRealm: 4, awakened: true,
    text: () => "You feel a breakthrough trembling just out of reach. The temptation to seal yourself in seclusion for a long retreat is strong.",
    choices: [
      { label: "Enter closed-door seclusion", result: (c, rng, A) => { if (rng.random() < 0.55 + c.comprehension / 300) { A.qi(rng.uniform(0.8, 1.5)); cap(c, "comprehension", 2); return "Months blur into one breath. You emerge gaunt, hollow-eyed — and far stronger. The wall is gone."; } A.heal(-10); A.happy(-5); return "You sit and sit, but the dao will not come. You emerge stiff, frustrated, and no closer."; } },
      { label: "Keep walking the world", result: (c, rng, A) => { cap(c, "soul", 1); A.happy(3); return "The dao is found in living, not hiding, you decide. You stay among the dust of the mortal road."; } },
    ],
  },
  {
    id: "tribulation_omen", weight: 4, minRealm: 4, awakened: true, cooldown: 12,
    auto: (c, rng, A) => { A.happy(-3); cap(c, "soul", 1); return "Black clouds gather unseasonably whenever your qi surges. The heavens have taken note of you; a tribulation waits somewhere down your road. You steel your dao-heart. (+Soul)"; },
  },
  {
    id: "enlightenment_tree", weight: 4, minRealm: 5, awakened: true, once: true,
    text: () => "Deep in an ancient forest you find a withered tree under which, legend says, a long-dead immortal once attained the dao.",
    choices: [
      { label: "Sit beneath it and meditate", result: (c, rng, A) => { A.qi(rng.uniform(1.0, 2.0)); cap(c, "comprehension", 4); cap(c, "soul", 2); return "Echoes of an ancient enlightenment seep into you across the centuries. You rise with the world made suddenly, terribly clear. (+Comprehension, +Soul)"; } },
      { label: "Leave the sacred ground undisturbed", result: (c, rng, A) => { A.karma(5); return "Some places are not yours to take from. You bow, leave an offering, and walk on lighter for it. (+Karma)"; } },
    ],
  },
  {
    id: "immortal_inheritance", weight: 3, minRealm: 5, awakened: true, once: true,
    cond: c => c.comprehension >= 30,
    text: () => "A drifting fragment of an immortal's memory-jade finds you, recognizing a kindred dao. It offers its inheritance — but the trial will scour your very soul.",
    choices: [
      { label: "Accept the soul-trial", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 300) { const t = A.learnTech(); A.qi(1.5); cap(c, "comprehension", 3); const a = A.giveArtifact("Heaven"); return ["You endure the searing trial and claim the inheritance — knowledge, power, and a treasure across the ages.", t ? `You comprehend ${t}.` : "Ancient insight floods your meridians."].concat(a); } A.heal(-25); A.happy(-10); return "The trial is too much; the memory-jade shatters and the backlash leaves you bleeding from the eyes. You barely cling to sanity."; } },
      { label: "Refuse — it is not your dao", result: (c, rng, A) => { cap(c, "soul", 2); return "You will reach immortality on your own road or not at all. The jade dims, almost approving, and crumbles to dust. (+Soul)"; } },
    ],
  },
  {
    id: "demon_invasion", weight: 4, minRealm: 4, awakened: true,
    cond: c => c.karma > -40,
    text: () => "A tide of corpse-fiends and devil-path cultivators pours out of a torn rift, swarming toward a city of mortals and weak cultivators.",
    choices: [
      { label: "Stand against the tide", result: (c, rng, A) => { const res = A.fight(["a Devil-Path Vanguard", A.power() * rng.uniform(1.0, 1.4), (c.realm + 1) * 8, "rogue"]); if (c.alive) { A.karma(15); c.reputation += 8; res.push("You hold the line until reinforcements come. The city erects a shrine in your name. (+Karma, +Reputation)"); } return ["You plant your feet between the fiends and the fleeing thousands."].concat(res); } },
      { label: "Evacuate who you can", result: (c, rng, A) => { A.karma(6); A.happy(-4); A.stones(-Math.min(c.spiritStones, 10)); return "You can't beat the horde, but you spend yourself shepherding mortals out the eastern gate. Not glory — but lives. (+Karma)"; } },
    ],
  },
  {
    id: "dao_debate", weight: 5, minRealm: 3, awakened: true,
    text: () => "At a convocation of cultivators, an arrogant elder challenges all comers to a debate on the nature of the dao.",
    choices: [
      { label: "Cross words with the elder", result: (c, rng, A) => { if (rng.random() < 0.35 + c.comprehension / 250) { cap(c, "comprehension", 3); c.reputation += 4; A.happy(6); return "Your insight cuts cleaner than his centuries of dogma. The hall murmurs your name. (+Comprehension, +Reputation)"; } A.happy(-4); cap(c, "comprehension", 1); return "He runs verbal circles around you, but you learn from the loss. (+Comprehension)"; } },
      { label: "Listen and refine your own dao", result: (c, rng, A) => { cap(c, "comprehension", 2); return "You stay silent, absorbing every argument, sharpening your private understanding. (+Comprehension)"; } },
    ],
  },
  {
    id: "ascension_call", weight: 3, minRealm: 8, awakened: true, cooldown: 15,
    auto: (c, rng, A) => { A.qi(rng.uniform(0.5, 1.0)); cap(c, "soul", 2); return "On still nights you hear it now: a faint bell tolling from beyond the sky, where the true immortals dwell. The Nine Heavens are calling you home. (+Soul)"; },
  },

  /* ===================== relationships, deepened ====================== */
  {
    id: "child_awakens", weight: 6, awakened: true, once: false, cooldown: 20,
    cond: c => c.relationships.some(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && (c.age - (n.born || c.age)) >= 6 && !n._awakened),
    text: c => { const k = c.relationships.find(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && (c.age - (n.born || c.age)) >= 6 && !n._awakened); return `Your child ${k ? k.name : ""} reaches the age of awakening. The testing-stone is brought out before the family.`; },
    choices: [
      { label: "Watch with bated breath", result: (c, rng, A) => {
        const k = c.relationships.find(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && !n._awakened);
        if (!k) return "The moment passes.";
        k._awakened = true;
        const rootKey = (k.geno && k.geno.rootKey) || "waste";   // the root they inherited at birth
        const row = D.ROOT_TYPES.find(r => r[0] === rootKey);
        const tier = D.ROOT_TIER[rootKey] || 0;
        E.ensureNpcProfile(k, rng, { realm: 0 });                // they begin their own cultivation now
        k.power = Math.max(k.power || 0, A.power() * (0.18 + tier * 0.05));
        k.affinity = Math.min(100, k.affinity + 8);
        if (rootKey === "none") { A.happy(-4); return `The testing-stone stays dull and grey — ${k.name} has no spiritual root. Your heart aches for them; you resolve they shall walk the body-tempering road instead.`; }
        if (tier >= 4) { A.happy(18); c.reputation += 5; return `The stone BLAZES like a captured sun — ${k.name} has awakened a ${row[1]}! A heaven-blessed heir; your bloodline's glory is assured. (+Happiness, +Reputation)`; }
        if (tier >= 2) { A.happy(12); c.reputation += 2; return `The stone shines clean and bright — ${k.name} has a ${row[1]}. A genuine talent to carry the dao onward. (+Happiness)`; }
        A.happy(4); return `The stone glows only faintly — ${k.name} has a ${row[1]}. A humble root, but you vow to give them every chance you never had.`;
      } },
    ],
  },
  {
    id: "disciple_breakthrough", weight: 5, awakened: true, cooldown: 6,
    cond: c => c.relationships.some(n => n.role === "disciple" && n.alive),
    auto: (c, rng, A) => { const d = c.relationships.find(n => n.role === "disciple" && n.alive); if (d) { d.power = (d.power || A.power() * 0.3) * rng.uniform(1.15, 1.35); d.affinity = Math.min(100, d.affinity + 6); } A.happy(8); c.reputation += 2; return `Your disciple ${d ? d.name : ""} pushes through a hard bottleneck and advances. They kneel to thank you, and your name shines a little brighter. (+Reputation)`; },
  },
  {
    id: "disciple_strays", weight: 3, awakened: true,
    cond: c => c.relationships.some(n => n.role === "disciple" && n.alive),
    text: c => { const d = c.relationships.find(n => n.role === "disciple" && n.alive); return `You discover your disciple ${d ? d.name : ""} has been secretly studying a forbidden demonic art, hungry for faster power.`; },
    choices: [
      { label: "Discipline them sternly", result: (c, rng, A) => { const d = c.relationships.find(n => n.role === "disciple" && n.alive); if (d) { if (rng.random() < 0.6) { d.affinity = Math.min(100, d.affinity + 8); A.karma(3); return `${d.name} weeps, burns the manual, and rededicates themselves to the orthodox path. You have saved them. (+Karma)`; } d.role = "enemy"; d.affinity = -40; A.happy(-8); return `${d.name} sneers at your "weakness," abandons you, and flees into the night. A master's bitterest failure.`; } return "The matter resolves itself."; } },
      { label: "Look the other way", result: (c, rng, A) => { A.karma(-6); A.happy(-3); return "Power is power, you tell yourself. But a seed of darkness now grows in your lineage, and you know it."; } },
    ],
  },
  {
    id: "companion_peril", weight: 4, awakened: true,
    cond: c => c.relationships.some(n => n.role === "companion" && n.alive),
    text: c => { const n = c.relationships.find(x => x.role === "companion" && x.alive); return `Word comes that your dao companion ${n ? n.name : ""} has been gravely wounded and taken captive by enemies.`; },
    choices: [
      { label: "Storm the enemy stronghold", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive); const res = A.fight(["the Captor's Champion", A.power() * rng.uniform(0.9, 1.3), (c.realm + 1) * 7, "rogue"]); if (c.alive) { if (n) n.affinity = Math.min(100, n.affinity + 15); A.happy(12); res.push(`You carry ${n ? n.name : "your beloved"} out of the smoke. Some bonds are worth any war.`); } return ["You go alone, against everyone's counsel, blade drawn."].concat(res); } },
      { label: "Pay the ransom", result: (c, rng, A) => { const n = c.relationships.find(x => x.role === "companion" && x.alive); const cost = Math.min(c.spiritStones, 40 + c.realm * 15); A.stones(-cost); if (n) n.affinity = Math.max(-100, n.affinity - 5); A.happy(-2); return `You empty your reserves — ${cost} stones — to buy ${n ? n.name : "them"} back. They live, but the helplessness gnaws at you both.`; } },
    ],
  },
  {
    id: "master_legacy", weight: 4, awakened: true, once: true,
    cond: c => c.relationships.some(n => n.role === "master" && n.alive),
    text: c => { const m = c.relationships.find(n => n.role === "master" && n.alive); return `Your old master ${m ? m.name : ""}, nearing the end of a long life, summons you to pass on a final legacy.`; },
    choices: [
      { label: "Kneel and receive their dao", result: (c, rng, A) => { const m = c.relationships.find(n => n.role === "master" && n.alive); const t = A.learnTech(); cap(c, "comprehension", 3); A.happy(-4); if (m) { m.alive = false; A.note(`${m.name}, your master, passed on their legacy and died.`); } return [`${m ? m.name : "Your master"} pours decades of insight into you with their dying breath, then passes with a peaceful smile.`, t ? `Their final gift: ${t}.` : "Their final gift is wordless understanding. (+Comprehension)"]; } },
    ],
  },
  {
    id: "master_trial", weight: 5, awakened: true,
    cond: c => c.relationships.some(n => n.role === "master" && n.alive),
    text: c => { const m = c.relationships.find(n => n.role === "master" && n.alive); return `${m ? m.name : "Your master"} sets you a trial to prove your progress — a test of will and blade both.`; },
    choices: [
      { label: "Undertake the trial", result: (c, rng, A) => { const m = c.relationships.find(n => n.role === "master" && n.alive); if (rng.random() < 0.4 + c.comprehension / 250) { cap(c, "comprehension", 2); const t = A.learnTech(); if (m) m.affinity = Math.min(100, (m.affinity || 0) + 8); return [`You pass ${m ? m.name + "'s" : "the"} trial with flying colours.`, t ? `Pleased, your master rewards you with the ${t}.` : "Your master nods, and your understanding deepens. (+Comprehension)"]; } A.happy(-3); if (m) m.affinity = Math.max(-100, (m.affinity || 0) - 2); return [`You stumble at the trial. ${m ? m.name : "Your master"} sighs: "Again. And again, until it is right."`]; } },
      { label: "Beg off — you are not ready", result: (c, rng, A) => { const m = c.relationships.find(n => n.role === "master" && n.alive); if (m) m.affinity = Math.max(-100, (m.affinity || 0) - 5); A.happy(-2); return [`${m ? m.name : "Your master"} frowns at your timidity, but lets it pass.`]; } },
    ],
  },
  {
    id: "disciple_rivalry", weight: 4, awakened: true,
    cond: c => c.relationships.filter(n => n.role === "disciple" && n.alive).length >= 2,
    text: c => { const d = c.relationships.filter(n => n.role === "disciple" && n.alive); return `Two of your disciples, ${d[0].name} and ${d[1].name}, fall to bitter rivalry over which of them is your true successor.`; },
    choices: [
      { label: "Set them a fair contest", result: (c, rng, A) => { const d = c.relationships.filter(n => n.role === "disciple" && n.alive); d.forEach(x => { x.power = (x.power || 1) * 1.06; x.affinity = Math.min(100, (x.affinity || 0) + 4); }); A.happy(3); if (c.ownSect) c.ownSect.prestige += 6; return `You pit them against each other in honest contest. Both push harder than ever, and the whole hall is the stronger for it.`; } },
      { label: "Rebuke them both", result: (c, rng, A) => { const d = c.relationships.filter(n => n.role === "disciple" && n.alive); d.forEach(x => { x.affinity = Math.max(-100, (x.affinity || 0) - 3); }); return `You scold them sharply. The feud cools into a sullen, simmering peace.`; } },
    ],
  },
  {
    id: "sibling_reunion", weight: 4, minAge: 16, maxAge: 9000,
    cond: c => c.relationships.some(n => (n.kin === "Brother" || n.kin === "Sister") && n.alive),
    text: c => { const s = c.relationships.find(n => (n.kin === "Brother" || n.kin === "Sister") && n.alive); return `Your ${s ? s.kin.toLowerCase() : "sibling"} ${s ? s.name : ""}, long parted from you, appears at your door — older, wearier, but family still.`; },
    choices: [
      { label: "Welcome them warmly", result: (c, rng, A) => { const s = c.relationships.find(n => (n.kin === "Brother" || n.kin === "Sister") && n.alive); if (s) s.affinity = Math.min(100, s.affinity + 20); A.happy(10); return `You share wine and old memories late into the night. Blood endures where so much else is washed away by the years.`; } },
      { label: "Help them onto the path", result: (c, rng, A) => { const s = c.relationships.find(n => (n.kin === "Brother" || n.kin === "Sister") && n.alive); const cost = Math.min(c.spiritStones, 20); A.stones(-cost); if (s) { s.affinity = Math.min(100, s.affinity + 12); s.power = (s.power || 1) * 1.2 + 3; } A.karma(3); return `You gift ${s ? s.name : "them"} resources and a manual to start their own cultivation. (+Karma)`; } },
    ],
  },
  {
    id: "rival_reconcile", weight: 3, awakened: true,
    cond: c => c.relationships.some(n => n.role === "nemesis" && n.alive),
    text: c => { const n = c.relationships.find(x => x.role === "nemesis" && x.alive); return `You and your nemesis ${n ? n.name : ""} are stranded together in a deadly ruin, each the other's only chance of survival.`; },
    choices: [
      { label: "Fight side by side to survive", result: (c, rng, A) => { const n = A.nemesis(); const res = A.fight(["the Ruin's Guardian", A.power() * rng.uniform(1.0, 1.4), (c.realm + 1) * 8, "rogue"]); if (c.alive && n) { if (rng.random() < 0.5) { n.role = "rival"; n.affinity = 20; n.kin = "Old Rival"; res.push(`In the firelight afterward, ${n.name} grunts a grudging respect. The hatred between you finally cools into something almost like friendship.`); } else { res.push(`${n.name} nods once, and you part ways — the rivalry intact, but tempered by a debt of survival.`); } } return ["Back to back, old enemies, against the dark."].concat(res); } },
      { label: "Use them as a shield and flee", result: (c, rng, A) => { const n = A.nemesis(); if (n) n.power *= 1.15; A.karma(-8); A.happy(-3); return `You shove ${n ? n.name : "them"} into danger and bolt. They survive — and now their hatred has no bottom at all.`; } },
    ],
  },

  /* ===================== more world variety ========================== */
  {
    id: "chess_immortal", weight: 4, minAge: 14, maxAge: 9000,
    text: () => "A white-bearded ancient sits at a weiqi board on a mountain ledge, a single seat empty across from him. 'A game?' he asks, without looking up.",
    choices: [
      { label: "Sit and play", result: (c, rng, A) => { if (rng.random() < 0.3 + c.comprehension / 250) { cap(c, "comprehension", 3); A.qi(0.3); return "Stone by stone, he teaches you to see the whole board — the whole world — at once. You leave changed. (+Comprehension)"; } A.happy(3); cap(c, "comprehension", 1); return "He thrashes you in nineteen moves, chuckling, then shares a cup of cloud-tea and a small wisdom."; } },
      { label: "Bow and walk on", result: () => "You sense you are out of your depth and politely decline. He smiles and replaces the stones, waiting for another." },
    ],
  },
  {
    id: "fox_spirit", weight: 4, minAge: 16, maxAge: 9000, awakened: true,
    text: () => "A breathtaking stranger with eyes like amber lures you toward a moonlit pavilion. Something about them is not quite... human.",
    choices: [
      { label: "See through the glamour", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 250) { cap(c, "soul", 2); A.stones(rng.randint(5, 20)); return "You pierce the illusion; a fox-spirit, caught, laughs in delight and rewards your clear sight before vanishing. (+Soul)"; } A.heal(-10); A.happy(-4); return "The glamour holds. You wake in a graveyard at dawn, drained and dizzy, a day of your life simply gone."; } },
      { label: "Refuse the temptation", result: (c, rng, A) => { cap(c, "soul", 1); return "You avert your eyes and recite a calming mantra. The amber-eyed stranger pouts, and is gone. (+Soul)"; } },
    ],
  },
  {
    id: "alchemy_windfall", weight: 4, minAge: 14, maxAge: 9000,
    cond: c => c.herbs >= 4,
    text: () => "You stumble on the abandoned cauldron of a fled alchemist, its furnace still warm, rare reagents scattered about.",
    choices: [
      { label: "Attempt to finish the brew", result: (c, rng, A) => { if (rng.random() < 0.45 + c.comprehension / 300) { c.pills += rng.randint(1, 3); A.herbs(rng.randint(2, 5)); return "You read the half-finished formula and bring it home — a flurry of fragrant pills tumble from the cauldron!"; } A.heal(-10); A.happy(-3); return "The unstable mixture detonates in your face. Singed eyebrows and a hard lesson in alchemy."; } },
      { label: "Salvage the materials", result: (c, rng, A) => { A.herbs(rng.randint(3, 7)); A.stones(rng.randint(3, 10)); return "You pack up the precious reagents and rare tools to sell or use later. A tidy haul."; } },
    ],
  },
  {
    id: "wandering_swordsman", weight: 4, minAge: 14, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    text: () => "A silent wandering swordsman crosses your path, bows, and wordlessly draws a line in the dust between you — a challenge, friendly but earnest.",
    choices: [
      { label: "Accept the bout", result: (c, rng, A) => ["You set your stance and answer steel with steel."].concat(A.fight(["a Wandering Swordsman", A.power() * rng.uniform(0.85, 1.15), (c.realm + 1) * 6, "rogue"])) },
      { label: "Bow and decline", result: (c, rng, A) => { cap(c, "soul", 1); return "You bow back and step around the line. The swordsman nods, neither pleased nor displeased, and walks on into the mist."; } },
    ],
  },

  /* ===================== more fortunes, perils & choices ============== */
  {
    id: "treasure_map", weight: 4, minAge: 12, maxAge: 9000,
    cond: c => c.spiritStones >= 10,
    text: () => "A nervous one-eyed scavenger offers to sell you a blood-stained treasure map for a handful of stones. 'Real, I swear it!'",
    choices: [
      { label: "Buy it and follow the map (10 stones)", result: (c, rng, A) => { A.stones(-10); const r = rng.random(); if (r < 0.45) return ["The map leads true — past traps and bones, to a sealed cache..."].concat(A.giveArtifact()); if (r < 0.7) { A.stones(rng.randint(15, 45)); A.herbs(rng.randint(3, 8)); return "The X marks a smuggler's buried stash of stones and herbs. A fine return."; } A.heal(-8); return "The map leads only to a cliff edge and a rude carving. Cheated — and you twisted an ankle climbing down."; } },
      { label: "Wave the swindler off", result: () => "You've heard that pitch a hundred times. The scavenger slinks away to find a greedier mark." },
    ],
  },
  {
    id: "spirit_vein", weight: 4, minAge: 8, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none",
    auto: (c, rng, A) => { A.qi(rng.uniform(0.3, 0.7)); A.stones(rng.randint(3, 12)); return "Your spirit sense snags on a thread of unusually dense qi underfoot — a minor spirit vein. You cultivate atop it for a season before it thins."; },
  },
  {
    id: "qi_deviation", weight: 4, minAge: 10, maxAge: 9000, awakened: true,
    cond: c => c.root.key !== "none" && c.happiness < 45,
    text: () => "Mid-cultivation, your qi suddenly churns and rebels — the early signs of a dangerous qi deviation (走火入魔).",
    choices: [
      { label: "Force your qi back into order", result: (c, rng, A) => { if (rng.random() < 0.45 + c.soul / 250) { cap(c, "soul", 2); A.happy(4); return "With iron will you wrestle the wild qi back onto its proper path. The crisis passes; your control deepens. (+Soul)"; } A.heal(-18); A.happy(-8); A.qi(-0.2); return "The qi runs riot through your meridians. You collapse, coughing blood, your cultivation set back."; } },
      { label: "Stop and meditate calmly", result: (c, rng, A) => { A.happy(6); cap(c, "comprehension", 1); return "You cease at once, breathe, and let the storm settle on its own. Slower, but safe. (+Happiness)"; } },
    ],
  },
  {
    id: "kindly_elder", weight: 4, minAge: 6, maxAge: 9000,
    auto: (c, rng, A) => { const g = rng.randint(2, 8); A.herbs(g); A.happy(3); A.karma(1); return `A kindly old herbalist, charmed by your manners, presses a bundle of ${g} spirit herbs into your hands and waves off any payment.`; },
  },
  {
    id: "stone_giant_toll", weight: 4, minAge: 12, maxAge: 9000, awakened: true,
    text: () => "A moss-covered stone giant blocks a mountain pass, one craggy hand outstretched. 'Toll,' it rumbles, 'or trial.'",
    choices: [
      { label: "Pay the toll", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, 8 + c.realm * 3); A.stones(-cost); return `You drop ${cost} stones into its palm. The giant grunts and steps aside like a slow landslide.`; } },
      { label: "Accept the trial of strength", result: (c, rng, A) => ["You roll your shoulders and step up to wrestle the mountain itself."].concat(A.fight(["a Stone Pass-Guardian", A.power() * rng.uniform(0.9, 1.2), (c.realm + 1) * 7, "beast"])) },
    ],
  },
  {
    id: "cursed_relic", weight: 3, minAge: 14, maxAge: 9000, awakened: true,
    text: () => "In a barrow you find a treasure radiating power — and a cold, watchful malice. A curse clings to it like grave-frost.",
    choices: [
      { label: "Claim it anyway", result: (c, rng, A) => { A.karma(-6); const a = A.giveArtifact(); if (rng.random() < 0.5) { A.heal(-12); return [...a, "But the curse bites: a chill sinks into your marrow and will not leave for years."]; } return [...a, "You suppress the curse with raw will. The power is yours — for now."]; } },
      { label: "Purify it first, then take it", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 250) { A.karma(4); cap(c, "soul", 1); return [...A.giveArtifact(), "Days of cleansing rites burn the malice away. The treasure is clean, and yours. (+Karma)"]; } A.happy(-4); return "The purification fails; the relic shatters into worthless grey dust rather than yield. A pity."; } },
      { label: "Leave it buried", result: (c, rng, A) => { A.karma(2); cap(c, "soul", 1); return "Some power is not worth its price. You re-seal the barrow and walk away clean."; } },
    ],
  },
  {
    id: "old_battlefield", weight: 4, minAge: 12, maxAge: 9000, awakened: true,
    text: () => "You cross a desolate plain littered with the rusted blades and bleached bones of some ancient war between cultivators.",
    choices: [
      { label: "Scavenge among the dead", result: (c, rng, A) => { const r = rng.random(); if (r < 0.3) return ["Beneath a fallen banner you unearth..."].concat(A.giveArtifact()); if (r < 0.55) { A.stones(rng.randint(10, 30)); return "You pry loose storage-pouches still half-full of spirit stones."; } if (r < 0.8) { return ["A war-revenant, still bound to its grudge, rises to defend the field!"].concat(A.fight(["a Battlefield Revenant", A.power() * rng.uniform(0.85, 1.15), (c.realm + 1) * 6, "rogue"])); } A.happy(-2); return "Picked clean long ago. Only dust and old sorrow remain."; } },
      { label: "Burn incense for the fallen", result: (c, rng, A) => { A.karma(5); cap(c, "soul", 1); A.happy(3); return "You give the unknown dead a moment of respect and a stick of incense. The wind seems to sigh in thanks. (+Karma, +Soul)"; } },
    ],
  },
  {
    id: "wandering_healer", weight: 4, minAge: 6, maxAge: 9000,
    cond: c => c.health < 70,
    text: () => "A travelling spirit-doctor sets up her needles and herbs in the village square, calling for any who ail.",
    choices: [
      { label: "Let her treat you", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, 5); A.stones(-cost); A.heal(25); A.happy(4); return `Her needles find the knots of stagnant qi in your body and loosen them. You leave lighter and stronger.`; } },
      { label: "Trade herbs for her craft", result: (c, rng, A) => { if (c.herbs >= 2) { A.herbs(-2); A.heal(18); cap(c, "comprehension", 1); return "You pay in spirit herbs and watch her work closely, picking up a trick or two of the healing art. (+Comprehension)"; } A.heal(8); return "With nothing to trade, you accept only a basic tonic. Better than nothing."; } },
    ],
  },
  {
    id: "sect_promotion", weight: 5, awakened: true,
    cond: c => c.sectKey && c.sectRank < 5,
    text: () => "An elder summons you: your contributions have been noticed, and a trial for promotion to the next rank awaits.",
    choices: [
      { label: "Take the promotion trial", result: (c, rng, A) => { if (rng.random() < 0.4 + c.comprehension / 250 + c.realm * 0.04) { c.contribution += 30; c.reputation += 3; A.happy(8); return "You pass the elders' trial with distinction. Your standing in the sect rises. (+Contribution, +Reputation)"; } A.happy(-4); return "You fall just short of the mark. The elders bid you train harder and return."; } },
      { label: "Decline — you are content", result: (c, rng, A) => { cap(c, "soul", 1); return "You bow out gracefully. Rank is a cage as much as a ladder, you reflect."; } },
    ],
  },
  {
    id: "star_pavilion", weight: 3, minRealm: 5, awakened: true, once: true,
    text: () => "Atop a cloud-wreathed peak you find the ruined Star-Picking Pavilion, where ancient sages once read the dao in the constellations.",
    choices: [
      { label: "Read the stars through the night", result: (c, rng, A) => { cap(c, "comprehension", 4); A.qi(rng.uniform(0.6, 1.2)); if (c.realm >= 5 && rng.random() < 0.3 && c.daos && c.daos.length < D.DAOS.length) { c.daoInsight = (c.daoInsight || 0) + 50; return "The turning heavens pour their secrets into you. You feel a great Law trembling on the edge of comprehension. (+Comprehension, +Dao insight)"; } return "The slow wheel of the stars teaches you patience and vastness. Your dao-heart expands. (+Comprehension)"; } },
      { label: "Rest, and simply watch", result: (c, rng, A) => { A.happy(8); cap(c, "soul", 1); return "For once you cultivate nothing at all, and only watch the stars wheel. Your weary spirit eases."; } },
    ],
  },
  {
    id: "mortal_war", weight: 4, minAge: 14, maxAge: 9000, awakened: true,
    cond: c => c.realm >= 2,
    text: () => "Two mortal kingdoms grind toward war beneath your notice — until refugees beg a passing immortal like you to intervene.",
    choices: [
      { label: "End the war with a show of power", result: (c, rng, A) => { A.karma(10); c.reputation += 5; A.happy(5); return "You split a mountain before both armies' eyes. Kings kneel; the war ends before it begins. Mortals will tell the tale for generations. (+Karma, +Reputation)"; } },
      { label: "It is not your concern", result: (c, rng, A) => { A.karma(-3); cap(c, "soul", 1); return "Mortal squabbles are dust beneath your feet. You walk on, and try not to hear the distant screams."; } },
    ],
  },
  {
    id: "fated_meeting", weight: 4, minAge: 16, maxAge: 9000,
    cond: c => !c.relationships.some(n => n.role === "companion" && n.alive) && c.charm > 25,
    text: () => "Sheltering from a sudden downpour beneath the same plum tree, you and a stranger share a long, easy silence — and then a longer conversation.",
    choices: [
      { label: "Let fate take its course", result: (c, rng, A) => { if (rng.random() < 0.45 + c.charm / 200) { const n = A.meet("companion", { affinity: 28 }); A.happy(10); return `By the time the rain clears, you have learned ${n.name}'s name, their dao, and the shape of their laugh. Something has begun.`; } const f = A.meet("friend", { affinity: 18 }); return `The rain ends too soon. You part as friends — ${f.name} — with a small, unspoken regret.`; } },
      { label: "Bid them farewell when the rain stops", result: (c, rng, A) => { cap(c, "soul", 1); A.happy(2); return "You nod your goodbyes and go your separate ways. Some meetings are meant only to be remembered."; } },
    ],
  },
  {
    id: "karmic_reckoning", weight: 3, awakened: true, cond: c => c.karma <= -50,
    text: () => "The lives you have ended gather like a shadow at your back. One night, a vengeful spirit you wronged claws its way out of the dark for revenge.",
    choices: [
      { label: "Cut it down without mercy", result: (c, rng, A) => { A.karma(-4); return ["You meet the howling specter with cold steel."].concat(A.fight(["a Vengeful Wraith", A.power() * rng.uniform(0.9, 1.3), (c.realm + 1) * 7, "rogue"])); } },
      { label: "Kneel and seek to atone", result: (c, rng, A) => { if (rng.random() < 0.4 + c.soul / 250) { A.karma(12); cap(c, "soul", 2); A.happy(4); return "You bow your head and accept your guilt. The spirit's rage cools to sorrow, and it fades, releasing you both. (+Karma, +Soul)"; } A.heal(-15); A.happy(-6); return "The spirit spits on your hollow words and savages you before dissipating. Atonement, it seems, cannot be bought so cheaply."; } },
    ],
  },
  {
    id: "child_runaway_genius", weight: 4, minAge: 5, maxAge: 11, awakened: false,
    text: () => "A ragged runaway your own age, sharp-eyed and clever, asks to share your fire for the night.",
    choices: [
      { label: "Share food and shelter", result: (c, rng, A) => { const f = A.meet("friend", { affinity: 24 }); A.karma(2); A.happy(4); return `You split your supper with ${f.name}. They never forget a kindness — and something tells you they'll be someone, one day.`; } },
      { label: "Send them on their way", result: (c, rng, A) => { A.happy(-1); return "You can barely feed yourself. The runaway shrugs, unsurprised, and vanishes into the dark."; } },
    ],
  },
  /* ----------------------- the turning world (eras) ------------------- */
  {
    id: "era_abundance_tide", weight: 6, awakened: true, cond: c => c.era === "abundance" && c.root.key !== "none",
    auto: (c, rng, A) => { A.qi(rng.uniform(0.3, 0.7)); A.happy(4); return "In this Age of Abundance the very air is sweet with spirit qi; you breathe deep and your cultivation surges with the prosperous tide."; },
  },
  {
    id: "era_warring_band", weight: 6, minAge: 12, maxAge: 9000, awakened: true, cond: c => c.era === "warring" && c.root.key !== "none",
    text: () => "These are warring years — a roving war-band of sect deserters falls upon the road you travel, blades already wet.",
    choices: [
      { label: "Cut your way through", result: (c, rng, A) => { const res = A.fight(["War-Band Marauders", A.power() * rng.uniform(0.95, 1.3), (c.realm + 1) * 7, "rogue"]); if (c.alive) { A.stones(rng.randint(8, 24)); c.reputation += 2; res.push("You leave the road littered and ride on the richer for it."); } return ["Steel rings on steel."].concat(res); } },
      { label: "Pay them off and pass", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, 10 + c.realm * 4); A.stones(-cost); A.happy(-2); return `You buy passage with ${cost} stones. In a warring era, coin spent is blood saved.`; } },
    ],
  },
  {
    id: "era_demontide_surge", weight: 7, minAge: 12, maxAge: 9000, awakened: true, cond: c => c.era === "demontide" && c.root.key !== "none",
    text: () => "The Demon Tide runs high: a corpse-fiend war-party boils out of a blood-fog, hungering for the living.",
    choices: [
      { label: "Purge them with righteous force", result: (c, rng, A) => { const res = A.fight(["Corpse-Fiend Horde", A.power() * rng.uniform(1.0, 1.35), (c.realm + 1) * 8, "rogue"]); if (c.alive) { A.karma(8); c.reputation += 4; res.push("You burn the fiends to ash. In these dark years, such deeds are not forgotten. (+Karma, +Reputation)"); } return ["You stand against the tide of the dead."].concat(res); } },
      { label: "Embrace the tide — take a blood-art", result: (c, rng, A) => { A.karma(-18); A.qi(0.9); if (!c.techniques.includes("blood_refine")) c.techniques.push("blood_refine"); return "You drink deep of the era's red power, carving a forbidden blood-art into your soul. Fast strength, and a long reckoning."; } },
    ],
  },
  {
    id: "era_drought_spring", weight: 6, awakened: true, cond: c => c.era === "drought" && c.root.key !== "none",
    text: () => "In this Spiritual Drought, qi is precious as water in a desert. You catch the faint trace of a hidden, half-dry spirit spring.",
    choices: [
      { label: "Seek it out and guard it", result: (c, rng, A) => { if (rng.random() < 0.5 + c.comprehension / 300) { A.qi(rng.uniform(0.4, 0.9)); A.herbs(rng.randint(2, 6)); return "You find the spring and drink its thinning qi in secret for a season — a rare gift in a starving age."; } A.happy(-3); return "The trail goes cold; the spring has already run dry. Such is the drought."; } },
      { label: "Hoard your reserves instead", result: (c, rng, A) => { cap(c, "soul", 1); return "You conserve what qi you have and wait the lean years out. Patience is its own cultivation."; } },
    ],
  },
  {
    id: "era_dawn_sign", weight: 6, minRealm: 3, awakened: true, cond: c => c.era === "dawn",
    auto: (c, rng, A) => { A.qi(rng.uniform(0.4, 1.0)); cap(c, "comprehension", 2); A.happy(5); return "Auspicious light wreathes the heavens in this Dawn of Ascension. The dao feels close enough to touch; your understanding deepens and a breakthrough seems near. (+Comprehension)"; },
  },
  {
    id: "drought_blessing", weight: 4, minAge: 10, maxAge: 9000, awakened: true,
    cond: c => c.realm >= 1,
    auto: (c, rng, A) => { A.karma(4); c.reputation += 2; A.happy(4); return "A drought withers a region of mortal farms. With a flick of qi you call down a gentle rain over the cracked fields. The peasants build you a little shrine. (+Karma, +Reputation)"; },
  },

  /* ===================== your cave abode, in the world =============== */
  {
    id: "abode_raid", weight: 5, awakened: true, cond: c => (c.abode || 0) >= 2,
    text: c => { const a = D.abodeAt(c.abode); return `Raiders covet the spirit vein beneath your ${a ? a[1] : "abode"} and descend in force to plunder it!`; },
    choices: [
      { label: "Rally your home and fight them off", result: (c, rng, A) => {
        const reg = D.REGION_BY_KEY[c.abodeRegion || c.region || "azuredomain"];
        const danger = reg ? reg[3] : 1;
        const disciples = c.relationships.filter(n => n.alive && n.resides && n.role === "disciple").length;
        const sectDef = c.ownSect ? Math.min(0.22, c.ownSect.members / 1500) : 0;
        // Guardian array (abode grade), a war-beast, resident disciples and — if you
        // lead one — your whole sect rush to defend their mountain.
        const defense = Math.min(0.62, (c.abode || 0) * 0.05 + (c.beast && c.beast.alive ? 0.12 : 0) + disciples * 0.08 + sectDef);
        const pre = [];
        if ((c.abode || 0) >= 3) pre.push("Your guardian array roars to life, walls of light snapping up around the abode.");
        if (c.ownSect) pre.push(`The disciples of the ${c.ownSect.name} pour from the halls to defend their seat!`);
        if (disciples) pre.push(`Your ${disciples} resident disciple${disciples > 1 ? "s" : ""} take up arms at your side.`);
        if (c.beast && c.beast.alive) pre.push(`${c.beast.name} bares its fangs beside you.`);
        const ePower = A.power() * rng.uniform(1.0, 1.4) * danger * (1 - defense);
        const res = A.fight(["Abode Raiders", ePower, (c.realm + 1) * 8, "rogue"]);
        if (c.alive) { c.reputation += 4; A.karma(2); res.push("The raiders break and flee; your home stands unbroken. Word spreads that your abode is not to be trifled with. (+Reputation)"); }
        return pre.concat(res);
      } },
      { label: "Loose the array and slip away", result: (c, rng, A) => {
        const hasArray = (c.abode || 0) >= 3;
        const lostH = Math.min(c.herbs, Math.floor(c.herbs * (hasArray ? 0.2 : 0.4)));
        const lostS = Math.min(c.spiritStones, Math.floor(c.spiritStones * (hasArray ? 0.15 : 0.3)));
        A.herbs(-lostH); A.stones(-lostS); A.happy(-4);
        return hasArray
          ? `You loose the guardian array to cover your retreat. The raiders strip ${lostH} herbs and ${lostS} stones from the outer fields, but you and your people slip away unharmed.`
          : `With no proper array to hold them, you grab your people and flee. The raiders plunder ${lostH} herbs and ${lostS} stones before melting back into the wilds.`;
      } },
    ],
  },
  {
    id: "abode_bloom", weight: 4, awakened: true, cond: c => (c.abode || 0) >= 3,
    auto: (c, rng, A) => { const h = rng.randint(3, 8) + (c.abode || 0); A.herbs(h); if (rng.random() < 0.3) { c.pills += 1; return `A rare spirit herb blooms in your abode's fields, potent enough to refine on the spot. (+${h} herbs, +1 pill)`; } return `The spirit vein beneath your abode surges; your herb fields run riot with growth. (+${h} herbs)`; },
  },
  /* ----------------------- spirit beast companion --------------------- */
  {
    id: "beast_forage_find", weight: 4, awakened: true, cond: c => c.beast && c.beast.alive,
    auto: (c, rng, A) => { const b = c.beast; const r = b.rank || 1; if (rng.random() < 0.3) { A.herbs(rng.randint(2, 6) * r); return `${b.name} returns from the wilds dragging a mouthful of rare spirit herbs, tail wagging.`; } if (rng.random() < 0.4 && b.exp != null) { b.exp += 4; b.bond = Math.min(100, (b.bond || 50) + 2); return `${b.name} hunts a fierce wild beast all on its own and returns bloodied but proud. (bond & exp grow)`; } A.stones(rng.randint(2, 8) * r); return `${b.name} unearths a glittering cache of spirit stones buried near your path.`; },
  },
  {
    id: "beast_peril", weight: 3, awakened: true, cond: c => c.beast && c.beast.alive,
    text: c => `A larger, savage beast corners your ${c.beast.name} in the wild, fangs bared to kill.`,
    choices: [
      { label: "Rush to your beast's defense", result: (c, rng, A) => { const res = A.fight(["a Savage Alpha-Beast", A.power() * rng.uniform(0.9, 1.25), (c.realm + 1) * 6, "beast"]); if (c.alive && c.beast) { c.beast.bond = Math.min(100, (c.beast.bond || 50) + 12); if (c.beast.exp != null) c.beast.exp += 8; res.push(`${c.beast.name} presses to your side, fierce gratitude in its eyes. Your bond deepens.`); } return [`You will not lose ${c.beast.name}. You charge in.`].concat(res); } },
      { label: "Let it prove itself alone", result: (c, rng, A) => { const b = c.beast; const win = rng.random() < 0.4 + (b.bond || 50) / 250 + (b.rank || 1) * 0.08; if (win) { b.bond = Math.min(100, (b.bond || 50) + 4); if (b.exp != null) b.exp += 10; return `${b.name} fights with savage cunning and tears its way free. It returns stronger for the trial.`; } b.power *= 0.85; b.bond = Math.max(0, (b.bond || 50) - 8); A.happy(-5); return `${b.name} barely survives, limping home wounded. It will need time — and feeding — to recover.`; } },
    ],
  },
  {
    id: "wild_beast_call", weight: 4, awakened: true, cond: c => !c.beast && c.root.key !== "none" && c.realm >= 1,
    text: () => "A wounded spirit-beast cub, abandoned by its pack, creeps to the edge of your camp and watches you with wary, hungry eyes.",
    choices: [
      { label: "Earn its trust with food and patience", result: (c, rng, A) => { if (rng.random() < 0.45 + c.charm / 250 + c.soul / 400) { const sp = rng.choice(D.SPIRIT_BEASTS); c.beast = E.normalizeBeast({ name: sp.split(" ").slice(-1)[0], species: sp, baseSpecies: sp, element: D.beastElement(sp), power: E.power(c) * rng.uniform(0.25, 0.4), bond: 60, rank: 1, exp: 0, fedThisYear: 0, trait: E.rollBeastTrait(rng), alive: true }); A.happy(8); A.note(`Befriended a wild ${sp} cub.`); return `Day by day it draws closer, until one dawn it simply will not leave your side. You have a new companion: a ${sp}! (See Treasures & Beast.)`; } A.happy(-2); return "The cub is too skittish; one wrong move and it bolts into the trees, gone for good."; } },
      { label: "Leave it to the wild", result: () => "You let nature take its course. The cub watches you go, then turns back to the forest." },
    ],
  },
  {
    id: "sect_glory", weight: 4, awakened: true, cond: c => !!c.ownSect,
    auto: (c, rng, A) => { const g = rng.randint(10, 30); c.ownSect.prestige += g; c.reputation += 2; A.happy(3); return `A disciple of the ${c.ownSect.name} wins honour in a distant contest, and your sect's name spreads. (+${g} prestige, +Reputation)`; },
  },
  {
    id: "rival_sect_challenge", weight: 4, awakened: true, cond: c => c.ownSect && c.ownSect.prestige >= 80,
    text: c => `The master of a jealous rival sect, galled by the rise of the ${c.ownSect.name}, challenges you to a duel of honour for prestige and territory.`,
    choices: [
      { label: "Answer the challenge yourself", result: (c, rng, A) => { const res = A.fight(["a Rival Sect Master", A.power() * rng.uniform(1.0, 1.35), (c.realm + 1) * 8, "rogue"]); if (c.alive) { c.ownSect.prestige += 60; c.reputation += 6; res.push(`You humble the rival master before both sects. The ${c.ownSect.name}'s prestige soars. (+Prestige, +Reputation)`); } return ["You take the duelling platform, your disciples watching tense from the walls."].concat(res); } },
      { label: "Send your strongest disciple", result: (c, rng, A) => { const d = c.relationships.filter(n => n.alive && n.role === "disciple").sort((a, b) => (b.power || 0) - (a.power || 0))[0]; if (!d) return "You have no disciple ready to stand for the sect — you must answer this another day."; const win = (d.power || 1) * rng.uniform(0.85, 1.35) >= A.power() * 0.5 * rng.uniform(0.85, 1.2); if (win) { c.ownSect.prestige += 35; d.affinity = Math.min(100, d.affinity + 12); A.happy(5); return `${d.name} fights for the sect's honour — and wins! Their name rises with the sect's. (+Prestige)`; } c.ownSect.prestige = Math.max(0, c.ownSect.prestige - 20); d.affinity = Math.max(-100, d.affinity - 4); A.happy(-4); return `${d.name} is beaten before the watching crowds. The ${c.ownSect.name} loses face, and prestige with it.`; } },
    ],
  },
  {
    id: "abode_guest", weight: 4, awakened: true, cond: c => (c.abode || 0) >= 3 && c.reputation >= 30,
    text: c => { const a = D.abodeAt(c.abode); return `A travelling cultivator, having heard of your ${a ? a[1] : "abode"}, asks leave to rest a night beneath your roof.`; },
    choices: [
      { label: "Welcome them as a guest", result: (c, rng, A) => { A.karma(2); if (rng.random() < 0.4) { const f = A.meet("friend", { affinity: 22 }); return `You share wine and dao-talk late into the night. ${f.name} leaves a firm friend, and your hospitality's renown grows.`; } A.happy(4); cap(c, "comprehension", 1); return "Your guest repays the kindness with a rare insight gleaned in distant lands before departing at dawn. (+Comprehension)"; } },
      { label: "Turn them away", result: (c, rng, A) => { A.karma(-1); return "You value your seclusion over a stranger's comfort. They bow stiffly and walk on into the night."; } },
    ],
  },

  /* ============ more fortunes & misfortunes, cradle to dotage ============ */

  /* -- early childhood, before the Awakening -- */
  {
    id: "child_grandmother", weight: 6, minAge: 2, maxAge: 6, awakened: false,
    auto: (c, rng, A) => { cap(c, "comprehension", rng.randint(1, 2)); A.happy(6); return "A white-haired granny of the village takes a shine to you, filling your evenings with riddles and tales of the immortals. (+Comprehension, +Happiness)"; },
  },
  {
    id: "child_lost_woods", weight: 5, minAge: 3, maxAge: 7, awakened: false,
    text: () => "Chasing a glittering moth, you wander deep into the whispering woods — and the path home melts away behind you.",
    choices: [
      { label: "Keep your head and find a way out", result: (c, rng, A) => { if (rng.random() < 0.5 + c.comprehension / 200) { cap(c, "comprehension", 1); A.happy(3); return "You follow a stream downhill the way an elder once taught you, and stumble home by dusk, filthy and proud. (+Comprehension)"; } A.heal(-8); A.happy(-6); return "You spend a freezing night under a root before a woodcutter finds you, half-starved and shaking. (-Health)"; } },
      { label: "Cry out and wait to be found", result: (c, rng, A) => { A.heal(-4); A.kinAdjust("mother", 3); return "Your wailing carries far; by nightfall your frantic mother finds you and crushes you to her chest, scolding and weeping at once."; } },
    ],
  },
  {
    id: "child_jade_trinket", weight: 5, minAge: 2, maxAge: 7, awakened: false,
    auto: (c, rng, A) => { const g = rng.randint(2, 6); A.stones(g); return `Digging in the riverbank, your small fingers close on an old jade trinket. A passing peddler trades you ${g} spirit stones for it — a fortune, to a child.`; },
  },
  {
    id: "child_lean_winter", weight: 5, minAge: 1, maxAge: 7, awakened: false,
    text: () => "A failed harvest brings a long, lean winter. The rice runs thin and the nights run cold.",
    choices: [
      { label: "Bear the hunger without complaint", result: (c, rng, A) => { A.heal(-6); if (rng.random() < 0.6) { cap(c, "constitution", 2); return "You tighten your belt and endure. Hardship hammers your young body into something tougher. (+Constitution)"; } A.happy(-5); return "The winter leaves you gaunt and listless, but spring comes at last."; } },
      { label: "Forage the frozen hills", result: (c, rng, A) => { if (rng.random() < 0.5 + c.luck / 250) { A.herbs(rng.randint(1, 4)); A.happy(2); return "You return with roots, eggs, and a few wild spirit herbs — your family eats, and eyes you with new respect."; } A.heal(-9); A.happy(-4); return "You find little but a deeper chill in the snow. (-Health)"; } },
    ],
  },

  /* -- youth & coming of age -- */
  {
    id: "youth_first_love", weight: 5, minAge: 12, maxAge: 18,
    text: () => "A neighbour's child meets your eyes across the well-yard, and for a whole season your heart will not sit still.",
    choices: [
      { label: "Confess your feelings", result: (c, rng, A) => { if (rng.random() < 0.45 + c.charm / 200) { cap(c, "charm", 1); A.happy(10); return "Shy smiles become shared secrets. Nothing lasting comes of it — but you learn you are worth liking. (+Charm, +Happiness)"; } A.happy(-6); return "You stammer it out and are gently, kindly refused. The ache is real, and oddly precious."; } },
      { label: "Bury it in your studies", result: (c, rng, A) => { cap(c, "comprehension", 1); A.happy(-2); return "You pour the restlessness into your books instead. (+Comprehension)"; } },
    ],
  },
  {
    id: "youth_cliff_fall", weight: 5, minAge: 8, maxAge: 16,
    text: () => "Daring a friend's challenge, you climb the cliff above the gorge — and a handhold crumbles to dust.",
    choices: [
      { label: "Twist and grab for a ledge", result: (c, rng, A) => { if (rng.random() < 0.4 + c.luck / 200) { A.happy(6); cap(c, "constitution", 1); return "You catch a root, heart hammering, and haul yourself up grinning. Your friends are awestruck. (+Constitution)"; } A.heal(-16); A.happy(-5); return "You fall; a snapped branch is all that saves your skull. You limp home with a broken arm. (-Health)"; } },
      { label: "Cling and call for help", result: (c, rng, A) => { A.heal(-5); cap(c, "comprehension", 1); return "You wait, white-knuckled, until older children haul you up by a rope. Shaken, but wiser about bravado. (+Comprehension)"; } },
    ],
  },
  {
    id: "youth_festival_brawl", weight: 4, minAge: 12, maxAge: 22,
    text: () => "At the harvest festival, a drunken lout shoves your friend into the mud and spits an insult.",
    choices: [
      { label: "Step in with your fists", result: (c, rng, A) => { if (rng.random() < 0.45 + c.constitution / 250) { cap(c, "constitution", 1); A.happy(5); c.reputation += 1; return "You lay him flat to cheers from the crowd. Your friend buys the wine. (+Constitution)"; } A.heal(-10); A.happy(-3); return "He is bigger and meaner than he looked; you take a beating, but never a backward step. (-Health)"; } },
      { label: "Defuse it with words", result: (c, rng, A) => { if (rng.random() < 0.4 + c.charm / 200) { cap(c, "charm", 1); A.happy(3); return "A joke, a bow, a shared cup — and the whole thing dissolves into laughter. (+Charm)"; } A.happy(-2); return "Your words fall flat, but the lout loses interest and staggers off."; } },
    ],
  },
  {
    id: "talisman_knack", weight: 4, minAge: 8, maxAge: 22, awakened: true, cond: c => c.root.key !== "none",
    auto: (c, rng, A) => { c.alchemySkill = (c.alchemySkill || 0) + rng.randint(2, 5); cap(c, "comprehension", 1); return "Idly copying a ward-talisman from a borrowed manual, you find the spirit-script comes startlingly easy to your hand. (+Alchemy, +Comprehension)"; },
  },

  /* -- young adult cultivator -- */
  {
    id: "caravan_guard", weight: 5, minAge: 16, maxAge: 9000, awakened: true, cond: c => c.root.key !== "none" && c.realm >= 1,
    text: () => "A spice-and-silk caravan bound across the wastes needs sword-arms, and the pay is generous for a season's work.",
    choices: [
      { label: "Take the contract", result: (c, rng, A) => { const g = rng.randint(15, 40) * (c.realm + 1); A.stones(g); c.reputation += 2; if (rng.random() < 0.4) return [`The road promises ${g} stones — but bandits test your blade along the way.`].concat(A.fight(["Wasteland Bandits", A.power() * rng.uniform(0.8, 1.1), (c.realm + 1) * 5, "rogue"])); A.happy(3); return `An uneventful, well-paid escort. You pocket ${g} spirit stones and a satchel of road-tales.`; } },
      { label: "Stay and cultivate", result: (c, rng, A) => { A.qi(0.2); return "You let the caravan roll on without you and spend the season in quiet practice."; } },
    ],
  },
  {
    id: "qi_deviation", weight: 5, minAge: 14, maxAge: 9000, awakened: true, minRealm: 1, cond: c => c.root.key !== "none",
    text: () => "Greedy for faster progress, you drive a dangerous high-speed cultivation method through the night.",
    choices: [
      { label: "Force on through the danger", result: (c, rng, A) => { if (rng.random() < 0.45 + c.soul / 250) { A.qi(0.7); A.happy(4); return "You ride the surging qi to the very edge and back. A reckless gamble — and this time it pays. (qi surges)"; } A.heal(-18); A.qi(-0.3); A.happy(-6); return "Your meridians rebel; qi tears loose and you cough blood for a week. The dao is no place for greed. (-Health, qi lost)"; } },
      { label: "Withdraw to safety", result: (c, rng, A) => { cap(c, "comprehension", 1); A.qi(0.1); return "You sense the danger and pull back in time, the lesson worth more than the lost speed. (+Comprehension)"; } },
    ],
  },
  {
    id: "gambling_hall", weight: 4, minAge: 16, maxAge: 9000, cond: c => c.spiritStones >= 10,
    text: () => "In a smoky spirit-stone gambling den, the dice are hot and the crowd is roaring.",
    choices: [
      { label: "Wager a handful of stones", result: (c, rng, A) => { const stake = Math.min(c.spiritStones, rng.randint(10, 30)); if (rng.random() < 0.42 + c.luck / 300) { const win = stake * rng.randint(2, 4); A.stones(win); A.happy(6); return `Fortune rides with you tonight — you walk out ${win} spirit stones richer to envious stares. (+${win} stones)`; } A.stones(-stake); A.happy(-5); return `The dice turn cold and your ${stake} stones vanish into the house's coffers. (-${stake} stones)`; } },
      { label: "Keep your purse shut", result: (c, rng, A) => { cap(c, "soul", 1); return "You watch fortunes won and lost, and feel only the steadiness of a quiet heart. (+Soul Sense)"; } },
    ],
  },
  {
    id: "fake_manual", weight: 4, minAge: 14, maxAge: 9000, awakened: true, cond: c => c.spiritStones >= 20 && c.root.key !== "none",
    text: () => "A slick peddler offers a 'lost heaven-tier manual' at a suspiciously steep price, swearing it will change your fate.",
    choices: [
      { label: "Buy the manual", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, rng.randint(20, 50)); A.stones(-cost); if (rng.random() < 0.15 + c.luck / 400) { const t = A.learnTech(); return t ? `Against all odds it is genuine — you learn ${t}! (-${cost} stones)` : `The manual is real, but its art is beyond you for now. (-${cost} stones)`; } cap(c, "comprehension", 1); return `Past the first page the jade slip is blank gibberish. Robbed of ${cost} stones, you learn to trust your own eyes. (+Comprehension)`; } },
      { label: "Laugh in his face", result: (c, rng, A) => { cap(c, "comprehension", 1); return "You have read enough real manuals to smell a fake. The peddler slinks away. (+Comprehension)"; } },
    ],
  },
  {
    id: "auction_windfall", weight: 4, minAge: 16, maxAge: 9000, awakened: true, cond: c => c.spiritStones >= 30,
    text: () => "At a spirit-market auction, a battered crate of 'assorted relics' goes for a song — no one else sees any worth in it.",
    choices: [
      { label: "Bid on the mystery crate", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, rng.randint(15, 35)); A.stones(-cost); const r = rng.random(); if (r < 0.4) return [`You haul the crate home and pry it open...`].concat(A.giveArtifact()); if (r < 0.7) { A.herbs(rng.randint(6, 14)); A.stones(rng.randint(10, 30)); return `Beneath the junk: a stash of spirit herbs and old stones, worth far more than you paid. (-${cost} up front)`; } A.happy(-3); return `Mostly worthless rubble. You paid ${cost} stones for a lesson in greed.`; } },
      { label: "Pass it by", result: () => "You keep your stones and your dignity. Let another gamble on rubbish." },
    ],
  },

  /* -- established cultivator -- */
  {
    id: "mentor_junior", weight: 4, minAge: 18, maxAge: 9000, awakened: true, minRealm: 2,
    text: () => "A struggling young cultivator, meridians knotted from a botched breakthrough, begs you for guidance.",
    choices: [
      { label: "Guide them through it", result: (c, rng, A) => { if (rng.random() < 0.5 + c.comprehension / 250) { A.karma(6); c.reputation += 3; cap(c, "comprehension", 1); A.happy(5); return "You steady their qi with a master's patience; they pull through and kowtow in tears. Teaching deepens your own understanding. (+Karma, +Comprehension)"; } A.karma(2); A.happy(-2); return "You do your best, but their foundation is too far gone. Still, they thank you for trying. (+Karma)"; } },
      { label: "It is not your concern", result: (c, rng, A) => { A.karma(-2); return "You walk on. The dao is a lonely road, and not yours to share with every stray."; } },
    ],
  },
  {
    id: "seclusion_whisper", weight: 4, awakened: true, minRealm: 2, cond: c => c.root.key !== "none",
    text: () => "Deep in seclusion, a cold whisper coils at the edge of your mind, promising to sweep away every obstacle — if you will only let go.",
    choices: [
      { label: "Anchor your heart and resist", result: (c, rng, A) => { if (rng.random() < 0.45 + c.soul / 200) { cap(c, "soul", 2); A.happy(4); A.qi(0.3); return "You sit unmoved as a mountain until the whisper starves and dies. Your dao-heart is harder for it. (+Soul Sense)"; } A.heal(-10); A.happy(-8); A.karma(-3); return "It slips its hooks in before you cast it out, leaving your spirit raw and your sleep haunted. (-Health, -Happiness)"; } },
      { label: "Cut the meditation short", result: (c, rng, A) => { A.happy(-2); return "You break seclusion early and shake the cobwebs from your mind. Better cautious than possessed."; } },
    ],
  },
  {
    id: "ley_vein", weight: 3, awakened: true, minRealm: 2, cond: c => c.root.key !== "none",
    auto: (c, rng, A) => { A.qi(rng.uniform(0.4, 0.8)); A.stones(rng.randint(10, 30)); return "Tracing a tremor in the earth's qi, you uncover a minor spirit-vein and quietly tap its slow, sweet flow before sealing it away as your secret. (qi & stones)"; },
  },
  {
    id: "framed_theft", weight: 4, awakened: true, minRealm: 2,
    text: () => "A precious relic vanishes from a sect vault, and a sly rival points the finger squarely at you.",
    choices: [
      { label: "Prove your innocence", result: (c, rng, A) => { if (rng.random() < 0.4 + (c.comprehension + c.reputation / 4) / 200) { c.reputation += 4; A.happy(4); return "Cool-headed, you trace the true thief and unmask them before the elders. Your name shines the brighter for the slander. (+Reputation)"; } c.reputation -= 6; A.happy(-6); return "You cannot shake the accusation; whispers trail you for years, though no proof is ever found. (-Reputation)"; } },
      { label: "Leave under a cloud", result: (c, rng, A) => { c.reputation -= 3; cap(c, "soul", 1); return "You refuse to dignify the lie and simply walk away. Let time be your witness. (-Reputation, +Soul)"; } },
    ],
  },
  {
    id: "grateful_clan", weight: 3, awakened: true, minRealm: 2, cond: c => c.reputation >= 25,
    auto: (c, rng, A) => ["A mortal clan you once shielded from bandits sends a heartfelt tribute — an heirloom treasure pressed into your hands."].concat(A.giveArtifact()),
  },

  /* -- high realm & venerable elder -- */
  {
    id: "starlit_insight", weight: 4, minRealm: 4, awakened: true,
    auto: (c, rng, A) => { A.qi(rng.uniform(0.5, 1.1)); cap(c, "soul", 2); return "Alone on a frozen peak beneath a wheeling river of stars, you feel the vast indifference of heaven — and your spirit expands to meet it. (+Soul Sense)"; },
  },
  {
    id: "old_wound_returns", weight: 4, minRealm: 4, awakened: true,
    auto: (c, rng, A) => ["A foe you wronged or bested lifetimes ago returns at last, grown strong on hatred, to settle the old account!"].concat(A.fight(["a Vengeful Old Foe", A.power() * rng.uniform(1.0, 1.3), (c.realm + 1) * 8, "rogue"])),
  },
  {
    id: "guest_elder", weight: 4, minRealm: 4, awakened: true, cond: c => c.reputation >= 60,
    text: () => "A rising young sect, eager to borrow your prestige, invites you to sit as an honoured Guest Elder.",
    choices: [
      { label: "Accept the seat", result: (c, rng, A) => { const g = rng.randint(40, 90); A.stones(g); c.reputation += 4; A.happy(3); return `You lend your name and a few pointers; in return they heap ${g} stones and deference upon you. (+stones, +Reputation)`; } },
      { label: "Decline politely", result: (c, rng, A) => { cap(c, "soul", 1); c.reputation += 1; return "You have no wish to be any sect's ornament. They bow to your aloof grandeur regardless."; } },
    ],
  },
  {
    id: "effortless_pills", weight: 3, minRealm: 4, awakened: true, cond: c => (c.alchemySkill || 0) >= 20,
    auto: (c, rng, A) => { const p = rng.randint(2, 5); c.pills += p; c.alchemySkill += rng.randint(1, 3); return `Your furnace-craft has ripened: a routine refining yields ${p} extra pills with barely a thought. (+${p} pills, +Alchemy)`; },
  },
  {
    id: "body_strain_high", weight: 4, minRealm: 5, awakened: true,
    text: () => "Even an immortal's flesh wearies. A deep ache settles into your bones after a century of relentless cultivation.",
    choices: [
      { label: "Rest and recuperate a season", result: (c, rng, A) => { A.heal(12); A.happy(3); return "You set the dao aside and simply rest. Your body mends, slow progress traded for steadier years. (+Health)"; } },
      { label: "Push on regardless", result: (c, rng, A) => { A.qi(0.2); A.heal(-10); return "You ignore the warning and cultivate through the pain. Progress now; a price to pay later. (-Health)"; } },
    ],
  },

  /* -- twilight of a long life -- */
  {
    id: "twilight_serenity", weight: 5, awakened: true, cooldown: 12, cond: c => c.age > c.maxAge * 0.8,
    auto: (c, rng, A) => { cap(c, "soul", 2); A.happy(8); c.longevityBonus = (c.longevityBonus || 0) + rng.randint(1, 3); E.recomputeMaxAge(c); return "In the long quiet of your twilight years you make peace with all you have been. A serene heart steadies the dao and coaxes a few more years from a guttering lamp. (+Soul Sense, +lifespan)"; },
  },
  {
    id: "twilight_frailty", weight: 5, awakened: true, cooldown: 6, cond: c => c.age > c.maxAge * 0.85,
    auto: (c, rng, A) => { A.heal(-rng.randint(6, 12)); A.happy(-3); return "The weight of your years presses close; a sudden frailty leaves you breathless on the meditation mat. The end is no longer an abstraction. (-Health)"; },
  },
  {
    id: "twilight_visitor", weight: 4, awakened: true, cooldown: 10, cond: c => c.age > c.maxAge * 0.8 && c.relationships.some(n => n.alive && (n.role === "disciple" || n.kin === "Son" || n.kin === "Daughter")),
    auto: (c, rng, A) => { const k = c.relationships.find(n => n.alive && (n.role === "disciple" || n.kin === "Son" || n.kin === "Daughter")); if (k) k.affinity = Math.min(100, (k.affinity || 50) + 10); A.happy(10); A.heal(4); return `Your ${k ? (k.kin ? k.kin.toLowerCase() : "disciple") : "kin"} ${k ? k.name : ""} returns to tend your hearth through the cold season, and your old heart warms to have them near. (+Happiness)`; },
  },

  /* -- broad fortune & misfortune (any settled age) -- */
  {
    id: "prophetic_dream", weight: 4, minAge: 8, maxAge: 9000,
    auto: (c, rng, A) => { if (rng.random() < 0.6) { A.herbs(rng.randint(3, 9)); A.stones(rng.randint(5, 20)); return "A vivid dream of a moon-silvered hollow lingers at dawn. You seek the place out — and find exactly the cache it promised. (herbs & stones)"; } A.qi(0.15); cap(c, "comprehension", 1); return "Strange dao-symbols drift through your dreams; you wake with your mind subtly clearer. (+Comprehension)"; },
  },
  {
    id: "natural_disaster", weight: 4, minAge: 10, maxAge: 9000,
    text: () => "A great flood tears through the region, and the brown waters rise toward your stores.",
    choices: [
      { label: "Save your stores first", result: (c, rng, A) => { if (rng.random() < 0.5 + c.constitution / 250) { A.happy(2); return "You haul your herbs and stones to high ground through chest-deep water, losing nothing but a night's sleep."; } const lost = Math.floor((c.herbs || 0) * 0.4); A.herbs(-lost); A.heal(-6); return `The current takes ${lost} herbs and very nearly you. (-herbs, -Health)`; } },
      { label: "Help the drowning villagers", result: (c, rng, A) => { A.karma(10); c.reputation += 2; const lost = Math.floor((c.spiritStones || 0) * 0.2); A.stones(-lost); A.happy(4); return "You wade in to drag families from the flood, your own goods be damned. The region will long remember your name. (+Karma, +Reputation)"; } },
    ],
  },
  {
    id: "save_drowning_child", weight: 4, minAge: 12, maxAge: 9000,
    text: () => "A child slips from a riverbank and is swept screaming into the rapids.",
    choices: [
      { label: "Dive in after them", result: (c, rng, A) => { A.karma(8); c.reputation += 2; if (rng.random() < 0.7 + c.constitution / 400) { A.happy(8); return "You haul the gasping child to shore, to the sobbing thanks of their parents. A life saved is its own reward. (+Karma)"; } A.heal(-8); A.happy(2); return "You both nearly drown, but you drag the child out at the last. Battered, soaked, and quietly proud. (+Karma, -Health)"; } },
      { label: "Look away", result: (c, rng, A) => { A.karma(-6); A.happy(-6); return "You tell yourself it was already too late. The small scream haunts your meditations for years. (-Karma)"; } },
    ],
  },
  {
    id: "betrayed_friend", weight: 3, minAge: 16, maxAge: 9000, cond: c => c.relationships.some(n => n.role === "friend" && n.alive && n.affinity >= 30),
    text: c => { const f = c.relationships.find(n => n.role === "friend" && n.alive && n.affinity >= 30); return `${f ? f.name : "A trusted friend"}, drowning in debt, slips away in the night with a pouch of your spirit stones.`; },
    choices: [
      { label: "Forgive the debt", result: (c, rng, A) => { const f = c.relationships.find(n => n.role === "friend" && n.alive && n.affinity >= 30); const lost = Math.floor((c.spiritStones || 0) * 0.25); A.stones(-lost); A.karma(4); cap(c, "soul", 1); if (f) f.affinity = Math.max(-100, f.affinity - 25); return `You let it go, mourning the friendship more than the ${lost} stones. A heavy, clean kind of peace. (-stones, +Soul)`; } },
      { label: "Hunt them down", result: (c, rng, A) => { const f = c.relationships.find(n => n.role === "friend" && n.alive && n.affinity >= 30); if (f) f.affinity = -70; A.happy(-4); return "You track the thief and take back what is yours — and lose what was once a friend. The stones feel cold in your hand."; } },
    ],
  },
  {
    id: "spirit_merchant", weight: 4, minAge: 14, maxAge: 9000, awakened: true, cond: c => c.spiritStones >= 15,
    text: () => "A one-eyed merchant unfolds a stall of curios that were not there a moment ago, and beckons you closer with a knowing grin.",
    choices: [
      { label: "Browse his wares", result: (c, rng, A) => { const cost = Math.min(c.spiritStones, rng.randint(12, 30)); A.stones(-cost); const r = rng.random(); if (r < 0.45) return [`You trade ${cost} stones for a dusty, faintly humming relic.`].concat(A.giveArtifact(rng.random() < 0.3 ? "Earth" : null)); if (r < 0.7) { A.herbs(rng.randint(8, 18)); return `He sells you a bundle of potent spirit herbs at a thief's bargain. (-${cost} stones, +herbs)`; } cap(c, "comprehension", 2); return `He presses a cryptic scrap of dao-verse into your hand "on the house," then is simply gone. (+Comprehension)`; } },
      { label: "Walk on warily", result: (c, rng, A) => { cap(c, "soul", 1); return "Something about that grin sets your spirit on edge. You keep your stones and your distance. (+Soul Sense)"; } },
    ],
  },

  /* ===================== branching dialogue encounters =================== *
   * These use the multi-step dialogue framework: a choice can open a follow-on
   * node (with an NPC speaker) instead of ending the card, so the player talks,
   * bargains and decides their way through a real conversation. */
  {
    id: "dlg_hermit", weight: 5, minAge: 12, minRealm: 1, awakened: true, cooldown: 25,
    speaker: () => "A Reclusive Elder",
    text: () => "Crossing a misted pass you find an old man in patched grey robes, brewing tea over a thumb-sized fire. He does not look up. \"Sit,\" he says. \"The kettle is near ready, and you have walked a long way to be so tense.\"",
    choices: [
      { label: "Sit and share his tea", result: () => ({
        speaker: "The Elder",
        text: "He pours two cups without asking. \"A riddle for the tea, then. When the blade falls and the heart is still — which moves first: the hand, or the intent behind it?\"",
        choices: [
          { label: "\"The intent. The hand only follows.\"", result: (c, rng, A) => { cap(c, "comprehension", 3); A.qi(0.5); return ["His eyes crease. \"Just so. Few your age see it.\" He traces a character in the ash and a knot in your meridians quietly loosens. (+Comprehension, +qi)"]; } },
          { label: "\"The hand. Intent is a story we tell after.\"", result: (c, rng, A) => { cap(c, "constitution", 2); cap(c, "soul", 1); return ["He chuckles into his cup. \"A body-cultivator's answer — not wrong, but not whole.\" He raps your wrist with a knuckle and your sinews hum. (+Constitution)"]; } },
          { label: "\"Neither. They were never two things.\"", result: (c, rng, A) => {
            if (rng.random() < 0.5 + c.comprehension / 220) {
              cap(c, "comprehension", 4); cap(c, "soul", 2); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 3);
              const t = A.learnTech(); A.note("A nameless old master left a mark on your dao.");
              return ["The cup stops at his lips. For a long moment he only looks at you. \"...Go,\" he says at last, softly, \"before I am tempted to keep you.\" He presses a jade slip into your palm.", t ? `  In the slip: a manual — ${t}!` : "  Insight blooms behind your eyes. (+Comprehension, +Soul, +Dao Heart)"];
            }
            cap(c, "soul", 1); return ["\"A fine thing to say,\" he murmurs, \"if you understood it.\" He smiles, not unkindly, and pours more tea. (+Soul)"];
          } },
        ],
      }) },
      { label: "Ask to become his disciple", result: () => ({
        speaker: "The Elder",
        text: "\"A master?\" He laughs until he coughs. \"I have nothing to teach that the mountain won't teach you cheaper. But boldness should not go home empty-handed.\"",
        choices: [
          { label: "Press him, earnest and unbending", result: (c, rng, A) => { if (rng.random() < 0.25 + c.charm / 300) { A.qi(0.8); cap(c, "comprehension", 2); return ["Something in your eyes gives him pause. \"...One lesson, then. Listen well, for I will not repeat it.\" For an hour he speaks, and the world quietly rearranges itself. (+qi, +Comprehension)"]; } A.herbs(rng.randint(3, 7)); A.happy(-1); return ["\"Persistent. Good. Still no.\" He waves you off — but tucks a bundle of spirit herbs into your sleeve as you turn to go."]; } },
          { label: "Bow to the ground and accept his refusal", result: (c, rng, A) => { cap(c, "soul", 2); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 2); return ["You bow three times to the earth and leave without another word. \"Mm,\" he grunts, pleased despite himself. Something in you settles. (+Soul, +Dao Heart)"]; } },
        ],
      }) },
      { label: "Bow and continue on your way", result: (c, rng, A) => { cap(c, "soul", 1); return ["You bow and leave the old man to his tea; the mist swallows the little fire behind you. (+Soul)"]; } },
    ],
  },
  {
    id: "dlg_devil_bargain", weight: 4, minAge: 14, minRealm: 2, awakened: true, cooldown: 22,
    cond: c => c.root.key !== "none",
    speaker: () => "A Voice in the Dark",
    text: () => "Cultivating alone at the dead of night, you feel the lamp gutter. A voice slides into the room like smoke, owning no body. \"Such talent,\" it purrs, \"shackled by such patience. I could spare you a hundred years of crawling. Care to hear my terms?\"",
    choices: [
      { label: "\"Speak, then. I am listening.\"", result: () => ({
        speaker: "The Voice",
        text: "\"A morsel of forbidden art — blood for qi, the oldest trade. Your cultivation would leap like a struck flame. The cost is small. At first.\"",
        choices: [
          { label: "\"And the true cost? Name it.\"", result: () => ({
            speaker: "The Voice",
            text: "\"...Your name in a certain ledger. A shadow on your soul the heavens will one day come to collect. A trifle — for power now, while your rivals still crawl.\"",
            choices: [
              { label: "Accept the bargain", result: (c, rng, A) => { A.karma(-30); A.qi(1.3); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 8); if (!c.techniques.includes("blood_refine")) c.techniques.push("blood_refine"); A.note("Struck a bargain with a thing in the dark."); return ["You speak the word. Cold power floods your meridians, hungry and sweet, and the art carves itself into your soul. The voice laughs, satisfied, and is gone. The heavens will remember this. (+++qi, −−Karma, −Dao Heart, learned a blood-art)"]; } },
              { label: "\"No. Get out.\"", result: (c, rng, A) => { c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 5); cap(c, "soul", 2); return ["You name the thing for what it is and command it gone. It shrieks, thin and furious, and the lamp flares white. Your dao heart rings like a struck bell. (+Dao Heart, +Soul)"]; } },
            ],
          }) },
          { label: "\"I'll have none of it. Begone.\"", result: (c, rng, A) => { c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 3); cap(c, "soul", 1); return ["You straighten the lamp-wick and recite a calming mantra until the smoke-voice thins to nothing. (+Dao Heart, +Soul)"]; } },
        ],
      }) },
      { label: "\"Begone. I climb on my own.\"", result: (c, rng, A) => { c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 4); cap(c, "soul", 2); return ["You do not even turn your head. The voice hisses, affronted, and is snuffed out like a pinched wick. Your resolve hardens against the dark. (+Dao Heart, +Soul)"]; } },
    ],
  },
  {
    id: "dlg_captured_rogue", weight: 4, minAge: 14, minRealm: 1, awakened: true, cooldown: 14,
    cond: c => c.root.key !== "none",
    text: () => "A masked rogue tries to cut your purse on a crowded road — and you catch his wrist like a striking snake. He freezes, his little blade trembling an inch from your robe.",
    choices: [
      { label: "Demand an explanation", result: () => ({
        speaker: "The Thief",
        text: "\"Mercy, fellow daoist! My sect was razed in the Demon Tide — I've a little sister to feed and not a stone to my name. I wasn't going to take much, I swear it!\"",
        choices: [
          { label: "Release him with a warning", result: (c, rng, A) => { A.karma(4); A.happy(2); return ["You let go. He stares, then bows again and again and melts into the crowd. Perhaps he spoke true; perhaps not. Either way you sleep easier tonight. (+Karma)"]; } },
          { label: "Take his blade as payment for the lesson", result: (c, rng, A) => { A.stones(rng.randint(4, 10)); return ["You pluck the dagger from his fingers and send him running. A decent little blade — you sell it down the road for a few stones."]; } },
          { label: "\"Prove it. Take me to this sister.\"", result: (c, rng, A) => { if (rng.random() < 0.55 + c.soul / 400) { A.karma(8); A.happy(4); const f = A.meet("friend", { affinity: 22 }); return [`He leads you down crooked alleys to a freezing garret where a thin girl waits, wide-eyed. It was true. You leave them silver enough for a season — and earn a debt of gratitude that may, one day, matter.${f ? ` ${f.name} will not forget this.` : ""} (+Karma)`]; } A.happy(-3); return ["He bolts the instant your grip eases, cackling — there was no sister, only a mark soft enough to believe in one. You've been played for a fool. (−a little face)"]; } },
          { label: "Cut him down where he stands", result: (c, rng, A) => { A.karma(-12); A.happy(-2); return ["Your palm finds his heart before the lie is finished. He folds into the dust and the crowd recoils from you. Perhaps he deserved it. Perhaps not. The heavens are watching. (−Karma)"]; } },
        ],
      }) },
      { label: "Hand him to the city wardens", result: (c, rng, A) => { c.reputation += 1; A.karma(2); return ["You frog-march the squirming thief to the ward-post and leave him to mortal justice. Orderly, bloodless, forgettable. (+a little Reputation)"]; } },
    ],
  },
  {
    id: "dlg_merchant_haggle", weight: 5, minAge: 12, awakened: true, cooldown: 12, cond: c => c.spiritStones >= 20,
    speaker: () => "A Silver-Tongued Merchant",
    text: () => "A merchant with a cart of oddments waves you over. \"Friend! You've the look of a cultivator of taste. This—\" he lifts a dusty jade gourd that hums faintly \"—a genuine spirit-treasure, and for you, a mere eighty stones!\"",
    choices: [
      { label: "Pay the eighty and take it", cond: c => c.spiritStones >= 80, result: (c, rng, A) => { A.stones(-80); return ["He wraps it before you can blink. \"A discerning eye!\""].concat(A.giveArtifact()); } },
      { label: "Scoff and start to walk", result: () => ({
        speaker: "The Merchant",
        text: "\"Wait, wait! For a face like yours — fifty-five. I rob my own children to say it!\"",
        choices: [
          { label: "Pay fifty-five", cond: c => c.spiritStones >= 55, result: (c, rng, A) => { A.stones(-55); return ["He sighs as though wounded and hands it over."].concat(A.giveArtifact()); } },
          { label: "\"Thirty. Final.\"", result: (c, rng, A) => {
            if (rng.random() < 0.4 + c.charm / 250) { A.stones(-Math.min(c.spiritStones, 30)); return ["He clutches his chest, named a robber — then grins and slaps the gourd into your hands. \"Take it! Take it before my heart gives out!\""].concat(A.giveArtifact()); }
            A.happy(-1); return ["He throws up his hands. \"You insult the ancestors of this gourd!\" He packs up his cart with wounded dignity and trundles off. The deal is lost."];
          } },
          { label: "Walk away for real", result: () => "You leave him calling prices at your back, each one lower than the last. Some games are won by not playing." },
        ],
      }) },
      { label: "Decline politely and move on", result: () => "You smile, shake your head, and walk on. The hum of the gourd fades behind you." },
    ],
  },

  /* ==================== multi-year storyline arcs ======================= *
   * Arcs play out over several years: a choice now sets the arc's stage, and a
   * later beat (gated on stage + years elapsed) continues it, branching on what
   * you chose before. Arc-flagged beats are drawn with priority (see
   * rollYearEvents) so a saga you're living through reliably advances. */

  // — The Dying Sword-Immortal's Inheritance (剑冢传承) — power, virtue, or theft.
  {
    id: "swordtomb_start", arc: true, weight: 6, minAge: 14, minRealm: 2, awakened: true, cooldown: 0,
    cond: c => c.root.key !== "none" && arcStage(c, "swordtomb") === 0,
    speaker: () => "A Dying Sword-Immortal",
    text: () => "Deep in a cleft of grey stone you find an ancient man impaled on his own black sword, dying slow across centuries. His eyes snap open. \"You... have the bones for it. Quickly — my sword-heart cannot pass into the dirt. Will you take it, and all the ruin it brings?\"",
    choices: [
      { label: "Kneel and accept his final transmission", result: (c, rng, A) => { arcSet(c, "swordtomb", 1); cap(c, "comprehension", 2); A.note("Accepted a dying sword-immortal's transmission."); return ["He presses two fingers to your brow and a seed of cold, singing light buries itself in your sea of consciousness. \"Temper it,\" he breathes, \"or it will temper you.\" Then he is dust. (A sword-seed is planted; the path will unfold over the coming years.)"]; } },
      { label: "Grant him a clean death and take nothing", result: (c, rng, A) => { arcSet(c, "swordtomb", 99); A.karma(10); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 6); cap(c, "soul", 2); return ["You ease his blade free and let the old killer go in peace. He smiles, surprised, and crumbles to dust. You leave his tomb unrobbed — and walk away lighter than you came. (+Karma, +Dao Heart, +Soul)"]; } },
      { label: "Slay him and seize the black sword now", result: (c, rng, A) => { arcSet(c, "swordtomb", 11); A.karma(-18); A.note("Robbed a dying sword-immortal's tomb."); return ["You end him with his own edge and tear the black sword free. Cold power thrums up your arm — and somewhere, something marks the theft. (−Karma)"].concat(E.acquireArtifact(c, E.randomArtifact(c, rng, "Heaven", { slot: "weapon", element: "Dark" }))); } },
    ],
  },
  {
    id: "swordtomb_trial", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "swordtomb") === 1 && arcYears(c, "swordtomb") >= 2,
    text: () => "The sword-seed in your sea of consciousness has grown teeth. One night it wakes, and a storm of killing intent not your own howls through your meridians, demanding to be mastered — or to master you.",
    choices: [
      { label: "Hurl yourself into the sword-intent", result: (c, rng, A) => {
        if (rng.random() < 0.35 + c.comprehension / 260 + (c.daoHeart || 0) / 300) { arcSet(c, "swordtomb", 2); A.qi(0.8); cap(c, "comprehension", 3); return ["You meet the storm with your whole soul and ride it down into stillness. The sword-intent bends its neck to you at last. (+Comprehension, +qi — mastery is near.)"]; }
        A.heal(-Math.round(c.maxHp * 0.25)); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 4); return ["The intent is an ocean and you a stone; it batters you bloody and withdraws, unbroken. You will have to try again, stronger. (−health, −Dao Heart)"];
      } },
      { label: "Temper it slowly, a little each year", result: (c, rng, A) => { arcSet(c, "swordtomb", 2); cap(c, "soul", 2); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 3); return ["You refuse to be rushed. Night after night you sit with the cold light, coaxing it a finger's breadth at a time. Slow — but sure. (+Soul, +Dao Heart)"]; } },
      { label: "Cast the sword-seed out for good", result: (c, rng, A) => { arcSet(c, "swordtomb", 99); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 5); cap(c, "soul", 1); return ["A borrowed blade is no blade at all, you decide. With a wrenching effort you expel the seed; it gutters out in the dark, and you are only yourself again — and at peace with it. (+Dao Heart)"]; } },
    ],
  },
  {
    id: "swordtomb_master", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "swordtomb") === 2 && arcYears(c, "swordtomb") >= 2,
    text: () => "The sword-seed is ripe. To take its inheritance whole you must forge it into a sword-heart of your own — and the heavens watch to see whether you are worthy, or merely a thief of a dead man's strength.",
    choices: [
      { label: "Forge the sword-heart", result: (c, rng, A) => {
        arcSet(c, "swordtomb", 99);
        if ((c.daoHeart || 0) >= 35 || rng.random() < 0.4 + c.comprehension / 300) {
          if (!c.techniques.includes("heaven_slash")) c.techniques.push("heaven_slash");
          cap(c, "comprehension", 4); A.note("Forged a sword-immortal's inheritance into a sword-heart.");
          return ["Steel and soul fuse. The old immortal's centuries pour into you and settle as your own — you understand the sword now, all the way down. You have inherited the Heaven-Splitting Sabre! (+Comprehension)"]
            .concat(E.acquireArtifact(c, E.randomArtifact(c, rng, "Heaven", { slot: "weapon", element: "Metal" })))
            .concat(E.maybeAwardEpithet(c, rng, { base: 0.5 }));
        }
        A.heal(-Math.round(c.maxHp * 0.4)); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 6); c.stage = Math.max(0, c.stage - 1);
        if (!c.techniques.includes("sword_rain")) c.techniques.push("sword_rain");
        return ["Your dao heart cannot yet hold a dead man's centuries. The sword-intent rebels, savaging your meridians before you wrestle it to a sullen truce. You salvage only a fragment of the art — and a scar on your soul. (−health, −Dao Heart, slipped a stage; learned a lesser sword art)"];
      } },
    ],
  },
  {
    id: "swordtomb_haunt", arc: true, weight: 18, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "swordtomb") === 11 && arcYears(c, "swordtomb") >= 2,
    speaker: () => "A Vengeful Sword-Wraith",
    text: () => "The black sword you stole has been whispering. Tonight the whispers take shape: the murdered immortal's killing intent claws out of the blade, a wraith of grey fire with your theft burning in its eyes. \"THIEF.\"",
    choices: [
      { label: "Face the wraith, blade to blade", result: (c, rng, A) => {
        const res = A.fight(["the Sword-Immortal's Wraith", A.power() * rng.uniform(1.1, 1.45), (c.realm + 1) * 9, "rogue"]);
        if (c.alive) { arcSet(c, "swordtomb", 99); c.reputation += 6; cap(c, "comprehension", 3); res.push("You shatter the wraith and the black sword falls silent at last — truly yours now, paid for in full. (+Reputation, +Comprehension)"); }
        return ["Grey fire against your steel."].concat(res);
      } },
      { label: "Kneel, repent, and offer the sword back", result: (c, rng, A) => {
        arcSet(c, "swordtomb", 99);
        if ((c.karma || 0) >= 0 || (c.daoHeart || 0) >= 30) { c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 6); A.karma(8); return ["You lay the blade down and press your forehead to the cold stone. The wraith studies you a long moment — then sighs and sinks back into the steel, appeased. The sword is yours with its blessing now. (+Karma, +Dao Heart)"]; }
        A.heal(-Math.round(c.maxHp * 0.3)); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 5); return ["Your repentance rings hollow even to your own ears. The wraith sees the rot in your heart and sinks its grey fire into your soul before it fades — a curse you will carry a long time. (−health, −Dao Heart)"];
      } },
    ],
  },

  // — The Foundling (孤雏) — a ward you raise across the years into a devoted
  //   disciple, a cold blade, a stranger who departs, or a nemesis of your making.
  {
    id: "foundling_start", arc: true, weight: 5, minAge: 18, minRealm: 1, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "foundling") === 0 && !arcNpc(c, "foundling"),
    text: () => "In a famine-struck town a filthy child plants themselves in your path, eyes too old for their face. \"You're a cultivator,\" they say — not asking. \"Take me. I'll work, I'll—\" The small hands are shaking. Something in them flickers: the faintest spark of a spiritual root.",
    choices: [
      { label: "Take the child in as your ward", result: (c, rng, A) => {
        const n = A.meet("friend", { affinity: 40, realm: 0 });
        n.arcTag = "foundling"; n.kin = "Foundling Ward";
        arcSet(c, "foundling", 1, { ward: n.name });
        A.happy(5); A.note(`Took in a foundling, ${n.name}.`);
        return [`You hold out a hand. ${n.name} stares at it as though it might vanish, then seizes it with both of theirs. You have a ward now — and the long, uncertain work of raising one. (See them in Relationships.)`];
      } },
      { label: "Give them silver and a warm meal", result: (c, rng, A) => { arcSet(c, "foundling", 99); A.karma(6); A.happy(3); A.stones(-Math.min(c.spiritStones, 5)); return ["You press silver and bread into their hands and point them to a temple that takes orphans. It is not nothing. It is not everything. They watch you go with a look you try not to remember. (+Karma)"]; } },
      { label: "Step around them and walk on", result: (c, rng, A) => { arcSet(c, "foundling", 99); A.happy(-3); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 1); return ["The world is full of dying children and you cannot save them all. You tell yourself this all the way down the road, and most of the way through the night. (−Happiness)"]; } },
    ],
  },
  {
    id: "foundling_lost", arc: true, weight: 30, awakened: true, cooldown: 0,
    cond: c => (arcStage(c, "foundling") === 1 || arcStage(c, "foundling") === 2) && !arcNpc(c, "foundling"),
    auto: (c, rng, A) => { arcSet(c, "foundling", 99); A.happy(-12); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 2); return "Word comes that your ward did not survive — the world is hard on small things, and you were not there to shield them. You bury what little there is to bury, and carry the weight of it the rest of your days. (−Happiness)"; },
  },
  {
    id: "foundling_raise", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "foundling") === 1 && arcYears(c, "foundling") >= 3 && !!arcNpc(c, "foundling"),
    text: c => { const n = arcNpc(c, "foundling"); return `Three years on, ${n ? n.name : "your ward"} has filled out and steadied, and their spark of talent has caught into a flame. How you raise them now will shape who they become.`; },
    choices: [
      { label: "Teach with patient kindness", result: (c, rng, A) => { const n = arcNpc(c, "foundling"); if (n) n.affinity = clampN((n.affinity || 40) + 25, -100, 100); arcSet(c, "foundling", 2, { path: "kind" }); A.happy(4); return [`You are gentle where the world was not. ${n ? n.name : "Your ward"} blooms under it, following you like a second shadow, hungry to make you proud.`]; } },
      { label: "Drill them with harsh discipline", result: (c, rng, A) => { const n = arcNpc(c, "foundling"); if (n) { n.affinity = clampN((n.affinity || 40) - 8, -100, 100); n.power = (n.power || 1) * 1.6; n.realm = Math.min(Math.max(0, c.realm - 2), (n.realm || 0) + 1); } arcSet(c, "foundling", 2, { path: "harsh" }); return [`You are iron with them — cold dawns, bleeding hands, no praise. They grow strong and hard and fast, and learn to read your moods like weather. Whether love or fear drives them, even you cannot always tell.`]; } },
      { label: "Leave them to fend while you cultivate", result: (c, rng, A) => { const n = arcNpc(c, "foundling"); if (n) n.affinity = clampN((n.affinity || 40) - 24, -100, 100); arcSet(c, "foundling", 2, { path: "neglect" }); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 2); return [`Your dao comes first; it always has. ${n ? n.name : "The child"} is fed and housed and otherwise alone, learning what your silences mean. (−the bond between you)`]; } },
    ],
  },
  {
    id: "foundling_grown", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "foundling") === 2 && arcYears(c, "foundling") >= 3 && !!arcNpc(c, "foundling"),
    text: c => { const n = arcNpc(c, "foundling"); return `${n ? n.name : "Your ward"} comes of age — no longer a foundling but a young cultivator in their own right. The shape of what you made of them comes due.`; },
    choices: [
      { label: "See what they have become", result: (c, rng, A) => {
        const n = arcNpc(c, "foundling"); arcSet(c, "foundling", 99);
        if (!n) return ["But they are already gone, slipped away in the night without a word."];
        const aff = n.affinity || 0; n.arcTag = null;
        if (aff >= 55) {
          n.role = "disciple"; n.kin = "Disciple"; n.resides = true; n.learned = n.learned || []; n.affinity = clampN(aff + 10, -100, 100);
          A.happy(8); c.reputation += 4; A.note(`${n.name}, once a foundling, became your devoted disciple.`);
          return [`${n.name} kneels and kowtows three times, then presses a gift into your hands, bought with years of saved coppers. "Everything I am, master, you made." They are yours now, heart and blade, and come to live at your side. (A devoted disciple!)`]
            .concat(E.acquireArtifact(c, E.randomArtifact(c, rng, null)));
        }
        if (aff >= 0) {
          n.role = "disciple"; n.kin = "Disciple"; n.learned = n.learned || [];
          return [`${n.name} bows, correct and cool, and takes a place among your disciples. They are strong, and loyal — in the way a well-made blade is loyal. Warmth was never part of the bargain. (A disciple gained.)`];
        }
        if (aff <= -25) {
          n.role = "nemesis"; n.kin = "Nemesis"; n.grudge = "the master who raised them like a tool and called it love"; n.encounters = 0;
          E.ensureNpcProfile(n, rng, { realm: Math.max(1, c.realm - 2) });
          A.happy(-8); A.note(`${n.name}, the foundling you failed, became your nemesis.`);
          return [`${n.name} looks at you with your own coldness reflected back, and it is worse than hatred. "I learned everything from you," they say softly. "Including this." They turn and walk into the world as your sworn enemy. (A nemesis is born of your neglect — settle it in Adventure.)`];
        }
        A.happy(-4); n.role = "friend";
        return [`${n.name} thanks you with stiff formality for "all you did," and takes their leave to walk their own road. You will hear their name now and then, from a distance. They will not visit. (Your ward departs.)`];
      } },
    ],
  },

  // — The Soul-Withering Poison (蚀魂之毒) — armed by a demonic wound in battle;
  //   a years-long race to find a cure before it reaches your heart.
  {
    id: "soulpoison_start", arc: true, weight: 40, minRealm: 2, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "soulpoison") === 0 && E.arcArmed(c, "soulpoison"),
    auto: (c, rng, A) => {
      E.disarmArc(c, "soulpoison"); arcSet(c, "soulpoison", 1); cap(c, "soul", 0);
      c.soul = Math.max(1, c.soul - 2); A.note("A demonic soul-poison took root in your meridians.");
      return "The rot the demon left has spread. A healer you visit goes pale: a soul-withering poison gnaws at your spirit, and it will not stop on its own. Untreated, in a handful of years it will reach your heart — and end you. You must find a cure.";
    },
  },
  {
    id: "soulpoison_seek", arc: true, weight: 25, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "soulpoison") === 1 && arcYears(c, "soulpoison") >= 1 && arcYears(c, "soulpoison") < 6,
    text: c => `The soul-poison deepens; your spirit-sense frays at the edges and cold aches settle in your bones. (${6 - arcYears(c, "soulpoison")} year${6 - arcYears(c, "soulpoison") === 1 ? "" : "s"} before it reaches your heart.)`,
    choices: [
      { label: "Seek out a renowned healer (60 stones)", cond: c => c.spiritStones >= 60, result: (c, rng, A) => {
        A.stones(-60);
        if (rng.random() < 0.45 + c.reputation / 400 + c.charm / 300) { arcSet(c, "soulpoison", 99); cap(c, "soul", 2); return ["A reclusive divine-healer agrees to see you. Three days of golden needles and bitter draughts later, the cold rot is drawn out at last. You are whole again. (cured — +Soul)"]; }
        c.soul = Math.max(1, c.soul - 2); return ["The healer you find does what they can, but the poison is stubborn and deep; it buys you time, no more. The rot creeps on. (−Soul)"];
      } },
      { label: "Refine the antidote yourself (15 herbs)", cond: c => c.herbs >= 15, result: (c, rng, A) => {
        A.herbs(-15);
        if (rng.random() < 0.30 + (c.alchemySkill || 0) / 120 + c.comprehension / 400) { arcSet(c, "soulpoison", 99); cap(c, "comprehension", 2); A.note("Refined a cure for the soul-poison."); return ["Furnace-light and sleepless nights — but you crack the formula and drink down a jade-green antidote of your own making. The poison dissolves. (cured — +Comprehension)"]; }
        c.soul = Math.max(1, c.soul - 2); A.heal(-Math.round(c.maxHp * 0.08)); return ["Your cauldron yields only a muddy failure that sickens you further. The poison grinds on. (−Soul, −health)"];
      } },
      { label: "Take a demonic remedy from a devil-doctor", result: (c, rng, A) => { arcSet(c, "soulpoison", 99); A.karma(-15); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 6); return ["A blood-robed devil-doctor purges the poison in a single screaming night — by feeding it something darker. You live, cured and clean of body, with a new stain on your soul. (cured — −Karma, −Dao Heart)"]; } },
      { label: "Grit your teeth and endure another year", result: (c, rng, A) => { c.soul = Math.max(1, c.soul - 3); A.heal(-Math.round(c.maxHp * 0.06)); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 1); return ["You wall the poison off with sheer will and cultivate through the pain. It costs you — but your dao heart hardens in the furnace of it. (−Soul, −health, +Dao Heart)"]; } },
    ],
  },
  {
    id: "soulpoison_crisis", arc: true, weight: 40, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "soulpoison") === 1 && arcYears(c, "soulpoison") >= 6,
    speaker: () => "The Poison, at Last",
    text: () => "The soul-poison reaches your heart. Black threads crawl across your vision and your qi convulses — this is the hour you live or die. There is no more time to seek a cure; you have only yourself.",
    choices: [
      { label: "Burn your cultivation to purge it", result: (c, rng, A) => { arcSet(c, "soulpoison", 99); c.qi = 0; c.stage = Math.max(0, c.stage - 1); A.heal(-Math.round(c.maxHp * 0.3)); cap(c, "soul", 1); return ["You set your own meridians alight and scour the poison out with raw qi, burning years of progress to ash to do it. You live — diminished, scarred, but alive. (lost cultivation, slipped a stage — cured)"]; } },
      { label: "Trust your dao heart to weather the storm", result: (c, rng, A) => {
        arcSet(c, "soulpoison", 99);
        if (rng.random() < 0.4 + (c.daoHeart || 0) / 160 + c.constitution / 400) { c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 8); A.heal(-Math.round(c.maxHp * 0.2)); cap(c, "soul", 3); return ["You sit unmoving at the heart of the storm and simply refuse to break. Hour by hour the poison spends itself against your unshaken will — and at dawn, it is gone, and you are more than you were. (endured — +Dao Heart, +Soul)"]; }
        if (rng.random() < c.luck / 280 + (D.physEffect(c).deathSave || 0)) { A.heal(-Math.round(c.maxHp * 0.6)); c.soul = Math.max(1, c.soul - 6); return ["The poison nearly takes you — and would have, but for a sliver of fortune that drags you back from the brink at the last. You crawl out the far side of the night barely alive. (−−health, −Soul)"]; }
        c.alive = false; c.causeOfDeath = "a demonic soul-poison reaching the heart"; c.hp = 0; c.log.push([c.age, "Died of a soul-withering poison."]); return ["Your will is not enough. The black threads close over your heart, and the long cold finally wins. Your journey ends here, undone by an old wound you could not heal."];
      } },
    ],
  },

  // — The Hidden Master's Tutelage (名师传业) — armed by diligent, talented study;
  //   a years-long apprenticeship that rewards heart, or punishes shortcuts.
  {
    id: "tutelage_start", arc: true, weight: 40, minAge: 16, minRealm: 1, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "tutelage") === 0 && E.arcArmed(c, "tutelage"),
    speaker: () => "A Hidden Master",
    text: () => "The stranger who has watched you study finally speaks. Beneath a traveler's plain robe you sense an abyss of cultivation — a hidden master, generations beyond you. \"You read as if the words owe you something,\" they say, almost smiling. \"I have not taken a student in three hundred years. I am minded to take one now. Are you worth my centuries?\"",
    choices: [
      { label: "Kneel and beg to be taught", result: (c, rng, A) => { E.disarmArc(c, "tutelage"); arcSet(c, "tutelage", 1); cap(c, "comprehension", 2); A.note("A hidden master took you as a private student."); return ["You press your forehead to the dirt. The master snorts, hauls you up by the collar, and begins, then and there, to dismantle everything you thought you knew. The lessons will run for years. (+Comprehension)"]; } },
      { label: "Decline — your dao is your own to walk", result: (c, rng, A) => { E.disarmArc(c, "tutelage"); arcSet(c, "tutelage", 99); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 5); cap(c, "soul", 2); return ["\"My road is mine to walk, senior, or it is nothing.\" The master studies you a long moment — then laughs, delighted. \"Perhaps that is the lesson.\" They are gone by morning, leaving your resolve the firmer. (+Dao Heart, +Soul)"]; } },
    ],
  },
  {
    id: "tutelage_trial", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "tutelage") === 1 && arcYears(c, "tutelage") >= 2,
    text: () => "Two years under the hidden master's brutal tutelage have remade you from the meridians out. Now they set you a true trial — a year of relentless, mind-breaking refinement. How you meet it will decide what they pass on.",
    choices: [
      { label: "Pour your whole heart into the work", result: (c, rng, A) => { arcSet(c, "tutelage", 2, { path: "diligent" }); A.qi(0.7); cap(c, "comprehension", 3); cap(c, "soul", 2); return ["You give the trial everything — sleep, pride, the skin off your hands — and come out the other side hollowed and gleaming, like a blade ground to its edge. The master nods, once. (+Comprehension, +Soul, +qi)"]; } },
      { label: "Cut corners to chase quick power", result: (c, rng, A) => { arcSet(c, "tutelage", 2, { path: "lazy" }); A.qi(0.4); c.daoHeart = Math.max(0, (c.daoHeart || 0) - 2); return ["You skim the tedious foundations and lunge for the showy results. It works — after a fashion. But you catch the master watching you with a flicker of disappointment they do not bother to hide. (+qi)"]; } },
    ],
  },
  {
    id: "tutelage_graduation", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "tutelage") === 2 && arcYears(c, "tutelage") >= 2,
    speaker: () => "Your Master",
    text: () => "The day comes that the hidden master sets down their tea and says, \"I have nothing left to give you that you cannot now take for yourself.\" The years of tutelage are ending. What they leave you depends on the student you chose to be.",
    choices: [
      { label: "Bow, and receive their legacy", result: (c, rng, A) => {
        const path = (c.arcs.tutelage && c.arcs.tutelage.path) || "diligent"; arcSet(c, "tutelage", 99);
        if (path === "diligent") {
          if (!c.techniques.includes("great_void")) c.techniques.push("great_void");
          cap(c, "comprehension", 4); cap(c, "soul", 3); A.note("Inherited a hidden master's legacy in full.");
          return ["\"You earned this — all of it.\" They impart the Great Void Immortal Canon, an art said to lead all the way to ascension, and a parting gift besides. Then they walk into the dawn, and you never see them again — but you carry them with you now, always. (Learned the Great Void Immortal Canon! +Comprehension, +Soul)"]
            .concat(E.acquireArtifact(c, E.randomArtifact(c, rng, "Heaven")))
            .concat(E.maybeAwardEpithet(c, rng, { base: 0.5 }));
        }
        cap(c, "comprehension", 2); A.qi(0.5);
        return ["\"You have talent,\" they say, and the unfinished sentence hangs in the air. They teach you a solid art and a hard truth: that shortcuts compound. Then they are gone, and you are left to wonder what you might have been given, had you been worth more of their centuries. (+Comprehension, +qi)"];
      } },
    ],
  },

  // — The Beast-King's Summons (兽王之召) — a random call answered only by those
  //   whose spirit beast already carries a worthy bloodline.
  {
    id: "beastking_start", arc: true, weight: 4, minRealm: 3, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "beastking") === 0 && c.beast && c.beast.alive && (c.beast.rank || 1) >= 2,
    text: c => `${c.beast.name} wakes you at midnight, hackles raised, staring east. On the wind comes a roar that shakes the mountains — and a summons that bypasses your ears and speaks straight to the blood: an ancient Beast-King has caught the scent of your companion's lineage, and bids you both come to its domain.`,
    choices: [
      { label: "Answer the summons together", result: (c, rng, A) => { arcSet(c, "beastking", 1); A.note(`Set out to answer a Beast-King's summons with ${c.beast.name}.`); return [`You ready yourselves and turn east. ${c.beast.name} presses its great head to your chest once, then leads the way — toward whatever the Beast-King wants of you both.`]; } },
      { label: "Refuse, and keep your companion close", result: (c, rng, A) => { arcSet(c, "beastking", 99); if (c.beast) c.beast.bond = clampN((c.beast.bond || 50) + 10, 0, 100); A.happy(3); return [`You will not deliver ${c.beast.name} to some old monster's whim. It huffs, content, and curls against you, and the roar in the east goes unanswered and at last falls silent. (your bond deepens)`]; } },
    ],
  },
  {
    id: "beastking_lost", arc: true, weight: 40, awakened: true, cooldown: 0,
    cond: c => (arcStage(c, "beastking") === 1 || arcStage(c, "beastking") === 2) && !(c.beast && c.beast.alive),
    auto: (c, rng, A) => { arcSet(c, "beastking", 99); A.happy(-6); return "The Beast-King's summons fades, unanswerable now — the companion whose blood it called for is gone. Wherever that ancient thing waits, it will wait in vain, and so, in a different way, will you."; },
  },
  {
    id: "beastking_trial", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "beastking") === 1 && arcYears(c, "beastking") >= 2 && c.beast && c.beast.alive,
    text: c => `You reach the Beast-King's domain — a valley of impossible creatures that bow as ${c.beast.name} passes. The colossus itself regards your companion with ancient eyes. "The blood is true," it rumbles into your bones. "But blood is only a promise. Let it be tested."`,
    choices: [
      { label: `Let ${"your beast"} face the trial alone`, result: (c, rng, A) => {
        const b = c.beast;
        if (rng.random() < 0.4 + (b.bond || 50) / 200 + (b.rank || 1) / 12) { arcSet(c, "beastking", 2, { trial: "passed" }); b.exp = (b.exp || 0) + 40; b.power *= 1.12; b.bond = clampN((b.bond || 50) + 6, 0, 100); return [`${b.name} steps into the ring of elders alone and does not flinch. Roar answers roar; when the dust clears, your companion still stands, and the Beast-King's eyes narrow with approval. (your beast grows stronger)`]; }
        b.power *= 0.95; b.bond = clampN((b.bond || 50) + 2, 0, 100); arcSet(c, "beastking", 2, { trial: "scraped" }); return [`${b.name} fights with everything it has and is beaten down — but will not yield, dragging itself up again and again until the Beast-King calls a halt. "Not strong," it muses. "But unbreakable. That, too, is a bloodline." (your beast is battered but proven)`];
      } },
      { label: "Stand with your beast against the King's champion", result: (c, rng, A) => {
        const res = A.fight(["the Beast-King's Champion", A.power() * rng.uniform(1.1, 1.4), (c.realm + 1) * 9, "beast"]);
        if (c.alive) { arcSet(c, "beastking", 2, { trial: "fought" }); if (c.beast) { c.beast.exp = (c.beast.exp || 0) + 60; c.beast.bond = clampN((c.beast.bond || 50) + 12, 0, 100); } cap(c, "comprehension", 2); res.push(`Side by side, you and ${c.beast ? c.beast.name : "your beast"} weather the champion's fury and break it. The Beast-King rumbles — was that a laugh? "A two-souled beast. Rare." Your bond has never been deeper.`); }
        return [`You will not let your companion face this alone.`].concat(res);
      } },
    ],
  },
  {
    id: "beastking_boon", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "beastking") === 2 && arcYears(c, "beastking") >= 2 && c.beast && c.beast.alive,
    speaker: () => "The Beast-King",
    text: c => `The Beast-King lowers its vast head until one eye fills the sky. "Your companion has earned what I keep. Take it — and remember, two-legs, that I gave it freely." A drop of its ancient blood, bright as a fallen star, hangs waiting before ${c.beast.name}.`,
    choices: [
      { label: "Let your companion receive the blood-boon", result: (c, rng, A) => {
        const b = c.beast; arcSet(c, "beastking", 99);
        const passed = c.arcs.beastking && (c.arcs.beastking.trial === "passed" || c.arcs.beastking.trial === "fought");
        b.power *= passed ? 1.6 : 1.3; b.bond = clampN((b.bond || 50) + 10, 0, 100); b.exp = (b.exp || 0) + 60;
        if (passed && (b.rank || 1) < 5) { b.rank = (b.rank || 1) + 1; b.species = D.beastEvolvedName(b.baseSpecies || b.species, b.rank); }
        A.note(`${b.name} awakened an ancestral bloodline from the Beast-King.`);
        const line = passed
          ? `The star-bright blood sinks into ${b.name} and the valley holds its breath. Your companion throws back its head and *roars* — larger, fiercer, its ancestral bloodline blazing awake. It has ascended. The Beast-King dips its head, one sovereign to a worthy heir. (${b.name} grows vastly stronger and rises a rank!)`
          : `The blood-boon sinks into ${b.name}, and a slow strength uncoils through it — not the full awakening, but a true and lasting gift. Your companion is markedly mightier than before. (${b.name} grows stronger.)`;
        return [line];
      } },
    ],
  },

  // — The Sealed Will (残识之秘) — armed by conquering a Secret Realm; a dead
  //   power's memory-shard that offers knowledge and covets your body.
  {
    id: "sealedwill_start", arc: true, weight: 40, minRealm: 3, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "sealedwill") === 0 && E.arcArmed(c, "sealedwill"),
    speaker: () => "A Will Not Your Own",
    text: () => "The thing that followed you out of the realm stirs in your sea of consciousness — a shard of some long-dead immortal's will, watchful and patient. <Child,> it murmurs, in a voice like dust settling, <I have waited an age for a vessel. Walk with me, and I will give you a thousand years of my knowing.>",
    choices: [
      { label: "Commune with the remnant", result: (c, rng, A) => { E.disarmArc(c, "sealedwill"); arcSet(c, "sealedwill", 1, { path: "commune" }); cap(c, "comprehension", 2); A.note("Began communing with a sealed immortal's will."); return ["You lower your guard, just a little, and let the old will speak. Knowledge older than your sect washes through you — and a cold patience settles in behind your eyes, waiting. (+Comprehension)"]; } },
      { label: "Seal it away behind your dao heart", result: (c, rng, A) => { E.disarmArc(c, "sealedwill"); arcSet(c, "sealedwill", 99); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 6); cap(c, "soul", 2); return ["You will not share your own skull with a dead thing's ambition. With patient effort you wall the shard behind your dao heart, where it rages, and quiets, and at last goes still. (+Dao Heart, +Soul)"]; } },
    ],
  },
  {
    id: "sealedwill_pull", arc: true, weight: 20, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "sealedwill") === 1 && arcYears(c, "sealedwill") >= 2,
    text: () => "The sealed will has been generous — and each gift binds you a little tighter. Tonight it offers a true treasure of its knowing, and you feel how much of yourself it would cost to take it whole.",
    choices: [
      { label: "Take everything it offers", result: (c, rng, A) => { arcSet(c, "sealedwill", 2, { path: "deep" }); A.qi(0.9); cap(c, "comprehension", 4); return ["You open wide and drink it all down. Power and memory not your own flood your meridians — magnificent, intoxicating — and your own thoughts feel, for a moment, like a guest's in someone else's house. (+++Comprehension, +qi)"]; } },
      { label: "Take only what you can hold — and keep your self", result: (c, rng, A) => { arcSet(c, "sealedwill", 2, { path: "guarded" }); cap(c, "comprehension", 2); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 4); return ["You take a careful sip and no more, holding the line at the edge of your own name. The will is displeased — but you remain wholly, stubbornly yourself. (+Comprehension, +Dao Heart)"]; } },
    ],
  },
  {
    id: "sealedwill_climax", arc: true, weight: 30, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "sealedwill") === 2 && arcYears(c, "sealedwill") >= 2,
    speaker: () => "The Will, Unmasked",
    text: () => "The sealed will makes its move at last, surging up to seize the body it has fed so patiently. <Enough sipping, child. The vessel is ripe — and it was always going to be mine.> Your own hands no longer entirely answer you.",
    choices: [
      { label: "Wrestle it for your own soul", result: (c, rng, A) => {
        const deep = c.arcs.sealedwill && c.arcs.sealedwill.path === "deep"; arcSet(c, "sealedwill", 99);
        const ward = (c.daoHeart || 0) / 150 + c.soul / 400 - (deep ? 0.18 : -0.05);
        if (rng.random() < 0.45 + ward) {
          cap(c, "comprehension", 4); cap(c, "soul", 3); c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 6); A.note("Mastered a sealed immortal's will and made its knowing your own.");
          return ["You seize the intruding will in your own and *crush* it down, and in crushing it, claim it — its thousand years of knowing dissolve into yours, ownerless now, yours alone. You are wholly yourself, and so much more than you were."]
            .concat(E.acquireArtifact(c, E.randomArtifact(c, rng, "Heaven")))
            .concat(E.maybeAwardEpithet(c, rng, { base: 0.5 }));
        }
        c.daoHeart = Math.max(0, (c.daoHeart || 0) - 6); c.soul = Math.max(1, c.soul - 5); c.comprehension = Math.max(1, c.comprehension - 4); A.heal(-Math.round(c.maxHp * 0.3)); cap(c, "constitution", 0);
        return ["You hold the line — barely — and drive the will back into its shard, but the war leaves you torn. It cost you pieces of yourself you are not sure you will get back, and the shard, beaten, still whispers in the dark. (−Soul, −Comprehension, −Dao Heart, −health)"];
      } },
    ],
  },

  // — Sect Schism (宗门之变) — a power-struggle that finds an established disciple.
  {
    id: "schism_start", arc: true, weight: 4, minRealm: 3, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "schism") === 0 && !!c.sectKey && (c.sectRank || 0) >= 2,
    speaker: () => "A Conspirator at Your Door",
    text: c => `A Grand Elder of the ${E.sectName(c)} comes to your quarters by night, unannounced. "The Sect Master grows old and weak, and clutches the seat like a miser," they murmur. "Some of us mean to see the sect led by the strong again. A disciple of your standing must choose a side — tonight. Where do you stand?"`,
    choices: [
      { label: "Stand with the Sect Master", result: (c, rng, A) => { arcSet(c, "schism", 1, { path: "loyal" }); return ["You show the conspirator the door. \"The sect is not a prize to be seized.\" They leave with a cold nod — and now both factions know exactly where you stand. The mountain holds its breath."]; } },
      { label: "Join the rebel faction", result: (c, rng, A) => { arcSet(c, "schism", 1, { path: "rebel" }); A.karma(-4); return ["You clasp the elder's arm. Ambition answers ambition. In shadowed halls the rebels gather strength, and you among them — for a sect led by the strong has a place near its summit for those who helped it rise."]; } },
      { label: "Stay out of it and watch", result: (c, rng, A) => { arcSet(c, "schism", 1, { path: "neutral" }); cap(c, "soul", 1); return ["\"This is above an inner disciple,\" you demur, and keep your own counsel. Both sides mark you as uncommitted — useful, perhaps, or expendable. You will know soon which. (+Soul)"]; } },
    ],
  },
  {
    id: "schism_moot", arc: true, weight: 30, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "schism") === 1 && !c.sectKey,
    auto: (c, rng, A) => { arcSet(c, "schism", 99); return "Word reaches you that the schism you left behind has run its course without you — masters risen and fallen, the mountain reshaped. It is no longer your concern; you walk a different road now."; },
  },
  {
    id: "schism_resolve", arc: true, weight: 22, awakened: true, cooldown: 0,
    cond: c => arcStage(c, "schism") === 1 && arcYears(c, "schism") >= 2 && !!c.sectKey,
    text: c => `The long cold war within the ${E.sectName(c)} erupts into open blades. Disciples choose their sides on the duelling terraces, and the matter will be settled in qi and steel by nightfall. Your moment has come.`,
    choices: [
      { label: "Throw your strength behind your chosen side", result: (c, rng, A) => {
        const path = (c.arcs.schism && c.arcs.schism.path) || "neutral"; arcSet(c, "schism", 99);
        const foeName = path === "rebel" ? "a Loyalist Champion" : path === "loyal" ? "the Rebel Ringleader" : "a Desperate Combatant";
        const res = A.fight([foeName, A.power() * rng.uniform(1.0, 1.35), (c.realm + 1) * 8, "rogue"]);
        if (!c.alive) return [`Steel decides the day.`].concat(res);
        if (path === "loyal") { c.contribution = (c.contribution || 0) + 200; c.reputation += 8; if ((c.sectRank || 0) < 4) c.sectRank = (c.sectRank || 0) + 1; A.note("Defended the Sect Master through the schism."); res.push("The rebellion breaks against the loyalists, and you at the spear-point of it. The grateful Sect Master raises your rank and heaps contribution upon you. (+rank, +contribution, +Reputation)"); }
        else if (path === "rebel") { c.contribution = (c.contribution || 0) + 160; c.reputation += 4; A.karma(-6); if ((c.sectRank || 0) < 5) c.sectRank = Math.min(5, (c.sectRank || 0) + 2); A.note("Helped overthrow the old Sect Master."); res.push("The old master falls, and a new order rises with you high in its councils — bought with blood and a colder name. (++rank, +contribution, −Karma)"); }
        else { c.reputation += 3; if (rng.random() < 0.4 + c.charm / 250) { A.karma(6); res.push("As the factions exhaust themselves you step between them and broker a peace no one else could. Both sides owe you now. (+Karma, +Reputation)"); } else { c.contribution = Math.max(0, (c.contribution || 0) - 40); res.push("You survive the chaos but win no glory in it; a sect that remembers your fence-sitting is slow to reward you. (−contribution)"); } }
        return [`Blades flash across the terraces.`].concat(res);
      } },
    ],
  },

  // — The Reborn Bond (夙世之缘) — a soul you were bound to, returned in this life.
  {
    id: "rebornbond_start", arc: true, weight: 40, minAge: 14, awakened: true, cooldown: 0,
    cond: c => !!c.rebornBond && arcStage(c, "rebornbond") === 0,
    speaker: () => "A Face You Have Never Seen",
    text: c => c.rebornBond && c.rebornBond.kind === "love"
      ? "A stranger passes you in a market lane and the world tilts. You have never seen this face — and yet your heart cracks open with a grief and a tenderness that are not from this life. A name surfaces in you, unbidden, that you should have no way of knowing. The soul you loved most, in a life you do not remember, has been reborn into the turning of the wheel, the same as you."
      : "A stranger's eyes meet yours across a crowded square and you both go rigid, hackles up, hands drifting toward weapons you have not drawn — for no reason either of you could name. You have never met. And yet every instinct you own is screaming an old, old hatred. A soul you once warred with, lifetimes ago, walks the world again.",
    choices: [
      { label: c => c.rebornBond && c.rebornBond.kind === "love" ? "Approach them, and trust the ache" : "Approach the old enemy", cond: () => true, result: (c, rng, A) => {
        const bond = c.rebornBond; c.rebornBond = null; arcSet(c, "rebornbond", 99);
        if (bond && bond.kind === "love") {
          const n = A.meet("companion", { affinity: 45, sex: bond.sex === "female" ? "male" : bond.sex === "male" ? "female" : undefined });
          A.happy(10); A.note("Met a soul reborn from a past life's love.");
          return [`You cross the lane on legs not quite your own and simply say their old name. They turn, startled — and something behind their eyes wakes and *knows* you, even if their mind cannot. A bond two lifetimes deep rekindles in an afternoon. (${n ? n.name : "A new love"} — court them, and a dao companion they may again become.)`];
        }
        const nem = A.makeNemesis("a war fought and lost across the wheel of two lifetimes");
        A.happy(-2);
        return [`You stride up and name them, and the old enemy's lip curls though they cannot say why. "I don't know you," they grind out. "But I am going to enjoy this." The grudge of a forgotten lifetime takes up exactly where it left off. (${nem ? nem.name : "An old foe"} is reborn as your nemesis — settle it in Adventure.)`];
      } },
      { label: c => c.rebornBond && c.rebornBond.kind === "love" ? "Let the past rest, and walk on" : "Let the old grudge die unfought", result: (c, rng, A) => {
        const love = c.rebornBond && c.rebornBond.kind === "love"; c.rebornBond = null; arcSet(c, "rebornbond", 99);
        c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + 5); cap(c, "soul", 2);
        if (love) { A.happy(-3); return ["You close your hand around the ache and let them pass, a stranger to a stranger. Some loves are meant for one life only; carrying them into the next is a weight no soul should bear. You walk on, lighter and emptier both. (+Dao Heart, +Soul)"]; }
        A.karma(6); return ["You unclench your fist and let the nameless hatred drain out of you. Whatever was between you belonged to two people who are both long dead. You give the stranger a small nod and walk away, a lifetime's grudge finally laid down. (+Karma, +Dao Heart)"];
      } },
    ],
  },
];

/* ----------------------- eligibility & rolling --------------------------- */
// Years a repeatable event must wait before it can fire again (overridable per
// event via `cooldown`). Keeps the same card from showing up over and over.
const DEFAULT_COOLDOWN = 8;

function eligible(c, e) {
  if (!c.alive) return false;
  if (e.minAge != null && c.age < e.minAge) return false;
  if (e.maxAge != null && c.age > e.maxAge) return false;
  if (e.minRealm != null && c.realm < e.minRealm) return false;
  if (e.maxRealm != null && c.realm > e.maxRealm) return false;
  if (e.awakened === true && !c.awakened) return false;
  if (e.awakened === false && c.awakened) return false;
  if (e.once === true && (c.firedEvents || []).includes(e.id)) return false;
  // Cooldown: don't refire until enough years have passed.
  const last = (c.eventCooldowns || {})[e.id];
  if (last != null && c.age - last < (e.cooldown != null ? e.cooldown : DEFAULT_COOLDOWN)) return false;
  if (e.cond && !e.cond(c)) return false;
  return true;
}

/* ---------------------- branching dialogue framework --------------------- *
 * A choice's result(c,rng,A) may return either:
 *   - terminal narration: a string or string[] (the conversation ends), OR
 *   - a follow-on dialogue NODE to continue the exchange:
 *       { speaker?, text, choices:[ { label, cond?, result } ] }
 * Nodes can nest arbitrarily, so events become real multi-step conversations
 * with named speakers and player agency at every turn. A node's `speaker`,
 * `text` and a choice's `label` may each be a plain value or a (c)=>value. A
 * choice may carry a `cond(c)` to show only when relevant. This is fully
 * backward compatible: existing results return strings and simply terminate. */
const isDialogueNode = r => r && typeof r === "object" && !Array.isArray(r) && Array.isArray(r.choices);
function presentNode(node, c, rng, A) {
  return {
    speaker: typeof node.speaker === "function" ? node.speaker(c) : node.speaker,
    text: typeof node.text === "function" ? node.text(c) : node.text,
    dialogue: true,
    choices: node.choices.filter(ch => !ch.cond || ch.cond(c)).map(ch => ({
      label: typeof ch.label === "function" ? ch.label(c) : ch.label,
      fn: () => resolveResult(ch.result(c, rng, A), c, rng, A),
    })),
  };
}
// Normalize a result into either a presentation node or terminal string[].
function resolveResult(r, c, rng, A) {
  return isDialogueNode(r) ? presentNode(r, c, rng, A) : (Array.isArray(r) ? r : [r]);
}

function instantiate(c, rng, A, e) {
  if (!c.firedEvents) c.firedEvents = [];
  if (!c.eventCooldowns) c.eventCooldowns = {};
  c.eventCooldowns[e.id] = c.age;
  if (e.once === true && !c.firedEvents.includes(e.id)) c.firedEvents.push(e.id);
  const text = typeof e.text === "function" ? e.text(c) : e.text;
  if (e.choices) {
    return {
      id: e.id, text,
      speaker: typeof e.speaker === "function" ? e.speaker(c) : e.speaker,
      choices: e.choices.filter(ch => !ch.cond || ch.cond(c)).map(ch => ({
        label: typeof ch.label === "function" ? ch.label(c) : ch.label,
        fn: () => resolveResult(ch.result(c, rng, A), c, rng, A),
      })),
    };
  }
  // Auto event: resolve immediately and attach its narration.
  const out = e.auto(c, rng, A);
  return { id: e.id, auto: true, text: Array.isArray(out) ? out : [out] };
}

// When no scripted card is due (all on cooldown), the year still turns with
// small but real stakes — a sliver of insight, a lucky find, a minor hurt — so
// no year passes without moving the character mechanically, not just narratively.
export function quietYearEvent(c, rng, A) {
  const opts = [];
  const awakened = c.awakened && c.root && c.root.key !== "none";
  if (awakened) {
    opts.push(() => { A.qi(rng.uniform(0.05, 0.12)); return "A quiet year of seclusion. Sitting long with your breath, a sliver of insight settles into your dantian. (qi deepens)"; });
    opts.push(() => {
      const techs = (c.techniques || []).filter(t => D.TECHNIQUES[t]);
      if (!techs.length) { A.qi(0.06); return "You drill your forms through the seasons; the patient work settles deeper into you."; }
      const t = techs[Math.floor(rng.random() * techs.length)];
      c.mastery = c.mastery || {}; const g = rng.randint(3, 7);
      c.mastery[t] = (c.mastery[t] || 0) + g;
      return `You drill quietly through the seasons; ${D.TECHNIQUES[t][0]} grows surer in your hands. (+${g} mastery)`;
    });
    opts.push(() => { if (c.soul < 160) { cap(c, "soul", 1); return "Long nights of meditation widen your spiritual sense. (+Soul Sense)"; } A.qi(0.05); return "Season upon season, the dao deepens by slow degrees."; });
  }
  opts.push(() => { const h = rng.randint(2, 6) + (c.realm || 0); A.herbs(h); return `Foraging the hills through a slow year, you gather ${h} spirit herbs.`; });
  opts.push(() => { const s = rng.randint(3, 9) * ((c.realm || 0) + 1); A.stones(s); return `Odd work and small trades at the markets set aside ${s} spirit stones.`; });
  opts.push(() => { A.happy(rng.randint(3, 7)); return "A peaceful, contented year — good company, clear skies, and time simply to be."; });
  opts.push(() => { A.heal(-rng.randint(4, 9)); A.happy(-2); return "A nagging ailment dogs you for months, sapping your strength before it finally passes. (health)"; });
  opts.push(() => {
    if (rng.random() < 0.5 && c.constitution < 160) { c.constitution = Math.min(160, c.constitution + 1); return (awakened ? "Hard daily training tempers your body through the year." : "A year of chores and rough play leaves you sturdier.") + " (+Constitution)"; }
    if (c.comprehension < 160) { cap(c, "comprehension", 1); return "You pester every passing elder with questions and turn their answers over for months. (+Comprehension)"; }
    A.happy(4); return "An ordinary, untroubled year passes.";
  });
  return opts[Math.floor(rng.random() * opts.length)]();
}

export function rollYearEvents(c, rng, A) {
  const out = [];
  const draw = pool => { if (pool.length) out.push(instantiate(c, rng, A, rng.choices(pool, pool.map(e => e.weight || 1)))); };
  // 1) A due storyline beat takes priority, so multi-year arcs progress reliably
  //    rather than being lost in the weighted shuffle of ordinary events.
  draw(EVENTS.filter(e => e.arc && eligible(c, e)));
  // 2) An ordinary life event (never a second arc beat in the same year).
  if (c.alive) draw(EVENTS.filter(e => !e.arc && eligible(c, e) && !out.some(o => o.id === e.id)));
  // 3) A modest chance of one more, different event.
  if (c.alive && rng.random() < 0.3) draw(EVENTS.filter(e => !e.arc && eligible(c, e) && !out.some(o => o.id === e.id)));
  // No scripted card came due — let a small, mechanically real "quiet year" stand
  // in, so every single year carries a consequence rather than empty flavour.
  if (c.alive && !out.length) out.push({ id: "quiet_" + c.age, auto: true, text: [quietYearEvent(c, rng, A)] });
  return out;
}

/* ---------------------- multi-year storyline arcs ------------------------ *
 * Some encounters open a saga that plays out over several years: a choice now
 * sets an arc's stage, and a later beat (gated on that stage and the years
 * elapsed) continues it, branching on what you chose before. Arc state lives in
 * c.arcs[id] = { stage, since, ...flags }. Arc-flagged events (`arc: true`) are
 * drawn with priority so a storyline you are living through reliably advances. */
export const arcOf = (c, id) => (c.arcs && c.arcs[id]) || null;
export const arcStage = (c, id) => { const a = arcOf(c, id); return a ? a.stage : 0; };
export const arcYears = (c, id) => { const a = arcOf(c, id); return a ? c.age - (a.since != null ? a.since : c.age) : 0; };
export function arcSet(c, id, stage, extra) {
  if (!c.arcs) c.arcs = {};
  c.arcs[id] = Object.assign({}, c.arcs[id], extra || {}, { stage, since: c.age });
  return c.arcs[id];
}
export function arcEnd(c, id) { if (c.arcs && c.arcs[id]) delete c.arcs[id]; }
// Find a recurring arc NPC (tagged when the arc created it).
const arcNpc = (c, tag) => (c.relationships || []).find(n => n.arcTag === tag && n.alive) || null;

