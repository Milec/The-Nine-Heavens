/* The Nine Heavens -- persistent meta-progression. Achievements and a tally of
 * feats survive across every reincarnation and brand-new soul, stored apart from
 * the active save. Each achievement earns a sliver of "Heavenly Favor" that
 * subtly blesses the innate talent of all future lives. */

const KEY = "nineheavens.meta.v1";

// [id, name, description]
export const ACHIEVEMENTS = [
  ["first_blood", "First Blood", "Win your first battle."],
  ["foundation", "Foundation Laid", "Reach Foundation Establishment."],
  ["golden", "Golden Core", "Forge a Golden Core."],
  ["nascent", "Nascent Soul", "Reach the Nascent Soul realm."],
  ["ascend", "Ascendant", "Ascend to the Nine Heavens."],
  ["nemesis", "Grudge Settled", "Slay your sworn nemesis."],
  ["champion", "Arena Champion", "Win a sect grand tournament."],
  ["delver", "Realm Delver", "Conquer a Secret Realm to its heart."],
  ["bossslayer", "Giant-Killer", "Slay a boss-tier foe."],
  ["tamer", "Beast Tamer", "Tame a spirit beast companion."],
  ["daoist", "Dao Walker", "Comprehend a great Dao."],
  ["alchemist", "Grand Alchemist", "Refine a Flawless pill."],
  ["legendary", "Living Legend", "Reach Legendary world standing."],
  ["sectmaster", "Sect Master", "Rise to the seat of Sect Master."],
  ["companion", "Two Hearts as One", "Pledge yourself to a dao companion."],
  ["devil", "Heaven-Defying Devil", "Sink to the deepest sin."],
  ["saint", "Living Saint", "Attain the heights of merit."],
  ["patriarch", "Patriarch of a Lineage", "Teach 5 techniques to your students."],
  ["founder", "Open a Mountain Gate", "Found your own sect."],
  ["reborn_founder", "The Founder Returns", "Reclaim a sect you founded in a past life."],
  ["eternal", "Eternal Soul", "Live a fifth reincarnation."],
];
const BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a[0], a]));

let M = null;
function load() {
  if (M) return M;
  try { M = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { M = {}; }
  M.ach = M.ach || {}; M.stats = M.stats || {};
  return M;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) {} }

export function unlock(id) {
  load();
  if (M.ach[id] || !BY_ID[id]) return null;
  M.ach[id] = Date.now(); save();
  return BY_ID[id];               // returns [id,name,desc] for a fresh unlock
}
export function favor() { load(); return Object.keys(M.ach).length; }
export function bump(k, n = 1) { load(); M.stats[k] = (M.stats[k] || 0) + n; save(); }
export function stat(k) { load(); return M.stats[k] || 0; }
export function list() { load(); return ACHIEVEMENTS.map(a => ({ id: a[0], name: a[1], desc: a[2], got: !!M.ach[a[0]] })); }
