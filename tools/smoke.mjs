// Deep UI smoke test: roll a soul and play ~35 years through the real
// interface — resolving event cards, dialogue trees and grid battles as a
// player would — then fail loudly on any console or page error. Complements
// tests/test_web.mjs (logic-only) by exercising the DOM layer end to end.
//
//   node tools/smoke.mjs [years]
//
// Exits 0 when the run is clean, 1 if any error surfaced.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const YEARS = Math.max(1, Number(process.argv[2]) || 35);
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.woff2':'font/woff2' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const body = await readFile(join(ROOT, normalize(p)));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(`http://localhost:${port}/web/`, { waitUntil: 'networkidle' });
await page.getByText('Roll a Soul', { exact: false }).first().click();
await page.waitForTimeout(500);

// Resolve whatever overlay is open: battles get played (a skill + target, or
// End Turn, or Continue), event cards get their first choice, everything else
// is closed. Recurses until the overlay is gone or a battle awaits more turns.
// Closable sheets are closed rather than button-mashed: repeatable deed
// actions now resolve in place (the sheet stays open, feedback as a toast),
// so clicking them would never converge on a closed overlay.
async function resolveOverlay(depth = 0) {
  if (depth > 60) return;
  if (!await page.locator('#overlay:not(.hidden)').count()) return;
  const cont = page.locator('#overlay-body .mbtn.primary', { hasText: 'Continue' });
  if (await cont.count()) { await cont.first().click().catch(()=>{}); await page.waitForTimeout(250); return resolveOverlay(depth+1); }
  const endTurn = page.locator('#overlay-body .gc-btnrow .mbtn.primary', { hasText: 'End Turn' });
  if (await endTurn.count()) {
    const skills = page.locator('#overlay-body .cbt-skill:not(.off)');
    if (await skills.count() && Math.random() < 0.6) {
      await skills.first().click().catch(()=>{});
      await page.waitForTimeout(150);
      const tgt = page.locator('#overlay-body .gc-cell.target');
      if (await tgt.count()) await tgt.first().click().catch(()=>{});
      await page.waitForTimeout(150);
    }
    const et = page.locator('#overlay-body .gc-btnrow .mbtn.primary', { hasText: 'End Turn' });
    if (await et.count()) await et.first().click().catch(()=>{});
    await page.waitForTimeout(200);
    return resolveOverlay(depth+1);
  }
  const closeBtn = page.locator('#overlay-close:visible');
  if (await closeBtn.count()) { await closeBtn.first().click().catch(()=>{}); await page.waitForTimeout(150); return; }
  // No close button: a forced screen (event card, dialogue, death) — take the
  // first choice and continue resolving.
  const choice = page.locator('#overlay-body > .mbtn.full');
  if (await choice.count()) { await choice.first().click().catch(()=>{}); await page.waitForTimeout(250); return resolveOverlay(depth+1); }
  const any = page.locator('#overlay-body button:not([disabled])');
  if (await any.count()) { await any.first().click().catch(()=>{}); await page.waitForTimeout(250); return resolveOverlay(depth+1); }
}

for (let i = 0; i < YEARS; i++) {
  // A death screen offers Reincarnate — take it and play on.
  if (await page.locator('#overlay:not(.hidden)').count()
      && await page.locator('#overlay-body', { hasText: 'Reincarnate' }).count()) {
    await page.getByText('Reincarnate', { exact: false }).first().click().catch(()=>{});
    await page.waitForTimeout(300);
  }
  await resolveOverlay();
  // Spend a cultivation deed now and then; visit Relationships once.
  if (i % 4 === 2) {
    await page.locator('#tabbar .tab[data-tab="cultivate"]').click().catch(()=>{});
    await page.waitForTimeout(300);
    const btn = page.locator('#overlay-body .mbtn', { hasText: 'Focused Cultivation' });
    if (await btn.count()) await btn.first().click().catch(()=>{});
    await page.waitForTimeout(200);
    await resolveOverlay();
  }
  if (i === 10) {
    await page.locator('#tabbar .tab[data-tab="people"]').click().catch(()=>{});
    await page.waitForTimeout(300);
    const row = page.locator('#overlay-body .listrow');
    if (await row.count()) { await row.first().click().catch(()=>{}); await page.waitForTimeout(250); }
    await resolveOverlay();
  }
  await page.locator('#tabbar .tab[data-tab="age"]').click().catch(()=>{});
  await page.waitForTimeout(350);
  await resolveOverlay();
}

await page.locator('#pf-more').click().catch(()=>{});
await page.waitForTimeout(300);
await resolveOverlay();

const name = await page.locator('#pf-name').textContent();
const sub = await page.locator('#pf-sub').textContent();
console.log(`Played ${YEARS} age-up clicks. Character: ${name.trim()} — ${sub.trim()}`);
console.log('CONSOLE/PAGE ERRORS:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
