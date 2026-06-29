/* The Nine Heavens -- game engine (JS port of the Python nine_heavens package).
 * Pure logic: every action takes the character + rng and returns an array of
 * message strings, mutating the character. The UI layer renders those messages. */

import * as D from "./data.js";
import * as World from "./world.js";

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

// Birth lands a soul in the lower reaches of the eight-tier attribute ladder. The
// raw rolled spread (root, omen, physique, upbringing) is preserved in its shape
// but bent through a curve so that an ordinary soul is born at tier 1, a strong
// birth (the sort that runs in cultivation/sect families) at tier 2, and only an
// anomalous prodigy at tier 3 — never the summit. (See generateCharacter.)
const BIRTH_TIER_CAP = D.ATTR_TIER_CUTS[2] - 1;   // 44 = the top of tier 3 (band 2 of 0..7)
const BIRTH_PRE_MAX = 124;   // the practical ceiling of the raw roll + birth bonuses
const BIRTH_GAMMA = 2.1;     // >1 curves most souls down to tier 1; only the gifted climb to 2..3
const BIRTH_FLOOR = 3;       // even an ordinary soul isn't scraping the very bottom of the ladder
// Bend a raw birth attribute onto the low tiers (1..3) with the curve above.
const birthTierValue = raw => clamp(BIRTH_FLOOR + Math.round((BIRTH_TIER_CAP - BIRTH_FLOOR) * Math.pow(Math.min(1, Math.max(0, raw) / BIRTH_PRE_MAX), BIRTH_GAMMA)), 1, BIRTH_TIER_CAP);

/* ------------------------- derived stats --------------------------------- */
export const realmName = c => D.REALMS[c.realm][0];
export const realmCn = c => D.REALMS[c.realm][1];
export const realmStages = c => D.REALMS[c.realm][2];
export function realmLabel(c) {
  const s = D.stageLabel(c.stage, realmStages(c));
  return s ? `${realmName(c)} – ${s}` : realmName(c);
}
export const qiToNext = c => D.REALMS[c.realm][4] * (1 + c.stage * 0.55);
const techQiBonus = c => c.techniques.reduce((a, t) => a + (D.TECHNIQUES[t] ? D.TECHNIQUES[t][2] : 0), 0) + (c.customTechs || []).reduce((a, ct) => a + (ct.qiBonus || 0), 0);
const techAtkBonus = c => c.techniques.reduce((a, t) => a + (D.TECHNIQUES[t] ? D.TECHNIQUES[t][3] : 0), 0) + (c.customTechs || []).reduce((a, ct) => a + (ct.atkPct || 0), 0);
export const sectOf = c => c.sectKey ? D.SECT_BY_KEY[c.sectKey] : null;
export const sectName = c => sectOf(c) ? sectOf(c)[1] : "Rogue Cultivator (散修)";
export const rankName = c => sectOf(c) ? D.SECT_RANKS[c.sectRank][0] : "";
export const sectSpeedBonus = c => sectOf(c) ? sectOf(c)[7] + D.SECT_RANKS[c.sectRank][3] : 0;
// Equipment: a cultivator binds one treasure per slot (c.equipment[slot]).
// `c.artifacts` is the full inventory of owned treasures; equipment references
// keys within it. equipmentEffects sums the bonuses of everything equipped.
export function ensureEquipment(c) {
  if (!c.equipment || typeof c.equipment !== "object") c.equipment = {};
  if (!c.refinement || typeof c.refinement !== "object") c.refinement = {};
  // Migrate legacy single-slot saves: bind the old signature treasure to its slot.
  if (c.equippedArtifact && !Object.values(c.equipment).includes(c.equippedArtifact)) {
    const slot = D.artifactSlot(c.equippedArtifact);
    if (slot && !c.equipment[slot]) c.equipment[slot] = c.equippedArtifact;
  }
  // Drop dangling references (e.g. items removed from data) and ones not owned.
  for (const slot of Object.keys(c.equipment)) {
    const key = c.equipment[slot];
    if (!key || !D.ARTIFACT_BY_KEY[key] || !(c.artifacts || []).includes(key)) delete c.equipment[slot];
  }
  syncEquippedArtifact(c);
  return c.equipment;
}
// Keep the legacy `equippedArtifact` field pointing at the strongest weapon/treasure
// so older code paths and saves stay coherent.
function syncEquippedArtifact(c) {
  const eq = c.equipment || {};
  c.equippedArtifact = eq.weapon || eq.treasure || Object.values(eq)[0] || null;
}
export const equippedKeys = c => Object.values(c.equipment || {}).filter(Boolean);
// Distinct elements granted by equipped treasures — these attune you in battle.
export function equipmentElements(c) {
  const out = [];
  for (const key of equippedKeys(c)) {
    const el = D.artifactElement(key);
    if (el && !out.includes(el)) out.push(el);
  }
  return out;
}

// ── Refinement (祭炼) ──────────────────────────────────────────────────────
// A cultivator may temper an owned treasure, raising every one of its effects.
// Refinement is tracked per treasure key in c.refinement (you own at most one of
// each). Each level adds REFINE_PER_LEVEL of the treasure's *base* effects.
export const REFINE_MAX = 6;
export const REFINE_PER_LEVEL = 0.12;
export const refineLevel = (c, key) => (c.refinement && c.refinement[key]) || 0;
// A treasure's effects after refinement — what actually feeds combat & display.
export function effectiveEffects(c, key) {
  const base = D.artifactEffects(key), mult = 1 + refineLevel(c, key) * REFINE_PER_LEVEL, out = {};
  for (const k in base) out[k] = base[k] * mult;
  return out;
}
// Which equipment sets are active and at what tier, given what's equipped.
// Returns [{ set, have, tier }] where tier is the highest bonus threshold met.
export function activeSets(c) {
  const counts = {};
  for (const key of equippedKeys(c)) {
    const sk = D.SET_OF_ARTIFACT[key];
    if (sk) counts[sk] = (counts[sk] || 0) + 1;
  }
  const out = [];
  for (const sk in counts) {
    const set = D.SET_BY_KEY[sk], have = counts[sk];
    const tier = Math.max(0, ...Object.keys(set.bonuses).map(Number).filter(n => n <= have));
    if (tier > 0) out.push({ set, have, tier });
  }
  return out;
}
// Summed set bonuses (the highest tier reached for each active set).
export function setBonusEffects(c) {
  const sum = { atk: 0, qi: 0, def: 0, hp: 0, dodge: 0, crit: 0, life: 0, qiMax: 0 };
  for (const { set, tier } of activeSets(c)) {
    const b = set.bonuses[tier] || {};
    for (const k in sum) sum[k] += b[k] || 0;
  }
  return sum;
}
export function equipmentEffects(c) {
  const sum = { atk: 0, qi: 0, def: 0, hp: 0, dodge: 0, crit: 0, life: 0, qiMax: 0 };
  for (const key of equippedKeys(c)) {
    const e = effectiveEffects(c, key);
    for (const k in sum) sum[k] += e[k] || 0;
  }
  const sb = setBonusEffects(c);
  for (const k in sum) sum[k] += sb[k] || 0;
  return sum;
}
// Cost in spirit stones to attempt the next refinement (climbs steeply by level).
const REFINE_BASE_COST = { Mortal: 30, Spirit: 120, Earth: 500, Heaven: 2400, Immortal: 12000 };
export function refineCost(c, key) {
  const lvl = refineLevel(c, key);
  return Math.round((REFINE_BASE_COST[D.artifactGrade(key)] || 50) * (1 + lvl * 0.8));
}
// Success chance: high at first, falling as the treasure resists further tempering;
// a steady soul, fortune and alchemical skill all help hold the fire.
export function refineChance(c, key) {
  const lvl = refineLevel(c, key);
  const skill = c.soul / 500 + c.luck / 700 + (c.alchemySkill || 0) / 200;
  return clamp(0.92 - lvl * 0.12 + skill, 0.2, 0.95);
}
export const canRefine = (c, key) => c.artifacts.includes(key) && refineLevel(c, key) < REFINE_MAX;
export function refineTreasure(c, key, rng) {
  if (!c.artifacts.includes(key)) return ["You do not possess that treasure."];
  if (refineLevel(c, key) >= REFINE_MAX) return ["This treasure is refined to its limit — its spirit can bear no more."];
  const cost = refineCost(c, key);
  if (c.spiritStones < cost) return [`Refining the ${D.ARTIFACT_BY_KEY[key][1]} costs ${cost} stones — you cannot afford it.`];
  c.spiritStones -= cost;
  if (!c.refinement) c.refinement = {};
  const name = D.ARTIFACT_BY_KEY[key][1];
  if (rng.random() < refineChance(c, key)) {
    c.refinement[key] = refineLevel(c, key) + 1;
    note(c, `Refined the ${name} to +${c.refinement[key]} (祭炼).`);
    return [`✦ You feed spirit stones into the ${name}'s spirit-fire. The treasure hums and brightens — refined to +${c.refinement[key]}!`];
  }
  return [`The ${name} bucks against the refining flame; the qi disperses and ${cost} stones are spent in vain. (Refinement holds at +${refineLevel(c, key)}.)`];
}
export const artifactOf = c => c.equippedArtifact ? D.ARTIFACT_BY_KEY[c.equippedArtifact] : null;
const artifactAtkPct = c => equipmentEffects(c).atk;
const artifactQiBonus = c => equipmentEffects(c).qi;
// A held Dao's tier of comprehension (1..4); deeper tiers scale its bonuses.
export const daoTierOf = (c, k) => (c.daoLevels && c.daoLevels[k]) || 1;
export const daoPowerBonus = c => (c.daos || []).reduce((a, d) => a + (D.DAO_BY_KEY[d] ? D.DAO_BY_KEY[d][2] * D.daoTierFactor(daoTierOf(c, d)) : 0), 0);
export const daoBreakthroughBonus = c => (c.daos || []).reduce((a, d) => a + (D.DAO_BY_KEY[d] ? D.DAO_BY_KEY[d][3] * D.daoTierFactor(daoTierOf(c, d)) : 0), 0);
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
  const timeDao = c.daos.includes("time") ? 0.25 * D.daoTierFactor(daoTierOf(c, "time")) : 0.0;
  const phys = D.physEffect(c).cultivate || 0;
  return rootMult * comp * (1 + techQiBonus(c)) * realmFactor * 1.8 *
    (1 + sectSpeedBonus(c) + artifactQiBonus(c) + timeDao + phys + abodeQiBonus(c) + ownSectSpeedBonus(c)) *
    eraCultMult(c);
}
// Martial might from body cultivation — its own power base, independent of qi
// realm, so a body cultivator (even rootless) can grow truly strong.
export const bodyMartialBase = c => D.bodyRealmAt(c.bodyRealm || 0)[3];

/* --- the lesser stats given clear identities (Presence / Fortune / Spirit) ---
 * Charm is your presence and renown: a charismatic cultivator's deeds spread
 * further, their banner draws followers, and their allies fight the harder for
 * them. Luck is your fortune: it sweetens what the heavens hand you — loot,
 * pills, treasures — and softens the bite of ill chance. (Soul, the spirit pillar
 * opposite Constitution's body, drives the qi pool, qi regen and mental ward in
 * combat — see combat.js — as well as alchemy, talismans and the forging of arts.) */
export const presenceMult = c => 1 + (c.charm || 0) / 160;   // 1.0 .. ~2.0
export const fortuneMult = c => 1 + (c.luck || 0) / 160;     // 1.0 .. ~2.0
// Award fame for a public deed, amplified by your presence. Returns the gain.
export function gainFame(c, base) { const g = Math.max(0, Math.round(base * presenceMult(c))); c.reputation += g; return g; }

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
export const rollBeastTrait = rng => weightedChoice(rng, D.BEAST_TRAITS, 4)[0];
export const beastTraitOf = b => (b && b.trait && D.BEAST_TRAIT_BY_KEY[b.trait]) ? b.trait : null;
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
  else if (key === "swordroot") elements = ["Metal"];
  else if (key === "thunderroot") elements = ["Lightning"];
  else if (key === "iceroot") elements = ["Ice"];
  else if (key === "voidroot") elements = ["Void"];
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
    sectKey: null, sectRank: 0, contribution: 0, sectMissions: 0, sectJoinedAge: null, titles: [], epithets: [], relationships: [],
    herbs: 0, healingPills: 0, breakthroughPills: 0, alchemySkill: 0, talismans: {},
    artifacts: [], equipment: {}, refinement: {}, equippedArtifact: null, beast: null, abode: 0, abodeRegion: null, ownSect: null, legacySect: null,
    daos: [], daoLevels: {}, daoFocus: null, daoInsight: 0, daoHeart: 10, karma: 0, reincarnationCount: 0, arcs: {}, arcTriggers: [], rebornBond: null,
    world: null, location: 0, abodeLocation: null, priceMult: 1, journeyTo: null,
    movementArts: [], moveMastery: {}, customTechs: [],
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
    temple: ["comprehension", 8], corsair: ["constitution", 6], nomad: ["constitution", 8],
    physician: ["comprehension", 4], fallen: ["charm", 4],
  };
  if (nurture[bk]) { const [a, d] = nurture[bk]; c[a] += d; }
  // A physician's child grows up with a real head start at the furnace.
  if (bk === "physician") c.alchemySkill = (c.alchemySkill || 0) + 10;
  // A newborn soul begins low on the eight-tier ladder: root, omen, physique and
  // upbringing decide *where* in the first three tiers you start — a fine birth
  // lands you at tier 2, a heavenly one at tier 3 — but nothing is born at the
  // summit. The long climb up tiers 4..8 is the work of a life of cultivation.
  // (Legacy — reincarnation and heirs — layers its own gains above this cap.)
  for (const a of ["comprehension", "constitution", "soul", "luck", "charm"])
    c[a] = birthTierValue(c[a]);

  recomputeMaxAge(c);
  recomputeMaxHp(c);
  World.ensureWorld(c, rng, true);   // born into a freshly generated realm
  note(c, `Born as ${c.name}, ${c.backgroundName}.`);
  note(c, `Spiritual root: ${c.root.display}.`);
  return c;
}

/* ------------------------------- genetics -------------------------------- */
// Children inherit a blend of BOTH parents: spiritual-root tier (with mutation),
// special physiques that can run in a bloodline, looks, and core attributes.
const GENO_SPECIALS = ["sturdy", "spirit", "yin", "yang", "dao", "phoenix", "gale", "swordheart", "titan", "dragon", "immortal"];
const apprIdx = key => { const i = D.APPEARANCES.findIndex(a => a[0] === key); return i < 0 ? 2 : i; };
const genomeShape = (rootKey, physiqueKey, appearanceKey, comp, con, soul, luck, charm) =>
  ({ rootKey, physiqueKey, appearanceKey, comprehension: comp, constitution: con, soul, luck, charm });

// A latent, unrevealed genome for an NPC (a spouse's heritable talent).
export function rollGenome(rng) {
  // talent tends to attract talent: a dao companion's root is the better of two draws.
  const rootKey = [weightedChoice(rng, D.ROOT_TYPES, 4), weightedChoice(rng, D.ROOT_TYPES, 4)]
    .sort((a, b) => (D.ROOT_TIER[b[0]] || 0) - (D.ROOT_TIER[a[0]] || 0))[0][0];
  // The genome holds a soul's *birth* attributes — low on the ladder (tiers 1..3),
  // just like a freshly rolled player; a long cultivation life raises them (npcAttr).
  return genomeShape(rootKey, weightedChoice(rng, D.PHYSIQUES, 7)[0], weightedChoice(rng, D.APPEARANCES, 4)[0],
    birthTierValue(rollAttribute(rng)), birthTierValue(rollAttribute(rng)), birthTierValue(rollAttribute(rng)),
    birthTierValue(rollAttribute(rng)), birthTierValue(rollAttribute(rng)));
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
// An NPC's effective attributes: a tier-1..3 birth base (kept in the genome) raised
// by a lifetime of cultivation, so their stats climb with their realm just as yours
// climb with training. The cultivation pillars (comprehension/constitution/soul)
// climb fast; fortune and presence drift up only gently. The very top tiers (7–8)
// stay the preserve of a player who deliberately tempers them.
const NPC_ATTR_CLIMB = { comprehension: 9, constitution: 9, soul: 9, luck: 3, charm: 3 };
export function npcAttr(npc, key) {
  const base = (npc.geno && npc.geno[key] != null) ? npc.geno[key] : 18;
  return clamp(Math.round(base + (npc.realm || 0) * (NPC_ATTR_CLIMB[key] || 0)), 1, 160);
}
export function npcPower(npc) {
  const rf = (npc.realm || 0) * 10 + (npc.stage || 0) + 1;
  const con = npcAttr(npc, "constitution"), soul = npcAttr(npc, "soul");
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
  // Their own age and lifespan — higher realms (and a tempered root) live far longer.
  if (npc.maxAge == null) npc.maxAge = D.REALMS[npc.realm][3];
  if (npc.age == null) {
    const base = { master: 60, disciple: 16, family: 28 }[npc.role] || 22;
    npc.age = opts.age != null ? opts.age : Math.min(npc.maxAge - 2, base + npc.realm * 8 + rng.randint(-5, 12));
  }
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
  if (broke) {
    npc.maxAge = D.REALMS[npc.realm][3];                              // a new realm lengthens their life
    if (rng.random() < 0.4) {                                          // and sometimes a new art
      const unknown = Object.keys(D.TECHNIQUES).filter(k => k !== "basic_breathing" && !(npc.techniques || []).includes(k));
      if (unknown.length) (npc.techniques = npc.techniques || ["basic_breathing"]).push(rng.choice(unknown));
    }
  }
  npc.power = Math.max(npc.power || 0, npcPower(npc));
  return broke ? "realm" : "stage";
}

/* --------------------- the realm's NPC population ------------------------ */
// The world is peopled by a population of NPC cultivators, generated once when
// the realm is born. They dwell in its cities, towns and villages, fill the six
// great sects from Sect Master down to outer disciple, and the strongest among
// them are crowned the era's geniuses on the Heaven Board (天骄榜). Each is a
// full cultivator (root, realm, techniques, power) with an age and a lifespan,
// and each climbs — and dies — on their own merits, whether or not you awaken.
const GENIUS_TITLES = ["the Sword Prodigy", "the Jade Phoenix", "the Young Patriarch", "the Frostfire Genius",
  "the Heaven's Pride", "the Demon-Slayer", "the Cloud Walker", "the Thunder Scion", "the Peerless Maiden",
  "the Dao Child", "the Blood Marquis", "the Azure Dragon", "the Starpicker", "the Undying Youth"];
const NPC_ROOT_POOL = ["quad", "triple", "triple", "dual", "dual", "heavenly", "variant"];

// One realm denizen: a full cultivator with a home (a location id) and, often, a
// sect rank. opts may pin realm/power/age/sect/title/home/rootPool/role.
function makeWorldNpc(rng, opts = {}) {
  const rootKey = opts.rootKey || rng.choice(opts.rootPool || NPC_ROOT_POOL);
  const npc = {
    name: npcName(rng), role: opts.role || "world", alive: true, affinity: 0,
    sex: opts.sex || (rng.random() < 0.5 ? "female" : "male"),
    geno: Object.assign(rollGenome(rng), { rootKey }),
    home: opts.home != null ? opts.home : null,
  };
  if (opts.sectKey) { npc.sectKey = opts.sectKey; npc.sectRank = opts.sectRank || 0; }
  if (opts.title) npc.title = opts.title;
  return ensureNpcProfile(npc, rng, { realm: opts.realm, power: opts.power, age: opts.age });
}
// A standalone genius for the Heaven Board's rising newcomers (no fixed home).
function makeGenius(rng, realm) {
  const rootKey = rng.choice(["triple", "dual", "dual", "heavenly", "heavenly", "variant", "quad", "chaos"]);
  const r = realm != null ? realm : rng.choices([2, 3, 4, 5, 6, 7], [24, 28, 22, 14, 8, 4]);
  return makeWorldNpc(rng, { rootKey, realm: r, role: "genius", title: rng.choice(GENIUS_TITLES) });
}
// Title the strongest as-yet-untitled cultivators, so the Heaven Board always
// has named stars at its head however the population shifts over the years.
function crownGeniuses(rng, pop) {
  const taken = new Set(pop.filter(n => n.title).map(n => n.title));
  const free = GENIUS_TITLES.filter(t => !taken.has(t));
  if (!free.length) return;
  const rising = pop.filter(n => n.alive && !n.title).sort((a, b) => (b.power || 0) - (a.power || 0));
  for (let i = 0; i < rising.length && free.length; i++) rising[i].title = free.shift();
}
// People a freshly generated world: fill its sects top to bottom, scatter rogue
// cultivators through its settlements (the deadlier the land, the stronger they
// run), and add a few unaffiliated wanderers. Returns a flat array of NPCs.
export function generatePopulation(rng, world) {
  const pop = [];
  const locs = (world && world.locations) || [];
  const dangerIdx = loc => Math.max(0, D.REGIONS.findIndex(r => r[0] === (loc && loc.biome)));
  // The six great sects, seated on the map, each filled from the top down.
  for (const sect of D.SECTS) {
    const key = sect[0];
    const seat = locs.find(l => l.sectKey === key);
    if (!seat) continue;
    const tier = sect[4] || 1;                                       // 1..4 — a sect's might
    const masterRealm = Math.min(D.REALMS.length - 1, 6 + tier);
    pop.push(makeWorldNpc(rng, { home: seat.id, sectKey: key, sectRank: 5, role: "sectmaster",
      title: "Sect Master", realm: masterRealm, age: rng.randint(120, 320) }));
    const elders = 4 + (tier >= 3 ? 2 : 0);
    for (let i = 0; i < elders; i++)
      pop.push(makeWorldNpc(rng, { home: seat.id, sectKey: key, sectRank: i === 0 ? 4 : 3, role: "elder",
        title: i === 0 ? "Grand Elder" : "Elder", realm: Math.max(4, masterRealm - rng.randint(1, 3)) }));
    const disciples = 22 + tier * 8;
    for (let i = 0; i < disciples; i++)
      pop.push(makeWorldNpc(rng, { home: seat.id, sectKey: key, sectRank: rng.randint(0, 2), role: "disciple",
        realm: Math.max(1, masterRealm - rng.randint(3, 6)), age: rng.randint(16, 60) }));
  }
  // Rogue cultivators dwelling in each settlement (the more populous the place,
  // the denser its cultivators; the deadlier the land, the harder they run).
  for (const loc of locs) {
    const t = World.LOC_TYPES[loc.type];
    if (!t || !t.settle || loc.sectKey) continue;
    const di = dangerIdx(loc), n = (t.npc || 1) * 6 + rng.randint(0, 4);
    for (let i = 0; i < n; i++)
      pop.push(makeWorldNpc(rng, { home: loc.id, role: "rogue",
        realm: clamp(1 + di + rng.randint(0, 2), 0, D.REALMS.length - 1),
        rootPool: ["waste", "quad", "quad", "triple", "triple", "dual"] }));
  }
  // Unaffiliated wanderers of real strength — the era's loose stars.
  for (let i = 0; i < 16; i++) {
    const loc = locs.length ? rng.choice(locs) : null;
    pop.push(makeWorldNpc(rng, { home: loc ? loc.id : null, role: "genius",
      realm: rng.choices([3, 4, 5, 6], [30, 30, 25, 15]) }));
  }
  crownGeniuses(rng, pop);
  return pop;
}
// Make sure a world carries its population (generating one for older saves).
export function ensurePopulation(c, rng) {
  if (c.world && (!Array.isArray(c.world.npcs) || !c.world.npcs.length)) {
    c.world.npcs = generatePopulation(rng, c.world);
    delete c.rankboard;                                              // legacy field, now subsumed
  }
  if (c.world) ensureNids(c.world);                                  // stable ids for the bond web (also backfills old saves)
}
// Succeed a fallen denizen: a sect figure is replaced within their own ranks; a
// free cultivator gives way to a rising young star.
function makeReplacement(rng, dead) {
  if (dead.sectKey) {
    const tier = (D.SECT_BY_KEY[dead.sectKey] || [])[4] || 1;
    const realm = dead.sectRank >= 5 ? Math.min(D.REALMS.length - 1, 6 + tier)
      : Math.max(1, (dead.realm || 4) - rng.randint(0, 2));
    return makeWorldNpc(rng, { home: dead.home, sectKey: dead.sectKey, sectRank: dead.sectRank,
      role: dead.role, title: dead.sectRank >= 3 ? dead.title : null, realm,
      age: dead.sectRank >= 4 ? rng.randint(110, 240) : rng.randint(16, 60) });
  }
  return makeGenius(rng, rng.randint(2, 3));
}
// Advance the whole population a year: each cultivator climbs their own road, and
// any who die of old age are succeeded by a newcomer in their place. Returns a few
// notable "tidings" (a great breakthrough, the passing of a famed name) so the
// caller can let word of the wider realm reach the player.
const sectShort = key => key && D.SECT_BY_KEY[key] ? D.SECT_BY_KEY[key][1].split(" (")[0] : null;
export function agePopulation(c, rng) {
  const pop = c.world && c.world.npcs;
  if (!Array.isArray(pop)) return [];
  const tidings = [];
  for (let i = 0; i < pop.length; i++) {
    const n = pop[i];
    if (!n || !n.alive) continue;
    const step = advanceNpc(n, rng);
    if (step === "realm" && n.realm >= 7 && tidings.length < 4) {
      const where = sectShort(n.sectKey);
      tidings.push(`${n.name}${where ? ` of the ${where}` : ""} has broken through to ${D.REALMS[n.realm][0]} (${D.REALMS[n.realm][1]}).`);
    }
    if (n.age != null) {
      n.age += 1;
      if (n.age > n.maxAge) {
        if ((n.title || (n.realm || 0) >= 7) && tidings.length < 4)
          tidings.push(`${n.title ? `${n.name}, ${n.title},` : n.name} has passed from the world, a lifespan spent at ${D.REALMS[n.realm][0]}.`);
        n.alive = false; pop[i] = makeReplacement(rng, n);
      }
    }
  }
  crownGeniuses(rng, pop);
  return tidings;
}

/* ===================== the living society (风云录) ======================= *
 * Beyond merely climbing and dying, the realm's cultivators live AMONG one
 * another: they kindle rivalries, swear brotherhood, take lovers and disciples,
 * duel — sometimes to the death — betray, avenge, stumble onto fortunes, and
 * fall to the demon path. simulateSociety advances this web one year, recording
 * the notable turns into the world Chronicle (风云录) and returning fresh
 * entries so the caller can let word reach the player. It is deliberately kept
 * out of the lighter agePopulation tick so the population's structural tests
 * stay deterministic; the year-tick (life.ageUp) drives it during play.        */

// A stable per-NPC id, so bonds survive the array churn of death & succession.
function ensureNids(world) {
  if (!world || !Array.isArray(world.npcs)) return;
  if (world._nid == null) world._nid = 0;
  for (const n of world.npcs) if (n && n.nid == null) n.nid = world._nid++;
}
export const npcByNid = (c, nid) => ((c.world && c.world.npcs) || []).find(n => n && n.alive && n.nid === nid) || null;
// Temperament is derived from a stable string hash (see hashStr below), so
// peopling the realm never touches the shared RNG stream — seed-for-seed.
export function npcTemperament(npc) {
  if (!npc) return "reclusive";
  if (!npc.tmpr) {
    const seed = (npc.name || "?") + "|" + ((npc.geno && npc.geno.rootKey) || "") + "|" + (npc.sex || "");
    npc.tmpr = D.TEMPERAMENT_KEYS[hashStr(seed) % D.TEMPERAMENT_KEYS.length];
  }
  return npc.tmpr;
}
const tmpr = npc => D.temperamentOf(npcTemperament(npc));
export const npcRenown = npc => Math.round((npc && npc.renown) || 0);
export const npcDeeds = npc => Object.assign({ kills: 0, wins: 0, losses: 0 }, (npc && npc.deeds) || {});
const bumpDeed = (npc, key, by = 1) => { npc.deeds = npc.deeds || {}; npc.deeds[key] = (npc.deeds[key] || 0) + by; };
const gainRenown = (npc, by) => { npc.renown = ((npc.renown) || 0) + by; };
// Bonds between NPCs: { nid, kind, since }. kind ∈ rival|sworn|lover|spouse|
// master|disciple|nemesis. Stored on each end as appropriate.
function addBond(a, b, kind, year) {
  if (!a || !b || a === b) return;
  a.bonds = a.bonds || [];
  if (!a.bonds.some(x => x.nid === b.nid && x.kind === kind)) a.bonds.push({ nid: b.nid, kind, since: year });
}
const hasBond = (a, b, kind) => !!(a.bonds && a.bonds.some(x => x.nid === b.nid && (!kind || x.kind === kind)));
const anyBondKind = (a, kind) => (a && a.bonds || []).filter(x => x.kind === kind);
function dropBond(a, b, kind) { if (a && a.bonds) a.bonds = a.bonds.filter(x => !(x.nid === b.nid && (!kind || x.kind === kind))); }
// Resolve an NPC's bonds to live partners for display: [{npc, kind, since}].
export function npcBonds(c, npc) {
  if (!npc || !npc.bonds) return [];
  const out = [];
  for (const x of npc.bonds) { const o = npcByNid(c, x.nid); if (o) out.push({ npc: o, kind: x.kind, since: x.since }); }
  return out;
}
// Word-of-the-realm reasons, for colour on rivalries and feuds.
const FEUD_REASONS = ["a contested fortune", "a slight at a grand banquet", "a stolen manual", "a disputed Dao", "an old debt of blood", "a humiliation before their peers", "the favour of a master", "a claim to the same throne"];
const DEMON_PREFIX = ["the Blood", "the Fallen", "the Devil", "the Shattered", "the Abyssal", "the Crimson"];
const DEMON_SUFFIX = ["Sovereign", "Fiend", "Heretic", "Reaver", "Ghost", "Tyrant"];

// One year of the living world. Returns the fresh Chronicle entries.
export function simulateSociety(c, rng) {
  const world = c.world;
  if (!world || !Array.isArray(world.npcs)) return [];
  ensureNids(world);
  world.year = (world.year || 0) + 1;
  const pop = world.npcs;
  const chronicle = world.chronicle = world.chronicle || [];
  const fresh = [];
  const record = (kind, text, glyph) => {
    const e = { y: c.age, kind, text, glyph: glyph || "scroll" };
    chronicle.push(e);
    if (chronicle.length > 80) chronicle.splice(0, chronicle.length - 80);
    fresh.push(e);
  };
  const living = () => pop.filter(n => n && n.alive);
  const pool = living();
  tickSectPolitics(c, rng, record);            // the great sects ally, feud and war among themselves
  if (pool.length < 8) return fresh;
  const placeName = id => { const l = world.locations && world.locations[id]; return l ? l.name : "the wilds"; };
  const pickAt = () => {                       // a random inhabited settlement's roster
    const homes = {};
    for (const n of living()) if (n.home != null) (homes[n.home] = homes[n.home] || []).push(n);
    const ids = Object.keys(homes).filter(h => homes[h].length >= 2);
    if (!ids.length) return null;
    const h = ids[rng.randint(0, ids.length - 1)];
    return { home: +h, roster: homes[h] };
  };
  const two = roster => {
    if (!roster || roster.length < 2) return null;
    const a = roster[rng.randint(0, roster.length - 1)];
    let b = roster[rng.randint(0, roster.length - 1)], guard = 0;
    while (b === a && guard++ < 6) b = roster[rng.randint(0, roster.length - 1)];
    return b === a ? null : [a, b];
  };
  const winnerOf = (a, b) => {                  // power decides, but fate tips the scales
    const pa = (a.power || npcPower(a)) * rng.uniform(0.7, 1.3);
    const pb = (b.power || npcPower(b)) * rng.uniform(0.7, 1.3);
    return pa >= pb ? [a, b] : [b, a];
  };
  // Kill an NPC and seat their successor; the dead's sworn kin & lovers may vow
  // vengeance on the slayer, threading feuds across the years.
  const slay = (dead, killer, year) => {
    const deadNid = dead.nid, idx = pop.indexOf(dead);
    for (const n of pool) {
      if (n === dead || !n.alive) continue;
      const tie = (n.bonds || []).find(x => x.nid === deadNid && (x.kind === "sworn" || x.kind === "spouse" || x.kind === "lover" || x.kind === "master" || x.kind === "disciple"));
      if (tie && killer && killer.alive && rng.random() < 0.7) {
        addBond(n, killer, "nemesis", year);
        record("feud", `${n.name} swears vengeance upon ${killer.name} for the death of ${dead.name}.`, "flame");
      }
    }
    dead.alive = false;
    if (idx >= 0) pop[idx] = makeReplacement(rng, dead);
  };
  // A duel between two cultivators. ferocity raises the odds it ends in blood.
  const duel = (a, b, year, ferocity, ctx) => {
    if (!a || !b || a === b || !a.alive || !b.alive) return false;
    const [win, lose] = winnerOf(a, b);
    bumpDeed(win, "wins"); bumpDeed(lose, "losses");
    gainRenown(win, 2 + (win.realm || 0));
    const lethal = ferocity + (1 - tmpr(win).honor) * 0.35 + (win.demonic ? 0.3 : 0);
    if (rng.random() < lethal) {
      bumpDeed(win, "kills"); gainRenown(win, 6 + (lose.realm || 0) * 2);
      record("duel", `${win.name} slew ${lose.name}${ctx ? ` ${ctx}` : ""} at ${placeName(win.home != null ? win.home : lose.home)}.`, "blade");
      slay(lose, win, year);
      return true;
    }
    lose.power = Math.max(2, Math.round((lose.power || npcPower(lose)) * rng.uniform(0.82, 0.93)));
    record("duel", `${win.name} bested ${lose.name}${ctx ? ` ${ctx}` : ""}, who withdrew to nurse the wound.`, "fist");
    return false;
  };

  /* --- the weighted roster of what a year in the realm may bring --- */
  const events = [
    // Rivalry kindles between two co-located, contentious souls.
    { w: 14, go: () => {
      const at = pickAt(); if (!at) return false;
      const pr = two(at.roster); if (!pr) return false;
      const [a, b] = pr;
      if (hasBond(a, b) || hasBond(b, a)) return false;
      if ((tmpr(a).aggression + tmpr(a).ambition + tmpr(b).aggression) / 3 < 0.5) return false;
      const year = c.age;
      addBond(a, b, "rival", year); addBond(b, a, "rival", year);
      record("rivalry", `${a.name} and ${b.name} of ${placeName(at.home)} have fallen to bitter rivalry over ${rng.choice(FEUD_REASONS)}.`, "fist");
      return true;
    } },
    // Old rivals come at last to blows.
    { w: 16, go: () => {
      const haveRivals = living().filter(n => anyBondKind(n, "rival").some(x => npcByNid(c, x.nid)));
      if (!haveRivals.length) return false;
      const a = rng.choice(haveRivals);
      const rb = anyBondKind(a, "rival").map(x => npcByNid(c, x.nid)).filter(Boolean);
      if (!rb.length) return false;
      const b = rng.choice(rb);
      return duel(a, b, c.age, 0.1, "in a long-awaited reckoning") || true;
    } },
    // A pursued blood-feud (nemesis) is finally answered.
    { w: 12, go: () => {
      const avengers = living().filter(n => anyBondKind(n, "nemesis").some(x => npcByNid(c, x.nid)));
      if (!avengers.length) return false;
      const a = rng.choice(avengers);
      const targets = anyBondKind(a, "nemesis").map(x => npcByNid(c, x.nid)).filter(Boolean);
      if (!targets.length) return false;
      const b = rng.choice(targets);
      const slain = duel(a, b, c.age, 0.4, "to settle a blood-debt");
      if (slain) dropBond(a, b, "nemesis");
      return true;
    } },
    // Sworn brotherhood / sisterhood between two warm, steadfast souls.
    { w: 11, go: () => {
      const at = pickAt(); if (!at) return false;
      const pr = two(at.roster); if (!pr) return false;
      const [a, b] = pr;
      if (hasBond(a, b)) return false;
      if ((tmpr(a).sociability + tmpr(b).sociability) / 2 < 0.6) return false;
      const year = c.age;
      addBond(a, b, "sworn", year); addBond(b, a, "sworn", year);
      gainRenown(a, 1); gainRenown(b, 1);
      record("bond", `${a.name} and ${b.name} have sworn themselves brother-in-arms beneath the ${placeName(at.home)} sky.`, "couple");
      return true;
    } },
    // Lovers found, and in time wed.
    { w: 10, go: () => {
      const at = pickAt(); if (!at) return false;
      const pr = two(at.roster); if (!pr) return false;
      let [a, b] = pr;
      if (anyBondKind(a, "spouse").length || anyBondKind(b, "spouse").length) return false;
      const year = c.age;
      if (hasBond(a, b, "lover")) {
        dropBond(a, b, "lover"); dropBond(b, a, "lover");
        addBond(a, b, "spouse", year); addBond(b, a, "spouse", year);
        record("love", `${a.name} and ${b.name} are wed, two Daos entwined as one.`, "heart");
      } else {
        if (hasBond(a, b)) return false;
        addBond(a, b, "lover", year); addBond(b, a, "lover", year);
        record("love", `${a.name} and ${b.name} have become dao-companions, hearts turned to one another.`, "heart");
      }
      return true;
    } },
    // A master takes a promising disciple under their wing.
    { w: 10, go: () => {
      const at = pickAt(); if (!at) return false;
      const masters = at.roster.filter(n => (n.realm || 0) >= 5 && tmpr(n).honor >= 0.5);
      const youths = at.roster.filter(n => (n.realm || 0) <= 3 && (n.age || 99) < 40);
      if (!masters.length || !youths.length) return false;
      const m = rng.choice(masters), d = rng.choice(youths);
      if (m === d || hasBond(m, d)) return false;
      const year = c.age;
      addBond(m, d, "disciple", year); addBond(d, m, "master", year);
      d.cultProgress = (d.cultProgress || 0) + 0.6;            // a master quickens the road
      record("bond", `${m.name} has taken ${d.name} as a personal disciple, and the realm watches a star rise.`, "lotus");
      return true;
    } },
    // A faithless schemer betrays a sworn ally for power.
    { w: 7, go: () => {
      const traitors = living().filter(n => tmpr(n).honor <= 0.25 && anyBondKind(n, "sworn").some(x => npcByNid(c, x.nid)));
      if (!traitors.length) return false;
      const a = rng.choice(traitors);
      const allies = anyBondKind(a, "sworn").map(x => npcByNid(c, x.nid)).filter(Boolean);
      if (!allies.length) return false;
      const b = rng.choice(allies);
      const year = c.age;
      dropBond(a, b, "sworn"); dropBond(b, a, "sworn");
      addBond(b, a, "nemesis", year);
      a.power = Math.round((a.power || npcPower(a)) * rng.uniform(1.05, 1.18));   // ill-gotten gain
      gainRenown(a, 3);
      record("feud", `${a.name} has betrayed sworn brother ${b.name}, seizing their fortune and leaving a blood-feud in the dust.`, "mask");
      return true;
    } },
    // Disciples of two warring sects clash on the field — the human cost of the
    // great-sect wars, fought blade to blade.
    { w: 10, go: () => {
      const wars = sectWarsActive(c);
      if (!wars.length) return false;
      const { a, b } = rng.choice(wars);
      const da = living().filter(n => n.sectKey === a), db = living().filter(n => n.sectKey === b);
      if (!da.length || !db.length) return false;
      const x = rng.choice(da), y = rng.choice(db);
      return duel(x, y, c.age, 0.25, `as the ${sectShort(a)} and ${sectShort(b)} clash`) || true;
    } },
    // An ambitious, merciless cultivator strays onto the demon path. Demons stay
    // rare and dreadful: no more than a handful may stalk the realm at once.
    { w: 5, go: () => {
      if (living().filter(n => n.demonic).length >= Math.max(2, Math.round(pool.length / 60))) return false;
      const cand = living().filter(n => !n.demonic && (n.realm || 0) >= 4 && tmpr(n).honor <= 0.3 && tmpr(n).ambition >= 0.6);
      if (!cand.length) return false;
      const n = rng.choice(cand);
      n.demonic = true;
      n.power = Math.round((n.power || npcPower(n)) * rng.uniform(1.3, 1.6));
      n.title = `${rng.choice(DEMON_PREFIX)} ${rng.choice(DEMON_SUFFIX)}`;
      gainRenown(n, 10);
      const loc = world.locations && world.locations[n.home];
      if (loc) loc.unrest = (loc.unrest || 0) + 2;             // their shadow falls on the land
      record("demon", `${n.name} has fallen to the demon path, reborn as ${n.title}. Dread spreads from ${placeName(n.home)}.`, "flame");
      return true;
    } },
    // A righteous hero rises to hunt a demon down.
    { w: 8, go: () => {
      const demons = living().filter(n => n.demonic);
      if (!demons.length) return false;
      const d = rng.choice(demons);
      const heroes = living().filter(n => !n.demonic && (n.realm || 0) >= (d.realm || 0) - 1 && tmpr(n).honor >= 0.6 && tmpr(n).aggression >= 0.4);
      if (!heroes.length) return false;
      const h = rng.choice(heroes);
      const [win, lose] = winnerOf(h, d);
      bumpDeed(win, "wins"); bumpDeed(lose, "losses");
      if (win === h) {                                          // the demon is purged
        bumpDeed(h, "kills"); gainRenown(h, 14);
        const loc = world.locations && world.locations[d.home];
        if (loc) loc.unrest = Math.max(0, (loc.unrest || 0) - 2);
        record("hero", `${h.name} has slain the demon ${d.title || d.name}, and ${placeName(d.home)} breathes again.`, "lotus");
        slay(d, h, c.age);
      } else {                                                  // the demon prevails, and worsens
        gainRenown(d, 8); d.power = Math.round((d.power || npcPower(d)) * rng.uniform(1.05, 1.15));
        record("demon", `${d.title || d.name} cut down the righteous ${h.name}; the demon's legend darkens.`, "flame");
        slay(h, d, c.age);
      }
      return true;
    } },
    // A cultivator stumbles upon a fortune and surges in power.
    { w: 9, go: () => {
      const n = rng.choice(living());
      if ((n.realm || 0) >= (NPC_REALM_CAP[(n.geno && n.geno.rootKey) || "waste"] || 4)) return false;
      const kind = rng.random();
      if (kind < 0.5) {                                         // an inheritance / sealed legacy
        n.power = Math.round((n.power || npcPower(n)) * rng.uniform(1.2, 1.45));
        gainRenown(n, 5);
        record("fortune", `${n.name} has won an immortal's inheritance in ${placeName(n.home)}, and their cultivation soars.`, "key");
      } else {                                                  // a clean breakthrough
        const before = n.realm;
        advanceNpc(n, rng); advanceNpc(n, rng);
        if ((n.realm || 0) > before) record("fortune", `${n.name} has broken through to ${D.REALMS[n.realm][0]} (${D.REALMS[n.realm][1]}) ahead of all expectation.`, "dao");
        else return false;
      }
      return true;
    } },
  ];
  const totalW = events.reduce((s, e) => s + e.w, 0);
  const rounds = 3 + (rng.random() < 0.5 ? 1 : 0) + (pool.length > 220 ? 1 : 0);
  for (let r = 0; r < rounds; r++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let roll = rng.random() * totalW, pick = events[0];
      for (const e of events) { if (roll < e.w) { pick = e; break; } roll -= e.w; }
      if (pick.go()) break;
    }
  }
  // A few restless souls wander the roads — outcasts, the demon-touched, the free.
  if (world.locations && rng.random() < 0.5) {
    const wanderers = living().filter(n => (n.role === "world" || n.role === "rogue" || n.role === "genius" || n.demonic) && n.home != null);
    if (wanderers.length) {
      const n = rng.choice(wanderers), loc = world.locations[n.home];
      if (loc && loc.links && loc.links.length) {
        const dest = loc.links[rng.randint(0, loc.links.length - 1)];
        if (world.locations[dest]) {
          n.home = dest;
          if (n.demonic) { const dl = world.locations[dest]; dl.unrest = (dl.unrest || 0) + 1; }
        }
      }
    }
  }
  crownGeniuses(rng, pop);
  return fresh;
}
// The demonic menace (if any) lairing where the player now stands — the
// strongest demon whose home is the player's current location. This is what
// closes the society loop into player agency: the world breeds demons, and the
// player can become the hero who ends them.
export function demonAtLoc(c) {
  if (!c.world || c.location == null) return null;
  return ((c.world.npcs) || []).filter(n => n.alive && n.demonic && n.home === c.location)
    .sort((a, b) => (b.power || 0) - (a.power || 0))[0] || null;
}
// Resolve the player's slaying of a demon: strike them from the population, lift
// the land's unrest, and write the deed into the Annals with the player as hero.
export function slayDemon(c, demon, rng) {
  const pop = (c.world && c.world.npcs) || [];
  const idx = pop.indexOf(demon);
  const where = (c.world && c.world.locations && c.world.locations[c.location]);
  demon.alive = false;
  if (idx >= 0) pop[idx] = makeReplacement(rng, demon);
  if (where) where.unrest = Math.max(0, (where.unrest || 0) - 3);
  if (c.world) {
    const chron = c.world.chronicle = c.world.chronicle || [];
    chron.push({ y: c.age, kind: "hero", glyph: "lotus", text: `${c.name} cut down the demon ${demon.title || demon.name}, and ${where ? where.name : "the realm"} breathes again.` });
    if (chron.length > 80) chron.splice(0, chron.length - 80);
  }
}
// The Heaven Board: the realm's foremost living cultivators by raw power, plus
// you. Returns { ranked, rank, total } for the board, and { worldRank, worldTotal }
// for your true standing among every living cultivator of the realm.
export function rankboardStanding(c, size = 14) {
  const pop = ((c.world && c.world.npcs) || []).filter(n => n && n.alive);
  const myPower = power(c);
  const board = pop.slice().sort((a, b) => (b.power || npcPower(b)) - (a.power || npcPower(a))).slice(0, size);
  const me = { name: c.name, you: true, power: myPower, realm: c.realm, title: "you" };
  const ranked = [...board.map(g => ({ name: g.name, power: g.power || npcPower(g), realm: g.realm, title: g.title || "a rising cultivator", age: g.age, ref: g })), me]
    .sort((a, b) => b.power - a.power);
  const stronger = pop.reduce((n, g) => n + ((g.power || npcPower(g)) > myPower ? 1 : 0), 0);
  return { ranked, rank: ranked.findIndex(x => x.you) + 1, total: ranked.length, worldRank: stronger + 1, worldTotal: pop.length + 1 };
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
  // A reborn soul may still grasp one signature treasure from a past life.
  ensureEquipment(old);
  const carried = D.ARTIFACT_BY_KEY[old.equippedArtifact] ? old.equippedArtifact : null;
  if (carried && old.realm >= 4 && rng.random() < 0.4) {
    c.artifacts.push(carried);
    c.equipment[D.artifactSlot(carried)] = carried;
    if (old.refinement && old.refinement[carried]) c.refinement[carried] = old.refinement[carried];
    syncEquippedArtifact(c);
    const art = D.ARTIFACT_BY_KEY[carried];
    note(c, `Across rebirth you still grasp the ${art[1]} (${D.artifactGrade(carried)} grade).`);
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
    // Reaching Foundation can stir a latent ancestral bloodline in the strong of
    // body — arming the Blood-Lineage Awakening arc (likelier the sturdier you are).
    if (c.realm === 3 && armArc(c, "bloodline", rng, 0.18 + c.constitution / 400))
      msgs.push("  Something deep in your marrow answers the breakthrough — an old, sleeping blood, stirring.");
    pushAll(msgs, maybeAwardEpithet(c, rng, { base: 0.3 }));
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
  const ward = daoHeartWard(c);
  const msgs = ["", "👁 A heart demon rises from your karma to devour your dao heart..."];
  if (rng.random() < peril - ward) {
    c.hp = Math.max(1.0, c.hp - c.maxHp * rng.uniform(0.3, 0.6));
    c.stage = Math.max(0, c.stage - 1);
    c.daoHeart = Math.max(0, (c.daoHeart || 0) - rng.randint(2, 5));   // the demon scars your resolve
    msgs.push("   The inner demon savages your mind; you slip a stage, shaken, your dao heart cracked.");
  } else {
    c.daoHeart = clamp((c.daoHeart || 0) + rng.randint(2, 4), 0, 100);  // adversity tempers resolve
    msgs.push("   Your dao heart holds firm and the demon dissolves — your resolve hardens for the trial.");
  }
  return msgs;
}

/* Dao Heart (道心): a cultivator's resolve — the will that holds the soul whole
 * against heart demons, illusion and temptation. It is tempered by stilling the
 * heart in meditation and by surviving the demons it wards against. */
export const DAO_HEART_MAX = 100;
export function daoHeartLabel(v) {
  v = v || 0;
  if (v < 12) return "Unsteady";
  if (v < 28) return "Settling";
  if (v < 45) return "Steady";
  if (v < 64) return "Tempered";
  if (v < 82) return "Unshakable";
  return "Diamond Heart";
}
// Defense a heart demon (and like ordeals) must overcome.
export const daoHeartWard = c =>
  (c.daoHeart || 0) / 170.0 + c.soul / 320.0 + (c.daos || []).length * 0.035 + c.comprehension / 600.0;
// In battle, resolve lets you shrug off mind-afflictions (stun/weaken) — steadied
// by your dao heart and the strength of your spiritual sense (soul).
export const mentalResist = c => clamp((c.daoHeart || 0) / 240.0 + c.soul / 480.0, 0, 0.6);

// Temper the Dao Heart through stillness — diminishing returns as it deepens,
// quicker for the soul-keen and the serene.
export function stillHeart(c, rng) {
  if (!c.alive) return ["You are dead."];
  if (c.daoHeart == null) c.daoHeart = 10;
  const room = DAO_HEART_MAX - c.daoHeart;
  if (room <= 0) return ["Your dao heart is already a flawless diamond — nothing more can be added by stillness alone."];
  const gain = Math.max(1, Math.round((1.6 + c.soul / 50 + c.comprehension / 80) * (0.4 + room / DAO_HEART_MAX) * rng.uniform(0.8, 1.2)));
  c.daoHeart = clamp(c.daoHeart + gain, 0, DAO_HEART_MAX);
  if (typeof c.happiness === "number") c.happiness = clamp(c.happiness + 2, 0, 100);
  const flash = rng.random() < 0.12 + c.comprehension / 1200
    ? "  In the silence the world falls away, and for a heartbeat you simply are." : "";
  const lines = [`You sit in stillness and temper your dao heart. (+${gain} — ${daoHeartLabel(c.daoHeart)})`];
  if (flash) lines.push(flash);
  return lines;
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
    // Fortune turns up spoils; spiritual sense (soul) sniffs out what's hidden.
    if (rng.random() < 0.14 + c.luck / 500.0 + c.soul / 900.0) pushAll(msgs, loot(c, rng));
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
  // Fortune shifts the find toward the richer end of the table — a treasure where
  // a luckless cultivator would turn up only a herb or a pill.
  const roll = rng.random() - (c.luck || 0) / 700.0;
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
      pushAll(msgs, acquireArtifact(c, randomArtifact(c, rng, null, { element: regionElement(c) })));
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
  const roll = rng.random() + c.luck / 450.0;   // fortune meaningfully lifts a treasure's grade
  if (roll > 1.15) base += 2; else if (roll > 0.9) base += 1;
  return D.ARTIFACT_GRADES[Math.min(base, D.ARTIFACT_GRADES.length - 1)];
}
export const regionElement = c => D.REGION_ELEMENT[c.region] || null;
// The distinct elements that treasures actually carry — used to theme drops.
export const TREASURE_ELEMENTS = [...new Set(Object.values(D.ARTIFACT_ELEMENT))];
// Pick a treasure key. `opts` may theme the drop: { element, slot, set }.
// Grade-appropriateness wins over theme — we relax the theme at the target grade
// before ever dropping to a lower grade, so drops still scale with your realm.
export function randomArtifact(c, rng, grade, opts = {}) {
  grade = grade || gradeForRealm(c, rng);
  const { element = null, slot = null, set = null } = opts;
  const gi = D.ARTIFACT_GRADE_RANK[grade], nG = D.ARTIFACT_GRADES.length;
  const ok = (a, el, sl, st) =>
    (!st || D.SET_OF_ARTIFACT[a[0]] === st) &&
    (!sl || a[2] === sl) &&
    (!el || D.artifactElement(a[0]) === el);
  const at = (g, el, sl, st) => D.ARTIFACTS.filter(a => a[3] === D.ARTIFACT_GRADES[g] && ok(a, el, sl, st));
  // 1) Full theme at the target grade, relaxing set then slot (keep element).
  for (const t of [[element, slot, set], [element, slot, null], [element, null, null]]) {
    const pool = at(gi, t[0], t[1], t[2]); if (pool.length) return rng.choice(pool)[0];
  }
  // 2) The requested element matters most — find it at the nearest grade
  //    (search down from target first, so drops stay realm-appropriate, then up).
  if (element) {
    for (let g = gi - 1; g >= 0; g--) { const p = at(g, element, null, null); if (p.length) return rng.choice(p)[0]; }
    for (let g = gi + 1; g < nG; g++) { const p = at(g, element, null, null); if (p.length) return rng.choice(p)[0]; }
  }
  // 3) No themed match anywhere: grade ladder (honouring slot when given).
  for (let g = gi; g >= 0; g--) {
    let pool = slot ? at(g, null, slot, null) : [];
    if (!pool.length) pool = at(g, null, null, null);
    if (pool.length) return rng.choice(pool)[0];
  }
  return D.ARTIFACTS[0][0];
}
// A rough power score for a treasure's effects — used to break ties within a
// grade and to decide whether a new find beats what's already in its slot.
function scoreEffects(e) {
  return (e.atk || 0) * 1.0 + (e.def || 0) * 1.2 + (e.hp || 0) * 0.4 + (e.dodge || 0) * 1.5
    + (e.crit || 0) * 1.5 + (e.life || 0) * 1.0 + (e.qi || 0) * 0.6 + (e.qiMax || 0) * 0.3;
}
export const artifactScore = key => scoreEffects(D.artifactEffects(key));
// Score including a character's refinement on that treasure.
export const effectiveScore = (c, key) => scoreEffects(effectiveEffects(c, key));
function artifactBetter(c, a, b) {
  const ga = D.ARTIFACT_GRADE_RANK[D.artifactGrade(a)], gb = D.ARTIFACT_GRADE_RANK[D.artifactGrade(b)];
  if (ga !== gb) return ga > gb;
  // The item already in the slot keeps any refinement it has earned.
  return artifactScore(a) > effectiveScore(c, b);
}
export function acquireArtifact(c, key, autoEquip = true) {
  const art = D.ARTIFACT_BY_KEY[key]; if (!art) return [];
  ensureEquipment(c);
  c.artifacts.push(key);
  const slot = D.artifactSlot(key), slotInfo = D.EQUIP_SLOT_BY_KEY[slot];
  const msgs = [`  You obtain a treasure: ${art[1]} (${D.artifactGrade(key)} ${slotInfo ? slotInfo[1].toLowerCase() : "treasure"})!`];
  const current = c.equipment[slot];
  if (autoEquip && (!current || artifactBetter(c, key, current))) {
    c.equipment[slot] = key; syncEquippedArtifact(c);
    msgs.push(`  You equip the ${art[1]} in your ${slotInfo ? slotInfo[1] : "treasure"} slot.`);
    note(c, `Equipped the ${art[1]} (${D.artifactGrade(key)} grade).`);
  }
  return msgs;
}
export function equipArtifact(c, key) {
  if (!c.artifacts.includes(key)) return ["You do not possess that treasure."];
  ensureEquipment(c);
  const slot = D.artifactSlot(key), slotInfo = D.EQUIP_SLOT_BY_KEY[slot];
  if (c.equipment[slot] === key) {     // tapping the equipped item unbinds it
    delete c.equipment[slot]; syncEquippedArtifact(c);
    return [`You unbind the ${D.ARTIFACT_BY_KEY[key][1]}.`];
  }
  c.equipment[slot] = key; syncEquippedArtifact(c);
  return [`You equip the ${D.ARTIFACT_BY_KEY[key][1]} (${D.artifactGrade(key)}) in your ${slotInfo ? slotInfo[1] : "treasure"} slot.`];
}
export function unequipArtifact(c, slot) {
  ensureEquipment(c);
  if (!c.equipment[slot]) return [];
  const key = c.equipment[slot]; delete c.equipment[slot]; syncEquippedArtifact(c);
  return [`You unbind the ${D.ARTIFACT_BY_KEY[key][1]}.`];
}
export const isEquipped = (c, key) => equippedKeys(c).includes(key);
// A short, human-readable list of a treasure's effects, e.g. "+30% power, +5% qi".
const EFFECT_LABELS = {
  atk: ["% power", 100], qi: ["% qi", 100], def: ["% defense", 100], hp: ["% battle HP", 100],
  dodge: ["% dodge", 100], crit: ["% crit", 100], life: ["% lifesteal", 100], qiMax: ["% max qi", 100],
};
// Render an effects object as "+30% power, +5% qi".
export function effectsText(e) {
  const parts = [];
  for (const k of ["atk", "def", "hp", "dodge", "crit", "life", "qi", "qiMax"]) {
    if (e[k]) { const [label] = EFFECT_LABELS[k]; parts.push(`+${Math.round(e[k] * 100)}${label}`); }
  }
  return parts.join(", ") || "no bonuses";
}
// Effect text. Pass a character to fold in its refinement of the treasure;
// omit it (e.g. market preview of an unowned item) for base effects.
export function artifactEffectText(key, c = null) {
  return effectsText(c ? effectiveEffects(c, key) : D.artifactEffects(key));
}
// Active-set lines for display, e.g. "Samsara Immortal Dao (2/3): +10% qi, +8% max qi".
export function setBonusLines(c) {
  return activeSets(c).map(({ set, have, tier }) =>
    `${set.name} (${have}/${set.members.length}): ${effectsText(set.bonuses[tier])}`);
}
export function describeArtifact(key) {
  const slot = D.EQUIP_SLOT_BY_KEY[D.artifactSlot(key)];
  return `${D.ARTIFACT_BY_KEY[key][1]} (${D.artifactGrade(key)} ${slot ? slot[1] : ""}) — ${artifactEffectText(key)}`;
}
// One-line loadout summary for the profile, e.g. "3/6 slots · Azure Flying Sword, …".
export function equipmentSummary(c) {
  ensureEquipment(c);
  const keys = D.EQUIP_SLOT_KEYS.map(s => c.equipment[s]).filter(Boolean);
  if (!keys.length) return "(none equipped)";
  return `${keys.length}/${D.EQUIP_SLOT_KEYS.length} slots · ` + keys.map(k => D.ARTIFACT_BY_KEY[k][1]).join(", ");
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
    c.beast = normalizeBeast({ name: beastName(species, rng), species, baseSpecies: species, element: D.beastElement(species), power: beastPow * rng.uniform(0.6, 0.9), bond: 50, rank: 1, exp: 0, fedThisYear: 0, trait: rollBeastTrait(rng), alive: true });
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
  const devoted = beastTraitOf(b) === "devoted" ? 1.5 : 1;   // a devoted beast bonds faster
  if (usePill) {
    if (c.pills <= 0) return ["You have no pills to feed it."];
    c.pills -= 1; b.exp += 28; b.bond = clamp(b.bond + 12 * devoted, 0, 100); b.power *= 1.04; b.fedThisYear += 1;
    return [`You feed ${b.name} a spirit pill. Its eyes blaze; it grows visibly stronger and nuzzles you. (bond ${Math.round(b.bond)}/100)`];
  }
  if (c.herbs < 2) return ["You need at least 2 spirit herbs to feed your beast."];
  c.herbs -= 2; b.exp += 10; b.bond = clamp(b.bond + 5 * devoted, 0, 100); b.power += power(c) * 0.012; b.fedThisYear += 1;
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
  if (key === "comprehension") { const g = scale(rng.randint(1, 3)); c.comprehension = Math.min(160, c.comprehension + g); return [`  The ${name} clears your mind. (+${g} Comprehension)`]; }
  if (key === "charm") { const g = scale(rng.randint(1, 3)); c.charm = Math.min(160, c.charm + g); return [`  The ${name} refines your features. (+${g} Charm)`]; }
  if (key === "fortune") { const g = scale(rng.randint(1, 2)); c.luck = Math.min(160, c.luck + g); return [`  The ${name} stirs the threads of fate. (+${g} Fortune)`]; }
  if (key === "daoheart") { const g = scale(rng.randint(2, 4)); c.daoHeart = clamp((c.daoHeart || 0) + g, 0, DAO_HEART_MAX); return [`  The ${name} stills your heart. (+${g} Dao Heart — ${daoHeartLabel(c.daoHeart)})`]; }
  if (key === "longevity") { const g = Math.round((Math.floor(c.maxAge * rng.uniform(0.05, 0.11)) + 20) * mult); c.longevityBonus = (c.longevityBonus || 0) + g; recomputeMaxAge(c); note(c, `Refined a ${name}, +${g} years of life.`); return [`  ✦ The ${name} adds ${g} years to your lifespan!`]; }
  return ["  Success!"];
}
function applyPill(c, key, rng) { return grantPill(c, key, rng, 1); }

/* ------------------------------ market (坊市) ---------------------------- */
// Prices float with the world era — dear in a Drought, cheap in an Age of Abundance.
export const eraPriceMult = c => D.eraAt(c.era)[7] || 1;
// Prices float with the era AND with where you trade — a remote frontier stall
// charges more than a prosperous heartland city (c.priceMult, set on arrival).
const marketMult = c => (D.eraAt(c.era)[7] || 1) * (c.priceMult || 1);
const TREASURE_BASE = { Mortal: 25, Spirit: 130, Earth: 600, Heaven: 3000, Immortal: 16000 };
export const priceHerbs = (c, n = 5) => Math.max(2, Math.round((c.realm + 1) * 1.6 * n * marketMult(c)));
export const pricePill = (c, key) => Math.round((D.PILL_BY_KEY[key][2] * 8 + 15) * marketMult(c));
export const priceTech = (c, tier) => Math.round([60, 130, 320, 900][tier] * marketMult(c));
export const priceTreasure = (c, key) => Math.round((TREASURE_BASE[D.artifactGrade(key)] || 50) * marketMult(c));
// Selling fetches a fraction of the buy price.
export const sellHerbs = (c, n = 5) => Math.max(1, Math.round(priceHerbs(c, n) * 0.45));
// Selling fetches a fraction of the buy price, sweetened by any refinement work.
export const sellTreasureValue = (c, key) => Math.max(1, Math.round(priceTreasure(c, key) * 0.4 * (1 + refineLevel(c, key) * 0.3)));

export function buyPill(c, key, rng) {
  const p = pricePill(c, key);
  if (c.spiritStones < p) return [`You cannot afford the ${D.PILL_BY_KEY[key][1]} (${p} stones).`];
  c.spiritStones -= p;
  return [`You buy a ${D.PILL_BY_KEY[key][1]} for ${p} stones.`].concat(grantPill(c, key, rng, 1));
}
export const priceTalisman = (c, key) => Math.round((D.TALISMANS[key].price || 30) * marketMult(c));
export const priceMovement = (c, key) => priceTech(c, D.MOVEMENT_BY_KEY[key][3]);

/* --------------------- movement arts & travel speed (轻功) --------------- *
 * A cultivator's footwork ripens with practice: more road-stages per travel
 * deed, until the strong can leap mountains and fold the road. */
export const MOVE_FULL = 600;   // proficiency points for full mastery of an art
export const moveFraction = (c, key) => Math.min(1, ((c.moveMastery && c.moveMastery[key]) || 0) / MOVE_FULL);
export const moveRankName = frac => frac >= 1 ? "Perfected" : frac >= 0.66 ? "Master" : frac >= 0.33 ? "Adept" : frac > 0 ? "Novice" : "Untrained";
// The road-stages you cover per travel deed (a float). Realm-borne flight and a
// tempered body lend innate swiftness; a mastered movement art does the rest.
export function travelSpeed(c) {
  const r = c.realm || 0, b = c.bodyRealm || 0;
  let s = 1;                                                   // a mortal's plod
  s += r >= 8 ? 3 : r >= 6 ? 2 : r >= 5 ? 1.5 : r >= 3 ? 1 : r >= 2 ? 0.5 : 0;   // qi-borne flight
  s += b >= 4 ? 1 : b >= 2 ? 0.5 : 0;                          // a swift, tempered body
  let art = 0;
  for (const k of (c.movementArts || [])) { const m = D.MOVEMENT_BY_KEY[k]; if (m) art = Math.max(art, m[4] * moveFraction(c, k)); }
  return s + art;
}
export const hopsPerDeed = c => Math.max(1, Math.floor(travelSpeed(c)));
// Travel deeds (rounded up) to reach a place, given your speed.
export function travelDeeds(c, toId) { return Math.max(1, Math.ceil(World.travelHops(c, toId) / hopsPerDeed(c))); }
// The art you lean on most — the one giving the greatest effective speed now.
// A trained movement art (轻功) is not only for the road: its light-body skill
// lends real evasion in battle, scaling with the art's tier and your mastery.
export function movementDodge(c) {
  const k = bestMovementArt(c); if (!k) return 0;
  const m = D.MOVEMENT_BY_KEY[k]; if (!m) return 0;
  return clamp((0.02 + m[3] * 0.018) * (0.4 + 0.6 * moveFraction(c, k)), 0, 0.13);
}
export function bestMovementArt(c) {
  let best = null, bs = -1;
  for (const k of (c.movementArts || [])) { const m = D.MOVEMENT_BY_KEY[k]; if (!m) continue; const eff = m[4] * moveFraction(c, k); if (eff > bs) { bs = eff; best = k; } }
  return best;
}
export function buyMovementArt(c, key) {
  const m = D.MOVEMENT_BY_KEY[key]; if (!m) return ["No such art."];
  if ((c.movementArts || []).includes(key)) return [`You already know the ${m[1]}.`];
  const p = priceMovement(c, key);
  if (c.spiritStones < p) return [`You cannot afford the ${m[1]} manual (${p} stones).`];
  c.spiritStones -= p; (c.movementArts = c.movementArts || []).push(key);
  c.moveMastery = c.moveMastery || {};
  c.moveMastery[key] = Math.max(c.moveMastery[key] || 0, Math.round(MOVE_FULL * 0.15));   // a beginner's footing

  note(c, `Learned the ${m[1]} (${m[2]}).`);
  return [`You buy and begin to drill the ${m[1]} (${m[2]}) for ${p} stones. Your footwork quickens. (${m[5]})`];
}
export function trainMovement(c, key, pts) {
  if (!key) return; c.moveMastery = c.moveMastery || {};
  c.moveMastery[key] = Math.min(MOVE_FULL, (c.moveMastery[key] || 0) + Math.max(0, Math.round(pts)));
}
export function buyTalisman(c, key, rng) {
  const t = D.TALISMANS[key]; if (!t) return ["No such talisman."];
  const p = priceTalisman(c, key);
  if (c.spiritStones < p) return [`You cannot afford the ${t.name} (${p} stones).`];
  c.spiritStones -= p; if (!c.talismans) c.talismans = {}; c.talismans[key] = (c.talismans[key] || 0) + 1;
  return [`You buy a ${t.name} for ${p} stones.`];
}
// Inscribe a talisman yourself (a deed): costs herbs; soul & comprehension ease it.
export function inscribeTalisman(c, key, rng) {
  const t = D.TALISMANS[key]; if (!t) return ["No such talisman."];
  if (c.herbs < t.herbs) return [`You need ${t.herbs} spirit herbs to inscribe a ${t.name}; you have ${c.herbs}.`];
  if (!c.talismans) c.talismans = {};
  c.herbs -= t.herbs;
  const chance = clamp(0.45 + c.soul / 200 + c.comprehension / 350 + (c.alchemySkill || 0) * 0.004, 0.1, 0.97);
  if (rng.random() <= chance) {
    const n = 1 + (rng.random() < 0.30 ? 1 : 0);
    c.talismans[key] = (c.talismans[key] || 0) + n;
    return [`Brush dancing in cinnabar and qi, you inscribe ${n} ${t.name}${n > 1 ? "s" : ""}. (${Math.floor(chance * 100)}% success)`];
  }
  return [`The spirit-script smears and the paper blackens — the inscription fails. (${Math.floor(chance * 100)}% success)`];
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
  if (isEquipped(c, key)) return ["Unbind it before selling — you won't part with an equipped treasure."];
  const v = sellTreasureValue(c, key);
  c.artifacts.splice(c.artifacts.indexOf(key), 1);
  if (c.refinement) delete c.refinement[key];
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
// Deepening a Dao you already hold costs more the deeper it already runs.
export const daoDeepenThreshold = (c, k) => 90.0 * (1 + daoTierOf(c, k) * 1.15) * (1 + c.daos.length * 0.18);
export const canComprehend = c => c.realm >= DAO_MIN_REALM && (c.daos || []).length < D.DAOS.length;
export const canDeepen = (c, k) => c.realm >= DAO_MIN_REALM && (c.daos || []).includes(k) && daoTierOf(c, k) < D.DAO_MAX_TIER;
// You may meditate while any new Dao remains, or any held Dao is short of 圆满.
export const canMeditate = c => c.realm >= DAO_MIN_REALM && (canComprehend(c) || (c.daos || []).some(k => daoTierOf(c, k) < D.DAO_MAX_TIER));

// Backfill / repair the tiered-Dao fields on older saves and reincarnated souls.
export function ensureDaos(c) {
  if (!Array.isArray(c.daos)) c.daos = [];
  if (!c.daoLevels || typeof c.daoLevels !== "object") c.daoLevels = {};
  for (const k of c.daos) if (!(c.daoLevels[k] >= 1)) c.daoLevels[k] = 1;
  for (const k of Object.keys(c.daoLevels)) if (!c.daos.includes(k)) delete c.daoLevels[k];
  if (c.daoFocus && !c.daos.includes(c.daoFocus)) c.daoFocus = null;
  return c.daoLevels;
}

// What this year's meditation works toward: deepen a chosen/held Dao, or seek a
// new one. An explicit c.daoFocus wins; otherwise seek new, falling back to
// deepening the shallowest law once every Dao is known.
export function meditationTarget(c) {
  if (c.daoFocus && canDeepen(c, c.daoFocus)) return { mode: "deepen", key: c.daoFocus };
  if (canComprehend(c)) return { mode: "new" };
  const deepenable = (c.daos || []).filter(k => daoTierOf(c, k) < D.DAO_MAX_TIER)
    .sort((a, b) => daoTierOf(c, a) - daoTierOf(c, b));
  return deepenable.length ? { mode: "deepen", key: deepenable[0] } : null;
}
const meditationThreshold = (c, t) => t.mode === "deepen" ? daoDeepenThreshold(c, t.key) : daoInsightThreshold(c);

export function meditate(c, rng, years = 1) {
  if (!c.alive) return ["You are dead."];
  if (c.realm < DAO_MIN_REALM) return [`Your soul is too unrefined to perceive the Daos. (requires ${D.REALMS[DAO_MIN_REALM][0]})`];
  ensureDaos(c);
  if (!meditationTarget(c)) return ["You have mastered every Dao under heaven to consummation — there is nothing left to seek."];
  const msgs = [];
  for (let i = 0; i < years; i++) {
    if (!c.alive) break;
    const target = meditationTarget(c);
    if (!target) break;
    let gain = (c.comprehension + c.soul) / 18.0 * rng.uniform(0.7, 1.3) * (1 + c.luck / 300.0) * (1 + (D.physEffect(c).dao || 0));
    if (c.daos.includes("karma")) gain *= 1.15;
    if (rng.random() < c.comprehension / 2500.0) { gain *= rng.uniform(2.0, 4.0); msgs.push("✦ The veil thins -- a flash of profound enlightenment!"); }
    c.daoInsight += gain; c.age += 1;
    if (c.daoInsight >= meditationThreshold(c, target))
      pushAll(msgs, target.mode === "deepen" ? deepenDao(c, target.key) : comprehendNewDao(c, rng));
    if (c.age > c.maxAge) { c.alive = false; c.causeOfDeath = "old age deep in Dao meditation"; msgs.push(`☠ Your lifespan ends at ${c.age}, mid-revelation.`); break; }
  }
  if (msgs.length === 0) {
    const t = meditationTarget(c);
    const what = t && t.mode === "deepen" ? `deepening the ${D.DAO_BY_KEY[t.key][1]}` : "seeking a new Dao";
    msgs.push(`You meditate on the Dao — ${what}. (insight ${Math.floor(c.daoInsight)}/${Math.floor(meditationThreshold(c, t))})`);
  }
  return msgs;
}
function comprehendNewDao(c, rng) {
  c.daoInsight = 0.0;
  const unknown = D.DAOS.filter(d => !c.daos.includes(d[0]));
  if (unknown.length === 0) return [];
  const weights = unknown.map(d => { let w = 1.0; if (d[0] === "slaughter" && c.karma < -30) w = 3.0; if (d[0] === "karma" && c.karma > 60) w = 2.5; return w; });
  const dao = rng.choices(unknown, weights);
  c.daos.push(dao[0]); c.daoLevels[dao[0]] = 1; note(c, `Comprehended the ${dao[1]}.`);
  return ["", `☯ You comprehend the ${dao[1]}! (${D.daoTierLabel(1)})`, `  ${dao[4]}`, ""];
}
function deepenDao(c, key) {
  c.daoInsight = 0.0;
  const lvl = Math.min(D.DAO_MAX_TIER, daoTierOf(c, key) + 1);
  c.daoLevels[key] = lvl;
  const dao = D.DAO_BY_KEY[key], label = D.daoTierLabel(lvl);
  note(c, `Deepened the ${dao[1]} to ${label}.`);
  const lines = ["", `☯ Your ${dao[1]} deepens to ${label}!`];
  if (lvl === 3 && D.DAO_MANIFEST[key]) lines.push(`  ✦ The law now manifests in battle — ${D.DAO_MANIFEST[key]}`);
  if (lvl >= D.DAO_MAX_TIER) lines.push("  Consummation — your grasp of this law wants for nothing.");
  lines.push("");
  return lines;
}

/* Battle manifestations of a deeply-comprehended Dao (Great Mastery, tier 3+).
 * Returns one aggregate of small modifiers combat reads when a fight opens, so
 * all Dao→combat scaling lives here. s = 1 at 大成, 2 at 圆满. */
export function daoBattleMods(c) {
  ensureDaos(c);
  const m = { crit: 0, dodge: 0, hp: 0, lifesteal: 0, pierce: 0, shield: 0, regen: 0, enemyWeaken: 0, enemyCritDown: 0, enemyBleed: 0 };
  for (const k of (c.daos || [])) {
    const lvl = daoTierOf(c, k);
    if (lvl < 3) continue;                  // manifests only from Great Mastery up
    const s = lvl - 2;                       // 1 at 大成, 2 at 圆满
    switch (k) {
      case "sword":     m.crit += 0.06 * s; break;
      case "flame":     m.crit += 0.04 * s; break;
      case "thunder":   m.crit += 0.03 * s; m.pierce += 0.06 * s; break;
      case "space":     m.dodge += 0.06 * s; break;
      case "dream":     m.dodge += 0.05 * s; break;
      case "time":      m.dodge += 0.04 * s; break;
      case "vitality":  m.hp += 0.10 * s; m.regen = Math.max(m.regen, 0.03 * s); break;
      case "void":      m.pierce += 0.10 * s; break;
      case "devour":    m.lifesteal += 0.08 * s; break;
      case "karma":     m.shield += 0.08 * s; break;
      case "slaughter": m.enemyWeaken += 0.10 * s; m.enemyCritDown += 0.05 * s; m.enemyBleed = Math.max(m.enemyBleed, 0.03 * s); break;
    }
  }
  return m;
}

/* ---------------------- action-triggered story arcs ---------------------- *
 * Some multi-year arcs (events.js) don't start at random but are "armed" by a
 * fitting deed — a demonic wound, diligent study, a rare find — at a given
 * chance (1 = certain). The armed opener then fires, gated by age/realm, on the
 * next age-up (arc beats are drawn with priority). State is a plain list on the
 * character, so action code anywhere can arm an arc without importing events. */
export function armArc(c, id, rng, chance = 1) {
  if (!c.arcTriggers) c.arcTriggers = [];
  if (c.arcTriggers.includes(id)) return false;        // already armed
  if (c.arcs && c.arcs[id]) return false;              // already underway or done
  if ((rng ? rng.random() : Math.random()) < chance) { c.arcTriggers.push(id); return true; }
  return false;
}
export const arcArmed = (c, id) => (c.arcTriggers || []).includes(id);
export function disarmArc(c, id) { if (c.arcTriggers) c.arcTriggers = c.arcTriggers.filter(x => x !== id); }

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
    c.sectKey = sectKey; c.sectRank = 0; c.contribution = 0; c.sectMissions = 0; c.sectJoinedAge = c.age; c.reputation += sect[8];
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
  const n = sectName(c); note(c, `Left the ${n}.`); c.sectKey = null; c.sectRank = 0; c.contribution = 0; c.sectMissions = 0; c.sectJoinedAge = null;
  return [`You sever ties with the ${n} and walk the lonely road of a rogue cultivator once more.`];
}
export function nextRankReq(c) {
  const nxt = c.sectRank + 1;
  if (!c.sectKey || nxt >= D.SECT_RANKS.length) return null;
  const [name, minRealm, minContrib, , , minMissions, minRep] = D.SECT_RANKS[nxt];
  return [name, minRealm, minContrib, minMissions || 0, minRep || 0];
}
// Every requirement still standing between you and your next rank (empty = ready).
export function promotionBlockers(c) {
  const r = nextRankReq(c); if (!r) return null;
  const [name, minRealm, minContrib, minMissions, minRep] = r;
  const out = [];
  if (c.realm < minRealm) out.push(`reach ${D.REALMS[minRealm][0]} (you are ${realmName(c)})`);
  if (c.contribution < minContrib) out.push(`${minContrib} contribution (have ${c.contribution})`);
  if ((c.sectMissions || 0) < minMissions) out.push(`${minMissions} sect missions run (done ${c.sectMissions || 0})`);
  if (minRep && c.reputation < minRep) out.push(`${minRep} fame (have ${c.reputation})`);
  return out;
}
export const canPromote = c => { const b = promotionBlockers(c); return !!b && b.length === 0; };
// Promotion into Core Disciple and above is earned in a trial-by-combat against
// a rank-guardian. Returns the foe spec, or null if this rank needs no trial.
export function promotionTrialFoe(c, rng) {
  const nxt = c.sectRank + 1;
  const factor = D.SECT_TRIAL_FACTOR[nxt] || 0;
  if (factor <= 0) return null;
  const nm = ["the Gate Warden", "an Enforcement Elder", "the Hall Guardian", "a Grand Elder's Shadow", "the Sect Protector"][Math.min(4, nxt - 1)];
  return [nm, power(c) * (0.6 + factor * 0.45) * rng.uniform(0.92, 1.06), (c.realm + 1) * 6, "rogue"];
}
// Apply a successful promotion (after any trial is passed).
export function completePromotion(c) {
  const r = nextRankReq(c); if (!r) return ["You already sit at the very summit of your sect."];
  c.contribution -= r[2]; c.sectRank += 1; c.reputation += 4 + c.sectRank * 3;
  note(c, `Promoted to ${r[0]}.`);
  return [`☯ The sect elevates you to ${r[0]}!`, "  Your standing rises and the sect's arrays and stipends open wider to you."];
}
// Legacy direct promotion (used where no interactive trial is run): checks reqs,
// then for trial ranks resolves the duel automatically by power.
export function attemptPromotion(c, rng) {
  if (!c.sectKey) return ["You belong to no sect."];
  const r = nextRankReq(c); if (!r) return ["You already sit at the very summit of your sect."];
  const b = promotionBlockers(c);
  if (b.length) return [`Promotion to ${r[0]} still needs: ${b.join("; ")}.`];
  const foe = promotionTrialFoe(c, rng);
  if (foe) {
    const chance = clamp(power(c) / (power(c) + foe[1]), 0.12, 0.95);
    const msgs = [`The elders set a promotion trial: best ${foe[0]} to earn ${r[0]}. [${Math.floor(chance * 100)}% chance]`];
    if (rng.random() > chance) { c.hp = Math.max(1, c.hp - c.maxHp * 0.18); msgs.push(`✗ ${foe[0]} bests you before the watching hall. The rank is not yet yours — grow stronger and try again.`); return msgs; }
    msgs.push(`✦ You overcome ${foe[0]} in the trial ring.`);
    pushAll(msgs, completePromotion(c));
    return msgs;
  }
  return completePromotion(c);
}
export const availableQuests = c => c.sectKey ? D.SECT_QUESTS.filter(q => q[1] <= c.sectRank) : [];
export function doQuest(c, rng, quest) {
  const [name, , contribution, stones, danger, blurb, reward] = quest;
  if (!c.sectKey) return ["You belong to no sect."];
  c.age += 1;
  const msgs = [`Quest accepted: ${name}.`, `  ${blurb}`];
  if (rng.random() < danger) { msgs.push("  Trouble finds you on the way!"); pushAll(msgs, fight(c, rng)); if (!c.alive) return msgs; }
  const bonus = 1.0 + (rng.random() < c.luck / 250.0 ? 0.5 : 0.0);
  const ec = Math.floor(contribution * bonus), es = Math.floor(stones * bonus);
  c.contribution += ec; c.spiritStones += es; c.reputation += 1; c.sectMissions = (c.sectMissions || 0) + 1;
  msgs.push(`  Quest complete! (+${ec} contribution, +${es} spirit stones, +1 reputation)`);
  // A flavourful extra reward, by mission kind.
  if (reward === "herbs") { const h = rng.randint(3, 8) + c.realm; c.herbs += h; msgs.push(`  You bring back ${h} spirit herbs besides. (+herbs)`); }
  else if (reward === "pill") { const p = rng.randint(1, 3); c.pills += p; msgs.push(`  The elders share ${p} pill(s) from the furnace. (+pills)`); }
  else if (reward === "rep") { const rp = rng.randint(3, 7); c.reputation += rp; msgs.push(`  Your name travels; the sect gains face through you. (+${rp} fame)`); }
  else if (reward === "treasure") { pushAll(msgs, acquireArtifact(c, randomArtifact(c, rng, rng.random() < 0.3 ? "Earth" : null, { element: regionElement(c) }))); }
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

/* ----------------------- sect hierarchy & wars -------------------------- */
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// The stable notable figures of a named world sect — its Sect Master and Elders —
// so a sect's leadership reads the same each time you look upon its hierarchy.
export function sectFigures(sectKey, c) {
  const sect = D.SECT_BY_KEY[sectKey]; if (!sect) return null;
  // Prefer the living members of the actual world population.
  const pop = c && c.world && Array.isArray(c.world.npcs) ? c.world.npcs : null;
  if (pop) {
    const members = pop.filter(n => n.alive && n.sectKey === sectKey)
      .sort((a, b) => (b.sectRank || 0) - (a.sectRank || 0) || (b.power || 0) - (a.power || 0));
    if (members.length) {
      const master = members[0];
      const elders = members.filter(n => n !== master && (n.sectRank || 0) >= 3).slice(0, 3)
        .map(e => ({ name: e.name, realm: e.realm, title: (e.sectRank || 0) >= 4 ? "Grand Elder" : "Elder" }));
      return { master: { name: master.name, realm: master.realm, title: "Sect Master" }, elders };
    }
  }
  const rng = new RNG(hashStr("figures:" + sectKey));
  const baseRealm = Math.min(D.REALMS.length - 1, 5 + (sect[4] || 1));
  const master = { name: npcName(rng), realm: baseRealm, title: "Sect Master" };
  const elders = [];
  const n = 2 + (sect[4] >= 3 ? 1 : 0);
  for (let i = 0; i < n; i++) elders.push({ name: npcName(rng), realm: Math.max(3, baseRealm - rng.randint(1, 3)), title: i === 0 ? "Grand Elder" : "Elder" });
  return { master, elders };
}
/* The realm's great sects are not static: their might drifts year by year, and a
 * sect you shatter rebuilds over a decade or so — so the war map keeps shifting. */
const sectBaseMight = s => (s[4] || 1) * 60 + 100;
export function ensureSectWorld(c) {
  if (!c.sectWorld) c.sectWorld = {};
  const w = c.sectWorld;
  for (const s of D.SECTS) if (!w[s[0]]) w[s[0]] = { strength: sectBaseMight(s), broken: 0 };
  for (const s of D.SECTS) { const st = w[s[0]]; if (!st.rel) st.rel = {}; if (!st.warYears) st.warYears = {}; }
  // Seed the standing relations once: the orthodox sects stand together, and the
  // Blood Demon Cult stands against all of them — the realm's oldest fault line.
  if (!w._seeded) {
    const align = k => (D.SECT_BY_KEY[k] || [])[2], keys = D.SECTS.map(s => s[0]);
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j], aa = align(a), ab = align(b);
      let rel = null;
      if (aa === "righteous" && ab === "righteous") rel = "ally";
      else if ((aa === "demonic") !== (ab === "demonic")) rel = "rival";
      if (rel) { w[a].rel[b] = rel; w[b].rel[a] = rel; }
    }
    w._seeded = true;
  }
  return w;
}
export const sectRelOf = (c, a, b) => { const w = c.sectWorld; return (w && w[a] && w[a].rel && w[a].rel[b]) || "neutral"; };
// The sect wars currently raging in the realm, as unique {a, b} pairs.
export function sectWarsActive(c) {
  const w = c.sectWorld; if (!w) return [];
  const keys = D.SECTS.map(s => s[0]), out = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    if (sectRelOf(c, keys[i], keys[j]) === "war") out.push({ a: keys[i], b: keys[j] });
  return out;
}
// A sect's standing, from its current might against its founding base.
export function sectStanding(c, key) {
  const w = ensureSectWorld(c), st = w[key], s = D.SECT_BY_KEY[key];
  if (!st || !s) return { label: "—", ratio: 1 };
  if (st.broken > 0) return { label: "In Ruins", cn: "残破", ratio: 0, broken: st.broken };
  const ratio = st.strength / sectBaseMight(s);
  const L = ratio >= 1.8 ? ["Ascendant", "鼎盛"] : ratio >= 1.3 ? ["Flourishing", "兴盛"] : ratio >= 0.85 ? ["Steady", "平稳"] : ratio >= 0.5 ? ["Waning", "衰微"] : ["Faltering", "凋零"];
  return { label: L[0], cn: L[1], ratio };
}
// One year for the world's sects: the broken slowly rebuild, the rest rise and
// fall on their own fortunes. Called from the yearly tick when you lead a sect.
export function tickSectWorld(c, rng) {
  const w = ensureSectWorld(c);
  for (const s of D.SECTS) {
    const st = w[s[0]], base = sectBaseMight(s);
    if (st.broken > 0) { st.broken -= 1; if (st.broken <= 0) st.strength = base * 0.7; }   // risen from the ashes
    // Floor sits below the shatter threshold so a losing war can grind a sect to ruin.
    else st.strength = clamp(st.strength * rng.uniform(0.95, 1.06), base * 0.22, base * 2.6);
  }
}
// The realm's sects are living institutions: their might drifts, alliances form
// and fracture, rivalries boil into multi-year WARS, and the loser is shattered
// and scattered for a decade. Driven every year by the society sim, independent
// of whether the player leads a sect. `record` writes the turns into the Annals.
export function tickSectPolitics(c, rng, record) {
  const w = ensureSectWorld(c);
  tickSectWorld(c, rng);                                   // strengths drift; the broken rebuild
  const keys = D.SECTS.map(s => s[0]).filter(k => w[k]);
  const short = k => sectShort(k) || k;
  const align = k => (D.SECT_BY_KEY[k] || [])[2];
  const relSet = (a, b, kind) => { w[a].rel[b] = kind; w[b].rel[a] = kind; };
  // 1) Diplomacy drifts: alliances and rivalries form, and rivalries can boil over.
  if (keys.length >= 2 && rng.random() < 0.55) {
    const a = rng.choice(keys); let b = rng.choice(keys), g = 0;
    while (b === a && g++ < 5) b = rng.choice(keys);
    if (a !== b && !w[a].broken && !w[b].broken) {
      const cur = sectRelOf(c, a, b), same = align(a) === align(b), opposed = (align(a) === "demonic") !== (align(b) === "demonic");
      if (cur === "neutral") {
        if (same && rng.random() < 0.5) { relSet(a, b, "ally"); record("sect", `The ${short(a)} and the ${short(b)} have sworn an alliance.`, "sect"); }
        else if (rng.random() < (opposed ? 0.8 : 0.22)) { relSet(a, b, "rival"); record("sect", `Bad blood rises between the ${short(a)} and the ${short(b)} — now open rivals.`, "sect"); }
      } else if (cur === "rival" && rng.random() < (opposed ? 0.45 : 0.18)) {
        relSet(a, b, "war"); w[a].warYears[b] = 0; w[b].warYears[a] = 0;
        record("sectwar", `⚔ War erupts between the ${short(a)} and the ${short(b)}!`, "blade");
      } else if (cur === "rival" && !opposed && rng.random() < 0.16) {
        relSet(a, b, "neutral"); record("sect", `The ${short(a)} and the ${short(b)} have set aside their old rivalry.`, "scroll");
      } else if (cur === "ally" && rng.random() < 0.12) {
        relSet(a, b, "rival"); record("sect", `The alliance of the ${short(a)} and the ${short(b)} has fractured into rivalry.`, "mask");
      }
    }
  }
  // 2) Resolve each raging war: the stronger grinds the weaker down, until one is
  //    routed and shattered, or exhaustion brings a wary truce.
  for (const { a, b } of sectWarsActive(c)) {
    const sa = w[a], sb = w[b];
    sa.warYears[b] = (sa.warYears[b] || 0) + 1; sb.warYears[a] = sa.warYears[b];
    const strong = sa.strength >= sb.strength ? a : b, weak = strong === a ? b : a;
    w[weak].strength *= rng.uniform(0.86, 0.95);
    w[strong].strength = Math.min(sectBaseMight(D.SECT_BY_KEY[strong]) * 2.6, w[strong].strength * rng.uniform(1.0, 1.04));
    if (w[weak].strength < sectBaseMight(D.SECT_BY_KEY[weak]) * 0.32) {        // routed and shattered
      w[weak].broken = rng.randint(8, 15); w[weak].strength = sectBaseMight(D.SECT_BY_KEY[weak]) * 0.25;
      w[strong].strength *= 1.12;
      relSet(a, b, "rival");
      record("sectwar", `The ${short(strong)} has shattered the ${short(weak)}, scattering its disciples to the winds.`, "blade");
    } else if (sa.warYears[b] >= rng.randint(4, 9)) {                          // exhaustion → truce
      relSet(a, b, "rival");
      record("sect", `A weary truce ends the long war between the ${short(a)} and the ${short(b)}.`, "scroll");
    }
  }
}

/* ---------------- the player's stake in the living sect wars -------------- *
 * Your sect is not a bystander to all this: when the banner you serve goes to
 * war, you can ride to the front; and the sect you found can be marched upon by
 * a hostile rival, a raid you must answer or pay for.                          */

// The sects your JOINED sect is at war with right now (its foes are your foes).
export function playerSectWarFoes(c) {
  if (!c.sectKey) return [];
  return sectWarsActive(c).filter(wp => wp.a === c.sectKey || wp.b === c.sectKey)
    .map(wp => (wp.a === c.sectKey ? wp.b : wp.a));
}
// Spoils for answering your sect's call to arms and felling an enemy champion:
// contribution and fame for you, and your valour tips the war your sect's way.
export function callToArmsSpoils(c, foeKey, rng) {
  const w = ensureSectWorld(c), mine = c.sectKey;
  const contrib = 8 + (c.realm || 0) * 2 + rng.randint(0, 6);
  c.contribution = (c.contribution || 0) + contrib;
  const fame = gainFame(c, 5 + (c.realm || 0));
  if (mine && w[mine]) w[mine].strength = Math.min(sectBaseMight(D.SECT_BY_KEY[mine]) * 2.6, w[mine].strength * rng.uniform(1.04, 1.09));
  if (w[foeKey]) w[foeKey].strength *= rng.uniform(0.9, 0.96);
  note(c, `Won glory at the front for the ${sectShort(mine)}.`);
  return [`✦ Your blade turns the skirmish — the ${sectShort(mine)} presses its advantage on the front. (+${contrib} contribution, +${fame} fame)`];
}
export function callToArmsLoss(c) {
  c.reputation = Math.max(-200, (c.reputation || 0) - 2);
  return [`You are thrown back from the front, bloodied; the ${sectShort(c.sectKey)} gives ground. (−Reputation)`];
}

// A hostile rival may march on your FOUNDED sect. Sets a standing threat the
// player must answer, and returns the raider's sect key (or null).
export function maybeRaidOwnSect(c, rng) {
  const own = c.ownSect; if (!own || own.threat) return null;
  const rivals = sectWarRivals(c).filter(r => !r.broken && (r.hostile || r.chance < 0.5));
  if (!rivals.length) return null;
  const r = rng.choice(rivals);
  if (rng.random() > 0.14 + (1 - r.chance) * 0.22) return null;      // the weaker you stand, the likelier the raid
  own.threat = { key: r.key, since: c.age };
  return r.key;
}
// Resolve a raid on your founded sect. won → repel it (prestige & fame, and a
// chance to shatter the raider); lost → they sack your halls. Clears the threat.
export function resolveOwnSectRaid(c, rng, won) {
  const own = c.ownSect; if (!own || !own.threat) return [];
  const key = own.threat.key, target = D.SECT_BY_KEY[key], short = key && sectShort(key), w = ensureSectWorld(c);
  own.threat = null;
  if (won) {
    const pres = rng.randint(20, 45), fame = gainFame(c, 8);
    own.prestige += pres; c.karma += 1;
    let extra = "";
    if (w[key] && rng.random() < 0.4) { w[key].broken = rng.randint(6, 12); w[key].strength = sectBaseMight(target) * 0.28; extra = ` The ${short} are routed and scattered!`; }
    note(c, `Repelled a raid by the ${target ? target[1] : "raiders"}.`);
    return [`✦ You and your disciples throw back the assault on your sect!${extra} (+${pres} prestige, +${fame} fame)`];
  }
  const pres = rng.randint(15, 35), mem = rng.randint(2, 7);
  own.prestige = Math.max(0, own.prestige - pres); own.members = Math.max(0, own.members - mem);
  c.reputation = Math.max(-200, (c.reputation || 0) - 3);
  note(c, `The ${target ? target[1] : "raiders"} sacked your sect.`);
  return [`✗ The ${short || "raiders"} storm your sect's outer halls before you can muster. (−${pres} prestige, ${mem} disciples slain)`];
}
// A raid left unanswered too long is pressed home by the rival — to your cost.
export function lapseOwnSectThreat(c, rng) {
  const own = c.ownSect; if (!own || !own.threat) return null;
  if (c.age - own.threat.since < 2) return null;
  return resolveOwnSectRaid(c, rng, false);
}
// The named sects your own founded sect may come to blows with, each with the
// odds your banner would prevail against theirs — and whether they lie broken.
export function sectWarRivals(c) {
  const own = c.ownSect; if (!own) return [];
  const w = ensureSectWorld(c), eraD = (D.eraAt(c.era)[5]) || 1;
  return D.SECTS.map(s => {
    const st = w[s[0]], theirs = st.strength * eraD;
    const mine = (own.prestige || 0) + (own.members || 0) * 3 + power(c) / 40;
    const chance = clamp(mine / (mine + theirs), 0.06, 0.94);
    return { key: s[0], sect: s, strength: Math.round(theirs), chance, broken: st.broken > 0, brokenYears: st.broken, hostile: (own.alignment === "demonic") !== (s[2] === "demonic") };
  });
}
// March your sect to war against a rival sect (a deed). Win and you break them
// for years, absorbing disciples, prestige, fame and spoils; lose and you bleed.
export function wageSectWar(c, rng, key) {
  const own = c.ownSect; if (!own) return ["You lead no sect to send to war."];
  const target = D.SECT_BY_KEY[key]; if (!target) return ["No such sect."];
  const w = ensureSectWorld(c), st = w[key];
  const r = sectWarRivals(c).find(x => x.key === key);
  const chance = r ? r.chance : 0.4;
  const broken = st.broken > 0;   // a sect already in ruins yields little more
  const msgs = [`Your banner advances on the ${target[1]}${broken ? ", what remains of it" : ""}. The two sects clash upon the slopes! [${Math.floor(chance * 100)}% chance]`];
  if (rng.random() <= chance) {
    const mult = broken ? 0.3 : 1;
    const presGain = Math.round((rng.randint(25, 60) + (target[4] || 1) * 12) * mult);
    const memGain = Math.round(rng.randint(3, 10) * mult), spoils = Math.round(rng.randint(40, 120) * mult);
    own.prestige += presGain; own.members += memGain; c.spiritStones += spoils; c.reputation += broken ? 1 : 6;
    if (!broken) { st.broken = rng.randint(8, 15); st.strength = Math.max(sectBaseMight(target) * 0.25, st.strength * 0.3); }
    own.conquered = own.conquered || []; if (!own.conquered.includes(key)) own.conquered.push(key);
    c.karma += target[2] === "demonic" ? 2 : -2;
    msgs.push(`✦ Victory! The ${target[1]} is ${broken ? "scattered anew" : "broken; its survivors bow to your banner"}. (+${presGain} prestige, +${memGain} disciples, +${spoils} stones${broken ? "" : ", +6 fame"})`);
    if (!broken && rng.random() < 0.3) pushAll(msgs, acquireArtifact(c, randomArtifact(c, rng, rng.random() < 0.4 ? "Earth" : null, { element: target[2] === "demonic" ? "Dark" : regionElement(c) })));
    note(c, `Warred down the ${target[1]}.`);
  } else {
    const presLoss = rng.randint(15, 40), memLoss = rng.randint(2, 8);
    own.prestige = Math.max(0, own.prestige - presLoss); own.members = Math.max(0, own.members - memLoss);
    st.strength = clamp(st.strength * rng.uniform(1.05, 1.18), 0, sectBaseMight(target) * 3);   // a repelled foe grows bolder
    c.reputation -= 3; c.hp = Math.max(1, c.hp - c.maxHp * 0.25);
    msgs.push(`✗ The ${target[1]} throws back your assault with heavy losses. (−${presLoss} prestige, ${memLoss} disciples slain, and you are wounded)`);
    note(c, `Lost a war against the ${target[1]}.`);
  }
  return msgs;
}

/* ----------------------- sect arts (传功) ------------------------------- */
export const sectArts = c => (c.sectKey && D.SECT_ARTS[c.sectKey]) || [];
// Learn one of your sect's arts: gated by your rank, paid in contribution.
export function learnSectArt(c, techKey) {
  if (!c.sectKey) return ["You belong to no sect."];
  const entry = (D.SECT_ARTS[c.sectKey] || []).find(a => a[0] === techKey);
  if (!entry) return ["Your sect does not teach that art."];
  const [key, minRank, cost] = entry;
  if (c.techniques.includes(key)) return [`You have already mastered the ${D.TECHNIQUES[key][0]}.`];
  if (c.sectRank < minRank) return [`The ${D.TECHNIQUES[key][0]} is taught only to ${D.SECT_RANKS[minRank][0]} and above.`];
  if (c.contribution < cost) return [`The ${D.TECHNIQUES[key][0]} costs ${cost} contribution; you have ${c.contribution}.`];
  c.contribution -= cost; c.techniques.push(key);
  note(c, `Learned the sect art ${D.TECHNIQUES[key][0]}.`);
  return [`☯ The sect imparts its art — you learn the ${D.TECHNIQUES[key][0]}! (${D.TECHNIQUES[key][4]})`];
}

/* --------------------- forging your own arts (创功) --------------------- *
 * The pinnacle of dao mastery: weave an original technique from your own
 * element and insight. Demanding in attributes and materials, and never sure. */
const round2 = v => Math.round(v * 100) / 100;
const forgeMag = c => clamp((c.comprehension + c.soul) / 200 + (c.realm || 0) * 0.04 + (c.daoInsight || 0) * 0.02, 0.5, 1.6);
export const forgeTechCap = c => Math.min(6, Math.floor((c.comprehension || 0) / 40) + Math.floor((c.realm || 0) / 2));
export const FORGE_STYLES = {
  strike:  { label: "Strike",  desc: "a clean elemental blow" },
  torrent: { label: "Torrent", desc: "a flurry of three quick strikes" },
  ruin:    { label: "Ruin",    desc: "one devastating, draining blow" },
  ward:    { label: "Ward",    desc: "a defensive art — shield & regeneration" },
  mend:    { label: "Mend",    desc: "a healing art that cleanses wounds" },
};
export function canForgeTech(c) {
  if (!c.awakened) return [false, "Your dao is not yet awakened."];
  if ((c.realm || 0) < 3) return [false, "Reach Foundation Establishment before you dare forge an original art."];
  if ((c.comprehension || 0) < 80) return [false, "Forging an art demands rare insight — at least 80 Comprehension."];
  if ((c.soul || 0) < 70) return [false, "Your spiritual sense is too dim to model a new art — at least 70 Soul Sense."];
  if ((c.customTechs || []).length >= forgeTechCap(c)) return [false, `Your mind can hold no more than ${forgeTechCap(c)} self-forged arts — deepen your Comprehension and realm.`];
  return [true, null];
}
// A deterministic spec for the art your nature + choices would yield: its combat
// skill, passive bonuses, material cost, and odds of success.
export function forgeTechSpec(c, element, style, name) {
  const mag = forgeMag(c);
  const elem = element && element !== "none" ? element : null;
  const nm = (name && name.trim()) || "Nameless Art";
  let skill, tier, qi;
  if (style === "ruin") { skill = { dmg: round2(0.85 + mag * 0.28), pierce: 0.4, element: elem, self: { type: "weaken", turns: 1, value: 0.3 } }; qi = Math.round(28 + mag * 8); tier = 3; }
  else if (style === "torrent") { skill = { dmg: round2(0.20 + mag * 0.07), hits: 3, element: elem }; qi = Math.round(20 + mag * 5); tier = 2; }
  else if (style === "ward") { skill = { type: "defend", shield: round2(0.15 + mag * 0.06), self: { type: "regen", turns: 3, value: round2(0.03 + mag * 0.02) }, qiRestore: 0.1 }; qi = Math.round(12 + mag * 3); tier = 2; }
  else if (style === "mend") { skill = { type: "heal", heal: round2(0.18 + mag * 0.09), cleanse: true, qiRestore: 0.08 }; qi = Math.round(16 + mag * 5); tier = 2; }
  else { skill = { dmg: round2(0.42 + mag * 0.2), element: elem }; qi = Math.round(14 + mag * 6); tier = mag > 1.1 ? 3 : 2; }
  const key = "custom_" + Math.floor(Math.random() * 1e9).toString(36) + (c.customTechs || []).length;
  skill.id = key; skill.tech = key; skill.name = nm; skill.qi = qi;
  skill.desc = `Your own forged art${elem ? ` of ${elem}` : ""} — ${FORGE_STYLES[style] ? FORGE_STYLES[style].desc : "a clean blow"}.`;
  const qiBonus = round2(0.04 + mag * 0.10), atkPct = Math.round(4 + mag * 9);
  const stones = Math.round(140 + tier * 180 + mag * 220), herbs = Math.round(15 + tier * 12);
  const attuned = elem && c.root && c.root.elements && c.root.elements.includes(elem);
  const chance = clamp(0.32 + c.comprehension / 300 + c.soul / 400 + (c.daoInsight || 0) * 0.04 + (attuned ? 0.1 : 0), 0.2, 0.95);
  return { key, name: nm, element: elem, tier, qiBonus, atkPct, blurb: skill.desc, skill, stones, herbs, chance };
}
export function forgeTech(c, rng, element, style, name) {
  const [ok, reason] = canForgeTech(c); if (!ok) return [reason];
  const spec = forgeTechSpec(c, element, style, name);
  if (c.spiritStones < spec.stones) return [`You lack the spirit stones to model the qi-formation: need ${spec.stones} (have ${c.spiritStones}).`];
  if (c.herbs < spec.herbs) return [`You lack the spirit herbs to brew the medium: need ${spec.herbs} (have ${c.herbs}).`];
  c.spiritStones -= spec.stones; c.herbs -= spec.herbs;
  const msgs = [`You seal yourself away to forge the ${spec.name}${spec.element ? ` of ${spec.element}` : ""}, weaving qi into a wholly new shape... [${Math.floor(spec.chance * 100)}%]`];
  if (rng.random() <= spec.chance) {
    c.customTechs = c.customTechs || [];
    c.customTechs.push({ key: spec.key, name: spec.name, element: spec.element, tier: spec.tier, qiBonus: spec.qiBonus, atkPct: spec.atkPct, blurb: spec.blurb, skill: spec.skill });
    note(c, `Forged an original art: ${spec.name}.`);
    msgs.push(`☯ Eureka — the formation holds! You forge the ${spec.name}, an art wholly your own, now yours to wield and to teach. (${spec.skill.desc})`);
  } else {
    const back = Math.round(spec.stones * 0.4); c.spiritStones += back;
    c.comprehension = Math.min(160, c.comprehension + 1);
    msgs.push(`✗ The qi-formation collapses before it sets. You salvage ${back} stones from the wreckage — and the failure sharpens your understanding. (+Comprehension)`);
  }
  return msgs;
}
// Look up any technique (standard or self-forged) by key.
export function techTier(c, key) { return D.TECHNIQUES[key] ? D.TECHNIQUES[key][1] : ((c.customTechs || []).find(ct => ct.key === key) || { tier: 1 }).tier; }
export function techName(c, key) { return D.TECHNIQUES[key] ? D.TECHNIQUES[key][0] : ((c.customTechs || []).find(ct => ct.key === key) || { name: "a lost art" }).name; }

/* ------------------ your sect's library (藏经阁) ----------------------- *
 * A founder enshrines arts they have mastered; each enriches the sect's
 * teachings, lifting its prestige and its standing in the world's wars. */
export function assignableSectTechs(c) {
  if (!c.ownSect) return [];
  const lib = (c.ownSect.library || []).map(e => e.key);
  const out = [];
  for (const t of c.techniques) if (D.TECHNIQUES[t] && t !== "basic_breathing" && !lib.includes(t)) out.push({ key: t, name: D.TECHNIQUES[t][0], tier: D.TECHNIQUES[t][1] });
  for (const ct of (c.customTechs || [])) if (!lib.includes(ct.key)) out.push({ key: ct.key, name: ct.name, tier: ct.tier, custom: true });
  return out;
}
export function assignSectTech(c, key) {
  if (!c.ownSect) return ["You lead no sect."];
  c.ownSect.library = c.ownSect.library || [];
  if (c.ownSect.library.some(e => e.key === key)) return ["That art already stands in the sect library."];
  const known = c.techniques.includes(key) || (c.customTechs || []).some(ct => ct.key === key);
  if (!known) return ["You can only enshrine arts you yourself have mastered."];
  const tier = techTier(c, key), nm = techName(c, key);
  c.ownSect.library.push({ key, name: nm, tier });
  const boost = tier * 6;
  c.ownSect.prestige += boost;
  note(c, `Enshrined ${nm} in the ${c.ownSect.name}'s library.`);
  return [`You enshrine the ${nm} in your sect's library; its disciples will train in it for generations. (+${boost} prestige)`];
}
export const sectLibrary = c => (c.ownSect && c.ownSect.library) || [];
export const sectLibraryBonus = s => (s && s.library) ? s.library.reduce((a, e) => a + (e.tier || 1), 0) : 0;
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
  ensureNpcProfile(npc, rng);   // the master teaches only from their own repertoire
  adjust(npc, rng.randint(2, 6));
  const msgs = [`You attend on your master, ${npc.name} (${npcStatus(npc)}).`];
  const teachable = (npc.techniques || []).filter(k => k !== "basic_breathing" && !c.techniques.includes(k));
  if (npc.affinity > 40 && rng.random() < 0.5) { const g = rng.randint(2, 7); c.comprehension = Math.min(160, c.comprehension + g); msgs.push(`  Their pointers sharpen your insight. (+${g} comprehension)`); }
  else if (teachable.length && rng.random() < 0.35) { const t = rng.choice(teachable); c.techniques.push(t); msgs.push(`  Master imparts one of their own arts: ${D.TECHNIQUES[t][0]}!`); }
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

/* --------------------- world monikers (名号 / epithets) ------------------- *
 * Xianxia cultivators are known by names the world hangs on them — earned from
 * their dao, their deeds, their fame and their very nature. A soul collects
 * these across a life; the grandest becomes how the world speaks of them.
 * Each entry: { id, tier (1 lesser .. 5 legendary), when(c), text(c) }. The
 * tier both gates a name behind fame and decides which one the world favours. */
const epIsDemonic = c => (c.karma || 0) <= -45;
const epIsSaintly = c => (c.karma || 0) >= 60;
const epHasDao = (c, k) => (c.daos || []).includes(k);
const epHasElem = (c, e) => !!(c.root && c.root.elements && c.root.elements.includes(e));
const epFem = c => c.sex === "female";

export const EPITHETS = [
  // — dao of the sword / metal edge —
  { id: "sword_imm",   tier: 4, when: c => epHasDao(c, "sword") && !epIsDemonic(c), text: () => "Sword Immortal" },
  { id: "sword_fiend", tier: 4, when: c => epHasDao(c, "sword") && epIsDemonic(c), text: () => "Sword Fiend" },
  { id: "lone_blade",  tier: 2, when: c => epHasDao(c, "sword") || epHasElem(c, "Metal"), text: () => "Lone Blade" },
  { id: "gold_edict",  tier: 3, when: c => epHasElem(c, "Metal"), text: () => "Golden Edict" },
  // — elemental roots —
  { id: "flame_lord",  tier: 3, when: c => epHasDao(c, "flame") || epHasElem(c, "Fire"), text: c => epIsDemonic(c) ? "Calamity Flame" : "Vermilion Flame Lord" },
  { id: "tide_sov",    tier: 3, when: c => epHasElem(c, "Water"), text: () => "Tide Sovereign" },
  { id: "frostsoul",   tier: 3, when: c => epHasElem(c, "Ice"), text: () => "Frostsoul" },
  { id: "verdant",     tier: 3, when: c => epHasElem(c, "Wood"), text: () => "Verdant Sage" },
  { id: "mountain",    tier: 3, when: c => epHasElem(c, "Earth"), text: () => "Mountain-Root Sovereign" },
  { id: "thunderscourge", tier: 4, when: c => epHasDao(c, "thunder") || epHasElem(c, "Lightning") || epHasElem(c, "Thunder"), text: () => "Thunderscourge" },
  // — other daos —
  { id: "void_walker", tier: 4, when: c => epHasDao(c, "void") || epHasDao(c, "space"), text: () => "Voidwalker" },
  { id: "hourkeeper",  tier: 5, when: c => epHasDao(c, "time"), text: () => "Keeper of Hours" },
  { id: "dreamweaver", tier: 4, when: c => epHasDao(c, "dream"), text: () => "Dreamweaver" },
  { id: "karma_arbiter", tier: 4, when: c => epHasDao(c, "karma"), text: () => "Karma Arbiter" },
  { id: "evergreen",   tier: 4, when: c => epHasDao(c, "vitality"), text: () => "Evergreen Sage" },
  { id: "all_devourer", tier: 4, when: c => epHasDao(c, "devour"), text: () => "All-Devourer" },
  { id: "blood_asura", tier: 4, when: c => epHasDao(c, "slaughter"), text: () => "Blood Asura" },
  // — body cultivation —
  { id: "iron_bone",   tier: 2, when: c => (c.bodyRealm || 0) >= 3, text: () => "Iron-Bone" },
  { id: "vajra",       tier: 4, when: c => (c.bodyRealm || 0) >= 5, text: () => "Indestructible Vajra" },
  { id: "war_god",     tier: 5, when: c => (c.bodyRealm || 0) >= 6, text: () => "War-God Incarnate" },
  // — crafts & companions —
  { id: "pill_adept",  tier: 2, when: c => (c.alchemySkill || 0) >= 30, text: () => "Cauldron Adept" },
  { id: "pill_sage",   tier: 4, when: c => (c.alchemySkill || 0) >= 80, text: () => "Pill Sage" },
  { id: "beastmaster", tier: 3, when: c => !!(c.beast && c.beast.alive), text: () => "Beast Sovereign" },
  // — innate gifts —
  { id: "child_fortune", tier: 3, when: c => (c.luck || 0) >= 95, text: () => "Child of Fortune" },
  { id: "dao_born",    tier: 4, when: c => (c.comprehension || 0) >= 110, text: () => "Dao-Born Genius" },
  { id: "peerless_beauty", tier: 3, when: c => (c.charm || 0) >= 100, text: c => epFem(c) ? "Nation-Toppling Beauty" : "Jade-Faced Idol" },
  // — nature / karma —
  { id: "living_buddha", tier: 4, when: c => epIsSaintly(c), text: () => "Living Buddha" },
  { id: "merciful",    tier: 2, when: c => (c.karma || 0) >= 35, text: () => "Merciful Sword" },
  { id: "devil_sov",   tier: 4, when: c => epIsDemonic(c) && (c.reputation || 0) <= -40, text: () => "Devil Sovereign" },
  { id: "bloodhand",   tier: 3, when: c => epIsDemonic(c), text: () => "Blood-Handed" },
  // — fame —
  { id: "rising_star", tier: 2, when: c => (c.reputation || 0) >= 40, text: () => "Rising Star" },
  { id: "grand_sov",   tier: 4, when: c => (c.reputation || 0) >= 90, text: () => "Grand Sovereign" },
  { id: "living_legend", tier: 5, when: c => (c.reputation || 0) >= 180, text: () => "Living Legend" },
  { id: "infamous",    tier: 2, when: c => (c.reputation || 0) <= -40, text: () => "Infamous One" },
  // — realm grandeur & legend —
  { id: "old_monster", tier: 4, when: c => c.realm >= 6 && c.age >= 200, text: () => "Old Monster" },
  { id: "peerless_uh", tier: 5, when: c => c.realm >= 8, text: () => "Peerless Under Heaven" },
  { id: "soul_of_ages", tier: 3, when: c => (c.reincarnationCount || 0) >= 1, text: () => "Soul of Ages" },
  { id: "founder",     tier: 3, when: c => !!c.ownSect, text: c => epFem(c) ? "Founding Matriarch" : "Founding Patriarch" },
];

function epWhen(e, c) { try { return !!e.when(c); } catch { return false; } }

// Every moniker this soul qualifies for but has not yet been given.
export function eligibleEpithets(c) {
  const have = new Set((c.epithets || []).map(e => e.id));
  return EPITHETS.filter(e => !have.has(e.id) && epWhen(e, c));
}

// How the world speaks of you now: the grandest name you hold (latest on ties).
export function activeEpithet(c) {
  const es = c.epithets || [];
  if (!es.length) return null;
  return es.reduce((best, e) => (e.tier >= best.tier ? e : best), es[0]);
}

// Roll to be given a new moniker. `opts.base` sets the trigger's base chance
// (a deed earns one more readily than a quiet year); `opts.mult` scales it.
// Fame both raises the odds and unlocks ever grander names. Returns log lines.
export function maybeAwardEpithet(c, rng, opts = {}) {
  if (!c.alive || !c.awakened) return [];
  c.epithets = c.epithets || [];
  const pool = eligibleEpithets(c);
  if (!pool.length) return [];
  const fame = Math.max(0, c.reputation || 0);
  let chance = (opts.base != null ? opts.base : 0.05) + Math.min(0.15, fame / 700);
  chance *= (opts.mult != null ? opts.mult : 1);
  if (rng.random() > Math.min(0.85, chance)) return [];
  const maxTier = fame >= 180 ? 5 : fame >= 90 ? 4 : fame >= 40 ? 3 : 2;
  let choices = pool.filter(e => e.tier <= maxTier);
  if (!choices.length) choices = pool.filter(e => e.tier <= 2);
  if (!choices.length) return [];
  // The world reaches for the grandest name you have earned, for drama.
  const top = Math.max(...choices.map(e => e.tier));
  const band = choices.filter(e => e.tier >= top - 1);
  const e = band[Math.floor(rng.random() * band.length)];
  const text = e.text(c);
  c.epithets.push({ id: e.id, text, tier: e.tier });
  note(c, `Became known across the world as 「${text}」.`);
  return [`✦ A new name spreads through the cultivation world — they have taken to calling you 「${text}」.`];
}

/* The reckoning: settle a lifelong rivalry. Called after winning a nemesis duel.
 * The fallen rival yields their signature treasure (themed to their element),
 * a slayer's title, renown — and the long grudge is finally laid to rest. */
export function defeatNemesis(c, nem, rng) {
  if (!nem) return [];
  nem.alive = false; nem.role = "nemesis";
  const lines = [`✦ ${nem.name} falls at last. The grudge of a lifetime — ${nem.grudge || "an old slight"} — is settled in blood and silence.`];
  c.reputation += 12;
  const title = `Nemesis Slain: ${nem.name}`;
  if (!c.titles.includes(title)) { c.titles.push(title); c.log.push([c.age, `Slew their sworn nemesis, ${nem.name}.`]); }
  // The fallen rival's own treasure, themed to the element they fought with.
  pushAll(lines, acquireArtifact(c, randomArtifact(c, rng, rng.random() < 0.45 ? "Heaven" : null, { element: nem.element || null })));
  c.spiritStones += (c.realm + 2) * rng.randint(12, 24);
  pushAll(lines, maybeAwardEpithet(c, rng, { base: 0.45 }));
  lines.push("  The weight you have carried for so long lifts. The road ahead is your own.");
  return lines;
}

/* ---------------------------- sparring reward ---------------------------- *
 * A friendly bout is real training: trading blows against a live opponent
 * deepens the art you lean on, polishes your dao, and now and then leaves a
 * lasting gain. A win teaches more than a loss — but a loss still teaches.
 * `opts.scale` weights the stakes (an arena bout matters more than a yard spar). */
export function sparReward(c, rng, outcome, opts = {}) {
  if (!c.alive) return [];
  const scale = opts.scale != null ? opts.scale : 1;
  const win = outcome === "win";
  const msgs = [];
  c.mastery = c.mastery || {};
  // Deepen the technique you rely on most (else your most advanced one).
  const techs = (c.techniques || []).filter(t => D.TECHNIQUES[t]);
  if (techs.length) {
    const tech = techs.reduce((best, t) => ((c.mastery[t] || 0) >= (c.mastery[best] || 0) ? t : best), techs[techs.length - 1]);
    const gain = Math.max(1, Math.round((win ? rng.randint(4, 8) : rng.randint(1, 3)) * scale));
    const before = D.masteryRank(c.mastery[tech] || 0)[0];
    c.mastery[tech] = (c.mastery[tech] || 0) + gain;
    const name = D.TECHNIQUES[tech][0];
    const rank = D.masteryRank(c.mastery[tech]);
    msgs.push(`  Crossing blows hones ${name}. (+${gain} mastery)`);
    if (rank[0] !== before) msgs.push(`  ✦ ${name} advances to ${rank[0]} (+${Math.round(rank[2] * 100)}% effect)!`);
  }
  // A hard exchange clarifies the dao: a little qi toward your next stage.
  if (c.awakened && c.root && c.root.key !== "none") {
    const frac = (win ? rng.uniform(0.06, 0.12) : rng.uniform(0.02, 0.05)) * scale;
    c.qi += qiToNext(c) * frac;
    msgs.push("  Reading a real opponent sharpens your insight; your qi deepens.");
  }
  // Sometimes the lesson sticks for good.
  if (rng.random() < (win ? 0.3 : 0.15) * scale) {
    if (win && rng.random() < 0.5 && c.constitution < 160) {
      c.constitution = Math.min(160, c.constitution + 1); recomputeMaxHp(c);
      msgs.push("  Trading hits tempers your body. (+1 Constitution)");
    } else if (c.comprehension < 160) {
      c.comprehension = Math.min(160, c.comprehension + 1);
      msgs.push(win ? "  Out-reading your foe sharpens your martial sense. (+1 Comprehension)"
                    : "  Even beaten, you learn the shape of your mistakes. (+1 Comprehension)");
    }
  }
  return msgs;
}
