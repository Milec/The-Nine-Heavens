/* The Nine Heavens -- UI controller. Renders the engine to a touch interface. */
import * as E from "./engine.js";
import * as D from "./data.js";

const STORAGE_KEY = "nineheavens.save.v2";
const state = { c: null, rng: null, deadHandled: false };

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

/* ----------------------------- persistence ------------------------------- */
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ c: state.c, s: state.rng.s })); } catch (e) {}
}
function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

/* ------------------------------ log render ------------------------------- */
function classify(text) {
  const t = text.trim();
  const classes = [];
  if (text.startsWith("  ") || text.startsWith("   ")) classes.push("sub");
  if (t.includes("☠")) classes.push("bad");
  else if (t.startsWith("✗")) classes.push("bad");
  else if (t.includes("BREAKTHROUGH") || t.startsWith("☯") || t.includes("✦") || t.startsWith("⮝")) classes.push("epic");
  else if (t.startsWith("⚡") || t.startsWith("Wave") || t.includes("Wave ")) classes.push("trib");
  else if (t.startsWith("👁")) classes.push("demon");
  else if (t.startsWith("⚔")) classes.push("combat");
  return classes.join(" ");
}

function logMessages(msgs, asBanner) {
  const log = $("log");
  const turn = el("div", "turn");
  if (asBanner) {
    const b = el("div", "banner");
    b.innerHTML = asBanner;
    turn.appendChild(b);
  }
  for (const m of msgs) {
    if (m === "") { turn.appendChild(el("div", "line spacer")); continue; }
    turn.appendChild(el("div", "line " + classify(m), escapeHtml(m)));
  }
  log.appendChild(turn);
  log.scrollTop = log.scrollHeight;
}
function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ------------------------------ sheet ------------------------------------ */
function pct(a, b) { return b <= 0 ? 0 : Math.max(0, Math.min(100, (a / b) * 100)); }

function renderSheet() {
  const c = state.c;
  $("tb-name").textContent = c.name + (c.reincarnationCount ? `  ·  Rebirth #${c.reincarnationCount}` : "");
  $("tb-realm").textContent = `${E.realmLabel(c)} (${E.realmCn(c)})`;
  $("tb-qi-fill").style.width = pct(c.qi, E.qiToNext(c)) + "%";
  $("tb-qi-label").textContent = `Qi ${Math.floor(c.qi)}/${Math.floor(E.qiToNext(c))}`;
  $("tb-hp-fill").style.width = pct(c.hp, c.maxHp) + "%";
  $("tb-hp-label").textContent = `HP ${Math.floor(c.hp)}/${Math.floor(c.maxHp)}`;
  const chips = $("tb-chips");
  chips.innerHTML = "";
  const add = (label, val) => chips.appendChild(el("span", "chip", `${label} <b>${val}</b>`));
  add("Age", `${c.age}/${c.maxAge}`);
  add("Power", Math.floor(E.power(c)));
  add("Karma", `${c.karma >= 0 ? "+" : ""}${c.karma}`);
  add("Stones", c.spiritStones);
  add("Herbs", c.herbs);
  if (c.sectKey) add("Sect", E.rankName(c).split(" ")[0]);
  // Breakthrough button highlight
  const br = $("btn-break");
  if (E.canBreakthrough(c)) { br.classList.add("ready"); br.querySelector("small").textContent = `${Math.floor(E.breakthroughChance(c) * 100)}%`; }
  else { br.classList.remove("ready"); br.querySelector("small").textContent = "through"; }
  save();
}

/* ------------------------------ overlays --------------------------------- */
function openOverlay(title, build, closable = true) {
  $("overlay-title").textContent = title;
  const body = $("overlay-body");
  body.innerHTML = "";
  $("overlay-close").style.display = closable ? "" : "none";
  state.overlayClosable = closable;
  build(body);
  $("overlay").classList.remove("hidden");
}
function closeOverlay() { $("overlay").classList.add("hidden"); }

/* run a timed action: log its result to the main feed and close any overlay */
function runAction(fn) {
  if (!state.c.alive) return;
  const msgs = fn();
  closeOverlay();
  if (msgs && msgs.length) logMessages(msgs);
  else {
    // Quiet cultivation produces no event -- still give the player feedback.
    const c = state.c;
    logMessages([`You cultivate in seclusion. (Qi ${Math.floor(c.qi)}/${Math.floor(E.qiToNext(c))}, age ${c.age})`]);
  }
  renderSheet();
  checkDeath();
}

/* ----------------------------- main menu --------------------------------- */
function openMainMenu() {
  openOverlay("Actions", body => {
    const grid = el("div", "menu-grid");
    const mk = (label, sub, handler, opts = {}) => {
      const b = el("button", "mbtn" + (opts.full ? " full" : "") + (opts.primary ? " primary" : ""));
      b.innerHTML = `${label}<small>${sub}</small>`;
      if (opts.disabled) b.disabled = true; else b.onclick = handler;
      grid.appendChild(b);
    };
    const c = state.c;
    mk("Use a Pill", `cultivate · ${c.pills} left`, () => runAction(() => E.cultivate(state.c, state.rng, 1, true)), { disabled: c.pills <= 0 });
    mk("Comprehend Dao", E.canComprehend(c) ? "meditate on the Laws" : "needs Nascent Soul",
      () => runAction(() => E.meditate(state.c, state.rng, 1)));
    mk("Sect Affairs", c.sectKey ? E.rankName(c) : "join a sect", openSectMenu);
    mk("Relationships", relationshipsSub(c), openSocialMenu);
    mk("Alchemy", `furnace · ${c.herbs} herbs`, openAlchemyMenu);
    mk("Treasures & Beast", treasureSub(c), openTreasureMenu);
    mk("Character Sheet", "full details", openCharacterSheet);
    mk("Life Chronicle", "your story so far", openChronicle);
    mk("How to Play", "the legend", openHelp, { full: true });
    body.appendChild(grid);
  });
}
function relationshipsSub(c) { const n = c.relationships.filter(r => r.alive).length; return n ? `${n} bond${n > 1 ? "s" : ""}` : "meet people"; }
function treasureSub(c) { return c.equippedArtifact ? D.ARTIFACT_BY_KEY[c.equippedArtifact][1] : "none bound"; }

/* ------------------------------ sect ------------------------------------- */
function openSectMenu() {
  const c = state.c;
  openOverlay("Sect Affairs", body => {
    if (!c.sectKey) {
      body.appendChild(el("p", "note", "You are an unaffiliated rogue cultivator. Joining a sect grants cultivation resources, a rank ladder, quests and comrades. Better sects demand rarer talent."));
      for (const s of D.SECTS) {
        const eligible = c.realm >= s[5];
        const gate = eligible ? `${Math.floor(E.joinChance(c, s) * 100)}% to be accepted` : `needs ${D.REALMS[s[5]][0]}`;
        const row = el("div", "listrow" + (eligible ? "" : " disabled"));
        row.innerHTML = `<div class="lr-title">${s[1]}</div><div class="lr-sub">${s[2]} · ${gate}<br>${s[9]}</div>`;
        if (eligible) row.onclick = () => runAction(() => E.attemptJoin(state.c, state.rng, s[0]));
        body.appendChild(row);
      }
      return;
    }
    body.appendChild(infoBlock([
      ["Sect", E.sectName(c)], ["Rank", E.rankName(c)], ["Contribution", c.contribution],
    ]));
    const req = E.nextRankReq(c);
    if (req) body.appendChild(el("p", "note", E.canPromote(c) ? `Promotion to ${req[0]}: READY` : `Next rank ${req[0]} — needs ${D.REALMS[req[1]][0]} & ${req[2]} contribution.`));
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, full) => { const b = el("button", "mbtn" + (full ? " full" : "")); b.innerHTML = `${l}<small>${s}</small>`; b.onclick = h; grid.appendChild(b); };
    mk("Take a Quest", "earn contribution", openQuestList);
    mk("Attempt Promotion", "climb the ranks", () => runAction(() => E.attemptPromotion(state.c, state.rng)));
    mk("Grand Tournament", "duel for glory", () => runAction(() => E.tournament(state.c, state.rng)));
    mk("Sect Store", "25 contrib → pills", () => runAction(() => E.exchangeContribution(state.c, state.rng)));
    mk("Leave the Sect", "go rogue", () => runAction(() => E.leaveSect(state.c)), true);
    body.appendChild(grid);
  });
}
function openQuestList() {
  const c = state.c;
  openOverlay("Contribution Quests", body => {
    const quests = E.availableQuests(c);
    for (const q of quests) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-title">${q[0]}</div><div class="lr-sub">+${q[2]} contrib · +${q[3]} stones · risk ${Math.floor(q[4] * 100)}%<br>${q[5]}</div>`;
      row.onclick = () => runAction(() => E.doQuest(state.c, state.rng, q));
      body.appendChild(row);
    }
    backRow(body, openSectMenu);
  });
}

/* --------------------------- relationships ------------------------------- */
function openSocialMenu() {
  const c = state.c;
  openOverlay("Relationships", body => {
    const living = c.relationships.filter(n => n.alive);
    if (!living.length) body.appendChild(el("p", "note", "You walk the dao alone. Go out and meet someone."));
    for (const n of living) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-title">${E.npcRoleLabel(n)} ${n.name}</div><div class="lr-sub">${E.npcStatus(n)} · affinity ${n.affinity >= 0 ? "+" : ""}${n.affinity}</div>`;
      row.onclick = () => runAction(() => E.interactWith(state.c, n, state.rng));
      body.appendChild(row);
    }
    const b = el("button", "mbtn full primary"); b.innerHTML = "Go Out & Meet People<small>spend a year</small>";
    b.onclick = () => runAction(() => E.meetNew(state.c, state.rng));
    body.appendChild(b);
  });
}

/* ------------------------------ alchemy ---------------------------------- */
function openAlchemyMenu() {
  const c = state.c;
  openOverlay("Alchemy 炼丹", body => {
    body.appendChild(el("p", "note", `Spirit Herbs: ${c.herbs}  ·  Alchemy skill: ${c.alchemySkill}. Refining costs a year; failures salvage some herbs.`));
    for (const r of D.PILL_RECIPES) {
      const chance = Math.floor(E.alchemySuccess(c, r) * 100);
      const can = c.herbs >= r[2];
      const row = el("div", "listrow" + (can ? "" : " disabled"));
      row.innerHTML = `<div class="lr-title">${r[1]} <span class="lr-sub" style="display:inline">(${chance}%)</span></div><div class="lr-sub">${r[2]} herbs · ${r[4]}</div>`;
      if (can) row.onclick = () => runAction(() => E.refine(state.c, state.rng, r[0]));
      body.appendChild(row);
    }
  });
}

/* --------------------------- treasures & beast --------------------------- */
function openTreasureMenu() {
  const c = state.c;
  openOverlay("Treasures & Beast", body => {
    body.appendChild(el("div", "section-h", "Spirit Beast"));
    if (c.beast) body.appendChild(el("p", "note", `${c.beast.name} the ${c.beast.species} — ${E.beastTier(c.beast)}, power ${Math.floor(c.beast.power)}, loyalty ${c.beast.loyalty}.`));
    else body.appendChild(el("p", "note", "None. Best a wild beast while wandering to try taming one."));
    body.appendChild(el("div", "section-h", "Magic Treasures (法宝)"));
    if (!c.artifacts.length) { body.appendChild(el("p", "note", "You own no treasures yet. Ruins, auctions and fallen foes may yield one.")); return; }
    for (const key of c.artifacts) {
      const row = el("div", "listrow" + (key === c.equippedArtifact ? " bound" : ""));
      row.innerHTML = `<div class="lr-title">${key === c.equippedArtifact ? "★ " : ""}${E.describeArtifact(key)}</div>`;
      row.onclick = () => { E.equipArtifact(state.c, key); renderSheet(); openTreasureMenu(); };
      body.appendChild(row);
    }
  });
}

/* --------------------------- character sheet ----------------------------- */
function openCharacterSheet() {
  const c = state.c;
  openOverlay("Character Sheet", body => {
    body.appendChild(infoBlock([
      ["Name", c.name], ["Realm", `${E.realmLabel(c)} (${E.realmCn(c)})`],
      ["Age", `${c.age} / ${c.maxAge}`], ["Power", Math.floor(E.power(c))],
      ["Reputation", c.reputation], ["Karma", `${c.karma >= 0 ? "+" : ""}${c.karma} (${E.karmaLabelFor(c)})`],
    ]));
    body.appendChild(el("div", "section-h", "Born With"));
    body.appendChild(infoBlock([
      ["Spiritual Root", `${c.root.display}${c.root.elements.length ? " [" + c.root.elements.join(", ") + "]" : ""}`],
      ["Physique", c.physiqueName], ["Appearance", c.appearanceName], ["Standing", c.backgroundName],
    ]));
    body.appendChild(el("div", "section-h", "Attributes"));
    body.appendChild(infoBlock([
      ["Comprehension 悟性", c.comprehension], ["Constitution 根骨", c.constitution],
      ["Soul Sense 神识", c.soul], ["Fortune 气运", c.luck], ["Charm 魅力", c.charm],
    ]));
    body.appendChild(el("div", "section-h", "Path"));
    const rows = [
      ["Sect", c.sectKey ? `${E.sectName(c)} — ${E.rankName(c)}` : "Rogue Cultivator"],
      ["Treasure", c.equippedArtifact ? E.describeArtifact(c.equippedArtifact) : "(none)"],
    ];
    if (c.beast) rows.push(["Beast", `${c.beast.name} the ${c.beast.species} (${E.beastTier(c.beast)})`]);
    if (c.daos.length) rows.push(["Daos", c.daos.map(d => D.DAO_BY_KEY[d][1]).join(", ")]);
    if (c.titles.length) rows.push(["Titles", c.titles.join(", ")]);
    body.appendChild(infoBlock(rows));
    body.appendChild(el("div", "section-h", "Resources"));
    body.appendChild(infoBlock([
      ["Spirit Stones", c.spiritStones], ["Spirit Herbs", c.herbs],
      ["Qi / Healing / Breakthrough Pills", `${c.pills} / ${c.healingPills} / ${c.breakthroughPills}`],
      ["Alchemy Skill", c.alchemySkill],
      ["Techniques", c.techniques.map(t => D.TECHNIQUES[t][0]).join(", ")],
      ["Inventory", c.inventory.length ? c.inventory.join(", ") : "(empty)"],
    ]));
  });
}
function infoBlock(rows) {
  const wrap = el("div");
  for (const [k, v] of rows) {
    const r = el("div", "kv");
    r.appendChild(el("span", "k", escapeHtml(String(k))));
    r.appendChild(el("span", "v", escapeHtml(String(v))));
    wrap.appendChild(r);
  }
  return wrap;
}

/* ------------------------------ chronicle -------------------------------- */
function openChronicle() {
  const c = state.c;
  openOverlay("Life Chronicle", body => {
    const recent = c.log.slice(-40);
    for (const [age, text] of recent) {
      const line = el("div", "chron-line", `<b>Age ${age}</b> — ${escapeHtml(text)}`);
      body.appendChild(line);
    }
  });
}

/* -------------------------------- help ----------------------------------- */
function openHelp() {
  openOverlay("How to Play", body => {
    const p = t => body.appendChild(el("p", "note", t));
    p("Climb the eleven realms of cultivation from frail Mortal to Immortal Ascension — the Nine Heavens — surviving lifespan, tribulation and blade.");
    p("<b>Cultivate</b> to fill your qi bar and auto-advance stages. At a realm's peak you hit a wall and must <b>Break through</b> (button glows when ready) — risky, and from Golden Core up it summons a Heavenly Tribulation.");
    p("<b>Wander</b> for spirit herbs, ruins, treasures, masters and danger. Each action costs years of your life — die of old age and the climb ends.");
    p("<b>Menu ▸ Sect</b>: join a sect for a cultivation bonus, climb ranks, run quests, and enter tournaments. <b>Relationships</b>: forge bonds with masters, rivals, friends, dao companions and enemies — charm and looks decide who you draw.");
    p("<b>Alchemy</b>: refine herbs into pills, including the Longevity Pill that adds years. <b>Treasures & Beast</b>: bind your best artifact (法宝) and tame a spirit beast for a real combat edge. <b>Comprehend Dao</b>: from Nascent Soul, grasp the great Laws toward ascension.");
    p("<b>Karma</b> (业力): merit eases the tribulation; sin summons a heart demon. When you die, your soul may <b>reincarnate</b>, carrying its legacy into a stronger new life. Your progress saves automatically on this device.");
  });
}

/* --------------------------- death & rebirth ----------------------------- */
function checkDeath() {
  if (state.c.alive || state.deadHandled) return;
  state.deadHandled = true;
  const c = state.c;
  logMessages([
    `${c.name} perished at age ${c.age} — ${c.causeOfDeath}.`,
    `Final attainment: ${E.realmLabel(c)} (${E.realmCn(c)}).`,
    E.epitaph(c),
  ], "☠ THE THREAD OF FATE IS CUT ☠");
  openOverlay("Death", body => {
    body.appendChild(el("p", "note", `${escapeHtml(c.name)} reached <b>${E.realmLabel(c)}</b> before the end, at age ${c.age}.`));
    body.appendChild(el("p", "note", E.epitaph(c)));
    const grid = el("div", "menu-grid");
    const rein = el("button", "mbtn full primary");
    rein.innerHTML = "Reincarnate<small>carry your soul's legacy into a new life</small>";
    rein.onclick = () => {
      state.c = E.reincarnate(c, state.rng);
      state.deadHandled = false;
      closeOverlay();
      logMessages([
        `A new soul is born — ${state.c.name} (Rebirth #${state.c.reincarnationCount}) — stirred by faint memories of a former life.`,
        `Spiritual Root — ${state.c.root.display}`,
        `Standing — ${state.c.backgroundName}`,
        "The legacy of your past climb sharpens your innate talent. Begin again, and climb higher.",
      ], "☯ THE WHEEL OF REBIRTH TURNS ☯");
      renderSheet();
    };
    grid.appendChild(rein);
    const fresh = el("button", "mbtn full");
    fresh.innerHTML = "Let the Soul Rest<small>roll a brand-new, unrelated soul</small>";
    fresh.onclick = () => { clearSave(); startScreen(); };
    grid.appendChild(fresh);
    body.appendChild(grid);
  }, false);
}

/* ------------------------------ birth ------------------------------------ */
function renderBirth(c) {
  const verdict = birthVerdict(c);
  logMessages([
    `A child is born: ${c.name}.`,
    c.omen, "",
    `Standing — ${c.backgroundName}`, "  " + c.backgroundBlurb, "",
    `Spiritual Root — ${c.root.display}`, "  " + c.root.blurb, "",
    `Physique — ${c.physiqueName}`, "  " + c.physiqueBlurb, "",
    `Appearance — ${c.appearanceName}`, "  " + c.appearanceBlurb, "",
    "✦ " + verdict,
  ], "✺ A NEW SOUL ENTERS THE WHEEL OF DESTINY ✺");
}
function birthVerdict(c) {
  // The spiritual root is the gate to cultivation, so it dominates the verdict;
  // a special physique can partly redeem a poor root, and attributes only nudge.
  const special = c.physiqueKey !== "ordinary";
  const score = c.root.multiplier * 45
    + (c.comprehension + c.luck + (c.soul + c.constitution) / 2) / 3 * 0.5
    + c.reputation * 0.3
    + (special ? 35 : 0);
  if (score > 160) return "The heavens have lavished gifts upon you. A dragon among men.";
  if (score > 108) return "A genuinely blessed birth. Sects would war over you.";
  if (score > 68) return "A solid hand of cards. Your fate is yours to make.";
  if (score > 40) return "An unremarkable start. The climb will be steep but not closed.";
  return "The dao has dealt you ashes. Only sheer will could forge a legend from this.";
}

/* ------------------------------ start ------------------------------------ */
function startScreen() {
  state.deadHandled = false;
  openOverlay("The Nine Heavens", body => {
    const card = el("div", "center-card");
    card.appendChild(el("div", "title-zh", "九 重 天"));
    card.appendChild(el("div", "title-en", "A text RPG of cultivation, fortune, and the long climb skyward"));
    const input = el("input", "txtfield");
    input.type = "text"; input.placeholder = "Name your cultivator (or leave to fate)";
    input.maxLength = 24;
    card.appendChild(input);
    const begin = el("button", "mbtn full primary");
    begin.innerHTML = "Roll a Soul & Begin<small>your birth is decided by the heavens</small>";
    begin.onclick = () => {
      state.rng = new E.RNG();
      state.c = E.generateCharacter(state.rng, input.value.trim() || null);
      closeOverlay();
      $("log").innerHTML = "";
      renderBirth(state.c);
      renderSheet();
    };
    card.appendChild(begin);
    const sv = loadSave();
    if (sv && sv.c) {
      const cont = el("button", "mbtn full");
      const label = sv.c.alive ? "Continue Your Saga" : "Return to Your Fallen Soul";
      cont.innerHTML = `${label}<small>${escapeHtml(sv.c.name)} · ${realmNameSafe(sv.c)}</small>`;
      cont.onclick = () => resumeFrom(sv);
      body.appendChild(cont);
      body.appendChild(card);
    } else {
      body.appendChild(card);
    }
  }, false);
}
function realmNameSafe(c) { try { return E.realmLabel(c); } catch (e) { return "—"; } }

function resumeFrom(sv) {
  state.c = sv.c;
  state.rng = new E.RNG(0); state.rng.s = sv.s >>> 0;
  state.deadHandled = false;
  closeOverlay();
  $("log").innerHTML = "";
  logMessages(["Your saga resumes where you left it."], "☯ THE THREAD CONTINUES ☯");
  renderSheet();
  if (!state.c.alive) checkDeath();
}

/* ----------------------------- wiring ------------------------------------ */
const ACTIONS = {
  cultivate: () => runAction(() => E.cultivate(state.c, state.rng, 1, false)),
  cultivate3: () => runAction(() => E.cultivate(state.c, state.rng, 3, false)),
  wander: () => runAction(() => E.adventure(state.c, state.rng)),
  breakthrough: () => runAction(() => E.attemptBreakthrough(state.c, state.rng)),
  menu: openMainMenu,
};
document.querySelectorAll("#actionbar .act").forEach(btn => {
  btn.addEventListener("click", () => { const a = btn.dataset.act; if (ACTIONS[a]) ACTIONS[a](); });
});
$("overlay-close").addEventListener("click", () => { if (state.overlayClosable) closeOverlay(); });
$("overlay").addEventListener("click", e => { if (e.target === $("overlay") && state.overlayClosable) closeOverlay(); });

function backRow(body, handler) {
  const b = el("button", "mbtn full"); b.innerHTML = "‹ Back";
  b.onclick = handler; body.appendChild(b);
}

// Service worker for offline / installable PWA.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

// Boot.
startScreen();
