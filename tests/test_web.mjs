/* Smoke and invariant tests for the web (PWA) build of The Nine Heavens.
 *
 * The terminal/Python build has tests/test_game.py; this is its counterpart for
 * the JavaScript engine that powers the primary, mobile-first game. It plays
 * many randomised lives headlessly to guarantee the web build never crashes,
 * the systems interlock cleanly, and — crucially — that age-appropriate gating
 * holds at the model layer, not merely in the interface.
 *
 * Run with:  node tests/test_web.mjs   (needs Node 18+ for ES modules)
 */

import * as E from "../web/engine.js";
import * as L from "../web/life.js";
import * as D from "../web/data.js";
import * as C from "../web/combat.js";
import * as Ev from "../web/events.js";
const { EVENTS } = Ev;

/* --------------------------- tiny test harness --------------------------- */
let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + (msg || ""));
}
function test(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓ " + name);
}

// Play one life automatically and return the finished character. Each year the
// soul spends a few cultivation "deeds" (gainQi, which does not pass time) and
// breaks through when it stands at a realm wall, then ageUp passes the year and
// drives the whole life-sim loop (events, vitals, NPC ageing, the awakening…).
// This is exactly how a player advances, so it exercises both layers together.
function autoLife(seed, maxYears = 800) {
  const rng = new E.RNG(seed);
  const c = L.bornCharacter(rng, "Test " + seed, null);
  let years = 0;
  while (c.alive && c.realm < D.REALMS.length - 1 && years < maxYears) {
    years += 1;
    if (c.awakened && c.root && c.root.key !== "none") {
      for (let d = 0; d < 3 && c.alive; d++) {
        if (E.canBreakthrough(c)) E.attemptBreakthrough(c, rng);
        else E.gainQi(c, rng, 1.0, c.pills > 0);
      }
    }
    if (c.alive) L.ageUp(c, rng);
  }
  return c;
}

/* ------------------------------- tests ----------------------------------- */
function testBirthWellFormed() {
  for (let seed = 0; seed < 300; seed++) {
    const c = L.bornCharacter(new E.RNG(seed), "Born " + seed, null);
    assert(c.root, "root must be set");
    for (const k of ["comprehension", "constitution", "soul", "luck", "charm"])
      assert(c[k] >= 1 && c[k] <= 160, `${k}=${c[k]} out of range`);
    assert(c.maxHp > 0 && c.hp > 0, "hp must be positive");
    assert(c.realm === 0 && c.stage === 0, "a fresh life starts at Mortal");
    assert(c.age === 0, "birth begins at age 0");
    assert(Array.isArray(c.relationships), "must have a family/relationship list");
  }
}

function testNoCrashesOverManyLives() {
  for (let seed = 0; seed < 200; seed++) {
    const c = autoLife(seed);
    assert(c.age >= 0, "age must stay non-negative");
    assert(c.realm >= 0 && c.realm < D.REALMS.length, "realm must stay in range");
    if (!c.alive) assert(c.causeOfDeath, "a dead cultivator must carry a cause of death");
    for (const n of c.relationships)
      assert(n.affinity == null || (n.affinity >= -100 && n.affinity <= 100),
        "NPC affinity must stay within [-100, 100]");
  }
}

function testBirthRandomnessSpreads() {
  const roots = new Set();
  const finalRealms = new Set();
  for (let seed = 0; seed < 250; seed++) {
    roots.add(L.bornCharacter(new E.RNG(seed), "R" + seed, null).root.key);
    finalRealms.add(autoLife(seed).realm);
  }
  assert(roots.size >= 5, `expected a spread of spiritual roots, got ${roots.size}`);
  assert(finalRealms.size >= 3, `expected a spread of final realms, got ${finalRealms.size}`);
}

// The heart of this change: gating must be enforced by the model, however the
// action is reached — not just greyed out in the UI.
function testAgeGatingHolds() {
  // The shared table is the single source of truth, and the UI reads from it.
  assert(D.AGE_MIN && D.ageMin("romance") === D.COMING_OF_AGE, "romance gate is coming-of-age");
  assert(D.ageMin("child") === D.PARENTHOOD_AGE, "childrearing gate is parenthood-age");

  // (1) A child who goes out to mingle never stumbles into a romance.
  for (let seed = 0; seed < 200; seed++) {
    const rng = new E.RNG(seed);
    const c = L.bornCharacter(rng, "Kid " + seed, null);
    c.age = D.ageMin("romance") - 1;          // one year shy of coming-of-age
    for (let i = 0; i < 30; i++) L.mingle(c, rng);
    assert(!c.relationships.some(n => n.role === "companion" && n.alive),
      "a minor must never acquire a dao companion through mingling");
  }

  // (2) Romance-class relationship actions refuse outright below the gate.
  {
    const rng = new E.RNG(99);
    const c = L.bornCharacter(rng, "Youngling", null);
    c.age = D.ageMin("romance") - 1;
    const suitor = { name: "Bai Ling", role: "companion", affinity: 90, alive: true, power: 1 };
    c.relationships.push(suitor);
    for (const action of ["court", "propose", "dual", "trychild"]) {
      const before = L.childrenOf(c).length;
      const out = L.doRelationAction(c, suitor, action, rng).join(" ");
      assert(/too young/i.test(out), `'${action}' must be refused for a minor (got: ${out})`);
      assert(L.childrenOf(c).length === before, "no child may be born to a minor");
      assert(!suitor.married, "marriage must not proceed for a minor");
    }
  }

  // (3) Trying for a child is refused below parenthood age even once wed.
  {
    const rng = new E.RNG(7);
    const c = L.bornCharacter(rng, "Newlywed", null);
    c.age = D.ageMin("child") - 1;
    const spouse = { name: "Spouse", role: "companion", affinity: 90, alive: true, power: 1, married: true };
    c.relationships.push(spouse);
    const out = L.tryForChild(c, spouse, rng).join(" ");
    assert(/too young|of an age/i.test(out), `child-rearing must be refused under ${D.ageMin("child")} (got: ${out})`);
    assert(L.childrenOf(c).length === 0, "no child below parenthood age");
  }

  // (4) Across full auto-played lives, no companion bond ever predates the gate.
  for (let seed = 0; seed < 120; seed++) {
    const rng = new E.RNG(1000 + seed);
    const c = L.bornCharacter(rng, "Life " + seed, null);
    let years = 0;
    while (c.alive && c.realm < D.REALMS.length - 1 && years < 400) {
      years += 1;
      L.ageUp(c, rng);
      if (c.age < D.ageMin("romance"))
        assert(!c.relationships.some(n => n.role === "companion" && n.alive),
          `seed ${seed}: a companion appeared at age ${c.age}, below the romance gate`);
    }
  }
}

// Exercise the larger systems directly (as the Python suite does) so combat,
// cultivation, alchemy, Dao and treasures all stay crash-free and interlock.
function testSystemsInterlock() {
  const rng = new E.RNG(42);
  const c = L.bornCharacter(rng, "Adept", null);
  // Promote to a realm where every system is unlocked.
  c.realm = 6; c.stage = 2;
  c.comprehension = c.soul = c.constitution = 150;
  c.root = { key: "heavenly", name: "Heavenly Root", multiplier: 2.6, purity: 1, elements: ["fire"] };
  E.recomputeMaxHp(c); E.recomputeMaxAge(c); c.hp = c.maxHp;
  c.herbs = 200; c.spiritStones = 5000;

  // Combat against scaled foes must resolve and never leave hp out of range.
  for (let i = 0; i < 30 && c.alive; i++) {
    c.hp = c.maxHp;
    E.fight(c, rng, ["Rogue Cultivator", E.power(c) * 0.5, (c.realm + 1) * 6, "rogue"]);
    assert(c.hp <= c.maxHp, "hp must never exceed maxHp");
  }
  // Wandering the world.
  for (let i = 0; i < 20 && c.alive; i++) { c.hp = c.maxHp; E.adventure(c, rng); }
  // Alchemy never drives herb stock negative.
  for (let i = 0; i < 30 && c.alive; i++) {
    E.refine(c, rng, D.PILL_RECIPES[i % D.PILL_RECIPES.length][0]);
    assert(c.herbs >= 0, "herb stock must never go negative");
  }
  // Dao meditation at high realm.
  for (let i = 0; i < 80 && (c.daos || []).length < 2; i++) E.meditate(c, rng, 1);
  for (const d of (c.daos || [])) assert(D.DAO_BY_KEY[d], "every comprehended Dao must be valid");
  assert(c.realm >= 0 && c.realm < D.REALMS.length, "realm stays in range after the gauntlet");
}

function testReincarnationCarriesLegacy() {
  const rng = new E.RNG(8);
  const old = L.bornCharacter(rng, "Forebear", null);
  old.realm = 7; old.daos = ["sword", "time"]; old.karma = 100;
  const next = L.reincarnateLife(old, rng, "Reborn");
  assert((next.reincarnationCount || next.rebirths || 0) >= 1 || next.realm === 0,
    "a reincarnated soul begins a fresh life");
  assert(next.realm === 0 && next.age === 0, "rebirth starts over at Mortal, age 0");
  assert(next.comprehension >= 1, "legacy never produces an invalid attribute");
}

// 道之境界: a comprehended Dao deepens through tiers, scaling its bonuses and —
// from Great Mastery — manifesting in battle. Legacy saves must migrate cleanly.
function testDaoTiers() {
  // (1) Legacy save (daos but no daoLevels) migrates to tier 1 each.
  const legacy = { daos: ["sword", "void"], daoFocus: "ghost" };
  E.ensureDaos(legacy);
  assert(E.daoTierOf(legacy, "sword") === 1 && E.daoTierOf(legacy, "void") === 1, "migrated Daos default to Glimpsed");
  assert(legacy.daoFocus === null, "a focus on an unheld Dao is cleared on migration");

  // (2) Deeper tiers scale a Dao's power bonus monotonically upward.
  const c = L.bornCharacter(new E.RNG(7), "Sage", null);
  c.realm = E.DAO_MIN_REALM; c.comprehension = c.soul = c.luck = 150;
  c.daos = ["sword"]; c.daoLevels = { sword: 1 }; c.daoFocus = "sword";
  const bonusAt = lvl => { c.daoLevels.sword = lvl; return E.daoPowerBonus(c); };
  assert(bonusAt(2) > bonusAt(1) && bonusAt(3) > bonusAt(2) && bonusAt(4) > bonusAt(3),
    "each Dao tier must raise the power bonus");

  // (3) Focused meditation actually deepens the focused Dao (and never past 圆满).
  c.daoLevels.sword = 1;
  const rng = new E.RNG(3);
  for (let i = 0; i < 400 && E.daoTierOf(c, "sword") < D.DAO_MAX_TIER && c.alive; i++) {
    c.age = 30; c.maxAge = 9999;     // keep the soul alive through the long meditation
    E.meditate(c, rng, 1);
  }
  assert(E.daoTierOf(c, "sword") === D.DAO_MAX_TIER, "focused meditation reaches Consummation");
  c.daoLevels.sword = D.DAO_MAX_TIER + 5;  // even a corrupt level is clamped in scoring
  assert(D.daoTierFactor(c.daoLevels.sword) === D.daoTierFactor(D.DAO_MAX_TIER), "tier factor clamps to the max tier");

  // (4) Battle manifestations only switch on at Great Mastery (tier 3+).
  const lo = (() => { const x = { daos: ["void", "slaughter"], daoLevels: { void: 2, slaughter: 2 } }; return E.daoBattleMods(x); })();
  const hi = (() => { const x = { daos: ["void", "slaughter"], daoLevels: { void: 4, slaughter: 4 } }; return E.daoBattleMods(x); })();
  assert(lo.pierce === 0 && lo.enemyWeaken === 0, "no battle manifestation below Great Mastery");
  assert(hi.pierce > 0 && hi.enemyWeaken > 0, "Great Mastery+ Daos manifest in battle");
}

// Themed Secret Realms (秘境): each archetype must be well-formed, and the
// engine pieces a delve leans on — themed foes, a named guardian and a themed
// treasure drop — must all resolve to valid, realm-attuned objects.
function testSecretRealmThemes() {
  assert(D.SECRET_REALMS.length >= 6, "expected a spread of themed realms");
  const rng = new E.RNG(99);
  const c = L.bornCharacter(rng, "Delver", null);
  c.realm = 5; c.stage = 2; c.comprehension = c.soul = c.constitution = 140; c.awakened = true;
  E.recomputeMaxHp(c); c.hp = c.maxHp;
  const seen = new Set();
  for (const t of D.SECRET_REALMS) {
    assert(t.key && t.name && t.cn && t.element, `theme well-formed: ${t.key}`);
    assert(!seen.has(t.key), `theme keys must be unique (${t.key})`); seen.add(t.key);
    assert(Array.isArray(t.foes) && t.foes.length >= 2, `theme lists foes: ${t.key}`);
    assert(D.SECRET_REALM_BY_KEY[t.key] === t, `theme index resolves: ${t.key}`);
    // A themed stage foe is well-formed and carries the realm's element.
    const foe = C.makeEnemy(c, rng, { kind: t.kind || undefined, name: rng.choice(t.foes), element: t.element, factor: 1.0 });
    assert(foe.power > 0 && foe.element === t.element && t.foes.includes(foe.name), `themed foe carries realm element: ${t.key}`);
    // The named guardian is a proper boss.
    const g = C.makeBoss(c, rng, { name: t.guardian, element: t.element, factor: 1.4 });
    assert(g.boss && g.power > 0 && g.name === t.guardian, `themed guardian resolves: ${t.key}`);
    // A themed drop always resolves to a real treasure (element/slot themed, with fallback).
    const art = E.randomArtifact(c, rng, null, { element: t.element, slot: t.rewardSlot || null });
    assert(D.ARTIFACT_BY_KEY[art], `themed drop is a real treasure: ${t.key}`);
  }
}

// Dao Heart (道心): resolve strengthens the heart-demon ward and battle
// mind-resistance, is tempered by stillness with diminishing returns, and caps.
function testDaoHeartResolve() {
  const rng = new E.RNG(4);
  const c = L.bornCharacter(rng, "Monk", null);
  c.soul = 80; c.comprehension = 80; c.daoHeart = 10;
  const w0 = E.daoHeartWard(c), r0 = E.mentalResist(c);
  c.daoHeart = 90;
  assert(E.daoHeartWard(c) > w0 && E.mentalResist(c) > r0, "Dao Heart strengthens ward and mental resist");
  assert(E.mentalResist(c) <= 0.6, "mental resist stays capped");
  // Stilling raises it toward the cap; a real gain at low resolve.
  c.daoHeart = 10; E.stillHeart(c, rng);
  assert(c.daoHeart - 10 >= 1, "stilling at low resolve yields a real gain");
  c.daoHeart = 95; const before = c.daoHeart; E.stillHeart(c, rng);
  assert(c.daoHeart > before && c.daoHeart <= E.DAO_HEART_MAX, "stilling raises Dao Heart but never past the max");
  c.daoHeart = E.DAO_HEART_MAX; E.stillHeart(c, rng);
  assert(c.daoHeart === E.DAO_HEART_MAX, "a flawless Dao Heart stays at the max");
}

// New alchemy pills permanently raise their attribute, within the usual caps.
function testAlchemyPills() {
  const rng = new E.RNG(6);
  const c = L.bornCharacter(rng, "Alchemist", null);
  c.comprehension = c.charm = c.luck = 50; c.daoHeart = 10;
  for (const key of ["comprehension", "charm", "fortune", "daoheart"]) {
    assert(D.PILL_BY_KEY[key], `new pill recipe exists: ${key}`);
    assert(E.pricePill(c, key) > 0, `pill carries a price: ${key}`);
  }
  const b = { comprehension: c.comprehension, charm: c.charm, luck: c.luck, daoHeart: c.daoHeart };
  E.grantPill(c, "comprehension", rng, 1); E.grantPill(c, "charm", rng, 1);
  E.grantPill(c, "fortune", rng, 1); E.grantPill(c, "daoheart", rng, 1);
  assert(c.comprehension > b.comprehension && c.charm > b.charm && c.luck > b.luck && c.daoHeart > b.daoHeart,
    "attribute pills raise their attribute");
  c.comprehension = 159; E.grantPill(c, "comprehension", rng, 4);
  assert(c.comprehension <= 160, "an attribute pill respects the cap");
}

// Spirit-beast traits: every tamed beast carries a valid innate trait, Devoted
// beasts bond faster, and a trait-bearing high-rank beast fights without error.
function testBeastTraits() {
  assert(D.BEAST_TRAITS.length >= 4, "expected several beast traits");
  const seen = new Set();
  for (let s = 0; s < 60; s++) {
    const r = new E.RNG(s);
    const c = L.bornCharacter(r, "Tamer" + s, null);
    c.beast = null; c.soul = c.charm = c.comprehension = 120;
    E.tryTame(c, "Iron-Fang Wolf", E.power(c) * 0.15, r);
    if (c.beast) { assert(D.BEAST_TRAIT_BY_KEY[c.beast.trait], "a tamed beast carries a valid trait"); seen.add(c.beast.trait); }
  }
  assert(seen.size >= 2, "innate traits vary across tames");
  const bondAfterFeed = trait => {
    const r = new E.RNG(9); const c = L.bornCharacter(r, "B", null); c.herbs = 100;
    c.beast = E.normalizeBeast({ name: "X", species: "Wolf", baseSpecies: "Wolf", element: "Metal", power: 50, bond: 50, rank: 1, exp: 0, fedThisYear: 0, trait, alive: true });
    E.feedBeast(c, r, false); return c.beast.bond;
  };
  assert(bondAfterFeed("devoted") > bondAfterFeed("ferocious"), "a Devoted beast gains more bond per feed");
  const r = new E.RNG(3); const c = L.bornCharacter(r, "Rider", null);
  c.realm = 6; c.stage = 2; c.comprehension = c.soul = c.constitution = 140; c.awakened = true;
  c.root = { key: "heavenly", name: "Heavenly Root", multiplier: 2.6, purity: 1, elements: ["Fire"] };
  E.recomputeMaxHp(c); c.hp = c.maxHp;
  c.beast = E.normalizeBeast({ name: "Bai", species: "Mythic Wolf", baseSpecies: "Wolf", element: "Metal", power: E.power(c) * 0.3, bond: 90, rank: 4, exp: 0, fedThisYear: 0, trait: "ferocious", alive: true });
  const B = C.createBattle(c, C.makeEnemy(c, r, {}), r, {});
  assert(B.player.beastTrait === "ferocious", "combat captures the beast trait");
  let guard = 0;
  while (!B.over && guard++ < 100) { const a = B.actions().find(x => !x.disabled && x.id !== "flee") || B.actions()[0]; B.act(a.id); }
  assert(B.over, "a trait-bearing beast-assisted battle resolves cleanly");
}

// New combat verbs (sunder armour-break, execute) and Movement Arts (轻功)
// manifesting as real battle evasion.
function testCombatVerbsAndMovement() {
  // The three new techniques exist as skills with their new verbs.
  const byTech = t => Object.values(C.SKILLS).find(x => x.tech === t);
  assert(byTech("mountain_render") && byTech("mountain_render").sunder, "Mountain-Splitting Sunder carries the sunder verb");
  assert(byTech("flowing_light") && byTech("flowing_light").sunder && byTech("flowing_light").hits === 2, "Flowing-Light is a multi-hit sunder");
  assert(byTech("soul_reap") && byTech("soul_reap").execute > 1, "Soul-Reaping Scythe carries the execute verb");
  for (const t of ["mountain_render", "flowing_light", "soul_reap"]) assert(D.TECHNIQUES[t], `technique is in the catalogue: ${t}`);

  // Movement dodge scales with tier and mastery, and stays capped.
  const c = L.bornCharacter(new E.RNG(1), "Runner", null);
  assert(E.movementDodge(c) === 0, "no movement art means no battle dodge");
  c.movementArts = ["void_rift"]; c.moveMastery = { void_rift: 0 };
  const untrained = E.movementDodge(c);
  c.moveMastery = { void_rift: 99999 };
  const perfected = E.movementDodge(c);
  assert(perfected > untrained && perfected <= 0.13, "movement dodge rises with mastery and stays capped");

  // Execute lands catastrophically on a foe near death.
  const r = new E.RNG(2); const p = L.bornCharacter(r, "Reaper", null);
  p.realm = 6; p.stage = 2; p.comprehension = p.soul = p.constitution = 140; p.awakened = true;
  p.root = { key: "heavenly", name: "H", multiplier: 2.6, purity: 1, elements: ["Dark"] };
  p.techniques = ["basic_breathing", "soul_reap"]; E.recomputeMaxHp(p); p.hp = p.maxHp;
  const B = C.createBattle(p, C.makeEnemy(p, r, { factor: 3.0 }), r, {});
  B.enemy.hp = B.enemy.maxHp * 0.25;
  const res = B.act("soul_reap");
  assert(res.lines.some(l => /EXECUTE/.test(l)), "execute fires against a foe below the HP threshold");

  // Sunder rends a foe's armour (a debuff appears on the enemy).
  const r2 = new E.RNG(5); const p2 = L.bornCharacter(r2, "Render", null);
  p2.realm = 6; p2.stage = 2; p2.comprehension = p2.soul = p2.constitution = 140; p2.awakened = true;
  p2.root = { key: "heavenly", name: "H", multiplier: 2.6, purity: 1, elements: ["Earth"] };
  p2.techniques = ["basic_breathing", "mountain_render"]; E.recomputeMaxHp(p2); p2.hp = p2.maxHp;
  const B2 = C.createBattle(p2, C.makeEnemy(p2, r2, { factor: 4.0 }), r2, {});
  B2.act("mountain_render");
  assert(B2.enemy.statuses.some(s => s.type === "sunder"), "sunder applies an armour-break debuff to the foe");
}

// The Nemesis Reckoning: a spawned nemesis is a fightable peer, and settling the
// grudge slays them, yields a slayer's title and spoils, and lays the rivalry down.
function testNemesisReckoning() {
  const rng = new E.RNG(11);
  const c = L.bornCharacter(rng, "Avenger", null);
  c.realm = 5; c.stage = 2; c.comprehension = c.soul = c.constitution = 130; c.awakened = true;
  c.root = { key: "heavenly", name: "Heavenly Root", multiplier: 2.6, purity: 1, elements: ["Fire"] };
  E.recomputeMaxHp(c); c.hp = c.maxHp;
  // A nemesis appears via the same path the events use.
  L.makeNemesis ? L.makeNemesis(c, rng, "a stolen inheritance") : null;
  let nem = L.getNemesis(c);
  if (!nem) {  // makeNemesis is module-private; spawn via the event API surface instead
    c.relationships.push({ name: "Gu Hanzhi", role: "nemesis", kin: "Nemesis", affinity: -45, alive: true, element: "Metal", grudge: "a stolen inheritance", encounters: 0, realm: 5 });
    nem = L.getNemesis(c);
  }
  assert(nem && nem.alive, "a nemesis exists and lives");
  // They build into a real boss-tier foe from their own profile.
  const foe = C.makeEnemyFromNpc(c, nem, rng, { boss: true });
  assert(foe.boss && foe.power > 0 && foe.name === nem.name, "the nemesis fights as a boss-tier peer");
  // Settling the score slays them and grants the slayer's title + spoils.
  const titlesBefore = c.titles.length, repBefore = c.reputation;
  const lines = E.defeatNemesis(c, nem, rng);
  assert(!nem.alive, "a defeated nemesis is slain");
  assert(c.titles.some(t => t.startsWith("Nemesis Slain")), "slaying a nemesis grants the slayer's title");
  assert(c.reputation > repBefore && lines.length > 0, "the reckoning yields renown and a narrative");
  assert(L.getNemesis(c) === null, "no living nemesis remains after the reckoning");
}

// Branching dialogue: the authored multi-step conversations must unfold into
// follow-on speaker nodes and resolve every branch to terminal narration —
// no dead ends, no crashes, however the player chooses.
function testDialogueTrees() {
  const isNode = r => r && typeof r === "object" && !Array.isArray(r) && Array.isArray(r.choices);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const mockApi = c => ({
    qi: () => { c.qi = (c.qi || 0) + 1; }, happy: n => { c.happiness = clamp((c.happiness || 50) + n, 0, 100); },
    heal: n => { c.hp = Math.max(1, (c.hp || 1) + n); }, stones: n => { c.spiritStones = Math.max(0, (c.spiritStones || 0) + n); },
    herbs: n => { c.herbs = Math.max(0, (c.herbs || 0) + n); }, karma: n => { c.karma = (c.karma || 0) + n; },
    note: t => c.log.push([c.age, t]), learnTech: () => "Test Manual",
    meet: (role) => ({ name: "Stranger", role, alive: true }), giveArtifact: () => ["  You obtain a treasure: Test!"],
  });
  // Recursively drive every choice of a node (and its sub-nodes) to a terminal.
  const drive = (node, c, rng, A, depth) => {
    assert(depth < 12, "dialogue tree must terminate");
    assert(node.text != null && node.choices.length >= 1, "a node has text and at least one choice");
    for (const ch of node.choices) {
      if (ch.cond && !ch.cond(c)) continue;
      assert(ch.label != null, "every choice is labelled");
      const r = ch.result(c, rng, A);
      if (isNode(r)) drive(r, c, rng, A, depth + 1);
      else assert(typeof r === "string" || Array.isArray(r), "a leaf is terminal narration");
    }
  };
  const ids = ["dlg_hermit", "dlg_devil_bargain", "dlg_captured_rogue", "dlg_merchant_haggle"];
  for (const id of ids) {
    const e = EVENTS.find(x => x.id === id);
    assert(e && e.choices, `dialogue event exists: ${id}`);
    let sawNode = false;
    for (let seed = 0; seed < 8; seed++) {
      const rng = new E.RNG(seed * 17 + 3);
      const c = L.bornCharacter(rng, "Talker", null);
      c.realm = 3; c.awakened = true; c.spiritStones = 200; c.daoHeart = 20;
      const A = mockApi(c);
      for (const ch of e.choices) {
        if (ch.cond && !ch.cond(c)) continue;
        const r = ch.result(c, rng, A);
        if (isNode(r)) { sawNode = true; drive(r, c, rng, A, 1); }
        else assert(typeof r === "string" || Array.isArray(r), "top-level leaf is terminal");
      }
    }
    assert(sawNode, `${id} opens at least one follow-on dialogue node`);
  }
}

// Multi-year storyline arcs: a choice now sets an arc's stage; later beats gate
// on that stage and the years elapsed and branch on what came before, threading
// a coherent saga across a life — with genuinely divergent outcomes.
function testStoryArcs() {
  // Arc-state helpers.
  const h = L.bornCharacter(new E.RNG(1), "Arc", null);
  assert(Ev.arcStage(h, "x") === 0, "an unknown arc reads as stage 0");
  Ev.arcSet(h, "x", 1); assert(Ev.arcStage(h, "x") === 1, "arcSet records the stage");
  h.age += 4; assert(Ev.arcYears(h, "x") === 4, "arcYears tracks elapsed years");
  Ev.arcEnd(h, "x"); assert(Ev.arcStage(h, "x") === 0, "arcEnd clears the arc");

  const mkChar = seed => {
    const rng = new E.RNG(seed); const c = L.bornCharacter(rng, "Hero" + seed, null);
    c.realm = 4; c.stage = 2; c.awakened = true; c.comprehension = c.soul = 140; c.daoHeart = 60; c.age = 30; c.spiritStones = 100;
    if (c.root.key === "none") c.root = { key: "heavenly", name: "H", multiplier: 2.6, purity: 1, elements: ["Metal"], comprehensionBonus: 0, display: "H" };
    E.recomputeMaxHp(c); E.recomputeMaxAge(c); c.hp = c.maxHp; return { c, rng };
  };
  const api = (c, rng) => ({
    qi: () => { c.qi = (c.qi || 0) + 1; }, happy: n => { c.happiness = Math.max(0, Math.min(100, (c.happiness || 50) + n)); },
    heal: n => { c.hp = Math.max(1, (c.hp || 1) + n); }, stones: n => { c.spiritStones = Math.max(0, (c.spiritStones || 0) + n); },
    herbs: n => { c.herbs = Math.max(0, (c.herbs || 0) + n); }, karma: n => { c.karma = (c.karma || 0) + n; }, note: t => c.log.push([c.age, t]),
    learnTech: () => "Test Manual", giveArtifact: g => E.acquireArtifact(c, E.randomArtifact(c, rng, g)),
    power: () => E.power(c), fight: e => E.fight(c, rng, e),
    meet: (role, opts = {}) => { const n = { name: "NPC" + c.relationships.length, role, affinity: opts.affinity != null ? opts.affinity : 20, alive: true, power: 0 }; E.ensureNpcProfile(n, rng, { realm: opts.realm != null ? opts.realm : 0 }); c.relationships.push(n); return n; },
  });
  const ev = id => EVENTS.find(e => e.id === id);
  const choose = (c, rng, A, id, i) => { const e = ev(id); const ch = e.choices.filter(x => !x.cond || x.cond(c))[i]; return ch.result(c, rng, A); };

  // Sword-tomb arc, heir path: accept → temper → forge → mastery (a sword art).
  { const { c, rng } = mkChar(11); const A = api(c, rng);
    assert(ev("swordtomb_start").cond(c), "the sword-tomb opener is eligible");
    choose(c, rng, A, "swordtomb_start", 0); assert(Ev.arcStage(c, "swordtomb") === 1, "accepting the transmission advances to stage 1");
    c.age += 3; assert(ev("swordtomb_trial").cond(c), "the trial beat comes due after the years pass");
    choose(c, rng, A, "swordtomb_trial", 1); assert(Ev.arcStage(c, "swordtomb") === 2, "tempering advances to stage 2");
    c.age += 3; assert(ev("swordtomb_master").cond(c), "the mastery beat comes due");
    const before = c.techniques.length; choose(c, rng, A, "swordtomb_master", 0);
    assert(Ev.arcStage(c, "swordtomb") === 99, "the sword-tomb arc resolves");
    assert(c.techniques.length > before, "mastering the inheritance teaches a sword art");
  }
  // Virtuous fork ends the arc at once and differently (karma, not a technique).
  { const { c, rng } = mkChar(12); const A = api(c, rng); const k = c.karma;
    choose(c, rng, A, "swordtomb_start", 1);
    assert(Ev.arcStage(c, "swordtomb") === 99 && c.karma > k, "the clean-death fork ends the arc with merit");
  }
  // Foundling arc: take in → neglect → a bitter ward becomes a nemesis.
  { const { c, rng } = mkChar(13); const A = api(c, rng);
    choose(c, rng, A, "foundling_start", 0);
    assert(Ev.arcStage(c, "foundling") === 1, "taking in the ward advances to stage 1");
    const ward = c.relationships.find(n => n.arcTag === "foundling"); assert(ward, "the ward is created and tagged for later beats");
    c.age += 3; choose(c, rng, A, "foundling_raise", 2);
    assert(ward.affinity < 40, "neglect erodes the ward's affinity");
    ward.affinity = -40;
    c.age += 3; choose(c, rng, A, "foundling_grown", 0);
    assert(Ev.arcStage(c, "foundling") === 99 && ward.role === "nemesis", "a neglected ward can grow into a nemesis");
  }
  // Foundling arc, kind path: a treasured ward becomes a devoted disciple.
  { const { c, rng } = mkChar(14); const A = api(c, rng);
    choose(c, rng, A, "foundling_start", 0); const ward = c.relationships.find(n => n.arcTag === "foundling");
    c.age += 3; choose(c, rng, A, "foundling_raise", 0);
    c.age += 3; choose(c, rng, A, "foundling_grown", 0);
    assert(ward.role === "disciple", "a kindly-raised ward becomes a disciple");
  }
  // A due storyline beat is drawn with priority by the year-roller.
  { const { c, rng } = mkChar(15); const A = api(c, rng); Ev.arcSet(c, "swordtomb", 1); c.age += 3;
    const out = Ev.rollYearEvents(c, rng, A);
    assert(out.some(o => { const e = ev(o.id); return e && e.arc; }), "a due arc beat is prioritised in the yearly roll");
  }
}

// Action-triggered arcs: deeds arm an opener (at a chance, or with certainty),
// which then fires gated by age/realm — and each new arc threads to its end.
function testTriggeredArcs() {
  // Arm / disarm mechanics.
  const c = L.bornCharacter(new E.RNG(1), "A", null);
  assert(!E.arcArmed(c, "x"), "nothing is armed at first");
  assert(E.armArc(c, "x", new E.RNG(1), 1) === true && E.arcArmed(c, "x"), "armArc with certainty arms the opener");
  assert(E.armArc(c, "x", new E.RNG(1), 1) === false, "armArc will not double-arm");
  E.disarmArc(c, "x"); assert(!E.arcArmed(c, "x"), "disarmArc clears it");
  assert(E.armArc(c, "y", new E.RNG(1), 0) === false, "a zero chance never arms");
  Ev.arcSet(c, "z", 1); assert(E.armArc(c, "z", null, 1) === false, "an arc already underway cannot be re-armed");

  const mk = seed => {
    const rng = new E.RNG(seed); const cc = L.bornCharacter(rng, "H" + seed, null);
    cc.realm = 5; cc.stage = 2; cc.awakened = true; cc.comprehension = cc.soul = cc.constitution = 150; cc.daoHeart = 80; cc.age = 40; cc.spiritStones = 300; cc.herbs = 50; cc.alchemySkill = 60;
    if (cc.root.key === "none") cc.root = { key: "heavenly", name: "H", multiplier: 2.6, purity: 1, elements: ["Metal"], comprehensionBonus: 0, display: "H" };
    E.recomputeMaxHp(cc); E.recomputeMaxAge(cc); cc.hp = cc.maxHp; return { c: cc, rng };
  };
  const api = (c, rng) => ({ qi: () => {}, happy: () => {}, heal: n => { c.hp = Math.max(1, c.hp + n); }, stones: n => { c.spiritStones = Math.max(0, c.spiritStones + n); }, herbs: n => { c.herbs = Math.max(0, c.herbs + n); }, karma: n => { c.karma = (c.karma || 0) + n; }, note: () => {}, learnTech: () => "M", giveArtifact: g => E.acquireArtifact(c, E.randomArtifact(c, rng, g)), power: () => E.power(c), fight: e => E.fight(c, rng, e), meet: () => ({ name: "n", alive: true }) });
  const ev = id => EVENTS.find(e => e.id === id);
  const choose = (c, rng, A, id, i) => { const e = ev(id); const ch = e.choices.filter(x => !x.cond || x.cond(c))[i]; return ch.result(c, rng, A); };

  // Soul-poison: arm → opener auto → demonic remedy ends it at a karmic cost.
  { const { c, rng } = mk(21); const A = api(c, rng); E.armArc(c, "soulpoison", rng, 1);
    assert(ev("soulpoison_start").cond(c), "an armed soul-poison opener is eligible");
    ev("soulpoison_start").auto(c, rng, A);
    assert(Ev.arcStage(c, "soulpoison") === 1 && !E.arcArmed(c, "soulpoison"), "the opener advances to stage 1 and disarms itself");
    c.age += 1; assert(ev("soulpoison_seek").cond(c), "the cure-seeking beat is due");
    const k = c.karma; choose(c, rng, A, "soulpoison_seek", 2);
    assert(Ev.arcStage(c, "soulpoison") === 99 && c.karma < k, "the demonic remedy cures the poison at a karmic cost");
  }
  // Soul-poison deadline: after six uncured years the lethal crisis beat is due.
  { const { c, rng } = mk(22); E.armArc(c, "soulpoison", rng, 1); ev("soulpoison_start").auto(c, rng, api(c, rng)); c.age += 6;
    assert(!ev("soulpoison_seek").cond(c) && ev("soulpoison_crisis").cond(c), "past the deadline the crisis supersedes the cure beats");
  }
  // Real combat trigger: fighting demonic foes can arm the soul-poison arc.
  { let armed = false;
    for (let s = 0; s < 40 && !armed; s++) {
      const { c, rng } = mk(100 + s);
      const foe = C.makeEnemy(c, rng, { kind: "rogue", name: "Corpse Refiner", element: "Dark", factor: 1.2 });
      const B = C.createBattle(c, foe, rng, {}); let g = 0;
      while (!B.over && g++ < 80) { const a = B.actions().find(x => !x.disabled && x.id !== "flee") || B.actions()[0]; B.act(a.id); }
      B.finish();
      if (E.arcArmed(c, "soulpoison") || (c.arcs && c.arcs.soulpoison)) armed = true;
    }
    assert(armed, "battling demonic foes can inflict the soul-poison");
  }

  // Master tutelage: arm → accept → diligent trial → graduation teaches Great Void.
  { const { c, rng } = mk(23); const A = api(c, rng); E.armArc(c, "tutelage", rng, 1);
    assert(ev("tutelage_start").cond(c), "an armed master opener is eligible");
    choose(c, rng, A, "tutelage_start", 0); assert(Ev.arcStage(c, "tutelage") === 1, "accepting begins the apprenticeship");
    c.age += 2; choose(c, rng, A, "tutelage_trial", 0); assert(Ev.arcStage(c, "tutelage") === 2, "the trial advances to stage 2");
    c.age += 2; choose(c, rng, A, "tutelage_graduation", 0);
    assert(Ev.arcStage(c, "tutelage") === 99 && c.techniques.includes("great_void"), "a diligent student inherits the Great Void Immortal Canon");
  }
  // Studying with exceptional comprehension certainly draws a hidden master.
  { const { c, rng } = mk(24); c.comprehension = 140;
    L.studyScriptures(c, rng);
    assert(E.arcArmed(c, "tutelage") || (c.arcs && c.arcs.tutelage), "diligent, gifted study arms the master arc");
  }
  // Beast-King: a worthy beast makes the opener eligible; the arc empowers it.
  { const { c, rng } = mk(25); const A = api(c, rng);
    c.beast = E.normalizeBeast({ name: "Bai", species: "Cloud Leopard", baseSpecies: "Cloud Leopard", element: "Wind", power: E.power(c) * 0.3, bond: 90, rank: 2, exp: 0, fedThisYear: 0, trait: "ferocious", alive: true });
    assert(ev("beastking_start").cond(c), "a worthy beast makes the Beast-King opener eligible");
    choose(c, rng, A, "beastking_start", 0); assert(Ev.arcStage(c, "beastking") === 1, "answering the summons begins the arc");
    c.age += 2; choose(c, rng, A, "beastking_trial", 0); assert(Ev.arcStage(c, "beastking") === 2, "the trial advances the arc");
    const before = c.beast.power; c.age += 2; choose(c, rng, A, "beastking_boon", 0);
    assert(Ev.arcStage(c, "beastking") === 99 && c.beast.power > before, "the Beast-King's boon empowers your companion");
  }
}

/* ------------------------------- runner ---------------------------------- */
console.log("The Nine Heavens — web build tests\n");
try {
  test("birth is well-formed", testBirthWellFormed);
  test("no crashes over many lives", testNoCrashesOverManyLives);
  test("birth randomness spreads fates", testBirthRandomnessSpreads);
  test("age-appropriate gating holds at the model layer", testAgeGatingHolds);
  test("large systems interlock without crashing", testSystemsInterlock);
  test("reincarnation carries a legacy", testReincarnationCarriesLegacy);
  test("Daos deepen through tiers and manifest in battle", testDaoTiers);
  test("Secret Realms are themed and their pieces resolve", testSecretRealmThemes);
  test("Dao Heart tempers resolve, ward and battle nerve", testDaoHeartResolve);
  test("new alchemy pills raise their attributes within caps", testAlchemyPills);
  test("spirit beasts carry traits that shape feeding and battle", testBeastTraits);
  test("new combat verbs (sunder, execute) and movement-art evasion", testCombatVerbsAndMovement);
  test("the Nemesis Reckoning settles a rivalry with spoils", testNemesisReckoning);
  test("branching dialogue events resolve every path to a terminal", testDialogueTrees);
  test("multi-year storyline arcs thread and branch across the years", testStoryArcs);
  test("action-triggered arcs arm sensibly and thread to their ends", testTriggeredArcs);
  console.log(`\nAll ${passed} web tests passed.`);
} catch (err) {
  console.error("\n✗ " + err.message);
  console.error(err.stack);
  process.exit(1);
}
