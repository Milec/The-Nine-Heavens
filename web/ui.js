/* The Nine Heavens -- BitLife-style life-sim UI controller. */
import * as E from "./engine.js";
import * as D from "./data.js";
import * as L from "./life.js";
import * as C from "./combat.js";
import * as meta from "./meta.js";
import * as W from "./world.js";
import { icon } from "./icons.js";

/* Plain-language explanations for every stat, shown as tap hints + a glossary. */
const GLOSSARY = {
  age: ["Age", "Your years lived, and your lifespan ceiling. Reaching a new realm extends how long you can live."],
  deeds: ["Deeds", "Each year you have three separate budgets of deeds — Cultivation, Activities and Social — three of each. They never pass time; only Age Up passes a year, fires life events, and refreshes all your deeds."],
  cultivation: ["Cultivation (Qi)", "Progress toward your next stage. Fills as you cultivate; at a realm's peak you attempt a breakthrough to the next realm."],
  power: ["Power ✦", "Your overall combat strength, drawn from your realm, body, soul, techniques, bound treasure, beast and Daos."],
  health: ["Health", "Your physical condition (0–100). Wounds and illness lower it; rest, pills and spirit springs restore it. Hit zero and you die."],
  happiness: ["Happiness", "Your state of mind (0–100). A serene heart steadies breakthroughs; deep misery invites the heart-demon."],
  comprehension: ["Comprehension 悟性", "How quickly you grasp the dao. Speeds cultivation, eases breakthroughs, and quickens Dao insight. An ordinary mortal sits near 50 (Apt); the banner names your tier, from Dull up to Sage-Minded."],
  constitution: ["Constitution 根骨", "Bodily strength. More battle stamina and damage-reduction, and a sturdier resistance to death. An ordinary mortal sits near 50 (Hardy); tiers run Frail up to Indestructible."],
  soul: ["Soul Sense 神识", "Spiritual perception. A larger combat qi pool, better dodge, faster Dao insight, and stronger tribulation defence. An ordinary mortal sits near 50 (Aware); tiers run Dim up to Heaven-Spanning."],
  fortune: ["Fortune 气运", "Luck. Quietly nudges crits, dodges, lucky finds, and clutch escapes from death. An ordinary mortal sits near 50 (Favoured); tiers run Cursed up to Heaven-Chosen."],
  charm: ["Charm 魅力", "Social grace. Helps you make friends, draw a dao companion, and sway elders and foes alike. An ordinary mortal sits near 50 (Comely); tiers run Plain up to Nation-Toppling."],
  karma: ["Karma 业力", "Merit versus sin. Merit softens the Heavenly Tribulation; deep sin summons a heart-demon and bounty hunters."],
  fame: ["Fame 声望", "How the cultivation world regards your name — Unknown up to Legendary. Fame draws invitations and gifts; infamy brings hunters."],
  monikers: ["Monikers 名号", "Names the world hangs on you, earned through your dao, deeds, fame and nature — a Sword Immortal, a Pill Sage, a Devil Sovereign. Greater fame unlocks grander names; the grandest you hold is how the world speaks of you, shown beneath your name."],
  stones: ["Spirit Stones 灵石", "The currency of cultivators. Spend them at the Market on herbs, pills, technique manuals and treasures, on your cave abode and sect, or at auctions. Market prices float with the world era."],
  herbs: ["Spirit Herbs 灵草", "Raw materials gathered in the wild and refined into pills at the alchemy furnace."],
  region: ["Location 所在", "Where you stand in the realm. The world is a map of places — cities and towns to trade, sect seats, wilds to hunt, ruins to delve. Travel outward (from Commerce) and the lands grow deadlier — and far richer. Your current place sets the danger of every fight."],
  era: ["World Era 天时", "The age the realm is passing through. An Age of Abundance quickens cultivation and calms the roads; a Warring Era or Demon Tide makes the world far deadlier; a Spiritual Drought stifles all qi; a Dawn of Ascension eases breakthroughs. The world turns on across your reincarnations."],
  wanted: ["Wanted", "Low standing or heavy sin puts a price on your head; bounty hunters will hunt you down."],
  breakthrough: ["Breakthrough", "You stand at a realm wall. Attempt it from the Cultivate tab to ascend — risky, and from Golden Core up it summons a Heavenly Tribulation."],
  root: ["Spiritual Root 灵根", "Your innate talent for cultivation — the single biggest factor in how far you can ever climb. Revealed at the age-6 Awakening."],
  physique: ["Physique 体质", "Your body's nature. Special physiques grant lasting boons to cultivation, combat, healing or survival (see your sheet)."],
  realm: ["Realm 境界", "Your cultivation stage — from Mortal up the eleven realms to Immortal Ascension. Each realm lengthens your lifespan."],
  abode: ["Cave Abode 洞府", "A home base staked on a spirit vein. Each year it yields spirit herbs and stones and quickens your cultivation; you can also seal yourself inside for a deep seclusion. Build and upgrade it from Activities."],
  body: ["Body Cultivation 炼体", "A path parallel to qi: temper your flesh into something monstrous. It needs no spiritual root — the salvation of the rootless — and stacks atop qi cultivation. Driven by Constitution and physique, it grants raw power, stamina, damage-reduction and long life. Temper it from the Cultivate tab."],
};
function showTip(key) {
  const g = GLOSSARY[key]; if (!g) return;
  let t = $("tip");
  if (!t) { t = el("div"); t.id = "tip"; ($("app") || document.body).appendChild(t); t.addEventListener("click", () => t.classList.remove("show")); }
  t.innerHTML = `<b>${escapeHtml(g[0])}</b><br>${escapeHtml(g[1])}<div class="tip-x">tap to dismiss</div>`;
  t.classList.add("show");
  clearTimeout(state.tipTimer); state.tipTimer = setTimeout(() => t.classList.remove("show"), 7000);
}

const regionMult = c => (D.REGION_BY_KEY[c.region || "azuredomain"] || [, , , 1])[3] || 1;
// Combat danger combines where you are (region) with when you live (world era).
const eraDanger = c => D.eraAt(c.era)[5];
const worldDanger = c => regionMult(c) * eraDanger(c);
// A combatant: a qi cultivator, or a body cultivator who has tempered past mortal.
const isCultivator = c => c.awakened && (c.root.key !== "none" || (c.bodyRealm || 0) >= 1);
// Strong enough for bosses / secret realms: Foundation+ in qi, or Steel Bone+ in body.
const isStrong = c => c.realm >= 2 || (c.bodyRealm || 0) >= 3;
function applyFavor(c) {
  const f = meta.favor();
  if (f > 0) {
    c.comprehension = Math.min(160, c.comprehension + Math.min(15, f));
    c.luck = Math.min(160, c.luck + Math.min(10, Math.floor(f / 2)));
  }
  // Each past Ascension echoes down the ages, gifting future souls greater talent.
  const asc = meta.stat("ascensions");
  if (asc > 0) {
    c.comprehension = Math.min(160, c.comprehension + Math.min(20, asc * 4));
    c.soul = Math.min(160, c.soul + Math.min(15, asc * 3));
    c.luck = Math.min(160, c.luck + Math.min(15, asc * 3));
  }
  return f;
}
function award(id) { const a = meta.unlock(id); if (a) logMessages([`🏆 Achievement unlocked — ${a[1]}: ${a[2]}`]); }
function checkAchievements() {
  const c = state.c; if (!c) return;
  if (c.realm >= 3) award("foundation");
  if (c.realm >= 4) award("golden");
  if (c.realm >= 5) award("nascent");
  if (c.realm >= 10) award("ascend");
  if (c.reputation >= 180) award("legendary");
  if (c.karma <= -120) award("devil");
  if (c.karma >= 120) award("saint");
  if (c.daos && c.daos.length) award("daoist");
  if (c.beast) award("tamer");
  const spouses = c.relationships.filter(n => n.role === "companion" && n.married && n.alive).length;
  if (spouses >= 1) award("companion");
  if (spouses >= 3) award("harem");
  if (c.relationships.filter(n => (n.kin === "Son" || n.kin === "Daughter") && n.alive).length >= 5) award("dynasty");
  if ((c.generation || 1) > 1) award("bloodline");
  if ((c.bodyRealm || 0) >= 5) { award("bodysaint"); if (c.root && c.root.key === "none") award("rootless_legend"); }
  if (c.reincarnationCount >= 5) award("eternal");
  if (c.sectKey && c.sectRank >= D.SECT_RANKS.length - 1) award("sectmaster");
  const t = c.titles || [];
  if (t.some(x => x.startsWith("Nemesis Slain"))) award("nemesis");
  if (t.includes("Tournament Champion")) award("champion");
  if (t.includes("Secret Realm Delver")) award("delver");
  if (t.some(x => x.startsWith("Slayer of"))) award("bossslayer");
  const taught = (c.relationships || []).reduce((a, n) => a + ((n.learned && n.learned.length) || 0), 0);
  if (taught >= 5) award("patriarch");
}

const STORAGE_KEY = "nineheavens.save.v3";
const state = { c: null, rng: null, deadHandled: false, overlayClosable: true };

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const escapeHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clampPct = (a, b) => b <= 0 ? 0 : Math.max(0, Math.min(100, (a / b) * 100));

/* ----------------------------- persistence ------------------------------- */
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ c: state.c, s: state.rng.s })); } catch (e) {} }
function loadSave() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

/* ------------------------------ log feed --------------------------------- */
function classify(text) {
  const t = text.trim(), cl = [];
  if (text.startsWith("  ") || text.startsWith("   ")) cl.push("sub");
  if (t.includes("☠") || t.startsWith("✗")) cl.push("bad");
  else if (t.includes("BREAKTHROUGH") || t.startsWith("☯") || t.includes("✦") || t.startsWith("⮝")) cl.push("epic");
  else if (t.startsWith("⚡") || t.startsWith("Wave") || t.includes("Wave ")) cl.push("trib");
  else if (t.startsWith("👁")) cl.push("demon");
  return cl.join(" ");
}
function logMessages(msgs) {
  if (!msgs) return;
  if (typeof msgs === "string") msgs = [msgs];
  const log = $("log"), turn = el("div", "turn");
  for (const m of msgs) {
    if (m === "") turn.appendChild(el("div", "line spacer"));
    else turn.appendChild(el("div", "line " + classify(m), escapeHtml(m)));
  }
  log.appendChild(turn); log.scrollTop = log.scrollHeight;
}
function logBanner(html) { const log = $("log"), t = el("div", "turn"); t.appendChild(el("div", "banner", html)); log.appendChild(t); log.scrollTop = log.scrollHeight; }
function logYear(age) { const log = $("log"), t = el("div", "turn"); t.appendChild(el("div", "year-tag", `❖ Age ${age}`)); log.appendChild(t); log.scrollTop = log.scrollHeight; }

/* ---------------------- automatic stat-change readout -------------------- *
 * Rather than instrument every place a stat is touched, we snapshot the
 * meaningful stats and, on each profile render (which follows every action and
 * every aged-up year), log exactly what changed and by how much. Object
 * identity baselines silently whenever a new life begins, so no spurious lines. */
const TRACKED_STATS = [
  ["comprehension", "Comprehension"], ["constitution", "Constitution"], ["soul", "Soul Sense"],
  ["luck", "Fortune"], ["charm", "Charm"], ["alchemySkill", "Alchemy"],
  ["reputation", "Fame"], ["karma", "Karma"],
];
function snapStats(c) { const s = {}; for (const [k] of TRACKED_STATS) s[k] = Math.round(c[k] || 0); return s; }
function reportStatChanges(c) {
  if (!c) return;
  if (state.prevStatsOwner !== c) { state.prevStats = snapStats(c); state.prevStatsOwner = c; return; }
  const prev = state.prevStats, now = snapStats(c);
  const lines = [];
  for (const [k, label] of TRACKED_STATS) {
    const d = (now[k] || 0) - (prev[k] || 0);
    if (!d) continue;
    const up = d > 0;
    lines.push(`${up ? "▲" : "▼"} ${label} ${up ? "+" : ""}${d} (now ${now[k]})`);
  }
  state.prevStats = now;
  if (lines.length) {
    const log = $("log"); if (!log) return;
    const t = el("div", "turn stat-turn");
    for (const ln of lines) t.appendChild(el("div", "line stat " + (ln[0] === "▲" ? "up" : "down"), escapeHtml(ln)));
    log.appendChild(t); log.scrollTop = log.scrollHeight;
  }
}

/* ------------------------------ profile ---------------------------------- */
function vbar(label, val, max, cls, valText, tip) {
  return `<div class="vbar${tip ? " tappable" : ""}"${tip ? ` data-tip="${tip}"` : ""}><div class="vb-label"><span>${label}</span><span>${valText != null ? valText : Math.floor(val)}</span></div>
    <div class="vb-track"><div class="vb-fill ${cls}" style="width:${clampPct(val, max)}%"></div></div></div>`;
}
/* The interface's accent colour follows the soul's nature: jade-gold for the
 * righteous, amethyst then cinnabar as karma turns toward the demonic dao. */
const KARMA_THEMES = ["k-saint", "k-virtuous", "k-neutral", "k-tainted", "k-demonic"];
function karmaTheme(k) {
  if (k >= 70) return "k-saint";
  if (k >= 25) return "k-virtuous";
  if (k <= -70) return "k-demonic";
  if (k <= -25) return "k-tainted";
  return "k-neutral";
}
function applyKarmaTheme(c) {
  const cls = karmaTheme(c ? c.karma || 0 : 0);
  const b = document.body;
  for (const t of KARMA_THEMES) b.classList.toggle(t, t === cls);
}

function renderProfile() {
  const c = state.c;
  applyKarmaTheme(c);
  $("pf-avatar").innerHTML = D.avatarFor(c);
  $("pf-name").textContent = c.name + (c.reincarnationCount ? `  ·  ☯${c.reincarnationCount}` : "");
  // The sub-line shows realm + standing — or, once the world has named you, the
  // grandest moniker you hold (the world's name for you) ahead of your realm.
  const ep = E.activeEpithet(c);
  if (ep) {
    const standing = c.awakened ? E.realmLabel(c) : `Unawakened ${c.sex === "female" ? "girl" : "boy"}`;
    $("pf-sub").innerHTML = `<span class="pf-epithet">「${escapeHtml(ep.text)}」</span> · ${escapeHtml(standing)}`;
  } else {
    const sub = !c.awakened
      ? `Unawakened ${c.sex === "female" ? "girl" : "boy"} · ${c.backgroundName.split(" (")[0]}`
      : `${E.realmLabel(c)} · ${c.sectKey ? E.rankName(c).split(" (")[0] : "Rogue Cultivator"}`;
    $("pf-sub").textContent = sub;
  }

  const bars = [];
  if (c.awakened && c.root.key !== "none")
    bars.push(vbar("Cultivation", c.qi, E.qiToNext(c), "qi", `${Math.floor(clampPct(c.qi, E.qiToNext(c)))}%`, "cultivation"));
  bars.push(vbar("Health", c.health, 100, "health", null, "health"));
  bars.push(vbar("Happiness", c.happiness, 100, "happy", null, "happiness"));
  $("pf-bars").innerHTML = bars.join("");

  // The innate-attribute banner: each number read as a tier relative to a
  // mortal, with a custom glyph and a colour that tracks how rare it is.
  const attrs = $("pf-attrs");
  if (attrs) {
    attrs.innerHTML = "";
    const ATTR_ROW = [
      ["comprehension", "comprehension", "comprehension"],
      ["constitution", "constitution", "constitution"],
      ["soul", "soul", "soul"],
      ["luck", "fortune", "fortune"],
      ["charm", "charm", "charm"],
    ];
    for (const [field, ico, tip] of ATTR_ROW) {
      const val = c[field];
      const t = D.attrTier(field, val);
      const tile = el("div", "attr-tile " + D.attrTierClass(t.idx));
      tile.innerHTML = `${icon(ico, { size: 17 })}<span class="at-name">${t.name}</span><span class="at-num">${val}</span>`;
      tile.onclick = () => showTip(tip);
      attrs.appendChild(tile);
    }
  }

  const chips = $("pf-chips"); chips.innerHTML = "";
  const add = (label, val, cls, tip) => { const ch = el("span", "chip" + (cls ? " " + cls : "") + (tip ? " tappable" : ""), `${label} <b>${val}</b>`); if (tip) ch.onclick = () => showTip(tip); chips.appendChild(ch); };
  add("Age", `${c.age}/${c.maxAge}`, "", "age");
  // One compact deeds chip: the three yearly budgets side by side.
  {
    const parts = ["cult", "act", "social"].map(cat => {
      const n = deedsLeft(cat);
      return `<span class="dg">${DEED_ICON[cat]}<span class="dp">${"●".repeat(n)}${"○".repeat(Math.max(0, DEEDS_PER_CAT - n))}</span></span>`;
    }).join("");
    const allSpent = ["cult", "act", "social"].every(cat => deedsLeft(cat) <= 0);
    const ch = el("span", "chip deeds-chip tappable" + (allSpent ? " warn" : ""), parts);
    ch.onclick = () => showTip("deeds");
    chips.appendChild(ch);
  }
  if (c.awakened) add(icon("power", { size: 13, cls: "chip-ic" }), Math.floor(E.power(c)), "", "power");
  add("Fame", D.standingLabel(c.reputation), c.reputation >= 90 ? "good" : c.reputation <= -12 ? "bad" : "", "fame");
  add("Karma", `${c.karma >= 0 ? "+" : ""}${c.karma}`, c.karma >= 40 ? "good" : c.karma <= -40 ? "bad" : "", "karma");
  add(icon("stones", { size: 13, cls: "chip-ic" }), c.spiritStones, "", "stones");
  if (c.herbs) add(icon("herbs", { size: 13, cls: "chip-ic" }), c.herbs, "", "herbs");
  { const hl = W.currentLoc(c); if (hl) add(icon(W.typeOf(hl).icon, { size: 13, cls: "chip-ic" }), escapeHtml(hl.name), "", "region"); }
  if (c.era) add("☷", D.eraAt(c.era)[2], D.eraAt(c.era)[5] > 1.2 ? "bad" : D.eraAt(c.era)[4] > 1.1 ? "good" : "", "era");
  if (c.reputation <= -25 || c.karma <= -60) add("⚠ Wanted", "bounties", "bad", "wanted");
  if (c.ascended) add("✸", "Ascended Immortal", "good", "realm");
  if (c.awakened && E.canBreakthrough(c)) add("⚑ Breakthrough", `${Math.floor(E.breakthroughChance(c) * 100)}%`, "warn", "breakthrough");

  const ageTab = $("tabbar").querySelector(".tab-age");
  ageTab.classList.toggle("ready", c.awakened && E.canBreakthrough(c));
  const allSpent = ["cult", "act", "social"].every(cat => deedsLeft(cat) <= 0);
  ageTab.classList.toggle("spent", allSpent && c.alive);
  reportStatChanges(c);
  save();
  checkAchievements();
}

/* ------------------------------ overlays --------------------------------- */
function openOverlay(title, build, closable = true) {
  $("overlay-title").textContent = title;
  const body = $("overlay-body"); body.innerHTML = "";
  $("overlay-close").style.display = closable ? "" : "none";
  state.overlayClosable = closable;
  build(body);
  $("overlay").classList.remove("hidden");
}
function closeOverlay() { $("overlay").classList.add("hidden"); }

/* ----------------------- time model: deeds per year ---------------------- *
 * Only Age Up advances the year. Other actions are instantaneous but limited
 * to a few "deeds" per year so you can't do everything at once. Deeds are split
 * into three separate budgets — Cultivation, Activities and Social — so a year
 * of training doesn't crowd out adventuring or tending your relationships. */
const DEEDS_PER_CAT = 3;
const DEED_LABEL = { cult: "Cultivation", act: "Activities", social: "Social" };
const DEED_ICON = {
  cult: icon("deedCult", { size: 13, cls: "chip-ic" }),
  act: icon("deedAct", { size: 13, cls: "chip-ic" }),
  social: icon("deedSocial", { size: 13, cls: "chip-ic" }),
};
const defaultDeeds = () => ({ cult: DEEDS_PER_CAT, act: DEEDS_PER_CAT, social: DEEDS_PER_CAT });
const deedsLeft = cat => (state.deeds && state.deeds[cat] != null) ? state.deeds[cat] : DEEDS_PER_CAT;

/* Reasonable minimum ages for certain endeavours (a 6-year-old shouldn't be
 * raiding Secret Realms or travelling the world alone). */
const AGE_MIN = {
  train: 4, study: 5, spar: 6, oddjobs: 10, alchemy: 10, wander: 12, hunt: 12, arena: 12,
  duel: 12, quest: 12, mingle: 12, travel: 14, tournament: 14, romance: 16,
  boss: 16, secret: 16, disciple: 18,
};
// True if old enough; otherwise emits a note and returns false.
function ageAllows(key) {
  const min = AGE_MIN[key] || 0;
  if (state.c.age >= min) return true;
  closeOverlay();
  logMessages([`You are too young for that yet — you must be at least ${min}.`]);
  renderProfile();
  return false;
}

function useAction(cat = "act") {
  if (!state.c || !state.c.alive) return false;
  if (!state.deeds) state.deeds = defaultDeeds();
  if (deedsLeft(cat) <= 0) {
    closeOverlay();
    logMessages([`· You have used all your ${DEED_LABEL[cat]} deeds this year. Tap ⊕ Age Up to let a year pass — or spend a different kind of deed. ·`]);
    renderProfile();
    return false;
  }
  state.deeds[cat] = deedsLeft(cat) - 1;
  return true;
}
// Spend several deeds of a kind at once (a long journey eats more of the year).
function spendDeeds(cat, n) {
  if (!state.deeds) state.deeds = defaultDeeds();
  state.deeds[cat] = Math.max(0, deedsLeft(cat) - n);
}
// Run an effect without letting it advance the year (undo any internal aging).
function preserveAge(fn) {
  const c = state.c, a = c.age, wasAlive = c.alive;
  const r = fn();
  if (c.age !== a) c.age = a;
  if (wasAlive && !c.alive && /old age|lifespan/.test(c.causeOfDeath || "")) { c.alive = true; c.causeOfDeath = ""; }
  return r;
}
/* a deed: costs one of the year's actions; never ages you */
function runTimed(fn, cat = "act") {
  if (!useAction(cat)) return;
  const msgs = preserveAge(fn);
  closeOverlay();
  logMessages(msgs && msgs.length ? msgs : ["You spend a season in focused effort."]);
  renderProfile(); checkDeath();
}
/* a free, instantaneous action (decisions, admin, social) — no deed, no year */
function runFree(fn) {
  if (!state.c.alive) return;
  const msgs = preserveAge(fn);
  closeOverlay();
  if (msgs && msgs.length) logMessages(msgs);
  renderProfile(); checkDeath();
}
// Run an action that mutates state but keeps the current overlay open
// (e.g. equipping a treasure), logging any feedback behind the overlay.
function runQuiet(fn) { const msgs = preserveAge(fn); if (msgs && msgs.length) logMessages(msgs); }

/* ------------------------------- age up ---------------------------------- */
function doAgeUp() {
  if (!state.c.alive) { startOrDeath(); return; }
  closeOverlay();
  const { events } = L.ageUp(state.c, state.rng);
  state.deeds = defaultDeeds();   // a fresh year, fresh deeds
  logYear(state.c.age);
  if (!events.length) logMessages([idleFlavor()]);
  processQueue(events.slice());
}
function idleFlavor() {
  const c = state.c;
  const opts = c.awakened
    ? ["A quiet year of cultivation passes; your qi deepens by degrees.",
       "You drill, you breathe, you meditate. The seasons turn.",
       "Nothing of note — just the long, patient work of the dao."]
    : ["A year of childhood passes — chores, games, and growing.",
       "You help around the home and dream of immortals.",
       "Another year older; the world stays small and close."];
  return opts[Math.floor(state.rng.random() * opts.length)];
}
function processQueue(q) {
  if (!state.c.alive || !q.length) { renderProfile(); save(); checkDeath(); return; }
  const ev = q.shift();
  if (ev.choices) showEventModal(ev, q);
  else { logMessages(ev.text); processQueue(q); }
}
function showEventModal(ev, q) {
  openOverlay("An Event", body => {
    const g = eventGlyph(ev);
    const card = el("div", "event-card");
    card.appendChild(el("div", "ev-emblem " + g.tint, icon(g.name, { size: 30 })));
    card.appendChild(el("div", "ev-text", escapeHtml(ev.text)));
    body.appendChild(card);
    for (const ch of ev.choices) {
      const b = el("button", "mbtn full"); b.innerHTML = escapeHtml(ch.label);
      b.onclick = () => { const res = ch.fn(); closeOverlay(); logMessages(res); processQueue(q); };
      body.appendChild(b);
    }
  }, false);
}
function eventGlyph(ev) {
  const t = (ev.text || "").toLowerCase();
  if (/(duel|ambush|beast|war|battle|sword|fight)/.test(t)) return { name: "blade", tint: "tint-red" };
  if (/(love|companion|child is|moon|wed|marr|heart-)/.test(t)) return { name: "heart", tint: "tint-pink" };
  if (/(devil|blood-art|heart-demon|demon)/.test(t)) return { name: "mask", tint: "tint-purple" };
  if (/(ruin|treasure|auction|relic|chest)/.test(t)) return { name: "key", tint: "tint-gold" };
  if (/(ill|died|death|fever|plague|poison)/.test(t)) return { name: "flame", tint: "tint-red" };
  if (/(master|immortal|dao|enlighten|insight)/.test(t)) return { name: "dao", tint: "tint-gold" };
  return { name: "scroll", tint: "" };
}

/* ------------------------------- tabs ------------------------------------ */
function openCultivate() {
  const c = state.c;
  openOverlay("Cultivation", body => {
    if (!c.awakened) { body.appendChild(el("p", "note", `Your spiritual root has not yet awakened. The Awakening Ceremony comes at age ${D.AWAKENING_AGE} — keep aging up.`)); return; }
    const hasRoot = c.root.key !== "none";
    const addBtn = (grid, l, s, h, opt = {}) => { const b = el("button", "mbtn" + (opt.full ? " full" : "") + (opt.primary ? " primary" : "")); b.innerHTML = `${l}<small>${s}</small>`; if (opt.disabled) b.disabled = true; else b.onclick = h; grid.appendChild(b); };

    // ---- Qi cultivation (only with a spiritual root) ----
    if (hasRoot) {
      body.appendChild(el("div", "section-h", "Qi Cultivation 修炼"));
      body.appendChild(infoRows([
        ["Realm", `${E.realmLabel(c)} (${E.realmCn(c)})`, "realm"],
        ["Power", Math.floor(E.power(c)), "power"],
      ]));
      const atWall = E.canBreakthrough(c);
      progress(body, atWall ? "Qi — at the realm wall" : "Qi to next stage", c.qi, E.qiToNext(c), "qi",
        atWall ? `<b class="pb-ready">breakthrough ready</b>` : `${Math.floor(c.qi)} / ${Math.floor(E.qiToNext(c))}`);
      if (c.root.elements && c.root.elements.length) {
        const attune = Math.round(Math.min(0.45, Math.max(0.12, 0.10 + c.root.multiplier * 0.07)) * 100);
        const matchups = c.root.elements.map(e => { const m = C.elementMatchup(e); return m && (m.strong || m.weak) ? `${e} (▲${m.strong || "—"} ▼${m.weak || "—"})` : `${e} (exotic ▲all)`; }).join(", ");
        const plural = c.root.elements.length > 1;
        body.appendChild(el("p", "note", `Element${plural ? "s" : ""}: ${matchups}. Your arts of ${plural ? "these elements" : "this element"} strike +${attune}% (attuned) and you resist ${plural ? "them" : "it"}. ▲ strong vs · ▼ weak vs.`));
      }
      const g = el("div", "menu-grid");
      if (atWall)
        addBtn(g, "Attempt Breakthrough", `${Math.floor(E.breakthroughChance(c) * 100)}%${c.realm >= 3 ? " · tribulation" : " · risky"}`, doBreakthrough, { full: true, primary: true });
      addBtn(g, "Focused Cultivation", "a deed · deepen your qi", () => runTimed(() => E.gainQi(c, state.rng, 0.15), "cult"));
      addBtn(g, "Use a Qi Pill", `a deed · ${c.pills} left`, () => runTimed(() => E.gainQi(c, state.rng, 0.15, true), "cult"), { disabled: c.pills <= 0 });
      addBtn(g, "Comprehend the Dao", E.canComprehend(c) ? "meditate on the Laws" : "needs Nascent Soul", () => runTimed(() => E.meditate(c, state.rng, 1), "cult"), { disabled: !E.canComprehend(c) });
      body.appendChild(g);
    } else {
      body.appendChild(el("p", "note", "The heavens have shut the gate of qi to you — but the road of the body remains open. Temper your flesh until even immortals must take notice."));
      body.appendChild(infoRows([["Power", Math.floor(E.power(c)), "power"]]));
    }

    // ---- Body cultivation (open to all; the rootless walk it alone) ----
    body.appendChild(el("div", "section-h", "Body Cultivation 炼体"));
    const br = D.bodyRealmAt(c.bodyRealm || 0), nb = E.canTemperMore(c) ? D.BODY_REALMS[(c.bodyRealm || 0) + 1] : null;
    const cap = E.bodyRealmCap(c);
    body.appendChild(infoRows([
      ["Body Realm", `${br[0]} (${br[1]})`, "body"],
      ["Limit (physique)", D.bodyRealmName(cap)],
    ]));
    if (nb) progress(body, `Tempering → ${nb[0]}`, c.temper, nb[2], "body");
    else body.appendChild(el("p", "note", `Your body has reached the limit your ${c.physiqueName} can bear — the ${D.bodyRealmName(c.bodyRealm)}.`));
    const bg = el("div", "menu-grid");
    addBtn(bg, "Temper the Body", "a deed · forge flesh & bone", () => runTimed(() => E.temperBody(c, state.rng, 1.5), "cult"), { full: true, primary: !hasRoot });
    body.appendChild(bg);

    // ---- shared ----
    const sg = el("div", "menu-grid");
    addBtn(sg, "Techniques & Mastery", "drill your learned arts", openTechniques, { full: true });
    { const [ok] = E.canForgeTech(c); addBtn(sg, "Forge Your Own Art 创功", ok ? "weave a new technique from your dao" : "needs Foundation, 80 Comp, 70 Soul", openForgeTech, { full: true, disabled: !ok }); }
    body.appendChild(sg);
  });
}
function openRankboard() {
  const c = state.c;
  if (!c.rankboard) c.rankboard = E.generateRankboard(state.rng);
  openOverlay("Heaven Board 天骄榜", body => {
    const { ranked, rank, total } = E.rankboardStanding(c);
    const last = rank === total;
    const standing = last ? `You do not yet rank among them — you stand <b>last, #${rank} of ${total}</b>` : `You stand <b>#${rank} of ${total}</b>`;
    body.appendChild(el("p", "note", `The roll of the era's foremost young cultivators, ranked by raw power — geniuses who walk their own road whether or not you ever awaken. ${standing}. Climb it by out-cultivating them; challenge a rival above you to test yourself — win and your renown soars, lose and it dims.`));
    ranked.forEach((x, i) => {
      const row = el("div", "listrow" + (x.you ? " bound" : ""));
      const sub = x.you ? "— you —" : `${x.title} · ${D.REALMS[x.realm][0]} · power ${Math.floor(x.power)}`;
      row.innerHTML = `<div class="lr-ava ${i === 0 ? "tint-gold" : x.you ? "tint-jade" : ""}">${icon(i === 0 ? "crown" : x.you ? "lotus" : "blade", { size: 22 })}</div><div class="lr-main"><div class="lr-title">#${i + 1} ${escapeHtml(x.name)}</div><div class="lr-sub">${escapeHtml(sub)}</div></div>`;
      // You may challenge anyone ranked above you, within reach (the next 4 places up).
      if (!x.you && i < rank - 1 && i >= rank - 5) row.onclick = () => challengeGenius(x.ref);
      body.appendChild(row);
    });
    backBtn(body, actWorld);
  });
}
function challengeGenius(g) {
  const c = state.c;
  if (!ageAllows("duel") || !useAction("social")) return;
  const enemy = C.makeEnemyFromNpc(c, g, state.rng, { reward: (c.realm + 1) * 8 });
  logMessages([`You ascend the challenge-platform and call out ${g.name}, ${g.title} — a contest for rank on the Heaven Board!`]);
  startBattle(enemy, { title: `Heaven Board · ${g.name}` }, (outcome) => {
    if (state.c.alive) {
      if (outcome === "win") { c.reputation += 6; g.power = Math.floor((g.power || 1) * 0.9); logMessages([`✦ You defeat ${g.name} before the watching world! Your name climbs the Heaven Board. (+Reputation)`]); }
      else { c.reputation = Math.max(-200, c.reputation - 3); logMessages([`${g.name} bests you. You withdraw, and the board remembers. (−Reputation)`]); }
    }
    renderProfile(); if (!state.c.alive) checkDeath(); else openRankboard();
  });
}

function openPeople() {
  const c = state.c;
  openOverlay("Relationships", body => {
    const all = c.relationships.filter(n => n.alive);
    const family = all.filter(n => n.role === "family" && n.kin !== "Son" && n.kin !== "Daughter");
    const loves = all.filter(n => n.role === "companion").sort((a, b) => (b.married ? 1 : 0) - (a.married ? 1 : 0) || b.affinity - a.affinity);
    const kids = all.filter(n => n.kin === "Son" || n.kin === "Daughter");
    const bonds = all.filter(n => n.role !== "family" && n.role !== "companion");
    body.appendChild(el("p", "note", all.length
      ? `You are bound to <b>${all.length}</b> living souls — ${family.length} family, ${loves.length} love${loves.length === 1 ? "" : "s"}, ${kids.length} child${kids.length === 1 ? "" : "ren"}, ${bonds.length} other bond${bonds.length === 1 ? "" : "s"}.`
      : "You walk the world alone — for now. Go out and mingle to forge your first bonds."));
    const section = (title, list) => { if (list.length) { body.appendChild(el("div", "section-h", title)); list.forEach(n => body.appendChild(personRow(n))); } };
    section("Family", family);
    if (loves.length) {
      const sp = loves.filter(n => n.married).length;
      body.appendChild(el("div", "section-h", `Spouses & Lovers${sp ? ` · ${sp} wed` : ""}`));
      loves.forEach(n => body.appendChild(personRow(n)));
    }
    section(kids.length ? `Children · ${kids.length}` : "Children", kids);
    body.appendChild(el("div", "section-h", "Bonds"));
    if (!bonds.length) body.appendChild(el("p", "note", "You have no friends, rivals, or sworn enemies yet."));
    bonds.forEach(n => body.appendChild(personRow(n)));
    const b = el("button", "mbtn full primary"); b.innerHTML = "Go Out & Mingle<small>a deed · meet someone new</small>";
    b.onclick = () => { if (!ageAllows("mingle") || !useAction("social")) return; const res = L.mingle(c, state.rng); logMessages(res); renderProfile(); openPeople(); };
    body.appendChild(b);
    if (c.realm >= 4 && L.getDisciples(c).length < 3) {
      const d = el("button", "mbtn full"); d.innerHTML = "Take a Disciple<small>a deed · pass on your arts</small>";
      d.onclick = () => { if (!ageAllows("disciple") || !useAction("social")) return; logMessages(L.takeDisciple(c, state.rng)); renderProfile(); openPeople(); };
      body.appendChild(d);
    }
  });
}
function openTeachPicker(npc) {
  const c = state.c;
  openOverlay(`Teach · ${npc.name}`, body => {
    const techs = c.techniques.filter(t => t !== "basic_breathing");
    if (!techs.length) { body.appendChild(el("p", "note", "You know no techniques worth passing on yet.")); return; }
    body.appendChild(el("p", "note", `Pass one of your arts to ${npc.name}. They will carry it onward — and the teaching echoes into your next life.`));
    for (const t of techs) {
      const known = (npc.learned || []).includes(t);
      const row = el("div", "listrow" + (known ? " disabled" : ""));
      row.innerHTML = `<div class="lr-ava">📖</div><div class="lr-main"><div class="lr-title">${escapeHtml(D.TECHNIQUES[t][0])}</div><div class="lr-sub">${known ? "already learned" : D.TECHNIQUES[t][4]}</div></div>`;
      if (!known) row.onclick = () => { if (!useAction("social")) return; logMessages(L.teachTo(c, npc, t)); renderProfile(); openPerson(npc); };
      body.appendChild(row);
    }
    backBtn(body, () => openPerson(npc));
  });
}
function relLabel(n) {
  if (n.role === "companion") return n.married ? (n.kin || "Spouse") : "Sweetheart";
  return n.kin || E.npcRoleLabel(n);
}
function personRow(n) {
  const row = el("div", "listrow" + (n.role === "companion" && n.married ? " bound" : ""));
  const aff = Math.max(-100, Math.min(100, n.affinity));
  const col = aff < 0 ? "var(--red)" : aff < 40 ? "var(--muted)" : aff < 75 ? "var(--jade)" : "var(--pink)";
  const w = (aff + 100) / 2;
  const extra = n.occupation ? " · " + n.occupation : (n.parent ? " · child of " + escapeHtml(n.parent) : "");
  const homeLoc = (n.home != null && state.c.world) ? W.locById(state.c, n.home) : null;
  const where = homeLoc ? ` · of ${escapeHtml(homeLoc.name)}` : "";
  row.innerHTML = `<div class="lr-ava ${personTint(n)}">${personGlyph(n)}</div><div class="lr-main">
    <div class="lr-title">${escapeHtml(n.name)} <span class="lr-sub" style="display:inline">· ${escapeHtml(relLabel(n))}</span></div>
    <div class="lr-sub">${E.npcStatus(n)}${extra}${where}</div>
    <div class="affbar"><div style="width:${w}%;background:${col}"></div></div></div>`;
  row.onclick = () => openPerson(n);
  return row;
}
// A relationship's portrait reads from one hand-drawn family — chosen by kin,
// life-stage and sex — while its colour carries the sentiment.
function personGlyph(n) {
  const fem = n.sex === "female" || ["Mother", "Sister", "Daughter"].includes(n.kin);
  let name;
  if (n.kin === "Son" || n.kin === "Daughter") name = "avChild";
  else if (n.kin === "Brother" || n.kin === "Sister") name = fem ? "maiden" : "avYouth";
  else if (n.role === "companion") name = n.married ? "couple" : "heart";
  else if (n.role === "master") name = "avSage";
  else if (n.role === "disciple") name = fem ? "maiden" : "avYouth";
  else name = fem ? "avAdultF" : "avAdultM";
  return icon(name, { size: 22 });
}
function personTint(n) {
  if (n.role === "companion") return "tint-pink";
  if (n.role === "master" || n.role === "rival") return "tint-gold";
  if (n.role === "disciple" || n.role === "friend") return "tint-jade";
  if (n.role === "nemesis") return "tint-purple";
  if (n.role === "enemy") return "tint-red";
  const aff = n.affinity || 0;
  return aff < 0 ? "tint-red" : aff >= 75 ? "tint-jade" : "";
}
function openPerson(n) {
  const c = state.c;
  const isChild = n.kin === "Son" || n.kin === "Daughter";
  if (n.alive && !isChild) E.ensureNpcProfile(n, state.rng);   // normalize older-save / event NPCs
  openOverlay(n.name, body => {
    const rootName = k => { const r = D.ROOT_TYPES.find(x => x[0] === k); return r ? r[1] : "—"; };
    const physName = k => { const p = D.PHYSIQUES.find(x => x[0] === k); return p && k !== "ordinary" ? p[1] : null; };
    const hidden = isChild && !n._awakened;   // a child's talent is a mystery until the Awakening
    const cult = [];
    if (n.geno && !hidden) {
      cult.push(["Spiritual Root", rootName(n.geno.rootKey), "root"]);
      const ph = physName(n.physiqueKey || n.geno.physiqueKey); if (ph) cult.push(["Physique", ph, "physique"]);
    } else if (isChild && hidden) {
      cult.push(["Spiritual Root", "Unrevealed (awakens at 6)", "root"]);
    }
    if (n.realm != null && !isChild) cult.push(["Realm", `${E.npcRealmName(n)} (${D.REALMS[n.realm][1]})`, "realm"]);
    if (n.techniques && n.techniques.length > 1 && !hidden) {
      const arts = n.techniques.filter(t => t !== "basic_breathing").map(t => D.TECHNIQUES[t][0]);
      if (arts.length) cult.push(["Arts", arts.join(", ")]);
    }
    if (n.power && !isChild) cult.push(["Power", Math.floor(n.power), "power"]);
    body.appendChild(infoRows([
      ["Relation", relLabel(n) + (n.role === "companion" && n.married ? " (married)" : "")], ["Feeling", `${E.npcStatus(n)} (${n.affinity >= 0 ? "+" : ""}${n.affinity})`],
      ...(n.parent ? [["Parent", n.parent]] : []),
      ...cult,
      ...(n.occupation ? [["Occupation", n.occupation]] : []),
    ]));
    for (const act of L.relationActions(c, n)) {
      const b = el("button", "mbtn full"); b.innerHTML = escapeHtml(act.label);
      b.onclick = () => {
        if (act.id === "teach") { openTeachPicker(n); return; }   // picker spends the deed on teach
        if (act.id === "spar") {  // a friendly, non-lethal bout — fought in the combat menu
          if (!ageAllows("spar") || !useAction("social")) return;
          const enemy = C.makeEnemyFromNpc(c, n, state.rng, { reward: 0 });
          logMessages([`You square off against ${n.name} for a friendly spar. (non-lethal)`]);
          startBattle(enemy, { title: `Spar · ${n.name}`, nonLethal: true, noSpoils: true }, (outcome) => {
            if (state.c.alive) {
              c.happiness = Math.min(100, c.happiness + 2);
              if (outcome === "win") { n.affinity = Math.min(100, n.affinity + state.rng.randint(2, 6)); logMessages([`You best ${n.name} in the friendly bout; they respect you for it.`]); }
              else if (outcome === "lose" || outcome === "yield") { n.affinity = Math.max(-100, n.affinity + state.rng.randint(-3, 2)); logMessages([`${n.name} gets the better of you. Humbling, but instructive.`]); }
              logMessages(E.sparReward(c, state.rng, outcome));
            }
            renderProfile(); if (!state.c.alive) checkDeath(); else openPerson(n);
          });
          return;
        }
        if (act.id === "duel") {  // an interactive duel to the finish
          if (!ageAllows("duel") || !useAction("social")) return;
          const isNemesis = n.role === "nemesis";
          const enemy = isNemesis
            ? C.makeBoss(c, state.rng, { name: n.name, power: n.power, element: n.element })
            : C.makeEnemyFromNpc(c, n, state.rng, { reward: (c.realm + 1) * 6 });
          logMessages([isNemesis
            ? `At long last you stand against your nemesis ${n.name}. One of you will not walk away.`
            : `You challenge ${n.name} to settle things with qi and steel!`]);
          startBattle(enemy, { title: isNemesis ? `Showdown · ${n.name}` : `Duel · ${n.name}` }, (outcome) => {
            if (state.c.alive && outcome === "win") {
              n.alive = false;
              if (isNemesis) {
                c.happiness = Math.min(100, c.happiness + 18); c.reputation += 10;
                const title = `Nemesis Slain (${n.name})`;
                if (!c.titles.includes(title)) c.titles.push(title);
                c.log.push([c.age, `Slew your nemesis ${n.name} in a final duel.`]);
                logMessages([`✦ You strike ${n.name} down. The grudge of a lifetime is finally, utterly settled. (+Reputation, +Happiness)`]);
              } else logMessages([`You defeat ${n.name} and end the feud for good.`]);
            }
            renderProfile(); if (!state.c.alive) checkDeath(); else openPeople();
          });
          return;
        }
        if (!useAction("social")) return;
        const res = L.doRelationAction(c, n, act.id, state.rng);
        logMessages(res); renderProfile();
        if (!c.alive) { closeOverlay(); checkDeath(); return; }
        if (!n.alive) { closeOverlay(); openPeople(); return; }
        openPerson(n);
      };
      body.appendChild(b);
    }
    const back = el("button", "mbtn full"); back.innerHTML = "‹ Back"; back.onclick = openPeople; body.appendChild(back);
  });
}

function openTechniques() {
  const c = state.c;
  openOverlay("Techniques & Mastery", body => {
    const skills = c.techniques.map(t => ({ t, s: Object.values(C.SKILLS).find(x => x.tech === t) })).filter(o => o.s);
    for (const ct of (c.customTechs || [])) if (ct.skill) skills.push({ t: ct.key, s: ct.skill, forged: true });
    if (!skills.length) { body.appendChild(el("p", "note", "You have learned no combat techniques yet. Find manuals in ruins, from masters, the sect store — or forge your own from the Cultivate tab.")); return; }
    body.appendChild(el("p", "note", "Using a technique in battle deepens its mastery, raising its power. Tap one to drill it for a year (+mastery). ✦ marks an art you forged yourself."));
    for (const { t, s, forged } of skills) {
      const pts = (c.mastery && c.mastery[t]) || 0;
      const rank = D.masteryRank(pts), next = D.masteryNext(pts);
      const pctTo = next ? clampPct(pts - rank[1], next[1] - rank[1]) : 100;
      const eff = s.type === "heal" ? `heal ${Math.round(s.heal * 100)}%+` : s.type === "defend" ? "shield" : `${Math.round(s.dmg * 100)}% power dmg`;
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${s.element ? C.elementIcon(s.element) : "✊"}</div><div class="lr-main">
        <div class="lr-title">${escapeHtml(s.name)}${forged ? " ✦" : ""} <span class="lr-sub" style="display:inline">· ${rank[0]} (+${Math.round(rank[2] * 100)}%)</span></div>
        <div class="lr-sub">${eff}${s.qi ? ` · ⊙${s.qi} qi` : " · free"}${next ? ` · ${pts}/${next[1]} → ${next[0]}` : " · perfected"}</div>
        <div class="affbar"><div style="width:${pctTo}%;background:var(--gold2)"></div></div></div>`;
      row.onclick = () => runTimed(() => L.trainTechnique(c, state.rng, t), "cult");
      body.appendChild(row);
    }
  });
}
// Forge an original technique from your element and insight — costly and uncertain.
function openForgeTech() {
  const c = state.c;
  const elems = ["none", ...((c.root && c.root.elements) || [])];
  const styles = Object.keys(E.FORGE_STYLES);
  const sel = { element: elems.length > 1 ? elems[1] : "none", style: "strike", name: "" };
  openOverlay("Forge Your Own Art 创功", body => {
    const [ok, reason] = E.canForgeTech(c);
    if (!ok) { body.appendChild(el("p", "note", reason)); backBtn(body, openCultivate); return; }
    const render = () => {
      body.innerHTML = "";
      body.appendChild(el("p", "note", `Weave qi into a shape no manual holds; its power grows with your Comprehension, Soul Sense and realm, and may collapse if your insight falls short. You hold ${c.spiritStones} stones · ${c.herbs} herbs · ${(c.customTechs || []).length}/${E.forgeTechCap(c)} forged arts.`));
      const nm = el("input", "txtfield"); nm.type = "text"; nm.placeholder = "Name your art (or leave it nameless)"; nm.maxLength = 30; nm.value = sel.name;
      nm.oninput = () => { sel.name = nm.value; };
      body.appendChild(nm);
      const seg = (label, opts, cur, key, fmt) => {
        body.appendChild(el("div", "cr-label", label));
        const rowEl = el("div", "seg"); rowEl.style.flexWrap = "wrap"; rowEl.style.gap = "6px";
        for (const o of opts) { const b = el("button"); b.className = cur === o ? "on" : ""; b.textContent = fmt ? fmt(o) : o; b.onclick = () => { sel[key] = o; render(); }; rowEl.appendChild(b); }
        body.appendChild(rowEl);
      };
      seg("Element", elems, sel.element, "element", o => o === "none" ? "Neutral" : o);
      seg("Form", styles, sel.style, "style", o => E.FORGE_STYLES[o].label);
      const s = E.forgeTechSpec(c, sel.element, sel.style, sel.name);
      const eff = s.skill.type === "heal" ? `heals ${Math.round(s.skill.heal * 100)}% +cleanse` : s.skill.type === "defend" ? `shield ${Math.round(s.skill.shield * 100)}% +regen` : `${Math.round(s.skill.dmg * 100)}% power${s.skill.hits ? ` ×${s.skill.hits}` : ""}${s.skill.pierce ? ` · pierce ${Math.round(s.skill.pierce * 100)}%` : ""}`;
      const pv = el("div", "cr-preview");
      pv.appendChild(el("div", "cr-pv-top", `<b>${escapeHtml(s.name)}</b>${s.element ? ` · ${s.element}` : " · Neutral"} · ${E.FORGE_STYLES[sel.style].label} · tier ${s.tier}`));
      pv.appendChild(infoRows([
        ["In battle", `${eff} · ⊙${s.skill.qi} qi`],
        ["Passive", `+${Math.round(s.qiBonus * 100)}% qi-power, +${s.atkPct} attack`],
        ["Materials", `${s.stones} stones · ${s.herbs} herbs`],
        ["Success", `${Math.floor(s.chance * 100)}%${(c.root && c.root.elements && c.root.elements.includes(s.element)) ? " (attuned)" : ""}`],
      ]));
      body.appendChild(pv);
      const afford = c.spiritStones >= s.stones && c.herbs >= s.herbs;
      const forgeBtn = el("button", "mbtn full primary");
      forgeBtn.innerHTML = `Forge the Art<small>${afford ? `a deed · ${Math.floor(s.chance * 100)}% · ${s.stones} stones, ${s.herbs} herbs` : "not enough materials"}</small>`;
      if (afford) forgeBtn.onclick = () => runTimed(() => E.forgeTech(c, state.rng, sel.element, sel.style, sel.name), "cult");
      else forgeBtn.disabled = true;
      body.appendChild(forgeBtn);
      backBtn(body, openCultivate);
    };
    render();
  });
}
function openOwnSectLibrary() {
  const c = state.c;
  openOverlay("Sect Library 藏经阁", body => {
    if (!c.ownSect) { backBtn(body, openSect); return; }
    const lib = E.sectLibrary(c);
    body.appendChild(el("p", "note", `Enshrine arts you have mastered in your sect's library; its disciples train in them for generations, lifting the sect's prestige and its might in war. The library adds <b>+${E.sectLibraryBonus(c.ownSect)}</b> prestige each year.`));
    if (lib.length) {
      body.appendChild(el("div", "section-h", "Enshrined Arts"));
      for (const e of lib) {
        const row = el("div", "listrow bound");
        row.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${escapeHtml(e.name)}</div><div class="lr-sub">tier ${e.tier} · +${e.tier} prestige/year</div></div>`;
        body.appendChild(row);
      }
    }
    const avail = E.assignableSectTechs(c);
    body.appendChild(el("div", "section-h", "Arts You Can Enshrine"));
    if (!avail.length) { body.appendChild(el("p", "note", "You have no further arts to enshrine — learn or forge more.")); }
    for (const a of avail) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${escapeHtml(a.name)}${a.custom ? " ✦" : ""}</div><div class="lr-sub">tier ${a.tier} · enshrine for +${a.tier * 6} prestige now, +${a.tier}/year</div></div>`;
      row.onclick = () => { logMessages(E.assignSectTech(c, a.key)); renderProfile(); save(); openOwnSectLibrary(); };
      body.appendChild(row);
    }
    backBtn(body, openSect);
  });
}
// Build a small grid of leaf-action buttons (the classic mbtn). Returns the grid.
function leafGrid(body) {
  const grid = el("div", "menu-grid"); body.appendChild(grid);
  grid.mk = (l, s, h, opt = {}) => { const b = el("button", "mbtn" + (opt.full ? " full" : "") + (opt.primary ? " primary" : "")); b.innerHTML = `${l}<small>${escapeHtml(s)}</small>`; if (opt.disabled) b.disabled = true; else b.onclick = h; grid.appendChild(b); return b; };
  return grid;
}
// ---- Pursuits: a hub of categorised sub-menus (was the overloaded "Do" tab) ----
function openActivities() {
  openOverlay("Pursuits", body => {
    const c = state.c;
    const grid = el("div", "menu-grid");
    const ab = D.abodeAt(c.abode || 0);
    const ni = n => icon(n, { size: 22 });
    navCard(grid, ni("fist"), "Training", "temper body · study · rest · earn", actTrain);
    navCard(grid, ni("compass"), "Adventure", "travel · wander · hunt · delve", actAdventure);
    navCard(grid, ni("cauldron"), "Crafting", "refine pills · inscribe talismans", actCraft);
    navCard(grid, ni("coin"), "Commerce", "the market 坊市 · buy & sell", actCommerce);
    navCard(grid, ni("pagoda"), "Home & Assets", ab ? `${ab[1]} · treasures · beast` : "found an abode · treasures · beast", actHome);
    navCard(grid, ni("globe"), "The Wider World", "the Heaven Board · your legacy", actWorld);
    body.appendChild(grid);
  });
}
function actTrain() {
  const c = state.c;
  openOverlay("Training 修行", body => {
    const young = key => c.age < (AGE_MIN[key] || 0), sub = (key, n) => young(key) ? `from age ${AGE_MIN[key]}` : n;
    const g = leafGrid(body);
    g.mk("Train the Body", sub("train", "+constitution · tempers your body"), () => { if (!ageAllows("train")) return; runTimed(() => L.trainBody(c, state.rng), "cult"); }, { disabled: young("train") });
    g.mk("Study Scriptures", sub("study", "+comprehension"), () => { if (!ageAllows("study")) return; runTimed(() => L.studyScriptures(c, state.rng), "act"); }, { disabled: young("study") });
    g.mk("Rest & Recover", "health + happiness", () => runTimed(() => L.restAndRecover(c, state.rng)));
    g.mk("Take Odd Jobs", sub("oddjobs", "earn spirit stones"), () => runTimed(() => L.oddJobs(c, state.rng)), { disabled: young("oddjobs") });
    { const art = E.bestMovementArt(c);
      g.mk("Practice Footwork 轻功", art ? `${D.MOVEMENT_BY_KEY[art][1]} · ${E.moveRankName(E.moveFraction(c, art))} · ${E.hopsPerDeed(c)}/deed` : "learn a 轻功 art at the market first", () => runTimed(() => L.practiceMovement(c, state.rng), "act"), { full: true, disabled: !art }); }
    backBtn(body, openActivities);
  });
}
function actAdventure() {
  const c = state.c;
  openOverlay("Adventure 历练", body => {
    const young = key => c.age < (AGE_MIN[key] || 0), sub = (key, n) => young(key) ? `from age ${AGE_MIN[key]}` : n;
    const canHunt = isCultivator(c), canBoss = canHunt && isStrong(c);
    const here = W.currentLoc(c), reg = D.REGION_BY_KEY[c.region], t = W.typeOf(here);
    if (here) body.appendChild(el("p", "note", `You range out from <b>${escapeHtml(here.name)}</b> — ${reg ? reg[1] : ""} (${DANGER_TIER(reg ? reg[3] : 1)} country).${t.hunt ? " The surrounding wilds teem with spirit-beasts." : ""}${t.delve ? " Sealed ruins lie close at hand — ripe for delving." : ""} Travel the realm below to find deadlier, richer lands.`));
    const g = leafGrid(body);
    g.mk("Travel the Realm", c.age < AGE_MIN.travel ? `from age ${AGE_MIN.travel}` : (here ? "now at " + here.name : "the world map"), openWorldMap, { full: true, disabled: c.age < AGE_MIN.travel });
    g.mk("Wander the World", c.age < AGE_MIN.wander ? `from age ${AGE_MIN.wander}` : (canHunt ? "adventure & battle" : "roam for fortune"), doWander, { disabled: c.age < AGE_MIN.wander });
    g.mk("Hunt Spirit Beasts", !canHunt ? "needs cultivation" : sub("hunt", "battle · tameable"), doHunt, { disabled: !canHunt || young("hunt") });
    g.mk("Spar in the Arena", !canHunt ? "needs cultivation" : sub("arena", "train · non-lethal"), doArena, { disabled: !canHunt || young("arena") });
    g.mk("Seek a Worthy Foe", !canBoss ? "needs Foundation+" : sub("boss", "BOSS · great rewards"), doBossFight, { disabled: !canBoss || young("boss") });
    g.mk("Enter a Secret Realm", !canBoss ? "needs Foundation+" : sub("secret", "delve · escalating loot"), doSecretRealm, { disabled: !canBoss || young("secret") });
    backBtn(body, openActivities);
  });
}
function actCraft() {
  const c = state.c;
  openOverlay("Crafting 炼制", body => {
    const young = c.age < (AGE_MIN.alchemy || 0);
    const g = leafGrid(body);
    g.mk("Refine Pills", young ? `from age ${AGE_MIN.alchemy}` : `炼丹 · ${c.herbs} herbs`, openAlchemy, { full: true, disabled: young });
    g.mk("Inscribe Talismans", young ? `from age ${AGE_MIN.alchemy}` : "符箓 · craft one-use charms", openTalismans, { full: true, disabled: young });
    backBtn(body, openActivities);
  });
}
function actCommerce() {
  const c = state.c;
  openOverlay("Commerce 坊市", body => {
    const market = W.hasMarket(c);
    const g = leafGrid(body);
    if (!market) body.appendChild(el("p", "note", "No market out here in the wilds — travel to a city, town or village (Adventure → Travel the Realm) to trade."));
    g.mk("Visit the Market", market ? `💎 ${c.spiritStones} · buy & sell` : "no market here — travel to a settlement", openMarket, { full: true, disabled: !market });
    backBtn(body, openActivities);
  });
}
function actHome() {
  const c = state.c;
  openOverlay("Home & Assets", body => {
    const ab = D.abodeAt(c.abode || 0);
    const g = leafGrid(body);
    g.mk("Your Cave Abode", ab ? `${ab[1]} (${ab[2]})` : "establish a home base", openAbode, { full: true });
    g.mk("Equipment & Beast", "equipment slots, treasure trove & spirit beast", openAssets, { full: true });
    backBtn(body, openActivities);
  });
}
function actWorld() {
  const c = state.c;
  openOverlay("The Wider World", body => {
    const g = leafGrid(body);
    g.mk("The Heaven Board", "天骄榜 · the era's geniuses", openRankboard, { full: true, disabled: !c.awakened });
    g.mk("Achievements & Legacy", "feats across all your lives", () => openAchievements(actWorld), { full: true });
    backBtn(body, openActivities);
  });
}
function genMarket(c) {
  const rng = state.rng;
  const unknown = Object.keys(D.TECHNIQUES).filter(k => k !== "basic_breathing" && !c.techniques.includes(k));
  const tech = unknown.length ? rng.choice(unknown) : null;
  const keys = D.ARTIFACTS.map(a => a[0]);
  const treasures = [];
  for (let i = 0; i < 2 && keys.length; i++) treasures.push(keys.splice(Math.floor(rng.random() * keys.length), 1)[0]);
  const unknownMoves = D.MOVEMENT_ARTS.map(m => m[0]).filter(k => !(c.movementArts || []).includes(k));
  const move = unknownMoves.length && rng.random() < 0.7 ? rng.choice(unknownMoves) : null;
  return { year: c.age, loc: c.location, tech, move, treasures, sold: {} };
}
function marketDo(fn) {
  if (!state.c.alive) return;
  logMessages(fn());
  renderProfile(); save();
  openMarket();
}
function openMarket() {
  const c = state.c;
  if (!W.hasMarket(c)) {
    openOverlay("Market 坊市", body => {
      body.appendChild(el("p", "note", "There is no market out here in the wilds. Travel to a city, town or village to trade."));
      const b = el("button", "mbtn full primary"); b.innerHTML = "Open the Realm Map<small>find a settlement to trade in</small>";
      b.onclick = openWorldMap; body.appendChild(b);
      backBtn(body, actCommerce);
    });
    return;
  }
  if (!state.market || state.market.year !== c.age || state.market.loc !== c.location) state.market = genMarket(c);
  const M = state.market;
  openOverlay("Market 坊市", body => {
    const pm = E.eraPriceMult(c), here = W.currentLoc(c);
    const locNote = (c.priceMult || 1) > 1.05 ? " This remote market charges a premium." : (c.priceMult || 1) < 0.95 ? " This prosperous market trades cheap." : "";
    body.appendChild(el("p", "note", `${here ? here.name + " market — " : ""}spirit stones: ${c.spiritStones} · herbs: ${c.herbs}. Prices ${pm > 1.05 ? "run high" : pm < 0.95 ? "are low" : "are fair"} in the ${D.eraAt(c.era)[1]}.${locNote}`));
    const row = (emoji, title, sub, btnLabel, can, fn) => {
      const r = el("div", "listrow" + (can ? "" : " disabled"));
      r.innerHTML = `<div class="lr-ava">${emoji}</div><div class="lr-main"><div class="lr-title">${escapeHtml(title)}</div><div class="lr-sub">${escapeHtml(sub)}</div></div>`;
      if (can) r.onclick = () => marketDo(fn);
      body.appendChild(r);
    };
    body.appendChild(el("div", "section-h", "Buy"));
    row("🌿", "Spirit Herbs ×5", `${E.priceHerbs(c, 5)} stones`, "", c.spiritStones >= E.priceHerbs(c, 5), () => E.buyHerbs(c, 5));
    for (const p of D.PILL_RECIPES) {
      const price = E.pricePill(c, p[0]);
      row("⚗️", p[1], `${price} stones · ${p[4]}`, "", c.spiritStones >= price, () => E.buyPill(c, p[0], state.rng));
    }
    for (const key of D.TALISMAN_ORDER) {
      const t = D.TALISMANS[key], price = E.priceTalisman(c, key);
      row("🧧", `${t.name} (have ${(c.talismans && c.talismans[key]) || 0})`, `${price} stones · ${t.desc}`, "", c.spiritStones >= price, () => E.buyTalisman(c, key, state.rng));
    }
    if (M.tech && !c.techniques.includes(M.tech)) {
      const price = E.priceTech(c, D.TECHNIQUES[M.tech][1]);
      row("📖", D.TECHNIQUES[M.tech][0] + " (manual)", `${price} stones · ${D.TECHNIQUES[M.tech][4]}`, "", c.spiritStones >= price, () => E.buyTech(c, M.tech, state.rng));
    }
    if (M.move && !(c.movementArts || []).includes(M.move)) {
      const m = D.MOVEMENT_BY_KEY[M.move], price = E.priceMovement(c, M.move);
      row("🌀", `${m[1]} · 轻功 (${m[2]})`, `${price} stones · +${m[4]} stages/deed · ${m[5]}`, "", c.spiritStones >= price, () => E.buyMovementArt(c, M.move));
    }
    for (const k of M.treasures) {
      if (M.sold[k]) continue;
      const price = E.priceTreasure(c, k), si = D.EQUIP_SLOT_BY_KEY[D.artifactSlot(k)];
      row(si ? si[3] : "⚔️", D.ARTIFACT_BY_KEY[k][1] + ` (${D.artifactGrade(k)} ${si ? si[1] : ""})`, `${price} stones · ${E.artifactEffectText(k)} · ${D.ARTIFACT_BY_KEY[k][5]}`, "", c.spiritStones >= price, () => { M.sold[k] = true; return E.buyTreasure(c, k); });
    }
    // Sell
    const spareTreasures = c.artifacts.filter(k => !E.isEquipped(c, k));
    if (c.herbs >= 5 || spareTreasures.length) {
      body.appendChild(el("div", "section-h", "Sell"));
      if (c.herbs >= 5) row("🌿", "Sell Spirit Herbs ×5", `+${E.sellHerbs(c, 5)} stones`, "", true, () => E.sellSpareHerbs(c, 5));
      for (const k of spareTreasures) row("💰", "Sell " + D.ARTIFACT_BY_KEY[k][1], `+${E.sellTreasureValue(c, k)} stones (${D.artifactGrade(k)})`, "", true, () => E.sellTreasure(c, k));
    }
    backBtn(body, actCommerce);
  });
}
function openAbode() {
  const c = state.c;
  openOverlay("Cave Abode 洞府", body => {
    const cur = D.abodeAt(c.abode || 0);
    const next = D.abodeNext(c.abode || 0);
    if (cur) {
      const reg = D.REGION_BY_KEY[L.abodeRegionKey(c)];
      const danger = reg ? reg[3] : 1;
      const residents = L.abodeResidents(c);
      const tenders = residents.filter(n => n.role === "disciple");
      const mate = residents.find(n => n.role === "companion");
      body.appendChild(el("div", "section-h", `${cur[1]} · ${cur[2]}`));
      body.appendChild(el("p", "note", cur[8]));
      body.appendChild(infoRows([
        ["Location", `${L.abodeLocName(c) ? L.abodeLocName(c) + " · " : ""}${reg ? reg[1] : "—"}${danger !== 1 ? ` (×${danger} yield)` : ""}`, "region"],
        ["Cultivation bonus", `+${Math.round(cur[4] * 100)}%`, "abode"],
        ["Spirit herbs / year", `+${Math.round((cur[5] + tenders.length * Math.max(1, Math.round(cur[5] * 0.3)) + (c.beast && c.beast.alive ? 1 + Math.floor(c.abode / 2) : 0)) * danger)} 🌿`],
        ["Spirit stones / year", `+${Math.round((cur[6] + (c.beast && c.beast.alive ? Math.floor(c.abode) : 0)) * danger)} 💎`],
        ["Guardian array", (c.abode >= 3 ? `active (−${Math.round(Math.min(0.55, c.abode * 0.05 + (c.beast && c.beast.alive ? 0.12 : 0) + tenders.length * 0.08) * 100)}% raid threat)` : "none (tier 3+)")],
        ["Seclusion strength", `${cur[7].toFixed(2)}× (vs 0.15 normal)${mate ? " · ×1.15 dual" : ""}`],
      ]));
      const who = [mate && `${mate.name} (companion)`, tenders.length && `${tenders.length} disciple${tenders.length > 1 ? "s" : ""}`, c.beast && c.beast.alive && `${c.beast.name} the ${c.beast.species}`].filter(Boolean);
      body.appendChild(el("p", "note", who.length ? `Residents: ${who.join(", ")}. They tend the fields, help defend your home — and the most devoted fights at your side in battle.` : "No one lives here yet. Invite a dao companion or disciples (from Relationships) to share your home, tend its fields, help defend it, and fight at your side."));
      if (c.ownSect) body.appendChild(el("p", "note", `🏯 This abode is the mountain seat of your sect, the ${c.ownSect.name} (${D.sectTier(c.ownSect.prestige)[1]}). A grander seat houses more disciples.`));
      else if (L.canFoundSect(c)) body.appendChild(el("p", "note", "🏯 Your abode is now grand enough to serve as the seat of your own sect — found one from the Sect tab."));
      const sec = el("button", "mbtn full primary");
      sec.innerHTML = `Cultivate in Seclusion<small>a deed · seal yourself in for a deep cultivation</small>`;
      sec.onclick = () => runTimed(() => L.secludeInAbode(c, state.rng), "cult");
      body.appendChild(sec);
      if (c.pills > 0) {
        const secp = el("button", "mbtn full");
        secp.innerHTML = `Seclusion + Qi Pill<small>a deed · ${c.pills} pill(s) left</small>`;
        secp.onclick = () => runTimed(() => L.secludeInAbode(c, state.rng, true), "cult");
        body.appendChild(secp);
      }
    } else {
      body.appendChild(el("p", "note", "You have no cave abode yet — only the open road and borrowed corners. Stake a claim on a spirit vein to build a home that cultivates while you live, yielding herbs and stones each year."));
    }
    if (next) {
      const canAfford = c.spiritStones >= next[3];
      body.appendChild(el("div", "section-h", cur ? "Upgrade" : "Establish an Abode"));
      body.appendChild(el("p", "note", `${next[1]} (${next[2]}) — ${next[8]}`));
      body.appendChild(infoRows([
        ["Cost", `${next[3]} 💎 (you have ${c.spiritStones})`],
        ["Cultivation", `+${Math.round(next[4] * 100)}%`],
        ["Yield / year", `+${next[5]} 🌿  +${next[6]} 💎`],
      ]));
      const up = el("button", "mbtn full" + (canAfford ? " primary" : ""));
      up.innerHTML = `${cur ? "Upgrade to" : "Establish"} ${escapeHtml(next[1])}<small>${canAfford ? "free · spend " + next[3] + " stones" : "need " + next[3] + " stones"}</small>`;
      if (canAfford) up.onclick = () => runFree(() => L.upgradeAbode(c));
      else up.disabled = true;
      body.appendChild(up);
    } else if (cur) {
      body.appendChild(el("p", "note", "Your abode is a Cave Heaven — the very pinnacle. There is nothing higher to build."));
    }
    backBtn(body, actHome);
  });
}
function openTalismans() {
  const c = state.c;
  openOverlay("Inscribe Talismans 符箓", body => {
    body.appendChild(el("p", "note", `Spirit Herbs: ${c.herbs}. Each inscription is a deed; soul sense and comprehension steady your brush. Talismans are one-use battle charms — loose them in combat from your action bar.`));
    for (const key of D.TALISMAN_ORDER) {
      const t = D.TALISMANS[key], can = c.herbs >= t.herbs, have = (c.talismans && c.talismans[key]) || 0;
      const r = el("div", "listrow" + (can ? "" : " disabled"));
      r.innerHTML = `<div class="lr-ava">${t.element ? C.elementIcon(t.element) : "🧧"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(t.name)} <span class="lr-sub" style="display:inline">· have ${have}</span></div><div class="lr-sub">${t.herbs} herbs · ${escapeHtml(t.desc)}</div></div>`;
      if (can) r.onclick = () => runTimed(() => E.inscribeTalisman(c, key, state.rng), "act");
      body.appendChild(r);
    }
    backBtn(body, actCraft);
  });
}
function openAlchemy() {
  const c = state.c;
  openOverlay("Alchemy 炼丹", body => {
    body.appendChild(el("p", "note", `Spirit Herbs: ${c.herbs} · Skill: ${c.alchemySkill}. Refining costs a year; failures salvage some herbs.`));
    if (E.abodeAlchemyBonus(c) > 0) body.appendChild(el("p", "note", `✦ Your abode's pill room steadies the furnace (+${Math.round(E.abodeAlchemyBonus(c) * 100)}% success, a wider jade band).`));
    for (const r of D.PILL_RECIPES) {
      const can = c.herbs >= r[2];
      const row = el("div", "listrow" + (can ? "" : " disabled"));
      row.innerHTML = `<div class="lr-ava">⚗️</div><div class="lr-main"><div class="lr-title">${r[1]}</div><div class="lr-sub">${r[2]} herbs · ${r[4]}</div></div>`;
      if (can) row.onclick = () => startBrew(r);
      body.appendChild(row);
    }
    backBtn(body, actCraft);
  });
}
const biomeIdx = key => Math.max(0, D.REGIONS.findIndex(r => r[0] === key));
const DANGER_TIER = d => d <= 0.9 ? "safe" : d <= 1.1 ? "moderate" : d <= 1.35 ? "dangerous" : d <= 1.7 ? "perilous" : "deadly";
const loc2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// The realm map: a generated scatter of places to journey between. The visual
// map is for orientation; the list below it does the travelling.
function openWorldMap() {
  const c = state.c;
  if (!c.world) W.ensureWorld(c, state.rng);
  openOverlay("The Realm 寰宇", body => {
    const locs = c.world.locations, here = W.currentLoc(c);
    const art = E.bestMovementArt(c), perDeed = E.hopsPerDeed(c);
    const speedTxt = `You cover <b>${perDeed} stage${perDeed > 1 ? "s" : ""}</b> of road per travel deed${art ? ` — ${D.MOVEMENT_BY_KEY[art][1]} (${E.moveRankName(E.moveFraction(c, art))})` : ""}.`;
    body.appendChild(el("p", "note", `You stand at <b>${escapeHtml(here ? here.name : "—")}</b>${here && here.cn ? ` (${escapeHtml(here.cn)})` : ""} — ${W.typeOf(here).label}. ${speedTxt} Distant places take more than a year's travel — you rest at waystations along the road.`));

    // A journey already underway: offer to ride on toward the remembered goal.
    if (c.journeyTo != null && c.journeyTo !== c.location && W.locById(c, c.journeyTo)) {
      const dest = W.locById(c, c.journeyTo), left = E.travelDeeds(c, c.journeyTo);
      const cont = el("button", "mbtn full primary");
      cont.innerHTML = `Continue to ${escapeHtml(dest.name)}<small>${left} stage${left > 1 ? "s" : ""} of road remain</small>`;
      cont.onclick = () => travelTo(c.journeyTo);
      body.appendChild(cont);
    }

    // ---- visual map: roads + biome-tinted place pins ----
    const map = el("div", "worldmap");
    const seen = new Set(); let roads = "";
    for (const a of locs) for (const bid of a.links || []) {
      const key = Math.min(a.id, bid) + "-" + Math.max(a.id, bid);
      if (seen.has(key)) continue; seen.add(key);
      const b = locs[bid]; if (b) roads += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    }
    map.innerHTML = `<svg class="wm-roads" viewBox="0 0 100 100" preserveAspectRatio="none">${roads}</svg>`;
    for (const loc of locs) {
      const node = el("button", `wm-node biome-${biomeIdx(loc.biome)}${loc.id === c.location ? " here" : ""}${loc.sectKey ? " seat" : ""}${c.abodeLocation === loc.id ? " abode" : ""}`);
      node.style.left = loc.x + "%"; node.style.top = loc.y + "%";
      node.innerHTML = icon(W.typeOf(loc).icon, { size: 13 });
      node.setAttribute("aria-label", loc.name);
      node.onclick = () => openLocationCard(loc.id);
      map.appendChild(node);
    }
    body.appendChild(map);

    body.appendChild(el("div", "section-h", "Places of the Realm"));
    const ordered = locs.slice().sort((a, b) => (a.id === c.location ? -1 : b.id === c.location ? 1 : loc2(here, a) - loc2(here, b)));
    for (const loc of ordered) {
      const reg = D.REGION_BY_KEY[loc.biome], danger = reg ? reg[3] : 1;
      const cost = loc.id === c.location ? 0 : E.travelDeeds(c, loc.id);
      const tags = [W.typeOf(loc).label,
        loc.sectKey ? "⚑ " + D.SECT_BY_KEY[loc.sectKey][1].split(" (")[0] : null,
        c.abodeLocation === loc.id ? (c.ownSect ? "⚑ your sect's seat" : "your abode") : null].filter(Boolean);
      const dist = loc.id === c.location ? "here" : `${cost} deed${cost > 1 ? "s" : ""} away`;
      const row = el("div", "listrow" + (loc.id === c.location ? " bound" : ""));
      row.innerHTML = `<div class="lr-ava biome-${biomeIdx(loc.biome)}">${icon(W.typeOf(loc).icon, { size: 18 })}</div><div class="lr-main"><div class="lr-title">${loc.id === c.location ? "★ " : ""}${escapeHtml(loc.name)} <span class="lr-sub" style="display:inline">· ${dist}</span></div><div class="lr-sub">${escapeHtml(tags.join(" · "))} · ${reg ? reg[1] : ""} (${DANGER_TIER(danger)})</div></div>`;
      row.onclick = () => openLocationCard(loc.id);
      body.appendChild(row);
    }
    backBtn(body, actAdventure);
  });
}
function openLocationCard(id) {
  const c = state.c, loc = W.locById(c, id);
  if (!loc) return;
  const reg = D.REGION_BY_KEY[loc.biome], danger = reg ? reg[3] : 1, t = W.typeOf(loc);
  openOverlay(loc.name, body => {
    body.appendChild(el("p", "note", `<b>${escapeHtml(loc.name)}</b>${loc.cn ? ` (${escapeHtml(loc.cn)})` : ""} — ${t.label} of the ${reg ? reg[1] : ""}${reg ? ` (${reg[2]})` : ""}.`));
    body.appendChild(el("p", "note", escapeHtml(t.blurb)));
    const rows = [
      ["Region", `${reg ? reg[1] : ""} · ${DANGER_TIER(danger)} (×${danger})`, "region"],
      ["Market", t.market ? "yes — buy & sell here" : "none (the wilds)"],
    ];
    if (loc.sectKey) rows.push(["Sect seat", D.SECT_BY_KEY[loc.sectKey][1]]);
    if (t.delve > 0) rows.push(["Secret realms", "sealed ruins to delve"]);
    if (c.abodeLocation === id) rows.push(["Your abode", c.ownSect ? `mountain seat of the ${c.ownSect.name}` : "rooted here"]);
    body.appendChild(infoRows(rows));
    const locals = c.relationships.filter(n => n.alive && n.home === id);
    if (locals.length) {
      const p = el("p", "note"); p.appendChild(document.createTextNode("People you know here: "));
      locals.slice(0, 8).forEach((n, i, arr) => {
        const a = el("span", "loc-person"); a.textContent = n.name; a.onclick = () => openPerson(n);
        p.appendChild(a); if (i < arr.length - 1) p.appendChild(document.createTextNode(", "));
      });
      p.appendChild(document.createTextNode("."));
      body.appendChild(p);
    }
    if (id === c.location) {
      body.appendChild(el("p", "note", "✦ You are here."));
      // The place is a hub: jump straight into what stands here.
      const acts = el("div", "menu-grid");
      const act = (label, sub, fn) => { const b = el("button", "mbtn"); b.innerHTML = `${escapeHtml(label)}<small>${escapeHtml(sub)}</small>`; b.onclick = fn; acts.appendChild(b); };
      if (t.market) act("Visit the Market", "buy & sell here", openMarket);
      if (loc.sectKey && c.awakened) act("Sect Affairs", D.SECT_BY_KEY[loc.sectKey][1].split(" (")[0], openSect);
      if (c.abodeLocation === id) act("Your Abode", c.ownSect ? "your sect's seat" : "manage your home", openAbode);
      if (acts.children.length) body.appendChild(acts);
    }
    else {
      const hops = W.travelHops(c, id), cost = E.travelDeeds(c, id), avail = deedsLeft("act"), years = Math.ceil(cost / DEEDS_PER_CAT);
      body.appendChild(el("p", "note", `The road runs ${hops} stage${hops > 1 ? "s" : ""} — ${cost} travel deed${cost > 1 ? "s" : ""} at your pace (${E.hopsPerDeed(c)}/deed). ${cost <= avail ? "You can reach it this year." : `Too far for one year — you'll rest at waystations along the way (about ${years} year${years > 1 ? "s" : ""} of travel).`}`));
      const go = el("button", "mbtn full primary");
      go.innerHTML = `Set out for ${escapeHtml(loc.name)}<small>${cost <= avail ? `arrive this year · ${cost} deed${cost > 1 ? "s" : ""}` : `${avail > 0 ? "travel " + Math.min(avail, cost) + " deed" + (Math.min(avail, cost) > 1 ? "s" : "") + " now, rest, continue" : "no deeds left — age up first"}`}</small>`;
      go.onclick = () => travelTo(id);
      body.appendChild(go);
    }
    backBtn(body, openWorldMap);
  });
}
// Travel is a journey by road, one hop per deed. A far place can't be reached
// in a single year's three deeds — you stop at a waystation and ride on after
// aging up. `c.journeyTo` remembers your destination so you can continue.
function travelTo(id) {
  const c = state.c;
  if (!ageAllows("travel")) return;
  const p = W.path(c, c.location, id);
  if (!p || p.length < 2) return;                  // already there, or no road
  const avail = deedsLeft("act");
  if (avail <= 0) {
    closeOverlay();
    logMessages(["You have no strength left for the road this year. Tap ⊕ Age Up, then travel on."]);
    renderProfile(); return;
  }
  const perDeed = E.hopsPerDeed(c);                // road-stages covered per deed
  const totalHops = p.length - 1;
  const totalDeeds = Math.ceil(totalHops / perDeed);
  const deeds = Math.min(avail, totalDeeds, DEEDS_PER_CAT);
  const hops = Math.min(deeds * perDeed, totalHops);
  const arriveId = p[hops];
  spendDeeds("act", deeds);
  // Travelling is practice: your footwork art ripens with the leagues you cross.
  const art = E.bestMovementArt(c);
  if (art) E.trainMovement(c, art, deeds * 7);
  c.location = arriveId; W.syncLocation(c);
  const dest = W.locById(c, id), at = W.locById(c, arriveId), reg = D.REGION_BY_KEY[at.biome];
  closeOverlay();
  if (arriveId === id) {
    c.journeyTo = null;
    const leap = perDeed >= 3 ? "You all but leap the mountains — " : "";
    logMessages([`${leap}You journey to ${dest.name}${dest.cn ? ` (${dest.cn})` : ""} — ${W.typeOf(dest).label} in the ${reg ? reg[1] : "wilds"}. ${reg && reg[3] > 1.1 ? `The dangers here run ×${reg[3]}.` : "A measure of safety, here."}`]);
  } else {
    c.journeyTo = id;
    const left = totalHops - hops;
    logMessages([`The road to ${dest.name} is long. You break your journey at ${at.name} (${reg ? reg[1] : "the wilds"}) — ${left} stage${left > 1 ? "s" : ""} of road still ahead. Rest a year (⊕ Age Up), then travel on.`]);
  }
  endActivityYear();
}
function openAchievements(backFn) {
  openOverlay("Achievements & Legacy", body => {
    const f = meta.favor();
    body.appendChild(el("p", "note", `Heavenly Favor: ${f} — every soul you raise is born with +${Math.min(15, f)} Comprehension and +${Math.min(10, Math.floor(f / 2))} Fortune. Feats persist across all reincarnations and new lives.`));
    for (const a of meta.list()) {
      const row = el("div", "listrow" + (a.got ? " bound" : " disabled"));
      row.innerHTML = `<div class="lr-ava ${a.got ? "tint-gold" : ""}">${icon(a.got ? "trophy" : "lock", { size: 22 })}</div><div class="lr-main"><div class="lr-title">${escapeHtml(a.name)}</div><div class="lr-sub">${escapeHtml(a.desc)}</div></div>`;
      body.appendChild(row);
    }
    if (backFn) backBtn(body, backFn);
  });
}
function openBeast() {
  const c = state.c;
  if (!c.beast) { openAssets(); return; }
  E.normalizeBeast(c.beast);
  const b = c.beast;
  openOverlay(`${b.name} 灵兽`, body => {
    const req = D.BEAST_EXP_REQ[b.rank];
    body.appendChild(infoRows([
      ["Species", b.species],
      ["Rank", `${E.beastTier(b)} (${b.rank}/5)`],
      ["Element", b.element || "—"],
      ["Power", Math.floor(b.power)],
    ]));
    progress(body, "Bond", b.bond, 100, "bond", `${Math.round(b.bond)} / 100`);
    if (b.rank < 5) progress(body, `Experience → rank ${b.rank + 1}`, b.exp, req, "exp", b.bond >= 55 && b.exp >= req ? `<b class="pb-ready">ready to evolve</b>` : `${b.exp} / ${req}`);
    body.appendChild(el("p", "note", `In battle ${b.name} strikes each round for a share of its power, with its element's advantage and — from Earth Beast rank — a chance to inflict its elemental bite. Feeding raises its bond and experience; fed and battle-hardened, it can evolve into a mightier form. (Fed ${b.fedThisYear}/3 this year.)`));
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, opt = {}) => { const x = el("button", "mbtn" + (opt.full ? " full" : "") + (opt.primary ? " primary" : "")); x.innerHTML = `${l}<small>${s}</small>`; if (opt.disabled) x.disabled = true; else x.onclick = h; grid.appendChild(x); };
    const fedOut = b.fedThisYear >= 3;
    mk("Feed Herbs", fedOut ? "sated this year" : "2 herbs · +bond, +exp", () => runFree(() => E.feedBeast(c, state.rng, false)), { disabled: fedOut || c.herbs < 2 });
    mk("Feed a Pill", fedOut ? "sated this year" : `${c.pills} pills · big boost`, () => runFree(() => E.feedBeast(c, state.rng, true)), { disabled: fedOut || c.pills <= 0 });
    if (E.beastAdvanceReady(c))
      mk("✦ Evolve Your Beast", "advance to the next rank", () => { runFree(() => E.advanceBeast(c, state.rng)); if (c.beast && c.beast.rank >= 5) award("beastlord"); }, { full: true, primary: true });
    body.appendChild(grid);
    backBtn(body, openAssets);
  });
}
function openAssets() {
  const c = state.c;
  openOverlay("Equipment & Beast", body => {
    body.appendChild(el("div", "section-h", "Spirit Beast"));
    if (c.beast) {
      E.normalizeBeast(c.beast);
      const b = c.beast;
      const row = el("div", "listrow" + (E.beastAdvanceReady(c) ? " bound" : ""));
      row.innerHTML = `<div class="lr-ava">${b.element ? C.elementIcon(b.element) : "🐾"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(b.name)} <span class="lr-sub" style="display:inline">· ${escapeHtml(b.species)}</span></div><div class="lr-sub">${E.beastTier(b)}${b.element ? " · " + b.element : ""} · power ${Math.floor(b.power)} · bond ${Math.round(b.bond)}/100${E.beastAdvanceReady(c) ? " · ✦ ready to evolve!" : ""}</div></div>`;
      row.onclick = () => openBeast();
      body.appendChild(row);
    } else body.appendChild(el("p", "note", "None. Best a wild beast while wandering to try taming one."));
    E.ensureEquipment(c);
    // ── Equipment slots ──────────────────────────────────────────────────
    body.appendChild(el("div", "section-h", "Equipment (装备)"));
    body.appendChild(el("p", "note", "Bind one treasure per slot. Their bonuses stack — tap an empty slot to fill it, or an equipped treasure below to unbind it."));
    for (const [slot, name, cn, ic, blurb] of D.EQUIP_SLOTS) {
      const key = c.equipment[slot];
      const r = el("div", "listrow" + (key ? " bound" : ""));
      if (key) { const lv = E.refineLevel(c, key);
        r.innerHTML = `<div class="lr-ava">${ic}</div><div class="lr-main"><div class="lr-title">${escapeHtml(name)} · ${escapeHtml(cn)}</div><div class="lr-sub">★ ${escapeHtml(D.ARTIFACT_BY_KEY[key][1])} (${D.artifactGrade(key)}${lv ? ` +${lv}` : ""}) — ${escapeHtml(E.artifactEffectText(key, c))}</div></div>`;
      } else r.innerHTML = `<div class="lr-ava" style="opacity:.5">${ic}</div><div class="lr-main"><div class="lr-title" style="opacity:.7">${escapeHtml(name)} · ${escapeHtml(cn)}</div><div class="lr-sub">empty — ${escapeHtml(blurb)}</div></div>`;
      if (key) r.onclick = () => openTreasureCard(key);
      else r.onclick = () => openSlotPicker(slot);
      body.appendChild(r);
    }
    // Aggregate bonuses, so the player sees the full loadout at a glance.
    const eff = E.equipmentEffects(c);
    if (E.equippedKeys(c).length) {
      const summary = ["atk", "def", "hp", "dodge", "crit", "life", "qi", "qiMax"]
        .filter(k => eff[k]).map(k => `+${Math.round(eff[k] * 100)}% ${ {atk:"power",def:"defense",hp:"battle HP",dodge:"dodge",crit:"crit",life:"lifesteal",qi:"qi",qiMax:"max qi"}[k] }`).join(" · ");
      body.appendChild(el("p", "note", "✦ Total (gear + sets): " + summary));
    }
    // Active equipment-set bonuses.
    const setLines = E.setBonusLines(c);
    if (setLines.length) for (const line of setLines) body.appendChild(el("p", "note", "套 " + line));
    // Elemental attunement granted by equipped treasures.
    const gearEls = E.equipmentElements(c);
    if (gearEls.length) body.appendChild(el("p", "note", "灵 Attuned (gear): " + gearEls.map(e => `${C.elementIcon(e)} ${e}`).join(" · ") + " — matching arts strike harder; you resist these elements."));
    // ── Treasure trove (full inventory) ──────────────────────────────────
    body.appendChild(el("div", "section-h", "Treasure Trove (法宝库)"));
    if (!c.artifacts.length) body.appendChild(el("p", "note", "You own no treasures yet."));
    for (const key of c.artifacts) {
      const equipped = E.isEquipped(c, key), si = D.EQUIP_SLOT_BY_KEY[D.artifactSlot(key)], lv = E.refineLevel(c, key), elem = D.artifactElement(key);
      const row = el("div", "listrow" + (equipped ? " bound" : ""));
      row.innerHTML = `<div class="lr-ava">${si ? si[3] : "⚔️"}</div><div class="lr-main"><div class="lr-title">${equipped ? "★ " : ""}${escapeHtml(D.ARTIFACT_BY_KEY[key][1])}${elem ? ` ${C.elementIcon(elem)}` : ""}${lv ? ` <span class="lr-sub" style="display:inline">+${lv}</span>` : ""}</div><div class="lr-sub">${D.artifactGrade(key)} ${si ? si[1] : ""} · ${escapeHtml(E.artifactEffectText(key, c))}</div></div>`;
      row.onclick = () => openTreasureCard(key);
      body.appendChild(row);
    }
    // ── Sundry trinkets ──────────────────────────────────────────────────
    body.appendChild(el("div", "section-h", "Sundries"));
    body.appendChild(el("p", "note", c.inventory.length ? c.inventory.join(", ") : "(empty)"));
    backBtn(body, actHome);
  });
}

// Choose which owned treasure to bind into a given equipment slot.
function openSlotPicker(slot) {
  const c = state.c, si = D.EQUIP_SLOT_BY_KEY[slot];
  openOverlay(`Equip · ${si ? si[1] : "Slot"}`, body => {
    body.appendChild(el("p", "note", si ? `${si[2]} — ${si[4]}` : ""));
    const owned = c.artifacts.filter(k => D.artifactSlot(k) === slot && !E.isEquipped(c, k));
    if (!owned.length) body.appendChild(el("p", "note", "You own no unequipped treasures for this slot. Win or buy more at ruins, bosses and the market."));
    // Strongest first (refinement included), so the obvious upgrade is on top.
    owned.sort((a, b) => E.effectiveScore(c, b) - E.effectiveScore(c, a));
    for (const key of owned) {
      const lv = E.refineLevel(c, key), row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${si ? si[3] : "⚔️"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(D.ARTIFACT_BY_KEY[key][1])} (${D.artifactGrade(key)}${lv ? ` +${lv}` : ""})</div><div class="lr-sub">${escapeHtml(E.artifactEffectText(key, c))} · ${escapeHtml(D.ARTIFACT_BY_KEY[key][5])}</div></div>`;
      row.onclick = () => { runQuiet(() => E.equipArtifact(c, key)); renderProfile(); openAssets(); };
      body.appendChild(row);
    }
    backBtn(body, openAssets);
  });
}

// A treasure's detail card: its lore and live effects, with bind/unbind,
// refinement (祭炼) and sell actions.
function openTreasureCard(key) {
  const c = state.c, art = D.ARTIFACT_BY_KEY[key]; if (!art) return;
  const si = D.EQUIP_SLOT_BY_KEY[D.artifactSlot(key)];
  openOverlay(art[1], body => {
    const lv = E.refineLevel(c, key), equipped = E.isEquipped(c, key), owned = c.artifacts.includes(key);
    const elem = D.artifactElement(key);
    const rows = [
      ["Slot", `${si ? si[3] + " " + si[1] : "Treasure"} · ${si ? si[2] : ""}`],
      ["Grade", `${D.artifactGrade(key)}${lv ? ` · 祭炼 +${lv}` : ""}`],
      ["Effects", E.artifactEffectText(key, c)],
    ];
    if (elem) rows.push(["Attunement", `${C.elementIcon(elem)} ${elem}`]);
    rows.push(["Status", equipped ? "★ Equipped" : owned ? "In your trove" : "Not owned"]);
    body.appendChild(infoRows(rows));
    body.appendChild(el("p", "note", art[5]));
    // Set membership, with progress toward its bonuses.
    const setKey = D.SET_OF_ARTIFACT[key];
    if (setKey) {
      const set = D.SET_BY_KEY[setKey];
      const equippedCount = set.members.filter(m => E.isEquipped(c, m)).length;
      body.appendChild(el("div", "section-h", `Set · ${set.name} (${set.cn})`));
      body.appendChild(el("p", "note", `${equippedCount}/${set.members.length} equipped — ${set.blurb}`));
      const lines = Object.keys(set.bonuses).map(Number).sort((a, b) => a - b)
        .map(n => `${equippedCount >= n ? "✓" : "○"} ${n}-piece: ${E.effectsText(set.bonuses[n])}`);
      for (const l of lines) body.appendChild(el("p", "note", l));
      const missing = set.members.filter(m => !E.isEquipped(c, m))
        .map(m => `${D.ARTIFACT_BY_KEY[m][1]}${c.artifacts.includes(m) ? " (in trove)" : ""}`);
      if (missing.length) body.appendChild(el("p", "note", "Still need: " + missing.join(", ")));
    }
    if (!owned) { backBtn(body, openAssets); return; }
    // Bind / unbind
    const bindBtn = el("button", "mbtn full" + (equipped ? "" : " primary"));
    bindBtn.textContent = equipped ? "Unbind from slot" : `Equip in ${si ? si[1] : "slot"}`;
    bindBtn.onclick = () => { runQuiet(() => E.equipArtifact(c, key)); renderProfile(); openTreasureCard(key); };
    body.appendChild(bindBtn);
    // Refine (祭炼)
    if (lv >= E.REFINE_MAX) {
      body.appendChild(el("p", "note", `祭炼 +${lv} — refined to its very limit; its spirit can bear no more.`));
    } else {
      const cost = E.refineCost(c, key), chance = Math.round(E.refineChance(c, key) * 100), afford = c.spiritStones >= cost;
      const rb = el("button", "mbtn full" + (afford ? "" : " disabled"));
      rb.innerHTML = `祭炼 · Refine to +${lv + 1}<small>${cost} stones · ${chance}% success · each level +${Math.round(E.REFINE_PER_LEVEL * 100)}% of base effects</small>`;
      if (afford) rb.onclick = () => { runQuiet(() => E.refineTreasure(c, key, state.rng)); renderProfile(); openTreasureCard(key); };
      body.appendChild(rb);
      if (!afford) body.appendChild(el("p", "note", `You need ${cost} spirit stones to attempt this refinement.`));
    }
    // Sell (only when not equipped)
    if (!equipped) {
      const sb = el("button", "mbtn full");
      sb.innerHTML = `Sell<small>+${E.sellTreasureValue(c, key)} stones</small>`;
      sb.onclick = () => { runQuiet(() => E.sellTreasure(c, key)); renderProfile(); openAssets(); };
      body.appendChild(sb);
    }
    backBtn(body, openAssets);
  });
}

function openSect() {
  const c = state.c;
  openOverlay("Sect Affairs", body => {
    if (!c.awakened) { body.appendChild(el("p", "note", "You cannot join a sect before your spiritual root awakens.")); return; }
    if (c.ownSect) { renderOwnSect(c, body); return; }
    if (!c.sectKey) {
      body.appendChild(el("p", "note", "Join a sect for a cultivation bonus, a yearly stipend, a rank ladder, quests and tournaments. Better sects demand rarer talent — and you must present yourself at a sect's mountain seat to seek entry. Tap one to find the way there."));
      for (const s of D.SECTS) {
        const ok = c.realm >= s[5];
        const seat = W.sectSeat(c, s[0]);
        const atSeat = !!(seat && seat.id === c.location);
        const gate = !ok ? `needs ${D.REALMS[s[5]][0]}`
          : atSeat ? `${Math.floor(E.joinChance(c, s) * 100)}% accepted · you are at the gate`
          : seat ? `journey to ${seat.name} to seek entry` : "seat unknown";
        const row = el("div", "listrow" + (!ok ? " disabled" : atSeat ? " bound" : ""));
        row.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${s[1]}${atSeat ? " ★" : ""}</div><div class="lr-sub">${s[2]} · ${gate}<br>${s[9]}</div></div>`;
        if (ok && atSeat) row.onclick = () => runFree(() => E.attemptJoin(c, state.rng, s[0]));
        else if (ok && seat) row.onclick = () => openLocationCard(seat.id);
        body.appendChild(row);
      }
      body.appendChild(el("div", "section-h", "开宗立派 · Your Own Sect"));
      if (c.legacySect) {
        const lg = c.legacySect, t = D.sectTier(lg.prestige);
        body.appendChild(el("p", "note", `A sect from a past life awaits the founder's return: the ${lg.name} — ${t[1]} (${t[2]}), ~${lg.members} disciples${lg.steward ? `, held in trust by ${lg.steward}` : ""}, ${lg.generations} life${lg.generations > 1 ? "-times" : ""} ago.`));
        if (L.canReclaimSect(c)) {
          const rb = el("button", "mbtn full primary");
          rb.innerHTML = `Reclaim the ${escapeHtml(lg.name)}<small>${L.RECLAIM_SECT_COST} stones · restore its ${t[1]} prestige</small>`;
          rb.onclick = () => { runFree(() => L.reclaimSect(c)); if (c.ownSect) award("reborn_founder"); };
          body.appendChild(rb);
        } else {
          body.appendChild(el("p", "note", L.reclaimSectReason(c) || ""));
        }
      } else if (L.canFoundSect(c)) {
        const fb = el("button", "mbtn full primary");
        fb.innerHTML = `Found Your Own Sect<small>${L.FOUND_SECT_COST} stones · your abode becomes its seat</small>`;
        fb.onclick = () => openFoundSect();
        body.appendChild(fb);
      } else {
        body.appendChild(el("p", "note", "Why bow to another's banner forever? " + (L.foundSectReason(c) || "")));
      }
      return;
    }
    body.appendChild(infoRows([
      ["Sect", E.sectName(c)],
      ["Your rank", E.rankName(c)],
      ["Contribution", c.contribution],
      ["Missions run", c.sectMissions || 0],
      ["Years a disciple", c.sectJoinedAge != null ? Math.max(0, c.age - c.sectJoinedAge) : "—"],
    ]));
    // ---- the sect's hierarchy ladder ----
    body.appendChild(el("div", "section-h", "Hierarchy 品级"));
    renderRankLadder(c, body);
    const fig = E.sectFigures(c.sectKey);
    if (fig) body.appendChild(el("p", "note", `Above you stand Sect Master <b>${escapeHtml(fig.master.name)}</b> (${D.REALMS[fig.master.realm][0]}), and the elders ${fig.elders.map(e => `${escapeHtml(e.name)} (${e.title})`).join(", ")}.`));
    // ---- promotion status ----
    const req = E.nextRankReq(c);
    if (req) {
      const blockers = E.promotionBlockers(c);
      body.appendChild(el("p", "note", blockers.length
        ? `To rise to <b>${req[0]}</b> you must still: ${blockers.join("; ")}.`
        : `You meet every requirement for <b>${req[0]}</b> — face the promotion trial when ready.`));
    }
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, full) => { const b = el("button", "mbtn" + (full ? " full" : "")); b.innerHTML = `${l}<small>${escapeHtml(s)}</small>`; b.onclick = h; grid.appendChild(b); };
    mk("Take a Mission", "a deed · earn contribution", openQuests);
    mk("Seek Promotion", req ? (E.canPromote(c) ? "trial of rank" : "view requirements") : "at the summit", doPromotion);
    mk("Sect Library 传功", "learn the sect's signature arts", openSectLibrary);
    mk("Grand Tournament", "a deed · interactive duels", doTournament);
    mk("Sect Store", "25 contrib → pills & manuals", () => runFree(() => E.exchangeContribution(c, state.rng)));
    const leave = el("button", "mbtn full danger"); leave.innerHTML = "Leave the Sect<small>go rogue</small>"; leave.onclick = () => runFree(() => E.leaveSect(c)); grid.appendChild(leave);
    body.appendChild(grid);
  });
}
// The rank ladder, Sect Master at the top down to Outer Disciple, with your rung
// lit and the requirements of the ranks still above you.
function renderRankLadder(c, body) {
  const wrap = el("div", "rankladder");
  for (let i = D.SECT_RANKS.length - 1; i >= 0; i--) {
    const rk = D.SECT_RANKS[i];
    const state = i < c.sectRank ? "past" : i === c.sectRank ? "current" : "future";
    const mark = state === "current" ? "▶" : state === "past" ? "✓" : "·";
    let req;
    if (i === 0) req = "entry rank";
    else { const bits = [D.REALMS[rk[1]][0], `${rk[2]} contrib`]; if (rk[5]) bits.push(`${rk[5]} missions`); if (rk[6]) bits.push(`${rk[6]} fame`); req = bits.join(" · "); }
    const detail = state === "current" ? "you are here" : state === "past" ? "attained" : req;
    const row = el("div", "rl-row " + state);
    row.innerHTML = `<span class="rl-mark">${mark}</span><span class="rl-name">${rk[0]}</span><span class="rl-req">${escapeHtml(detail)}</span>`;
    wrap.appendChild(row);
  }
  body.appendChild(wrap);
}
function openSectLibrary() {
  const c = state.c;
  openOverlay("Sect Library 传功堂", body => {
    const arts = E.sectArts(c);
    body.appendChild(el("p", "note", `The ${E.sectName(c)} imparts its arts to those who rise and earn merit. You are ${E.rankName(c).split(" (")[0]} with ${c.contribution} contribution. ✦ marks the sect's exclusive signature art.`));
    if (!arts.length) { body.appendChild(el("p", "note", "This sect keeps no library of arts to teach.")); backBtn(body, openSect); return; }
    const sigKey = arts[arts.length - 1][0];
    const learn = key => { if (!state.c.alive) return; logMessages(E.learnSectArt(c, key)); renderProfile(); save(); openSectLibrary(); };
    for (const [key, minRank, cost] of arts) {
      const t = D.TECHNIQUES[key], known = c.techniques.includes(key);
      const rankOk = c.sectRank >= minRank, afford = c.contribution >= cost, can = !known && rankOk && afford;
      const gate = known ? "✓ learned" : !rankOk ? `needs ${D.SECT_RANKS[minRank][0].split(" (")[0]}` : !afford ? `${cost} contrib (have ${c.contribution})` : `${cost} contribution`;
      const row = el("div", "listrow" + (known ? " bound" : can ? "" : " disabled"));
      row.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${t[0]}${key === sigKey ? " ✦" : ""}</div><div class="lr-sub">${gate} · tier ${t[1]}<br>${t[4]}</div></div>`;
      if (can) row.onclick = () => learn(key);
      body.appendChild(row);
    }
    backBtn(body, openSect);
  });
}
function doPromotion() {
  const c = state.c;
  const req = E.nextRankReq(c);
  if (!req) { closeOverlay(); logMessages(["You already sit at the very summit of your sect."]); renderProfile(); return; }
  const blockers = E.promotionBlockers(c);
  if (blockers.length) { closeOverlay(); logMessages([`To rise to ${req[0]} you must still: ${blockers.join("; ")}.`]); renderProfile(); return; }
  const foe = E.promotionTrialFoe(c, state.rng);
  if (!foe) { runFree(() => E.completePromotion(c)); return; }     // low ranks: no trial
  closeOverlay();
  logMessages([`The elders set a promotion trial: best ${foe[0]} before the assembled sect to earn ${req[0]}.`]);
  const enemy = C.makeEnemy(c, state.rng, { kind: "rogue", name: foe[0], power: foe[1], element: null, reward: 0 });
  startBattle(enemy, { title: `Rank Trial · ${req[0]}`, nonLethal: true, noSpoils: true }, (outcome) => {
    if (state.c.alive && outcome === "win") logMessages(E.completePromotion(c));
    else if (state.c.alive) logMessages([`✗ ${foe[0]} bests you before the watching hall. The rank is not yet yours — grow stronger and return.`]);
    renderProfile(); if (!state.c.alive) checkDeath(); else openSect();
  });
}
function renderOwnSect(c, body) {
  const s = c.ownSect;
  const tier = D.sectTier(s.prestige), next = D.sectTierNext(s.prestige);
  const cap = L.sectCapacity(c);
  const align = { righteous: "Righteous", neutral: "Neutral", demonic: "Demonic" }[s.alignment] || "Neutral";
  body.appendChild(el("div", "section-h", `${s.name}`));
  body.appendChild(el("p", "note", `You are the Founder and Sect Master of the ${s.name}, a ${align}-path sect seated at your ${(D.abodeAt(c.abode || 0) || [, "abode"])[1]}.`));
  body.appendChild(infoRows([
    ["Standing", `${tier[1]} (${tier[2]})`],
    ["Cultivation bonus", `+${Math.round(tier[3] * 100)}%`, "abode"],
    ["Founded", `age ${s.founded}`],
  ]));
  if (next) progress(body, `Prestige → ${next[1]}`, s.prestige - tier[0], next[0] - tier[0], "prestige", `${Math.floor(s.prestige)} / ${next[0]}`);
  else progress(body, "Prestige — a Holy Land", 1, 1, "prestige", `${Math.floor(s.prestige)} (peak)`);
  progress(body, "Members", s.members, cap, "rank", `${s.members} / ${cap}`);
  body.appendChild(el("p", "note", `Each year your sect spreads your name (+${tier[4]} fame), pays a stipend from its treasury, and quickens your dao. Expand your cave abode to raise the members cap. Invite disciples (in Relationships) to settle them as your core.`));
  const grid = el("div", "menu-grid");
  const mk = (l, sub, h, full, primary) => { const b = el("button", "mbtn" + (full ? " full" : "") + (primary ? " primary" : "")); b.innerHTML = `${l}<small>${sub}</small>`; b.onclick = h; grid.appendChild(b); };
  mk("Hold a Recruitment", s.members < cap ? "a deed · draw new disciples" : "halls are full", () => runTimed(() => L.holdRecruitment(c, state.rng)), true, s.members < cap);
  if (c.realm >= 4 && L.getDisciples(c).length < 4)
    mk("Take a Disciple", "a deed · a personal heir", () => { if (!ageAllows("disciple") || !useAction("social")) return; logMessages(L.takeDisciple(c, state.rng)); renderProfile(); openSect(); });
  mk("Sect Library 藏经阁", `enshrine your arts · +${E.sectLibraryBonus(s)}/yr`, openOwnSectLibrary, true);
  mk("Sect Conflicts 宗门之争", "wage war on rival sects", openSectWar, true);
  body.appendChild(grid);
  // ---- your own sect's hierarchy ----
  body.appendChild(el("div", "section-h", "Your Hierarchy 麾下"));
  const core = L.getDisciples(c).filter(n => n.alive);
  const ladder = el("div", "rankladder");
  const row = (mark, name, title, cls) => `<div class="rl-row ${cls}"><span class="rl-mark">${mark}</span><span class="rl-name">${escapeHtml(name)}</span><span class="rl-req">${escapeHtml(title)}</span></div>`;
  let html = row("▶", c.name, "Founder & Sect Master", "current");
  core.slice(0, 6).forEach((n, i) => { html += row("·", n.name, i < 2 ? "Grand Elder" : "Core Disciple", "past"); });
  ladder.innerHTML = html;
  body.appendChild(ladder);
  body.appendChild(el("p", "note", `${s.members} disciples in all throng the outer and inner halls beneath your core.${(s.conquered || []).length ? ` Your banner has broken ${s.conquered.length} rival sect${s.conquered.length > 1 ? "s" : ""}.` : ""}`));
  const dis = el("button", "mbtn full danger"); dis.innerHTML = "Disband the Sect<small>lower your banner</small>"; dis.onclick = () => runFree(() => L.disbandSect(c)); body.appendChild(dis);
}
function openSectWar() {
  const c = state.c;
  openOverlay("Sect Conflicts 宗门之争", body => {
    if (!c.ownSect) { body.appendChild(el("p", "note", "You lead no sect to send to war.")); backBtn(body, openSect); return; }
    body.appendChild(el("p", "note", `March the ${D.sectTier(c.ownSect.prestige)[1]} against a rival sect (a deed). The realm's sects rise and fall year by year; a sect you break lies in ruins for a decade before it rebuilds. Victory absorbs their disciples, prestige and fame; defeat bleeds your sect and wounds you.`));
    for (const r of E.sectWarRivals(c)) {
      const s = r.sect;
      const state2 = r.broken ? ` · in ruins (~${r.brokenYears} yr to rebuild)` : "";
      const sub = `${s[2]} · might ${r.strength} · ${Math.floor(r.chance * 100)}% to prevail${state2}${r.hostile ? " · sworn foes" : ""}`;
      const rrow = el("div", "listrow" + (r.broken ? " disabled" : ""));
      rrow.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${s[1]}</div><div class="lr-sub">${sub}<br>${s[9]}</div></div>`;
      if (!r.broken) rrow.onclick = () => { if (!useAction("act")) return; logMessages(E.wageSectWar(c, state.rng, r.key)); renderProfile(); if (!state.c.alive) checkDeath(); else openSectWar(); };
      body.appendChild(rrow);
    }
    backBtn(body, openSect);
  });
}
function openFoundSect() {
  const c = state.c;
  openOverlay("Found a Sect 开宗立派", body => {
    body.appendChild(el("p", "note", `Raise your own banner with your cave abode as its mountain seat. It will gather disciples and prestige over the years, spread your name, quicken your dao, and pay you a stipend. Founding costs ${L.FOUND_SECT_COST} spirit stones.`));
    const input = el("input", "txtfield"); input.type = "text"; input.placeholder = "Name your sect (or leave it to fate)"; input.maxLength = 28;
    body.appendChild(input);
    const found = el("button", "mbtn full primary"); found.innerHTML = `Raise the Banner<small>${L.FOUND_SECT_COST} stones · you have ${c.spiritStones}</small>`;
    found.onclick = () => { runFree(() => L.foundSect(c, state.rng, input.value.trim() || null)); if (c.ownSect) award("founder"); };
    body.appendChild(found);
    backBtn(body, openSect);
  });
}
function openQuests() {
  const c = state.c;
  const REWARD_LABEL = { herbs: "+herbs", pill: "+pills", rep: "+fame", treasure: "+treasure" };
  openOverlay("Sect Missions 任务", body => {
    body.appendChild(el("p", "note", `Run missions to earn contribution toward promotion (you have run ${c.sectMissions || 0}). Higher ranks unlock graver, richer charges.`));
    for (const q of E.availableQuests(c)) {
      const bonus = REWARD_LABEL[q[6]] ? " · " + REWARD_LABEL[q[6]] : "";
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${icon("sect", { size: 18 })}</div><div class="lr-main"><div class="lr-title">${q[0]}</div><div class="lr-sub">+${q[2]} contrib · +${q[3]} stones${bonus} · risk ${Math.floor(q[4] * 100)}%<br>${q[5]}</div></div>`;
      row.onclick = () => { if (!ageAllows("quest")) return; runTimed(() => E.doQuest(c, state.rng, q)); };
      body.appendChild(row);
    }
    backBtn(body, openSect);
  });
}

/* --------------------------- character sheet ----------------------------- */
function openGlossary(backFn) {
  openOverlay("Glossary — what the stats mean", body => {
    body.appendChild(el("p", "note", "In-game, tap any stat chip up top, any vital bar, or any ⓘ row in your sheet for the same quick hint."));
    for (const k in GLOSSARY) {
      const g = GLOSSARY[k];
      body.appendChild(el("div", "listrow", `<div class="lr-main"><div class="lr-title">${escapeHtml(g[0])}</div><div class="lr-sub">${escapeHtml(g[1])}</div></div>`));
    }
    if (backFn) backBtn(body, backFn);
  });
}
function openSheet() {
  const c = state.c;
  openOverlay("Character Sheet", body => {
    const gloss = el("button", "mbtn full"); gloss.innerHTML = "ⓘ Glossary<small>tap any stat below, or here, to learn what it means</small>";
    gloss.onclick = () => openGlossary(openSheet); body.appendChild(gloss);
    body.appendChild(infoRows([
      ["Name", `${c.name} (${c.sex === "female" ? "♀" : "♂"})${(c.generation || 1) > 1 ? ` · gen ${c.generation}` : ""}`],
      ["Age", `${c.age} / ${c.maxAge}`, "age"],
      ["Realm", c.awakened ? `${E.realmLabel(c)} (${E.realmCn(c)})` : "Unawakened child", "realm"],
      ["Body Realm", `${D.bodyRealmName(c.bodyRealm || 0)} (${D.bodyRealmAt(c.bodyRealm || 0)[1]})`, "body"],
      ["Health / Happiness", `${Math.floor(c.health)} (${D.vitalLabel(c.health)}) / ${Math.floor(c.happiness)} (${D.vitalLabel(c.happiness)})`, "health"],
      ["Standing", `${c.reputation} (${D.standingLabel(c.reputation)})`, "fame"], ["Karma", `${c.karma >= 0 ? "+" : ""}${c.karma} (${E.karmaLabelFor(c)})`, "karma"],
      ...(c.era ? [["World Era", `${D.eraAt(c.era)[1]} (${D.eraAt(c.era)[2]})`, "era"]] : []),
    ]));
    body.appendChild(el("div", "section-h", "Born With"));
    body.appendChild(infoRows([
      ["Spiritual Root", c.awakened ? `${c.root.display}${c.root.elements.length ? " [" + c.root.elements.join(", ") + "]" : ""}` : "Unknown — awakens at age 6 (未测)", "root"],
      ["Physique", c.physiqueName, "physique"], ["Appearance", c.appearanceName], ["Standing", c.backgroundName],
    ]));
    // Spell out what this physique actually does, so it visibly matters.
    if (D.PHYSIQUE_EFFECTS[c.physiqueKey] && c.physiqueKey !== "ordinary")
      body.appendChild(el("p", "note", "✦ " + D.physEffect(c).desc));
    body.appendChild(el("div", "section-h", "Attributes"));
    const attrRow = (label, field, attr, tip) => [label, `${c[field]} · ${D.attrTier(attr, c[field]).name}`, tip];
    body.appendChild(infoRows([
      attrRow("Comprehension 悟性", "comprehension", "comprehension", "comprehension"),
      attrRow("Constitution 根骨", "constitution", "constitution", "constitution"),
      attrRow("Soul Sense 神识", "soul", "soul", "soul"),
      attrRow("Fortune 气运", "luck", "luck", "fortune"),
      attrRow("Charm 魅力", "charm", "charm", "charm"),
    ]));
    body.appendChild(el("div", "section-h", "Path"));
    const ab = D.abodeAt(c.abode || 0);
    const rows = [["Sect", c.ownSect ? `${c.ownSect.name} — Founder (${D.sectTier(c.ownSect.prestige)[1]})` : c.sectKey ? `${E.sectName(c)} — ${E.rankName(c)}` : "Rogue Cultivator"],
      ["Abode", ab ? `${ab[1]} (${ab[2]})${c.ownSect ? " · sect seat" : ""}` : "None", "abode"],
      ["Equipment", E.equipmentSummary(c)]];
    if (c.beast) rows.push(["Beast", `${c.beast.name} the ${c.beast.species}`]);
    if (c.legacySect && !c.ownSect) rows.push(["Past Sect", `${c.legacySect.name} (awaits your return)`]);
    if (c.daos.length) rows.push(["Daos", c.daos.map(d => D.DAO_BY_KEY[d][1]).join(", ")]);
    { const art = E.bestMovementArt(c); rows.push(["Movement 轻功", `${art ? `${D.MOVEMENT_BY_KEY[art][1]} (${E.moveRankName(E.moveFraction(c, art))})` : "—"} · ${E.hopsPerDeed(c)} stage${E.hopsPerDeed(c) > 1 ? "s" : ""}/deed`]); }
    if ((c.epithets || []).length) rows.push(["Monikers 名号", c.epithets.map(e => `「${e.text}」`).join(" "), "monikers"]);
    if (c.titles.length) rows.push(["Titles", c.titles.join(", ")]);
    body.appendChild(infoRows(rows));
    body.appendChild(el("div", "section-h", "Resources"));
    body.appendChild(infoRows([
      ["Spirit Stones", c.spiritStones], ["Spirit Herbs", c.herbs],
      ["Qi / Healing / Breakthrough Pills", `${c.pills} / ${c.healingPills} / ${c.breakthroughPills}`],
      ...(c.talismans && Object.values(c.talismans).some(n => n > 0) ? [["Talismans 符箓", D.TALISMAN_ORDER.filter(k => (c.talismans[k] || 0) > 0).map(k => `${D.TALISMANS[k].name.split(" ")[0]}×${c.talismans[k]}`).join(", ")]] : []),
      ["Techniques", [...c.techniques.map(t => D.TECHNIQUES[t][0]), ...(c.customTechs || []).map(ct => ct.name + " ✦")].join(", ")],
    ]));
    const ach = el("button", "mbtn full"); ach.innerHTML = "✦ Achievements & Legacy";
    ach.onclick = () => openAchievements(openSheet); body.appendChild(ach);
    body.appendChild(el("div", "section-h", "Life Chronicle"));
    for (const [age, text] of c.log.slice(-30)) body.appendChild(el("div", "chron-line", `<b>Age ${age}</b> — ${escapeHtml(text)}`));
  });
}
function infoRows(rows) {
  const wrap = el("div");
  for (const row of rows) {
    const [k, v, tip] = row;
    const r = el("div", "kv" + (tip ? " tappable" : ""));
    r.appendChild(el("span", "k", escapeHtml(String(k)) + (tip ? ' <span class="info-i">ⓘ</span>' : "")));
    r.appendChild(el("span", "v", escapeHtml(String(v))));
    if (tip) r.onclick = () => showTip(tip);
    wrap.appendChild(r);
  }
  return wrap;
}
function backBtn(body, fn) { const b = el("button", "mbtn full"); b.innerHTML = "‹ Back"; b.onclick = fn; body.appendChild(b); }
// A labelled progress bar. `right` overrides the default "val / max" readout.
function progress(parent, label, val, max, cls, right) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (val / max) * 100)) : 100;
  const p = el("div", "pbar");
  p.innerHTML = `<div class="pb-top"><span>${escapeHtml(label)}</span><span>${right != null ? right : Math.floor(val) + " / " + Math.floor(max)}</span></div>`
    + `<div class="pb-track"><div class="pb-fill ${cls || ""}" style="width:${pct}%"></div></div>`;
  parent.appendChild(p);
  return p;
}
// A navigation card that opens a nested sub-menu (icon tile · title · sub · chevron).
function navCard(grid, icon, title, sub, onclick) {
  const b = el("button", "mbtn nav full");
  b.innerHTML = `<span class="mb-ico">${icon}</span><span class="mb-txt"><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></span>`;
  b.onclick = onclick;
  grid.appendChild(b);
  return b;
}

/* --------------------------- death & rebirth ----------------------------- */
function checkDeath() { if (!state.c.alive && !state.deadHandled) deathScreen(); }
function deathScreen() {
  state.deadHandled = true;
  const c = state.c;
  logBanner("☠ THE THREAD OF FATE IS CUT ☠");
  logMessages([`${c.name} died at age ${c.age} — ${c.causeOfDeath}.`, `Final attainment: ${c.awakened ? E.realmLabel(c) : "a mortal life"}.`, E.epitaph(c)]);
  openOverlay("Death", body => {
    body.appendChild(el("div", "center-card", `<div style="font-size:2.4rem">🕯️</div>`));
    body.appendChild(el("p", "note", `<b>${escapeHtml(c.name)}</b> reached <b>${c.awakened ? E.realmLabel(c) : "a mortal life"}</b> and died at age ${c.age} — ${escapeHtml(c.causeOfDeath)}.`));
    body.appendChild(el("p", "note", E.epitaph(c)));
    const rein = el("button", "mbtn full primary");
    rein.innerHTML = "Reincarnate<small>be reborn carrying your soul's legacy</small>";
    rein.onclick = () => {
      state.c = L.reincarnateLife(c, state.rng); applyFavor(state.c); state.deeds = defaultDeeds(); state.deadHandled = false; closeOverlay();
      logBanner("☯ THE WHEEL OF REBIRTH TURNS ☯");
      const msgs = [`A new soul is born — ${state.c.name} (Rebirth #${state.c.reincarnationCount}), dimly recalling a former life.`, "Age up to live this new life. Your past climb has sharpened your innate talent."];
      if (state.c.legacySect) msgs.push(`Far away, the ${state.c.legacySect.name} you founded in a past life still keeps your banner — reach the Nascent Soul realm with a worthy abode, and you may reclaim it.`);
      logMessages(msgs);
      renderProfile();
    };
    body.appendChild(rein);
    const heirs = L.eligibleHeirs(c);
    if (heirs.length) {
      const h = el("button", "mbtn full");
      h.innerHTML = `Continue as your Heir<small>play on as your child · inherit the family's legacy</small>`;
      h.onclick = () => heirs.length === 1 ? beginHeir(c, heirs[0]) : openHeirPicker(c, heirs);
      body.appendChild(h);
    }
    const fresh = el("button", "mbtn full"); fresh.innerHTML = "Let the Soul Rest<small>roll a brand-new, unrelated soul</small>";
    fresh.onclick = () => { clearSave(); startScreen(); };
    body.appendChild(fresh);
  }, false);
}
function openHeirPicker(old, heirs) {
  openOverlay("Choose your Heir", body => {
    body.appendChild(el("p", "note", "Which of your children will carry the bloodline onward?"));
    for (const k of heirs) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${k.sex === "female" ? "👧" : "👦"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(k.name)}</div><div class="lr-sub">${k.kin}, age ${L.childAge(old, k)}${k._awakened ? " · awakened" : ""}</div></div>`;
      row.onclick = () => beginHeir(old, k);
      body.appendChild(row);
    }
  }, false);
}
function beginHeir(old, child) {
  const heir = L.succeedAsHeir(old, child, state.rng);
  state.c = heir; state.rng = new E.RNG(); applyFavor(heir);
  state.deeds = defaultDeeds(); state.deadHandled = false; closeOverlay();
  $("log").innerHTML = "";
  logBanner("⚑ THE BLOODLINE ENDURES ⚑");
  const surname = old.name.split(" ")[0];
  logMessages([
    `${heir.name} takes up the mantle of the ${surname} family — now ${heir.generation} generations strong.`,
    `You inherit the family estate and a share of its fortune${heir.ownSect ? `, and leadership of the ${heir.ownSect.name} your forebear founded` : ""}. Carry the lineage onward.`,
  ]);
  renderProfile(); save();
}

/* ------------------------------ birth ------------------------------------ */
function renderBirth(c) {
  logBanner("✺ A NEW SOUL IS BORN ✺");
  logMessages([
    `A child enters the world: ${c.name}, ${c.sex === "female" ? "a girl" : "a boy"}.`,
    c.omen, "",
    `Born into — ${c.backgroundName}`, "  " + c.backgroundBlurb, "",
    `Physique — ${c.physiqueName}`, "  " + c.physiqueBlurb, "",
    `Appearance — ${c.appearanceName}`, "  " + c.appearanceBlurb, "",
    `The family's spiritual root is still a mystery. The Awakening Ceremony comes at age ${D.AWAKENING_AGE}.`,
    `✦ Each year you have three deeds of each kind — ☯ Cultivation, ⚔ Activities, and ❤ Social. Only the ⊕ Age Up button passes a year and fires life events — and refreshes them all.`,
    "ⓘ Tip: tap any stat (Age, Karma, Fame…) or the ⓘ Glossary in your sheet to learn what it means.",
  ]);
}

/* ------------------------------ start ------------------------------------ */
// Commit a finished character and begin the life.
function beginLife(c) {
  state.c = c; state.rng = new E.RNG();
  applyFavor(c); state.deeds = defaultDeeds(); state.deadHandled = false;
  closeOverlay(); $("log").innerHTML = ""; renderBirth(c); renderProfile();
}

function startScreen() {
  state.deadHandled = false;
  let chosenSex = null;
  openOverlay("The Nine Heavens", body => {
    const card = el("div", "center-card");
    card.appendChild(el("div", "title-zh", "九 重 天"));
    card.appendChild(el("div", "title-en", "A xianxia life — from birth to immortality, one year at a time"));
    const input = el("input", "txtfield"); input.type = "text"; input.placeholder = "Name your cultivator (or leave to fate)"; input.maxLength = 24;
    card.appendChild(input);
    const seg = el("div", "seg");
    [[`${icon("dice", { size: 16 })} Random`, null], ["♀ Girl", "female"], ["♂ Boy", "male"]].forEach(([lab, val], i) => {
      const b = el("button", i === 0 ? "on" : "", lab);
      b.onclick = () => { chosenSex = val; seg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
      seg.appendChild(b);
    });
    card.appendChild(seg);
    const begin = el("button", "mbtn full primary");
    begin.innerHTML = `<span class="mb-line">${icon("dice", { size: 18 })}Roll a Soul &amp; Begin</span><small>your fate is decided by the heavens</small>`;
    begin.onclick = () => beginLife(L.bornCharacter(new E.RNG(), input.value.trim() || null, chosenSex));
    const custom = el("button", "mbtn full");
    custom.innerHTML = `<span class="mb-line">${icon("brush", { size: 18 })}Create Your Soul</span><small>choose root, physique, looks, standing &amp; more</small>`;
    custom.onclick = () => openCreator(input.value.trim(), chosenSex);
    const sv = loadSave();
    if (sv && sv.c) {
      const cont = el("button", "mbtn full");
      cont.innerHTML = `<span class="mb-line">${icon("chevron", { size: 18 })}Continue Your Saga</span><small>${escapeHtml(sv.c.name)} · age ${sv.c.age}</small>`;
      cont.onclick = () => resumeFrom(sv);
      body.appendChild(cont);
    }
    body.appendChild(card);
    body.appendChild(begin);
    body.appendChild(custom);
    const ach = el("button", "mbtn full");
    ach.innerHTML = `<span class="mb-line">${icon("trophy", { size: 18 })}Achievements &amp; Legacy</span><small>Heavenly Favor: ${meta.favor()}</small>`;
    ach.onclick = () => openAchievements(startScreen);
    body.appendChild(ach);
  }, false);
}

/* ------------------------- character creator ----------------------------- */
function creatorOpts() {
  const cr = state.creator, o = {};
  if (cr.rootKey) o.rootKey = cr.rootKey;
  if (cr.physiqueKey) o.physiqueKey = cr.physiqueKey;
  if (cr.appearanceKey) o.appearanceKey = cr.appearanceKey;
  if (cr.backgroundKey) o.backgroundKey = cr.backgroundKey;
  if (cr.omenIndex !== "") o.omenIndex = Number(cr.omenIndex);
  return o;
}
function rebuildPreview() {
  const cr = state.creator;
  cr.preview = L.bornCharacter(new E.RNG(), cr.name || null, cr.sex || null, creatorOpts());
}
function crSelect(label, options, current, onChange) {
  const wrap = el("div", "cr-field");
  wrap.appendChild(el("div", "cr-label", label));
  const sel = el("select", "cr-select");
  for (const o of options) { const op = el("option"); op.value = o.v; op.textContent = o.t; if (String(o.v) === String(current)) op.selected = true; sel.appendChild(op); }
  sel.value = current == null ? "" : String(current);
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.appendChild(sel);
  return wrap;
}
function openCreator(name, sex) {
  if (!state.creator) state.creator = { rootKey: "", physiqueKey: "", appearanceKey: "", backgroundKey: "", omenIndex: "" };
  state.creator.name = name || state.creator.name || "";
  state.creator.sex = sex !== undefined ? sex : state.creator.sex;
  rebuildPreview();
  renderCreator();
}
function renderCreator() {
  const cr = state.creator;
  openOverlay("Create Your Soul", body => {
    const nameIn = el("input", "txtfield"); nameIn.type = "text"; nameIn.placeholder = "Name (or leave to fate)"; nameIn.maxLength = 24; nameIn.value = cr.name || "";
    nameIn.addEventListener("input", () => { cr.name = nameIn.value; });
    body.appendChild(nameIn);

    const seg = el("div", "seg");
    [["🎲 Random", null], ["♀ Girl", "female"], ["♂ Boy", "male"]].forEach(([lab, val]) => {
      const b = el("button", cr.sex === val ? "on" : "", lab);
      b.onclick = () => { cr.sex = val; rebuildPreview(); renderCreator(); };
      seg.appendChild(b);
    });
    body.appendChild(seg);

    const rand = { v: "", t: "🎲 Random" };
    const change = (key) => (v) => { cr[key] = v; rebuildPreview(); renderCreator(); };
    body.appendChild(crSelect("Spiritual Root 灵根", [rand, ...D.ROOT_TYPES.map(r => ({ v: r[0], t: r[1] }))], cr.rootKey, change("rootKey")));
    body.appendChild(crSelect("Physique 体质", [rand, ...D.PHYSIQUES.map(p => ({ v: p[0], t: p[1] }))], cr.physiqueKey, change("physiqueKey")));
    body.appendChild(crSelect("Appearance 容貌", [rand, ...D.APPEARANCES.map(a => ({ v: a[0], t: a[1] }))], cr.appearanceKey, change("appearanceKey")));
    body.appendChild(crSelect("Birth Standing 出身", [rand, ...D.BACKGROUNDS.map(b => ({ v: b[0], t: b[1] }))], cr.backgroundKey, change("backgroundKey")));
    body.appendChild(crSelect("Birth Omen 异象", [rand, ...D.BIRTH_OMENS.map((o, i) => ({ v: String(i), t: o[0].length > 40 ? o[0].slice(0, 38) + "…" : o[0] }))], cr.omenIndex, change("omenIndex")));

    body.appendChild(el("div", "section-h", "Preview"));
    body.appendChild(creatorPreviewCard(cr.preview));

    const reroll = el("button", "mbtn full");
    reroll.innerHTML = "🎲 Reroll the Random Parts<small>re-rolls attributes &amp; anything left to fate</small>";
    reroll.onclick = () => { rebuildPreview(); renderCreator(); };
    body.appendChild(reroll);

    const begin = el("button", "mbtn full primary");
    begin.innerHTML = "Begin This Life<small>born as previewed above</small>";
    begin.onclick = () => beginLife(cr.preview);
    body.appendChild(begin);

    backBtn(body, startScreen);
  }, false);
}
// A one-line read on how promising a birth is (spiritual root dominates).
function birthVerdict(c) {
  const special = c.physiqueKey !== "ordinary";
  const score = c.root.multiplier * 45
    + (c.comprehension + c.luck + (c.soul + c.constitution) / 2) / 3 * 0.5
    + c.reputation * 0.3 + (special ? 35 : 0);
  if (score > 160) return "The heavens have lavished gifts upon you. A dragon among men.";
  if (score > 108) return "A genuinely blessed birth. Sects would war over you.";
  if (score > 68) return "A solid hand of cards. Your fate is yours to make.";
  if (score > 40) return "An unremarkable start. The climb will be steep but not closed.";
  return "The dao has dealt you ashes. Only sheer will could forge a legend from this.";
}
function creatorPreviewCard(c) {
  if (!c) return el("div");
  const wrap = el("div", "cr-preview");
  wrap.appendChild(el("div", "cr-pv-top", `${D.avatarFor(c, 22)} <b>${escapeHtml(c.name)}</b> · ${c.sex === "female" ? "♀" : "♂"}`));
  const tg = (field, attr) => `${c[field]} (${D.attrTier(attr, c[field]).name})`;
  const rows = [
    ["Spiritual Root", `${c.root.display}${c.root.elements.length ? " [" + c.root.elements.join(", ") + "]" : ""}`],
    ["Physique", c.physiqueName], ["Appearance", c.appearanceName], ["Standing", c.backgroundName],
    ["Omen", c.omen.length > 46 ? c.omen.slice(0, 44) + "…" : c.omen],
    ["Comprehension", tg("comprehension", "comprehension")], ["Constitution", tg("constitution", "constitution")],
    ["Soul Sense", tg("soul", "soul")], ["Fortune", tg("luck", "luck")], ["Charm", tg("charm", "charm")],
  ];
  wrap.appendChild(infoRows(rows));
  if (D.PHYSIQUE_EFFECTS[c.physiqueKey] && c.physiqueKey !== "ordinary")
    wrap.appendChild(el("p", "note", "✦ " + D.physEffect(c).desc));
  wrap.appendChild(el("p", "note", "✦ " + birthVerdict(c)));
  return wrap;
}
function resumeFrom(sv) {
  state.c = sv.c; state.rng = new E.RNG(0); state.rng.s = sv.s >>> 0; state.deadHandled = false;
  state.deeds = defaultDeeds();
  // Back-compat: ensure life-sim fields exist on older saves.
  const c = state.c;
  if (typeof c.happiness !== "number") c.happiness = 55;
  if (typeof c.health !== "number") c.health = 60;
  if (typeof c.awakened !== "boolean") c.awakened = true;
  if (!c.firedEvents) c.firedEvents = [];
  if (!c.eventCooldowns) c.eventCooldowns = {};
  if (!c.sex) c.sex = "male";
  if (!c.mastery) c.mastery = {};
  if (!c.epithets) c.epithets = [];
  if (c.sectMissions == null) c.sectMissions = 0;
  if (c.sectJoinedAge === undefined) c.sectJoinedAge = c.sectKey ? c.age : null;
  if (!c.artifacts) c.artifacts = [];
  E.ensureEquipment(c);   // migrate legacy single-slot treasure → equipment slots
  if (!c.movementArts) c.movementArts = [];
  if (!c.moveMastery) c.moveMastery = {};
  if (!c.customTechs) c.customTechs = [];
  if (c.ownSect && !c.ownSect.library) c.ownSect.library = [];
  if (!c.region) c.region = "azuredomain";
  W.ensureWorld(c, state.rng);   // old saves get a freshly generated realm, located sensibly
  closeOverlay(); $("log").innerHTML = ""; logBanner("☯ YOUR SAGA CONTINUES ☯"); renderProfile();
  if (!c.alive) checkDeath();
}
function startOrDeath() { if (!state.c) startScreen(); else if (!state.c.alive) checkDeath(); }

/* ---------------------------- combat minigame ---------------------------- */
const STATUS_EMOJI = { burn: "🔥", bleed: "🩸", empower: "💪", weaken: "💢", stun: "💫", regen: "💚" };
function statusChips(u) {
  let s = "";
  if (u.shield > 0) s += `🛡️${Math.round(u.shield)} `;
  for (const st of u.statuses) s += `${STATUS_EMOJI[st.type] || "•"}${st.turns} `;
  return s.trim();
}
function unitPanel(u, isPlayer) {
  const p = el("div", "cbt-unit" + (isPlayer ? " you" : ""));
  const elemIcon = isPlayer ? "🧘" : C.elementIcon(u.element);
  let html = `<div class="cu-top"><span class="cu-name">${elemIcon} ${escapeHtml(u.name)}</span><span class="cu-status">${statusChips(u)}</span></div>`;
  html += `<div class="hpbar"><div class="hpfill${isPlayer ? " you" : ""}" style="width:${clampPct(u.hp, u.maxHp)}%"></div><span>${Math.max(0, Math.round(u.hp))}/${Math.round(u.maxHp)}</span></div>`;
  if (isPlayer) html += `<div class="qibar"><div class="qifill" style="width:${clampPct(u.qi, u.maxQi)}%"></div><span>Qi ${Math.round(u.qi)}/${Math.round(u.maxQi)}</span></div>`;
  if (isPlayer) {
    const c = u.ref, side = [];
    if (c.beast && c.beast.alive) side.push(`🐾 ${escapeHtml(c.beast.name)}`);
    if (u.ally) side.push(`⚔ ${escapeHtml(u.ally.name)}`);
    if (side.length) html += `<div class="cu-status" style="margin-top:4px">at your side: ${side.join(" · ")}</div>`;
  }
  p.innerHTML = html;
  return p;
}
function startBattle(enemyDef, opts, onDone) {
  const B = C.createBattle(state.c, enemyDef, state.rng, opts || {});
  if (enemyDef.tribulation)
    B.feed = ["⚡ The Heavenly Tribulation descends! Endure the lightning and disperse the cloud before it scatters your soul — there is no fleeing this."];
  else if (enemyDef.boss)
    B.feed = [`☠ The ${enemyDef.name} looms before you — a foe far beyond common rabble. (power ≈ ${Math.round(enemyDef.power)}, you ≈ ${Math.round(E.power(state.c))})`];
  else
    B.feed = [`⚔ A ${enemyDef.name} faces you!  (foe ≈ ${Math.round(enemyDef.power)}, you ≈ ${Math.round(E.power(state.c))})`];
  renderBattleScreen(B, onDone);
}
function doBreakthrough() {
  const c = state.c; if (!c.alive || !E.canBreakthrough(c)) return; closeOverlay();
  const msgs = E.attemptBreakthrough(c, state.rng, { deferTribulation: true });
  logMessages(msgs);
  if (c.alive && c._tribulationPending) {
    c._tribulationPending = false;
    startBattle(C.makeTribulation(c, state.rng), { title: "Heavenly Tribulation ⚡" }, () => afterBreakthrough());
  } else { afterBreakthrough(); }
}
function afterBreakthrough() {
  const c = state.c;
  renderProfile(); save();
  if (c.alive && c.realm >= D.REALMS.length - 1 && !c.ascended) { ascensionFinale(); return; }
  checkDeath();
}
function ascensionFinale() {
  const c = state.c;
  c.ascended = true;
  if (!c.titles.includes("Ascended Immortal")) c.titles.push("Ascended Immortal");
  meta.bump("ascensions");
  award("ascend");
  logBanner("✸ YOU ASCEND TO THE NINE HEAVENS ✸");
  logMessages([
    `Having shattered the final wall and survived the last tribulation, ${c.name} sheds the dust of the mortal world.`,
    "A great gate of golden light tears open the sky. Immortal music swells; the heavens themselves bow to acknowledge a new immortal.",
    "Few in ten thousand years walk this road to its end. You are one of them.",
  ]);
  openOverlay("Ascension 飞升", body => {
    body.appendChild(el("div", "center-card", `<div style="font-size:2.6rem">✸🌟✸</div>`));
    body.appendChild(el("div", "title-zh", "飞升"));
    body.appendChild(el("p", "note", `<b>${escapeHtml(c.name)}</b> has reached <b>${E.realmLabel(c)}</b> and stands before the Heavenly Gate — a true Ascended Immortal. Your bloodline, your sect, and the world will tell this tale for ten thousand years.`));
    body.appendChild(el("p", "note", "Every soul you raise hereafter is born the more gifted for this triumph."));
    const go = el("button", "mbtn full primary");
    go.innerHTML = "Step through the Heavenly Gate<small>ascend in glory — conclude this saga</small>";
    go.onclick = () => { closeOverlay(); concludeAscension(); };
    body.appendChild(go);
    const stay = el("button", "mbtn full");
    stay.innerHTML = "Linger in the mortal world<small>walk among mortals as an immortal a while longer</small>";
    stay.onclick = () => { closeOverlay(); logMessages(["You turn from the gate, unwilling yet to leave the mortal world and those within it. The immortal heavens can wait."]); renderProfile(); };
    body.appendChild(stay);
  }, false);
}
// A triumphant close — the immortal departs; the saga continues through legacy.
function concludeAscension() {
  const c = state.c;
  c.alive = false; c.causeOfDeath = "ascension to the Nine Heavens"; state.deadHandled = true;
  c.log.push([c.age, "Ascended to the Nine Heavens."]);
  logBanner("✸ A LEGEND PASSES INTO IMMORTALITY ✸");
  openOverlay("Ascended", body => {
    body.appendChild(el("div", "center-card", `<div style="font-size:2.6rem">🌅</div>`));
    body.appendChild(el("p", "note", `<b>${escapeHtml(c.name)}</b> ascends beyond the mortal world, leaving behind a legend — and a bloodline, a sect, and a name that endures.`));
    body.appendChild(el("p", "note", `Heavenly Favor and the echo of your Ascension will bless every soul you raise hereafter.`));
    const rein = el("button", "mbtn full primary");
    rein.innerHTML = "Begin a New Saga<small>be reborn, carrying your soul's legacy</small>";
    rein.onclick = () => {
      state.c = L.reincarnateLife(c, state.rng); applyFavor(state.c); state.deeds = defaultDeeds(); state.deadHandled = false; closeOverlay();
      logBanner("☯ THE WHEEL OF REBIRTH TURNS ☯");
      logMessages([`A new soul is born — ${state.c.name} (Rebirth #${state.c.reincarnationCount}), the heir of an ascended immortal's legend.`]);
      renderProfile();
    };
    body.appendChild(rein);
    const heirs = L.eligibleHeirs(c);
    if (heirs.length) {
      const h = el("button", "mbtn full");
      h.innerHTML = `Continue as your Heir<small>play on as your child · inherit the legacy</small>`;
      h.onclick = () => heirs.length === 1 ? beginHeir(c, heirs[0]) : openHeirPicker(c, heirs);
      body.appendChild(h);
    }
    const fresh = el("button", "mbtn full"); fresh.innerHTML = "Let the Soul Rest<small>roll a brand-new soul</small>";
    fresh.onclick = () => { clearSave(); startScreen(); };
    body.appendChild(fresh);
  }, false);
}
function doBossFight() {
  if (!ageAllows("boss") || !useAction()) return;
  const c = state.c; closeOverlay();
  const boss = C.makeBoss(c, state.rng, { factorMult: worldDanger(c) });
  logMessages([`You seek out a fearsome adversary — the ${boss.name} accepts your challenge!`]);
  startBattle(boss, { title: `Boss · ${boss.name}` }, () => endActivityYear());
}
/* ----------------------- alchemy furnace minigame ------------------------ */
// Keep the heat needle inside the drifting target band over several phases to
// build pill quality; stray too far and instability risks an explosion.
function brewZone(c) { return Math.round(Math.min(52, 18 + c.soul / 8 + c.comprehension / 14 + c.alchemySkill * 0.4 + E.abodeAlchemyBonus(c) * 90)); }
function startBrew(recipe) {
  const c = state.c; if (c.herbs < recipe[2]) return;
  if (!useAction()) return;
  closeOverlay();
  c.herbs -= recipe[2];
  const rng = state.rng;
  state.brew = { recipe, heat: 50, target: rng.randint(38, 62), zone: brewZone(c), rounds: 4, round: 1, quality: 0, instability: 0, msg: "Stoke the furnace and keep the flame within the jade band." };
  renderBrew();
}
function renderBrew() {
  const B = state.brew;
  openOverlay("Pill Furnace 丹炉", body => {
    body.appendChild(el("p", "note", `Refining ${B.recipe[1]} — phase ${Math.min(B.round, B.rounds)}/${B.rounds}.`));
    const zoneLeft = clampPct(B.target - B.zone / 2, 100), zoneW = Math.min(100 - zoneLeft, (B.zone / 100) * 100);
    const gauge = el("div", "brew");
    gauge.innerHTML = `<div class="brew-gauge"><div class="brew-band" style="left:${zoneLeft}%;width:${zoneW}%"></div><div class="brew-needle" style="left:${clampPct(B.heat, 100)}%"></div></div>
      <div class="brew-stats"><span>🔥 Heat ${Math.round(B.heat)}</span><span>✦ Quality ${B.quality}/${B.rounds * 2}</span><span>⚠ Instability ${B.instability}/5</span></div>`;
    body.appendChild(gauge);
    body.appendChild(el("div", "line " + (B.msg.startsWith("✦") ? "epic" : B.msg.startsWith("⚠") || B.msg.startsWith("💥") ? "bad" : "sub"), escapeHtml(B.msg)));
    if (B.done) {
      const cont = el("button", "mbtn full primary"); cont.innerHTML = "Withdraw the Pill<small>see the result</small>";
      cont.onclick = applyBrew; body.appendChild(cont);
    } else {
      const grid = el("div", "menu-grid");
      const mk = (l, s, d) => { const b = el("button", "mbtn"); b.innerHTML = `${l}<small>${s}</small>`; b.onclick = () => brewAct(d); grid.appendChild(b); };
      mk("Lower Flame", "−heat", -14); mk("Hold Steady", "±0", 0); mk("Raise Flame", "+heat", 14);
      const stoke = el("button", "mbtn full"); stoke.innerHTML = "Bellows Surge<small>+big heat</small>"; stoke.onclick = () => brewAct(26); grid.appendChild(stoke);
      body.appendChild(grid);
    }
  }, false);
}
function brewAct(delta) {
  const B = state.brew, rng = state.rng;
  B.heat = Math.max(0, Math.min(100, B.heat + delta + rng.uniform(-3, 3)));
  const dist = Math.abs(B.heat - B.target);
  if (dist <= B.zone / 2) { B.quality += 2; B.msg = "✦ Perfect balance — the pill's essence purifies."; }
  else if (dist <= B.zone) { B.quality += 1; B.msg = "The furnace holds steady; the pill takes shape."; }
  else { const inc = dist > B.zone * 2 ? 2 : 1; B.instability += inc; B.msg = "⚠ The flame lurches wildly — instability rises!"; }
  if (B.instability >= 5 || B.round >= B.rounds) B.done = true;
  else { B.round++; B.target = Math.max(15, Math.min(85, B.target + rng.uniform(-15, 15))); }
  renderBrew();
}
function applyBrew() {
  const c = state.c, B = state.brew, rng = state.rng;
  c.alchemySkill += 1;
  let msgs;
  if (B.instability >= 5) {
    const salv = Math.floor(B.recipe[2] / 3); c.herbs += salv;
    msgs = [`💥 The furnace erupts! The ${B.recipe[1]} is lost. (salvaged ${salv} herbs)`];
  } else {
    const q = B.quality; let grade, mult;
    if (q >= 7) { grade = "Flawless"; mult = 2.2; award("alchemist"); } else if (q >= 4) { grade = "Fine"; mult = 1.4; } else { grade = "Crude"; mult = 0.8; }
    msgs = [`You withdraw a ${grade} ${B.recipe[1]} (quality ${q}/${B.rounds * 2}).`].concat(E.grantPill(c, B.recipe[0], rng, mult));
  }
  state.brew = null; closeOverlay(); logMessages(msgs); endActivityYear();
}

/* --- Secret Realm: a multi-stage delve with carried wounds and a guardian --- */
function doSecretRealm() {
  if (!ageAllows("secret") || !useAction()) return;
  const c = state.c; closeOverlay();
  const depth = 3 + Math.floor(state.rng.random() * 3); // 3-5 stages incl. guardian
  // Each realm has an elemental character; its treasures share that attunement.
  const elem = state.rng.choice(E.TREASURE_ELEMENTS);
  state.realmRun = { depth, idx: 0, hpFrac: 1, element: elem };
  logMessages([`You step through a shimmering rift into a ${C.elementIcon(elem)} ${elem}-attuned Secret Realm — the qi here is thick as honey, and the danger thicker still.`]);
  realmStage();
}
function realmStage() {
  const c = state.c, R = state.realmRun;
  if (R.idx >= R.depth) { realmComplete(); return; }
  const stageNo = R.idx + 1, last = R.idx === R.depth - 1;
  if (last) {
    const guardian = C.makeBoss(c, state.rng, { name: "the Realm Guardian", factor: 1.4 + state.rng.random() * 0.2, element: "Earth", factorMult: worldDanger(c) });
    logMessages([`Stage ${stageNo}/${R.depth} — ${guardian.name} bars the inner sanctum!`]);
    startBattle(guardian, { title: "Secret Realm · Guardian", startHpFrac: R.hpFrac }, o => realmAfterBattle(o));
    return;
  }
  if (state.rng.random() < 0.6) {
    const enemy = C.makeEnemy(c, state.rng, { factor: 0.8 + R.idx * 0.15, factorMult: worldDanger(c) });
    logMessages([`Stage ${stageNo}/${R.depth} — a ${enemy.name} lurks in the mist.`]);
    startBattle(enemy, { title: `Secret Realm · Stage ${stageNo}`, startHpFrac: R.hpFrac }, o => realmAfterBattle(o));
  } else {
    logMessages([`Stage ${stageNo}/${R.depth} —`].concat(realmFortune(c)));
    R.idx++;
    realmPrompt();
  }
}
function realmAfterBattle(outcome) {
  const c = state.c, R = state.realmRun;
  if (!c.alive) { state.realmRun = null; renderProfile(); checkDeath(); return; }
  if (outcome !== "win") { logMessages(["You withdraw from the realm with the spoils you have."]); realmEnd(false); return; }
  // A brief breather between stages, but wounds still carry forward.
  R.hpFrac = Math.min(1, Math.max(0.12, c.hp / c.maxHp) + 0.25);
  R.idx++;
  if (R.idx >= R.depth) realmComplete();
  else realmPrompt();
}
function realmFortune(c) {
  const rng = state.rng, r = rng.random();
  if (r < 0.3) return E.acquireArtifact(c, E.randomArtifact(c, rng, null, { element: (state.realmRun && state.realmRun.element) || null }));
  if (r < 0.55) { const h = rng.randint(5, 12) + c.realm; c.herbs += h; return [`a grove of spirit herbs — you harvest ${h}.`]; }
  if (r < 0.72) { c.pills += rng.randint(1, 3); return ["a dusty pill cache, still potent."]; }
  if (r < 0.86) { c.hp = c.maxHp; const R = state.realmRun; if (R) R.hpFrac = 1; return ["a tranquil spirit spring — you bathe and recover fully."]; }
  c.qi += E.qiToNext(c) * 0.5; return ["an ancient dao inscription — insight floods you and your qi surges."];
}
function realmPrompt() {
  const R = state.realmRun;
  openOverlay("Secret Realm", body => {
    body.appendChild(el("p", "note", `You have cleared ${R.idx} of ${R.depth} stages. Press deeper for richer spoils — or withdraw now and keep what you hold.`));
    const deeper = el("button", "mbtn full primary"); deeper.innerHTML = "Press Deeper<small>greater danger, greater reward</small>";
    deeper.onclick = () => { closeOverlay(); realmStage(); };
    body.appendChild(deeper);
    const out = el("button", "mbtn full"); out.innerHTML = "Withdraw with Your Spoils<small>end the delve safely</small>";
    out.onclick = () => { closeOverlay(); logMessages(["You retrace your steps and leave the realm, spoils in hand."]); realmEnd(false); };
    body.appendChild(out);
  }, false);
}
function realmComplete() {
  const c = state.c, R = state.realmRun;
  const stones = (c.realm + 2) * state.rng.randint(15, 30);
  c.spiritStones += stones; c.reputation += 5;
  const lines = [`✦ You conquer the Secret Realm to its very heart! (+${stones} spirit stones, +5 reputation)`];
  if (c.sectKey) { c.contribution += 80; lines.push("  Your charted findings earn +80 sect contribution."); }
  if (state.rng.random() < 0.5) { const t = realmFortune(c); lines.push("  In the inner sanctum: " + t[0]); }
  const title = "Secret Realm Delver";
  if (!c.titles.includes(title)) { c.titles.push(title); c.log.push([c.age, "Conquered a Secret Realm."]); lines.push(`  ✦ You earn the title: ${title}!`); }
  logMessages(lines);
  realmEnd(true);
}
function realmEnd() { state.realmRun = null; endActivityYear(); }
function doTournament() {
  const c = state.c; if (!c.alive || !c.sectKey) return;
  if (!ageAllows("tournament") || !useAction()) return;
  closeOverlay();
  state.tourney = { round: 1, max: 4, won: 0 };
  logMessages([`⚑ The ${E.sectName(c)} grand tournament begins — 16 disciples enter the ring.`]);
  tourneyRound();
}
function tourneyRound() {
  const c = state.c, t = state.tourney;
  const remaining = 16 / Math.pow(2, t.round - 1);
  const label = ({ 16: "Round of 16", 8: "Quarter-final", 4: "Semi-final", 2: "Final" })[remaining] || `Round ${t.round}`;
  const factor = 0.85 + t.round * 0.10;
  const enemy = remaining === 2
    ? C.makeBoss(c, state.rng, { name: "the Reigning Champion", factor: Math.max(1.2, factor + 0.25) })
    : C.makeEnemy(c, state.rng, { kind: "rogue", name: `${E.npcName(state.rng)} (rival disciple)`, factor });
  logMessages([`${label}: you step up against ${enemy.name}.`]);
  startBattle(enemy, { title: `Tournament · ${label}`, nonLethal: true, noSpoils: true }, (outcome) => {
    if (!state.c.alive) { renderProfile(); checkDeath(); return; }
    if (outcome === "win") {
      t.won++; t.round++;
      if (t.round > t.max) tourneyEnd(1, t.won);
      else { renderProfile(); save(); tourneyRound(); }
    } else tourneyEnd(remaining, t.won);
  });
}
function tourneyEnd(placement, won) {
  const c = state.c, rng = state.rng;
  const contribution = won * 40 + (placement === 1 ? 120 : 0);
  const rep = won * 3 + (placement === 1 ? 20 : 0);
  const stones = won * 15;
  c.contribution += contribution; c.reputation += rep; c.spiritStones += stones;
  let title = null;
  for (const [cut, name] of D.TOURNAMENT_TITLES) if (placement <= cut) { title = name; break; }
  const lines = [`The tournament ends — you place in the top ${Math.max(1, placement)}.`,
    `Rewards: +${contribution} contribution, +${rep} reputation, +${stones} spirit stones.`];
  if (placement === 1) { c.pills += 3; lines.push("As Champion you are awarded a Foundation Pill and 3 pills!"); }
  if (title) {
    const h = `Tournament ${title}`;
    if (!c.titles.includes(h)) c.titles.push(h);
    c.log.push([c.age, `Placed as ${title} in the ${E.sectName(c)} tournament.`]);
    lines.push(`✦ You earn the title: ${title}!`);
    if (placement === 1) lines.push(...E.maybeAwardEpithet(c, rng, { base: 0.4 }));
    if (placement <= 2 && !c.relationships.some(n => n.role === "companion" && n.alive) && rng.random() < 0.3 + c.charm / 400) {
      const npc = { name: E.npcName(rng), role: "companion", affinity: 35, power: E.power(c) * rng.uniform(0.7, 1.3), alive: true };
      c.relationships.push(npc); lines.push(`Your brilliance in the arena catches the eye of ${npc.name}, who seeks you out afterward...`);
    }
  }
  logMessages(lines);
  state.tourney = null;
  endActivityYear();
}
function renderBattleScreen(B, onDone) {
  openOverlay(B.opts.title || "Battle", body => {
    body.appendChild(unitPanel(B.enemy, false));
    body.appendChild(el("div", "cbt-vs", `— turn ${B.turn} —`));
    const feed = el("div", "cbt-feed");
    (B.feed || []).slice(-9).forEach(l => feed.appendChild(el("div", "line " + classify(l), escapeHtml(l))));
    body.appendChild(feed);
    body.appendChild(unitPanel(B.player, true));
    if (B.over) {
      const cont = el("button", "mbtn full primary");
      cont.innerHTML = `Continue<small>${B.outcome === "win" ? "victory!" : B.outcome === "lose" ? "defeat..." : B.outcome === "yield" ? "you yield" : "you flee"}</small>`;
      cont.onclick = () => { const sum = B.finish(); closeOverlay(); logMessages(sum); if (B.outcome === "win") award("first_blood"); if (onDone) onDone(B.outcome); };
      body.appendChild(cont);
    } else {
      const grid = el("div", "cbt-actions");
      for (const a of B.actions()) {
        const b = el("button", "cbt-skill" + (a.disabled ? " off" : "") + (a.id === "flee" ? " flee" : ""));
        b.innerHTML = `<span class="cs-name">${a.element ? C.elementIcon(a.element) + " " : ""}${escapeHtml(a.name)}</span>`
          + (a.desc ? `<span class="cs-desc">${escapeHtml(a.desc)}</span>` : "")
          + `<span class="cs-cost">${a.qi ? "⊙" + a.qi + " qi" : "free"}</span>`;
        if (!a.disabled) b.onclick = () => { const r = B.act(a.id); (B.feed = B.feed || []).push(...r.lines); renderBattleScreen(B, onDone); };
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
    feed.scrollTop = feed.scrollHeight;
  }, false);
}

/* entry points that spend a year, then resolve old-age before continuing */
function endActivityYear() {   // an action concluded -- no time passes
  renderProfile(); save(); checkDeath();
}
function doWander() {
  if (!ageAllows("wander") || !useAction()) return;
  const c = state.c; closeOverlay();
  if (isCultivator(c) && state.rng.random() < 0.58) {
    const enemy = C.makeEnemy(c, state.rng, { factorMult: worldDanger(c) });
    logMessages([`You roam the wild reaches and are set upon by a ${enemy.name}!`]);
    startBattle(enemy, { title: "Wild Encounter" }, () => endActivityYear());
  } else {
    logMessages(wanderFortune(c)); endActivityYear();
  }
}
function doHunt() {
  if (!ageAllows("hunt") || !useAction()) return;
  const c = state.c; closeOverlay();
  const enemy = C.makeEnemy(c, state.rng, { kind: "beast", factor: state.rng.choices([0.7, 1.0, 1.3], [40, 40, 20]), factorMult: worldDanger(c) });
  logMessages([`You track a ${enemy.name} through the spirit-wilds and corner it.`]);
  startBattle(enemy, { title: "Beast Hunt" }, () => endActivityYear());
}
function doArena() {
  if (!ageAllows("arena") || !useAction()) return;
  const c = state.c; closeOverlay();
  const enemy = C.makeEnemy(c, state.rng, { kind: "rogue", name: "Sparring Partner", factor: state.rng.uniform(0.8, 1.1), element: null });
  logMessages(["You step into the sect sparring ring. (non-lethal)"]);
  startBattle(enemy, { title: "Arena Spar", nonLethal: true }, (outcome) => {
    if (state.c.alive) {
      c.happiness = Math.min(100, c.happiness + 4);
      if (outcome === "win") logMessages(["A clean victory in the ring; the sect takes note."]);
      logMessages(E.sparReward(c, state.rng, outcome, { scale: 1.5 }));
    }
    endActivityYear();
  });
}
function wanderFortune(c) {
  const rng = state.rng, r = rng.random();
  if (r < 0.3) { const g = rng.randint(5, 20) * (c.realm + 1); c.spiritStones += g; return [`You find a lost coin-pouch of ${g} spirit stones.`]; }
  if (r < 0.55) { const h = rng.randint(3, 8) + c.realm; c.herbs += h; return [`You harvest ${h} spirit herbs from a hidden vale.`]; }
  if (r < 0.7 && c.awakened) { c.qi += E.qiToNext(c) * 0.4; return ["By a roaring waterfall you grasp a sliver of the dao; your qi surges."]; }
  if (r < 0.82) return E.acquireArtifact(c, E.randomArtifact(c, rng, null, { element: E.regionElement(c) }));
  return ["You wander quiet mountains and trade rumours at a roadside inn. An uneventful year."];
}

/* ----------------------------- wiring ------------------------------------ */
// Paint the static chrome glyphs (tabs + header/overlay buttons) from one icon set.
document.querySelectorAll("[data-ico]").forEach(n => { n.innerHTML = icon(n.dataset.ico, { size: 26 }); });
$("pf-more").innerHTML = icon("sheet", { size: 22 });
$("overlay-close").innerHTML = icon("close", { size: 18 });
$("pf-avatar").innerHTML = icon("avChild", { size: 30, cls: "av" });

const TABS = { cultivate: openCultivate, people: openPeople, activities: openActivities, sect: openSect, age: doAgeUp };
document.querySelectorAll("#tabbar .tab").forEach(btn => btn.addEventListener("click", () => { const t = btn.dataset.tab; if (TABS[t]) TABS[t](); }));
$("pf-more").addEventListener("click", () => { if (state.c) openSheet(); });
$("pf-avatar").addEventListener("click", () => { if (state.c) openSheet(); });
$("pf-name").addEventListener("click", () => { if (state.c) openSheet(); });
$("pf-bars").addEventListener("click", e => { const n = e.target.closest ? e.target.closest("[data-tip]") : null; if (n && n.dataset) showTip(n.dataset.tip); });
$("overlay-close").addEventListener("click", () => { if (state.overlayClosable) closeOverlay(); });
$("overlay").addEventListener("click", e => { if (e.target === $("overlay") && state.overlayClosable) closeOverlay(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

startScreen();
