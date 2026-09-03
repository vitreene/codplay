/** V2 class value accepted by the className service. */
export type ClassNameValue = string | { add?: string; remove?: string }

// ─── Orientation ────────────────────────────────────────────────────────────

export type OrientationContext = 'horizontal' | 'vertical'

// ─── Item ───────────────────────────────────────────────────────────────────

export type ItemType = 'text' | 'image' | 'media' | 'video' | 'capsule'

// ─── Flex anchor (position d'appui — résolu par l'outil attache-flex) ──────

export interface FlexAnchor {
  alignSelf: 'start' | 'center' | 'end' | 'stretch'
  justifySelf: 'start' | 'center' | 'end' | 'stretch'
}

// ─── Capsule ────────────────────────────────────────────────────────────────

export interface CapsulePatch {
  behavior?: string
  defaultTransition?: string
  sequencing?: 'sequential' | 'stagger'
  staggerMs?: number
  grid?: { rows: number; cols: number } | { preset: string }
}

// ─── Offset (module non-CSS, transposé en aval — spec §6) ──────────────────
//
// Décalage libre (transform + dimensions), distinct de la future `position` (placement dans la
// grille d'une capsule, pas encore construite) — nommage précisé par l'auteur pour ne pas les
// confondre une fois `position` construite : ce module ne porte jamais de placement de grille.

export interface OffsetPatch {
  x?: number // cqw
  y?: number // cqw
  width?: number // cqw
  height?: number // cqw
  ratio?: number | null // contrainte l/h ; null = libre
  anchor?: FlexAnchor
  translate?: { x: number; y: number } // cqw
  rotate?: number // degrés
  scale?: { x: number; y: number }
  /** Rotation axis in local-box fractions; omitted means the box center. */
  rotationOrigin?: { fx: number; fy: number }
}

// ─── Text auto-size (module non-CSS, transposé en aval — spec text-auto-size §5) ──
//
// La coche « auto » ne peut pas vivre dans `style` (valeurs CSS finales uniquement) :
// elle vit dans ce module à part, comme `offset`. Le calcul lui-même (taille de police,
// line-height) est produit par `@codplay/text-auto-size`, jamais stocké ici — seule
// l'intention (`enabled`) est persistée dans l'écart.

export interface TextAutoSizePatch {
  enabled: boolean
}

// ─── Decor patch (écart) ────────────────────────────────────────────────────
//
// `style` est une carte OUVERTE de propriétés CSS : le domaine ne connaît
// aucune propriété nommée en dur (il y en a 900+, la palette n'en couvre
// qu'une fraction croissante). Chaque valeur est une chaîne CSS déjà finale —
// une saisie via curseur/champ sans unité est résolue par la palette AVANT
// d'être écrite ici, jamais stockée comme valeur intermédiaire à convertir.
// La couleur suit la même règle (chaîne CSS, ex. "oklch(...)" ou un
// "linear-gradient(...)") ; elle pourra devenir un module dédié plus tard,
// comme `offset`, si son édition a besoin d'un état structuré propre.
//
// Seuls les modules qui produisent du CSS via une interface intermédiaire
// (offset aujourd'hui ; d'autres demain — bordures par côté, clip-path…)
// sortent de `style` : leurs données ne sont pas elles-mêmes des valeurs CSS.

export interface DecorPatch {
  style?: Record<string, string>
  /** Même modèle que le runtime codplay (add/remove sur chaînes espacées, ou remplacement total). */
  classes?: ClassNameValue
  offset?: OffsetPatch
  zone?: string | null // référence PAR NOM ; null = surface de la capsule
  capsule?: CapsulePatch // items capsule uniquement (§ 8)
  text?: string // contenu textuel (saisie dans dedit)
  textAutoSize?: TextAutoSizePatch // items texte uniquement (spec text-auto-size §5)
  custom?: string // mini-éditeur de code : CSS libre, responsabilité auteur
  /** Optional CodPlay V2 SVG path for the incoming segment; absent means straight and never cascades. */
  path?: string
}

/** Décor entièrement résolu (repli complet de la chaîne d'héritage). Même forme que DecorPatch. */
export type ResolvedDecor = DecorPatch

// ─── Decor preset ───────────────────────────────────────────────────────────

export interface DecorPreset {
  name: string
  /** Jamais `offset`, `zone`, `capsule` — cf spec §9. */
  patch: DecorPatch
}

// ─── Zones ──────────────────────────────────────────────────────────────────

export interface ZoneCoords {
  x: number // cqw, relatif à la capsule
  y: number // cqw
  width: number // cqw
  height: number // cqw
}

export type ZoneDef =
  | { name: string; coords: ZoneCoords }
  | { name: string; contexts: Record<OrientationContext, ZoneCoords> }

export type ZoneTable = ZoneDef[]

export interface ZoneCard {
  name: string
  zones: ZoneTable
}

// ─── Selection Frame value (px, interface de decor-editor) ───────────────

export interface SelectionFrameValue {
  x: number
  y: number
  width: number
  height: number
  rotate?: number
  scaleX?: number
  scaleY?: number
  /** Rotation axis in local-box fractions; omitted means the box center. */
  rotationOrigin?: { fx: number; fy: number }
}
export type Unsubscribe = () => void
