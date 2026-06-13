/* The Nine Heavens -- BitLife-style life-sim UI controller. */
import * as E from "./engine.js";
import * as D from "./data.js";
import * as L from "./life.js";
import * as C from "./combat.js";

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
function vbar(label, val, max, cls, valText) {
  return `<div class="vbar"><div class="vb-label"><span>${label}</span><span>${valText != null ? valText : Math.floor(val)}</span></div>
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
    bars.push(vbar("Cultivation", c.qi, E.qiToNext(c), "qi", `${Math.floor(clampPct(c.qi, E.qiToNext(c)))}%`));
  bars.push(vbar("Health", c.health, 100, "health"));
  bars.push(vbar("Happiness", c.happiness, 100, "happy"));
  $("pf-bars").innerHTML = bars.join("");

  const chips = $("pf-chips"); chips.innerHTML = "";
  const add = (label, val, warn) => chips.appendChild(el("span", "chip" + (warn ? " warn" : ""), `${label} <b>${val}</b>`));
  add("Age", `${c.age}/${c.maxAge}`);
  if (c.awakened) add("✦", Math.floor(E.power(c)));
  add("Karma", `${c.karma >= 0 ? "+" : ""}${c.karma}`);
  add("💎", c.spiritStones);
  if (c.herbs) add("🌿", c.herbs);
  if (c.awakened && E.canBreakthrough(c)) add("Breakthrough", `${Math.floor(E.breakthroughChance(c) * 100)}%`, true);

  $("tabbar").querySelector(".tab-age").classList.toggle("ready", c.awakened && E.canBreakthrough(c));
  save();
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

/* run a year-costing action that does NOT roll life events (focused activity) */
function runTimed(fn) {
  if (!state.c.alive) return;
  const msgs = fn();
  closeOverlay();
  logMessages(msgs && msgs.length ? msgs : ["A year slips quietly by."]);
  renderProfile(); checkDeath();
}

/* ------------------------------- age up ---------------------------------- */
function doAgeUp() {
  if (!state.c.alive) { startOrDeath(); return; }
  closeOverlay();
  const { events } = L.ageUp(state.c, state.rng);
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
    if (c.root.key === "none") { body.appendChild(el("p", "note", "You have no spiritual root; the path of qi is closed to you. You may still live a mortal life — see Activities.")); return; }
    body.appendChild(infoRows([
      ["Realm", `${E.realmLabel(c)} (${E.realmCn(c)})`],
      ["Qi", `${Math.floor(c.qi)} / ${Math.floor(E.qiToNext(c))}`],
      ["Power", Math.floor(E.power(c))],
    ]));
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, opt = {}) => { const b = el("button", "mbtn" + (opt.full ? " full" : "") + (opt.primary ? " primary" : "")); b.innerHTML = `${l}<small>${s}</small>`; if (opt.disabled) b.disabled = true; else b.onclick = h; grid.appendChild(b); };
    if (E.canBreakthrough(c))
      mk("Attempt Breakthrough", `${Math.floor(E.breakthroughChance(c) * 100)}%${c.realm >= 3 ? " · tribulation" : " · risky"}`, doBreakthrough, { full: true, primary: true });
    mk("Secluded Cultivation", "focus 3 years", () => runTimed(() => E.cultivate(c, state.rng, 3)));
    mk("Use a Qi Pill", `cultivate · ${c.pills} left`, () => runTimed(() => E.cultivate(c, state.rng, 1, true)), { disabled: c.pills <= 0 });
    mk("Comprehend the Dao", E.canComprehend(c) ? "meditate on the Laws" : "needs Nascent Soul", () => runTimed(() => E.meditate(c, state.rng, 1)), { disabled: !E.canComprehend(c) });
    mk("Wander the World", "adventure & battle", doWander);
    mk("Techniques & Mastery", "train your arts", openTechniques, { full: true });
    body.appendChild(grid);
  });
}

function openPeople() {
  const c = state.c;
  openOverlay("Relationships", body => {
    const fam = L.livingFamily(c), bonds = L.livingBonds(c);
    if (fam.length) { body.appendChild(el("div", "section-h", "Family")); fam.forEach(n => body.appendChild(personRow(n))); }
    body.appendChild(el("div", "section-h", "Bonds"));
    if (!bonds.length) body.appendChild(el("p", "note", "You have no friends, rivals, or companions yet."));
    bonds.forEach(n => body.appendChild(personRow(n)));
    const b = el("button", "mbtn full primary"); b.innerHTML = "Go Out & Mingle<small>meet someone new (free)</small>";
    b.onclick = () => { const res = L.mingle(c, state.rng); logMessages(res); renderProfile(); openPeople(); };
    body.appendChild(b);
  });
}
function personRow(n) {
  const row = el("div", "listrow");
  const aff = Math.max(-100, Math.min(100, n.affinity));
  const col = aff < 0 ? "var(--red)" : aff < 40 ? "var(--muted)" : aff < 75 ? "var(--jade)" : "var(--pink)";
  const w = (aff + 100) / 2;
  row.innerHTML = `<div class="lr-ava">${personEmoji(n)}</div><div class="lr-main">
    <div class="lr-title">${escapeHtml(n.name)} <span class="lr-sub" style="display:inline">· ${n.kin || E.npcRoleLabel(n)}</span></div>
    <div class="lr-sub">${E.npcStatus(n)}${n.occupation ? " · " + n.occupation : ""}</div>
    <div class="affbar"><div style="width:${w}%;background:${col}"></div></div></div>`;
  row.onclick = () => openPerson(n);
  return row;
}
function personEmoji(n) {
  if (n.kin === "Father") return "👨"; if (n.kin === "Mother") return "👩";
  if (n.kin === "Brother") return "👦"; if (n.kin === "Sister") return "👧";
  if (n.kin === "Son") return "🧒"; if (n.kin === "Daughter") return "🧒";
  return ({ master: "🧓", rival: "😼", friend: "🙂", companion: "💞", enemy: "😠", nemesis: "👿" })[n.role] || "🧑";
}
function openPerson(n) {
  const c = state.c;
  openOverlay(n.name, body => {
    body.appendChild(infoRows([
      ["Relation", n.kin || E.npcRoleLabel(n)], ["Feeling", `${E.npcStatus(n)} (${n.affinity >= 0 ? "+" : ""}${n.affinity})`],
      ...(n.occupation ? [["Occupation", n.occupation]] : []),
    ]));
    for (const act of L.relationActions(c, n)) {
      const b = el("button", "mbtn full"); b.innerHTML = escapeHtml(act.label);
      b.onclick = () => {
        if (act.id === "duel") {  // an interactive duel to the finish
          const isNemesis = n.role === "nemesis";
          const enemy = isNemesis
            ? C.makeBoss(c, state.rng, { name: n.name, power: n.power, element: n.element })
            : { name: n.name, kind: "rogue", power: n.power || E.power(c), element: null, reward: (c.realm + 1) * 6, kit: undefined };
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
      row.onclick = () => runTimed(() => L.trainTechnique(c, state.rng, t));
      body.appendChild(row);
    }
  });
}
function openActivities() {
  const c = state.c;
  openOverlay("Activities", body => {
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, opt = {}) => { const b = el("button", "mbtn" + (opt.full ? " full" : "")); b.innerHTML = `${l}<small>${s}</small>`; if (opt.disabled) b.disabled = true; else b.onclick = h; grid.appendChild(b); };
    mk("Train the Body", "build constitution", () => runTimed(() => L.trainBody(c, state.rng)));
    mk("Study Scriptures", "build comprehension", () => runTimed(() => L.studyScriptures(c, state.rng)));
    mk("Rest & Recover", "health + happiness", () => runTimed(() => L.restAndRecover(c, state.rng)));
    mk("Take Odd Jobs", "earn spirit stones", () => runTimed(() => L.oddJobs(c, state.rng)));
    const canHunt = c.awakened && c.root.key !== "none";
    const canBoss = canHunt && c.realm >= 2;
    mk("Hunt Spirit Beasts", canHunt ? "battle · tameable" : "needs cultivation", canHunt ? doHunt : null, { disabled: !canHunt });
    mk("Spar in the Arena", canHunt ? "train · non-lethal" : "needs cultivation", canHunt ? doArena : null, { disabled: !canHunt });
    mk("Seek a Worthy Foe", canBoss ? "BOSS · great rewards" : "needs Foundation+", canBoss ? doBossFight : null, { disabled: !canBoss });
    mk("Refine Pills", `alchemy · ${c.herbs} herbs`, openAlchemy);
    mk("Treasures & Beast", "your assets", openAssets);
    body.appendChild(grid);
  });
}
function openAlchemy() {
  const c = state.c;
  openOverlay("Alchemy 炼丹", body => {
    body.appendChild(el("p", "note", `Spirit Herbs: ${c.herbs} · Skill: ${c.alchemySkill}. Refining costs a year; failures salvage some herbs.`));
    for (const r of D.PILL_RECIPES) {
      const can = c.herbs >= r[2], chance = Math.floor(E.alchemySuccess(c, r) * 100);
      const row = el("div", "listrow" + (can ? "" : " disabled"));
      row.innerHTML = `<div class="lr-ava">⚗️</div><div class="lr-main"><div class="lr-title">${r[1]} <span class="lr-sub" style="display:inline">(${chance}%)</span></div><div class="lr-sub">${r[2]} herbs · ${r[4]}</div></div>`;
      if (can) row.onclick = () => runTimed(() => E.refine(c, state.rng, r[0]));
      body.appendChild(row);
    }
    backBtn(body, openActivities);
  });
}
function openAssets() {
  const c = state.c;
  openOverlay("Treasures & Beast", body => {
    body.appendChild(el("div", "section-h", "Spirit Beast"));
    if (c.beast) body.appendChild(el("p", "note", `${c.beast.name} the ${c.beast.species} — ${E.beastTier(c.beast)}, power ${Math.floor(c.beast.power)}.`));
    else body.appendChild(el("p", "note", "None. Best a wild beast while wandering to try taming one."));
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
    if (!c.sectKey) {
      body.appendChild(el("p", "note", "Join a sect for a cultivation bonus, a yearly stipend, a rank ladder, quests and tournaments. Better sects demand rarer talent."));
      for (const s of D.SECTS) {
        const ok = c.realm >= s[5];
        const gate = ok ? `${Math.floor(E.joinChance(c, s) * 100)}% accepted` : `needs ${D.REALMS[s[5]][0]}`;
        const row = el("div", "listrow" + (ok ? "" : " disabled"));
        row.innerHTML = `<div class="lr-ava">🏯</div><div class="lr-main"><div class="lr-title">${s[1]}</div><div class="lr-sub">${s[2]} · ${gate}<br>${s[9]}</div></div>`;
        if (ok) row.onclick = () => runTimed(() => E.attemptJoin(c, state.rng, s[0]));
        body.appendChild(row);
      }
      return;
    }
    body.appendChild(infoRows([["Sect", E.sectName(c)], ["Rank", E.rankName(c)], ["Contribution", c.contribution]]));
    const req = E.nextRankReq(c);
    if (req) body.appendChild(el("p", "note", E.canPromote(c) ? `Promotion to ${req[0]}: READY` : `Next rank ${req[0]} — needs ${D.REALMS[req[1]][0]} & ${req[2]} contribution.`));
    const grid = el("div", "menu-grid");
    const mk = (l, s, h, full) => { const b = el("button", "mbtn" + (full ? " full" : "")); b.innerHTML = `${l}<small>${s}</small>`; b.onclick = h; grid.appendChild(b); };
    mk("Take a Quest", "earn contribution", openQuests);
    mk("Attempt Promotion", "climb the ranks", () => runTimed(() => E.attemptPromotion(c, state.rng)));
    mk("Grand Tournament", "duel for glory", () => runTimed(() => E.tournament(c, state.rng)));
    mk("Sect Store", "25 contrib → pills", () => runTimed(() => E.exchangeContribution(c, state.rng)));
    const leave = el("button", "mbtn full danger"); leave.innerHTML = "Leave the Sect<small>go rogue</small>"; leave.onclick = () => runTimed(() => E.leaveSect(c)); grid.appendChild(leave);
    body.appendChild(grid);
  });
}
function openQuests() {
  const c = state.c;
  openOverlay("Contribution Quests", body => {
    for (const q of E.availableQuests(c)) {
      const row = el("div", "listrow");
      row.innerHTML = `<div class="lr-ava">📜</div><div class="lr-main"><div class="lr-title">${q[0]}</div><div class="lr-sub">+${q[2]} contrib · +${q[3]} stones · risk ${Math.floor(q[4] * 100)}%<br>${q[5]}</div></div>`;
      row.onclick = () => runTimed(() => E.doQuest(c, state.rng, q));
      body.appendChild(row);
    }
    backBtn(body, openSect);
  });
}

/* --------------------------- character sheet ----------------------------- */
function openSheet() {
  const c = state.c;
  openOverlay("Character Sheet", body => {
    body.appendChild(infoRows([
      ["Name", `${c.name} (${c.sex === "female" ? "♀" : "♂"})`],
      ["Age", `${c.age} / ${c.maxAge}`],
      ["Realm", c.awakened ? `${E.realmLabel(c)} (${E.realmCn(c)})` : "Unawakened child"],
      ["Health / Happiness", `${Math.floor(c.health)} (${D.vitalLabel(c.health)}) / ${Math.floor(c.happiness)} (${D.vitalLabel(c.happiness)})`],
      ["Reputation", c.reputation], ["Karma", `${c.karma >= 0 ? "+" : ""}${c.karma} (${E.karmaLabelFor(c)})`],
    ]));
    body.appendChild(el("div", "section-h", "Born With"));
    body.appendChild(infoRows([
      ["Spiritual Root", c.awakened ? `${c.root.display}${c.root.elements.length ? " [" + c.root.elements.join(", ") + "]" : ""}` : "Unknown — awakens at age 6 (未测)"],
      ["Physique", c.physiqueName], ["Appearance", c.appearanceName], ["Standing", c.backgroundName],
    ]));
    body.appendChild(el("div", "section-h", "Attributes"));
    body.appendChild(infoRows([
      ["Comprehension 悟性", c.comprehension], ["Constitution 根骨", c.constitution],
      ["Soul Sense 神识", c.soul], ["Fortune 气运", c.luck], ["Charm 魅力", c.charm],
    ]));
    body.appendChild(el("div", "section-h", "Path"));
    const rows = [["Sect", c.sectKey ? `${E.sectName(c)} — ${E.rankName(c)}` : "Rogue Cultivator"],
      ["Treasure", c.equippedArtifact ? E.describeArtifact(c.equippedArtifact) : "(none)"]];
    if (c.beast) rows.push(["Beast", `${c.beast.name} the ${c.beast.species}`]);
    if (c.daos.length) rows.push(["Daos", c.daos.map(d => D.DAO_BY_KEY[d][1]).join(", ")]);
    if (c.titles.length) rows.push(["Titles", c.titles.join(", ")]);
    body.appendChild(infoRows(rows));
    body.appendChild(el("div", "section-h", "Resources"));
    body.appendChild(infoRows([
      ["Spirit Stones", c.spiritStones], ["Spirit Herbs", c.herbs],
      ["Qi / Healing / Breakthrough Pills", `${c.pills} / ${c.healingPills} / ${c.breakthroughPills}`],
      ["Techniques", c.techniques.map(t => D.TECHNIQUES[t][0]).join(", ")],
    ]));
    body.appendChild(el("div", "section-h", "Life Chronicle"));
    for (const [age, text] of c.log.slice(-30)) body.appendChild(el("div", "chron-line", `<b>Age ${age}</b> — ${escapeHtml(text)}`));
  });
}
function infoRows(rows) {
  const wrap = el("div");
  for (const [k, v] of rows) { const r = el("div", "kv"); r.appendChild(el("span", "k", escapeHtml(String(k)))); r.appendChild(el("span", "v", escapeHtml(String(v)))); wrap.appendChild(r); }
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
      state.c = L.reincarnateLife(c, state.rng); state.deadHandled = false; closeOverlay();
      logBanner("☯ THE WHEEL OF REBIRTH TURNS ☯");
      logMessages([`A new soul is born — ${state.c.name} (Rebirth #${state.c.reincarnationCount}), dimly recalling a former life.`, "Age up to live this new life. Your past climb has sharpened your innate talent."]);
      renderProfile();
    };
    body.appendChild(rein);
    const fresh = el("button", "mbtn full"); fresh.innerHTML = "Let the Soul Rest<small>roll a brand-new, unrelated soul</small>";
    fresh.onclick = () => { clearSave(); startScreen(); };
    body.appendChild(fresh);
  }, false);
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
    "✦ Tap AGE UP to live your life, one year at a time.",
  ]);
}

/* ------------------------------ start ------------------------------------ */
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
    [["Random", null], ["♀ Girl", "female"], ["♂ Boy", "male"]].forEach(([lab, val], i) => {
      const b = el("button", i === 0 ? "on" : "", lab);
      b.onclick = () => { chosenSex = val; seg.querySelectorAll("button").forEach(x => x.classList.remove("on")); b.classList.add("on"); };
      seg.appendChild(b);
    });
    card.appendChild(seg);
    const begin = el("button", "mbtn full primary");
    begin.innerHTML = "Be Born<small>your fate is decided by the heavens</small>";
    begin.onclick = () => {
      state.rng = new E.RNG();
      state.c = L.bornCharacter(state.rng, input.value.trim() || null, chosenSex);
      closeOverlay(); $("log").innerHTML = ""; renderBirth(state.c); renderProfile();
    };
    const sv = loadSave();
    if (sv && sv.c) {
      const cont = el("button", "mbtn full");
      cont.innerHTML = `Continue Your Saga<small>${escapeHtml(sv.c.name)} · age ${sv.c.age}</small>`;
      cont.onclick = () => resumeFrom(sv);
      body.appendChild(cont);
    }
    body.appendChild(card);
    body.appendChild(begin);
  }, false);
}
function resumeFrom(sv) {
  state.c = sv.c; state.rng = new E.RNG(0); state.rng.s = sv.s >>> 0; state.deadHandled = false;
  // Back-compat: ensure life-sim fields exist on older saves.
  const c = state.c;
  if (typeof c.happiness !== "number") c.happiness = 55;
  if (typeof c.health !== "number") c.health = 60;
  if (typeof c.awakened !== "boolean") c.awakened = true;
  if (!c.firedEvents) c.firedEvents = [];
  if (!c.sex) c.sex = "male";
  if (!c.mastery) c.mastery = {};
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
    startBattle(C.makeTribulation(c, state.rng), { title: "Heavenly Tribulation ⚡" }, () => { renderProfile(); save(); checkDeath(); });
  } else { renderProfile(); save(); checkDeath(); }
}
function doBossFight() {
  const c = state.c; if (!c.alive) return; closeOverlay();
  c.age += 1;
  const boss = C.makeBoss(c, state.rng);
  logMessages([`You seek out a fearsome adversary — the ${boss.name} accepts your challenge!`]);
  startBattle(boss, { title: `Boss · ${boss.name}` }, () => endActivityYear());
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
      cont.onclick = () => { const sum = B.finish(); closeOverlay(); logMessages(sum); if (onDone) onDone(B.outcome); };
      body.appendChild(cont);
    } else {
      const grid = el("div", "cbt-actions");
      for (const a of B.actions()) {
        const b = el("button", "cbt-skill" + (a.disabled ? " off" : "") + (a.id === "flee" ? " flee" : ""));
        b.innerHTML = `<span class="cs-name">${a.element ? C.elementIcon(a.element) + " " : ""}${escapeHtml(a.name)}</span><span class="cs-cost">${a.qi ? "⊙" + a.qi : "free"}</span>`;
        if (!a.disabled) b.onclick = () => { const r = B.act(a.id); (B.feed = B.feed || []).push(...r.lines); renderBattleScreen(B, onDone); };
        grid.appendChild(b);
      }
      body.appendChild(grid);
    }
    feed.scrollTop = feed.scrollHeight;
  }, false);
}

/* entry points that spend a year, then resolve old-age before continuing */
function endActivityYear() {
  const c = state.c;
  if (c.alive && c.age > c.maxAge && state.rng.random() > (c.luck + c.soul) / 400) {
    c.alive = false; c.causeOfDeath = "old age, lifespan exhausted"; c.log.push([c.age, "Died of old age."]);
    logMessages([`☠ Your lifespan ends at ${c.age}.`]);
  }
  renderProfile(); save(); checkDeath();
}
function doWander() {
  const c = state.c; if (!c.alive) return; closeOverlay();
  c.age += 1;
  if (c.awakened && c.root.key !== "none" && state.rng.random() < 0.58) {
    const enemy = C.makeEnemy(c, state.rng);
    logMessages([`You roam the wild reaches and are set upon by a ${enemy.name}!`]);
    startBattle(enemy, { title: "Wild Encounter" }, () => endActivityYear());
  } else {
    logMessages(wanderFortune(c)); endActivityYear();
  }
}
function doHunt() {
  const c = state.c; if (!c.alive) return; closeOverlay();
  c.age += 1;
  const enemy = C.makeEnemy(c, state.rng, { kind: "beast", factor: state.rng.choices([0.7, 1.0, 1.3], [40, 40, 20]) });
  logMessages([`You track a ${enemy.name} through the spirit-wilds and corner it.`]);
  startBattle(enemy, { title: "Beast Hunt" }, () => endActivityYear());
}
function doArena() {
  const c = state.c; if (!c.alive) return; closeOverlay();
  c.age += 1;
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
$("overlay-close").addEventListener("click", () => { if (state.overlayClosable) closeOverlay(); });
$("overlay").addEventListener("click", e => { if (e.target === $("overlay") && state.overlayClosable) closeOverlay(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

startScreen();
