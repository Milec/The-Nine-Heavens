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
};
const SKILL_BY_TECH = {};
for (const k in SKILLS) if (SKILLS[k].tech) SKILL_BY_TECH[SKILLS[k].tech] = SKILLS[k];

export function playerSkills(c) {
  const list = [SKILLS.strike, SKILLS.guard];
  for (const t of c.techniques) if (SKILL_BY_TECH[t]) list.push(SKILL_BY_TECH[t]);
  return list;
}

/* --------------------------- enemy generation ---------------------------- */
const BEAST_FOES = ["Iron-Fang Wolf", "Rock-Shell Tortoise", "Cloud Leopard", "Venom Serpent", "Crimson Ape", "Ghost-Faced Spider", "Flame-Mane Lion", "Thunder Roc", "Frost Python", "Nine-Tailed Fox"];
const ROGUE_FOES = ["Masked Rogue", "Demonic Outrider", "Bandit Qi-user", "Rival Disciple", "Fallen Puppet", "Corpse Refiner"];
const BEAST_ELEM = { "Flame-Mane Lion": "Fire", "Frost Python": "Ice", "Thunder Roc": "Lightning", "Venom Serpent": "Wood", "Rock-Shell Tortoise": "Earth", "Cloud Leopard": "Wind", "Iron-Fang Wolf": "Metal" };

export function makeEnemy(c, rng, opts = {}) {
  const kind = opts.kind || (rng.random() < 0.6 ? "beast" : "rogue");
  const name = opts.name || rng.choice(kind === "beast" ? BEAST_FOES : ROGUE_FOES);
  const factor = opts.factor != null ? opts.factor : rng.choices([0.5, 0.8, 1.0, 1.3, 1.7], [26, 34, 23, 12, 5]);
  const power = opts.power != null ? opts.power : Math.max(5, E.basePower(c) * factor * rng.uniform(0.85, 1.15));
  const element = opts.element || BEAST_ELEM[name] || (rng.random() < 0.5 ? rng.choice(D.ELEMENTS) : null);
  const reward = opts.reward != null ? opts.reward : Math.floor((c.realm + 1) * Math.max(0.5, power / Math.max(1, E.basePower(c))) * rng.randint(3, 9));
  return { name, kind, power, element, reward };
}

/* ----------------------------- the battle -------------------------------- */
export function createBattle(c, enemyDef, rng, opts = {}) {
  const P = E.power(c);
  const player = {
    isPlayer: true, ref: c, name: c.name,
    maxHp: P * 1.9, hp: P * 1.9,
    maxQi: 40 + c.soul * 0.4 + c.realm * 6, qi: 40 + c.soul * 0.4 + c.realm * 6,
    atk: P - E.beastPower(c),
    mitig: clampN(c.constitution / 300 + c.realm * 0.012, 0, 0.5),
    crit: clampN(c.luck / 400 + 0.05, 0, 0.6),
    dodge: clampN(c.luck / 600 + c.soul / 900 + (c.equippedArtifact === "cloud_boots" ? 0.1 : 0), 0, 0.45),
    element: (c.awakened && c.root.elements.length) ? c.root.elements[0] : null,
    shield: 0, statuses: [], beast: E.beastPower(c),
  };
  const ep = enemyDef.power;
  const enemy = {
    isPlayer: false, name: enemyDef.name, kind: enemyDef.kind,
    maxHp: ep * 2.3, hp: ep * 2.3,
    atk: ep, mitig: 0.08 + (enemyDef.kind === "rogue" ? 0.04 : 0),
    crit: 0.15, dodge: 0.06, element: enemyDef.element || null,
    shield: 0, statuses: [],
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
  acts.push({ id: "flee", name: "Flee", qi: 0, desc: "Try to escape. Fails leave you open." });
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
    if (s.type === "burn" || s.type === "bleed") { const d = u.maxHp * s.value; u.hp -= d; lines.push(`${icon(u)} ${u.name} suffers ${Math.round(d)} ${s.type} damage.`); }
    if (s.type === "regen") { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.value); }
  }
  for (const s of u.statuses) s.turns--;
  u.statuses = u.statuses.filter(s => s.turns > 0);
}
const icon = u => u.isPlayer ? "🧘" : (elementIcon(u.element));

function resolveSkill(B, att, def, skill, lines) {
  const rng = B.rng;
  if (skill.qiRestore && att.isPlayer) att.qi = Math.min(att.maxQi, att.qi + att.maxQi * skill.qiRestore);
  if (skill.type === "defend") { att.shield += att.maxHp * skill.shield; lines.push(`${icon(att)} ${att.name} raises a qi shield.`); return; }
  if (skill.type === "heal") {
    const heal = att.maxHp * skill.heal + (att.ref ? att.ref.soul * 0.6 : 0);
    att.hp = Math.min(att.maxHp, att.hp + heal);
    if (skill.cleanse) att.statuses = att.statuses.filter(s => !["burn", "bleed", "weaken"].includes(s.type));
    lines.push(`${icon(att)} ${att.name} restores ${Math.round(heal)} HP${skill.cleanse ? " and cleanses afflictions" : ""}.`);
    return;
  }
  if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value);
  if (skill.karma && att.ref) att.ref.karma += skill.karma;
  // Damage.
  let base = att.atk * skill.dmg * statusAtkMult(att);
  let mult = elementMult(skill.element || att.element, def.element);
  let crit = rng.random() < att.crit;
  if (crit) mult *= 2;
  base *= mult * rng.uniform(0.9, 1.1);
  if (rng.random() < def.dodge) { lines.push(`${icon(def)} ${def.name} flickers aside — dodged!`); return; }
  let dmg = base * (1 - def.mitig * (1 - (skill.pierce || 0)));
  if (def.shield > 0) { const a = Math.min(def.shield, dmg); def.shield -= a; dmg -= a; }
  dmg = Math.max(0, Math.round(dmg));
  def.hp -= dmg;
  lines.push(`${icon(att)} ${att.name} — ${skill.name}${mult > 1.05 && !crit ? " 🔆" : ""}${crit ? " 💥CRIT" : ""} → ${Math.round(dmg)} dmg${mult > 1.05 ? " (element advantage)" : mult < 0.95 ? " (resisted)" : ""}.`);
  if (skill.lifesteal && att.isPlayer === att.isPlayer) { const h = dmg * skill.lifesteal; att.hp = Math.min(att.maxHp, att.hp + h); if (h > 0) lines.push(`   ${att.name} drains ${Math.round(h)} HP.`); }
  if (skill.target && def.hp > 0) { addStatus(def, skill.target.type, skill.target.turns + 1, skill.target.value); lines.push(`   ${def.name} is afflicted with ${skill.target.type}.`); }
}

function enemyChoose(B) {
  const e = B.enemy, rng = B.rng;
  if (e.hp < e.maxHp * 0.25 && rng.random() < 0.25) return { id: "e_guard", name: "Guard", type: "defend", shield: 0.18 };
  if (rng.random() < 0.45) return { id: "e_heavy", name: "Savage Blow", dmg: 0.70, element: e.element };
  return { id: "e_strike", name: "Strike", dmg: 0.43, element: e.element };
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
  } else if (hasStatus(P, "stun")) {
    lines.push("💫 You are stunned and cannot act!"); P.statuses = P.statuses.filter(s => s.type !== "stun");
  } else {
    const skill = skillById(c, actionId) || SKILLS.strike;
    if (P.qi < skill.qi) { lines.push("Not enough qi — you fall back on a basic strike."); resolveSkill(B, P, En, SKILLS.strike, lines); }
    else { P.qi -= skill.qi; resolveSkill(B, P, En, skill, lines); }
  }

  // Beast ally assists each round.
  if (P.beast > 0 && En.hp > 0 && actionId !== "flee") {
    const bd = Math.round(P.beast * 0.22 * B.rng.uniform(0.8, 1.2) * elementMult(null, En.element));
    En.hp -= bd; lines.push(`🐾 ${c.beast.name} lunges in for ${bd} dmg.`);
  }

  if (En.hp <= 0) { B.over = true; B.outcome = "win"; lines.push(`🏆 ${En.name} is defeated!`); B.turn++; return { lines, over: true, outcome: "win" }; }

  // --- enemy turn ---
  tickStart(B, En, lines);
  if (En.hp <= 0) { B.over = true; B.outcome = "win"; lines.push(`🏆 ${En.name} succumbs to its wounds!`); return { lines, over: true, outcome: "win" }; }
  if (hasStatus(En, "stun")) { lines.push(`💫 ${En.name} is stunned!`); En.statuses = En.statuses.filter(s => s.type !== "stun"); }
  else {
    const m = enemyChoose(B);
    if (m.type === "defend") { En.shield += En.maxHp * m.shield; lines.push(`${icon(En)} ${En.name} guards.`); }
    else resolveSkill(B, En, P, { name: m.name, dmg: m.dmg, element: m.element }, lines);
  }

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
  if (B.outcome === "win") {
    c.hp = Math.max(1, c.maxHp * Math.max(0.15, frac));
    c.spiritStones += B.def.reward; c.reputation += 1;
    lines.push(`Victory! +${B.def.reward} spirit stones, +1 reputation.`);
    if (En.kind === "rogue" && (En.name.includes("Demonic") || En.name.includes("Corpse") || En.name.includes("Bandit") || rng.random() < 0.5)) { c.karma += 2; }
    if (rng.random() < 0.16 + c.luck / 900) {
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
    if (rng.random() < c.luck / 300) { c.hp = c.maxHp * 0.12; lines.push("At death's door, blind fortune lets you crawl away alive!"); }
    else { c.alive = false; c.causeOfDeath = `slain by a ${En.name}`; c.hp = 0; c.log.push([c.age, `Killed in battle by a ${En.name}.`]); lines.push(`☠ The ${En.name} strikes you down. Your journey ends here.`); }
  }
  E.recomputeMaxHp(c);
  return lines;
}
