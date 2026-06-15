/* The Nine Heavens -- BitLife-style life-sim UI controller. */
import * as E from "./engine.js";
import * as D from "./data.js";
import * as L from "./life.js";
import * as C from "./combat.js";
import * as meta from "./meta.js";

/* Plain-language explanations for every stat, shown as tap hints + a glossary. */
const GLOSSARY = {
  age: ["Age", "Your years lived, and your lifespan ceiling. Reaching a new realm extends how long you can live."],
  deeds: ["Deeds", "Each year you have three separate budgets of deeds — ☯ Cultivation, ⚔ Activities and ❤ Social — three of each. They never pass time; only the ⊕ Age Up button passes a year, fires life events, and refreshes all your deeds."],
  cultivation: ["Cultivation (Qi)", "Progress toward your next stage. Fills as you cultivate; at a realm's peak you attempt a breakthrough to the next realm."],
  power: ["Power ✦", "Your overall combat strength, drawn from your realm, body, soul, techniques, bound treasure, beast and Daos."],
  health: ["Health", "Your physical condition (0–100). Wounds and illness lower it; rest, pills and spirit springs restore it. Hit zero and you die."],
  happiness: ["Happiness", "Your state of mind (0–100). A serene heart steadies breakthroughs; deep misery invites the heart-demon."],
  comprehension: ["Comprehension 悟性", "How quickly you grasp the dao. Speeds cultivation, eases breakthroughs, and quickens Dao insight."],
  constitution: ["Constitution 根骨", "Bodily strength. More battle stamina and damage-reduction, and a sturdier resistance to death."],
  soul: ["Soul Sense 神识", "Spiritual perception. A larger combat qi pool, better dodge, faster Dao insight, and stronger tribulation defence."],
  fortune: ["Fortune 气运", "Luck. Quietly nudges crits, dodges, lucky finds, and clutch escapes from death."],
  charm: ["Charm 魅力", "Social grace. Helps you make friends, draw a dao companion, and sway elders and foes alike."],
  karma: ["Karma 业力", "Merit versus sin. Merit softens the Heavenly Tribulation; deep sin summons a heart-demon and bounty hunters."],
  fame: ["Fame 声望", "How the cultivation world regards your name — Unknown up to Legendary. Fame draws invitations and gifts; infamy brings hunters."],
  stones: ["Spirit Stones 💎", "The currency of cultivators. Spend them at the Market on herbs, pills, technique manuals and treasures, on your cave abode and sect, or at auctions. Market prices float with the world era."],
  herbs: ["Spirit Herbs 🌿", "Raw materials gathered in the wild and refined into pills at the alchemy furnace."],
  region: ["Region 📍", "Where you roam. Distant regions hold deadlier foes — and far richer spoils."],
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

/* ------------------------------ profile ---------------------------------- */
function vbar(label, val, max, cls, valText, tip) {
  return `<div class="vbar${tip ? " tappable" : ""}"${tip ? ` data-tip="${tip}"` : ""}><div class="vb-label"><span>${label}</span><span>${valText != null ? valText : Math.floor(val)}</span></div>
    <div class="vb-track"><div class="vb-fill ${cls}" style="width:${clampPct(val, max)}%"></div></div></div>`;
}
function renderProfile() {
  const c = state.c;
  $("pf-avatar").textContent = D.avatarFor(c);
  $("pf-name").textContent = c.name + (c.reincarnationCount ? `  ·  ☯${c.reincarnationCount}` : "");
  let sub;
  if (!c.awakened) sub = `Unawakened ${c.sex === "female" ? "girl" : "boy"} · ${c.backgroundName.split(" (")[0]}`;
  else sub = `${E.realmLabel(c)} · ${c.sectKey ? E.rankName(c).split(" (")[0] : "Rogue Cultivator"}`;
  $("pf-sub").textContent = sub;

  const bars = [];
  if (c.awakened && c.root.key !== "none")
    bars.push(vbar("Cultivation", c.qi, E.qiToNext(c), "qi", `${Math.floor(clampPct(c.qi, E.qiToNext(c)))}%`, "cultivation"));
  bars.push(vbar("Health", c.health, 100, "health", null, "health"));
  bars.push(vbar("Happiness", c.happiness, 100, "happy", null, "happiness"));
  $("pf-bars").innerHTML = bars.join("");

  const chips = $("pf-chips"); chips.innerHTML = "";
  const add = (label, val, cls, tip) => { const ch = el("span", "chip" + (cls ? " " + cls : "") + (tip ? " tappable" : ""), `${label} <b>${val}</b>`); if (tip) ch.onclick = () => showTip(tip); chips.appendChild(ch); };
  add("Age", `${c.age}/${c.maxAge}`, "", "age");
  for (const cat of ["cult", "act", "social"]) {
    const n = deedsLeft(cat);
    add(DEED_ICON[cat], "●".repeat(n) + "○".repeat(Math.max(0, DEEDS_PER_CAT - n)), n <= 0 ? "warn" : "good", "deeds");
  }
  if (c.awakened) add("✦", Math.floor(E.power(c)), "", "power");
  add("Fame", D.standingLabel(c.reputation), c.reputation >= 90 ? "good" : c.reputation <= -12 ? "bad" : "", "fame");
  add("Karma", `${c.karma >= 0 ? "+" : ""}${c.karma}`, c.karma >= 40 ? "good" : c.karma <= -40 ? "bad" : "", "karma");
  add("💎", c.spiritStones, "", "stones");
  if (c.herbs) add("🌿", c.herbs, "", "herbs");
  if (D.REGION_BY_KEY[c.region]) add("📍", D.REGION_BY_KEY[c.region][2], "", "region");
  if (c.era) add("☷", D.eraAt(c.era)[2], D.eraAt(c.era)[5] > 1.2 ? "bad" : D.eraAt(c.era)[4] > 1.1 ? "good" : "", "era");
  if (c.reputation <= -25 || c.karma <= -60) add("⚠ Wanted", "bounties", "bad", "wanted");
  if (c.ascended) add("✸", "Ascended Immortal", "good", "realm");
  if (c.awakened && E.canBreakthrough(c)) add("⚑ Breakthrough", `${Math.floor(E.breakthroughChance(c) * 100)}%`, "warn", "breakthrough");

  const ageTab = $("tabbar").querySelector(".tab-age");
  ageTab.classList.toggle("ready", c.awakened && E.canBreakthrough(c));
  const allSpent = ["cult", "act", "social"].every(cat => deedsLeft(cat) <= 0);
  ageTab.classList.toggle("spent", allSpent && c.alive);
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
const DEED_ICON = { cult: "☯", act: "⚔", social: "❤" };
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
    const card = el("div", "event-card");
    card.appendChild(el("div", "ev-emoji", eventEmoji(ev)));
    card.appendChild(el("div", "ev-text", escapeHtml(ev.text)));
    body.appendChild(card);
    for (const ch of ev.choices) {
      const b = el("button", "mbtn full"); b.innerHTML = escapeHtml(ch.label);
      b.onclick = () => { const res = ch.fn(); closeOverlay(); logMessages(res); processQueue(q); };
      body.appendChild(b);
    }
  }, false);
}
function eventEmoji(ev) {
  const t = (ev.text || "").toLowerCase();
  if (t.includes("duel") || t.includes("ambush") || t.includes("beast") || t.includes("war")) return "⚔️";
  if (t.includes("love") || t.includes("companion") || t.includes("child is") || t.includes("moon")) return "💞";
  if (t.includes("devil") || t.includes("blood-art") || t.includes("heart-demon")) return "😈";
  if (t.includes("ruin") || t.includes("treasure") || t.includes("auction")) return "🗝️";
  if (t.includes("ill") || t.includes("died") || t.includes("fever")) return "🕯️";
  if (t.includes("master") || t.includes("immortal") || t.includes("dao")) return "☯️";
  return "📜";
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
      body.appendChild(infoRows([
        ["Realm", `${E.realmLabel(c)} (${E.realmCn(c)})`, "realm"],
        ["Qi", `${Math.floor(c.qi)} / ${Math.floor(E.qiToNext(c))}`, "cultivation"],
        ["Power", Math.floor(E.power(c)), "power"],
      ]));
      if (c.root.elements && c.root.elements.length) {
        const attune = Math.round(Math.min(0.45, Math.max(0.12, 0.10 + c.root.multiplier * 0.07)) * 100);
        const matchups = c.root.elements.map(e => { const m = C.elementMatchup(e); return m && (m.strong || m.weak) ? `${e} (▲${m.strong || "—"} ▼${m.weak || "—"})` : `${e} (exotic ▲all)`; }).join(", ");
        const plural = c.root.elements.length > 1;
        body.appendChild(el("p", "note", `Element${plural ? "s" : ""}: ${matchups}. Your arts of ${plural ? "these elements" : "this element"} strike +${attune}% (attuned) and you resist ${plural ? "them" : "it"}. ▲ strong vs · ▼ weak vs.`));
      }
      const g = el("div", "menu-grid");
      if (E.canBreakthrough(c))
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
      nb ? ["Tempering", `${Math.floor(c.temper)} / ${nb[2]}`] : ["Tempering", `${D.bodyRealmName(c.bodyRealm)} — your physique's limit`],
      ["Body limit", `${D.bodyRealmName(cap)} (${c.physiqueName})`],
    ]));
    const bg = el("div", "menu-grid");
    addBtn(bg, "Temper the Body", "a deed · forge flesh & bone", () => runTimed(() => E.temperBody(c, state.rng, 1.5), "cult"), { full: true, primary: !hasRoot });
    body.appendChild(bg);

    // ---- shared ----
    const sg = el("div", "menu-grid");
    addBtn(sg, "Wander the World", c.age < AGE_MIN.wander ? `from age ${AGE_MIN.wander}` : "adventure & battle", doWander, { disabled: c.age < AGE_MIN.wander || !isCultivator(c) });
    addBtn(sg, "Techniques & Mastery", "train your arts", openTechniques, { full: true });
    body.appendChild(sg);
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
  row.innerHTML = `<div class="lr-ava">${personEmoji(n)}</div><div class="lr-main">
    <div class="lr-title">${escapeHtml(n.name)} <span class="lr-sub" style="display:inline">· ${escapeHtml(relLabel(n))}</span></div>
    <div class="lr-sub">${E.npcStatus(n)}${extra}</div>
    <div class="affbar"><div style="width:${w}%;background:${col}"></div></div></div>`;
  row.onclick = () => openPerson(n);
  return row;
}
function personEmoji(n) {
  if (n.kin === "Father") return "👨"; if (n.kin === "Mother") return "👩";
  if (n.kin === "Brother") return "👦"; if (n.kin === "Sister") return "👧";
  if (n.kin === "Son") return "👦"; if (n.kin === "Daughter") return "👧";
  if (n.role === "companion") return n.married ? "💍" : "💞";
  return ({ master: "🧓", rival: "😼", friend: "🙂", enemy: "😠", nemesis: "👿", disciple: "🙇" })[n.role] || "🧑";
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
    if (!skills.length) { body.appendChild(el("p", "note", "You have learned no combat techniques yet. Find manuals in ruins, from masters, or the sect store.")); return; }
    body.appendChild(el("p", "note", "Using a technique in battle deepens its mastery, raising its power. Tap one to drill it for a year (+mastery)."));
    for (const { t, s } of skills) {
      const pts = (c.mastery && c.mastery[t]) || 0;
      const rank = D.masteryRank(pts), next = D.masteryNext(pts);
      const pctTo = next ? clampPct(pts - rank[1], next[1] - rank[1]) : 100;
      const eff = s.type === "heal" ? `heal ${Math.round(s.heal * 100)}%+` : s.type === "defend" ? "shield" : `${Math.round(s.dmg * 100)}% power dmg`;
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">${s.element ? C.elementIcon(s.element) : "✊"}</div><div class="lr-main">
        <div class="lr-title">${escapeHtml(s.name)} <span class="lr-sub" style="display:inline">· ${rank[0]} (+${Math.round(rank[2] * 100)}%)</span></div>
        <div class="lr-sub">${eff}${s.qi ? ` · ⊙${s.qi} qi` : " · free"}${next ? ` · ${pts}/${next[1]} → ${next[0]}` : " · perfected"}</div>
        <div class="affbar"><div style="width:${pctTo}%;background:var(--gold2)"></div></div></div>`;
      row.onclick = () => runTimed(() => L.trainTechnique(c, state.rng, t), "cult");
      body.appendChild(row);
    }
  });
}
function openActivities() {
  const c = state.c;
  openOverlay("Activities", body => {
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, opt = {}) => { const b = el("button", "mbtn" + (opt.full ? " full" : "")); b.innerHTML = `${l}<small>${s}</small>`; if (opt.disabled) b.disabled = true; else b.onclick = h; grid.appendChild(b); };
    // young: below the action's minimum age
    const young = key => c.age < (AGE_MIN[key] || 0);
    const sub = (key, normal) => young(key) ? `from age ${AGE_MIN[key]}` : normal;
    mk("Train the Body", sub("train", "build constitution"), () => { if (!ageAllows("train")) return; runTimed(() => L.trainBody(c, state.rng), "cult"); }, { disabled: young("train") });
    mk("Study Scriptures", sub("study", "build comprehension"), () => { if (!ageAllows("study")) return; runTimed(() => L.studyScriptures(c, state.rng), "act"); }, { disabled: young("study") });
    mk("Rest & Recover", "health + happiness", () => runTimed(() => L.restAndRecover(c, state.rng)));
    mk("Take Odd Jobs", sub("oddjobs", "earn spirit stones"), () => runTimed(() => L.oddJobs(c, state.rng)), { disabled: young("oddjobs") });
    const canHunt = isCultivator(c);
    const canBoss = canHunt && isStrong(c);
    mk("Hunt Spirit Beasts", !canHunt ? "needs cultivation" : sub("hunt", "battle · tameable"), doHunt, { disabled: !canHunt || young("hunt") });
    mk("Spar in the Arena", !canHunt ? "needs cultivation" : sub("arena", "train · non-lethal"), doArena, { disabled: !canHunt || young("arena") });
    mk("Seek a Worthy Foe", !canBoss ? "needs Foundation+" : sub("boss", "BOSS · great rewards"), doBossFight, { disabled: !canBoss || young("boss") });
    mk("Enter a Secret Realm", !canBoss ? "needs Foundation+" : sub("secret", "delve · escalating loot"), doSecretRealm, { disabled: !canBoss || young("secret") });
    mk("Refine Pills", sub("alchemy", `alchemy · ${c.herbs} herbs`), openAlchemy, { disabled: young("alchemy") });
    mk("Travel the World", young("travel") ? `from age ${AGE_MIN.travel}` : (D.REGION_BY_KEY[c.region] ? D.REGION_BY_KEY[c.region][1] : "regions"), openTravel, { disabled: young("travel") });
    const ab = D.abodeAt(c.abode || 0);
    mk("Your Cave Abode", ab ? `${ab[2]} · home base` : "establish a home base", openAbode, { full: true });
    mk("Visit the Market", "坊市 · buy & sell", openMarket);
    mk("Treasures & Beast", "your assets", openAssets);
    body.appendChild(grid);
  });
}
function genMarket(c) {
  const rng = state.rng;
  const unknown = Object.keys(D.TECHNIQUES).filter(k => k !== "basic_breathing" && !c.techniques.includes(k));
  const tech = unknown.length ? rng.choice(unknown) : null;
  const keys = D.ARTIFACTS.map(a => a[0]);
  const treasures = [];
  for (let i = 0; i < 2 && keys.length; i++) treasures.push(keys.splice(Math.floor(rng.random() * keys.length), 1)[0]);
  return { year: c.age, tech, treasures, sold: {} };
}
function marketDo(fn) {
  if (!state.c.alive) return;
  logMessages(fn());
  renderProfile(); save();
  openMarket();
}
function openMarket() {
  const c = state.c;
  if (!state.market || state.market.year !== c.age) state.market = genMarket(c);
  const M = state.market;
  openOverlay("Market 坊市", body => {
    const pm = E.eraPriceMult(c);
    body.appendChild(el("p", "note", `Spirit stones: ${c.spiritStones} · herbs: ${c.herbs}. Prices ${pm > 1.05 ? "run high" : pm < 0.95 ? "are low" : "are fair"} in the ${D.eraAt(c.era)[1]}.`));
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
    if (M.tech && !c.techniques.includes(M.tech)) {
      const price = E.priceTech(c, D.TECHNIQUES[M.tech][1]);
      row("📖", D.TECHNIQUES[M.tech][0] + " (manual)", `${price} stones · ${D.TECHNIQUES[M.tech][4]}`, "", c.spiritStones >= price, () => E.buyTech(c, M.tech, state.rng));
    }
    for (const k of M.treasures) {
      if (M.sold[k]) continue;
      const price = E.priceTreasure(c, k);
      row("⚔️", D.ARTIFACT_BY_KEY[k][1] + ` (${D.ARTIFACT_BY_KEY[k][2]})`, `${price} stones · ${D.ARTIFACT_BY_KEY[k][5]}`, "", c.spiritStones >= price, () => { M.sold[k] = true; return E.buyTreasure(c, k); });
    }
    // Sell
    const spareTreasures = c.artifacts.filter(k => k !== c.equippedArtifact);
    if (c.herbs >= 5 || spareTreasures.length) {
      body.appendChild(el("div", "section-h", "Sell"));
      if (c.herbs >= 5) row("🌿", "Sell Spirit Herbs ×5", `+${E.sellHerbs(c, 5)} stones`, "", true, () => E.sellSpareHerbs(c, 5));
      for (const k of spareTreasures) row("💰", "Sell " + D.ARTIFACT_BY_KEY[k][1], `+${E.sellTreasureValue(c, k)} stones (${D.ARTIFACT_BY_KEY[k][2]})`, "", true, () => E.sellTreasure(c, k));
    }
    backBtn(body, openActivities);
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
        ["Location", `${reg ? reg[1] : "—"}${danger !== 1 ? ` (×${danger} yield)` : ""}`, "region"],
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
    backBtn(body, openActivities);
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
    backBtn(body, openActivities);
  });
}
function openTravel() {
  const c = state.c;
  openOverlay("Travel the World", body => {
    body.appendChild(el("p", "note", "Distant regions hold deadlier foes and far richer spoils. Where the danger is greater, so is the reward."));
    if (c.abode) { const ar = D.REGION_BY_KEY[L.abodeRegionKey(c)]; if (ar) body.appendChild(el("p", "note", `🏠 Your abode is rooted in the ${ar[1]} — it stays put wherever you roam, and its wild vein yields ×${ar[3]} each year.`)); }
    for (const r of D.REGIONS) {
      const here = r[0] === c.region;
      const abodeHere = c.abode && r[0] === L.abodeRegionKey(c);
      const row = el("div", "listrow" + (here ? " bound" : ""));
      const tier = r[3] <= 0.9 ? "safe" : r[3] <= 1.1 ? "moderate" : r[3] <= 1.35 ? "dangerous" : r[3] <= 1.7 ? "perilous" : "deadly";
      row.innerHTML = `<div class="lr-ava">${abodeHere ? "🏠" : "📍"}</div><div class="lr-main"><div class="lr-title">${here ? "★ " : ""}${r[1]} <span class="lr-sub" style="display:inline">(${r[2]})</span></div><div class="lr-sub">${tier} · danger ×${r[3]}<br>${r[4]}</div></div>`;
      if (!here) row.onclick = () => {
        if (!ageAllows("travel") || !useAction()) return;
        c.region = r[0]; closeOverlay();
        logMessages([`You journey to the ${r[1]} (${r[2]}). The dangers here scale ×${r[3]}.`]);
        endActivityYear();
      };
      body.appendChild(row);
    }
  });
}
function openAchievements(backFn) {
  openOverlay("Achievements & Legacy", body => {
    const f = meta.favor();
    body.appendChild(el("p", "note", `Heavenly Favor: ${f} — every soul you raise is born with +${Math.min(15, f)} Comprehension and +${Math.min(10, Math.floor(f / 2))} Fortune. Feats persist across all reincarnations and new lives.`));
    for (const a of meta.list()) {
      const row = el("div", "listrow" + (a.got ? " bound" : " disabled"));
      row.innerHTML = `<div class="lr-ava">${a.got ? "🏆" : "🔒"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(a.name)}</div><div class="lr-sub">${escapeHtml(a.desc)}</div></div>`;
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
      ["Bond", `${Math.round(b.bond)} / 100`],
      ["Experience", b.rank < 5 ? `${b.exp} / ${req}` : "max rank"],
    ]));
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
  openOverlay("Treasures & Beast", body => {
    body.appendChild(el("div", "section-h", "Spirit Beast"));
    if (c.beast) {
      E.normalizeBeast(c.beast);
      const b = c.beast;
      const row = el("div", "listrow" + (E.beastAdvanceReady(c) ? " bound" : ""));
      row.innerHTML = `<div class="lr-ava">${b.element ? C.elementIcon(b.element) : "🐾"}</div><div class="lr-main"><div class="lr-title">${escapeHtml(b.name)} <span class="lr-sub" style="display:inline">· ${escapeHtml(b.species)}</span></div><div class="lr-sub">${E.beastTier(b)}${b.element ? " · " + b.element : ""} · power ${Math.floor(b.power)} · bond ${Math.round(b.bond)}/100${E.beastAdvanceReady(c) ? " · ✦ ready to evolve!" : ""}</div></div>`;
      row.onclick = () => openBeast();
      body.appendChild(row);
    } else body.appendChild(el("p", "note", "None. Best a wild beast while wandering to try taming one."));
    body.appendChild(el("div", "section-h", "Magic Treasures (法宝)"));
    if (!c.artifacts.length) body.appendChild(el("p", "note", "You own no treasures yet."));
    for (const key of c.artifacts) {
      const row = el("div", "listrow" + (key === c.equippedArtifact ? " bound" : ""));
      row.innerHTML = `<div class="lr-ava">⚔️</div><div class="lr-main"><div class="lr-title">${key === c.equippedArtifact ? "★ " : ""}${escapeHtml(E.describeArtifact(key))}</div></div>`;
      row.onclick = () => { E.equipArtifact(c, key); renderProfile(); openAssets(); };
      body.appendChild(row);
    }
    body.appendChild(el("div", "section-h", "Inventory"));
    body.appendChild(el("p", "note", c.inventory.length ? c.inventory.join(", ") : "(empty)"));
    backBtn(body, openActivities);
  });
}

function openSect() {
  const c = state.c;
  openOverlay("Sect Affairs", body => {
    if (!c.awakened) { body.appendChild(el("p", "note", "You cannot join a sect before your spiritual root awakens.")); return; }
    if (c.ownSect) { renderOwnSect(c, body); return; }
    if (!c.sectKey) {
      body.appendChild(el("p", "note", "Join a sect for a cultivation bonus, a yearly stipend, a rank ladder, quests and tournaments. Better sects demand rarer talent."));
      for (const s of D.SECTS) {
        const ok = c.realm >= s[5];
        const gate = ok ? `${Math.floor(E.joinChance(c, s) * 100)}% accepted` : `needs ${D.REALMS[s[5]][0]}`;
        const row = el("div", "listrow" + (ok ? "" : " disabled"));
        row.innerHTML = `<div class="lr-ava">🏯</div><div class="lr-main"><div class="lr-title">${s[1]}</div><div class="lr-sub">${s[2]} · ${gate}<br>${s[9]}</div></div>`;
        if (ok) row.onclick = () => runFree(() => E.attemptJoin(c, state.rng, s[0]));
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
    body.appendChild(infoRows([["Sect", E.sectName(c)], ["Rank", E.rankName(c)], ["Contribution", c.contribution]]));
    const req = E.nextRankReq(c);
    if (req) body.appendChild(el("p", "note", E.canPromote(c) ? `Promotion to ${req[0]}: READY` : `Next rank ${req[0]} — needs ${D.REALMS[req[1]][0]} & ${req[2]} contribution.`));
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, full) => { const b = el("button", "mbtn" + (full ? " full" : "")); b.innerHTML = `${l}<small>${s}</small>`; b.onclick = h; grid.appendChild(b); };
    mk("Take a Quest", "a deed · earn contribution", openQuests);
    mk("Attempt Promotion", "climb the ranks", () => runFree(() => E.attemptPromotion(c, state.rng)));
    mk("Grand Tournament", "a deed · interactive duels", doTournament);
    mk("Sect Store", "25 contrib → pills", () => runFree(() => E.exchangeContribution(c, state.rng)));
    const leave = el("button", "mbtn full danger"); leave.innerHTML = "Leave the Sect<small>go rogue</small>"; leave.onclick = () => runFree(() => E.leaveSect(c)); grid.appendChild(leave);
    body.appendChild(grid);
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
    ["Prestige", next ? `${Math.floor(s.prestige)} / ${next[0]} → ${next[1]}` : `${Math.floor(s.prestige)} (peak)`],
    ["Members", `${s.members} / ${cap}`],
    ["Cultivation bonus", `+${Math.round(tier[3] * 100)}%`, "abode"],
    ["Founded", `age ${s.founded}`],
  ]));
  body.appendChild(el("p", "note", `Each year your sect spreads your name (+${tier[4]} fame), pays a stipend from its treasury, and quickens your dao. Expand your cave abode to raise the members cap. Invite disciples (in Relationships) to settle them as your core.`));
  const grid = el("div", "menu-grid");
  const mk = (l, sub, h, full, primary) => { const b = el("button", "mbtn" + (full ? " full" : "") + (primary ? " primary" : "")); b.innerHTML = `${l}<small>${sub}</small>`; b.onclick = h; grid.appendChild(b); };
  mk("Hold a Recruitment", s.members < cap ? "a deed · draw new disciples" : "halls are full", () => runTimed(() => L.holdRecruitment(c, state.rng)), true, s.members < cap);
  if (c.realm >= 4 && L.getDisciples(c).length < 4)
    mk("Take a Disciple", "a deed · a personal heir", () => { if (!ageAllows("disciple") || !useAction("social")) return; logMessages(L.takeDisciple(c, state.rng)); renderProfile(); openSect(); });
  body.appendChild(grid);
  const dis = el("button", "mbtn full danger"); dis.innerHTML = "Disband the Sect<small>lower your banner</small>"; dis.onclick = () => runFree(() => L.disbandSect(c)); body.appendChild(dis);
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
  openOverlay("Contribution Quests", body => {
    for (const q of E.availableQuests(c)) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">📜</div><div class="lr-main"><div class="lr-title">${q[0]}</div><div class="lr-sub">+${q[2]} contrib · +${q[3]} stones · risk ${Math.floor(q[4] * 100)}%<br>${q[5]}</div></div>`;
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
    body.appendChild(infoRows([
      ["Comprehension 悟性", c.comprehension, "comprehension"], ["Constitution 根骨", c.constitution, "constitution"],
      ["Soul Sense 神识", c.soul, "soul"], ["Fortune 气运", c.luck, "fortune"], ["Charm 魅力", c.charm, "charm"],
    ]));
    body.appendChild(el("div", "section-h", "Path"));
    const ab = D.abodeAt(c.abode || 0);
    const rows = [["Sect", c.ownSect ? `${c.ownSect.name} — Founder (${D.sectTier(c.ownSect.prestige)[1]})` : c.sectKey ? `${E.sectName(c)} — ${E.rankName(c)}` : "Rogue Cultivator"],
      ["Abode", ab ? `${ab[1]} (${ab[2]})${c.ownSect ? " · sect seat" : ""}` : "None", "abode"],
      ["Treasure", c.equippedArtifact ? E.describeArtifact(c.equippedArtifact) : "(none)"]];
    if (c.beast) rows.push(["Beast", `${c.beast.name} the ${c.beast.species}`]);
    if (c.legacySect && !c.ownSect) rows.push(["Past Sect", `${c.legacySect.name} (awaits your return)`]);
    if (c.daos.length) rows.push(["Daos", c.daos.map(d => D.DAO_BY_KEY[d][1]).join(", ")]);
    if (c.titles.length) rows.push(["Titles", c.titles.join(", ")]);
    body.appendChild(infoRows(rows));
    body.appendChild(el("div", "section-h", "Resources"));
    body.appendChild(infoRows([
      ["Spirit Stones", c.spiritStones], ["Spirit Herbs", c.herbs],
      ["Qi / Healing / Breakthrough Pills", `${c.pills} / ${c.healingPills} / ${c.breakthroughPills}`],
      ["Techniques", c.techniques.map(t => D.TECHNIQUES[t][0]).join(", ")],
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
    [["🎲 Random", null], ["♀ Girl", "female"], ["♂ Boy", "male"]].forEach(([lab, val], i) => {
      const b = el("button", i === 0 ? "on" : "", lab);
      b.onclick = () => { chosenSex = val; seg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
      seg.appendChild(b);
    });
    card.appendChild(seg);
    const begin = el("button", "mbtn full primary");
    begin.innerHTML = "🎲 Roll a Soul &amp; Begin<small>your fate is decided by the heavens</small>";
    begin.onclick = () => beginLife(L.bornCharacter(new E.RNG(), input.value.trim() || null, chosenSex));
    const custom = el("button", "mbtn full");
    custom.innerHTML = "✎ Create Your Soul<small>choose root, physique, looks, standing &amp; more</small>";
    custom.onclick = () => openCreator(input.value.trim(), chosenSex);
    const sv = loadSave();
    if (sv && sv.c) {
      const cont = el("button", "mbtn full");
      cont.innerHTML = `▶ Continue Your Saga<small>${escapeHtml(sv.c.name)} · age ${sv.c.age}</small>`;
      cont.onclick = () => resumeFrom(sv);
      body.appendChild(cont);
    }
    body.appendChild(card);
    body.appendChild(begin);
    body.appendChild(custom);
    const ach = el("button", "mbtn full");
    ach.innerHTML = `🏆 Achievements &amp; Legacy<small>Heavenly Favor: ${meta.favor()}</small>`;
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
  wrap.appendChild(el("div", "cr-pv-top", `${D.avatarFor(c)} <b>${escapeHtml(c.name)}</b> · ${c.sex === "female" ? "♀" : "♂"}`));
  const rows = [
    ["Spiritual Root", `${c.root.display}${c.root.elements.length ? " [" + c.root.elements.join(", ") + "]" : ""}`],
    ["Physique", c.physiqueName], ["Appearance", c.appearanceName], ["Standing", c.backgroundName],
    ["Omen", c.omen.length > 46 ? c.omen.slice(0, 44) + "…" : c.omen],
    ["Comprehension / Constitution", `${c.comprehension} / ${c.constitution}`],
    ["Soul / Fortune / Charm", `${c.soul} / ${c.luck} / ${c.charm}`],
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
  if (!c.region) c.region = "azuredomain";
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
  state.realmRun = { depth, idx: 0, hpFrac: 1 };
  logMessages(["You step through a shimmering rift into a Secret Realm — the qi here is thick as honey, and the danger thicker still."]);
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
  if (r < 0.3) return E.acquireArtifact(c, E.randomArtifact(c, rng));
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
      if (outcome === "win") { c.comprehension = Math.min(160, c.comprehension + 1); logMessages(["A clean victory in the ring sharpens your martial sense. (+Comprehension)"]); }
    }
    endActivityYear();
  });
}
function wanderFortune(c) {
  const rng = state.rng, r = rng.random();
  if (r < 0.3) { const g = rng.randint(5, 20) * (c.realm + 1); c.spiritStones += g; return [`You find a lost coin-pouch of ${g} spirit stones.`]; }
  if (r < 0.55) { const h = rng.randint(3, 8) + c.realm; c.herbs += h; return [`You harvest ${h} spirit herbs from a hidden vale.`]; }
  if (r < 0.7 && c.awakened) { c.qi += E.qiToNext(c) * 0.4; return ["By a roaring waterfall you grasp a sliver of the dao; your qi surges."]; }
  if (r < 0.82) return E.acquireArtifact(c, E.randomArtifact(c, rng));
  return ["You wander quiet mountains and trade rumours at a roadside inn. An uneventful year."];
}

/* ----------------------------- wiring ------------------------------------ */
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
