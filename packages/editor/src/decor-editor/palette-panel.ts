import type { ItemType } from './types'
import type { IconName } from './icons'

// ─── Panel configuration — fournie par l'hôte, jamais câblée en dur dans dedit ────
//
// Sépare strictement le CONTRAT (décor, résolution d'héritage, multi-sélection —
// aucune notion de panneau) de la couche de RENDU (dupliquable/adaptable sans
// toucher au contrat). Cf plan/2026-07-07-dedit-palette-panels-plan.md

export type PanelId = string

export type PanelFieldKind = 'color' | 'number' | 'slider' | 'boolean' | 'select' | 'icon-select' | 'text'

export interface IconOption {
  value: string
  icon: IconName
}

export interface PanelField {
  /** Chemin dans DecorPatch : "style.background-color", "style.font-size", "custom"… */
  path: string
  kind: PanelFieldKind
  label: string
  /** Pour kind: 'select' uniquement. */
  options?: string[]
  /** Pour kind: 'icon-select' uniquement — boutons icônes sans label (ex. alignement). */
  iconOptions?: IconOption[]
  /**
   * Pour kind: 'boolean' uniquement — valeur écrite pour actif/inactif. Le plus souvent
   * une valeur CSS (ex. "bold"/"normal") pour un champ sous `style.*`, mais un module hors
   * `style` (ex. `textAutoSize.enabled`) porte un vrai booléen TypeScript, pas une chaîne —
   * le rendu n'a pas à imposer un format de valeur au décor (cf §4 bis, moteur de panneaux).
   */
  trueValue?: string | boolean
  falseValue?: string | boolean
  /** Pour kind: 'boolean' uniquement — icône affichée à la place du label texte (ex. B/I). */
  icon?: IconName
  /** Pour kind: 'slider' uniquement — bornes de la plage (valeurs saisies, avant échelle). */
  min?: number
  max?: number
  step?: number
}

export type PalettePanel =
  | { id: PanelId; label: string; kind?: undefined; fields: PanelField[] }
  /** Cas spécial : mini-éditeur de code libre (spec §9), un seul contrôle, pas une liste de champs. */
  | { id: PanelId; label: string; kind: 'custom-code' }
  /** Cas spécial : liste des presets du catalogue (spec §9) — une action (fusion d'un
   *  patch complet), pas une propriété à éditer, donc pas un PanelField classique. */
  | { id: PanelId; label: string; kind: 'preset-list' }

export interface PaletteConfig {
  panels: PalettePanel[]
  /** Ids de panneaux visibles par type d'item — pas de filtrage par champ (spec §5). */
  panelsByItemType: Record<ItemType, PanelId[]>
}

export function panelsForType(itemType: ItemType, config: PaletteConfig): PanelId[] {
  return config.panelsByItemType[itemType] ?? []
}

/** Intersection des panneaux visibles pour plusieurs types (multi-sélection, spec §7 bis). */
export function panelsForTypes(itemTypes: ItemType[], config: PaletteConfig): PanelId[] {
  if (itemTypes.length === 0) return []
  return itemTypes
    .map(type => panelsForType(type, config))
    .reduce((acc, ids) => acc.filter(id => ids.includes(id)))
}

export function findPanel(config: PaletteConfig, id: PanelId): PalettePanel | undefined {
  return config.panels.find(p => p.id === id)
}
