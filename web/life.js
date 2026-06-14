/* The Nine Heavens -- BitLife-style life layer: birth into a family, the
 * year-by-year "age up" loop with narrative events, the spiritual-root
 * awakening, vitals (health & happiness), activities and relationships. */

import * as E from "./engine.js";
import * as D from "./data.js";
import { rollYearEvents } from "./events.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap = (c, k, v) => { c[k] = Math.min(160, c[k] + v); };
function note(c, t) { c.log.push([c.age, t]); }

/* ----------------------------- birth ------------------------------------- */
function augment(c, rng, sex) {
  c.sex = sex || (rng.random() < 0.5 ? "female" : "male");
  c.happiness = clampN(55 + rng.randint(-10, 15), 0, 100);
  c.health = clampN(60 + Math.floor(c.constitution / 4) + rng.randint(-5, 10), 0, 100);
  c.awakened = false;
  c.firedEvents = [];
  c.mastery = c.mastery || {};
  c.region = c.region || "azuredomain";
  if (c.abode == null) c.abode = 0;
  if (c.abodeRegion == null) c.abodeRegion = null;
  if (c.ownSect === undefined) c.ownSect = null;
  generateFamily(c, rng);
  return c;
}

export const getNemesis = c => c.relationships.find(n => n.role === "nemesis" && n.alive) || null;
function makeNemesis(c, rng, grudge) {
  if (getNemesis(c)) return getNemesis(c);
  const n = mkNpc("nemesis", E.npcName(rng), -45);
  n.kin = "Nemesis"; n.grudge = grudge || "an old slight you barely remember";
  n.power = E.basePower(c) * rng.uniform(1.05, 1.25) + 2;
  n.element = rng.choice([...D.ELEMENTS, "Dark", "Lightning"]);
  n.encounters = 0;
  c.relationships.push(n);
  note(c, `${n.name} becomes your sworn nemesis.`);
  return n;
}

export function bornCharacter(rng, name, sex, opts) {
  return augment(E.generateCharacter(rng, name, opts || {}), rng, sex);
}

export function reincarnateLife(old, rng, name) {
  const c = E.reincarnate(old, rng, name);
  augment(c, rng);
  // The arts you passed to students and kin echo across the wheel of rebirth.
  const inherited = old.relationships.reduce((a, n) => a + ((n.learned && n.learned.length) || 0), 0);
  if (inherited) {
    c.comprehension = Math.min(160, c.comprehension + Math.min(20, inherited * 2));
    note(c, `The arts you passed to ${inherited} student(s) in a former life sharpen your innate insight. (+Comprehension)`);
  }
  return c;
}

// Free social action (no year cost): go out and meet someone new.
export function mingle(c, rng) {
  const pull = c.charm + (["striking", "peerless", "immortal"].includes(c.appearanceKey) ? 20 : 0);
  const roll = rng.random();
  // Romance only blooms once you've come of age.
  if (c.age >= 16 && roll < 0.22 + pull / 500 && !c.relationships.some(n => n.role === "companion" && n.alive)) {
    const n = meetPerson(c, rng, "companion", { affinity: 18 + Math.floor(pull / 7) });
    c.happiness = clampN(c.happiness + 6, 0, 100);
    return [`✦ You cross paths with ${n.name}, and a spark kindles. A potential dao companion.`];
  }
  if (roll < 0.65) {
    const n = meetPerson(c, rng, "friend", { affinity: 14 + Math.floor(c.charm / 9) });
    c.happiness = clampN(c.happiness + 4, 0, 100);
    return [`You fall into easy conversation with ${n.name}; a friendship forms.`];
  }
  const n = meetPerson(c, rng, "enemy", { affinity: -28 });
  return [`A careless word earns you the lasting enmity of ${n.name}.`];
}

function mkNpc(role, name, affinity) {
  return { name, role, affinity, power: 0, alive: true };
}

function generateFamily(c, rng) {
  const surname = c.name.split(" ")[0];
  const prof = D.PARENT_PROFILE[c.backgroundKey] || ["a commoner", "a commoner", 0];
  const newKin = (kin, occ, realm, aff) => {
    const n = mkNpc("family", `${surname} ${E.givenName(rng)}`, aff);
    n.kin = kin; n.occupation = occ; n.realm = realm; return n;
  };
  if (c.backgroundKey === "beggar") {
    // An orphan of the gutter -- no known parents, but a fellow stray.
    c.relationships.push(Object.assign(mkNpc("friend", `${E.givenName(rng)}`, 30), { kin: "Fellow Orphan" }));
  } else if (c.backgroundKey === "slave") {
    c.relationships.push(newKin("Mother", prof[1], 0, rng.randint(65, 85)));
  } else {
    c.relationships.push(newKin("Father", prof[0], prof[2], rng.randint(55, 80)));
    c.relationships.push(newKin("Mother", prof[1], Math.max(0, prof[2] - 1), rng.randint(60, 85)));
  }
  if (rng.random() < 0.45) {
    const sib = newKin(rng.random() < 0.5 ? "Brother" : "Sister", "a fellow child", 0, rng.randint(40, 70));
    c.relationships.push(sib);
  }
}

/* ------------------------- vitals & helpers ------------------------------ */
function clampVitals(c) {
  c.happiness = clampN(c.happiness, 0, 100);
  c.health = clampN(c.health, 0, 100);
}
function advanceStages(c) {
  while (c.qi >= E.qiToNext(c) && c.stage < E.realmStages(c) - 1) {
    c.qi -= E.qiToNext(c); c.stage += 1; E.recomputeMaxHp(c);
  }
}
function learnRandomTech(c, rng) {
  const unknown = Object.keys(D.TECHNIQUES).filter(k => !c.techniques.includes(k));
  if (!unknown.length) return null;
  const t = rng.choice(unknown); c.techniques.push(t); return D.TECHNIQUES[t][0];
}
function meetPerson(c, rng, role, opts = {}) {
  const surname = c.name.split(" ")[0];
  const name = (opts.kin && ["Son", "Daughter"].includes(opts.kin))
    ? `${surname} ${E.givenName(rng)}` : E.npcName(rng);
  const n = mkNpc(role, name, opts.affinity != null ? opts.affinity : 20);
  n.power = E.power(c) * rng.uniform(0.5, 1.4);
  if (opts.kin) n.kin = opts.kin;
  if (opts.born != null) n.born = opts.born;
  c.relationships.push(n);
  return n;
}

function makeApi(c, rng) {
  return {
    happy: n => { c.happiness = clampN((c.happiness || 0) + n, 0, 100); },
    heal: n => { c.health = clampN((c.health || 0) + n, 0, 100); },
    stones: n => { c.spiritStones = Math.max(0, c.spiritStones + n); },
    herbs: n => { c.herbs = Math.max(0, c.herbs + n); },
    karma: n => { c.karma += n; },
    qi: frac => { c.qi += E.qiToNext(c) * frac; advanceStages(c); },
    note: t => note(c, t),
    power: () => E.power(c),
    fight: enemy => E.fight(c, rng, enemy),
    giveArtifact: grade => E.acquireArtifact(c, E.randomArtifact(c, rng, grade)),
    learnTech: () => learnRandomTech(c, rng),
    meet: (role, opts) => meetPerson(c, rng, role, opts),
    kin: label => c.relationships.find(n => n.kin === label && n.alive) || null,
    kinAdjust: (label, d) => { const n = c.relationships.find(x => x.kin === label && x.alive); if (n) n.affinity = clampN(n.affinity + d, -100, 100); },
    makeNemesis: grudge => makeNemesis(c, rng, grudge),
    nemesis: () => getNemesis(c),
  };
}

/* --------------------------- the awakening ------------------------------- */
function awakeningInstance(c, rng, A) {
  c.awakened = true;
  if (!c.firedEvents.includes("awakening")) c.firedEvents.push("awakening");
  const tier = D.ROOT_TIER[c.root.key] || 0;
  const lines = [
    `The Spiritual Root Awakening (测灵根). At age ${c.age}, the village elder presses a cold jade testing-stone to your palm before the whole gathered clan.`,
  ];
  if (c.root.key === "none") {
    lines.push(`The stone stays dull and grey. You have no spiritual root. The road to immortality is sealed to you — you will live and die a mortal.`);
    A.happy(-20); A.kinAdjust("father", -6); A.kinAdjust("mother", -4);
    lines.push("Your parents' faces fall. Whispers of pity follow you home.");
  } else if (tier <= 1) {
    lines.push(`A faint, muddy glow: ${c.root.display}. A poor foundation. No recruiter will come for this — but the door, at least, is not shut.`);
    A.happy(-4);
  } else if (tier <= 3) {
    lines.push(`The stone shines clean and bright: ${c.root.display}! A genuine talent. The clan buzzes; perhaps a sect will take notice.`);
    A.happy(10); c.reputation += 4; A.kinAdjust("father", 6); A.kinAdjust("mother", 6);
  } else {
    lines.push(`The stone BLAZES like a captured sun: ${c.root.display}!! Gasps ripple through the crowd. A child of destiny, born once in a generation.`);
    A.happy(20); c.reputation += 15; A.kinAdjust("father", 10); A.kinAdjust("mother", 10);
    lines.push("By nightfall, envoys from three sects are racing toward your village.");
  }
  return { id: "awakening", auto: true, text: lines, milestone: true };
}

/* ------------------------------ age up ----------------------------------- */
export function ageUp(c, rng) {
  if (!c.alive) return { events: [] };
  const A = makeApi(c, rng);
  c.age += 1;
  const events = [];

  // A full natural year of background cultivation, once your root has awakened.
  // This (scaled by your spiritual root) is the main driver of progress, so
  // lifespan stays the binding constraint and talent decides how far you climb.
  if (c.awakened && c.root) {
    const gain = E.cultivationSpeed(c) * rng.uniform(0.85, 1.15);
    c.qi += gain;
    advanceStages(c);
    if (c.sectKey) c.spiritStones += D.SECT_RANKS[c.sectRank][4];
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.5);
  }

  // Your cave abode yields herbs and stones — scaled by its region's wildness,
  // its resident disciples (who tend the fields) and a foraging spirit beast.
  abodeYearly(c, rng, events);

  // A sect you founded gathers members and prestige, spreads your name, and pays
  // you a stipend from its treasury (its seat is your abode).
  sectYearly(c, rng, events);

  // Your nemesis cultivates too, always shadowing your strength.
  const nem = getNemesis(c);
  if (nem) nem.power = Math.max(nem.power * 1.03, E.basePower(c) * rng.uniform(1.0, 1.18));

  // Vitals drift gently; old age erodes health.
  c.happiness = clampN(c.happiness + rng.randint(-2, 2), 0, 100);
  if (c.age > c.maxAge * 0.85) c.health = clampN(c.health - rng.randint(0, 3), 0, 100);
  else c.health = clampN(c.health + rng.randint(-1, 2), 0, 100);

  // Milestone: the spiritual-root awakening.
  if (!c.awakened && c.age >= D.AWAKENING_AGE) events.push(awakeningInstance(c, rng, A));

  // Random life events.
  for (const ev of rollYearEvents(c, rng, A)) events.push(ev);

  // Family ages too -- elderly mortal kin may pass away.
  ageFamily(c, rng, events);

  // Death checks.
  if (c.alive) {
    if (c.health <= 0) {
      c.alive = false; c.causeOfDeath = "failing health"; note(c, "Died of failing health.");
    } else if (c.age > c.maxAge && rng.random() > (c.luck + c.soul) / 400.0) {
      c.alive = false; c.causeOfDeath = "old age, lifespan exhausted"; note(c, "Died of old age.");
    }
  }
  clampVitals(c);
  return { events };
}

function ageFamily(c, rng, events) {
  for (const n of c.relationships) {
    if (n.role === "family" && n.alive && (n.kin === "Father" || n.kin === "Mother")) {
      // Mortal or low-realm kin grow old over decades.
      const lifespan = 70 + (n.realm || 0) * 40;
      const elapsed = c.age - (n.born || 0);
      if (c.age > 30 && rng.random() < 0.012 * Math.max(1, c.age / 30) && (n.realm || 0) < 3) {
        n.alive = false;
        c.happiness = clampN(c.happiness - 15, 0, 100);
        note(c, `${n.name} (${n.kin}) passed away.`);
        events.push({ id: "kin_death_" + n.name, auto: true, text: [`Word reaches you: ${n.name}, your ${n.kin.toLowerCase()}, has died of old age. You burn incense and grieve a mortal's brief candle.`] });
      }
    }
  }
}

/* ---------------------------- activities --------------------------------- */
// Activities cost a year and shift vitals; they are the BitLife "do something".

export function trainBody(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You spend the year drilling your body to exhaustion — forms, stances, iron-shirt conditioning."];
  if (rng.random() < 0.6) { cap(c, "constitution", rng.randint(1, 3)); E.recomputeMaxHp(c); msgs.push("Your physique hardens. (+Constitution)"); }
  c.health = clampN(c.health + 4, 0, 100); c.happiness = clampN(c.happiness - 2, 0, 100);
  finishYear(c, rng, msgs);
  return msgs;
}
export function studyScriptures(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You bury yourself in the sect library / borrowed scrolls, parsing dense dao theory."];
  if (rng.random() < 0.6) { cap(c, "comprehension", rng.randint(1, 3)); msgs.push("Insight blooms. (+Comprehension)"); }
  c.happiness = clampN(c.happiness - 1, 0, 100);
  finishYear(c, rng, msgs);
  return msgs;
}
export function restAndRecover(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  c.health = clampN(c.health + 14, 0, 100); c.happiness = clampN(c.happiness + 10, 0, 100);
  if (c.hp < c.maxHp) c.hp = c.maxHp;
  const msgs = ["You take a year of rest — hot springs, good food, easy days. Body and mind mend."];
  finishYear(c, rng, msgs);
  return msgs;
}
export function oddJobs(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const earn = rng.randint(3, 10) * (c.realm + 1);
  c.spiritStones += earn; c.happiness = clampN(c.happiness - 2, 0, 100);
  const msgs = [`You take mortal work and odd errands for a year, scraping together ${earn} spirit stones.`];
  finishYear(c, rng, msgs);
  return msgs;
}
export function trainTechnique(c, rng, techKey) {
  if (!c.alive) return ["You are dead."];
  if (!c.mastery) c.mastery = {};
  c.age += 1;
  const gain = rng.randint(6, 12) + Math.floor(c.comprehension / 12);
  const before = D.masteryRank(c.mastery[techKey] || 0)[0];
  c.mastery[techKey] = (c.mastery[techKey] || 0) + gain;
  c.happiness = clampN(c.happiness - 2, 0, 100);
  const name = D.TECHNIQUES[techKey][0];
  const rank = D.masteryRank(c.mastery[techKey]);
  const msgs = [`You drill ${name} relentlessly for a year. (+${gain} mastery)`];
  if (rank[0] !== before) msgs.push(`  ✦ ${name} advances to ${rank[0]} (+${Math.round(rank[2] * 100)}% effect)!`);
  finishYear(c, rng, msgs);
  return msgs;
}

function finishYear(c, rng, msgs) {
  if (c.health <= 0 && c.alive) { c.alive = false; c.causeOfDeath = "failing health"; msgs.push("☠ Your health gives out entirely. You die."); note(c, "Died of failing health."); return; }
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age, lifespan exhausted"; msgs.push(`☠ Your lifespan ends at ${c.age}.`); note(c, "Died of old age."); }
}

/* --------------------- free relationship interactions -------------------- */
// These do NOT cost a year (BitLife-style); they shift affinity and mood.

const teachableTechs = c => c.techniques.filter(t => t !== "basic_breathing");
export const getDisciples = c => c.relationships.filter(n => n.role === "disciple" && n.alive);

export function relationActions(c, npc) {
  if (npc.role === "nemesis") {
    return [
      { id: "taunt", label: "Trade barbs" },
      { id: "duel", label: "Settle the rivalry (showdown)" },
    ];
  }
  if (npc.role === "disciple") {
    const acts = [{ id: "talk", label: "Check on your disciple" }];
    if (teachableTechs(c).length) acts.push({ id: "teach", label: "Teach a technique" });
    acts.push({ id: "gift", label: "Give a gift (5 stones)" });
    acts.push({ id: "spar", label: "Spar" });
    return acts;
  }
  const acts = [];
  acts.push({ id: "talk", label: npc.role === "family" ? "Spend time together" : "Converse" });
  if ((npc.role === "companion" || npc.kin === "Son" || npc.kin === "Daughter") && teachableTechs(c).length)
    acts.push({ id: "teach", label: "Teach a technique" });
  if (npc.role !== "enemy") acts.push({ id: "gift", label: "Give a gift (5 stones)" });
  if (npc.role === "family" && (npc.realm || 0) >= 2) acts.push({ id: "guidance", label: "Seek their guidance" });
  if (npc.role === "family" && (c.backgroundKey === "noble" || c.backgroundKey === "royal")) acts.push({ id: "askhelp", label: "Ask for resources" });
  if (npc.role === "rival" || npc.role === "friend") acts.push({ id: "spar", label: "Spar" });
  if (npc.role === "companion") acts.push({ id: "dual", label: "Dual cultivate" });
  if ((npc.role === "companion" || npc.role === "disciple") && (c.abode || 0) > 0)
    acts.push(npc.resides ? { id: "sendaway", label: "Have them leave your abode" } : { id: "invite", label: "Invite to live at your abode" });
  if (npc.role === "enemy") { acts.push({ id: "insult", label: "Threaten them" }); acts.push({ id: "reconcile", label: "Make peace" }); acts.push({ id: "duel", label: "Challenge to a duel" }); }
  return acts;
}

export function doRelationAction(c, npc, action, rng) {
  const adj = d => { npc.affinity = clampN(npc.affinity + d, -100, 100); };
  const happy = n => { c.happiness = clampN(c.happiness + n, 0, 100); };
  switch (action) {
    case "taunt": adj(-rng.randint(2, 6)); happy(rng.random() < 0.5 ? 2 : -2); return [`You and ${npc.name} trade venomous barbs over your old grudge (${npc.grudge}). The rivalry sharpens.`];
    case "talk": adj(rng.randint(3, 8)); happy(2); return [`You spend a warm while with ${npc.name}. (${E.npcStatus(npc)})`];
    case "gift":
      if (c.spiritStones < 5) return ["You cannot spare even 5 spirit stones."];
      c.spiritStones -= 5; adj(rng.randint(6, 12)); happy(2);
      return [`You gift ${npc.name} spirit stones. They are touched. (${E.npcStatus(npc)})`];
    case "guidance": {
      adj(2);
      if (rng.random() < 0.5) { cap(c, "comprehension", 1); return [`${npc.name} shares hard-won cultivation wisdom. (+Comprehension)`]; }
      return [`${npc.name} tells old stories of the family's cultivators.`];
    }
    case "askhelp":
      if (rng.random() < 0.6) { const g = rng.randint(20, 80); c.spiritStones += g; adj(-2); return [`Your influential family sends ${g} spirit stones — with a lecture about responsibility.`]; }
      return [`Your family refuses to coddle you further. "Stand on your own feet."`];
    case "spar": {
      const win = E.power(c) * rng.uniform(0.85, 1.2) >= npc.power * rng.uniform(0.85, 1.2);
      adj(win ? rng.randint(2, 6) : rng.randint(-3, 2)); happy(1);
      return [win ? `You best ${npc.name} in a friendly bout; they respect you for it.` : `${npc.name} gets the better of you. Humbling, but instructive.`];
    }
    case "dual": adj(rng.randint(3, 7)); happy(4); return [`You and ${npc.name} share a tender, quiet hour. Your bond deepens. (${E.npcStatus(npc)})`];
    case "invite": npc.resides = true; adj(rng.randint(4, 8)); happy(3); return [`${npc.name} moves into your cave abode. ${npc.role === "disciple" ? "They will tend its spirit fields and grow in its dense qi." : "It feels far more like a home now."}`];
    case "sendaway": npc.resides = false; adj(-rng.randint(1, 3)); return [`${npc.name} packs their things and leaves your abode.`];
    case "insult": adj(-rng.randint(4, 10)); happy(1); return [`You hurl threats at ${npc.name}. The feud festers.`];
    case "reconcile":
      if (rng.random() < 0.35 + c.charm / 300) { npc.role = "friend"; npc.affinity = 15; return [`Against all odds, ${npc.name} accepts your olive branch. Enemy becomes friend.`]; }
      adj(-3); return [`${npc.name} spits at your feet. Some grudges do not heal.`];
    case "duel": {
      const res = ["You challenge " + npc.name + " to settle things with qi and steel!"].concat(E.fight(c, rng, [npc.name, npc.power, (c.realm + 1) * 6, "rogue"]));
      if (c.alive && rng.random() < 0.6) { npc.alive = false; res.push(`You defeat ${npc.name} and end the feud for good.`); }
      return res;
    }
    default: return ["Nothing happens."];
  }
}

// Take a disciple to carry your arts onward (free; Golden Core and up).
export function takeDisciple(c, rng) {
  if (c.realm < 4) return ["You must reach the Golden Core before any youth will kneel to you as master."];
  if (getDisciples(c).length >= 3) return ["You already shepherd three disciples — enough for any master."];
  const n = mkNpc("disciple", E.npcName(rng), 55);
  n.kin = "Disciple"; n.power = E.power(c) * rng.uniform(0.2, 0.45); n.learned = [];
  c.relationships.push(n);
  c.happiness = clampN(c.happiness + 4, 0, 100);
  note(c, `Took ${n.name} as a disciple.`);
  return [`You take ${n.name} under your wing as a disciple. They kowtow three times, eyes brimming.`];
}

// Pass one of your techniques to a child / disciple / dao companion (free).
export function teachTo(c, npc, techKey) {
  npc.learned = npc.learned || [];
  const name = D.TECHNIQUES[techKey] ? D.TECHNIQUES[techKey][0] : techKey;
  if (npc.learned.includes(techKey)) return [`${npc.name} has already mastered ${name}.`];
  npc.learned.push(techKey);
  npc.power = (npc.power || E.power(c) * 0.4) * 1.15 + 5;
  npc.affinity = clampN(npc.affinity + 10, -100, 100);
  c.happiness = clampN(c.happiness + 5, 0, 100);
  c.karma += 1;
  note(c, `Taught ${name} to ${npc.name}.`);
  return [`You pass on ${name} to ${npc.name}. They train day and night to honour the gift. (+Happiness, +Karma)`];
}

/* ----------------------------- cave abode -------------------------------- */
// Who lives at your abode — a dao companion, taken-in disciples — found via the
// `resides` flag on a relationship, so it all lives inside c.relationships.
export const abodeResidents = c => c.relationships.filter(n => n.alive && n.resides);
export const abodeRegionKey = c => c.abodeRegion || c.region || "azuredomain";

// The abode's yearly bounty, drawn from its grade, its region's wildness, the
// disciples who tend its fields and a foraging spirit beast.
function abodeYearly(c, rng, events) {
  const abode = D.abodeAt(c.abode || 0);
  if (!abode) return;
  const reg = D.REGION_BY_KEY[abodeRegionKey(c)];
  const danger = reg ? reg[3] : 1;                       // wilder veins yield more
  let herbs = abode[5], stones = abode[6];
  const residents = abodeResidents(c);
  const tenders = residents.filter(n => n.role === "disciple").length;
  if (tenders) herbs += tenders * Math.max(1, Math.round(abode[5] * 0.3));   // disciples tend the herb fields
  if (c.beast && c.beast.alive) { herbs += 1 + Math.floor((c.abode || 0) / 2); stones += Math.floor(c.abode || 0); }  // beast forages
  c.herbs += Math.round(herbs * danger);
  c.spiritStones += Math.round(stones * danger);
  // Living among your own spirit vein steadies the heart; resident disciples
  // grow stronger in the abode's dense qi.
  if (residents.some(n => n.role === "companion")) c.happiness = clampN(c.happiness + 1, 0, 100);
  for (const d of residents) if (d.role === "disciple") d.power = (d.power || 1) * 1.015;
}

// Establish a new abode or upgrade your existing one (administrative — no year,
// no deed; you simply spend the stones). Returns narration lines.
export function upgradeAbode(c) {
  const next = D.abodeNext(c.abode || 0);
  if (!next) return ["Your abode is already a Cave Heaven — the very pinnacle. There is nothing higher to build."];
  if (c.spiritStones < next[3]) return [`You need ${next[3]} spirit stones to ${c.abode ? "expand your abode into" : "establish"} the ${next[1]}. (You have ${c.spiritStones}.)`];
  const was = c.abode || 0;
  c.spiritStones -= next[3];
  c.abode = next[0];
  if (!was) c.abodeRegion = c.region || "azuredomain";   // an abode is rooted where you raise it
  note(c, `${was ? "Upgraded your abode to" : "Established"} the ${next[1]} (${next[2]}).`);
  const reg = D.REGION_BY_KEY[abodeRegionKey(c)];
  const where = was ? "" : ` in the ${reg ? reg[1] : "wilds"}`;
  return [`${was ? "You pour resources into the works, and your abode rises into" : "You stake your claim on a spirit vein" + where + " and raise"} the ${next[1]} (${next[2]})! Each year it now yields ${next[5]} spirit herbs and ${next[6]} stones${reg && reg[3] > 1 ? ` (×${reg[3]} for the wild region)` : ""}, and quickens your cultivation by +${Math.round(next[4] * 100)}%.`];
}

// Seclude yourself in your abode for a stronger bout of cultivation (a deed; the
// burst is ageless, like Focused Cultivation, but its intensity scales with the
// abode's grade). A resident dao companion makes it dual cultivation. Uses a
// Qi-Gathering Pill if available and asked.
export function secludeInAbode(c, rng, usePill = false) {
  const abode = D.abodeAt(c.abode || 0);
  if (!abode) return ["You have no abode to seclude yourself in. Establish one first."];
  const mate = abodeResidents(c).find(n => n.role === "companion");
  const intensity = abode[7] * (mate ? 1.15 : 1);
  const msgs = [mate
    ? `You and ${mate.name} seal yourselves within your ${abode[1]} and cultivate as one, qi entwined.`
    : `You seal the entrance of your ${abode[1]} and sink into deep seclusion.`];
  if (mate) { c.happiness = clampN(c.happiness + 3, 0, 100); mate.affinity = clampN(mate.affinity + 2, -100, 100); }
  return msgs.concat(E.gainQi(c, rng, intensity, usePill));
}

/* --------------------------- your own sect ------------------------------- */
export const FOUND_SECT_MIN_REALM = 5;     // Nascent Soul — a recognized power
export const FOUND_SECT_MIN_ABODE = 3;     // Spirit-Gathering Abode — a worthy seat
export const FOUND_SECT_COST = 500;        // founding rites, halls, jade tokens

export const sectCapacity = c => D.SECT_CAPACITY[Math.min(D.SECT_CAPACITY.length - 1, c.abode || 0)] || 0;
export function canFoundSect(c) {
  return c.alive && c.awakened && !c.sectKey && !c.ownSect &&
    c.realm >= FOUND_SECT_MIN_REALM && (c.abode || 0) >= FOUND_SECT_MIN_ABODE;
}
export function foundSectReason(c) {
  if (c.ownSect) return `You already lead the ${c.ownSect.name}.`;
  if (c.sectKey) return "Leave your current sect before raising your own banner.";
  if (c.realm < FOUND_SECT_MIN_REALM) return `The world heeds only the strong: reach the ${D.REALMS[FOUND_SECT_MIN_REALM][0]} realm first.`;
  if ((c.abode || 0) < FOUND_SECT_MIN_ABODE) return "Your sect needs a worthy seat — raise your cave abode to at least a Spirit-Gathering Abode (tier 3).";
  if (c.spiritStones < FOUND_SECT_COST) return `Founding costs ${FOUND_SECT_COST} spirit stones (halls, tokens, rites). You have ${c.spiritStones}.`;
  return null;
}
export function foundSect(c, rng, name) {
  const reason = foundSectReason(c);
  if (reason && c.spiritStones < FOUND_SECT_COST) return [reason];
  if (reason) return [reason];
  c.spiritStones -= FOUND_SECT_COST;
  const sectName = (name && name.trim()) || `${rng.choice(D.SECT_NAME_ADJ)} ${rng.choice(D.SECT_NAME_NOUN)}`;
  const alignment = c.karma <= -40 ? "demonic" : c.karma >= 40 ? "righteous" : "neutral";
  const core = c.relationships.filter(n => n.alive && n.role === "disciple").length;
  c.ownSect = { name: sectName, prestige: 0, members: 5 + core * 4, founded: c.age, alignment, _tier: null };
  // your resident disciples become the founding core — settle them at the seat
  for (const n of c.relationships) if (n.alive && n.role === "disciple") n.resides = true;
  c.reputation += 10;
  if (!c.titles.includes("Founder")) c.titles.push("Founder");
  note(c, `Founded the ${sectName} (${alignment}), seated at your abode.`);
  return [`✦ You raise your banner and found the ${sectName}! Your cave abode becomes its mountain seat. Disciples will gather to your name — the sect will rise, or fall, with you.`];
}

// The sect's quiet year: it recruits toward its seat's capacity, gains prestige
// from your strength and following, spreads your name, and pays a stipend.
function sectYearly(c, rng, events) {
  const s = c.ownSect; if (!s) return;
  const cap = sectCapacity(c);
  const coreDisc = c.relationships.filter(n => n.alive && n.role === "disciple").length;
  if (s.members < cap) {
    const gain = Math.max(1, Math.round((cap - s.members) * (0.04 + c.reputation / 4000 + s.prestige / 9000)));
    s.members = Math.min(cap, s.members + gain);
  } else if (s.members > cap) s.members = cap;
  s.prestige += c.realm * 0.6 + Math.min(6, c.abode || 0) * 0.5 + s.members * 0.02 + coreDisc * 0.5 + Math.max(0, c.reputation) * 0.01;
  const tier = D.sectTier(s.prestige);
  c.reputation += tier[4];
  c.spiritStones += Math.round(s.members * 0.4 * (1 + Math.min(6, c.abode || 0) * 0.2));
  if (s._tier !== tier[1]) {
    if (s._tier) events.push({ id: "sect_rise_" + c.age, auto: true, milestone: true, text: [`✦ Your sect, the ${s.name}, has risen to a ${tier[1]} (${tier[2]})! Its name now carries weight across the land.`] });
    s._tier = tier[1];
  }
}

// Throw open the gates and recruit (a deed). Draws followers up to the seat's
// capacity, and sometimes a true talent kneels as a personal disciple.
export function holdRecruitment(c, rng) {
  const s = c.ownSect; if (!s) return ["You lead no sect."];
  const cap = sectCapacity(c);
  const room = Math.max(0, cap - s.members);
  if (room <= 0) return [`The halls of the ${s.name} are already full to its seat's capacity (${s.members}/${cap}). Expand your abode to take in more.`];
  const drew = Math.min(room, rng.randint(5, 15) + Math.floor(Math.max(0, c.reputation) / 20));
  s.members += drew; s.prestige += 3 + drew * 0.2;
  const msgs = [`You throw open the gates of the ${s.name}. ${drew} hopefuls flock to your banner. (${s.members}/${cap} members)`];
  if (c.realm >= 4 && getDisciples(c).length < 4 && rng.random() < 0.45) {
    const n = mkNpc("disciple", E.npcName(rng), 55);
    n.kin = "Disciple"; n.power = E.power(c) * rng.uniform(0.2, 0.4); n.learned = []; n.resides = true;
    c.relationships.push(n);
    msgs.push(`Among them, a true talent — ${n.name} — kneels as your personal disciple and takes up residence at the seat.`);
  }
  return msgs;
}

export function disbandSect(c) {
  if (!c.ownSect) return ["You lead no sect."];
  const nm = c.ownSect.name;
  c.ownSect = null;
  c.reputation = Math.max(-200, c.reputation - 8);
  note(c, `Disbanded the ${nm}.`);
  return [`You lower the banner of the ${nm} and disband it. Its disciples scatter to the four winds. (−Reputation)`];
}

/* ------------------------------ queries ---------------------------------- */
export const livingFamily = c => c.relationships.filter(n => n.role === "family" && n.alive);
export const livingBonds = c => c.relationships.filter(n => n.role !== "family" && n.alive);
