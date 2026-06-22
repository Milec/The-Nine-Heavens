/* The Nine Heavens -- a small hand-drawn SVG icon set.
 * One ink-line family, drawn on a 24x24 grid in `currentColor`, replaces the
 * grab-bag of platform emoji so the whole interface reads as a single
 * deliberate hand. Each glyph inherits the colour of the chip / tab / tile
 * that holds it, and scales with CSS rather than a font size. */

const ICONS = {
  // ---- bottom navigation ----
  cultivate:   '<path d="M12 4.6c1.7 2 1.7 5 0 7-1.7-2-1.7-5 0-7Z"/><path d="M12 11.6c2.4-1.2 5.3-.4 6.5 1.7-2.5 1.1-5.3.3-6.5-1.7Z"/><path d="M12 11.6c-2.4-1.2-5.3-.4-6.5 1.7 2.5 1.1 5.3.3 6.5-1.7Z"/><path d="M5 13.2c1.8 3 4.3 4.6 7 4.6s5.2-1.6 7-4.6"/>',
  people:      '<circle cx="9" cy="8" r="2.5"/><path d="M3.8 19c0-3 2.2-4.9 5.2-4.9S14.2 16 14.2 19"/><circle cx="16.6" cy="8.6" r="2"/><path d="M14.7 14.4c2.4-.2 5.3 1.2 5.3 4.6"/>',
  ageup:       '<path d="M4 18.5h16"/><path d="M7 18.5a5 5 0 0 1 10 0"/><path d="M12 3.4v3M5.1 7l1.7 1.7M18.9 7l-1.7 1.7"/>',
  pursuits:    '<circle cx="12" cy="12" r="8.4"/><path d="M15.7 8.3 13.2 13.1l-4.9 2.6L10.9 11l4.8-2.7Z" fill="currentColor" stroke="none"/>',
  sect:        '<path d="M3.4 9.4 12 5l8.6 4.4"/><path d="M5.5 9.6v8.9M18.5 9.6v8.9M4 18.5h16"/><path d="M9.6 18.5v-4.4h4.8v4.4"/><path d="M12 5V3.2"/>',
  sheet:       '<rect x="5" y="3.2" width="14" height="17.6" rx="1.8"/><path d="M8.2 8h7.6M8.2 12h7.6M8.2 16h4.8"/>',

  // ---- the three per-year deed budgets ----
  deedCult:    '<circle cx="12" cy="12" r="8.4"/><path d="M12 3.6a4.2 4.2 0 0 0 0 8.4 4.2 4.2 0 0 1 0 8.4 8.4 8.4 0 0 0 0-16.8Z" fill="currentColor" stroke="none"/>',
  deedAct:     '<path d="M12 2.6 13.6 6.1v8.1h-3.2V6.1L12 2.6Z" fill="currentColor" stroke="none"/><path d="M8.4 15h7.2M12 15v4.6M10.2 19.6h3.6"/>',
  deedSocial:  '<path d="M12 20.2C7.6 17.1 4 14.1 4 9.7 4 7.4 5.8 5.9 7.8 5.9c1.6 0 3.2 1 4.2 2.6 1-1.6 2.6-2.6 4.2-2.6 2 0 3.8 1.5 3.8 3.8 0 4.4-3.6 7.4-8 10.5Z"/>',

  // ---- the five innate attributes (banner tiers) ----
  comprehension: '<path d="M2.6 12S6 6.1 12 6.1 21.4 12 21.4 12 18 17.9 12 17.9 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.6"/>',
  constitution:  '<path d="M3 18.4 9 9l3.5 5 2.2-3.5L21 18.4Z"/><path d="M3 18.4h18"/>',
  soul:          '<path d="M12 3.2s4 3.5 4 7.9a4 4 0 0 1-8 0c0-1.7.8-2.9 1.3-3.4.2 1.4 1 2 1 2C9.6 7.7 12 3.2 12 3.2Z"/>',
  fortune:       '<path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7Z"/>',
  charm:         '<g fill="currentColor" stroke="none"><circle cx="12" cy="6.6" r="2.2"/><circle cx="17" cy="10.3" r="2.2"/><circle cx="15.1" cy="16" r="2.2"/><circle cx="8.9" cy="16" r="2.2"/><circle cx="7" cy="10.3" r="2.2"/><circle cx="12" cy="11.9" r="2.4"/></g>',

  // ---- resources & standing on the banner ----
  stones:      '<path d="M7.5 4h9l3.5 5-8 11-8-11Z"/><path d="M4 9h16M9 4 7.5 9 12 20M15 4l1.5 5L12 20"/>',
  herbs:       '<path d="M5 19c0-7.6 5.6-12.6 14.6-13.6C19.6 14 14 19.6 6 18.5"/><path d="M7.6 17C9.6 12.8 13.1 9.6 17 7.6"/>',
  region:      '<path d="M12 20.6s5.6-5.3 5.6-10.3A5.6 5.6 0 0 0 6.4 10.3C6.4 15.3 12 20.6 12 20.6Z"/><circle cx="12" cy="10" r="2.1"/>',
  power:       '<path d="m12 2.6 1.5 5.4 4.8-2.2-2.2 4.8 5.4 1.5-5.4 1.5 2.2 4.8-4.8-2.2-1.5 5.4-1.5-5.4-4.8 2.2 2.2-4.8L2.6 11.6l5.4-1.5-2.2-4.8 4.8 2.2Z" fill="currentColor" stroke="none"/>',

  // ---- life-stage / realm avatars ----
  avChild:    '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.6 20c0-3.6 2.9-6 6.4-6s6.4 2.4 6.4 6"/>',
  avYouth:    '<circle cx="12" cy="8" r="3.2"/><path d="M5.6 20c0-3.7 2.9-6.1 6.4-6.1s6.4 2.4 6.4 6.1"/><path d="M9 5.6 12 3.2l3 2.4"/>',
  avAdultM:   '<circle cx="12" cy="8.1" r="3.3"/><path d="M5.6 20c0-3.7 2.9-6.1 6.4-6.1s6.4 2.4 6.4 6.1"/>',
  avAdultF:   '<circle cx="12" cy="8.1" r="3.3"/><path d="M6 20c0-3.5 2.5-6.1 6-6.1s6 2.6 6 6.1"/><path d="M5 20h14"/>',
  avAdept:    '<circle cx="12" cy="8.3" r="3.2"/><path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path d="M8.4 6.4 12 4.2l3.6 2.2"/>',
  avSage:     '<circle cx="12" cy="8.3" r="3.2"/><path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path d="M8 6 12 3.5 16 6"/><path d="M12 1.8 12.9 3.6h-1.8Z" fill="currentColor" stroke="none"/>',
  avElder:    '<circle cx="12" cy="8.3" r="3.2"/><path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="12" cy="4.3" r="2.3"/>',
  avImmortal: '<circle cx="12" cy="8.4" r="3.2"/><path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path d="M6.6 4.5a5.4 5.4 0 0 0 10.8 0"/><path d="M12 1.6v1.7"/>',

  // ---- world-map place types ----
  city:       '<path d="M3 20h18"/><path d="M5 20V9l4-2v13"/><path d="M9 20V7l5-3v16"/><path d="M14 20V9l5 2v9"/><path d="M11.5 11v2M11.5 15v2"/>',
  town:       '<path d="M3 20h18"/><path d="M5 20v-7l5-4 5 4v7"/><path d="M9.2 20v-4h1.6v4"/><path d="M16 20v-6l3-2v8"/>',
  wild:       '<path d="M12 3c2.4 2.4 2.4 6.2 0 9-2.4-2.8-2.4-6.6 0-9Z"/><path d="M12 12v9"/><path d="M12 15c-1.6-1.8-4-2.1-5.6-1 .8 2 3.2 2.9 5.6 1Z"/>',
  ruin:       '<path d="M3 21h18"/><path d="M5 21V8l3 2v11"/><path d="M11 21V5l3 3v13"/><path d="M17 21v-8l2 1.5V21"/>',

  // ---- relationship portraits (tinted by role at the call site) ----
  maiden:     '<circle cx="12" cy="8.1" r="3.3"/><path d="M6 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path d="M8.7 6.2C8 8 6.8 9 6.8 9M15.3 6.2C16 8 17.2 9 17.2 9"/>',
  couple:     '<circle cx="8.4" cy="8" r="2.5"/><path d="M3.8 19c0-3 2-4.7 4.6-4.7"/><circle cx="15.6" cy="8" r="2.5"/><path d="M20.2 19c0-3-2-4.7-4.6-4.7"/><path d="M12 13.6c-1 1-1 2 0 3 1-1 1-2 0-3Z" fill="currentColor" stroke="none"/>',

  // ---- event-card & misc glyphs (replace platform emoji) ----
  blade:      '<path d="M12 2.6 10.7 5.4v8.4h2.6V5.4L12 2.6Z" fill="currentColor" stroke="none"/><path d="M8.4 13.8h7.2"/><path d="M12 13.8v4.4"/><path d="M10.1 18.2h3.8"/>',
  heart:      '<path d="M12 19.6C7.8 16.6 4.6 13.9 4.6 10.3A3.6 3.6 0 0 1 12 8.4 3.6 3.6 0 0 1 19.4 10.3C19.4 13.9 16.2 16.6 12 19.6Z"/>',
  mask:       '<path d="M6 7.5c0-1.2 2-2.2 6-2.2s6 1 6 2.2c0 5.2-2.6 11-6 11s-6-5.8-6-11Z"/><path d="M5.8 5.4 7.6 8.2M18.2 5.4 16.4 8.2"/><path d="M9 11.4c.9.7 1.7.7 2.6 0M12.4 11.4c.9.7 1.7.7 2.6 0"/>',
  key:        '<circle cx="8" cy="8" r="3.4"/><path d="m10.4 10.4 8.2 8.2M15.8 15.8l2.2-2.2M13.6 13.6l2-2"/>',
  flame:      '<path d="M12 3c2.6 3 4 5.2 4 7.6a4 4 0 0 1-8 0C8 8.2 9.4 6 12 3Z"/><path d="M12 9.6c1 1.1 1.5 2 1.5 2.9a1.5 1.5 0 0 1-3 0c0-.9.5-1.8 1.5-2.9Z" fill="currentColor" stroke="none"/>',
  scroll:     '<path d="M8 4h9v13.5a2.5 2.5 0 0 1-2.5 2.5H7"/><path d="M8 4a2 2 0 0 0-2 2v1.6h2.5"/><path d="M7 20a2.5 2.5 0 0 0 2.5-2.5V6"/><path d="M11 9h3.4M11 12.4h3.4"/>',
  dao:        '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a4.3 4.3 0 0 0 0 8.6 4.3 4.3 0 0 1 0 8.6 8.6 8.6 0 0 0 0-17.2Z" fill="currentColor" stroke="none"/><circle cx="12" cy="7.7" r=".95" fill="currentColor" stroke="none"/><circle cx="12" cy="16.3" r=".95"/>',

  // ---- pursuits sub-menu nav glyphs ----
  fist:       '<path d="M7 12.5V9.4a1.3 1.3 0 0 1 2.6 0M9.6 9V7.6a1.3 1.3 0 0 1 2.6 0V9M12.2 9.2V8a1.3 1.3 0 0 1 2.6 0v3.4"/><path d="M7 12.5v2.1a4.6 4.6 0 0 0 9.2 0V11"/><path d="M7 12.6 5.7 11a1.3 1.3 0 0 0-1.9 1.8l2.1 2.7"/>',
  compass:    '<circle cx="12" cy="12" r="8.4"/><path d="M15.5 8.5 13.1 13l-4.6 2.5L10.9 11l4.6-2.5Z" fill="currentColor" stroke="none"/><path d="M12 3.4v1.3M12 19.3v1.3M3.4 12h1.3M19.3 12h1.3"/>',
  cauldron:   '<path d="M5.5 11h13v2a6.5 6.5 0 0 1-13 0v-2Z"/><path d="M9 11V9.2a3 3 0 0 1 6 0V11"/><path d="M12 5.6V4.2M9.4 6.2 8.6 5M14.6 6.2l.8-1.2"/><path d="M8 20.2h8"/>',
  coin:       '<circle cx="12" cy="12" r="8.3"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1.1"/>',
  pagoda:     '<path d="M12 3 19 6H5L12 3Z" fill="currentColor" stroke="none"/><path d="M6.4 6.4 5 9h14l-1.4-2.6M7 9v3.4h10V9M7.4 12.4 6 15h12l-1.4-2.6M8 15v5.4h8V15"/><path d="M10.5 20.4V17h3v3.4"/>',
  globe:      '<circle cx="12" cy="12" r="8.4"/><path d="M3.7 12h16.6M12 3.6c2.5 2.3 2.5 14.5 0 16.8-2.5-2.3-2.5-14.5 0-16.8Z"/>',

  // ---- ladders, lists & start screen ----
  crown:      '<path d="M4 17.4h16M4.4 17.4 5.6 8.4l3.9 3.8L12 6.2l2.5 6 3.9-3.8 1.2 9Z"/>',
  trophy:     '<path d="M8 4.2h8v3.6a4 4 0 0 1-8 0V4.2Z"/><path d="M8 5.4H5.6V7a3 3 0 0 0 2.6 3M16 5.4h2.4V7a3 3 0 0 1-2.6 3"/><path d="M12 11.8v3.2M9 19.8h6M10.2 19.8l.5-2.8h2.6l.5 2.8"/>',
  lock:       '<rect x="5.4" y="10.4" width="13.2" height="9.2" rx="1.8"/><path d="M8.2 10.4V8a3.8 3.8 0 0 1 7.6 0v2.4"/><circle cx="12" cy="14.6" r="1.1" fill="currentColor" stroke="none"/>',
  dice:       '<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.2"/><circle cx="8.7" cy="8.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.3" cy="8.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="8.7" cy="15.3" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.3" cy="15.3" r="1.15" fill="currentColor" stroke="none"/>',
  brush:      '<path d="M5 19.2c1.7.4 3.2-.3 3.8-1.8.5-1.3-.3-2.5-1.3-2.9-1.5-.6-3 .5-2.6 2.1"/><path d="M8 15 16.4 6.6a2 2 0 0 1 2.8 2.8L10.8 17.8"/>',
  lotus:      '<path d="M12 19c-2-1-3.2-3-3.2-5.4 0-2 1.3-3.9 3.2-5.7 1.9 1.8 3.2 3.7 3.2 5.7 0 2.4-1.2 4.4-3.2 5.4Z"/><path d="M12 19c-3.8 0-6.8-2.3-6.8-4.9 1.7-.5 3.4 0 4.5 1M12 19c3.8 0 6.8-2.3 6.8-4.9-1.7-.5-3.4 0-4.5 1"/>',
  seal:       '<rect x="4.5" y="4.5" width="15" height="15" rx="2.2"/><path d="M8 8h8v8H8z"/><path d="M10.4 8v8M13.6 8v8M8 10.7h8M8 13.4h8"/>',

  menu:       '<path d="M5 7h14M5 12h14M5 17h14"/>',
  close:      '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron:    '<path d="M9 5l7 7-7 7"/>',
};

export function icon(name, opts = {}) {
  const { size = 22, cls = "", stroke = 1.7 } = opts;
  const inner = ICONS[name] || ICONS.power;
  return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export function hasIcon(name) { return Object.prototype.hasOwnProperty.call(ICONS, name); }
