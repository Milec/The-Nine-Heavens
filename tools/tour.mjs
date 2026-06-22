// Walk the UI and capture a labelled set of screenshots into tools/shots/.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'shots');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml' };

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
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: join(OUT, name + '.png') }); console.log('  shot', name); };
const tap = async (sel, t=0) => { try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(t||300); } catch(e){ console.log('  miss', sel); } };
const tapText = async (txt, t=0) => { try { await page.getByText(txt, { exact:false }).first().click({ timeout: 4000 }); await page.waitForTimeout(t||300); } catch(e){ console.log('  miss text', txt); } };

const closeIfOpen = async () => {
  const open = await page.locator('#overlay:not(.hidden)').count();
  if (open) { await page.locator('#overlay-close').first().click({ timeout: 2000 }).catch(()=>{}); await page.waitForTimeout(300); }
};

await page.goto(`http://localhost:${port}/web/`, { waitUntil: 'networkidle' });
await shot('01-landing');
await tapText('Roll a Soul', 800);
await shot('02-ingame');

for (const tab of ['cultivate','people','activities','sect']) {
  await closeIfOpen();
  await tap(`#tabbar .tab[data-tab="${tab}"]`, 500);
  await shot(`tab-${tab}`);
}
await closeIfOpen();
await tap('#pf-more', 450); await shot('sheet'); await closeIfOpen();

console.log('CONSOLE ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
server.close();
