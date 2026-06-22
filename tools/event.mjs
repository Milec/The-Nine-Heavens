// Age up repeatedly until an event modal appears, then screenshot it.
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml' };
const server = createServer(async (req,res)=>{ try { let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html'; if(p.endsWith('/'))p+='index.html'; const f=join(ROOT,normalize(p)); res.writeHead(200,{'Content-Type':TYPES[extname(f)]||'application/octet-stream'}); res.end(await readFile(f)); } catch { res.writeHead(404); res.end('nf'); } });
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:414,height:896}, deviceScaleFactor:2 });
await page.goto(`http://localhost:${port}/web/`,{waitUntil:'networkidle'});
await page.getByText('Roll a Soul',{exact:false}).first().click(); await page.waitForTimeout(700);
let found=false;
for (let i=0;i<40 && !found;i++){
  // close non-event overlays, then age up
  const ttl = await page.locator('#overlay:not(.hidden) #overlay-title').textContent().catch(()=>null);
  if (ttl && /An Event/i.test(ttl)) { found=true; break; }
  if (ttl) { await page.locator('#overlay-close').first().click().catch(()=>{}); await page.waitForTimeout(150); }
  await page.locator('#tabbar .tab[data-tab="age"]').click().catch(()=>{});
  await page.waitForTimeout(220);
}
await page.waitForTimeout(400);
await page.screenshot({ path: join(ROOT,'tools','shots','event.png') });
const ttl = await page.locator('#overlay:not(.hidden) #overlay-title').textContent().catch(()=>'(none)');
console.log('overlay:', ttl, 'found event:', found);
await browser.close(); server.close();
