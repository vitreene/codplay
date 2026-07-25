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

/** Unités container-query — une valeur déjà dans l'une d'elles est déjà dans l'unité finale du
 *  décor, jamais une longueur physique à reconvertir (`container-query-units.ts`, `codplay`). */
const CONTAINER_QUERY_UNIT_SUFFIX = /^-?[\d.]+(cqw|cqh|cqi|cqb|cqmin|cqmax)$/

/**
 * Convertit une valeur RÉSOLUE (lue en direct sur le node via `AuthorApi.getNodeSnapshot`, jamais
 * saisie par l'auteur) en chaîne CSS finale pour une propriété donnée — pendant du décor temporaire
 * (`2026-07-17-resolved-state-at-time-notes.md`). Différent de `formatNumberForCssProperty` :
 * jamais de `scale` (ce facteur n'ajuste que la granularité perçue d'une SAISIE, sans rapport avec
 * une valeur déjà résolue) — seule la conversion physique px→cqw s'applique, pour les propriétés
 * qui en ont besoin (`format:'cqw'`).
 *
 * `getNodeSnapshot` NE GARANTIT PAS une longueur toujours suffixée `px` (bug constaté et corrigé en
 * direct, cette session — `2026-07-25-cqw-px-conversion-boundary-plan.md`) : il renvoie le style
 * CSS tel qu'actuellement posé sur le node, dans SON unité d'origine — `cqw` si aucune transition
 * anime.js n'est active sur cette propriété à cet instant (ex. décor temporaire entre deux
 * keyframes sans tween en cours), `px` si une transition l'a déjà résolu. Reconvertir une valeur
 * déjà en `cqw` comme si elle était en px (l'ancien comportement, `Number.parseFloat` aveugle à
 * l'unité) produisait un effondrement géométrique à chaque cycle de lecture (18 → 3.44 → 0.66 →
 * … cqw à chaque seek, observé en direct). Une valeur déjà container-query passe donc telle
 * quelle, sans nouvelle conversion — un seul point de conversion physique (px→cqw), jamais
 * appliqué à une valeur qui a déjà traversé ce point.
 */
export function formatLiveValueForCssProperty(cssProperty: string, liveValue: string | number, containerWidthPx: number): string {
  const entry = NUMBER_FORMAT_BY_PROPERTY[cssProperty] ?? DEFAULT_ENTRY
  if (entry.format === 'raw') {
    const parsed = typeof liveValue === 'number' ? liveValue : Number.parseFloat(liveValue)
    return Number.isFinite(parsed) ? String(parsed) : String(liveValue)
  }
  if (typeof liveValue === 'string' && CONTAINER_QUERY_UNIT_SUFFIX.test(liveValue)) return liveValue
  const parsed = typeof liveValue === 'number' ? liveValue : Number.parseFloat(liveValue)
  if (!Number.isFinite(parsed)) return String(liveValue)
  return `${pxToCqw(parsed, containerWidthPx)}cqw`
}
