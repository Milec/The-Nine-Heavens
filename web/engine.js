/* The Nine Heavens -- game engine (JS port of the Python nine_heavens package).
 * Pure logic: every action takes the character + rng and returns an array of
 * message strings, mutating the character. The UI layer renders those messages. */

import * as D from "./data.js";

/* ----------------------------- RNG --------------------------------------- */
// Small seedable PRNG (mulberry32) so a saga can be reproduced from a seed.
export class RNG {
  constructor(seed) {
    if (seed === undefined || seed === null)
      seed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
    this.s = seed >>> 0;
  }
  random() {
    this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a, b) { return a + (b - a) * this.random(); }
  randint(a, b) { return a + Math.floor(this.random() * (b - a + 1)); }
  choice(arr) { return arr[Math.floor(this.random() * arr.length)]; }
  sample(arr, k) {
    const pool = arr.slice(); const out = [];
    for (let i = 0; i < k; i++) out.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return out;
  }
  choices(arr, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.random() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
}

function weightedChoice(rng, table, wi) {
  return rng.choices(table, table.map(row => row[wi]));
}
function rollAttribute(rng, low = 1, high = 100) {
  const r = (rng.random() + rng.random() + rng.random()) / 3.0;
  return low + Math.round(r * (high - low));
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------- derived stats --------------------------------- */
export const realmName = c => D.REALMS[c.realm][0];
export const realmCn = c => D.REALMS[c.realm][1];
export const realmStages = c => D.REALMS[c.realm][2];
export function realmLabel(c) {
  const s = D.stageLabel(c.stage, realmStages(c));
  return s ? `${realmName(c)} – ${s}` : realmName(c);
}
export const qiToNext = c => D.REALMS[c.realm][4] * (1 + c.stage * 0.55);
const techQiBonus = c => c.techniques.reduce((a, t) => a + (D.TECHNIQUES[t] ? D.TECHNIQUES[t][2] : 0), 0);
const techAtkBonus = c => c.techniques.reduce((a, t) => a + (D.TECHNIQUES[t] ? D.TECHNIQUES[t][3] : 0), 0);
export const sectOf = c => c.sectKey ? D.SECT_BY_KEY[c.sectKey] : null;
export const sectName = c => sectOf(c) ? sectOf(c)[1] : "Rogue Cultivator (散修)";
export const rankName = c => sectOf(c) ? D.SECT_RANKS[c.sectRank][0] : "";
export const sectSpeedBonus = c => sectOf(c) ? sectOf(c)[7] + D.SECT_RANKS[c.sectRank][3] : 0;
export const artifactOf = c => c.equippedArtifact ? D.ARTIFACT_BY_KEY[c.equippedArtifact] : null;
const artifactAtkPct = c => artifactOf(c) ? artifactOf(c)[3] : 0;
const artifactQiBonus = c => artifactOf(c) ? artifactOf(c)[4] : 0;
export const daoPowerBonus = c => c.daos.reduce((a, d) => a + (D.DAO_BY_KEY[d] ? D.DAO_BY_KEY[d][2] : 0), 0);
export const daoBreakthroughBonus = c => c.daos.reduce((a, d) => a + (D.DAO_BY_KEY[d] ? D.DAO_BY_KEY[d][3] : 0), 0);
export const beastPower = c => (c.beast && c.beast.alive) ? c.beast.power : 0;
export const abodeQiBonus = c => { const a = D.abodeAt(c.abode || 0); return a ? a[4] : 0; };
// A proper pill room appears at the Spirit-Gathering Abode (tier 3) and up,
// steadying the furnace — a small alchemy success/quality bonus.
export const abodeAlchemyBonus = c => Math.max(0, (c.abode || 0) - 2) * 0.04;
// Leading your own thriving sect quickens your dao (its formations and the
// devotion of your disciples), scaling with the sect's prestige tier.
export const ownSectSpeedBonus = c => c.ownSect ? D.sectTier(c.ownSect.prestige)[3] : 0;
// The world era's pull on cultivation (Abundance quickens, Drought stifles).
export const eraCultMult = c => D.eraAt(c.era)[4];
export const eraBreakBonus = c => D.eraAt(c.era)[6];

export function cultivationSpeed(c) {
  const rootMult = c.root ? c.root.multiplier : 0.1;
  const comp = 0.55 + c.comprehension / 70.0;
  const realmFactor = Math.pow(D.REALMS[c.realm][4], 0.5);
  const timeDao = c.daos.includes("time") ? 0.25 : 0.0;
  const phys = D.physEffect(c).cultivate || 0;
  return rootMult * comp * (1 + techQiBonus(c)) * realmFactor * 1.8 *
    (1 + sectSpeedBonus(c) + artifactQiBonus(c) + timeDao + phys + abodeQiBonus(c) + ownSectSpeedBonus(c)) *
    eraCultMult(c);
}
// Martial might from body cultivation — its own power base, independent of qi
// realm, so a body cultivator (even rootless) can grow truly strong.
export const bodyMartialBase = c => D.bodyRealmAt(c.bodyRealm || 0)[3];
export function basePower(c) {
  const rf = c.realm * 10 + c.stage + 1;
  const base = Math.pow(rf, 2.1) + bodyMartialBase(c);
  return base * (1 + c.constitution * 0.8 / 100 + c.soul * 0.5 / 100) + techAtkBonus(c) * rf;
}
export function power(c) {
  return basePower(c) * (1 + artifactAtkPct(c) + daoPowerBonus(c)) + beastPower(c);
}

/* ---------------------------- body cultivation --------------------------- */
// Tempering speed is driven by constitution and physique — not your root — so it
// is open to everyone, and the only road left to the rootless.
export function bodyTemperingSpeed(c) {
  const phys = D.PHYSIQUES.find(p => p[0] === c.physiqueKey);
  const bodyMult = phys ? phys[3] : 1.0;
  const stageDrag = Math.pow(0.93, c.bodyRealm || 0);   // each tier is a little harder
  return bodyMult * (0.6 + c.constitution / 60) * (1 + c.comprehension / 400) * 2.4 * stageDrag;
}
export const bodyRealmCap = c => { const v = D.PHYSIQUE_BODY_CAP[c.physiqueKey]; return Math.min(D.BODY_REALMS.length - 1, v != null ? v : 4); };
export const canTemperMore = c => (c.bodyRealm || 0) < bodyRealmCap(c);
// Temper the body, advancing through body realms as the threshold is crossed.
export function temperBody(c, rng, intensity = 1.0) {
  const msgs = [];
  if (!c.alive) return msgs;
  c.temper = (c.temper || 0) + bodyTemperingSpeed(c) * intensity * rng.uniform(0.9, 1.15);
  while (canTemperMore(c) && c.temper >= D.BODY_REALMS[(c.bodyRealm || 0) + 1][2]) {
    c.bodyRealm = (c.bodyRealm || 0) + 1;
    recomputeMaxHp(c); recomputeMaxAge(c); if (c.hp < c.maxHp) c.hp = c.maxHp;
    const br = D.BODY_REALMS[c.bodyRealm];
    note(c, `Body realm broke through to ${br[0]} (${br[1]}).`);
    msgs.push(`⛰ Your body breaks through to the ${br[0]} (${br[1]})! Flesh and bone reforged.`);
  }
  if (!msgs.length) {
    if (!canTemperMore(c)) msgs.push(`You temper your body, but it has reached the very limit your ${D.PHYSIQUES.find(p => p[0] === c.physiqueKey)[1]} can bear — the ${D.bodyRealmName(c.bodyRealm)}.`);
    else msgs.push(`You temper your body through pain and iron. (${Math.floor(c.temper)}/${Math.floor(D.BODY_REALMS[(c.bodyRealm || 0) + 1][2])})`);
  }
  return msgs;
}
export const karmaLabelFor = c => D.karmaLabel(c.karma);

export function recomputeMaxHp(c) {
  const rf = c.realm * 10 + c.stage + 1;
  const br = D.bodyRealmAt(c.bodyRealm || 0);
  c.maxHp = (40 + c.constitution * 1.5 + rf * 12) * (1 + br[4]) + bodyMartialBase(c) * 0.12;
  c.hp = c.hp > 0 ? Math.min(c.hp, c.maxHp) : c.maxHp;
}
// Lifespan = your qi realm's span, lengthened by a tempered body and longevity pills.
export function recomputeMaxAge(c) {
  c.maxAge = D.REALMS[c.realm][3] + D.bodyRealmAt(c.bodyRealm || 0)[5] + (c.longevityBonus || 0);
}
function note(c, text) { c.log.push([c.age, text]); }

export function beastTier(b) {
  const r = b.rank || (b.power < 200 ? 1 : b.power < 2000 ? 2 : b.power < 20000 ? 3 : b.power < 200000 ? 4 : 5);
  return D.beastRankName(r);
}
// Back-fill the progression fields on a beast (older saves / freshly-tamed).
export function normalizeBeast(b) {
  if (!b) return b;
  if (b.rank == null) b.rank = (b.power < 200 ? 1 : b.power < 2000 ? 2 : b.power < 20000 ? 3 : b.power < 200000 ? 4 : 5);
  if (b.bond == null) b.bond = b.loyalty != null ? b.loyalty : 50;
  if (b.baseSpecies == null) b.baseSpecies = b.species;
  if (b.element === undefined) b.element = D.beastElement(b.species);
  if (b.exp == null) b.exp = 0;
  if (b.fedThisYear == null) b.fedThisYear = 0;
  return b;
}

/* ------------------------- birth generation ------------------------------ */
function makeName(rng) {
  let given = rng.choice(D.GIVEN_FIRST);
  if (rng.random() < 0.6) given += rng.choice(D.GIVEN_SECOND);
  return `${rng.choice(D.SURNAMES)} ${given}`;
}
function rollRoot(rng, forcedKey) {
  const row = forcedKey ? D.ROOT_TYPES.find(r => r[0] === forcedKey) : weightedChoice(rng, D.ROOT_TYPES, 4);
  const [key, display, mult0, comp, , blurb] = row;
  let elements = [];
  if (key === "waste") elements = D.ELEMENTS.slice();
  else if (key === "quad") elements = rng.sample(D.ELEMENTS, 4);
  else if (key === "triple") elements = rng.sample(D.ELEMENTS, 3);
  else if (key === "dual") elements = rng.sample(D.ELEMENTS, 2);
  else if (key === "heavenly") elements = [rng.choice(D.ELEMENTS)];
  else if (key === "variant") elements = [rng.choice(D.VARIANT_ELEMENTS)];
  else if (key === "chaos") elements = ["Chaos"];
  const mult = Math.round(mult0 * rng.uniform(0.9, 1.12) * 1000) / 1000;
  return { key, display, multiplier: mult, comprehensionBonus: comp, elements, blurb };
}

function newCharacter() {
  return {
    name: "Nameless", age: 0, root: null,
    physiqueKey: "ordinary", physiqueName: "", physiqueBlurb: "",
    backgroundKey: "peasant", backgroundName: "", backgroundBlurb: "",
    omen: "", appearanceKey: "ordinary", appearanceName: "", appearanceBlurb: "",
    comprehension: 30, constitution: 30, soul: 30, luck: 30, charm: 30,
    realm: 0, stage: 0, qi: 0, maxAge: 80, bodyRealm: 0, temper: 0, longevityBonus: 0,
    spiritStones: 0, reputation: 0, techniques: ["basic_breathing"], inventory: [], pills: 0,
    sectKey: null, sectRank: 0, contribution: 0, titles: [], relationships: [],
    herbs: 0, healingPills: 0, breakthroughPills: 0, alchemySkill: 0,
    artifacts: [], equippedArtifact: null, beast: null, abode: 0, abodeRegion: null, ownSect: null, legacySect: null,
    daos: [], daoInsight: 0, karma: 0, reincarnationCount: 0,
    mastery: {},
    hp: 50, maxHp: 50, alive: true, causeOfDeath: "", log: [],
  };
}

// `opts` may force any birth choice: { rootKey, physiqueKey, backgroundKey,
// appearanceKey, omenIndex }. Anything omitted is rolled at random as before.
export function generateCharacter(rng, name, opts = {}) {
  const pick = (table, wi, key, keyIdx = 0) => key ? (table.find(r => r[keyIdx] === key) || weightedChoice(rng, table, wi)) : weightedChoice(rng, table, wi);
  const c = newCharacter();
  c.name = name || makeName(rng);
  c.root = rollRoot(rng, opts.rootKey);

  const [pk, pdisp, pblurb, bodyM, qiM, soulM, luckB] = pick(D.PHYSIQUES, 7, opts.physiqueKey);
  c.physiqueKey = pk; c.physiqueName = pdisp; c.physiqueBlurb = pblurb;

  const [bk, bdisp, bblurb, rep, stones, items] = pick(D.BACKGROUNDS, 6, opts.backgroundKey);
  c.backgroundKey = bk; c.backgroundName = bdisp; c.backgroundBlurb = bblurb;
  c.reputation = rep; c.spiritStones = stones; c.inventory = items.slice();

  const [omen, oComp, oBody, oSoul, oLuck] = (opts.omenIndex != null && D.BIRTH_OMENS[opts.omenIndex]) ? D.BIRTH_OMENS[opts.omenIndex] : weightedChoice(rng, D.BIRTH_OMENS, 5);
  c.omen = omen;

  const [ak, adisp, charmBonus, ablurb] = pick(D.APPEARANCES, 4, opts.appearanceKey);
  c.appearanceKey = ak; c.appearanceName = adisp; c.appearanceBlurb = ablurb;

  c.comprehension = rollAttribute(rng) + c.root.comprehensionBonus + oComp;
  c.constitution = rollAttribute(rng) + oBody;
  c.soul = rollAttribute(rng) + oSoul;
  c.luck = rollAttribute(rng) + luckB + oLuck;
  c.charm = rollAttribute(rng) + charmBonus;

  c.constitution = Math.round(c.constitution * bodyM);
  c.soul = Math.round(c.soul * soulM);
  if (qiM !== 1.0) c.root.multiplier = Math.round(c.root.multiplier * qiM * 1000) / 1000;

  const nurture = {
    scholar: ["comprehension", 8], noble: ["comprehension", 6], royal: ["luck", 10],
    martial: ["constitution", 10], hermit: ["comprehension", 12], demon: ["soul", 8],
    slave: ["constitution", -6], beggar: ["luck", -4],
  };
  if (nurture[bk]) { const [a, d] = nurture[bk]; c[a] += d; }
  for (const a of ["comprehension", "constitution", "soul", "luck", "charm"])
    c[a] = clamp(c[a], 1, 160);

  recomputeMaxAge(c);
  recomputeMaxHp(c);
  note(c, `Born as ${c.name}, ${c.backgroundName}.`);
  note(c, `Spiritual root: ${c.root.display}.`);
  return c;
}

/* ------------------------------- genetics -------------------------------- */
// Children inherit a blend of BOTH parents: spiritual-root tier (with mutation),
// special physiques that can run in a bloodline, looks, and core attributes.
const GENO_SPECIALS = ["sturdy", "spirit", "yin", "yang", "dao", "immortal"];
const apprIdx = key => { const i = D.APPEARANCES.findIndex(a => a[0] === key); return i < 0 ? 2 : i; };
const genomeShape = (rootKey, physiqueKey, appearanceKey, comp, con, soul, luck, charm) =>
  ({ rootKey, physiqueKey, appearanceKey, comprehension: comp, constitution: con, soul, luck, charm });

// A latent, unrevealed genome for an NPC (a spouse's heritable talent).
export function rollGenome(rng) {
  // talent tends to attract talent: a dao companion's root is the better of two draws.
  const rootKey = [weightedChoice(rng, D.ROOT_TYPES, 4), weightedChoice(rng, D.ROOT_TYPES, 4)]
    .sort((a, b) => (D.ROOT_TIER[b[0]] || 0) - (D.ROOT_TIER[a[0]] || 0))[0][0];
  return genomeShape(rootKey, weightedChoice(rng, D.PHYSIQUES, 7)[0], weightedChoice(rng, D.APPEARANCES, 4)[0],
    rollAttribute(rng), rollAttribute(rng), rollAttribute(rng), rollAttribute(rng), rollAttribute(rng));
}
// The player's own heritable genome.
export const playerGenome = c => genomeShape(c.root ? c.root.key : "waste", c.physiqueKey || "ordinary",
  c.appearanceKey || "ordinary", c.comprehension, c.constitution, c.soul, c.luck, c.charm);

export function inheritGenome(ga, gb, rng) {
  const ta = D.ROOT_TIER[ga.rootKey] || 0, tb = D.ROOT_TIER[gb.rootKey] || 0;
  const hi = Math.max(ta, tb), lo = Math.min(ta, tb);
  let t; const r = rng.random();
  if (r < 0.35) t = hi; else if (r < 0.60) t = lo; else t = Math.round((hi + lo) / 2);
  const m = rng.random();
  if (m < 0.02) t += 2; else if (m < 0.12) t += 1; else if (m < 0.20) t -= 1;
  t = clamp(t, 0, 6);
  let rootKey = D.ROOT_BY_TIER[t] || "triple";
  if (t === 0 && rng.random() < 0.25) rootKey = "none";          // a tragic rootless child
  let physiqueKey = "ordinary";
  if (GENO_SPECIALS.includes(ga.physiqueKey) && rng.random() < 0.45) physiqueKey = ga.physiqueKey;
  else if (GENO_SPECIALS.includes(gb.physiqueKey) && rng.random() < 0.45) physiqueKey = gb.physiqueKey;
  else if (rng.random() < 0.03) physiqueKey = rng.choice(GENO_SPECIALS);
  let ai = Math.round((apprIdx(ga.appearanceKey) + apprIdx(gb.appearanceKey)) / 2) + rng.choice([-1, 0, 0, 1]);
  ai = clamp(ai, 0, D.APPEARANCES.length - 1);
  const blend = k => clamp(Math.round((ga[k] + gb[k]) / 2 * rng.uniform(0.55, 0.85)) + rng.randint(0, 8), 6, 140);
  return genomeShape(rootKey, physiqueKey, D.APPEARANCES[ai][0],
    blend("comprehension"), blend("constitution"), blend("soul"), blend("luck"), blend("charm"));
}

/* --------------------------- NPC cultivator profiles --------------------- */
// Every named NPC is a cultivator in their own right: a spiritual root, physique,
// realm and techniques — from which their combat power derives (same maths as you).
const NPC_TECH_POOL = Object.keys(D.TECHNIQUES).filter(k => k !== "basic_breathing");
export function npcPower(npc) {
  const rf = (npc.realm || 0) * 10 + (npc.stage || 0) + 1;
  const g = npc.geno || {};
  const con = g.constitution || 40, soul = g.soul || 40;
  const techAtk = (npc.techniques || []).reduce((a, t) => a + (D.TECHNIQUES[t] ? D.TECHNIQUES[t][3] : 0), 0);
  const p = Math.pow(rf, 2.1) * (1 + con * 0.8 / 100 + soul * 0.5 / 100) + techAtk * rf;
  return Math.max(2, Math.round(p));
}
export const npcRealmName = npc => D.REALMS[npc.realm || 0][0];
export const npcRootName = npc => { const r = D.ROOT_TYPES.find(x => x[0] === (npc.geno && npc.geno.rootKey)); return r ? r[1] : "Unknown"; };
// Fill in any missing cultivator fields (idempotent; back-derives realm from an
// existing power for older saves). opts: { realm, stage, power }.
export function ensureNpcProfile(npc, rng, opts = {}) {
  if (!npc) return npc;
  if (!npc.geno) npc.geno = rollGenome(rng);
  if (npc.physiqueKey == null) npc.physiqueKey = npc.geno.physiqueKey;
  if (npc.realm == null) {
    if (opts.realm != null) npc.realm = clamp(opts.realm, 0, D.REALMS.length - 1);
    else if (npc.power) npc.realm = clamp(Math.round((Math.pow(Math.max(1, npc.power), 1 / 2.1) - 1) / 10), 0, D.REALMS.length - 1);
    else npc.realm = 0;
  }
  if (npc.stage == null) npc.stage = opts.stage != null ? opts.stage : (npc.realm > 0 ? rng.randint(0, Math.max(0, D.REALMS[npc.realm][2] - 1)) : 0);
  if (!npc.techniques) {
    const techs = ["basic_breathing"], avail = NPC_TECH_POOL.slice();
    const n = Math.min(avail.length, Math.floor(npc.realm / 2) + (rng.random() < 0.6 ? 1 : 0));
    for (let i = 0; i < n && avail.length; i++) techs.push(avail.splice(Math.floor(rng.random() * avail.length), 1)[0]);
    npc.techniques = techs;
  }
  if (npc.element === undefined) { const r = rollRoot(rng, npc.geno.rootKey); npc.element = r.elements.length ? r.elements[0] : null; }
  if (opts.power != null) npc.power = opts.power;
  else if (!npc.power) npc.power = npcPower(npc);
  return npc;
}

// How far an NPC can climb, by the talent of their spiritual root (their destiny,
// as yours is yours). The rootless cannot gather qi at all.
const NPC_REALM_CAP = { none: 0, waste: 3, quad: 4, triple: 5, dual: 6, heavenly: 8, variant: 9, chaos: 10 };
// Advance an NPC one step along their own cultivation each year. Returns "realm"
// when they break into a new realm, "stage" for a lesser step, else null.
export function advanceNpc(npc, rng) {
  if (!npc || !npc.alive || npc.realm == null || !npc.geno) return null;
  const rootKey = npc.geno.rootKey || "waste";
  if (rootKey === "none") return null;                 // the rootless cannot gather qi
  const cap = NPC_REALM_CAP[rootKey] != null ? NPC_REALM_CAP[rootKey] : 4;
  if (npc.realm >= cap) { npc.power = Math.max(npc.power || 0, Math.round(npcPower(npc) * rng.uniform(1.0, 1.01))); return null; }
  const tier = D.ROOT_TIER[rootKey] || 0;
  const speed = (0.30 + tier * 0.22) / Math.pow(1.5, npc.realm);     // talent quickens; high realms slow
  npc.cultProgress = (npc.cultProgress || 0) + speed * rng.uniform(0.6, 1.25);
  if (npc.cultProgress < 1) return null;
  npc.cultProgress -= 1;
  let broke = false;
  if (npc.stage < D.REALMS[npc.realm][2] - 1) npc.stage += 1;
  else { npc.realm += 1; npc.stage = 0; broke = true; }
  if (broke && rng.random() < 0.4) {                                  // sometimes grasp a new art
    const unknown = Object.keys(D.TECHNIQUES).filter(k => k !== "basic_breathing" && !(npc.techniques || []).includes(k));
    if (unknown.length) (npc.techniques = npc.techniques || ["basic_breathing"]).push(rng.choice(unknown));
  }
  npc.power = Math.max(npc.power || 0, npcPower(npc));
  return broke ? "realm" : "stage";
}

export function reincarnate(old, rng, name) {
  const c = generateCharacter(rng, name);
  c.reincarnationCount = old.reincarnationCount + 1;
  const legacy = old.realm * 3 + old.daos.length * 4;
  c.comprehension = Math.min(160, c.comprehension + Math.min(45, legacy));
  c.soul = Math.min(160, c.soul + Math.min(35, old.realm * 2 + old.daos.length * 2));
  c.luck = Math.min(160, c.luck + Math.min(20, old.realm));
  c.karma = Math.trunc(old.karma * 0.3);
  c.qi += qiToNext(c) * 0.5;
  recomputeMaxHp(c);
  note(c, `A soul reborn (rebirth #${c.reincarnationCount}), dimly recalling a past life that reached ${realmName(old)}.`);
  if (old.equippedArtifact && old.realm >= 4 && rng.random() < 0.4) {
    c.artifacts.push(old.equippedArtifact);
    c.equippedArtifact = old.equippedArtifact;
    const art = D.ARTIFACT_BY_KEY[old.equippedArtifact];
    note(c, `Across rebirth you still grasp the ${art[1]} (${art[2]} grade).`);
  }
  return c;
}

/* --------------------------- cultivation --------------------------------- */
const atRealmWall = c => c.stage >= realmStages(c) - 1;

// Ageless burst of cultivation (used by the web "deed" model): gain a fraction
// of a year's qi with no passage of time. `intensity` is in year-equivalents.
export function gainQi(c, rng, intensity = 0.5, usePill = false) {
  const msgs = [];
  if (!c.alive) return msgs;
  let pillMult = 1.0;
  if (usePill && c.pills > 0) { c.pills -= 1; pillMult = 2.5; msgs.push("You swallow a Qi-Gathering Pill; warmth floods your meridians."); }
  const epiphany = rng.random() < (c.luck / 1500.0 + c.comprehension / 4000.0);
  let gain = cultivationSpeed(c) * intensity * pillMult * rng.uniform(0.85, 1.2);
  if (epiphany) { gain *= rng.uniform(2.5, 5.0); msgs.push("✦ A sudden epiphany! Heavenly insight pours into you."); }
  c.qi += gain;
  if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.3);
  while (c.alive && c.qi >= qiToNext(c) && !atRealmWall(c)) {
    c.qi -= qiToNext(c); c.stage += 1; recomputeMaxHp(c);
    msgs.push(`⮝ Advanced to ${realmLabel(c)}.`);
  }
  if (!msgs.length) msgs.push(`You cultivate in seclusion. (Qi ${Math.floor(c.qi)}/${Math.floor(qiToNext(c))})`);
  return msgs;
}

export function cultivate(c, rng, years = 1, usePill = false) {
  const msgs = [];
  if (!c.alive) return ["You are dead. The dao is closed to you."];
  let pillMult = 1.0;
  if (usePill && c.pills > 0) { c.pills -= 1; pillMult = 2.5; msgs.push("You swallow a Qi-Gathering Pill; warmth floods your meridians."); }
  for (let i = 0; i < years; i++) {
    if (!c.alive) break;
    const epiphany = rng.random() < (c.luck / 1500.0 + c.comprehension / 4000.0);
    let gain = cultivationSpeed(c) * pillMult * rng.uniform(0.85, 1.2);
    if (epiphany) { gain *= rng.uniform(2.5, 5.0); msgs.push("✦ A sudden epiphany! Heavenly insight pours into you."); }
    c.qi += gain;
    if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.55 + c.constitution * 0.5);
    if (c.sectKey) c.spiritStones += D.SECT_RANKS[c.sectRank][4];
    if (c.beast) beastGrow(c, rng);
    advanceAge(c, rng, msgs);
    while (c.alive && c.qi >= qiToNext(c) && !atRealmWall(c)) {
      c.qi -= qiToNext(c); c.stage += 1; recomputeMaxHp(c);
      msgs.push(`⮝ Advanced to ${realmLabel(c)}.`);
    }
  }
  return msgs;
}

function advanceAge(c, rng, msgs) {
  c.age += 1;
  if (c.age > c.maxAge) {
    if (rng.random() > (c.luck + c.soul) / 400.0) {
      c.alive = false; c.causeOfDeath = "old age, lifespan exhausted";
      msgs.push(`☠ At ${c.age}, your lifespan runs dry. You return to dust having reached ${realmLabel(c)}.`);
      note(c, "Died of old age.");
    }
  }
}

export const canBreakthrough = c => atRealmWall(c) && c.realm < D.REALMS.length - 1 && c.qi >= qiToNext(c);

export function breakthroughChance(c) {
  let chance = D.REALMS[c.realm + 1][5] + c.comprehension / 200.0 + c.luck / 300.0 +
    c.soul / 400.0 + daoBreakthroughBonus(c);
  if (c.qi > qiToNext(c) * 1.5) chance += 0.08;
  if (c.breakthroughPills > 0) chance += 0.15;
  // A serene dao heart (high happiness) steadies the assault; misery shakes it.
  if (typeof c.happiness === "number") chance += (c.happiness - 50) / 600.0;
  chance += D.physEffect(c).breakthrough || 0;   // Dao Embryo eases breakthroughs
  chance += eraBreakBonus(c);                     // a Dawn of Ascension eases the heavens
  return clamp(chance, 0.02, 0.97);
}

export function attemptBreakthrough(c, rng, opts = {}) {
  const msgs = [];
  c._tribulationPending = false;
  if (!canBreakthrough(c)) {
    if (!atRealmWall(c)) return ["You have not yet reached the peak of this realm."];
    if (c.qi < qiToNext(c)) return ["Your qi is not yet condensed enough to attempt a breakthrough."];
    return ["You stand at the very apex of cultivation. There is no higher heaven."];
  }
  const next = D.REALMS[c.realm + 1];
  const chance = breakthroughChance(c);
  msgs.push(`You marshal your qi to break into ${next[0]} (${next[1]})... [${Math.floor(chance * 100)}% chance]`);
  if (c.breakthroughPills > 0) { c.breakthroughPills -= 1; msgs.push("  You swallow a Foundation Breakthrough Pill to steady the dao."); }
  c.qi -= qiToNext(c);
  if (rng.random() <= chance) {
    c.realm += 1; c.stage = 0; recomputeMaxAge(c); recomputeMaxHp(c); c.hp = c.maxHp;
    msgs.push(`☯ BREAKTHROUGH! You have ascended to ${realmLabel(c)}!`);
    note(c, `Broke through to ${realmName(c)}.`);
    pushAll(msgs, heartDemon(c, rng));
    // From Golden Core up, the heavens send a Tribulation. The web UI can run
    // it as an interactive battle; otherwise resolve it automatically here.
    if (c.alive && c.realm >= 4) {
      if (opts.deferTribulation) { c._tribulationPending = true; msgs.push("⚡ The sky darkens — a Heavenly Tribulation gathers above you!"); }
      else pushAll(msgs, tribulation(c, rng));
    }
  } else {
    const backlash = (c.realm + 1) * 0.04;
    msgs.push("✗ The breakthrough fails; qi-deviation tears through your meridians.");
    if (rng.random() < backlash && rng.random() > (c.luck + c.soul) / 500.0) {
      c.alive = false; c.causeOfDeath = `qi deviation while assaulting ${next[0]}`;
      msgs.push("☠ The backlash is too violent. Your soul scatters. You die.");
      note(c, "Died from a failed breakthrough.");
    } else {
      c.hp = Math.max(1, c.hp - c.maxHp * rng.uniform(0.3, 0.7));
      c.stage = Math.max(0, c.stage - 1);
      msgs.push("You survive, gravely wounded, and slip back a stage.");
    }
  }
  return msgs;
}

function heartDemon(c, rng) {
  if (c.karma >= -30) return [];
  const peril = Math.min(0.6, (-c.karma - 30) / 220.0);
  const ward = c.soul / 300.0 + c.daos.length * 0.04 + c.comprehension / 600.0;
  const msgs = ["", "👁 A heart demon rises from your karma to devour your dao heart..."];
  if (rng.random() < peril - ward) {
    c.hp = Math.max(1.0, c.hp - c.maxHp * rng.uniform(0.3, 0.6));
    c.stage = Math.max(0, c.stage - 1);
    msgs.push("   The inner demon savages your mind; you slip a stage, shaken.");
  } else {
    msgs.push("   Your dao heart holds firm and the demon dissolves.");
  }
  return msgs;
}

function tribulation(c, rng) {
  const msgs = ["", "⚡ The sky darkens. Tribulation clouds gather above you. ⚡"];
  const waves = Math.min(9, c.realm);
  let survived = 0;
  const karmaFactor = 1.0 + clamp(c.karma / 400.0, -0.30, 0.30);
  const defense = power(c) * (1 + c.constitution / 80.0 + c.soul / 110.0) * karmaFactor;
  for (let w = 1; w <= waves; w++) {
    const bolt = basePower(c) * rng.uniform(0.7, 1.35) * (1 + w * 0.10);
    if (bolt <= defense * rng.uniform(0.85, 1.3)) {
      survived++; msgs.push(`   Wave ${w}/${waves}: you endure the heavenly fire.`);
    } else {
      const dmg = c.maxHp * rng.uniform(0.18, 0.42);
      c.hp -= dmg;
      msgs.push(`   Wave ${w}/${waves}: lightning sears you (${Math.floor(dmg)} dmg).`);
      if (c.hp <= 0) {
        if (rng.random() < c.luck / 350.0) { c.hp = c.maxHp * 0.1; msgs.push("   ...a hidden reserve of fortune drags you back from death!"); }
        else {
          c.alive = false; c.causeOfDeath = `struck down by the ${realmName(c)} tribulation`;
          msgs.push("   ☠ The final bolt scatters your soul. The tribulation claims you.");
          note(c, "Died crossing the Heavenly Tribulation."); return msgs;
        }
      }
    }
  }
  c.hp = Math.max(c.hp, c.maxHp * 0.2);
  msgs.push(`⚡ You weathered ${survived}/${waves} waves. The clouds disperse. ⚡`, "");
  return msgs;
}

function pushAll(arr, more) { for (const m of more) arr.push(m); }

/* ------------------------------ combat ----------------------------------- */
const BEAST_FOES = ["Iron-Fang Wolf","Rock-Shell Tortoise","Cloud Leopard","Venom Spirit Serpent","Crimson Ape","Ghost-Faced Spider","Flame Mane Lion","Abyssal Eel","Thunder Roc","Nine-Tailed Fox Spirit"];
const ROGUE_FOES = ["Masked Rogue Cultivator","Demonic Sect Outrider","Bandit Qi-user","Rival Sect Disciple","Fallen Immortal's Puppet","Corpse Refiner"];

function enemyFor(c, rng) {
  const kind = rng.random() < 0.6 ? "beast" : "rogue";
  const name = rng.choice(kind === "beast" ? BEAST_FOES : ROGUE_FOES);
  const factor = rng.choices([0.5, 0.8, 1.0, 1.3, 1.8], [28, 34, 22, 11, 5]);
  const pw = Math.max(5.0, basePower(c) * factor * rng.uniform(0.85, 1.15));
  const reward = Math.floor((c.realm + 1) * factor * rng.randint(2, 8));
  return [name, pw, reward, kind];
}

export function fight(c, rng, enemy) {
  if (!enemy) enemy = enemyFor(c, rng);
  let [name, ePower, reward, kind] = enemy;
  if (kind === undefined) kind = "rogue";
  const msgs = [`⚔ A ${name} bars your path! (foe power ≈ ${Math.floor(ePower)}, you ≈ ${Math.floor(power(c))})`];
  if (beastPower(c) > 0) msgs.push(`  Your spirit beast ${c.beast.name} bares its fangs at your side.`);

  if (ePower > power(c) * 1.45) {
    const flee = 0.45 + c.luck / 250.0 + c.soul / 400.0;
    if (rng.random() < flee) { msgs.push("  Sensing a foe far beyond you, you wisely flee. (no spoils, but you live)"); return msgs; }
    msgs.push("  It is far stronger than you, and you cannot break away!");
  }

  let eHp = ePower * 1.2, rounds = 0;
  while (c.hp > 0 && eHp > 0 && rounds < 30) {
    rounds++;
    const crit = rng.random() < (c.luck / 400.0 + 0.05);
    const atk = power(c) * rng.uniform(0.30, 0.46) * (crit ? 2.0 : 1.0);
    eHp -= atk;
    if (crit) msgs.push(`  ✦ Critical! You hit for ${Math.floor(atk)}.`);
    if (eHp <= 0) break;
    if (rng.random() < (c.luck / 600.0 + c.soul / 800.0)) { msgs.push("  You flow aside, untouched."); continue; }
    c.hp -= ePower * rng.uniform(0.09, 0.17);
    if (c.hp < c.maxHp * 0.25 && c.healingPills > 0) {
      c.healingPills -= 1; c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.5);
      msgs.push("  You gulp a Spirit Healing Pill mid-battle and rally.");
    }
  }

  if (c.hp > 0 && eHp <= 0) {
    c.spiritStones += reward; c.reputation += 1; c.hp = Math.max(1.0, c.hp);
    msgs.push(`  You slay the ${name}! (+${reward} spirit stones, +1 reputation)`);
    if (kind === "rogue" && (name.includes("Demonic") || name.includes("Corpse") || name.includes("Bandit") || rng.random() < 0.5)) c.karma += 2;
    if (rng.random() < 0.14 + c.luck / 900.0) pushAll(msgs, loot(c, rng));
    if (kind === "beast" && c.beast === null) pushAll(msgs, tryTame(c, name, ePower, rng));
  } else if (c.hp <= 0) {
    if (rng.random() < c.luck / 300.0) { c.hp = c.maxHp * 0.15; msgs.push("  At death's door, blind luck lets you escape with your life!"); }
    else {
      c.alive = false; c.causeOfDeath = `slain by a ${name}`;
      msgs.push(`  ☠ The ${name} strikes you down. Your journey ends here.`);
      note(c, `Killed by a ${name}.`);
    }
  } else {
    msgs.push("  Neither can fell the other; you disengage, breathing hard.");
  }
  recomputeMaxHp(c);
  return msgs;
}

function loot(c, rng) {
  const roll = rng.random();
  if (roll < 0.22) return acquireArtifact(c, randomArtifact(c, rng));
  if (roll < 0.5) { const n = rng.randint(2, 5); c.herbs += n; return [`  You gather ${n} spirit herbs from the corpse's lair.`]; }
  if (roll < 0.75) { c.pills += 1; return ["  You loot a Qi-Gathering Pill."]; }
  c.inventory.push("Spirit Jade Shard"); return ["  You loot a shard of spirit jade."];
}

/* ---------------------------- adventures --------------------------------- */
function evSpiritHerb(c, rng) {
  if (rng.random() < 0.5 + c.luck / 400.0) {
    const herbs = rng.randint(2, 5) + c.realm, stones = rng.randint(1, 3) * (c.realm + 1);
    c.herbs += herbs; c.spiritStones += stones;
    return [`You find a patch of spirit herbs and harvest a full basket. (+${herbs} herbs, +${stones} stones)`];
  }
  return ["You spot a spirit herb, but a beast got there first. Nothing gained."];
}
function evRuin(c, rng) {
  const msgs = ["You stumble on the entrance to an ancient ruin, qi humming within."];
  if (rng.random() < 0.45 + c.luck / 300.0) {
    const roll = rng.random();
    if (roll < 0.25) {
      const unknown = Object.keys(D.TECHNIQUES).filter(k => !c.techniques.includes(k));
      const tech = unknown.length ? rng.choice(unknown) : "azure_cloud";
      if (!c.techniques.includes(tech)) { c.techniques.push(tech); msgs.push(`  In a jade slip you find: ${D.TECHNIQUES[tech][0]}! (${D.TECHNIQUES[tech][4]})`); }
    } else if (roll < 0.45) {
      pushAll(msgs, acquireArtifact(c, randomArtifact(c, rng)));
    } else if (roll < 0.75) {
      const gain = rng.randint(10, 40) * (c.realm + 1); c.spiritStones += gain; msgs.push(`  A cache of spirit stones! (+${gain})`);
    } else {
      c.pills += rng.randint(1, 3); c.herbs += rng.randint(2, 6); msgs.push("  A dusty pill bottle and a bundle of dried herbs, still potent.");
    }
  } else { msgs.push("  ...but it is a guardian's lair. "); pushAll(msgs, fight(c, rng)); }
  return msgs;
}
function evMaster(c, rng) {
  if (c.realm <= 2 && rng.random() < 0.4 + c.charm / 400.0) {
    const boost = rng.randint(4, 10); c.comprehension = Math.min(160, c.comprehension + boost); c.reputation += 5;
    return [`A wandering senior takes a liking to you and imparts pointers. (+${boost} comprehension, +5 reputation)`];
  }
  return ["A reclusive senior eyes you, then walks on without a word."];
}
function evRobbery(c, rng) {
  if (c.spiritStones > 0 && rng.random() > c.luck / 250.0) {
    const lost = Math.max(1, Math.floor(c.spiritStones * rng.uniform(0.2, 0.6))); c.spiritStones -= lost;
    return [`Bandits ambush you on the road and rob you of ${lost} spirit stones.`];
  }
  return ["Bandits move to ambush you -- but think better of it and flee."];
}
function evAuction(c, rng) {
  const cost = 60 * (c.realm + 1);
  if (rng.random() < 0.3 && c.spiritStones >= cost) {
    c.spiritStones -= cost;
    return [`A treasure auction! You win the bidding for ${cost} stones.`].concat(acquireArtifact(c, randomArtifact(c, rng)));
  }
  if (c.spiritStones >= 20) {
    if (rng.random() < 0.5 + c.luck / 500.0) { c.spiritStones -= 20; c.pills += 2; c.herbs += rng.randint(1, 4); return ["At a night market you buy pills and herbs cheap. (-20 stones)"]; }
    return ["The night market's prices are robbery. You buy nothing."];
  }
  return ["You pass a bustling cultivator market but cannot afford a thing."];
}
function evInsight(c, rng) {
  if (rng.random() < 0.4 + c.comprehension / 400.0) { c.qi += qiToNext(c) * rng.uniform(0.2, 0.6); return ["Watching a waterfall, you grasp a sliver of the dao. Your qi surges."]; }
  return ["You meditate by a waterfall, but enlightenment does not come today."];
}
function evNothing(c, rng) {
  const flavour = rng.choice([
    "You travel for days through quiet mountains. Nothing of note occurs.",
    "Rain keeps you sheltered in a cave; you cultivate a little.",
    "You trade rumours with travellers at a roadside inn.",
    "A flock of spirit cranes passes overhead, and is gone.",
  ]);
  c.qi += cultivationSpeed(c) * 0.5; return [flavour];
}
const ADVENTURES = [[evSpiritHerb,18],[evRuin,12],[evMaster,8],[evRobbery,12],[evAuction,10],[evInsight,12],[(c,rng)=>["You are set upon in the wilds!"].concat(fight(c,rng)),16],[evNothing,12]];

export function adventure(c, rng) {
  if (!c.alive) return ["You are dead."];
  c.age += 1;
  const ev = rng.choices(ADVENTURES.map(a => a[0]), ADVENTURES.map(a => a[1]));
  const msgs = ev(c, rng);
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age on the road"; msgs.push(`☠ Your lifespan runs out at ${c.age}. The road claims you at last.`); }
  return msgs;
}

/* ----------------------------- artifacts --------------------------------- */
function gradeForRealm(c, rng) {
  let base = Math.min(D.ARTIFACT_GRADES.length - 1, Math.floor(c.realm / 2));
  const roll = rng.random() + c.luck / 600.0;
  if (roll > 1.15) base += 2; else if (roll > 0.9) base += 1;
  return D.ARTIFACT_GRADES[Math.min(base, D.ARTIFACT_GRADES.length - 1)];
}
export function randomArtifact(c, rng, grade) {
  grade = grade || gradeForRealm(c, rng);
  let pool = D.ARTIFACTS.filter(a => a[2] === grade);
  let gi = D.ARTIFACT_GRADE_RANK[grade];
  while (gi >= 0 && pool.length === 0) { pool = D.ARTIFACTS.filter(a => a[2] === D.ARTIFACT_GRADES[gi]); gi--; }
  return rng.choice(pool)[0];
}
function artifactBetter(a, b) {
  const A = D.ARTIFACT_BY_KEY[a], B = D.ARTIFACT_BY_KEY[b];
  if (D.ARTIFACT_GRADE_RANK[A[2]] !== D.ARTIFACT_GRADE_RANK[B[2]]) return D.ARTIFACT_GRADE_RANK[A[2]] > D.ARTIFACT_GRADE_RANK[B[2]];
  return A[3] > B[3];
}
export function acquireArtifact(c, key, autoEquip = true) {
  const art = D.ARTIFACT_BY_KEY[key]; if (!art) return [];
  c.artifacts.push(key);
  const msgs = [`  You obtain a treasure: ${art[1]} (${art[2]} grade)!`];
  if (autoEquip && (!c.equippedArtifact || artifactBetter(key, c.equippedArtifact))) {
    c.equippedArtifact = key; msgs.push(`  You bind the ${art[1]} as your signature treasure.`); note(c, `Bound the ${art[1]} (${art[2]} grade).`);
  }
  return msgs;
}
export function equipArtifact(c, key) {
  if (!c.artifacts.includes(key)) return ["You do not possess that treasure."];
  c.equippedArtifact = key; const art = D.ARTIFACT_BY_KEY[key];
  return [`You bind the ${art[1]} (${art[2]} grade) as your treasure.`];
}
export function describeArtifact(key) {
  const a = D.ARTIFACT_BY_KEY[key];
  return `${a[1]} (${a[2]}) — +${Math.floor(a[3] * 100)}% power` + (a[4] ? `, +${Math.floor(a[4] * 100)}% cultivation` : "");
}

/* ------------------------------ beasts ----------------------------------- */
function beastName(species, rng) {
  const p = ["Little","Old","Snowy","Ember","Shadow","Jade","Storm","Cloud","Ink","Gold"];
  return `${rng.choice(p)} ${species.split(" ").slice(-1)[0]}`;
}
function tameChance(c, beastPow, rng) {
  if (c.beast !== null) return 0.0;
  const ratio = power(c) / Math.max(1.0, beastPow);
  let base = 0.20 + c.soul / 400.0 + c.charm / 500.0 + Math.min(0.3, (ratio - 1) * 0.15);
  if (c.sectKey === "spiritbeast") base += 0.20;
  return clamp(base, 0.02, 0.85);
}
export function tryTame(c, species, beastPow, rng) {
  if (c.beast !== null) return [];
  if (rng.random() < tameChance(c, beastPow, rng)) {
    c.beast = normalizeBeast({ name: beastName(species, rng), species, baseSpecies: species, element: D.beastElement(species), power: beastPow * rng.uniform(0.6, 0.9), bond: 50, rank: 1, exp: 0, fedThisYear: 0, alive: true });
    const el = c.beast.element ? ` Its nature runs to ${c.beast.element}.` : "";
    note(c, `Tamed a ${species} as a spirit beast companion.`);
    return [`  ✦ You subdue the ${species} and bind it as a spirit beast companion! (${c.beast.name}, ${beastTier(c.beast)})${el}`];
  }
  return ["  The beast breaks free and flees before you can bind it."];
}
export function beastGrow(c, rng) {
  const b = c.beast; if (!b || !b.alive) return;
  normalizeBeast(b);
  b.fedThisYear = 0;
  b.power *= rng.uniform(1.0, 1.03);
  // higher-ranked beasts pace closer to their master's strength.
  const target = power(c) * (0.45 + 0.09 * (b.rank || 1));
  if (b.power < target) b.power += (target - b.power) * 0.06;
  // a year fighting and roaming at your side earns a little experience.
  b.exp = (b.exp || 0) + 1 + Math.floor((b.bond || 50) / 40);
}

export const beastAdvanceReady = c => {
  const b = c.beast; if (!b || !b.alive) return false; normalizeBeast(b);
  return (b.rank || 1) < 5 && b.exp >= D.BEAST_EXP_REQ[b.rank || 1] && b.bond >= 55;
};

// Feed your beast (free care; capped per year). Herbs give steady growth; a pill
// gives a richer boost. Raises power, bond and experience toward its next rank.
export function feedBeast(c, rng, usePill = false) {
  const b = c.beast; if (!b || !b.alive) return ["You have no spirit beast to feed."];
  normalizeBeast(b);
  if (b.fedThisYear >= 3) return [`${b.name} is sated for now — it will take more food next year.`];
  if (usePill) {
    if (c.pills <= 0) return ["You have no pills to feed it."];
    c.pills -= 1; b.exp += 28; b.bond = clamp(b.bond + 12, 0, 100); b.power *= 1.04; b.fedThisYear += 1;
    return [`You feed ${b.name} a spirit pill. Its eyes blaze; it grows visibly stronger and nuzzles you. (bond ${Math.round(b.bond)}/100)`];
  }
  if (c.herbs < 2) return ["You need at least 2 spirit herbs to feed your beast."];
  c.herbs -= 2; b.exp += 10; b.bond = clamp(b.bond + 5, 0, 100); b.power += power(c) * 0.012; b.fedThisYear += 1;
  return [`You feed ${b.name} a bundle of spirit herbs. It chuffs contentedly. (bond ${Math.round(b.bond)}/100, exp ${b.exp}/${D.BEAST_EXP_REQ[b.rank] || "—"})`];
}

// Evolve the beast to its next rank — a dramatic surge in power and a new form.
export function advanceBeast(c, rng) {
  const b = c.beast; if (!b || !b.alive) return ["You have no spirit beast."];
  normalizeBeast(b);
  if ((b.rank || 1) >= 5) return [`${b.name} has reached the Mythic Beast pinnacle; it can rise no further.`];
  if (b.exp < D.BEAST_EXP_REQ[b.rank]) return [`${b.name} is not ready to evolve — keep feeding it and fighting at its side. (exp ${b.exp}/${D.BEAST_EXP_REQ[b.rank]})`];
  if (b.bond < 55) return [`Your bond with ${b.name} is too shallow for it to entrust you with its breakthrough. (bond ${Math.round(b.bond)}/100, need 55)`];
  b.exp -= D.BEAST_EXP_REQ[b.rank];
  b.rank += 1;
  b.species = D.beastEvolvedName(b.baseSpecies, b.rank);
  b.power *= 1.3 + 0.05 * b.rank;
  b.bond = clamp(b.bond - 10, 0, 100);
  note(c, `${b.name} evolved into ${b.species} (${D.beastRankName(b.rank)}).`);
  return [`✦ ${b.name} threshes in a cocoon of spirit-light and emerges transformed — now a ${b.species}, a ${D.beastRankName(b.rank)}! Its power surges.`];
}

/* ------------------------------ alchemy ---------------------------------- */
export function alchemySuccess(c, recipe) {
  return clamp(recipe[3] + (c.soul + c.comprehension) / 600.0 + c.alchemySkill * 0.006 + abodeAlchemyBonus(c), 0.05, 0.97);
}
export function refine(c, rng, recipeKey) {
  const recipe = D.PILL_BY_KEY[recipeKey]; if (!recipe) return ["No such recipe."];
  const [key, name, cost] = recipe;
  if (c.herbs < cost) return [`You need ${cost} spirit herbs to attempt ${name}; you have ${c.herbs}.`];
  c.age += 1; c.herbs -= cost;
  const chance = alchemySuccess(c, recipe);
  const msgs = [`You light the pill furnace and refine ${name}... [${Math.floor(chance * 100)}% success]`];
  if (rng.random() <= chance) { c.alchemySkill += 1; pushAll(msgs, applyPill(c, key, rng)); }
  else { const salvage = Math.floor(cost / 3); c.herbs += salvage; c.alchemySkill += 1; msgs.push(`  The furnace erupts and the batch is ruined. (salvaged ${salvage} herbs)`); }
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age at the pill furnace"; msgs.push(`☠ Your lifespan ends at ${c.age}, furnace still warm.`); }
  return msgs;
}
// Apply a pill's effect, scaled by a quality multiplier (1 = ordinary).
export function grantPill(c, key, rng, mult = 1) {
  const name = D.PILL_BY_KEY[key][1];
  const scale = n => Math.max(1, Math.round(n * mult));
  if (key === "qi") { const n = scale(rng.randint(1, 2)); c.pills += n; return [`  You refine ${n} ${name}(s).`]; }
  if (key === "heal") { const n = scale(rng.randint(1, 2)); c.healingPills += n; return [`  You refine ${n} ${name}(s).`]; }
  if (key === "breakthrough") { const n = scale(1); c.breakthroughPills += n; return [`  You refine ${n} ${name}(s) -- save for a breakthrough.`]; }
  if (key === "body") { const g = scale(rng.randint(1, 3)); c.constitution = Math.min(160, c.constitution + g); recomputeMaxHp(c); return [`  The ${name} tempers your body. (+${g} Constitution)`]; }
  if (key === "soul") { const g = scale(rng.randint(1, 3)); c.soul = Math.min(160, c.soul + g); return [`  The ${name} refines your spirit. (+${g} Soul Sense)`]; }
  if (key === "longevity") { const g = Math.round((Math.floor(c.maxAge * rng.uniform(0.05, 0.11)) + 20) * mult); c.longevityBonus = (c.longevityBonus || 0) + g; recomputeMaxAge(c); note(c, `Refined a ${name}, +${g} years of life.`); return [`  ✦ The ${name} adds ${g} years to your lifespan!`]; }
  return ["  Success!"];
}
function applyPill(c, key, rng) { return grantPill(c, key, rng, 1); }

/* ------------------------------ market (坊市) ---------------------------- */
// Prices float with the world era — dear in a Drought, cheap in an Age of Abundance.
export const eraPriceMult = c => D.eraAt(c.era)[7] || 1;
const TREASURE_BASE = { Mortal: 25, Spirit: 130, Earth: 600, Heaven: 3000, Immortal: 16000 };
export const priceHerbs = (c, n = 5) => Math.max(2, Math.round((c.realm + 1) * 1.6 * n * eraPriceMult(c)));
export const pricePill = (c, key) => Math.round((D.PILL_BY_KEY[key][2] * 8 + 15) * eraPriceMult(c));
export const priceTech = (c, tier) => Math.round([60, 130, 320, 900][tier] * eraPriceMult(c));
export const priceTreasure = (c, key) => Math.round((TREASURE_BASE[D.ARTIFACT_BY_KEY[key][2]] || 50) * eraPriceMult(c));
// Selling fetches a fraction of the buy price.
export const sellHerbs = (c, n = 5) => Math.max(1, Math.round(priceHerbs(c, n) * 0.45));
export const sellTreasureValue = (c, key) => Math.max(1, Math.round(priceTreasure(c, key) * 0.4));

export function buyPill(c, key, rng) {
  const p = pricePill(c, key);
  if (c.spiritStones < p) return [`You cannot afford the ${D.PILL_BY_KEY[key][1]} (${p} stones).`];
  c.spiritStones -= p;
  return [`You buy a ${D.PILL_BY_KEY[key][1]} for ${p} stones.`].concat(grantPill(c, key, rng, 1));
}
export function buyHerbs(c, n = 5) {
  const p = priceHerbs(c, n);
  if (c.spiritStones < p) return [`You cannot afford ${n} spirit herbs (${p} stones).`];
  c.spiritStones -= p; c.herbs += n;
  return [`You buy ${n} spirit herbs for ${p} stones.`];
}
export function buyTech(c, key, rng) {
  const t = D.TECHNIQUES[key]; if (!t) return ["No such manual."];
  const p = priceTech(c, t[1]);
  if (c.techniques.includes(key)) return [`You already know ${t[0]}.`];
  if (c.spiritStones < p) return [`You cannot afford the ${t[0]} manual (${p} stones).`];
  c.spiritStones -= p; c.techniques.push(key);
  note(c, `Bought the ${t[0]} manual.`);
  return [`You buy and study the ${t[0]} manual for ${p} stones. (${t[4]})`];
}
export function buyTreasure(c, key) {
  const a = D.ARTIFACT_BY_KEY[key]; if (!a) return ["No such treasure."];
  const p = priceTreasure(c, key);
  if (c.spiritStones < p) return [`You cannot afford the ${a[1]} (${p} stones).`];
  c.spiritStones -= p;
  return [`You buy the ${a[1]} for ${p} stones.`].concat(acquireArtifact(c, key));
}
export function sellTreasure(c, key) {
  if (!c.artifacts.includes(key)) return ["You do not own that treasure."];
  if (c.equippedArtifact === key) return ["Unbind it before selling — you won't part with your signature treasure."];
  const v = sellTreasureValue(c, key);
  c.artifacts.splice(c.artifacts.indexOf(key), 1);
  c.spiritStones += v;
  return [`You sell the ${D.ARTIFACT_BY_KEY[key][1]} for ${v} stones.`];
}
export function sellSpareHerbs(c, n = 5) {
  if (c.herbs < n) return [`You don't have ${n} spare herbs.`];
  const v = sellHerbs(c, n);
  c.herbs -= n; c.spiritStones += v;
  return [`You sell ${n} spirit herbs for ${v} stones.`];
}

/* -------------------------------- dao ------------------------------------ */
export const DAO_MIN_REALM = 5;
export const daoInsightThreshold = c => 100.0 * (1 + c.daos.length * 0.85);
export const canComprehend = c => c.realm >= DAO_MIN_REALM && c.daos.length < D.DAOS.length;

export function meditate(c, rng, years = 1) {
  if (!c.alive) return ["You are dead."];
  if (c.realm < DAO_MIN_REALM) return [`Your soul is too unrefined to perceive the Daos. (requires ${D.REALMS[DAO_MIN_REALM][0]})`];
  if (c.daos.length >= D.DAOS.length) return ["You have already comprehended every Dao under heaven."];
  const msgs = [];
  for (let i = 0; i < years; i++) {
    if (!c.alive) break;
    let gain = (c.comprehension + c.soul) / 18.0 * rng.uniform(0.7, 1.3) * (1 + c.luck / 300.0) * (1 + (D.physEffect(c).dao || 0));
    if (c.daos.includes("karma")) gain *= 1.15;
    if (rng.random() < c.comprehension / 2500.0) { gain *= rng.uniform(2.0, 4.0); msgs.push("✦ The veil thins -- a flash of profound enlightenment!"); }
    c.daoInsight += gain; c.age += 1;
    if (c.daoInsight >= daoInsightThreshold(c)) pushAll(msgs, comprehendNewDao(c, rng));
    if (c.age > c.maxAge) { c.alive = false; c.causeOfDeath = "old age deep in Dao meditation"; msgs.push(`☠ Your lifespan ends at ${c.age}, mid-revelation.`); break; }
  }
  if (msgs.length === 0) msgs.push(`You meditate on the nature of the Dao. (insight ${Math.floor(c.daoInsight)}/${Math.floor(daoInsightThreshold(c))})`);
  return msgs;
}
function comprehendNewDao(c, rng) {
  c.daoInsight = 0.0;
  const unknown = D.DAOS.filter(d => !c.daos.includes(d[0]));
  if (unknown.length === 0) return [];
  const weights = unknown.map(d => { let w = 1.0; if (d[0] === "slaughter" && c.karma < -30) w = 3.0; if (d[0] === "karma" && c.karma > 60) w = 2.5; return w; });
  const dao = rng.choices(unknown, weights);
  c.daos.push(dao[0]); note(c, `Comprehended the ${dao[1]}.`);
  return ["", `☯ You comprehend the ${dao[1]}!`, `  ${dao[4]}`, ""];
}

/* ------------------------------- sect ------------------------------------ */
const talentTier = c => D.ROOT_TIER[c.root.key] || 0;
export function joinChance(c, sect) {
  const [, , , elem, , minRealm, joinTier] = sect;
  if (c.realm < minRealm) return 0.0;
  let base = 0.55 + (talentTier(c) - joinTier) * 0.22 + c.comprehension / 400.0 + c.reputation / 300.0;
  if (elem && c.root.elements.includes(elem)) base += 0.15;
  return clamp(base, 0.0, 0.97);
}
export function attemptJoin(c, rng, sectKey) {
  const sect = D.SECT_BY_KEY[sectKey]; if (!sect) return ["No such sect."];
  if (c.sectKey) return [`You are already a disciple of ${sectName(c)}. Leave first.`];
  if (c.realm < sect[5]) return [`The ${sect[1]} will not even test a ${realmName(c)} cultivator. (requires ${D.REALMS[sect[5]][0]})`];
  const chance = joinChance(c, sect);
  const msgs = [`You present yourself to the ${sect[1]} for assessment... [${Math.floor(chance * 100)}% chance]`];
  if (rng.random() <= chance) {
    c.sectKey = sectKey; c.sectRank = 0; c.contribution = 0; c.reputation += sect[8];
    note(c, `Joined the ${sect[1]} as an Outer Disciple.`);
    msgs.push(`☯ Accepted! You don the robes of the ${sect[1]}.`);
    if (sect[2] === "demonic") msgs.push("  The righteous world now eyes you with suspicion.");
    pushAll(msgs, maybeTakeMaster(c, rng));
    if (rng.random() < 0.6) pushAll(msgs, introduceRival(c, rng));
  } else { c.reputation = Math.max(-50, c.reputation - 2); msgs.push("✗ The elders find you wanting and turn you away."); }
  return msgs;
}
export function leaveSect(c) {
  if (!c.sectKey) return ["You belong to no sect."];
  const n = sectName(c); note(c, `Left the ${n}.`); c.sectKey = null; c.sectRank = 0; c.contribution = 0;
  return [`You sever ties with the ${n} and walk the lonely road of a rogue cultivator once more.`];
}
export function nextRankReq(c) {
  const nxt = c.sectRank + 1;
  if (!c.sectKey || nxt >= D.SECT_RANKS.length) return null;
  const [name, minRealm, minContrib] = D.SECT_RANKS[nxt];
  return [name, minRealm, minContrib];
}
export function canPromote(c) {
  const r = nextRankReq(c); if (!r) return false;
  return c.realm >= r[1] && c.contribution >= r[2];
}
export function attemptPromotion(c, rng) {
  if (!c.sectKey) return ["You belong to no sect."];
  const r = nextRankReq(c); if (!r) return ["You already sit at the very summit of your sect."];
  const [name, minRealm, minContrib] = r;
  if (c.realm < minRealm) return [`Promotion to ${name} requires ${D.REALMS[minRealm][0]} (you are ${realmName(c)}).`];
  if (c.contribution < minContrib) return [`Promotion to ${name} requires ${minContrib} contribution (you have ${c.contribution}).`];
  c.contribution -= minContrib; c.sectRank += 1; c.reputation += 4 + c.sectRank * 3;
  note(c, `Promoted to ${name}.`);
  return [`☯ The sect elevates you to ${name}!`, "  Your standing rises and the sect's arrays open wider to you."];
}
export const availableQuests = c => c.sectKey ? D.SECT_QUESTS.filter(q => q[1] <= c.sectRank) : [];
export function doQuest(c, rng, quest) {
  const [name, , contribution, stones, danger, blurb] = quest;
  if (!c.sectKey) return ["You belong to no sect."];
  c.age += 1;
  const msgs = [`Quest accepted: ${name}.`, `  ${blurb}`];
  if (rng.random() < danger) { msgs.push("  Trouble finds you on the way!"); pushAll(msgs, fight(c, rng)); if (!c.alive) return msgs; }
  const bonus = 1.0 + (rng.random() < c.luck / 250.0 ? 0.5 : 0.0);
  const ec = Math.floor(contribution * bonus), es = Math.floor(stones * bonus);
  c.contribution += ec; c.spiritStones += es; c.reputation += 1;
  msgs.push(`  Quest complete! (+${ec} contribution, +${es} spirit stones, +1 reputation)`);
  if (bonus > 1.0) msgs.push("  Fortune smiled -- the elders are especially pleased.");
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age on a sect errand"; msgs.push(`☠ Your lifespan ends at ${c.age}, far from home.`); }
  return msgs;
}
export function exchangeContribution(c, rng) {
  if (!c.sectKey) return ["You belong to no sect."];
  const cost = 25;
  if (c.contribution < cost) return [`The sect store needs ${cost} contribution; you have ${c.contribution}.`];
  c.contribution -= cost;
  const msgs = [`You spend ${cost} contribution at the sect store.`];
  if (rng.random() < 0.25) {
    const unknown = Object.keys(D.TECHNIQUES).filter(k => !c.techniques.includes(k));
    if (unknown.length) { const t = rng.choice(unknown); c.techniques.push(t); msgs.push(`  You requisition a technique manual: ${D.TECHNIQUES[t][0]}!`); return msgs; }
  }
  const g = rng.randint(2, 4); c.pills += g; msgs.push(`  You collect ${g} Qi-Gathering Pills.`);
  return msgs;
}
export function tournament(c, rng) {
  if (!c.sectKey) return ["Only sect disciples may enter the sect tournament."];
  c.age += 1;
  const rounds = 4;
  const msgs = [`⚑ The ${sectName(c)} grand tournament begins! 16 contenders enter.`];
  let placement = 16, won = 0;
  for (let r = 1; r <= rounds; r++) {
    const remaining = 16 / Math.pow(2, r - 1);
    const opp = basePower(c) * rng.uniform(0.75, 1.05) * (1 + r * 0.10);
    const you = power(c) * rng.uniform(0.85, 1.25) * (1 + c.luck / 350);
    const label = { 16: "Round of 16", 8: "Quarter-final", 4: "Semi-final", 2: "Final" }[remaining] || `Round ${r}`;
    if (you >= opp) { won++; placement = remaining / 2; msgs.push(`  ${label}: victory! You advance.`); }
    else { msgs.push(`  ${label}: defeated. You take a beating but survive.`); c.hp = Math.max(1.0, c.hp - c.maxHp * rng.uniform(0.15, 0.35)); break; }
  }
  pushAll(msgs, tournamentRewards(c, rng, placement, won));
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age after the tournament"; msgs.push(`☠ Your lifespan ends at ${c.age}.`); }
  return msgs;
}
function tournamentRewards(c, rng, placement, won) {
  let title = null;
  for (const [cut, name] of D.TOURNAMENT_TITLES) if (placement <= cut) { title = name; break; }
  const contribution = won * 40 + (placement === 1 ? 120 : 0);
  const rep = won * 3 + (placement === 1 ? 20 : 0);
  const stones = won * 15;
  c.contribution += contribution; c.reputation += rep; c.spiritStones += stones;
  const msgs = [`  Tournament over -- you finish in the top ${Math.max(placement, 1)}.`,
    `  Rewards: +${contribution} contribution, +${rep} reputation, +${stones} spirit stones.`];
  if (placement === 1) { c.pills += 3; msgs.push("  As Champion you are awarded a Foundation Pill and 3 pills!"); }
  if (title) {
    const honour = `Tournament ${title}`;
    if (!c.titles.includes(honour)) c.titles.push(honour);
    note(c, `Placed as ${title} in the ${sectName(c)} tournament.`);
    msgs.push(`  ✦ You earn the title: ${title}!`);
    if (placement <= 2 && findNpc(c, "companion") === null && rng.random() < 0.3 + c.charm / 400.0) {
      const npc = { name: npcName(rng), role: "companion", affinity: 35, power: power(c) * rng.uniform(0.7, 1.3), alive: true };
      c.relationships.push(npc); msgs.push(`  Your brilliance catches the eye of ${npc.name}, who seeks you out afterward...`);
    }
  }
  return msgs;
}

/* ----------------------------- relationships ----------------------------- */
export function npcName(rng) {
  let given = rng.choice(D.GIVEN_FIRST);
  if (rng.random() < 0.5) given += rng.choice(D.GIVEN_SECOND);
  return `${rng.choice(D.SURNAMES)} ${given}`;
}
export function givenName(rng) {
  let given = rng.choice(D.GIVEN_FIRST);
  if (rng.random() < 0.5) given += rng.choice(D.GIVEN_SECOND);
  return given;
}
export function findNpc(c, role) { return c.relationships.find(n => n.role === role && n.alive) || null; }
export const npcStatus = n => D.relationshipLabel(n.affinity);
export const npcRoleLabel = n => D.ROLE_LABEL[n.role] || n.role;
function adjust(n, d) { n.affinity = clamp(n.affinity + d, -100, 100); }

function maybeTakeMaster(c, rng) {
  if (findNpc(c, "master") || !c.sectKey) return [];
  const chance = 0.15 + talentTier(c) * 0.10 + c.comprehension / 400.0;
  if (rng.random() < chance) {
    const npc = { name: npcName(rng), role: "master", affinity: 30, power: power(c) * rng.uniform(20, 60), alive: true };
    c.relationships.push(npc); note(c, `Accepted as a personal disciple by Elder ${npc.name}.`);
    return [`✦ Elder ${npc.name} sees your potential and takes you as a personal disciple! You now have a Master.`];
  }
  return [];
}
function introduceRival(c, rng) {
  if (findNpc(c, "rival")) return [];
  const npc = { name: npcName(rng), role: "rival", affinity: -10, power: power(c) * rng.uniform(0.8, 1.3), alive: true };
  c.relationships.push(npc); note(c, `Gained a rival in fellow disciple ${npc.name}.`);
  return [`Fellow disciple ${npc.name} sniffs at your talent. A rivalry is born.`];
}
function finishSocialYear(c, msgs) {
  if (c.age > c.maxAge && c.alive) { c.alive = false; c.causeOfDeath = "old age amid friends"; msgs.push(`☠ Your lifespan runs out at ${c.age}, surrounded by those you knew.`); }
  return msgs;
}
export function meetNew(c, rng) {
  if (!c.alive) return ["You are dead. The living no longer seek your company."];
  c.age += 1; return finishSocialYear(c, meetSomeone(c, rng));
}
export function interactWith(c, npc, rng) {
  if (!c.alive) return ["You are dead."];
  if (!npc.alive) return [`${npc.name} is no longer among the living.`];
  c.age += 1; return finishSocialYear(c, interactNpc(c, npc, rng));
}
function meetSomeone(c, rng) {
  const pull = c.charm + (["striking", "peerless", "immortal"].includes(c.appearanceKey) ? 20 : 0);
  const roll = rng.random();
  if (roll < 0.22 + pull / 500.0 && !findNpc(c, "companion")) {
    const npc = { name: npcName(rng), role: "companion", affinity: 20 + Math.floor(pull / 6), power: power(c) * rng.uniform(0.6, 1.4), alive: true };
    c.relationships.push(npc); note(c, `Met ${npc.name}, a kindred spirit on the dao.`);
    return [`✦ You cross paths with ${npc.name}, and something kindles. A potential Dao Companion enters your life.`];
  }
  if (roll < 0.62) {
    const npc = { name: npcName(rng), role: "friend", affinity: 15 + Math.floor(c.charm / 8), power: power(c) * rng.uniform(0.5, 1.5), alive: true };
    c.relationships.push(npc); note(c, `Befriended ${npc.name}.`);
    return [`You share wine and talk of the dao with ${npc.name}; a friendship forms.`];
  }
  const npc = { name: npcName(rng), role: "enemy", affinity: -30, power: power(c) * rng.uniform(0.7, 1.6), alive: true };
  c.relationships.push(npc); note(c, `Made an enemy of ${npc.name}.`);
  return [`A careless word earns you the lasting enmity of ${npc.name}.`];
}
function interactNpc(c, npc, rng) {
  switch (npc.role) {
    case "master": return withMaster(c, npc, rng);
    case "rival": return withRival(c, npc, rng);
    case "companion": return withCompanion(c, npc, rng);
    case "enemy": return withEnemy(c, npc, rng);
    default: return withFriend(c, npc, rng);
  }
}
function withMaster(c, npc, rng) {
  adjust(npc, rng.randint(2, 6));
  const msgs = [`You attend on your master, ${npc.name} (${npcStatus(npc)}).`];
  if (npc.affinity > 40 && rng.random() < 0.5) { const g = rng.randint(2, 7); c.comprehension = Math.min(160, c.comprehension + g); msgs.push(`  Their pointers sharpen your insight. (+${g} comprehension)`); }
  else if (rng.random() < 0.35) { const unknown = Object.keys(D.TECHNIQUES).filter(k => !c.techniques.includes(k)); if (unknown.length) { const t = rng.choice(unknown); c.techniques.push(t); msgs.push(`  Master imparts a manual: ${D.TECHNIQUES[t][0]}!`); } }
  else { c.qi += qiToNext(c) * rng.uniform(0.2, 0.5); msgs.push("  Guided meditation under their eye refines your qi."); }
  return msgs;
}
function withRival(c, npc, rng) {
  const msgs = [`You spar with your rival ${npc.name} (${npcStatus(npc)}).`];
  const you = power(c) * rng.uniform(0.85, 1.2) * (1 + c.luck / 400);
  const them = npc.power * rng.uniform(0.85, 1.2);
  if (you >= them) { adjust(npc, rng.randint(3, 8)); c.qi += qiToNext(c) * rng.uniform(0.1, 0.3); msgs.push("  You best them. Their respect for you grows, however sourly."); }
  else { adjust(npc, rng.randint(-6, -1)); msgs.push("  They get the better of the exchange and smirk. Galling."); c.comprehension = Math.min(160, c.comprehension + 1); msgs.push("  Still, the defeat teaches you something. (+1 comprehension)"); }
  return msgs;
}
function withFriend(c, npc, rng) {
  adjust(npc, rng.randint(2, 7));
  const msgs = [`You spend the season with your friend ${npc.name} (${npcStatus(npc)}).`];
  if (npc.affinity > 35 && rng.random() < 0.5) {
    if (rng.random() < 0.4) { c.pills += 1; msgs.push("  They press a Qi-Gathering Pill into your hand. (+1 pill)"); }
    else { const g = rng.randint(3, 12) * (c.realm + 1); c.spiritStones += g; msgs.push(`  They gift you spirit stones. (+${g})`); }
  } else msgs.push("  Good company, and a few useful rumours of the wider world.");
  return msgs;
}
function withCompanion(c, npc, rng) {
  adjust(npc, rng.randint(3, 8));
  const msgs = [`You pass time with your dao companion ${npc.name} (${npcStatus(npc)}).`];
  c.qi += qiToNext(c) * rng.uniform(0.4, 0.9) * (1 + npc.affinity / 200);
  msgs.push("  In shared cultivation your qi surges in harmony.");
  if (npc.affinity >= 80 && !c.titles.includes("Dao Companion")) { c.titles.push("Dao Companion"); note(c, `Became dao companions with ${npc.name}.`); msgs.push(`  ✦ You and ${npc.name} pledge to walk the dao together for life.`); }
  return msgs;
}
function withEnemy(c, npc, rng) {
  const msgs = [`You cross paths with your enemy ${npc.name} (${npcStatus(npc)}).`];
  if (npc.affinity <= -55 && rng.random() < 0.5) {
    msgs.push("  Old hatred ignites -- blades are drawn!");
    pushAll(msgs, fight(c, rng, [npc.name, npc.power, (c.realm + 1) * 6, "rogue"]));
    if (c.alive) { npc.alive = false; msgs.push(`  You settle the grudge with ${npc.name} for good.`); }
  } else { adjust(npc, rng.randint(-6, -2)); msgs.push("  Hard words are exchanged; the enmity festers deeper."); }
  return msgs;
}

/* ----------------------------- epitaph ----------------------------------- */
export function epitaph(c) {
  if (c.realm >= 9) return "✦ A name that will echo through the Nine Heavens for ten thousand years.";
  if (c.realm >= 6) return "✦ A grand monarch of an age, remembered in a hundred sects' annals.";
  if (c.realm >= 4) return "✦ A true cultivator who touched immortality's hem before the end.";
  if (c.realm >= 2) return "✦ A diligent seeker who climbed further than most ever dare.";
  return "✦ One more soul the great dao swallowed without a ripple. Try again.";
}
