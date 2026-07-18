// ─── Formatage des valeurs CSS — config centralisée ─────────────────────────
//
// La palette édite des propriétés CSS via des contrôles conviviaux (nombre sans
// unité affichée, curseur…) mais le décor ne stocke que des chaînes CSS finales
// (spec §3.2) — jamais de valeur intermédiaire à convertir en aval. Cette table
// dit, pour une propriété CSS donnée, comment un nombre saisi devient une chaîne
// CSS : certaines propriétés acceptent un nombre nu (order, z-index, opacity…),
// d'autres ont besoin d'une unité (cqw, systématique pour toute grandeur — §3.3).
//
// Un FACTEUR D'ÉCHELLE (`scale`) permet d'ajuster la granularité perçue : une
// saisie de "1" ne produit pas nécessairement "1cqw" — pour des grandeurs fines
// (épaisseur de bord, rayon, padding), une valeur de scale plus petite rapproche
// l'unité saisie du rendu visuel réel. Valeur = évaluation empirique, à ajuster
// ici sans toucher au reste du code.

import { pxToCqw } from './units'

export type NumberFormat = 'cqw' | 'raw'

interface NumberFormatEntry {
  format: NumberFormat
  /** Facteur multiplicatif appliqué à la valeur saisie avant application de l'unité. */
  scale?: number
}

const NUMBER_FORMAT_BY_PROPERTY: Record<string, NumberFormatEntry> = {
  order: { format: 'raw' },
  'z-index': { format: 'raw' },
  opacity: { format: 'raw' },
  'font-weight': { format: 'raw' },
  'line-height': { format: 'raw' },
  'border-width': { format: 'cqw', scale: 0.25 },
  'border-radius': { format: 'cqw', scale: 0.25 },
  padding: { format: 'cqw', scale: 0.25 },
}

const DEFAULT_ENTRY: NumberFormatEntry = { format: 'cqw' }

/** Convertit une saisie numérique en chaîne CSS finale pour une propriété donnée. */
export function formatNumberForCssProperty(cssProperty: string, value: number): string {
  const entry = NUMBER_FORMAT_BY_PROPERTY[cssProperty] ?? DEFAULT_ENTRY
  if (entry.format === 'raw') return String(value)
  const scaled = value * (entry.scale ?? 1)
  return `${scaled}cqw`
}

/**
 * Extrait la valeur saisie (avant échelle) d'une chaîne CSS déjà formatée —
 * inverse de `formatNumberForCssProperty`, pour réafficher la valeur telle que
 * l'utilisateur l'a tapée plutôt que la valeur cqw résultante.
 */
export function parseNumberFromCssValue(cssProperty: string, value: string): number | undefined {
  const match = value.match(/^-?\d+(\.\d+)?/)
  if (!match) return undefined
  const entry = NUMBER_FORMAT_BY_PROPERTY[cssProperty] ?? DEFAULT_ENTRY
  const scale = entry.format === 'cqw' ? (entry.scale ?? 1) : 1
  return Number(match[0]) / scale
}

/**
 * Convertit une valeur RÉSOLUE (lue en direct sur le node via `AuthorApi.getNodeSnapshot`, jamais
 * saisie par l'auteur) en chaîne CSS finale pour une propriété donnée — pendant du décor temporaire
 * (`2026-07-17-resolved-state-at-time-notes.md`). Différent de `formatNumberForCssProperty` :
 * jamais de `scale` (ce facteur n'ajuste que la granularité perçue d'une SAISIE, sans rapport avec
 * une valeur déjà résolue) — seule la conversion physique px→cqw s'applique, pour les propriétés
 * qui en ont besoin (`format:'cqw'`). `getNodeSnapshot` renvoie ces longueurs suffixées ("8.52px")
 * pour toute propriété hors du vocabulaire de pose propre d'anime — jamais un nombre nu, d'où le
 * parsing ici plutôt qu'un `Number()` direct.
 */
export function formatLiveValueForCssProperty(cssProperty: string, liveValue: string | number, containerWidthPx: number): string {
  const entry = NUMBER_FORMAT_BY_PROPERTY[cssProperty] ?? DEFAULT_ENTRY
  const parsed = typeof liveValue === 'number' ? liveValue : Number.parseFloat(liveValue)
  if (!Number.isFinite(parsed)) return String(liveValue)
  if (entry.format === 'raw') return String(parsed)
  return `${pxToCqw(parsed, containerWidthPx)}cqw`
}
