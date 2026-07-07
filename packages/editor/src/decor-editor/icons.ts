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
}

export type IconName = keyof typeof ICONS

export function iconSvg(name: IconName): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">${ICONS[name]}</svg>`
}
