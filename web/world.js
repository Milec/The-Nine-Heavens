/* The Nine Heavens -- a randomly generated world map of travelable locations.
 *
 * The realm is a scatter of named places, each sitting in one of the five
 * REGIONS (its "biome", which drives danger and yields exactly as before) and
 * of a TYPE (city, town, sect seat, wilds, ruins, frontier...) that decides
 * what you can DO there: trade, seek a sect, hunt, delve. The player travels
 * the map a year at a time, and the rest of the game reads their current
 * location through `c.region` (kept in sync) so every old system still works.
 */
import * as D from "./data.js";

// Location types. `market` allows commerce; `settle` allows an abode/sect seat;
// `hunt`/`delve` flag the wilds and ruins; `npc` is rough social density.
export const LOC_TYPES = {
  city:     { label: "City",        icon: "city",   market: true,  settle: true,  npc: 3, hunt: 0,   delve: 0, blurb: "A great walled city of cultivators — markets, sects, and a thousand schemes." },
  town:     { label: "Town",        icon: "town",   market: true,  settle: true,  npc: 2, hunt: 0,   delve: 0, blurb: "A bustling market town where rogue cultivators trade and gossip." },
  village:  { label: "Village",     icon: "town",   market: true,  settle: true,  npc: 1, hunt: 0.1, delve: 0, blurb: "A modest spirit-farming village clinging to the foot of the mountains." },
  sect:     { label: "Sect Seat",   icon: "sect",   market: true,  settle: true,  npc: 2, hunt: 0,   delve: 0, blurb: "The mountain seat of a cultivation sect, its halls heavy with incense and ambition." },
  wild:     { label: "Wilds",       icon: "wild",   market: false, settle: false, npc: 0, hunt: 0.3, delve: 0, blurb: "Trackless wilderness thick with spirit-beasts and untouched herbs." },
  ruin:     { label: "Ruins",       icon: "ruin",   market: false, settle: false, npc: 0, hunt: 0.1, delve: 1, blurb: "The bones of a fallen immortal domain, its sealed depths heavy with peril and fortune." },
  frontier: { label: "Frontier",    icon: "region", market: false, settle: false, npc: 1, hunt: 0.2, delve: 0.5, blurb: "A lawless edge of the map where the strong take all and the weak feed the earth." },
};

const NAME_PRE = ["Azure", "Cloudreach", "Jade", "Thunderfall", "Crimson", "Frostfall", "Golden", "Misty", "Ninefold", "Silent", "Verdant", "Scarlet", "Profound", "Heavenspan", "Cangling", "Vast", "Stonewind", "Moonset", "Sunfall", "Greywild", "Ironvein", "Whisperwood", "Brightpeak", "Hollowmere", "Duskwater", "Highcloud"];
const SUF = {
  city: ["City", "Capital", "Citadel"],
  town: ["Town", "Market", "Crossing", "Haven", "Hold"],
  village: ["Village", "Hamlet", "Rest"],
  sect: ["Peak", "Palace", "Sanctum", "Court", "Pavilion"],
  wild: ["Wilds", "Forest", "Marsh", "Steppe", "Moor"],
  ruin: ["Ruins", "Tombs", "Remnant", "Barrows", "Wreck"],
  frontier: ["Frontier", "Reach", "Verge", "Wastes", "Edge"],
};
const CN_PRE = ["青", "云", "玄", "雷", "赤", "寒", "金", "幽", "九", "寂", "苍", "朱", "天", "石", "月", "日", "灵", "碧", "紫", "玉"];
const CN_SUF = { city: ["城", "都"], town: ["镇", "坊", "市"], village: ["村", "乡"], sect: ["峰", "宫", "殿", "阁"], wild: ["林", "泽", "原", "野"], ruin: ["墟", "陵", "冢"], frontier: ["关", "界", "荒"] };

// Biome (= REGION) by how far a place lies from the safe heartland at the centre.
// REGIONS run azuredomain(safe) -> starfall(deadly), so distance maps to danger.
function biomeForRadius(r) {
  const idx = r < 20 ? 0 : r < 33 ? 1 : r < 47 ? 2 : r < 60 ? 3 : 4;
  return D.REGIONS[idx][0];
}
const biomeIndex = key => Math.max(0, D.REGIONS.findIndex(r => r[0] === key));

// Sect alignments prefer certain biomes for their mountain seats.
const SECT_BIOME = { cloudmist: 0, fiveelem: 1, spiritbeast: 2, azure: 0, heavensword: 2, bloodcult: 3 };

function placeName(rng, type) {
  const pre = rng.choice(NAME_PRE), suf = rng.choice(SUF[type] || SUF.town);
  const cn = rng.choice(CN_PRE) + rng.choice(CN_SUF[type] || CN_SUF.town);
  return { name: `${pre} ${suf}`, cn };
}

// Generate the realm: a connected scatter of ~13 places around a heartland city,
// each given a biome by distance and a type by biome, with the six sect seats
// forced into fitting biomes. Returns { locations:[...], start:id }.
function retype(loc, type, rng) { const nm = placeName(rng, type); loc.type = type; loc.name = nm.name; loc.cn = nm.cn; }

export function generateWorld(rng) {
  const N = 17;
  const locs = [];
  const farEnough = (x, y) => locs.every(l => (l.x - x) ** 2 + (l.y - y) ** 2 > 11 * 11);
  // The heartland city at the centre — the player's cradle.
  const start = placeName(rng, "city");
  locs.push({ id: 0, x: 50, y: 50, biome: D.REGIONS[0][0], type: "city", name: start.name, cn: start.cn, sectKey: null });
  // Scatter the rest at growing radii (and so growing danger).
  let guard = 0;
  while (locs.length < N && guard++ < 6000) {
    const ang = rng.random() * Math.PI * 2;
    const rad = 13 + rng.random() * 61;
    const x = 50 + Math.cos(ang) * rad, y = 50 + Math.sin(ang) * rad;
    if (x < 6 || x > 94 || y < 6 || y > 94 || !farEnough(x, y)) continue;
    const biome = biomeForRadius(rad), bi = biomeIndex(biome);
    // Type leans on the biome: safe lands hold settlements, the marches hold wilds/ruins.
    const roll = rng.random();
    let type;
    if (bi <= 1) type = roll < 0.34 ? "town" : roll < 0.5 ? "village" : roll < 0.74 ? "wild" : roll < 0.92 ? "ruin" : "city";
    else if (bi === 2) type = roll < 0.26 ? "town" : roll < 0.58 ? "wild" : roll < 0.86 ? "ruin" : "village";
    else if (bi === 3) type = roll < 0.42 ? "wild" : roll < 0.7 ? "ruin" : roll < 0.9 ? "frontier" : "town";
    else type = roll < 0.42 ? "frontier" : roll < 0.74 ? "ruin" : "wild";
    const nm = placeName(rng, type);
    locs.push({ id: locs.length, x: Math.round(x), y: Math.round(y), biome, type, name: nm.name, cn: nm.cn, sectKey: null });
  }
  // Seat the six sects: find (or make) a fitting settlement in each one's biome.
  for (const sect of D.SECTS) {
    const key = sect[0], wantBi = SECT_BIOME[key] != null ? SECT_BIOME[key] : 0;
    let cand = locs.filter(l => !l.sectKey && l.id !== 0 && LOC_TYPES[l.type].settle && biomeIndex(l.biome) === wantBi);
    if (!cand.length) cand = locs.filter(l => !l.sectKey && l.id !== 0 && biomeIndex(l.biome) === wantBi);
    if (!cand.length) cand = locs.filter(l => !l.sectKey && l.id !== 0 && Math.abs(biomeIndex(l.biome) - wantBi) <= 1);
    if (!cand.length) cand = locs.filter(l => !l.sectKey && l.id !== 0);
    if (!cand.length) break;
    const loc = rng.choice(cand);
    loc.sectKey = key;
    if (loc.type !== "sect") retype(loc, "sect", rng);
    loc.sectKey = key;
  }
  // Guarantee a varied realm: enough wilds to hunt, ruins to delve, and a deadly
  // frontier — converting spare non-seat places in the outer lands if short.
  const free = () => locs.filter(l => l.id !== 0 && !l.sectKey);
  const count = t => locs.filter(l => l.type === t).length;
  const convertToward = (type, want, minBi) => {
    while (count(type) < want) {
      const pool = free().filter(l => l.type !== type && biomeIndex(l.biome) >= minBi).sort((a, b) => biomeIndex(b.biome) - biomeIndex(a.biome));
      if (!pool.length) break;
      retype(pool[0], type, rng);
    }
  };
  convertToward("wild", 3, 1);
  convertToward("ruin", 2, 1);
  if (!count("frontier")) { const outer = free().filter(l => biomeIndex(l.biome) >= 3).sort((a, b) => biomeIndex(b.biome) - biomeIndex(a.biome)); if (outer.length) retype(outer[0], "frontier", rng); }
  return { locations: locs, start: 0 };
}

/* ----------------------------- helpers ---------------------------------- */
export const locById = (c, id) => (c.world && c.world.locations[id]) || null;
export const currentLoc = c => locById(c, c.location || 0);
export const typeOf = loc => (loc && LOC_TYPES[loc.type]) || LOC_TYPES.town;
export const biomeKeyOf = loc => (loc && loc.biome) || "azuredomain";
export const hasMarket = c => { const l = currentLoc(c); return !!(l && typeOf(l).market); };
export const canDelveHere = c => { const l = currentLoc(c); return !!(l && typeOf(l).delve > 0); };
export const sectSeat = (c, key) => c.world ? c.world.locations.find(l => l.sectKey === key) : null;
// A market in a richer, safer place trades a touch cheaper than a far-flung one.
export const locPriceMult = c => { const l = currentLoc(c); return l ? [0.9, 1.0, 1.12, 1.28, 1.45][biomeIndex(l.biome)] : 1; };
// Straight-line distance, in (rough) years of travel: near is 1, the far edge ~3.
export function travelYears(c, toId) {
  const a = currentLoc(c), b = locById(c, toId);
  if (!a || !b) return 1;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return Math.max(1, Math.min(3, Math.round(d / 28)));
}

// Keep the old single-key world model (`c.region`, market pricing) in lockstep
// with the player's current location, so every legacy system needs no changes.
export function syncLocation(c) {
  const l = currentLoc(c);
  if (l) { c.region = l.biome; c.priceMult = locPriceMult(c); }
}

// Drop a freshly born / loaded / reincarnated soul into a world, generating one
// if they have none. Idempotent unless `fresh` forces a brand-new realm.
export function ensureWorld(c, rng, fresh = false) {
  if (fresh || !c.world || !Array.isArray(c.world.locations) || !c.world.locations.length) {
    c.world = generateWorld(rng);
    c.location = c.world.start;
  }
  if (c.location == null || !locById(c, c.location)) c.location = c.world.start;
  // Migrate an old save's free-floating region onto a fitting map location.
  syncLocation(c);
  return c.world;
}
