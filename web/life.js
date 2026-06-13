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
  generateFamily(c, rng);
  return c;
}

export function bornCharacter(rng, name, sex) {
  return augment(E.generateCharacter(rng, name), rng, sex);
}

export function reincarnateLife(old, rng, name) {
  const c = E.reincarnate(old, rng, name);
  return augment(c, rng);
}

// Free social action (no year cost): go out and meet someone new.
export function mingle(c, rng) {
  const pull = c.charm + (["striking", "peerless", "immortal"].includes(c.appearanceKey) ? 20 : 0);
  const roll = rng.random();
  if (roll < 0.22 + pull / 500 && !c.relationships.some(n => n.role === "companion" && n.alive)) {
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

  // Passive background cultivation, once your root has awakened.
  if (c.awakened && c.root) {
    const gain = E.cultivationSpeed(c) * 0.6 * rng.uniform(0.85, 1.15);
    c.qi += gain;
    advanceStages(c);
    if (c.sectKey) c.spiritStones += D.SECT_RANKS[c.sectRank][4];
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.5);
  }

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

function finishYear(c, rng, msgs) {
  if (c.health <= 0 && c.alive) { c.alive = false; c.causeOfDeath = "failing health"; msgs.push("☠ Your health gives out entirely. You die."); note(c, "Died of failing health."); return; }
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age, lifespan exhausted"; msgs.push(`☠ Your lifespan ends at ${c.age}.`); note(c, "Died of old age."); }
}

/* --------------------- free relationship interactions -------------------- */
// These do NOT cost a year (BitLife-style); they shift affinity and mood.

export function relationActions(c, npc) {
  const acts = [];
  acts.push({ id: "talk", label: npc.role === "family" ? "Spend time together" : "Converse" });
  if (npc.role !== "enemy") acts.push({ id: "gift", label: "Give a gift (5 stones)" });
  if (npc.role === "family" && (npc.realm || 0) >= 2) acts.push({ id: "guidance", label: "Seek their guidance" });
  if (npc.role === "family" && (c.backgroundKey === "noble" || c.backgroundKey === "royal")) acts.push({ id: "askhelp", label: "Ask for resources" });
  if (npc.role === "rival" || npc.role === "friend") acts.push({ id: "spar", label: "Spar" });
  if (npc.role === "companion") acts.push({ id: "dual", label: "Dual cultivate" });
  if (npc.role === "enemy") { acts.push({ id: "insult", label: "Threaten them" }); acts.push({ id: "reconcile", label: "Make peace" }); acts.push({ id: "duel", label: "Challenge to a duel" }); }
  return acts;
}

export function doRelationAction(c, npc, action, rng) {
  const adj = d => { npc.affinity = clampN(npc.affinity + d, -100, 100); };
  const happy = n => { c.happiness = clampN(c.happiness + n, 0, 100); };
  switch (action) {
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

/* ------------------------------ queries ---------------------------------- */
export const livingFamily = c => c.relationships.filter(n => n.role === "family" && n.alive);
export const livingBonds = c => c.relationships.filter(n => n.role !== "family" && n.alive);
