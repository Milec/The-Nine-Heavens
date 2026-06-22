// Headless-browser helper for The Nine Heavens web UI.
//
//   node tools/shot.mjs [outfile.png] [--click "selector"]... [--text "selector"]... [--wait ms]
//
// Serves the repo statically, loads /web/, optionally clicks through a sequence
// of selectors, then screenshots. Reports the page title and any console/page
// errors so UI regressions surface without a human eyeballing every change.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml' };

// --- tiny static server ----------------------------------------------------
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, normalize(p));
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// --- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
let out = '/tmp/nine-heavens.png';
let extraWait = 800;
const clicks = [];   // { kind: 'css'|'text', value }
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--click') clicks.push({ kind: 'css', value: argv[++i] });
  else if (a === '--text') clicks.push({ kind: 'text', value: argv[++i] });
  else if (a === '--wait') extraWait = Number(argv[++i]) || extraWait;
  else if (!a.startsWith('--')) out = a;
}

// --- drive the browser -----------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(`http://localhost:${port}/web/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

for (const c of clicks) {
  const loc = c.kind === 'text' ? page.getByText(c.value, { exact: false }).first()
                                : page.locator(c.value).first();
  await loc.click({ timeout: 5000 });
  await page.waitForTimeout(350);
}

await page.waitForTimeout(extraWait);
await page.screenshot({ path: out, fullPage: false });

console.log('TITLE:', await page.title());
console.log('CONSOLE ERRORS:', errors.length ? errors.join(' | ') : 'none');
console.log('SAVED:', out);

await browser.close();
server.close();
