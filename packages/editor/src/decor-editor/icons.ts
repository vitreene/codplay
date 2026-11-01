// ─── Icônes — glyphes lucide-static inlinés ─────────────────────────────────
//
// `stroke="currentColor"` : la couleur suit celle du bouton (héritée via CSS),
// pas de dépendance de framework, juste des chaînes SVG à injecter en innerHTML.

const ICONS: Record<string, string> = {
  'align-left': '<path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/>',
  'align-center': '<path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/>',
  'align-right': '<path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/>',
  'align-justify': '<path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/>',
  bold: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
  italic: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  offset: '<rect x="4" y="4" width="13" height="13" rx="2"/><path d="M10 14 20 4M15 4h5v5"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  'eye-off': '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.3 3.4 9.5 7a10.5 10.5 0 0 1-2.1 3.5"/><path d="M6.6 6.6C4.5 7.8 3.1 9.8 2.5 12c.4 1.2 1.2 2.3 2.2 3.2A10.2 10.2 0 0 0 12 19c.8 0 1.5-.1 2.2-.3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
}

export type IconName = keyof typeof ICONS

export function iconSvg(name: IconName): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">${ICONS[name]}</svg>`
}
