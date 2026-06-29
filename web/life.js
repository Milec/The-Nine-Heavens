/* The Nine Heavens -- BitLife-style life layer: birth into a family, the
 * year-by-year "age up" loop with narrative events, the spiritual-root
 * awakening, vitals (health & happiness), activities and relationships. */

import * as E from "./engine.js";
import * as D from "./data.js";
import * as World from "./world.js";
import { rollYearEvents } from "./events.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cap = (c, k, v) => { c[k] = Math.min(160, c[k] + v); };
function note(c, t) { c.log.push([c.age, t]); }

// Karma slowly becomes Fortune: deep merit draws the heavens' favour (+Luck) over
// the years; a black tide of evil karma sours it (−Luck). Returns a feed line or null.
function karmaFortune(c, rng) {
  const k = c.karma || 0;
  if (k >= 30 && (c.luck || 0) < 160 && rng.random() < Math.min(0.5, 0.05 + k / 700)) {
    cap(c, "luck", 1); note(c, "Accumulated merit ripened into fortune (+Luck).");
    return "☯ The merit you have gathered ripens into fortune — the heavens look kindlier on you. (+Luck)";
  }
  if (k <= -30 && (c.luck || 0) > 1 && rng.random() < Math.min(0.5, 0.05 + (-k) / 700)) {
    c.luck = Math.max(1, (c.luck || 1) - 1); note(c, "Ill karma soured your fortune (−Luck).");
    return "☯ The weight of your ill karma sours your fortune; luck turns its face from you. (−Luck)";
  }
  return null;
}

/* ----------------------------- birth ------------------------------------- */
function augment(c, rng, sex) {
  c.sex = sex || (rng.random() < 0.5 ? "female" : "male");
  c.happiness = clampN(55 + rng.randint(-10, 15), 0, 100);
  c.health = clampN(60 + Math.floor(c.constitution / 4) + rng.randint(-5, 10), 0, 100);
  c.awakened = false;
  c.firedEvents = [];
  c.mastery = c.mastery || {};
  World.ensureWorld(c, rng);            // make sure this soul has a realm to roam
  if (!c.movementArts) c.movementArts = [];
  if (!c.moveMastery) c.moveMastery = {};
  if (c.abode == null) c.abode = 0;
  if (c.abodeLocation == null) c.abodeLocation = null;
  if (c.abodeRegion == null) c.abodeRegion = null;
  if (c.ownSect === undefined) c.ownSect = null;
  if (c.legacySect === undefined) c.legacySect = null;
  if (c.generation == null) c.generation = 1;
  if (c.era == null) { c.era = D.ERAS[Math.floor(rng.random() * D.ERAS.length)][0]; c.eraYears = 20 + Math.floor(rng.random() * 35); }
  E.ensurePopulation(c, rng);           // people the realm: sects, towns, and the Heaven Board
  if (c.talismans == null) c.talismans = {};
  if (c.bodyRealm == null) c.bodyRealm = 0;
  if (c.temper == null) c.temper = 0;
  if (c.longevityBonus == null) c.longevityBonus = 0;
  generateFamily(c, rng);
  return c;
}

export const getNemesis = c => c.relationships.find(n => n.role === "nemesis" && n.alive) || null;
function makeNemesis(c, rng, grudge) {
  if (getNemesis(c)) return getNemesis(c);
  const n = mkNpc("nemesis", E.npcName(rng), -45);
  n.kin = "Nemesis"; n.grudge = grudge || "an old slight you barely remember";
  n.element = rng.choice([...D.ELEMENTS, "Dark", "Lightning"]);
  n.encounters = 0;
  // A nemesis is a true peer who shadows your strength.
  E.ensureNpcProfile(n, rng, { realm: c.realm, power: E.basePower(c) * rng.uniform(1.05, 1.25) + 2 });
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
  carryLegacySect(c, old, rng);
  c.era = old.era; c.eraYears = old.eraYears;   // the world keeps turning across rebirth
  // A soul you were bound to most fiercely may be reborn into this turning of the
  // wheel too — a lost dao companion or a sworn nemesis. Seeds the Reborn Bond arc.
  const lostLove = (old.relationships || []).filter(n => n.role === "companion" && !n.alive && (n.affinity || 0) >= 70)
    .sort((a, b) => (b.affinity || 0) - (a.affinity || 0))[0];
  const oldNemesis = (old.relationships || []).filter(n => n.role === "nemesis").sort((a, b) => (b.power || 0) - (a.power || 0))[0];
  if (lostLove && rng.random() < 0.5) c.rebornBond = { name: lostLove.name, kind: "love", sex: lostLove.sex };
  else if (oldNemesis && rng.random() < 0.5) c.rebornBond = { name: oldNemesis.name, kind: "foe", element: oldNemesis.element };
  return c;
}

const LEGACY_SECT_FADE = 20;   // below this prestige a leaderless sect finally crumbles
// A sect you founded outlives you: it limps on, leaderless or under a steward
// disciple, and awaits the return of its founder's reincarnated soul.
function carryLegacySect(c, old, rng) {
  let legacy = null;
  if (old.ownSect && old.ownSect.prestige >= 40) {
    const s = old.ownSect;
    // a strong heir-disciple steadies the sect; otherwise it fades faster.
    const heir = old.relationships
      .filter(n => n.role === "disciple" && (n.power || 0) > 0)
      .sort((a, b) => (b.power || 0) - (a.power || 0))[0];
    const decay = heir ? 0.7 : 0.5;
    legacy = {
      name: s.name, alignment: s.alignment,
      prestige: Math.floor(s.prestige * decay),
      members: Math.floor(s.members * decay),
      steward: heir ? heir.name : null,
      generations: 1,
      library: s.library || [],   // the sect's enshrined arts endure across rebirth
    };
    note(c, heir
      ? `Your sect, the ${s.name}, endures under your disciple ${heir.name}'s stewardship, awaiting your return.`
      : `Your leaderless sect, the ${s.name}, clings on across the years, its disciples praying for the founder's return.`);
  } else if (old.legacySect) {
    // An unreclaimed legacy fades further with each generation it waits.
    const o = old.legacySect;
    const prestige = Math.floor(o.prestige * 0.7);
    if (prestige >= LEGACY_SECT_FADE) {
      legacy = { name: o.name, alignment: o.alignment, prestige, members: Math.floor(o.members * 0.7), steward: o.steward || null, generations: (o.generations || 1) + 1 };
      note(c, `The ${o.name}, founded ${legacy.generations} lives ago, still waits — fewer disciples now, but the founder's banner yet stands.`);
    } else {
      note(c, `The ${o.name}, leaderless too long, has finally crumbled to ruin and memory.`);
    }
  }
  if (legacy) {
    c.legacySect = legacy;
    // the renown of a past founder precedes the reincarnated soul.
    const tierIdx = D.SECT_TIERS.indexOf(D.sectTier(legacy.prestige));
    c.reputation += 3 + Math.max(0, tierIdx) * 2;
  }
}

// Free social action (no year cost): go out and meet someone new.
export function mingle(c, rng) {
  const pull = c.charm + (["striking", "peerless", "immortal"].includes(c.appearanceKey) ? 20 : 0);
  const roll = rng.random();
  // Romance blooms once you've come of age; you may gather more than one love.
  if (c.age >= D.ageMin("romance") && roll < 0.22 + pull / 500 && c.relationships.filter(n => n.role === "companion" && n.alive).length < D.HAREM_CAP) {
    const n = meetPerson(c, rng, "companion", { affinity: 18 + Math.floor(pull / 7) });
    c.happiness = clampN(c.happiness + 6, 0, 100);
    return [`✦ You cross paths with ${n.name}, and a spark kindles. A new romance — court them, and a dao companion they may become.`];
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
    n.kin = kin; n.occupation = occ;
    E.ensureNpcProfile(n, rng, { realm });   // their own root, physique and arts
    return n;
  };
  if (c.backgroundKey === "beggar") {
    // An orphan of the gutter -- no known parents, but a fellow stray.
    c.relationships.push(Object.assign(E.ensureNpcProfile(mkNpc("friend", `${E.givenName(rng)}`, 30), rng, { realm: 0 }), { kin: "Fellow Orphan" }));
  } else if (c.backgroundKey === "slave") {
    c.relationships.push(newKin("Mother", prof[1], 0, rng.randint(65, 85)));
  } else {
    c.relationships.push(newKin("Father", prof[0], prof[2], rng.randint(55, 80)));
    c.relationships.push(newKin("Mother", prof[1], Math.max(0, prof[2] - 1), rng.randint(60, 85)));
  }
  if (rng.random() < 0.45) {
    const sib = newKin(rng.random() < 0.5 ? "Brother" : "Sister", null, 0, rng.randint(40, 70));
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
  const child = opts.kin && ["Son", "Daughter"].includes(opts.kin);
  const name = child ? `${surname} ${E.givenName(rng)}` : E.npcName(rng);
  const n = mkNpc(role, name, opts.affinity != null ? opts.affinity : 20);
  if (opts.kin) n.kin = opts.kin;
  if (opts.born != null) n.born = opts.born;
  if (opts.parent) n.parent = opts.parent;
  // Romantic partners have a sex (mostly the opposite of yours; love is love).
  if (role === "companion") n.sex = opts.sex || (rng.random() < 0.82 ? (c.sex === "female" ? "male" : "female") : c.sex);
  if (child) { n.sex = opts.kin === "Son" ? "male" : "female"; n.power = 1; }   // a babe; its genome is set by its parents
  else {
    // Every cultivator you meet has their own root, physique, realm and arts —
    // their realm scaled to their standing relative to you.
    const r = c.realm || 0, top = D.REALMS.length - 1;
    const hint = role === "master" ? Math.min(top, r + rng.randint(1, 2))
      : role === "disciple" ? Math.max(0, r - rng.randint(2, 4))
      : Math.max(0, Math.min(top, r + rng.randint(-1, 1)));
    E.ensureNpcProfile(n, rng, { realm: opts.realm != null ? opts.realm : hint, power: opts.power });
  }
  // Everyone you meet hails from somewhere — kin share your home; others, the
  // place you met them. Lets the world feel peopled by locals.
  n.home = opts.home != null ? opts.home : (c.location || 0);
  c.relationships.push(n);
  return n;
}

/* ----------------------------- romance & kin ----------------------------- */
export const livingLovers = c => c.relationships.filter(n => n.role === "companion" && n.alive);
export const livingSpouses = c => c.relationships.filter(n => n.role === "companion" && n.married && n.alive);
export const childrenOf = c => c.relationships.filter(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive);

// Take a courted companion as your wedded dao companion. Harems welcome.
export function marry(c, npc, rng) {
  if (npc.married) return [`You and ${npc.name} are already wed.`];
  npc.married = true;
  npc.kin = D.spouseLabel(npc);
  npc.affinity = clampN(npc.affinity + 15, -100, 100);
  c.happiness = clampN(c.happiness + 18, 0, 100);
  c.karma += 1; c.reputation += 3;
  if (!c.titles.includes("Wed")) c.titles.push("Wed");
  const n = livingSpouses(c).length;
  if (n >= 3) { c.titles = c.titles.filter(t => !/^Harem of/.test(t)); c.titles.push(`Harem of ${n}`); }
  note(c, `Wed ${npc.name}${n > 1 ? ` (now ${n} dao companions)` : ""}.`);
  const others = n > 1 ? ` Your other ${n - 1} dao companion${n - 1 > 1 ? "s" : ""} look on — some glowing with joy, some with a flicker of jealousy.` : "";
  const out = [`✦ Beneath a blood-red moon, you and ${npc.name} pledge to walk the long road to immortality together — wed at last, ${npc.kin.toLowerCase()} and spouse.${others}`];
  // The heavens are jealous of a love too deep; a great bond can invite a love
  // tribulation. Arms the Star-Crossed Love arc (only from Foundation up).
  if (c.realm >= 2 && E.armArc(c, "tragedy", rng, 0.25))
    out.push("As you pledge your hearts, a chill crosses the moon, and for an instant the whole world seems to hold its breath — as though something vast had taken notice of your happiness.");
  return out;
}

// Grown children who could carry on the bloodline if you die.
export const childAge = (c, k) => c.age - (k.born != null ? k.born : c.age);
export const eligibleHeirs = c => c.relationships.filter(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive && childAge(c, n) >= 16);

// Continue your bloodline: play on as a grown child, inheriting the family's
// estate, fortune and the sect your forebear founded. Distinct from rebirth —
// this is the next generation, not the same soul reborn.
export function succeedAsHeir(old, child, rng) {
  const surname = old.name.split(" ")[0];
  // The heir embodies their inherited genome (root, physique, looks); if an older
  // save lacks one, derive it now from the parent's bloodline.
  const geno = child.geno || E.inheritGenome(E.playerGenome(old), E.rollGenome(rng), rng);
  const opts = { rootKey: geno.rootKey, physiqueKey: geno.physiqueKey, appearanceKey: geno.appearanceKey };
  const c = E.generateCharacter(rng, child.name, opts);
  augment(c, rng, child.sex);
  // Layer the inherited attributes over the generated base (kept the higher of the two).
  for (const k of ["comprehension", "constitution", "soul", "luck", "charm"])
    c[k] = Math.min(160, Math.max(c[k], geno[k] || 0));
  c.awakened = true;                                   // a grown heir is long past the Awakening
  c.age = Math.max(16, childAge(old, child));
  c.generation = (old.generation || 1) + 1;
  c.era = old.era; c.eraYears = old.eraYears;          // the same world the forebear knew
  // inherit the family estate and a share of the fortune (re-rooted in the new realm)
  c.abode = old.abode || 0;
  if (c.abode > 0) { c.abodeLocation = c.location; c.abodeRegion = c.region; } else { c.abodeLocation = null; c.abodeRegion = null; }
  if (old.ownSect) c.ownSect = Object.assign({}, old.ownSect, { founded: c.age, _tier: null });
  c.spiritStones += Math.floor((old.spiritStones || 0) * 0.6);
  c.herbs += Math.floor((old.herbs || 0) * 0.5);
  c.pills += old.pills || 0;
  // The heir inherits the parent's equipped loadout, refinement and all.
  E.ensureEquipment(old); E.ensureEquipment(c);
  for (const key of E.equippedKeys(old)) {
    if (!c.artifacts.includes(key)) c.artifacts.push(key);
    c.equipment[D.artifactSlot(key)] = key;
    if (old.refinement && old.refinement[key]) c.refinement[key] = old.refinement[key];
  }
  E.ensureEquipment(c);
  c.reputation += Math.floor((old.reputation || 0) * 0.3) + 5;
  c.comprehension = Math.min(160, c.comprehension + Math.min(20, old.realm * 2));   // inherited insight
  // The heir has cultivated since their own childhood — simulate that youth so
  // they begin at a realm befitting their age and talent (no tribulation risk).
  const years = Math.min(Math.max(0, c.age - 6), 200);
  for (let y = 0; y < years; y++) {
    c.qi += E.cultivationSpeed(c) * rng.uniform(0.85, 1.15);
    while (c.qi >= E.qiToNext(c)) {
      if (c.stage < E.realmStages(c) - 1) { c.qi -= E.qiToNext(c); c.stage += 1; }
      else if (c.realm < D.REALMS.length - 1) { c.qi -= E.qiToNext(c); c.realm += 1; c.stage = 0; }
      else { c.qi = E.qiToNext(c) * 0.5; break; }
    }
    E.temperBody(c, rng, 0.5);
  }
  // the heir's family: a revered ancestor, the surviving co-parent, and siblings
  c.relationships = [];
  c.relationships.push({ name: old.name, role: "family", kin: "Honoured Ancestor", affinity: 85, alive: false, power: 0, realm: old.realm });
  const co = old.relationships.find(n => n.role === "companion" && n.alive && n.name === child.parent)
    || old.relationships.find(n => n.role === "companion" && n.married && n.alive);
  if (co) c.relationships.push({ name: co.name, role: "family", kin: co.sex === "female" ? "Mother" : "Father", affinity: 78, alive: true, power: co.power || 0, realm: 1 });
  for (const sib of old.relationships)
    if ((sib.kin === "Son" || sib.kin === "Daughter") && sib.alive && sib !== child)
      c.relationships.push({ name: sib.name, role: "family", kin: sib.sex === "female" ? "Sister" : "Brother", affinity: rng.randint(45, 70), alive: true, power: sib.power || 1 });
  E.recomputeMaxAge(c); E.recomputeMaxHp(c);
  note(c, `Took up the legacy of ${old.name} as the ${ordinal(c.generation)} generation of the ${surname} line.`);
  if (c.ownSect) note(c, `Inherited leadership of the ${c.ownSect.name}.`);
  return c;
}
const ordinal = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// Try for a child with a wedded spouse; bears them into your line.
export function tryForChild(c, npc, rng) {
  if (childrenOf(c).length >= 10) return ["Your line is already vast — ten children is legacy enough for any cultivator."];
  if (c.age < D.ageMin("child")) return ["You are not yet of an age to raise children."];
  if (rng.random() < 0.55 + c.luck / 400) {
    const son = rng.random() < 0.5;
    const child = meetPerson(c, rng, "family", { kin: son ? "Son" : "Daughter", affinity: 70, born: c.age, parent: npc.name });
    if (!npc.geno) npc.geno = E.rollGenome(rng);
    child.geno = E.inheritGenome(E.playerGenome(c), npc.geno, rng);   // inherits from both parents
    npc.affinity = clampN(npc.affinity + 6, -100, 100);
    c.happiness = clampN(c.happiness + 12, 0, 100);
    note(c, `${npc.name} bore you a ${son ? "son" : "daughter"}, ${child.name}.`);
    return [`✦ Joy fills your household: ${npc.name} gives you a ${son ? "son" : "daughter"} — ${child.name}. A new spark of your bloodline enters the world.`];
  }
  c.happiness = clampN(c.happiness + 3, 0, 100);
  return [`A tender season with ${npc.name}, though no child comes of it just yet.`];
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
    marry: npc => marry(c, npc, rng),
    spouses: () => livingSpouses(c),
    lovers: () => livingLovers(c),
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
    lines.push(`The stone stays dull and grey. You have no spiritual root — the gate of qi is shut to you.`);
    A.happy(-20); A.kinAdjust("father", -6); A.kinAdjust("mother", -4);
    lines.push("Your parents' faces fall; whispers of pity follow you home. But the road of qi is not the only road — there is yet the path of the body. Temper your flesh, and defy the heavens that spurned you. (See Cultivation.)");
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

  // The world turns: an era runs its course and gives way to the next.
  c.eraYears = (c.eraYears == null ? 30 : c.eraYears) - 1;
  if (c.eraYears <= 0) {
    const opts = D.ERAS.filter(e => e[0] !== c.era);
    const next = opts[Math.floor(rng.random() * opts.length)];
    c.era = next[0]; c.eraYears = 25 + Math.floor(rng.random() * 30);
    events.push({ id: "era_" + c.era, auto: true, milestone: true, text: [`☷ The age turns: the realm enters the ${next[1]} (${next[2]}). ${next[3]}`] });
  }

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

  // A body tempers slowly just by living a hard cultivator's life — and for the
  // rootless, this quiet hardening is the whole of their climb.
  if (c.alive) for (const m of E.temperBody(c, rng, 0.5)) if (m[0] === "⛰") events.push({ id: "bodyup", auto: true, milestone: true, text: [m] });

  // The world lives, climbs and dies alongside you: friends, rivals, spouses,
  // masters, disciples and your own children each advance their own cultivation
  // (capped by their talent) and age toward their own lifespan.
  let worldUp = null;
  for (const npc of c.relationships) {
    if (!npc.alive || npc.role === "nemesis") continue;        // the nemesis grows separately
    const isKid = npc.kin === "Son" || npc.kin === "Daughter";
    if (isKid && !npc._awakened) continue;
    if (npc.realm == null) { if (isKid) E.ensureNpcProfile(npc, rng, { realm: 0 }); else continue; }
    const step = E.advanceNpc(npc, rng);
    if (step === "realm" && !worldUp && (npc.role === "companion" || npc.role === "master" || npc.role === "disciple" || isKid || (npc.affinity || 0) >= 60))
      worldUp = npc;
    if (npc.age != null) { npc.age += 1; if (npc.age > npc.maxAge) npcDies(c, npc, events); }
  }
  if (worldUp) events.push({ id: "world_advance", auto: true, text: [`Word reaches you: ${worldUp.name} has broken through to ${E.npcRealmName(worldUp)} (${D.REALMS[worldUp.realm][1]}). The world does not stand still while you cultivate.`] });
  const tidings = E.agePopulation(c, rng);   // the realm's cultivators climb (and fall) on their own roads
  if (tidings.length && rng.random() < 0.45)
    events.push({ id: "realm_tidings_" + c.age, auto: true, text: [`☷ Tidings from the wider realm: ${tidings[rng.randint(0, tidings.length - 1)]}`] });

  // The living society turns: rivalries, oaths, duels, betrayals, demonic falls
  // and heroes' risings thread through the realm — recorded in the Annals (风云录),
  // and the most striking carried to your ears as word from afar.
  const annals = E.simulateSociety(c, rng);
  if (annals.length) {
    const loud = annals.find(a => a.kind === "demon" || a.kind === "hero") || annals[rng.randint(0, annals.length - 1)];
    if (loud && (loud.kind === "demon" || loud.kind === "hero" || rng.random() < 0.5))
      events.push({ id: "annal_" + c.age, auto: true, milestone: loud.kind === "demon", text: [`☷ Word from the realm: ${loud.text}`] });
  }

  // Merit ripens into fortune: a deep well of good karma slowly draws the heavens'
  // favour to you over the years, while a black tide of evil karma bleeds it away.
  // (Body and Soul you temper by hand; Fortune you earn by how you live.)
  const km = karmaFortune(c, rng);
  if (km) events.push({ id: "karma_fortune_" + c.age, auto: true, text: [km] });

  // Your spirit beast grows over the year (and its yearly feeding refreshes).
  if (c.beast && c.beast.alive) E.beastGrow(c, rng);

  // Your nemesis cultivates too, always shadowing your strength.
  const nem = getNemesis(c);
  if (nem) { nem.power = Math.max(nem.power * 1.03, E.basePower(c) * rng.uniform(1.0, 1.18)); if ((nem.realm || 0) < c.realm) nem.realm = c.realm; }

  // Vitals drift gently; old age erodes health.
  c.happiness = clampN(c.happiness + rng.randint(-2, 2), 0, 100);
  if (c.age > c.maxAge * 0.85) c.health = clampN(c.health - rng.randint(0, 3), 0, 100);
  else c.health = clampN(c.health + rng.randint(-1, 2), 0, 100);

  // Milestone: the spiritual-root awakening.
  if (!c.awakened && c.age >= D.AWAKENING_AGE) events.push(awakeningInstance(c, rng, A));

  // Random life events.
  for (const ev of rollYearEvents(c, rng, A)) events.push(ev);

  // The world may settle a new moniker on you as your fame and deeds grow.
  if (c.alive && c.awakened) {
    const named = E.maybeAwardEpithet(c, rng);
    if (named.length) events.push({ id: "epithet_" + c.age, auto: true, milestone: true, text: named });
  }

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

// An NPC's lifespan runs out. Close bonds grieve; the world feels their passing.
function npcDies(c, n, events) {
  n.alive = false;
  const who = n.kin && n.role === "family" ? `your ${n.kin.toLowerCase()}` : (D.ROLE_LABEL[n.role] || n.role).toLowerCase();
  const close = n.role === "companion" || n.role === "master" || n.kin === "Son" || n.kin === "Daughter"
    || n.role === "family" || (n.affinity || 0) >= 60;
  note(c, `${n.name} (${who}) died of old age at ${n.age}.`);
  if (close) {
    c.happiness = clampN(c.happiness - (n.role === "companion" || n.kin === "Son" || n.kin === "Daughter" ? 18 : 12), 0, 100);
    const line = n.role === "companion"
      ? `${n.name}, your ${(n.kin || "dao companion").toLowerCase()}, has passed away at ${n.age} — their mortal span spent while yours runs on. You grieve the cruelest price of the long road.`
      : `Word reaches you: ${n.name}, ${who}, has died of old age at ${n.age}. You burn incense for a candle gone out.`;
    events.push({ id: "npc_death_" + n.name + c.age, auto: true, milestone: n.role === "companion", text: [line] });
  }
}

/* ---------------------------- activities --------------------------------- */
// Activities cost a year and shift vitals; they are the BitLife "do something".

export function trainBody(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You spend the year drilling your body to exhaustion — forms, stances, iron-shirt conditioning."];
  if (rng.random() < 0.6) { cap(c, "constitution", rng.randint(1, 3)); E.recomputeMaxHp(c); msgs.push("Your physique hardens. (+Constitution)"); }
  // A full year of hard conditioning meaningfully tempers the body.
  for (const m of E.temperBody(c, rng, 3.0)) if (m[0] === "⛰") msgs.push(m);
  c.health = clampN(c.health + 4, 0, 100); c.happiness = clampN(c.happiness - 2, 0, 100);
  finishYear(c, rng, msgs);
  return msgs;
}
export function studyScriptures(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You bury yourself in the sect library / borrowed scrolls, parsing dense dao theory."];
  if (rng.random() < 0.6) { cap(c, "comprehension", rng.randint(1, 3)); msgs.push("Insight blooms. (+Comprehension)"); }
  // Diligent, talented study can draw a hidden master's eye — arming a years-long
  // tutelage arc (certain once your comprehension is truly exceptional).
  if (c.age >= D.COMING_OF_AGE && c.realm >= 1 && c.root && c.root.key !== "none"
      && E.armArc(c, "tutelage", rng, c.comprehension >= 130 ? 1 : 0.04 + c.comprehension / 1600))
    msgs.push("A stranger has been watching you read, three days running now, and saying nothing.");
  finishYear(c, rng, msgs);
  return msgs;
}
// Temper the SPIRIT, the counterpart to tempering the body: a year of deep
// meditation in your sea of consciousness sharpens the soul (+Soul).
export function temperSoul(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You pass the year in deep spiritual meditation, circulating qi through your sea of consciousness to hone your divine sense."];
  if (rng.random() < 0.6) { cap(c, "soul", rng.randint(1, 3)); msgs.push("Your spiritual sense sharpens, your mind a stiller pool. (+Soul)"); }
  if (c.awakened && c.root && c.root.key !== "none") { c.qi += E.qiToNext(c) * rng.uniform(0.05, 0.15); advanceStages(c); }
  c.happiness = clampN(c.happiness + 1, 0, 100);
  finishYear(c, rng, msgs);
  return msgs;
}
// Refine your PRESENCE: a year moving in cultivator society, sharpening bearing,
// wit and renown (+Charm, and a little fame).
export function refinePresence(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const msgs = ["You spend the year amid cultivator society — banquets and dao-debates, poetry duels and quiet courtesies — honing your bearing and your name."];
  if (rng.random() < 0.6) { cap(c, "charm", rng.randint(1, 3)); msgs.push("Your presence grows more compelling; eyes linger when you speak. (+Charm)"); }
  if (rng.random() < 0.5) { const r = E.gainFame(c, rng.randint(1, 2)); if (r) msgs.push(`Tongues wag of you in the right halls. (+${r} fame)`); }
  c.happiness = clampN(c.happiness + 3, 0, 100);
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
// Drill your movement art for a season, sharpening its proficiency (a deed).
export function practiceMovement(c, rng) {
  if (!c.alive) return ["You are dead."];
  const key = E.bestMovementArt(c);
  if (!key) return ["You know no movement art to drill. Seek a 轻功 manual at a market."];
  const m = D.MOVEMENT_BY_KEY[key];
  const gain = rng.randint(20, 36) + Math.floor((c.soul || 0) / 12) + Math.floor((c.comprehension || 0) / 15);
  const before = E.moveRankName(E.moveFraction(c, key));
  E.trainMovement(c, key, gain);
  const after = E.moveRankName(E.moveFraction(c, key));
  c.happiness = clampN(c.happiness - 1, 0, 100);
  const msgs = [`You drill the ${m[1]} (${m[2]}) across crag and gorge for a season. (+${gain} proficiency)`];
  if (after !== before) msgs.push(`  ✦ Your ${m[1]} ripens to ${after} — you cover ground faster now.`);
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
  const name = E.techName(c, techKey);   // standard or self-forged
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
// The arts a master could still pass to you: only those they themselves know and
// you do not. A finite well — once drawn dry, there is nothing left to teach.
const masterTeachable = (c, npc) => (npc.techniques || []).filter(t => t !== "basic_breathing" && !c.techniques.includes(t));
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
    acts.push({ id: "guide", label: "Impart cultivation insight" });
    acts.push({ id: "mission", label: "Send on a trial mission" });
    if (c.artifacts && c.artifacts.some(k => !E.isEquipped(c, k))) acts.push({ id: "bestow", label: "Bestow a treasure" });
    acts.push({ id: "gift", label: "Give a gift (5 stones)" });
    acts.push({ id: "spar", label: "Spar" });
    if ((c.abode || 0) > 0) acts.push(npc.resides ? { id: "sendaway", label: "Have them leave your abode" } : { id: "invite", label: "Invite to live at your abode" });
    acts.push({ id: "harsh", label: "Rebuke harshly" });
    if (npc.affinity <= -25) acts.push({ id: "expel", label: "Expel from the sect" });
    return acts;
  }
  const acts = [];
  acts.push({ id: "talk", label: npc.role === "family" ? "Spend time together" : "Converse" });
  if ((npc.role === "companion" || npc.kin === "Son" || npc.kin === "Daughter") && teachableTechs(c).length)
    acts.push({ id: "teach", label: "Teach a technique" });
  if (npc.role !== "enemy") acts.push({ id: "gift", label: "Give a gift (5 stones)" });
  if (npc.role === "master") {
    if (masterTeachable(c, npc).length) acts.push({ id: "seekteaching", label: "Ask to be taught an art" });
    acts.push({ id: "mguidance", label: "Seek their guidance" });
    acts.push({ id: "spar", label: "Spar (a lesson in arms)" });
    acts.push({ id: "askmaster", label: "Beg a parting gift" });
  }
  if (npc.role === "family" && (npc.realm || 0) >= 2) acts.push({ id: "guidance", label: "Seek their guidance" });
  if (npc.role === "family" && (c.backgroundKey === "noble" || c.backgroundKey === "royal")) acts.push({ id: "askhelp", label: "Ask for resources" });
  if (npc.role === "rival" || npc.role === "friend") acts.push({ id: "spar", label: "Spar" });
  if (npc.role === "companion") {
    if (!npc.married) {
      acts.push({ id: "court", label: "Woo them with sweet words" });
      if (npc.affinity >= 55) acts.push({ id: "propose", label: "Propose marriage 💍" });
    } else {
      acts.push({ id: "dual", label: "Dual cultivate" });
      if (c.age >= 18 && childrenOf(c).length < 10) acts.push({ id: "trychild", label: "Try for a child" });
    }
  }
  if ((npc.role === "companion" || npc.role === "disciple") && (c.abode || 0) > 0)
    acts.push(npc.resides ? { id: "sendaway", label: "Have them leave your abode" } : { id: "invite", label: "Invite to live at your abode" });
  // Every bond can be wounded as well as deepened. A sweetheart not yet wed can be
  // cast off entirely; a friend or rival driven low enough turns to open enmity.
  if (npc.role !== "enemy") acts.push({ id: "harsh", label: npc.role === "companion" && !npc.married ? "Quarrel bitterly" : "Speak harshly" });
  if (npc.role === "companion" && !npc.married) acts.push({ id: "breakup", label: "Break it off" });
  if (npc.role === "enemy") { acts.push({ id: "insult", label: "Threaten them" }); acts.push({ id: "reconcile", label: "Make peace" }); acts.push({ id: "duel", label: "Challenge to a duel" }); }
  return acts;
}

// Matters of the heart are gated to the coming-of-age, however they are reached
// (UI button, a stray event, or an inherited bond) — enforced here, not just in
// the interface, so the rule holds across every system.
const ROMANCE_ACTIONS = { court: 1, propose: 1, dual: 1, trychild: 1 };
export function doRelationAction(c, npc, action, rng) {
  if (ROMANCE_ACTIONS[action] && c.age < D.ageMin("romance"))
    return ["You are too young yet for matters of the heart — such bonds must wait until you come of age."];
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
    // ---- with your master ----
    case "seekteaching": {
      E.ensureNpcProfile(npc, rng);   // a master must have their own repertoire to teach from
      const teachable = masterTeachable(c, npc);
      if (!teachable.length) { adj(1); cap(c, "comprehension", 1); return [`${npc.name} has passed on every art they know — there is nothing left to teach, though they offer a subtle pointer. (+Comprehension)`]; }
      if (rng.random() < 0.4 + npc.affinity / 250 + c.comprehension / 400) {
        const t = rng.choice(teachable); c.techniques.push(t); adj(3); happy(3);
        note(c, `${npc.name} taught you ${D.TECHNIQUES[t][0]}.`);
        const left = teachable.length - 1;
        return [`${npc.name} judges you ready and imparts one of their own arts, the ${D.TECHNIQUES[t][0]}. (${D.TECHNIQUES[t][4]})${left ? "" : " It is the last art they have to give."}`];
      }
      adj(1); return [`"Not yet," ${npc.name} says. "Temper your foundation, and ask again." (Raise your bond and comprehension.)`];
    }
    case "mguidance": {
      adj(rng.randint(2, 4));
      if (rng.random() < 0.5) { cap(c, "comprehension", rng.randint(1, 2)); return [`${npc.name} unravels a knot in your understanding of the dao. (+Comprehension)`]; }
      if (c.awakened && c.root.key !== "none") { c.qi += E.qiToNext(c) * 0.15; advanceStages(c); return [`${npc.name} corrects your qi-circulation; your cultivation settles and deepens.`]; }
      cap(c, "soul", 1); return [`${npc.name} speaks of their own master, long ago. The lineage's weight steadies your heart. (+Soul)`];
    }
    case "askmaster": {
      if (rng.random() < 0.4 + npc.affinity / 300) {
        const r = rng.random();
        if (r < 0.4) { const g = rng.randint(15, 50); c.spiritStones += g; adj(-2); return [`${npc.name} presses ${g} spirit stones into your hand. "Spend it on your cultivation, not wine."`]; }
        if (r < 0.7) { c.pills += rng.randint(1, 3); adj(-2); return [`${npc.name} gifts you a small jar of pills from their own stores.`]; }
        return [`${npc.name} bestows a treasure upon you.`].concat(E.acquireArtifact(c, E.randomArtifact(c, rng)));
      }
      adj(-2); return [`${npc.name} swats the back of your head. "A cultivator earns their own fortune."`];
    }
    // ---- with your disciple ----
    case "guide": {
      npc.power = (npc.power || 1) * rng.uniform(1.05, 1.12); adj(rng.randint(3, 7)); happy(2);
      if (rng.random() < 0.3) { c.reputation += 1; if (c.ownSect) c.ownSect.prestige += 3; }
      return [`You personally guide ${npc.name}'s cultivation; they grow stronger and more devoted to you. (${E.npcStatus(npc)})`];
    }
    case "mission": {
      const r = rng.random();
      if (r < 0.55) { const g = rng.randint(8, 24) * (c.realm + 1); c.spiritStones += g; npc.power = (npc.power || 1) * 1.04; adj(3); if (c.ownSect) c.ownSect.prestige += 4; return [`${npc.name} returns from the trial victorious, laying ${g} spirit stones at your feet and the richer for the experience.`]; }
      if (r < 0.82) { const h = rng.randint(3, 8); c.herbs += h; adj(2); return [`${npc.name} returns from the trial with ${h} spirit herbs and a head full of road-tales.`]; }
      npc.power = Math.max(1, (npc.power || 1) * 0.85); adj(-2); happy(-3); return [`${npc.name} returns from the trial battered and humbled, having barely escaped with their life. You tend their wounds.`];
    }
    case "bestow": {
      const spare = c.artifacts.find(k => !E.isEquipped(c, k));
      if (!spare) return ["You have no spare treasure to bestow."];
      c.artifacts.splice(c.artifacts.indexOf(spare), 1);
      if (c.refinement) delete c.refinement[spare];
      npc.power = (npc.power || 1) * 1.25 + 10; adj(rng.randint(8, 15)); happy(4); c.karma += 2;
      note(c, `Bestowed the ${D.ARTIFACT_BY_KEY[spare][1]} upon ${npc.name}.`);
      return [`You bestow the ${D.ARTIFACT_BY_KEY[spare][1]} upon ${npc.name}. They kowtow, overcome, and grow markedly stronger. (+Karma)`];
    }
    case "askhelp":
      if (rng.random() < 0.6) { const g = rng.randint(20, 80); c.spiritStones += g; adj(-2); return [`Your influential family sends ${g} spirit stones — with a lecture about responsibility.`]; }
      return [`Your family refuses to coddle you further. "Stand on your own feet."`];
    case "spar": {
      const win = E.power(c) * rng.uniform(0.85, 1.2) >= npc.power * rng.uniform(0.85, 1.2);
      adj(win ? rng.randint(2, 6) : rng.randint(-3, 2)); happy(1);
      return [win ? `You best ${npc.name} in a friendly bout; they respect you for it.` : `${npc.name} gets the better of you. Humbling, but instructive.`];
    }
    case "dual": adj(rng.randint(3, 7)); happy(4); return [`You and ${npc.name} share a tender, quiet hour of dual cultivation. Your bond deepens. (${E.npcStatus(npc)})`];
    case "court": {
      const g = rng.randint(4, 9) + Math.floor(c.charm / 25); adj(g); happy(3);
      const lines = [`You court ${npc.name} with sweet words, moonlit walks and small gifts of the heart. (${E.npcStatus(npc)})`];
      if (npc.affinity >= 55 && !npc.married) lines.push(`${npc.name}'s eyes shine when they meet yours — they would say yes, were you to ask.`);
      return lines;
    }
    case "propose":
      if (npc.married) return [`You and ${npc.name} are already wed.`];
      if (npc.affinity < 55) { adj(-4); happy(-4); return [`You drop to one knee too soon — ${npc.name} falters, then gently declines. You court them a while longer.`]; }
      return marry(c, npc, rng);
    case "trychild": return tryForChild(c, npc, rng);
    case "invite": npc.resides = true; adj(rng.randint(4, 8)); happy(3); return [`${npc.name} moves into your cave abode. ${npc.role === "disciple" ? "They will tend its spirit fields and grow in its dense qi." : "It feels far more like a home now."}`];
    case "sendaway": npc.resides = false; adj(-rng.randint(1, 3)); return [`${npc.name} packs their things and leaves your abode.`];
    case "insult": adj(-rng.randint(4, 10)); happy(1); return [`You hurl threats at ${npc.name}. The feud festers.`];
    case "harsh": {
      adj(-rng.randint(7, 15)); happy(-rng.randint(1, 3));
      const lines = [`You speak harshly to ${npc.name}; the words land like cold iron and the warmth between you cools. (${E.npcStatus(npc)})`];
      // A light bond driven deep into resentment curdles into open enmity; blood,
      // marriage vows and a master's standing endure a sharp tongue without breaking.
      const canSour = npc.role === "friend" || npc.role === "rival" || (npc.role === "companion" && !npc.married);
      if (canSour && npc.affinity <= -45 && rng.random() < 0.6) {
        npc.role = "enemy"; delete npc.kin; npc.married = false;
        lines.push(`Something breaks between you for good. ${npc.name} now numbers among your enemies.`);
      }
      return lines;
    }
    case "breakup": {
      if (npc.married) return [`You and ${npc.name} are wed — parting is no longer so simple a thing.`];
      happy(-rng.randint(2, 6));
      if (rng.random() < 0.45) { npc.role = "enemy"; delete npc.kin; adj(-rng.randint(20, 40)); return [`You break it off with ${npc.name}. They do not take it kindly — a sweetheart becomes a foe.`]; }
      npc.role = "friend"; npc.affinity = clampN(Math.min(npc.affinity, 20), -100, 100);
      return [`You gently end your courtship with ${npc.name}. The romance fades, though a wary friendship remains.`];
    }
    case "expel": {
      if (npc.role !== "disciple") return ["They are not your disciple to expel."];
      npc.role = "enemy"; npc.resides = false; delete npc.kin; adj(-rng.randint(15, 30)); happy(-2);
      note(c, `Expelled ${npc.name} from the sect.`);
      return [`You strike ${npc.name}'s name from the rolls and cast them out. A disgraced disciple seldom forgives — you have made an enemy.`];
    }
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
  n.kin = "Disciple"; n.learned = [];
  E.ensureNpcProfile(n, rng, { realm: Math.max(0, c.realm - rng.randint(2, 4)) });
  c.relationships.push(n);
  c.happiness = clampN(c.happiness + 4, 0, 100);
  note(c, `Took ${n.name} as a disciple.`);
  return [`You take ${n.name} under your wing as a disciple. They kowtow three times, eyes brimming.`];
}

/* ----------------- the wider realm: meeting its cultivators --------------- */
// The world population is not mere scenery: a cultivator dwelling where you stand
// can be sought out as a bond (or even a master), recruited into a sect you lead,
// or challenged. Winning them over MOVES them out of the population and into your
// relationships, where the ordinary relationship system takes over.
const atYourLocation = (c, npc) => !!(npc && npc.alive && npc.home != null && npc.home === c.location);

function removeDenizen(c, npc) {
  const pop = c.world && c.world.npcs;
  if (pop) { const i = pop.indexOf(npc); if (i >= 0) pop.splice(i, 1); }
}

// The interactions available with a world denizen (only where you both stand).
export function denizenActions(c, npc) {
  const acts = [];
  if (!atYourLocation(c, npc)) return acts;
  acts.push({ id: "acquaint", label: "Seek their acquaintance" });
  if (c.ownSect && !npc.sectKey) acts.push({ id: "recruit", label: "Recruit to your sect" });
  if (c.awakened && c.age >= D.ageMin("duel") && (npc.power || 0) <= E.power(c) * 3.2)
    acts.push({ id: "challenge", label: "Challenge to a duel" });
  return acts;
}

// Try to win a denizen's acquaintance — charm, renown and a near-enough realm help.
// On success they join your bonds (a friend, a wary rival, or, if far mightier and
// taken with you, a Master); on failure they remain a stranger of the realm.
export function acquaintDenizen(c, npc, rng) {
  if (!atYourLocation(c, npc)) return [`${npc.name} is not here to be met.`];
  E.ensureNpcProfile(npc, rng);
  const pull = c.charm + (["striking", "peerless", "immortal"].includes(c.appearanceKey) ? 15 : 0);
  const gap = (npc.realm || 0) - (c.realm || 0);
  const chance = clampN(0.42 + pull / 220 + c.reputation / 600 + (npc.sectKey && npc.sectKey === c.sectKey ? 0.2 : 0) - Math.max(0, gap) * 0.07, 0.08, 0.95);
  if (rng.random() >= chance)
    return [`${npc.name} hears you out with cool courtesy, but no rapport takes. Raise your renown and seek them again another year.`];
  removeDenizen(c, npc);
  delete npc.title;                                   // a bond, not a board-listing
  let role = "friend", aff = 16 + Math.floor(pull / 8), line;
  if (gap >= 3 && c.reputation >= 25 && !E.findNpc(c, "master") && rng.random() < 0.55) {
    role = "master"; aff = 30;
    line = `✦ ${npc.name} sees rare promise in you and offers to take you in hand — you have found a Master!`;
  } else if (npc.sectKey === "bloodcult" || rng.random() < 0.12) {
    role = "rival"; aff = -8;
    line = `You cross words with ${npc.name}; sparks fly, and a wary rivalry is born.`;
  }
  npc.role = role; npc.affinity = clampN(aff, -100, 100); npc.met = true;
  if (!line) line = `You strike up an acquaintance with ${npc.name}. A new bond enters your life. (${E.npcStatus(npc)})`;
  c.relationships.push(npc);
  c.happiness = clampN(c.happiness + 3, 0, 100);
  note(c, `Made the acquaintance of ${npc.name}${role === "master" ? ", who became your master" : ""}.`);
  return [line];
}

// Draw an unaffiliated cultivator into a sect you lead — a named disciple, and a
// little more prestige and strength for your banner.
export function recruitDenizen(c, npc, rng) {
  if (!c.ownSect) return ["You lead no sect to recruit into."];
  if (!atYourLocation(c, npc)) return [`${npc.name} is not here.`];
  if (npc.sectKey) return [`${npc.name} already wears another sect's crest.`];
  const cap = sectCapacity(c);
  if (c.ownSect.members >= cap) return [`Your halls are full (${c.ownSect.members}/${cap}). Expand your abode to make room for more.`];
  E.ensureNpcProfile(npc, rng);
  const chance = clampN(0.4 + c.charm / 250 + c.reputation / 500 + (E.power(c) > (npc.power || 0) ? 0.18 : -0.12), 0.1, 0.92);
  if (rng.random() >= chance)
    return [`${npc.name} declines to bend the knee to a fledgling banner. Win greater renown, and such talents will come of their own accord.`];
  removeDenizen(c, npc);
  delete npc.title;
  npc.role = "disciple"; npc.kin = "Disciple"; npc.learned = npc.learned || [];
  npc.affinity = clampN(42 + Math.floor(c.charm / 10), -100, 100); npc.resides = false;
  c.relationships.push(npc);
  c.ownSect.members += 1; c.ownSect.prestige += 2 + (npc.realm || 0);
  note(c, `Recruited ${npc.name} into the ${c.ownSect.name}.`);
  return [`✦ ${npc.name} pledges to your banner — a new disciple of the ${c.ownSect.name}. (+1 member, +prestige)`];
}

// Settle a won challenge against a local cultivator: renown rises, and the bested
// foe (slain or driven off) leaves the realm's roster.
export function defeatDenizen(c, npc, rng) {
  removeDenizen(c, npc);
  const fame = E.gainFame(c, 4 + (npc.realm || 0));   // a public victory; your presence spreads it
  c.happiness = clampN(c.happiness + 4, 0, 100);
  note(c, `Bested ${npc.name} in a duel.`);
  return [`✦ You best ${npc.name} before the watching realm; your name carries the further for it. (+${fame} fame)`];
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
// The abode's biome — from the map location it was staked on, with old saves
// falling back to the stored region key.
export const abodeRegionKey = c => {
  const loc = (c.abodeLocation != null && World.locById) ? World.locById(c, c.abodeLocation) : null;
  return (loc && loc.biome) || c.abodeRegion || c.region || "azuredomain";
};
export const abodeLocName = c => { const loc = (c.abodeLocation != null) ? World.locById(c, c.abodeLocation) : null; return loc ? loc.name : null; };

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
  if (c.beast && c.beast.alive) {  // beast forages (better the higher its rank; an Auspicious beast richer still)
    const aus = E.beastTraitOf(c.beast) === "auspicious" ? 2 : 1;
    herbs += ((c.beast.rank || 1) + Math.floor((c.abode || 0) / 2)) * aus; stones += Math.floor(c.abode || 0) * aus;
  }
  c.herbs += Math.round(herbs * danger);
  c.spiritStones += Math.round(stones * danger);
  // Living among your own spirit vein steadies the heart; resident disciples
  // grow stronger in the abode's dense qi.
  if (residents.some(n => n.role === "companion")) c.happiness = clampN(c.happiness + 1, 0, 100);
  for (const d of residents) if (d.role === "disciple") d.power = (d.power || 1) * 1.015;
}

// Establish a new abode or upgrade your existing one (administrative — no year,
// no deed; you simply spend the stones). Returns narration lines.
export function upgradeAbode(c, rng) {
  const next = D.abodeNext(c.abode || 0);
  if (!next) return ["Your abode is already a Cave Heaven — the very pinnacle. There is nothing higher to build."];
  if (!c.abode && !D.oldEnoughFor(c, "abode")) return [`You are too young to stake a claim on a spirit vein. Only at age ${D.ageMin("abode")} may one establish a cave dwelling.`];
  if (c.spiritStones < next[3]) return [`You need ${next[3]} spirit stones to ${c.abode ? "expand your abode into" : "establish"} the ${next[1]}. (You have ${c.spiritStones}.)`];
  const was = c.abode || 0;
  c.spiritStones -= next[3];
  c.abode = next[0];
  if (!was) { c.abodeLocation = c.location; c.abodeRegion = World.biomeKeyOf(World.currentLoc(c)) || c.region || "azuredomain"; }   // rooted where you raise it
  note(c, `${was ? "Upgraded your abode to" : "Established"} the ${next[1]} (${next[2]}).`);
  const reg = D.REGION_BY_KEY[abodeRegionKey(c)];
  const here = abodeLocName(c);
  const where = was ? "" : ` at ${here || (reg ? reg[1] : "the wilds")}`;
  const out = [`${was ? "You pour resources into the works, and your abode rises into" : "You stake your claim on a spirit vein" + where + " and raise"} the ${next[1]} (${next[2]})! Each year it now yields ${next[5]} spirit herbs and ${next[6]} stones${reg && reg[3] > 1 ? ` (×${reg[3]} for the wild region)` : ""}, and quickens your cultivation by +${Math.round(next[4] * 100)}%.`];
  // Hewing a top-tier abode deep into a spirit vein can unearth something old and
  // watchful sleeping in the stone — arming the Sealed Will arc.
  if ((c.abode || 0) >= 5 && c.realm >= 3 && E.armArc(c, "sealedwill", rng, 0.3))
    out.push("Deep in the new-hewn vault, where the spirit-vein runs richest, your workers strike something that should not be there — and that night, something cold and patient settles in behind your eyes.");
  return out;
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
  c.ownSect = { name: sectName, prestige: 0, members: 5 + core * 4, founded: c.age, alignment, _tier: null, library: [] };
  // your resident disciples become the founding core — settle them at the seat
  for (const n of c.relationships) if (n.alive && n.role === "disciple") n.resides = true;
  c.reputation += 10;
  if (!c.titles.includes("Founder")) c.titles.push("Founder");
  note(c, `Founded the ${sectName} (${alignment}), seated at your abode.`);
  const out = [`✦ You raise your banner and found the ${sectName}! Your cave abode becomes its mountain seat. Disciples will gather to your name — the sect will rise, or fall, with you.`];
  // The weight of leading a power tempts even the upright toward forbidden
  // shortcuts — and a demonic banner all the more. Arms the Demon-Path arc.
  if (E.armArc(c, "demonpath", rng, alignment === "demonic" ? 0.6 : 0.12 - c.karma / 600))
    out.push("That first night beneath your own banner, a cold thought visits you unbidden: how much faster the sect would rise, if you were willing to pay in blood...");
  return out;
}

// The sect's quiet year: it recruits toward its seat's capacity, gains prestige
// from your strength and following, spreads your name, and pays a stipend.
function sectYearly(c, rng, events) {
  const s = c.ownSect; if (!s) return;
  E.tickSectWorld(c, rng);   // the realm's rival sects rise, fall and rebuild
  const cap = sectCapacity(c);
  const coreDisc = c.relationships.filter(n => n.alive && n.role === "disciple").length;
  if (s.members < cap) {
    // A charismatic founder draws recruits the faster (presence widens the appeal).
    const gain = Math.max(1, Math.round((cap - s.members) * (0.04 + c.reputation / 4000 + s.prestige / 9000) * E.presenceMult(c)));
    s.members = Math.min(cap, s.members + gain);
  } else if (s.members > cap) s.members = cap;
  s.prestige += (c.realm * 0.6 + Math.min(6, c.abode || 0) * 0.5 + s.members * 0.02 + coreDisc * 0.5 + Math.max(0, c.reputation) * 0.01 + E.sectLibraryBonus(s)) * E.presenceMult(c);
  const tier = D.sectTier(s.prestige);
  c.reputation += Math.round(tier[4] * E.presenceMult(c));   // your presence spreads the sect's name further
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
    n.kin = "Disciple"; n.learned = []; n.resides = true;
    E.ensureNpcProfile(n, rng, { realm: Math.max(0, c.realm - rng.randint(2, 4)) });
    c.relationships.push(n);
    msgs.push(`Among them, a true talent — ${n.name} — kneels as your personal disciple and takes up residence at the seat.`);
  }
  return msgs;
}

export const RECLAIM_SECT_COST = 200;   // cheaper than founding — the sect already stands
export function canReclaimSect(c) {
  return c.alive && c.awakened && !c.sectKey && !c.ownSect && !!c.legacySect &&
    c.realm >= FOUND_SECT_MIN_REALM && (c.abode || 0) >= FOUND_SECT_MIN_ABODE && c.spiritStones >= RECLAIM_SECT_COST;
}
export function reclaimSectReason(c) {
  if (!c.legacySect) return null;
  if (c.realm < FOUND_SECT_MIN_REALM) return `Reach the ${D.REALMS[FOUND_SECT_MIN_REALM][0]} realm to be worthy of reclaiming it.`;
  if ((c.abode || 0) < FOUND_SECT_MIN_ABODE) return "Raise a cave abode to tier 3 to re-seat the sect.";
  if (c.spiritStones < RECLAIM_SECT_COST) return `Gather ${RECLAIM_SECT_COST} spirit stones to reclaim it (you have ${c.spiritStones}).`;
  return null;
}
// Return to the sect you founded in a past life. Its old disciples recognize the
// founder's reborn soul; you restore it with its (faded) prestige and members.
export function reclaimSect(c, rng) {
  if (!c.legacySect) return ["You have no past sect awaiting your return."];
  if (c.ownSect) return [`You already lead the ${c.ownSect.name}.`];
  if (c.sectKey) return ["Leave your current sect before reclaiming your old banner."];
  if (c.realm < FOUND_SECT_MIN_REALM) return [`Your old sect waits, but it will not bow to a weakling: reach the ${D.REALMS[FOUND_SECT_MIN_REALM][0]} realm first.`];
  if ((c.abode || 0) < FOUND_SECT_MIN_ABODE) return ["Your reborn sect needs a worthy seat — raise your cave abode to at least a Spirit-Gathering Abode (tier 3) first."];
  if (c.spiritStones < RECLAIM_SECT_COST) return [`Reclaiming the rites and re-seating the sect costs ${RECLAIM_SECT_COST} spirit stones. (You have ${c.spiritStones}.)`];
  const lg = c.legacySect;
  c.spiritStones -= RECLAIM_SECT_COST;
  c.ownSect = { name: lg.name, prestige: lg.prestige, members: Math.min(sectCapacity(c), lg.members), founded: c.age, alignment: lg.alignment, _tier: null, library: lg.library || [] };
  c.legacySect = null;
  c.reputation += 8;
  if (!c.titles.includes("Founder")) c.titles.push("Founder");
  note(c, `Reclaimed the ${lg.name}, your sect from a past life.`);
  return [`✦ You walk through the old gates and the disciples of the ${lg.name} fall to their knees — the founder's soul has returned! You reclaim your sect, ${D.sectTier(lg.prestige)[1]} prestige and all, with a single life's work already behind it.`];
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
