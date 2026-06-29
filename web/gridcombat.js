/* The Nine Heavens — tactical GRID combat (战阵).
 *
 * A TTRPG-style battle on a square grid: you, your spirit beast and a bonded
 * companion stand against a band of foes across terrain that matters — rock
 * walls that block sight and step, broken ground that slows, spirit-flame that
 * burns, thickets that shelter, and spirit-springs that restore qi. Each unit
 * takes a turn in initiative order to MOVE (range set by your 轻功 movement art)
 * and ACT, and your learned techniques reach across the field: some strike a
 * single square, some a whole blast, some a piercing line.
 *
 * It reuses the existing combat vocabulary wholesale — the SKILLS table, Wu-Xing
 * element math, mastery, statuses, the Dao battle-manifestations, your physique,
 * gear, beast and companion — so everything you have built still bites here.
 */
import * as E from "./engine.js";
import * as D from "./data.js";
import * as C from "./combat.js";

const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const GW = 7, GH = 6;                 // grid width / height
const inb = (x, y) => x >= 0 && x < GW && y >= 0 && y < GH;
const key = (x, y) => x + "," + y;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/* ------------------------------- terrain --------------------------------- */
// pass: can a unit stand here · cost: movement cost to enter · los: does it let
// sight (and ranged arts) through · hazard/cover/qi: the feature's battle effect.
export const TERRAIN = {
  floor:  { pass: true, cost: 1, los: true },
  wall:   { name: "Rock Wall", pass: false, cost: 99, los: false },
  rubble: { name: "Broken Ground", pass: true, cost: 2, los: true },
  flame:  { name: "Spirit-Flame", pass: true, cost: 1, los: true, hazard: 0.06 },
  chasm:  { name: "Chasm", pass: false, cost: 99, los: true },   // impassable, but sight crosses it
  thicket:{ name: "Spirit Thicket", pass: true, cost: 2, los: false, cover: 0.18 },
  spring: { name: "Spirit Spring", pass: true, cost: 1, los: true, qi: 0.18 },
};
const terr = (B, x, y) => TERRAIN[B.cells[y * GW + x]] || TERRAIN.floor;
const passable = (B, x, y) => inb(x, y) && terr(B, x, y).pass;
const unitAt = (B, x, y) => B.units.find(u => u.alive && u.x === x && u.y === y) || null;

// Each kind of fight has its own field. A duel or tournament is a clean ring; a
// boss waits in a pillared arena; the Heavenly Tribulation strikes a storm-blasted
// peak; a demon lairs amid black flame; sect wars are fought over broken siege
// ground; a secret realm twists to its own element; the wilds are the wilds.
function genMap(rng, spec) {
  const map = spec.map || "wilds";
  if (map === "wilds") return genTerrain(rng, spec.danger || 0);
  const cells = new Array(GW * GH).fill("floor");
  const free = (x, y) => y >= 2 && y <= GH - 3;
  const put = (t, n) => { let p = 0; for (let i = 0; i < n * 5 && p < n; i++) { const x = rng.randint(1, GW - 2), y = rng.randint(2, GH - 3); if (free(x, y) && cells[y * GW + x] === "floor") { cells[y * GW + x] = t; p++; } } };
  const d = clampN(spec.danger || 0, 0, 4);
  switch (map) {
    case "ring": break;                                       // a clean duelling ring — pure skill, no terrain
    case "arena": put("wall", 2 + rng.randint(0, 1)); break;  // pillars to circle
    case "tribulation": put("flame", 2 + rng.randint(0, 1)); break;   // lightning-scorched ground
    case "lair": put("wall", 2); put("flame", 1 + rng.randint(0, 1)); break;
    case "battlefield": put("rubble", 3); put("wall", 1 + rng.randint(0, 1)); break;
    case "realm":
      put("wall", 2);
      put(spec.element === "Fire" || spec.element === "Lightning" ? "flame" : spec.element === "Wood" || spec.element === "Earth" ? "thicket" : "flame", 1 + (d > 2 ? 1 : 0));
      if (rng.random() < 0.5) put("spring", 1);
      break;
    default: return genTerrain(rng, d);
  }
  return cells;
}
// Generate a battlefield, its feature density rising with the land's danger.
function genTerrain(rng, danger) {
  const cells = new Array(GW * GH).fill("floor");
  const set = (x, y, t) => { if (inb(x, y)) cells[y * GW + x] = t; };
  const free = (x, y) => y >= 2 && y <= GH - 3;     // keep the spawn rows (top/bottom) clear
  const d = clampN(danger, 0, 4);
  // A scatter of rock walls and broken ground through the middle of the field.
  const features = 3 + Math.round(d * 0.8) + rng.randint(0, 2);
  for (let i = 0; i < features; i++) {
    const x = rng.randint(1, GW - 2), y = rng.randint(2, GH - 3);
    if (!free(x, y)) continue;
    const r = rng.random();
    set(x, y, r < 0.42 ? "wall" : r < 0.72 ? "rubble" : "thicket");
  }
  // Hazards and chasms grow with the danger of the land.
  if (d >= 1 && rng.random() < 0.5 + d * 0.12) { const x = rng.randint(1, GW - 2), y = rng.randint(2, GH - 3); if (free(x, y)) set(x, y, "flame"); }
  if (d >= 2 && rng.random() < 0.4) { const x = rng.randint(1, GW - 2), y = rng.randint(2, GH - 3); if (free(x, y)) set(x, y, rng.random() < 0.5 ? "flame" : "chasm"); }
  // A boon: a spirit spring (and, in the wilds, a sheltering thicket).
  if (rng.random() < 0.5) { const x = rng.randint(1, GW - 2), y = rng.randint(2, GH - 3); if (free(x, y)) set(x, y, "spring"); }
  return cells;
}

/* ------------------------------- units ----------------------------------- */
const statusAtkMult = u => { let m = 1; for (const s of u.statuses) { if (s.type === "empower") m += s.value; if (s.type === "weaken") m -= s.value; } return Math.max(0.4, m); };
const hasStatus = (u, t) => u.statuses.some(s => s.type === t);
const sunderAmt = u => u.statuses.reduce((a, s) => a + (s.type === "sunder" ? s.value : 0), 0);
function addStatus(u, type, turns, value) { u.statuses.push({ type, turns, value }); }

// The player avatar as a grid unit — every existing system (power, physique,
// gear, root attunement, Dao manifestations, 轻功, Dao Heart) folded in.
function buildPlayerUnit(c, startHpFrac) {
  const P = E.power(c), ph = D.physEffect(c), eq = E.equipmentEffects(c);
  const maxHp = P * 1.9 * (1 + (ph.hp || 0) + (eq.hp || 0));
  const rootEls = (c.awakened && c.root && c.root.elements && c.root.elements.length) ? c.root.elements.slice() : [];
  if (ph.element && !rootEls.includes(ph.element)) rootEls.push(ph.element);
  let attune = (c.awakened && c.root && c.root.elements && c.root.elements.length)
    ? clampN(0.10 + (c.root.multiplier || 1) * 0.07, 0.12, 0.45) : (ph.element ? 0.15 : 0);
  for (const el of E.equipmentElements(c)) if (!rootEls.includes(el)) rootEls.push(el);
  const maxQi = (40 + c.soul * 0.4 + c.realm * 6) * (1 + (ph.qiPool || 0) + (eq.qiMax || 0));
  const u = {
    side: "player", name: c.name, ref: c, alive: true, statuses: [], shield: 0,
    hp: maxHp, maxHp, qi: maxQi, maxQi,
    atk: P - E.beastPower(c),
    mitig: clampN(c.constitution / 300 + c.realm * 0.012 + (ph.mitig || 0) + (eq.def || 0) + D.bodyRealmAt(c.bodyRealm || 0)[6], 0, 0.8),
    crit: clampN(c.luck / 400 + 0.05 + (eq.crit || 0) + (ph.crit || 0), 0, 0.7),
    dodge: clampN(c.luck / 600 + c.soul / 900 + (eq.dodge || 0) + (ph.dodge || 0) + E.movementDodge(c), 0, 0.6),
    element: rootEls.length ? rootEls[0] : null, rootElements: rootEls, attune,
    equipLifesteal: eq.life || 0, healBonus: ph.healBonus || 0, vsDemon: ph.vsDemon || 0, burnImmune: !!ph.burnImmune,
    mentalResist: E.mentalResist(c),
    move: clampN(3 + (E.hopsPerDeed(c) - 1) + Math.round(E.movementDodge(c) * 3), 3, 7),
  };
  const dm = E.daoBattleMods(c);
  if (dm.hp) { u.maxHp *= (1 + dm.hp); }
  if (startHpFrac != null) u.hp = u.maxHp * clampN(startHpFrac, 0.1, 1);
  else u.hp = u.maxHp;
  u.crit = clampN(u.crit + (dm.crit || 0), 0, 0.85);
  u.dodge = clampN(u.dodge + (dm.dodge || 0), 0, 0.7);
  u.equipLifesteal += dm.lifesteal || 0;
  u.daoPierce = dm.pierce || 0;
  if (dm.shield) u.shield += u.maxHp * dm.shield;
  if (dm.regen) u.statuses.push({ type: "regen", turns: 99, value: dm.regen });
  return u;
}
// The player's spirit beast as a true ally on the field.
function buildBeastUnit(c) {
  if (!(c.beast && c.beast.alive)) return null;
  const bp = E.beastPower(c) || E.basePower(c) * 0.3, bond = c.beast.bond != null ? c.beast.bond : 50;
  return {
    side: "ally", name: c.beast.name, kind: "beast", alive: true, statuses: [], shield: 0,
    hp: bp * 2.2, maxHp: bp * 2.2, qi: 0, maxQi: 0,
    atk: bp * (0.7 + bond / 100 * 0.6) * (E.beastTraitOf(c.beast) === "ferocious" ? 1.3 : 1),
    mitig: 0.1, crit: 0.12, dodge: E.beastTraitOf(c.beast) === "nimble" ? 0.12 : 0.07,
    element: c.beast.element || null, rootElements: c.beast.element ? [c.beast.element] : [], attune: 0.1,
    move: 4, ai: "beast",
    kit: { basic: { name: "Maul", dmg: 0.5, element: c.beast.element }, moves: (c.beast.rank || 1) >= 3 ? [{ w: 2, m: { name: "Savaging", dmg: 0.72, element: c.beast.element } }] : [] },
  };
}
// A bonded companion / disciple who fights at your side.
function buildCompanionUnit(c, enemyDef) {
  if (enemyDef && enemyDef.tribulation) return null;
  const cand = (c.relationships || []).filter(n => n.alive && n.resides && (n.role === "companion" || n.role === "disciple") && (n.affinity || 0) >= 20)
    .sort((a, b) => (b.affinity || 0) - (a.affinity || 0));
  if (!cand.length) return null;
  const a = cand[0], aff = a.affinity || 50;
  const morale = 1 + (c.charm || 0) / 300;
  const base = E.power(c) * (0.32 + aff / 100 * 0.18) * morale;
  return {
    side: "ally", name: a.name, kind: "companion", alive: true, statuses: [], shield: 0,
    hp: base * 2.4, maxHp: base * 2.4, qi: 30, maxQi: 30,
    atk: base, mitig: 0.1, crit: 0.12, dodge: 0.08,
    element: a.element || null, rootElements: a.element ? [a.element] : [], attune: 0.12,
    move: 4, ai: "companion",
    kit: { basic: { name: "Strike", dmg: 0.46, element: a.element }, moves: [{ w: 2, m: { name: "Flurry", dmg: 0.28, hits: 2, element: a.element } }] },
  };
}
// One enemy stat-block (from combat.makeEnemy / makeEnemyFromNpc) → a grid unit.
function buildEnemyUnit(def) {
  const hp = def.power * (def.hpMult || 2.0);
  return {
    side: "enemy", name: def.name, kind: def.kind, alive: true, statuses: [], shield: 0,
    hp, maxHp: hp, qi: 0, maxQi: 0,
    atk: def.power, mitig: 0.08 + (def.kind === "rogue" ? 0.04 : 0), crit: 0.15, dodge: def.tribulation ? 0 : 0.06,
    element: def.element || null, rootElements: def.element ? [def.element] : [], attune: 0.08,
    move: def.kind === "beast" ? 4 : 3, ai: "enemy", boss: !!def.boss, reward: def.reward || 0,
    kit: def.kit || { basic: { name: "Strike", dmg: 0.44 }, moves: [] },
    ranged: def.ranged || 0,
  };
}

/* --------------------------- skill grid-shapes --------------------------- */
// How an art projects onto the grid. Most are derived from the skill's own
// shape (defend/heal = self, multi-hit = a blast, piercing = a line); a handful
// of signature arts get a hand-tuned reach and footprint.
const GRID_META = {
  guard: { range: 0, shape: "self" }, vajra_body: { range: 0, shape: "self" }, cloudmist_veil: { range: 0, shape: "self" },
  mirror_parry: { range: 0, shape: "self" }, moon_mirror: { range: 0, shape: "self" },
  strike: { range: 1, shape: "single" }, five_beasts: { range: 1, shape: "single" }, frost_lotus: { range: 1, shape: "single" },
  azure_cloud: { range: 2, shape: "single" }, blood_refine: { range: 2, shape: "single" }, tide_palm: { range: 2, shape: "single" },
  samsara_palm: { range: 2, shape: "single" }, flowing_light: { range: 2, shape: "single" }, fiveelem_cycle: { range: 2, shape: "single" },
  spirit_bind: { range: 3, shape: "single" }, soul_reap: { range: 1, shape: "single" }, spiritbeast_primal: { range: 1, shape: "single" },
  sword_rain: { range: 4, shape: "blast", radius: 1 }, azure_formation: { range: 4, shape: "blast", radius: 1 },
  mountain_seal: { range: 2, shape: "blast", radius: 1 }, mountain_render: { range: 1, shape: "blast", radius: 1 },
  bloodcult_sea: { range: 3, shape: "blast", radius: 1 }, heavensword_myriad: { range: 5, shape: "blast", radius: 2 },
  great_void: { range: 5, shape: "line" }, nine_yang: { range: 3, shape: "line" }, heaven_slash: { range: 1, shape: "line", len: 3 },
  thunder_step: { range: 3, shape: "single", dash: true },
};
export function shapeOf(skill) {
  const o = GRID_META[skill.id] || {};
  const isSelf = skill.type === "defend" || skill.type === "heal" || skill.type === "buff";
  let range = o.range != null ? o.range : isSelf ? 0 : (skill.hits > 1 ? 3 : skill.pierce ? 2 : 1);
  let shape = o.shape || (isSelf ? "self" : skill.hits > 1 ? "blast" : skill.pierce ? "line" : "single");
  const radius = o.radius != null ? o.radius : (shape === "blast" ? 1 : 0);
  const len = o.len != null ? o.len : range;
  return { range, shape, radius, len, dash: !!o.dash, self: shape === "self" };
}

// Bresenham-ish line of cells from a→b (exclusive of a), stopping at a wall.
function lineCells(B, ax, ay, bx, by, len) {
  const out = []; let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx - dy, steps = 0;
  while (steps++ < (len || GW)) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (!inb(x, y)) break;
    out.push([x, y]);
    if (!terr(B, x, y).los) break;        // a wall stops the line
    if (x === bx && y === by) break;
  }
  return out;
}
// Has the caster clear sight to (tx,ty)? Walls and thickets block; chasms don't.
function hasLoS(B, ax, ay, bx, by) {
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx - dy, x = ax, y = ay, guard = 0;
  while (guard++ < 40) {
    if (x === bx && y === by) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    if (x === bx && y === by) return true;
    if (!inb(x, y) || !terr(B, x, y).los) return false;
  }
  return false;
}
// The cells an art covers, fired from caster at target (tx,ty).
export function targetCells(B, caster, skill, tx, ty) {
  const sh = shapeOf(skill);
  if (sh.shape === "self") return [[caster.x, caster.y]];
  if (sh.shape === "single") return [[tx, ty]];
  if (sh.shape === "blast") { const out = []; for (let dy = -sh.radius; dy <= sh.radius; dy++) for (let dx = -sh.radius; dx <= sh.radius; dx++) { const x = tx + dx, y = ty + dy; if (inb(x, y)) out.push([x, y]); } return out; }
  if (sh.shape === "line") return lineCells(B, caster.x, caster.y, tx, ty, sh.len);
  return [[tx, ty]];
}

/* --------------------------- movement & reach ---------------------------- */
const hostile = (a, b) => (a.side === "enemy") !== (b.side === "enemy");
// Cells a unit can reach this turn (Dijkstra over terrain cost; blocked by walls,
// chasms and other units). Returns Map "x,y" → cost.
function reachCells(B, u, range) {
  const dist = new Map(); dist.set(key(u.x, u.y), 0);
  const q = [{ x: u.x, y: u.y, c: 0 }];
  while (q.length) {
    q.sort((a, b) => a.c - b.c);
    const cur = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!passable(B, nx, ny)) continue;
      if (unitAt(B, nx, ny)) continue;            // cannot move through the occupied
      const nc = cur.c + terr(B, nx, ny).cost;
      if (nc > range) continue;
      if (dist.has(key(nx, ny)) && dist.get(key(nx, ny)) <= nc) continue;
      dist.set(key(nx, ny), nc); q.push({ x: nx, y: ny, c: nc });
    }
  }
  dist.delete(key(u.x, u.y));
  return dist;
}
export function reachable(B) { const u = B.cur; return u && u.side === "player" ? reachCells(B, u, u.move) : new Map(); }
// Valid target cells for a skill from the player's position (range + sight).
export function skillTargets(B, skill) {
  const u = B.cur, sh = shapeOf(skill), out = [];
  if (sh.self) return [key(u.x, u.y)];
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (cheb({ x, y }, u) > sh.range) continue;
    if ((Math.abs(x - u.x) + Math.abs(y - u.y)) > sh.range && sh.shape !== "blast") continue;
    if (!hasLoS(B, u.x, u.y, x, y)) continue;
    out.push(key(x, y));
  }
  return out;
}

/* --------------------------- resolving an art ---------------------------- */
const coverDodge = (B, u) => terr(B, u.x, u.y).cover || 0;
function dealHit(B, att, def, skill, lines) {
  const rng = B.rng;
  const mm = att.ref ? C.masteryMultiplier(att.ref, skill) : 1;
  const skEl = skill.element || att.element;
  const attuned = skEl && att.rootElements && att.rootElements.includes(skEl);
  const demonFoe = att.side !== "enemy" && (def.element === "Dark" || /demon|corpse|blood|ghost|devil|fiend|abyss/i.test(def.name || ""));
  const demonBonus = (att.vsDemon && demonFoe) ? (1 + att.vsDemon) : 1;
  let base = att.atk * (skill.dmg || 0) * statusAtkMult(att) * mm * demonBonus * (attuned ? 1 + att.attune : 1);
  if (skill.execute && def.hp <= def.maxHp * 0.30) base *= skill.execute;
  let mult = C.elementMult(skEl, def.element);
  const crit = rng.random() < (att.crit || 0); if (crit) mult *= 2;
  base *= mult * rng.uniform(0.9, 1.1);
  if (rng.random() < clampN((def.dodge || 0) + coverDodge(B, def), 0, 0.85)) { lines.push(`${def.name} slips aside — evaded!`); return 0; }
  const effMitig = Math.max(0, (def.mitig || 0) - sunderAmt(def));
  let dmg = base * (1 - effMitig * (1 - clampN((skill.pierce || 0) + (att.daoPierce || 0), 0, 0.9)));
  if (skEl && def.rootElements && def.rootElements.includes(skEl)) dmg *= (1 - (def.attune || 0) * 0.5);
  if (def.shield > 0) { const a = Math.min(def.shield, dmg); def.shield -= a; dmg -= a; }
  dmg = Math.max(0, Math.round(dmg)); if (!isFinite(dmg)) dmg = 0;    // never let a bad stat make a foe immortal
  def.hp -= dmg;
  lines.push(`${att.name}'s ${skill.name} hits ${def.name} — ${dmg}${crit ? " CRIT" : ""}${mult > 1.05 ? " (advantage)" : mult < 0.95 ? " (resisted)" : ""}.`);
  const lifeFrac = (skill.lifesteal || 0) + (att.equipLifesteal || 0);
  if (lifeFrac && dmg > 0) { att.hp = Math.min(att.maxHp, att.hp + dmg * lifeFrac); }
  const cs = def.statuses.find(s => s.type === "counter");
  if (cs && dmg > 0) { const refl = Math.round(dmg * cs.value); att.hp -= refl; def.statuses = def.statuses.filter(s => s !== cs); lines.push(`   ${def.name} reflects ${refl} back!`); }
  return dmg;
}
function applyStatusTo(B, att, def, t, lines) {
  if (!t || def.hp <= 0 || (t.type === "burn" && def.burnImmune)) return;
  if (t.chance != null && B.rng.random() >= t.chance) return;
  if (def.side === "player" && (t.type === "stun" || t.type === "weaken") && B.rng.random() < (def.mentalResist || 0)) { lines.push(`   ${def.name}'s dao heart holds — shrugs off the ${t.type}!`); return; }
  addStatus(def, t.type, t.turns + 1, t.value); lines.push(`   ${def.name} is afflicted: ${t.type}!`);
}
// Resolve an art used by `att` against the cell (tx,ty). Returns the dead foes.
function resolveArt(B, att, skill, tx, ty, lines) {
  const rng = B.rng;
  if (skill.qiRestore && att.maxQi) att.qi = Math.min(att.maxQi, att.qi + att.maxQi * skill.qiRestore);
  if (skill.type === "defend") { att.shield += att.maxHp * skill.shield * (att.ref ? C.masteryMultiplier(att.ref, skill) : 1); if (skill.counter) addStatus(att, "counter", 2, skill.counter); if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value); lines.push(`${att.name} — ${skill.name}.`); return; }
  if (skill.type === "heal") { const mm = att.ref ? C.masteryMultiplier(att.ref, skill) : 1; const heal = (att.maxHp * skill.heal + (att.ref ? att.ref.soul * 0.6 : 0)) * mm * (1 + (att.healBonus || 0)); att.hp = Math.min(att.maxHp, att.hp + heal); if (skill.cleanse) att.statuses = att.statuses.filter(s => !["burn", "bleed", "weaken"].includes(s.type)); lines.push(`${att.name} — ${skill.name}: +${Math.round(heal)} HP.`); return; }
  if (skill.type === "buff") { if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value); lines.push(`${att.name} — ${skill.name}.`); return; }
  if (skill.self) addStatus(att, skill.self.type, skill.self.turns + 1, skill.self.value);
  if (skill.karma && att.ref) att.ref.karma += skill.karma;
  const cells = targetCells(B, att, skill, tx, ty);
  const seen = new Set(), hits = skill.hits || 1;
  for (const [cx, cy] of cells) {
    const def = unitAt(B, cx, cy);
    if (!def || !hostile(att, def) || seen.has(def)) continue;
    seen.add(def);
    for (let h = 0; h < hits && def.hp > 0; h++) dealHit(B, att, def, skill, lines);
    applyStatusTo(B, att, def, skill.target, lines);
    applyStatusTo(B, att, def, skill.target2, lines);
    if (skill.sunder && def.hp > 0) { addStatus(def, "sunder", skill.sunder.turns + 1, skill.sunder.value); lines.push(`   ${def.name}'s guard is sundered!`); }
  }
  if (!seen.size) lines.push(`${att.name}'s ${skill.name} strikes only empty ground.`);
}

/* ------------------------------ unit turns ------------------------------- */
function tickStart(B, u, lines) {
  for (const s of u.statuses) {
    if (s.type === "burn" && u.burnImmune) continue;
    if (s.type === "burn" || s.type === "bleed") { const d = Math.round(u.maxHp * s.value); u.hp -= d; lines.push(`${u.name} suffers ${d} ${s.type}.`); }
    if (s.type === "regen") u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.value);
  }
  for (const s of u.statuses) s.turns--;
  u.statuses = u.statuses.filter(s => s.turns > 0);
  // Standing terrain bites or blesses.
  const t = terr(B, u.x, u.y);
  if (t.hazard && !(u.burnImmune)) { const d = Math.round(u.maxHp * t.hazard); u.hp -= d; lines.push(`${u.name} is scorched by spirit-flame — ${d}.`); }
  if (t.qi && u.maxQi) { u.qi = Math.min(u.maxQi, u.qi + u.maxQi * t.qi); }
  if (u.maxQi && u.side !== "enemy") u.qi = Math.min(u.maxQi, u.qi + u.maxQi * 0.08 + (u.ref ? u.ref.soul * 0.04 : 2));
}

// ---- enemy / ally AI ----
function aiSkills(u) {
  if (u.kit) { const list = [Object.assign({ id: "__basic" }, u.kit.basic)]; for (const mv of (u.kit.moves || [])) list.push(Object.assign({ id: "__mv" }, mv.m)); return list; }
  return [{ id: "__basic", name: "Strike", dmg: 0.44 }];
}
// Best cell a unit could aim `skill` at to hit the most foes (within range+LoS).
function bestAimCell(B, u, skill, foes) {
  const sh = shapeOf(skill); if (sh.self) return null;
  let best = null;
  for (const f of foes) {
    if (cheb(u, f) > sh.range) continue;
    if (!hasLoS(B, u.x, u.y, f.x, f.y)) continue;
    const cells = targetCells(B, u, skill, f.x, f.y);
    let count = 0; for (const [cx, cy] of cells) { const t = unitAt(B, cx, cy); if (t && hostile(u, t)) count++; }
    const score = count * 100 + (skill.dmg || 0) * 20;
    if (!best || score > best.score) best = { x: f.x, y: f.y, score, count };
  }
  return best;
}
function stepToward(B, u, target) {
  const reach = reachCells(B, u, u.move);
  let best = { x: u.x, y: u.y, d: cheb(u, target) };
  for (const k of reach.keys()) { const [x, y] = k.split(",").map(Number); const d = cheb({ x, y }, target); if (d < best.d) best = { x, y, d }; }
  u.x = best.x; u.y = best.y;
}
function aiTurn(B, u, lines) {
  if (hasStatus(u, "stun")) { u.statuses = u.statuses.filter(s => s.type !== "stun"); lines.push(`${u.name} is held fast and cannot act.`); return; }
  const foes = B.units.filter(t => t.alive && hostile(u, t));
  if (!foes.length) return;
  foes.sort((a, b) => cheb(u, a) - cheb(u, b));
  const skills = aiSkills(u);
  const usable = skills.filter(s => !s.type || s.dmg);   // damaging arts only, for the AI
  let plan = null;
  for (const sk of usable) { const aim = bestAimCell(B, u, sk, foes); if (aim && (!plan || aim.score > plan.aim.score)) plan = { sk, aim }; }
  if (plan) { resolveArt(B, u, plan.sk, plan.aim.x, plan.aim.y, lines); return; }
  // No one in reach — close on the nearest foe, then strike if able.
  stepToward(B, u, foes[0]);
  for (const sk of usable) { const aim = bestAimCell(B, u, sk, foes); if (aim) { resolveArt(B, u, sk, aim.x, aim.y, lines); return; } }
  lines.push(`${u.name} advances.`);
}

/* ------------------------------- the battle ------------------------------ */
// spec: { enemies:[enemyDef...], danger, title, nonLethal, tribulation }
export function createGridBattle(c, spec, rng) {
  const cells = genMap(rng, spec);
  const B = { cells, rng, units: [], round: 1, over: false, outcome: null, feed: [], opts: spec, ref: c, def: spec,
    tribulation: !!spec.tribulation, nonLethal: !!spec.nonLethal, noSpoils: !!spec.noSpoils,
    canFlee: !spec.tribulation && spec.canFlee !== false };
  const player = buildPlayerUnit(c, spec.startHpFrac); B.units.push(player); B.player = player;
  // Honour duels, tournaments and the lone Tribulation are fought without allies.
  if (!spec.noAllies && !spec.tribulation) {
    const beast = buildBeastUnit(c); if (beast) B.units.push(beast);
    const comp = buildCompanionUnit(c, spec); if (comp) B.units.push(comp);
  }
  for (const def of spec.enemies) B.units.push(buildEnemyUnit(def));
  // Place allies along the bottom edge, foes along the top, on open ground.
  const placeRow = (list, ys) => {
    let i = 0;
    const xs = []; for (let x = 0; x < GW; x++) xs.push(x);
    // spread out across the row, centred
    const order = xs.sort((a, b) => Math.abs(a - (GW - 1) / 2) - Math.abs(b - (GW - 1) / 2));
    for (const u of list) {
      let placed = false;
      for (const y of ys) { for (const x of order) { if (passable(B, x, y) && !unitAt(B, x, y)) { u.x = x; u.y = y; placed = true; break; } } if (placed) break; }
      if (!placed) { u.x = i % GW; u.y = ys[0]; }
      i++;
    }
  };
  placeRow(B.units.filter(u => u.side !== "enemy"), [GH - 1, GH - 2]);
  placeRow(B.units.filter(u => u.side === "enemy"), [0, 1]);
  // Initiative: 轻功/realm/luck quicken you; fixed for the battle.
  const speed = u => (u.side === "player" ? (c.realm * 2 + (c.luck || 0) / 10 + u.move * 3) : (u.move * 3 + (u.boss ? 4 : 0)));
  B.units.sort((a, b) => speed(b) - speed(a) + (a === player ? 0.01 : 0));
  B.order = B.units.slice();
  B.idx = -1;
  B.cur = null;
  return B;
}
function livingEnemies(B) { return B.units.filter(u => u.alive && u.side === "enemy"); }
function checkOver(B) {
  if (B.player.hp <= 0) {
    if (B.nonLethal) { B.player.hp = 1; B.player.alive = true; B.over = true; B.outcome = "yield"; }   // a spar/trial ends in a yield, not a death
    else { B.player.alive = false; B.over = true; B.outcome = "lose"; }
  } else if (!livingEnemies(B).length) { B.over = true; B.outcome = "win"; }
  return B.over;
}
// Advance the initiative queue, auto-running AI turns, until it is the player's
// turn (returns {await:true}) or the battle ends (returns {over:true}).
export function advance(B) {
  if (B.over) return { over: true };
  let guard = 0;
  while (guard++ < 400) {
    B.idx++;
    if (B.idx >= B.order.length) {
      B.idx = -1; B.round++; B.order = B.units.filter(u => u.alive);
      if (B.tribulation) for (const u of B.units) if (u.alive && u.side === "enemy") addStatus(u, "empower", 99, 0.06);   // the heavens' wrath mounts
      if (B.round > 30) {   // a battle cannot drag forever — terrain stalemates end in a withdrawal
        B.over = true; B.outcome = B.player.hp > 0 ? "flee" : "lose";
        B.feed.push("The battle grinds to a stalemate across the broken ground; you disengage from the field.");
        return { over: true };
      }
      continue;
    }
    const u = B.order[B.idx];
    if (!u || !u.alive) continue;
    B.cur = u;
    if (u.side === "player") { tickStart(B, u, B.feed); if (u.hp <= 0) { if (checkOver(B)) return { over: true }; continue; } u.moved = false; u.acted = false; return { await: true, unit: u }; }
    // AI unit
    tickStart(B, u, B.feed);
    if (u.hp <= 0) { u.alive = false; if (checkOver(B)) return { over: true }; continue; }
    aiTurn(B, u, B.feed);
    for (const t of B.units) if (t.alive && t.hp <= 0) { t.alive = false; B.feed.push(`✦ ${t.name} falls!`); }
    if (checkOver(B)) return { over: true };
  }
  return { over: B.over };
}
// ---- player actions ----
export function playerMove(B, x, y) {
  const u = B.cur; if (!u || u.side !== "player" || u.moved) return false;
  if (!reachCells(B, u, u.move).has(key(x, y))) return false;
  u.x = x; u.y = y; u.moved = true; return true;
}
export function playerSkills(c) { return C.playerSkills(c); }
// Use an art; tx,ty ignored for self arts. Ends the player's turn.
export function playerAct(B, skill, tx, ty) {
  const u = B.cur; if (!u || u.side !== "player") return { lines: [] };
  const lines = [];
  if (hasStatus(u, "stun")) { u.statuses = u.statuses.filter(s => s.type !== "stun"); lines.push("You are stunned and cannot act!"); }
  else if (skill && skill.id) {
    const real = C.SKILLS[skill.tech ? Object.keys(C.SKILLS).find(k => C.SKILLS[k].tech === skill.tech) : ""] || skill;
    const sk = skill;
    if ((u.qi || 0) < (sk.qi || 0)) { lines.push("Not enough qi — you fall back on a basic strike."); resolveArt(B, u, C.SKILLS.strike, tx, ty, lines); }
    else {
      u.qi -= (sk.qi || 0); resolveArt(B, u, sk, tx, ty, lines);
      if (sk.tech && u.ref) { const c = u.ref; if (!c.mastery) c.mastery = {}; const before = D.masteryRank(c.mastery[sk.tech] || 0)[0]; c.mastery[sk.tech] = (c.mastery[sk.tech] || 0) + B.rng.randint(2, 4); const after = D.masteryRank(c.mastery[sk.tech])[0]; if (after !== before) lines.push(`   ✦ Your ${sk.name} deepens to ${after}!`); }
    }
  }
  for (const t of B.units) if (t.alive && t.hp <= 0) { t.alive = false; lines.push(`✦ ${t.name} falls!`); }
  u.acted = true;
  B.feed.push(...lines);
  checkOver(B);
  return { lines };
}
export function playerPill(B) {
  const u = B.cur, c = u && u.ref;
  if (!c || (c.healingPills || 0) <= 0) return { lines: ["No healing pills."] };
  c.healingPills--; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4); u.acted = true;
  const l = ["💊 You swallow a Spirit Healing Pill (+40% HP)."]; B.feed.push(...l); return { lines: l };
}
export function playerWithdraw(B) {
  const u = B.cur, c = u.ref;
  // Easier to slip away from the field's edge, and with fortune on your side.
  const edge = u.x === 0 || u.x === GW - 1 || u.y === GH - 1;
  const chance = clampN(0.35 + (c.luck || 0) / 250 + (edge ? 0.25 : 0), 0.1, 0.9);
  if (B.rng.random() < chance) { B.over = true; B.outcome = "flee"; B.feed.push("🏃 You break from the line and escape the field."); return { fled: true }; }
  u.acted = true; B.feed.push("🏃 You fail to slip away — the foe presses in!"); return { fled: false };
}
// End the player's turn and run the queue until the next player turn or the end.
export function endPlayerTurn(B) {
  if (B.over) return { over: true };
  return advance(B);
}

/* --------------------------- resolve the outcome ------------------------- */
export function finishGridBattle(B) {
  const c = B.ref, rng = B.rng, lines = [];
  const frac = clampN(B.player.hp / B.player.maxHp, 0, 1);
  const slain = B.units.filter(u => u.side === "enemy");
  const boss = slain.find(u => u.boss);
  // The Heavenly Tribulation is its own kind of trial — no spoils, only survival.
  if (B.tribulation) {
    if (B.outcome === "win") {
      c.hp = Math.max(1, c.maxHp * Math.max(0.2, frac));
      c.qi += E.qiToNext(c) * 0.3;
      c.daoHeart = Math.min(E.DAO_HEART_MAX, (c.daoHeart || 0) + rng.randint(2, 5));
      lines.push("⚡ You weather the Heavenly Tribulation! The clouds disperse and your new realm settles, unshakable.");
    } else {
      if (rng.random() < c.luck / 320 + (D.physEffect(c).deathSave || 0)) { c.hp = c.maxHp * 0.1; lines.push("⚡ The final bolt should have ended you — but your undying flesh drags you back from oblivion!"); }
      else { c.alive = false; c.causeOfDeath = `struck down by the ${E.realmName(c)} tribulation`; c.hp = 0; c.log.push([c.age, "Died crossing the Heavenly Tribulation."]); lines.push("☠ The tribulation lightning scatters your soul. You die crossing the heavens."); }
    }
    E.recomputeMaxHp(c);
    return lines;
  }
  // A non-lethal bout (spar, rank trial, tournament) leaves only bruises.
  if (B.outcome === "yield") { c.hp = Math.max(1, c.maxHp * 0.25); E.recomputeMaxHp(c); return ["The bout ends. You tend your bruises, a little wiser for it."]; }
  if (B.outcome === "win" && B.noSpoils) { c.hp = Math.max(1, c.maxHp * Math.max(0.2, frac)); E.recomputeMaxHp(c); return ["🏆 You win the bout!"]; }
  if (B.outcome === "win") {
    c.hp = Math.max(1, c.maxHp * Math.max(0.15, frac));
    const reward = slain.reduce((a, u) => a + (u.reward || 0), 0);
    c.spiritStones += reward; c.reputation += boss ? 8 : slain.length;
    lines.push(`🏆 The field is yours — ${slain.length} foe${slain.length > 1 ? "s" : ""} felled! +${reward} spirit stones, +${boss ? 8 : slain.length} reputation.`);
    if (slain.some(u => /demon|corpse|blood|ghost|devil|fiend/i.test(u.name) || u.element === "Dark")) c.karma += 2;
    if (boss) {
      lines.push(...E.acquireArtifact(c, E.randomArtifact(c, rng, rng.random() < 0.4 ? "Heaven" : null, { element: boss.element || null })));
      c.pills += rng.randint(1, 3); c.herbs += rng.randint(3, 8);
      const title = `Slayer of the ${boss.name}`;
      if (!c.titles.includes(title)) { c.titles.push(title); c.log.push([c.age, `Slew the ${boss.name}.`]); lines.push(`✦ You earn renown as the ${title}!`); }
      lines.push(...E.maybeAwardEpithet(c, rng, { base: 0.35 }));
    } else if (rng.random() < 0.20 + c.luck / 800) {
      const r = rng.random();
      if (r < 0.3) lines.push(...E.acquireArtifact(c, E.randomArtifact(c, rng, null, { element: boss ? boss.element : null })));
      else if (r < 0.6) { const n = rng.randint(2, 6); c.herbs += n; lines.push(`You gather ${n} spirit herbs from the field.`); }
      else { c.pills += 1; lines.push("You loot a Qi-Gathering Pill."); }
    }
    const beastFoe = slain.find(u => u.kind === "beast");
    if (beastFoe && c.beast == null && !B.opts.nonLethal) lines.push(...E.tryTame(c, beastFoe.name, beastFoe.atk, rng));
  } else if (B.outcome === "flee") {
    c.hp = Math.max(1, c.maxHp * Math.max(0.2, frac));
    lines.push("You live to cultivate another day — but win no spoils from the field.");
  } else { // lose
    if (rng.random() < c.luck / 300 + (D.physEffect(c).deathSave || 0)) { c.hp = c.maxHp * 0.12; lines.push("At death's door, fortune (or undying flesh) drags you from the field alive!"); }
    else { c.alive = false; c.causeOfDeath = `cut down on the field of battle`; c.hp = 0; c.log.push([c.age, "Killed in a pitched battle."]); lines.push("☠ You fall upon the field. Your journey ends here."); }
  }
  E.recomputeMaxHp(c);
  return lines;
}

// ---- helpers for the UI ----
export const terrainAt = (B, x, y) => B.cells[y * GW + x];
export const unitAtCell = (B, x, y) => unitAt(B, x, y);
