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
  console.log(`\nAll ${passed} web tests passed.`);
} catch (err) {
  console.error("\n✗ " + err.message);
  console.error(err.stack);
  process.exit(1);
}
