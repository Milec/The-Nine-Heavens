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
