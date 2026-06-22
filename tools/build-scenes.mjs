// Author the milestone "raster accents" as ink-wash SVG and bake them to JPEG
// in web/assets/scenes/. Run after editing a scene:  node tools/build-scenes.mjs
// These are opaque full-bleed paintings, so JPEG keeps them tiny and offline.
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'web', 'assets', 'scenes');
const W = 1200, H = 560;

// a small standing cultivator silhouette at (x, baseY), height h
const figure = (x, y, h, fill = '#0a0d16') => {
  const w = h * 0.34;
  return `<g fill="${fill}" stroke="none">
    <circle cx="${x}" cy="${y - h}" r="${h * 0.12}"/>
    <path d="M${x - w / 2} ${y} Q${x} ${y - h * 0.92} ${x + w / 2} ${y} Q${x} ${y - h * 0.2} ${x - w / 2} ${y}Z"/>
  </g>`;
};
const ridge = (pts, fill, op = 1) => `<path d="M0 ${H} L${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L${W} ${H} Z" fill="${fill}" opacity="${op}"/>`;

const COMMON = `
  <radialGradient id="vig" cx="50%" cy="46%" r="72%">
    <stop offset="60%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".5"/>
  </radialGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="9"/></filter>
  <filter id="soft2"><feGaussianBlur stdDeviation="20"/></filter>`;

const SCENES = {
  // ---- A NEW SOUL IS BORN — dawn breaking over the mountain home ----
  birth: `
    <defs>${COMMON}
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#16203c"/><stop offset=".42" stop-color="#3c3a5e"/>
        <stop offset=".66" stop-color="#9a5f63"/><stop offset=".8" stop-color="#d59766"/><stop offset="1" stop-color="#f0c483"/>
      </linearGradient>
      <radialGradient id="sun" cx="50%" cy="78%" r="42%">
        <stop offset="0" stop-color="#fff1cf" stop-opacity=".95"/><stop offset="45%" stop-color="#f6cf90" stop-opacity=".5"/><stop offset="100%" stop-color="#f6cf90" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <circle cx="600" cy="436" r="300" fill="url(#sun)"/>
    <circle cx="600" cy="430" r="52" fill="#fff4da" opacity=".9" filter="url(#soft)"/>
    ${ridge([[140,300],[300,348],[470,286],[640,340],[820,288],[1000,344],[1200,300]], '#42476a', .55)}
    ${ridge([[0,372],[180,338],[360,392],[560,332],[760,396],[980,344],[1200,388]], '#33344f', .8)}
    ${ridge([[0,452],[220,410],[430,468],[660,414],[900,470],[1200,432]], '#1c2236')}
    <!-- near hill with a pagoda home -->
    <path d="M0 560 L0 486 Q300 452 560 498 Q840 540 1200 484 L1200 560 Z" fill="#10131f"/>
    <g fill="#0a0d16" stroke="none" transform="translate(360 470)">
      <path d="M-34 8 L34 8 L24 -2 L-24 -2 Z"/><path d="M-26 -2 L26 -2 L18 -12 L-18 -12 Z"/>
      <path d="M0 -30 L20 -14 L-20 -14 Z"/><rect x="-16" y="8" width="32" height="20"/>
    </g>
    <g stroke="#1a2236" stroke-width="2.4" fill="none" opacity=".6">
      <path d="M760 196 q12 -9 24 0"/><path d="M812 178 q10 -8 20 0"/><path d="M868 208 q9 -7 18 0"/>
    </g>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>`,

  // ---- HEAVENLY TRIBULATION — the storm that judges a breakthrough ----
  tribulation: `
    <defs>${COMMON}
      <radialGradient id="storm" cx="50%" cy="20%" r="95%">
        <stop offset="0" stop-color="#3a2f52"/><stop offset="45%" stop-color="#211c38"/><stop offset="100%" stop-color="#0c0a18"/>
      </radialGradient>
      <linearGradient id="bolt" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff"/><stop offset="100%" stop-color="#c9a6ff"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#storm)"/>
    <g fill="#181430" opacity=".85" filter="url(#soft2)">
      <ellipse cx="320" cy="150" rx="280" ry="80"/><ellipse cx="760" cy="110" rx="320" ry="92"/><ellipse cx="1040" cy="170" rx="240" ry="76"/>
    </g>
    <g opacity=".5" stroke="#b79be8" stroke-width="1"><path d="M180 120 L120 560"/><path d="M420 100 L370 560"/><path d="M700 130 L760 560"/><path d="M980 110 L1040 560"/></g>
    <!-- the bolt -->
    <path d="M612 70 L548 250 L606 250 L520 470" stroke="#caa8ff" stroke-width="16" fill="none" opacity=".35" filter="url(#soft)"/>
    <path d="M612 70 L556 248 L610 248 L532 462 L596 270 L560 270 Z" fill="url(#bolt)"/>
    ${ridge([[0,430],[240,360],[470,452],[600,300],[760,448],[1000,372],[1200,440]], '#0c0a18')}
    ${figure(600, 372, 56, '#05040a')}
    <ellipse cx="600" cy="330" rx="70" ry="30" fill="#caa8ff" opacity=".18" filter="url(#soft)"/>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>`,

  // ---- ASCENSION — the gate of golden light opens above the cloud sea ----
  ascend: `
    <defs>${COMMON}
      <linearGradient id="asky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1a2547"/><stop offset=".5" stop-color="#3b4f86"/><stop offset="1" stop-color="#9fb9e6"/>
      </linearGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff5d6" stop-opacity=".0"/><stop offset="100%" stop-color="#ffe6a3" stop-opacity=".85"/>
      </linearGradient>
      <radialGradient id="halo" cx="50%" cy="30%" r="55%">
        <stop offset="0" stop-color="#fff4d2" stop-opacity=".95"/><stop offset="100%" stop-color="#fff4d2" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#asky)"/>
    <circle cx="600" cy="120" r="240" fill="url(#halo)"/>
    <polygon points="520,0 680,0 640,520 560,520" fill="url(#beam)" opacity=".8"/>
    <polygon points="556,0 644,0 620,520 580,520" fill="#fff7df" opacity=".55"/>
    <!-- celestial gate -->
    <g fill="#e9c987" opacity=".8">
      <rect x="470" y="120" width="22" height="220"/><rect x="708" y="120" width="22" height="220"/>
      <path d="M455 124 q145 -54 290 0 l-12 22 q-133 -46 -266 0 Z"/>
    </g>
    <!-- cloud sea -->
    <g fill="#cdddf4" filter="url(#soft2)" opacity=".9">
      <ellipse cx="220" cy="500" rx="320" ry="70"/><ellipse cx="640" cy="520" rx="380" ry="80"/><ellipse cx="1040" cy="500" rx="320" ry="72"/>
    </g>
    <g fill="#eef4ff" filter="url(#soft)" opacity=".7"><ellipse cx="430" cy="470" rx="160" ry="34"/><ellipse cx="860" cy="478" rx="180" ry="36"/></g>
    ${figure(600, 392, 60, '#3a2f12')}
    <rect width="${W}" height="${H}" fill="url(#vig)"/>`,

  // ---- A LEGEND PASSES — dusk, a lone lantern, petals on the wind ----
  death: `
    <defs>${COMMON}
      <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1124"/><stop offset=".55" stop-color="#1d2742"/><stop offset="1" stop-color="#2c3450"/>
      </linearGradient>
      <radialGradient id="moon" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#e8e3cf"/><stop offset="70%" stop-color="#c9c6b4"/><stop offset="100%" stop-color="#c9c6b4" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="lantern" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#ffcf86" stop-opacity=".95"/><stop offset="100%" stop-color="#ffcf86" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#dsky)"/>
    <circle cx="876" cy="156" r="150" fill="url(#moon)" opacity=".5"/>
    <circle cx="876" cy="156" r="74" fill="#e8e3cf" opacity=".8"/>
    ${ridge([[0,392],[260,344],[520,402],[800,340],[1040,400],[1200,360]], '#141a30', .9)}
    ${ridge([[0,470],[300,432],[620,484],[940,430],[1200,470]], '#0a0f1f')}
    <!-- bare pine silhouette -->
    <g stroke="#06090f" stroke-width="7" fill="none" stroke-linecap="round">
      <path d="M250 540 L250 300"/><path d="M250 360 L188 318 M250 392 L320 350 M250 426 L196 398 M250 330 L300 296"/>
    </g>
    <!-- a hung lantern -->
    <circle cx="430" cy="300" r="120" fill="url(#lantern)"/>
    <g stroke="#3a2a18" stroke-width="3" fill="#d88a3a"><path d="M430 230 L430 256" stroke="#2a2030"/><rect x="412" y="256" width="36" height="48" rx="9"/></g>
    <circle cx="430" cy="280" r="9" fill="#ffe6b0"/>
    <!-- drifting petals -->
    <g fill="#d9889e" opacity=".85"><ellipse cx="560" cy="220" rx="7" ry="4" transform="rotate(20 560 220)"/><ellipse cx="640" cy="300" rx="6" ry="3.5" transform="rotate(-30 640 300)"/><ellipse cx="700" cy="180" rx="6" ry="3.5" transform="rotate(40 700 180)"/><ellipse cx="520" cy="360" rx="6" ry="3.5" transform="rotate(10 520 360)"/><ellipse cx="760" cy="360" rx="6" ry="3.5" transform="rotate(-20 760 360)"/></g>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>`,
};

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
for (const [name, inner] of Object.entries(SCENES)) {
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg(inner)}</body></html>`, { waitUntil: 'networkidle' });
  await page.locator('svg').screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('baked', name);
}
await browser.close();
console.log('scenes ->', OUT);
