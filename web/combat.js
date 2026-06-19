/* The Nine Heavens -- interactive turn-based combat (the battle minigame).
 *
 * Your learned techniques become usable skills; your spiritual-root element,
 * bound treasure, tamed beast, and stats (power, constitution, soul, luck) all
 * shape the fight. A battle is a small state machine the UI drives turn by turn.
 */
import * as E from "./engine.js";
import * as D from "./data.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Wu Xing overcoming (相克) cycle: key element beats value element. */
const OVERCOMES = { Metal: "Wood", Wood: "Earth", Earth: "Water", Water: "Fire", Fire: "Metal" };
// Wu Xing matchup for an element: what it overcomes (strong vs) and what overcomes it (weak vs).
export function elementMatchup(el) {
  if (!el) return null;
  const strong = OVERCOMES[el] || null;
  const weak = Object.keys(OVERCOMES).find(k => OVERCOMES[k] === el) || null;
  return { strong, weak, exotic: !OVERCOMES[el] && !weak };
}
export function elementMult(att, def) {
  if (!att || !def || att === def) return 1;
  if (att === "Chaos" || att === "Void") return 1.2;       // primordial beats all
  if (["Ice", "Lightning", "Thunder", "Dark", "Light", "Wind"].includes(att)) return 1.1;
  if (OVERCOMES[att] === def) return 1.3;                   // 克: strong
  if (OVERCOMES[def] === att) return 0.8;                   // countered: weak
  return 1;
}
const ELEMENT_ICON = { Metal: "⚔️", Wood: "🌿", Water: "💧", Fire: "🔥", Earth: "⛰️", Ice: "❄️", Lightning: "⚡", Thunder: "⚡", Dark: "🌑", Light: "✨", Wind: "🌪️", Void: "🕳️", Chaos: "☯️" };
export const elementIcon = e => ELEMENT_ICON[e] || "✊";
// A high-rank beast's elemental bite: [statusType, turns, value].
const BEAST_BITE = { Fire: ["burn", 3, 0.05], Ice: ["stun", 1, 0], Wood: ["bleed", 3, 0.05], Lightning: ["weaken", 2, 0.2], Dark: ["bleed", 3, 0.06], Metal: ["weaken", 2, 0.18], Water: ["weaken", 2, 0.18], Wind: ["weaken", 1, 0.15] };

/* --------------------------- skill definitions --------------------------- */
// dmg values are a FRACTION of the attacker's power (so they scale at any realm).
export const SKILLS = {
  strike:  { id: "strike", name: "Qi Strike", qi: 0, dmg: 0.34, basic: true, desc: "A clean strike. Free." },
  guard:   { id: "guard", name: "Qi Guard", qi: 0, type: "defend", shield: 0.22, qiRestore: 0.30, desc: "Raise a qi shield and recover qi." },
  azure_cloud: { id: "azure_palm", tech: "azure_cloud", name: "Azure Cloud Palm", qi: 14, dmg: 0.44, element: "Wood", desc: "A flowing palm of azure qi." },
  five_beasts: { id: "beast_rush", tech: "five_beasts", name: "Five Beasts Rush", qi: 16, dmg: 0.46, self: { type: "empower", turns: 2, value: 0.20 }, desc: "Charge in beast-form; +20% damage for 2 turns." },
  blood_refine: { id: "blood_spike", tech: "blood_refine", name: "Blood Spike", qi: 18, dmg: 0.44, element: "Dark", lifesteal: 0.5, karma: -1, desc: "Drain life with a demonic spike. Heals you; stains your karma." },
  nine_yang: { id: "yang_burst", tech: "nine_yang", name: "Nine-Yang Burst", qi: 20, dmg: 0.44, element: "Fire", target: { type: "burn", turns: 3, value: 0.05 }, desc: "Searing fire that burns over 3 turns." },
  moon_mirror: { id: "moon_calm", tech: "moon_mirror", name: "Moon-Mirror Calm", qi: 18, type: "heal", heal: 0.22, cleanse: true, qiRestore: 0.1, desc: "Soothe wounds and cleanse afflictions in moonlight." },
  great_void: { id: "void_rend", tech: "great_void", name: "Great Void Rend", qi: 30, dmg: 0.62, pierce: 0.5, desc: "Tear space itself; ignores half the foe's defense." },
  sword_rain: { id: "sword_rain", tech: "sword_rain", name: "Myriad Sword Rain", qi: 24, dmg: 0.22, hits: 3, element: "Metal", desc: "Three flying-sword strikes; each can crit and exploit elements." },
  mirror_parry: { id: "mirror_parry", tech: "mirror_parry", name: "Mirror-Light Parry", qi: 12, type: "defend", shield: 0.16, counter: 0.6, qiRestore: 0.15, desc: "Shield up and reflect 60% of the next blow back at the foe." },
  spirit_bind: { id: "spirit_bind", tech: "spirit_bind", name: "Spirit-Binding Seal", qi: 18, dmg: 0.30, element: "Light", target: { type: "weaken", turns: 2, value: 0.30 }, target2: { type: "stun", turns: 1, value: 0, chance: 0.35 }, desc: "Shackle the foe: heavy weaken, with a chance to stun." },
  frost_lotus: { id: "frost_lotus", tech: "frost_lotus", name: "Frost Lotus Palm", qi: 19, dmg: 0.46, element: "Ice", target: { type: "stun", turns: 1, value: 0, chance: 0.40 }, desc: "A blossom of killing frost; may freeze the foe solid for a turn." },
  thunder_step: { id: "thunder_step", tech: "thunder_step", name: "Nine-Heaven Thunder Step", qi: 22, dmg: 0.27, hits: 2, element: "Lightning", self: { type: "empower", turns: 2, value: 0.15 }, desc: "Blink and strike twice; the speed lingers (+15% damage, 2 turns)." },
  vajra_body: { id: "vajra_body", tech: "vajra_body", name: "Vajra Indestructible Body", qi: 16, type: "defend", shield: 0.20, self: { type: "regen", turns: 3, value: 0.06 }, desc: "Golden flesh: a strong qi shield and steady regeneration for 3 turns." },
  tide_palm: { id: "tide_palm", tech: "tide_palm", name: "Tide-Calling Palm", qi: 18, dmg: 0.42, element: "Water", target: { type: "weaken", turns: 2, value: 0.22 }, desc: "A drowning surge of Water that batters the foe and saps their strength." },
  mountain_seal: { id: "mountain_seal", tech: "mountain_seal", name: "Mountain-Bearing Seal", qi: 22, dmg: 0.60, element: "Earth", target: { type: "stun", turns: 1, value: 0, chance: 0.35 }, desc: "Drop a mountain's weight on the foe — heavy Earth damage that may pin them." },
  heaven_slash: { id: "heaven_slash", tech: "heaven_slash", name: "Heaven-Splitting Slash", qi: 32, dmg: 0.95, pierce: 0.4, element: "Metal", self: { type: "weaken", turns: 1, value: 0.30 }, desc: "A colossal cut — but it leaves you spent (weakened) next turn." },
  samsara_palm: { id: "samsara_palm", tech: "samsara_palm", name: "Samsara Heaven-Turning Palm", qi: 30, dmg: 0.72, element: "Void", lifesteal: 0.35, desc: "Turn the wheel of life and death: heavy void damage that mends you." },
  // — sect-exclusive signature arts —
  cloudmist_veil: { id: "mist_veil", tech: "cloudmist_veil", name: "Cloud-Mist Veil", qi: 16, type: "defend", shield: 0.18, self: { type: "regen", turns: 3, value: 0.05 }, qiRestore: 0.12, desc: "Vanish into mist: a shield, steady regeneration, and restored qi." },
  fiveelem_cycle: { id: "elem_cycle", tech: "fiveelem_cycle", name: "Five Elements Rotation", qi: 24, dmg: 0.30, hits: 2, pierce: 0.3, desc: "Strike twice through the cycle of the five phases, piercing defences." },
  spiritbeast_primal: { id: "primal_descent", tech: "spiritbeast_primal", name: "Primal Beast Descent", qi: 26, dmg: 0.58, self: { type: "empower", turns: 3, value: 0.20 }, desc: "Beast-fury made flesh: heavy damage and +20% damage for 3 turns." },
  azure_formation: { id: "azure_array", tech: "azure_formation", name: "Azure Sword Formation", qi: 30, dmg: 0.34, hits: 3, element: "Metal", desc: "A formation of azure flying swords: three elemental strikes." },
  heavensword_myriad: { id: "myriad_return", tech: "heavensword_myriad", name: "Ten-Thousand Swords Return", qi: 38, dmg: 1.05, pierce: 0.5, element: "Metal", desc: "Every blade under heaven descends at once — a realm-shaking cut." },
  bloodcult_sea: { id: "blood_sea", tech: "bloodcult_sea", name: "Boundless Blood Sea", qi: 30, dmg: 0.66, element: "Dark", lifesteal: 0.6, karma: -2, desc: "A tide of blood that drowns the foe and heals you deeply. It stains the soul." },
};
const SKILL_BY_TECH = {};
for (const k in SKILLS) if (SKILLS[k].tech) SKILL_BY_TECH[SKILLS[k].tech] = SKILLS[k];

export function playerSkills(c) {
  const list = [SKILLS.strike, SKILLS.guard];
  for (const t of c.techniques) if (SKILL_BY_TECH[t]) list.push(SKILL_BY_TECH[t]);
  for (const ct of (c.customTechs || [])) if (ct.skill) list.push(ct.skill);   // your own forged arts
  return list;
}

// A bonded companion or disciple who lives with you fights at your side (not in
// a solo Heavenly Tribulation). Returns {name, affinity} or null.
function bondedAlly(c, enemyDef) {
  if (enemyDef && enemyDef.tribulation) return null;
  const cand = (c.relationships || [])
    .filter(n => n.alive && n.resides && (n.role === "companion" || n.role === "disciple") && (n.affinity || 0) >= 20)
    .sort((a, b) => (b.affinity || 0) - (a.affinity || 0));
  if (!cand.length) return null;
  const a = cand[0];
  return { name: a.name, affinity: a.affinity || 50, role: a.role };
}

/* --------------------------- enemy generation ---------------------------- */
const BEAST_FOES = ["Iron-Fang Wolf", "Rock-Shell Tortoise", "Cloud Leopard", "Venom Serpent", "Crimson Ape", "Ghost-Faced Spider", "Flame-Mane Lion", "Thunder Roc", "Frost Python", "Nine-Tailed Fox", "Abyssal Drake", "Stone-Hide Rhino", "Tide-Maned Hippocamp", "Gale Talon Eagle"];
const ROGUE_FOES = ["Masked Rogue", "Demonic Outrider", "Bandit Qi-user", "Rival Disciple", "Fallen Puppet", "Corpse Refiner", "Poison-Hand Assassin", "Renegade Sword-Cultivator"];
const BEAST_ELEM = { "Flame-Mane Lion": "Fire", "Frost Python": "Ice", "Thunder Roc": "Lightning", "Venom Serpent": "Wood", "Rock-Shell Tortoise": "Earth", "Cloud Leopard": "Wind", "Iron-Fang Wolf": "Metal", "Abyssal Drake": "Water", "Stone-Hide Rhino": "Earth", "Tide-Maned Hippocamp": "Water", "Gale Talon Eagle": "Wind" };

/* Enemy move kits: a basic attack plus weighted signature moves. Move shape
 * matches resolveSkill (dmg is a fraction of the enemy's power). */
const KITS = {
  beast: { basic: { name: "Claw", dmg: 0.43 }, moves: [
    { w: 5, m: { name: "Pounce", dmg: 0.70 } },
    { w: 3, m: { name: "Feral Roar", type: "buff", self: { type: "empower", turns: 2, value: 0.25 } } },
    { w: 2, m: { name: "Rending Bite", dmg: 0.50, target: { type: "bleed", turns: 3, value: 0.05 } } },
  ] },
  rogue: { basic: { name: "Slash", dmg: 0.43 }, moves: [
    { w: 5, m: { name: "Heavy Strike", dmg: 0.68 } },
    { w: 3, m: { name: "Crippling Cut", dmg: 0.45, target: { type: "weaken", turns: 2, value: 0.2 } } },
    { w: 2, m: { name: "Smoke & Step", type: "defend", shield: 0.20 } },
  ] },
};
// Signature moves keyed by foe name, mixed into that foe's kit.
const NAMED = {
  "Corpse Refiner": { w: 4, m: { name: "Corpse Miasma", dmg: 0.42, element: "Dark", target: { type: "bleed", turns: 3, value: 0.06 } } },
  "Demonic Outrider": { w: 4, m: { name: "Blood Drain", dmg: 0.55, element: "Dark", lifesteal: 0.6 } },
  "Fallen Puppet": { w: 3, m: { name: "Iron Carapace", type: "defend", shield: 0.30 } },
  "Flame-Mane Lion": { w: 4, m: { name: "Inferno Maw", dmg: 0.55, element: "Fire", target: { type: "burn", turns: 3, value: 0.06 } } },
  "Frost Python": { w: 4, m: { name: "Frost Coil", dmg: 0.50, element: "Ice", target: { type: "stun", turns: 1, value: 0, chance: 0.5 } } },
  "Thunder Roc": { w: 4, m: { name: "Thunderclap", dmg: 0.62, element: "Lightning" } },
  "Venom Serpent": { w: 4, m: { name: "Venom Fang", dmg: 0.44, element: "Wood", target: { type: "bleed", turns: 4, value: 0.05 } } },
  "Abyssal Drake": { w: 4, m: { name: "Drowning Surge", dmg: 0.56, element: "Water", target: { type: "weaken", turns: 2, value: 0.22 } } },
  "Stone-Hide Rhino": { w: 4, m: { name: "Avalanche Charge", dmg: 0.66, element: "Earth", target: { type: "stun", turns: 1, value: 0, chance: 0.35 } } },
  "Tide-Maned Hippocamp": { w: 3, m: { name: "Tidal Crash", dmg: 0.52, element: "Water" } },
  "Gale Talon Eagle": { w: 4, m: { name: "Cyclone Dive", dmg: 0.58, element: "Wind" } },
  "Poison-Hand Assassin": { w: 4, m: { name: "Creeping Toxin", dmg: 0.40, element: "Wood", target: { type: "bleed", turns: 4, value: 0.06 } } },
  "Renegade Sword-Cultivator": { w: 4, m: { name: "Sword Storm", dmg: 0.30, hits: 2, element: "Metal" } },
};
function buildKit(kind, name) {
  const base = KITS[kind] || KITS.rogue;
  const kit = { basic: base.basic, moves: base.moves.slice() };
  if (NAMED[name]) kit.moves = kit.moves.concat([NAMED[name]]);
  return kit;
}

export function makeEnemy(c, rng, opts = {}) {
  const kind = opts.kind || (rng.random() < 0.6 ? "beast" : "rogue");
  const name = opts.name || rng.choice(kind === "beast" ? BEAST_FOES : ROGUE_FOES);
  let factor = opts.factor != null ? opts.factor : rng.choices([0.5, 0.8, 1.0, 1.3, 1.7], [26, 34, 23, 12, 5]);
  factor *= (opts.factorMult || 1);    // region danger scaling
  const power = opts.power != null ? opts.power : Math.max(5, E.basePower(c) * factor * rng.uniform(0.85, 1.15));
  const element = opts.element !== undefined ? opts.element : (BEAST_ELEM[name] || (rng.random() < 0.5 ? rng.choice(D.ELEMENTS) : null));
  const reward = opts.reward != null ? opts.reward : Math.floor((c.realm + 1) * Math.max(0.5, power / Math.max(1, E.basePower(c))) * rng.randint(3, 9));
  return { name, kind, power, element, reward, kit: buildKit(kind, name), boss: !!opts.boss, tribulation: !!opts.tribulation, hpMult: opts.hpMult };
}

// Build a fighting kit from an NPC's own learned techniques, so a cultivator you
// duel fights with their actual arts (not a generic rogue's).
function npcKit(npc) {
  const moves = [];
  for (const t of (npc.techniques || [])) {
    const s = SKILL_BY_TECH[t]; if (!s || !s.dmg) continue;
    moves.push({ w: 3, m: { name: s.name, dmg: s.dmg * 0.9, element: s.element, target: s.target, hits: s.hits, lifesteal: s.lifesteal, pierce: s.pierce } });
  }
  return moves.length ? { basic: { name: "Qi Strike", dmg: 0.42 }, moves } : buildKit("rogue", "");
}
// An enemy built from a named NPC: their realm-derived power, root element and arts.
export function makeEnemyFromNpc(c, npc, rng, opts = {}) {
  E.ensureNpcProfile(npc, rng);
  const boss = !!opts.boss;
  return {
    name: npc.name, kind: "rogue", power: npc.power || E.npcPower(npc),
    element: npc.element != null ? npc.element : null,
    reward: opts.reward != null ? opts.reward : (c.realm + 1) * 6,
    kit: npcKit(npc), boss, hpMult: boss ? 2.8 : (opts.hpMult || 2.3),
    realm: npc.realm,
  };
}

const BOSS_NAMES = ["Blood-Robe Patriarch", "Iron Vajra Monk", "Sword Fiend of the Abyss", "Heartless Fox Empress", "Crippled-Hand Elder", "Ghost-King of the Wastes", "Thousand-Bone Demon Lord", "Azure-Scaled War Sovereign", "Frost-Veiled Witch Queen", "Heaven-Devouring Old Ancestor"];
const ULTIMATES = { Fire: "Inferno Apocalypse", Water: "Drowning World", Metal: "Ten-Thousand Sword Tomb", Wood: "World-Devouring Forest", Earth: "Mountain-Crush Seal", Dark: "Soul-Rending Abyss", Lightning: "Heaven's Wrath", Ice: "Absolute Zero Domain" };
export function makeBoss(c, rng, opts = {}) {
  const name = opts.name || rng.choice(BOSS_NAMES);
  const power = (opts.power != null ? opts.power
    : E.basePower(c) * (opts.factor || rng.uniform(1.2, 1.6)) * rng.uniform(0.95, 1.08)) * (opts.factorMult || 1);
  const element = opts.element || rng.choice([...D.ELEMENTS, "Dark", "Lightning"]);
  const e = makeEnemy(c, rng, { kind: "rogue", name, power, element, boss: true, hpMult: 2.8,
    reward: Math.floor((c.realm + 2) * rng.randint(20, 40)) });
  // A boss draws on a richer, deadlier kit.
  e.kit = { basic: { name: "Strike", dmg: 0.46 }, moves: [
    { w: 5, m: { name: "Crushing Blow", dmg: 0.72 } },
    { w: 3, m: { name: "Domain Pressure", dmg: 0.5, element, target: { type: "weaken", turns: 2, value: 0.25 } } },
    { w: 3, m: { name: "Soul Lash", dmg: 0.55, element: "Dark", target: { type: "stun", turns: 1, value: 0, chance: 0.4 } } },
    { w: 2, m: { name: "Blood Recovery", type: "heal", heal: 0.14 } },
  ] };
  e.ultName = opts.ultName || ULTIMATES[element] || "Annihilation Strike";
  e.ultElement = element;
  return e;
}

export function makeTribulation(c, rng) {
  // A survival race: endure the heavenly lightning while dispersing the cloud.
  const power = E.power(c) * (0.70 + c.realm * 0.04);
  const e = makeEnemy(c, rng, { kind: "tribulation", name: "Heavenly Tribulation", power, element: "Lightning", boss: true, tribulation: true, hpMult: 5.0, reward: 0 });
  e.kit = { basic: { name: "Heavenly Bolt", dmg: 0.50, element: "Lightning" }, moves: [
    { w: 5, m: { name: "Forked Lightning", dmg: 0.66, element: "Lightning" } },
    { w: 2, m: { name: "Heart-Demon Surge", dmg: 0.40, element: "Dark", target: { type: "weaken", turns: 2, value: 0.2 } } },
    { w: 1, m: { name: "TRIBULATION THUNDER", dmg: 1.0, element: "Lightning" } },
  ] };
  return e;
}

/* ----------------------------- the battle -------------------------------- */
export function createBattle(c, enemyDef, rng, opts = {}) {
  const P = E.power(c);
  const ph = D.physEffect(c);                       // ongoing physique effects
  const pMax = P * 1.9 * (1 + (ph.hp || 0));
  // Your spiritual root's element(s) (plus any from a special physique) attune you:
  // bonus damage with matching-element arts, and resistance to that element.
  const rootEls = (c.awakened && c.root && c.root.elements && c.root.elements.length) ? c.root.elements.slice() : [];
  if (ph.element && !rootEls.includes(ph.element)) rootEls.push(ph.element);
  const attune = (c.awakened && c.root && c.root.elements && c.root.elements.length)
    ? clampN(0.10 + (c.root.multiplier || 1) * 0.07, 0.12, 0.45)
    : (ph.element ? 0.15 : 0);
  const player = {
    isPlayer: true, ref: c, name: c.name,
    maxHp: pMax, hp: pMax * (opts.startHpFrac != null ? clampN(opts.startHpFrac, 0.1, 1) : 1),
    maxQi: (40 + c.soul * 0.4 + c.realm * 6) * (1 + (ph.qiPool || 0)), qi: (40 + c.soul * 0.4 + c.realm * 6) * (1 + (ph.qiPool || 0)),
    atk: P - E.beastPower(c),
    mitig: clampN(c.constitution / 300 + c.realm * 0.012 + (ph.mitig || 0) + D.bodyRealmAt(c.bodyRealm || 0)[6], 0, 0.7),
    crit: clampN(c.luck / 400 + 0.05, 0, 0.6),
    dodge: clampN(c.luck / 600 + c.soul / 900 + (c.equippedArtifact === "cloud_boots" ? 0.1 : 0) + (ph.dodge || 0), 0, 0.5),
    healBonus: ph.healBonus || 0, vsDemon: ph.vsDemon || 0, burnImmune: !!ph.burnImmune,
    element: rootEls.length ? rootEls[0] : null,
    rootElements: rootEls, attune,
    shield: 0, statuses: [], beast: E.beastPower(c),
    beastElement: (c.beast && c.beast.alive) ? (c.beast.element || null) : null,
    beastBond: (c.beast && c.beast.alive) ? (c.beast.bond != null ? c.beast.bond : 50) : 0,
    beastRank: (c.beast && c.beast.alive) ? (c.beast.rank || 1) : 0,
    ally: bondedAlly(c, enemyDef),
  };
  const ep = enemyDef.power;
  const hpMult = enemyDef.hpMult || 2.3;
  const enemy = {
    isPlayer: false, name: enemyDef.name, kind: enemyDef.kind,
    maxHp: ep * hpMult, hp: ep * hpMult,
    atk: ep, mitig: 0.08 + (enemyDef.kind === "rogue" ? 0.04 : 0),
    crit: 0.15, dodge: enemyDef.tribulation ? 0 : 0.06, element: enemyDef.element || null,
    shield: 0, statuses: [],
    kit: enemyDef.kit || buildKit(enemyDef.kind, enemyDef.name),
    boss: !!enemyDef.boss, tribulation: !!enemyDef.tribulation, _enraged: false,
    phase: 1, ultName: enemyDef.ultName, ultElement: enemyDef.ultElement, _charging: false,
  };
  const B = {
    player, enemy, rng, def: enemyDef, opts, turn: 1, over: false, outcome: null,
    actions: () => listActions(B),
    act: (id) => takeRound(B, id),
    finish: () => finishBattle(B),
  };
  return B;
}

function listActions(B) {
  const c = B.player.ref, acts = [];
  for (const s of playerSkills(c)) acts.push({ id: s.id, name: s.name, qi: s.qi, desc: s.desc, element: s.element, disabled: B.player.qi < s.qi });
  if (c.healingPills > 0) acts.push({ id: "pill", name: `Healing Pill (${c.healingPills})`, qi: 0, desc: "Restore 40% HP. Uses your turn." });
  if (c.talismans) for (const key of D.TALISMAN_ORDER) {
    const n = c.talismans[key] || 0; if (n <= 0) continue;
    const t = D.TALISMANS[key];
    acts.push({ id: "tali:" + key, name: `🧧 ${t.name} (${n})`, qi: 0, desc: t.desc, element: t.element || undefined });
  }
  if (!B.enemy.tribulation) acts.push({ id: "flee", name: "Flee", qi: 0, desc: "Try to escape. Failure leaves you open." });
  return acts;
}

function skillById(c, id) {
  for (const s of playerSkills(c)) if (s.id === id) return s;
  return null;
}
function statusAtkMult(u) {
  let m = 1;
  for (const s of u.statuses) { if (s.type === "empower") m += s.value; if (s.type === "weaken") m -= s.value; }
  return Math.max(0.4, m);
}
function hasStatus(u, t) { return u.statuses.some(s => s.type === t); }
function addStatus(u, type, turns, value) { u.statuses.push({ type, turns, value }); }
function tickStart(B, u, lines) {
  // Damage-over-time and regen apply at the start of the unit's turn.
  for (const s of u.statuses) {
    if (s.type === "burn" && u.burnImmune) continue;  // Nine-Yang body shrugs off flame
    if (s.type === "burn" || s.type === "bleed") { const d = u.maxHp * s.value; u.hp -= d; lines.push(`${icon(u)} ${u.name} suffers ${Math.round(d)} ${s.type} damage.`); }
    if (s.type === "regen") { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.value); }
  }
  for (const s of u.statuses) s.turns--;
  u.statuses = u.statuses.filter(s => s.turns > 0);
}
const icon = u => u.isPlayer ? "🧘" : (elementIcon(u.element));

export function masteryMultiplier(c, skill) {
  if (!skill || !skill.tech || !c || !c.mastery) return 1;
  return 1 + D.masteryRank(c.mastery[skill.tech] || 0)[2];
}
function resolveSkill(B, att, def, skill, lines) {
  const rng = B.rng;
  const mm = att.isPlayer ? masteryMultiplier(att.ref, skill) : 1;
  if (skill.qiRestore && att.isPlayer) att.qi = Math.min(att.maxQi, att.qi + att.maxQi * skill.qiRestore);
  if (skill.type === "defend") {
    att.shield += att.maxHp * skill.shield * mm;
    if (skill.counter) addStatus(att, "counter", 2, skill.counter);
    if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value);
    lines.push(`${icon(att)} ${att.name} — ${skill.name || "guards"}${skill.counter ? " (reflecting stance)" : skill.self ? ` (${skill.self.type})` : ""}.`);
    return;
  }
  if (skill.type === "heal") {
    const heal = (att.maxHp * skill.heal + (att.ref ? att.ref.soul * 0.6 : 0)) * mm * (1 + (att.healBonus || 0));
    att.hp = Math.min(att.maxHp, att.hp + heal);
    if (skill.cleanse) att.statuses = att.statuses.filter(s => !["burn", "bleed", "weaken"].includes(s.type));
    lines.push(`${icon(att)} ${att.name} — ${skill.name || "heals"}: +${Math.round(heal)} HP${skill.cleanse ? ", cleansed" : ""}.`);
    return;
  }
  if (skill.type === "buff") {
    if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value);
    lines.push(`${icon(att)} ${att.name} — ${skill.name} (${skill.self ? skill.self.type : "focus"}).`);
    return;
  }
  if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value);
  if (skill.karma && att.ref) att.ref.karma += skill.karma;
  // Damage (supports multi-hit; each hit rolls its own crit and element).
  const hits = skill.hits || 1;
  const demonFoe = !att.isPlayer ? false : (def.element === "Dark" || /demon|corpse|blood|ghost|devil|fiend|abyss/i.test(def.name || ""));
  const demonBonus = (att.vsDemon && demonFoe) ? (1 + att.vsDemon) : 1;
  for (let h = 0; h < hits; h++) {
    if (def.hp <= 0) break;
    const skEl = skill.element || att.element;
    const attuned = skEl && att.rootElements && att.rootElements.includes(skEl);   // your art rides your root's element
    let base = att.atk * skill.dmg * statusAtkMult(att) * mm * demonBonus * (attuned ? 1 + att.attune : 1);
    let mult = elementMult(skEl, def.element);
    const crit = rng.random() < att.crit;
    if (crit) mult *= 2;
    base *= mult * rng.uniform(0.9, 1.1);
    if (rng.random() < def.dodge) { lines.push(`${icon(def)} ${def.name} evades${hits > 1 ? ` hit ${h + 1}` : ""} — dodged!`); continue; }
    let dmg = base * (1 - def.mitig * (1 - (skill.pierce || 0)));
    // The defender's own root element resonates against an attack of that element.
    if (skEl && def.rootElements && def.rootElements.includes(skEl)) dmg *= (1 - (def.attune || 0) * 0.5);
    if (def.shield > 0) { const a = Math.min(def.shield, dmg); def.shield -= a; dmg -= a; }
    dmg = Math.max(0, Math.round(dmg));
    def.hp -= dmg;
    lines.push(`${icon(att)} ${att.name} — ${skill.name}${hits > 1 ? ` (${h + 1}/${hits})` : ""}${attuned ? " 🜂" : ""}${mult > 1.05 && !crit ? " 🔆" : ""}${crit ? " 💥CRIT" : ""} → ${dmg} dmg${attuned ? " (attuned)" : ""}${mult > 1.05 ? " (advantage)" : mult < 0.95 ? " (resisted)" : ""}.`);
    if (skill.lifesteal && dmg > 0) { const hh = dmg * skill.lifesteal; att.hp = Math.min(att.maxHp, att.hp + hh); lines.push(`   ${att.name} drains ${Math.round(hh)} HP.`); }
    // Counter / reflect: a defender in a reflecting stance turns force back.
    const cs = def.statuses.find(s => s.type === "counter");
    if (cs && dmg > 0) { const refl = Math.round(dmg * cs.value); att.hp -= refl; def.statuses = def.statuses.filter(s => s !== cs); lines.push(`   ✦ ${def.name} reflects ${refl} damage back!`); }
  }
  // Status afflictions (applied once, if the foe still stands).
  const applyTarget = t => { if (t && def.hp > 0 && !(t.type === "burn" && def.burnImmune) && (t.chance == null || rng.random() < t.chance)) { addStatus(def, t.type, t.turns + 1, t.value); lines.push(`   ${def.name} is afflicted: ${t.type}!`); } };
  applyTarget(skill.target);
  applyTarget(skill.target2);
}

function enemyChoose(B) {
  const e = B.enemy, rng = B.rng;
  // Bosses enrage once, hard, when badly wounded.
  if (e.boss && !e.tribulation && e.hp < e.maxHp * 0.30 && !e._enraged) { e._enraged = true; return { enrage: true }; }
  const kit = e.kit;
  if (rng.random() < 0.5 && kit.moves.length) return { move: rng.choices(kit.moves.map(x => x.m), kit.moves.map(x => x.w)) };
  return { move: kit.basic };
}

function takeRound(B, actionId) {
  if (B.over) return { lines: [], over: true, outcome: B.outcome };
  const lines = [];
  const c = B.player.ref, P = B.player, En = B.enemy;

  // --- player action ---
  if (actionId === "flee") {
    const chance = clampN(0.4 + c.luck / 250 + (P.hp / P.maxHp - En.hp / En.maxHp) * 0.2, 0.1, 0.9);
    if (B.rng.random() < chance) { B.over = true; B.outcome = "flee"; lines.push("🏃 You break away and escape the fight."); return { lines, over: true, outcome: "flee" }; }
    lines.push("🏃 You fail to escape — the foe gets a free strike!");
  } else if (actionId === "pill") {
    if (c.healingPills > 0) { c.healingPills--; P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4); lines.push("💊 You swallow a Spirit Healing Pill (+40% HP)."); }
  } else if (actionId.indexOf("tali:") === 0) {
    const key = actionId.slice(5), t = D.TALISMANS[key], have = (c.talismans && c.talismans[key]) || 0;
    if (!t || have <= 0) { lines.push("You have no such talisman."); }
    else {
      c.talismans[key] = have - 1;
      if (t.kind === "attack") {
        lines.push(`🧧 You loose the ${t.name}!`);
        resolveSkill(B, P, En, { name: t.name, dmg: t.value, element: t.element, target: key === "frost" ? { type: "stun", turns: 1, value: 0, chance: 0.4 } : null }, lines);
      } else if (t.kind === "shield") { P.shield += P.maxHp * t.value; lines.push(`🧧 ${t.name} — a golden bell of qi shields you (+${Math.round(P.maxHp * t.value)}).`); }
      else if (t.kind === "heal") { const h = P.maxHp * t.value; P.hp = Math.min(P.maxHp, P.hp + h); lines.push(`🧧 ${t.name} — your wounds knit (+${Math.round(h)} HP).`); }
      else if (t.kind === "bind") { addStatus(En, "stun", t.value + 1, 0); lines.push(`🧧 ${t.name} — soul-script locks ${En.name} in place!`); }
      else if (t.kind === "escape") { B.over = true; B.outcome = "flee"; lines.push(`🧧 ${t.name} — you tear space and vanish from the fight.`); return { lines, over: true, outcome: "flee" }; }
    }
  } else if (hasStatus(P, "stun")) {
    lines.push("💫 You are stunned and cannot act!"); P.statuses = P.statuses.filter(s => s.type !== "stun");
  } else {
    const skill = skillById(c, actionId) || SKILLS.strike;
    if (P.qi < skill.qi) { lines.push("Not enough qi — you fall back on a basic strike."); resolveSkill(B, P, En, SKILLS.strike, lines); }
    else {
      P.qi -= skill.qi; resolveSkill(B, P, En, skill, lines);
      if (skill.tech) {  // using a technique deepens your mastery of it
        if (!c.mastery) c.mastery = {};
        const before = D.masteryRank(c.mastery[skill.tech] || 0)[0];
        c.mastery[skill.tech] = (c.mastery[skill.tech] || 0) + B.rng.randint(2, 4);
        const after = D.masteryRank(c.mastery[skill.tech])[0];
        if (after !== before) lines.push(`   ✦ Your ${skill.name} deepens to ${after}!`);
      }
    }
  }

  // Beast ally assists each round — harder the deeper your bond, and with the
  // bite of its own element. A high-rank beast can inflict an elemental affliction.
  if (P.beast > 0 && En.hp > 0 && actionId !== "flee") {
    const bondMult = 0.7 + (P.beastBond / 100) * 0.6;            // 0.7 .. 1.3
    const em = elementMult(P.beastElement, En.element);
    const bd = Math.round(P.beast * 0.22 * bondMult * B.rng.uniform(0.8, 1.2) * em);
    En.hp -= bd; lines.push(`🐾 ${c.beast.name} lunges in for ${bd} dmg${em > 1.05 ? " 🔆" : ""}.`);
    if (P.beastRank >= 3 && P.beastElement && En.hp > 0 && B.rng.random() < 0.25) {
      const fx = BEAST_BITE[P.beastElement];
      if (fx && !(fx[0] === "burn" && En.burnImmune)) { addStatus(En, fx[0], fx[1] + 1, fx[2]); lines.push(`   ${En.name} suffers the beast's ${fx[0]}!`); }
    }
  }

  // A bonded companion or disciple fights at your side, the harder the closer your bond.
  if (P.ally && En.hp > 0 && actionId !== "flee") {
    const affMult = 0.6 + (P.ally.affinity / 100) * 0.5;          // 0.6 .. 1.1
    const ad = Math.round(P.atk * 0.09 * affMult * B.rng.uniform(0.85, 1.15));
    En.hp -= ad; lines.push(`⚔ ${P.ally.name} ${P.ally.role === "companion" ? "fights at your side" : "strikes for the sect"} — ${ad} dmg.`);
  }

  if (En.hp <= 0) { B.over = true; B.outcome = "win"; lines.push(`🏆 ${En.name} is defeated!`); B.turn++; return { lines, over: true, outcome: "win" }; }

  // --- enemy turn ---
  tickStart(B, En, lines);
  if (En.hp <= 0) { B.over = true; B.outcome = "win"; lines.push(`🏆 ${En.name} succumbs to its wounds!`); return { lines, over: true, outcome: "win" }; }
  // Boss phase transition at half health: shed restraint, shield up, empower.
  if (En.boss && !En.tribulation && En.phase === 1 && En.hp < En.maxHp * 0.5) {
    En.phase = 2; En.shield += En.maxHp * 0.22; addStatus(En, "empower", 99, 0.18);
    lines.push(`✦ ${En.name} sheds all restraint and enters its second phase!`);
  }
  if (hasStatus(En, "stun")) { lines.push(`💫 ${En.name} is stunned!`); En.statuses = En.statuses.filter(s => s.type !== "stun"); }
  else if (En._charging) {
    // Release the telegraphed ultimate.
    En._charging = false;
    lines.push(`⚡ ${En.name} unleashes ${En.ultName || "its ultimate"}!`);
    resolveSkill(B, En, P, { name: En.ultName || "Ultimate", dmg: 1.05, element: En.ultElement || En.element, pierce: 0.25 }, lines);
  } else {
    const choice = enemyChoose(B);
    if (choice.enrage) { addStatus(En, "empower", 99, 0.30); lines.push(`🔥 ${En.name} ENRAGES — its aura erupts!`); }
    else if (En.phase === 2 && En.ultName && B.rng.random() < 0.3) {
      En._charging = true;
      lines.push(`⚡ ${En.name} gathers a devastating ${En.ultName} — brace yourself!`);
    } else resolveSkill(B, En, P, choice.move, lines);
  }
  // The Heavenly Tribulation escalates relentlessly each round.
  if (En.tribulation && En.hp > 0) addStatus(En, "empower", 99, 0.06);

  // --- end of round upkeep ---
  tickStart(B, P, lines);
  P.qi = Math.min(P.maxQi, P.qi + P.maxQi * 0.10 + 4);
  B.turn++;

  if (P.hp <= 0) {
    if (B.opts.nonLethal) { P.hp = 1; B.over = true; B.outcome = "yield"; lines.push("🛑 You drop to one knee and yield the match."); }
    else { B.over = true; B.outcome = "lose"; lines.push("☠ You are struck down..."); }
    return { lines, over: true, outcome: B.outcome };
  }
  return { lines, over: false, outcome: null };
}

/* --------------------------- resolve outcome ----------------------------- */
function finishBattle(B) {
  const c = B.player.ref, En = B.enemy, rng = B.rng, lines = [];
  const frac = clampN(B.player.hp / B.player.maxHp, 0, 1);

  // The Heavenly Tribulation is its own kind of trial.
  if (En.tribulation) {
    if (B.outcome === "win") {
      c.hp = Math.max(1, c.maxHp * Math.max(0.2, frac));
      c.qi += E.qiToNext(c) * 0.3;
      lines.push("⚡ You weather the Heavenly Tribulation! The clouds disperse and your new realm settles, unshakable.");
    } else {
      if (rng.random() < c.luck / 320 + (D.physEffect(c).deathSave || 0)) { c.hp = c.maxHp * 0.1; lines.push("⚡ The final bolt should have ended you — but your undying flesh drags you back from oblivion!"); }
      else { c.alive = false; c.causeOfDeath = `struck down by the ${E.realmName(c)} tribulation`; c.hp = 0; c.log.push([c.age, "Died crossing the Heavenly Tribulation."]); lines.push("☠ The tribulation lightning scatters your soul. You die crossing the heavens."); }
    }
    E.recomputeMaxHp(c);
    return lines;
  }

  if (B.outcome === "win") {
    c.hp = Math.max(1, c.maxHp * Math.max(0.15, frac));
    if (B.opts.noSpoils) { E.recomputeMaxHp(c); return [`You best ${En.name}!`]; }
    c.spiritStones += B.def.reward; c.reputation += En.boss ? 8 : 1;
    lines.push(`Victory! +${B.def.reward} spirit stones, +${En.boss ? 8 : 1} reputation.`);
    if (En.kind === "rogue" && (En.name.includes("Demonic") || En.name.includes("Corpse") || En.name.includes("Bandit") || rng.random() < 0.5)) { c.karma += 2; }
    if (En.boss) {
      // A slain boss always yields a treasure, and a lasting tale.
      lines.push(...E.acquireArtifact(c, E.randomArtifact(c, rng, rng.random() < 0.4 ? "Heaven" : null)));
      c.pills += rng.randint(1, 3); c.herbs += rng.randint(3, 8);
      const title = `Slayer of the ${En.name}`;
      if (!c.titles.includes(title)) { c.titles.push(title); c.log.push([c.age, `Slew the ${En.name}.`]); }
      lines.push(`✦ You earn renown as the ${title}!`);
      lines.push(...E.maybeAwardEpithet(c, rng, { base: 0.35 }));
    } else if (rng.random() < 0.16 + c.luck / 900) {
      const r = rng.random();
      if (r < 0.25) lines.push(...E.acquireArtifact(c, E.randomArtifact(c, rng)));
      else if (r < 0.55) { const n = rng.randint(2, 5); c.herbs += n; lines.push(`You gather ${n} spirit herbs.`); }
      else { c.pills += 1; lines.push("You loot a Qi-Gathering Pill."); }
    }
    if (En.kind === "beast" && c.beast == null && !B.opts.nonLethal) lines.push(...E.tryTame(c, En.name, En.power, rng));
  } else if (B.outcome === "yield") {
    c.hp = Math.max(1, c.maxHp * 0.25);
    lines.push("The bout ends. You tend your bruises, a little wiser for it.");
  } else if (B.outcome === "flee") {
    c.hp = Math.max(1, c.maxHp * Math.max(0.2, frac));
    lines.push("You live to cultivate another day — but win no spoils.");
  } else { // lose
    if (rng.random() < c.luck / 300 + (D.physEffect(c).deathSave || 0)) { c.hp = c.maxHp * 0.12; lines.push("At death's door, fortune (or undying flesh) lets you crawl away alive!"); }
    else { c.alive = false; c.causeOfDeath = `slain by a ${En.name}`; c.hp = 0; c.log.push([c.age, `Killed in battle by a ${En.name}.`]); lines.push(`☠ The ${En.name} strikes you down. Your journey ends here.`); }
  }
  E.recomputeMaxHp(c);
  return lines;
}
