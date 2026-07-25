import type { ClassNameValue } from 'codplay/runtime/perso-shared-types'
import type { DecorLiveSession } from './decor-live-session'

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

// ─── Offset bridge (px, contrats actuels du cadre de sélection) ───────────

export interface OffsetValuesPx {
  x?: number
  y?: number
  width?: number
  height?: number
  translate?: { x: number; y: number }
  rotate?: number
  scale?: { x: number; y: number }
  anchor?: FlexAnchor
}

// ─── Offset editor bridge (spec 2026-07-07-dedit-spec.md §6, "PositionEditorBridge") ──────
//
// dedit est le seul interlocuteur de l'app pour l'édition du décor — l'éditeur visuel de
// position (cadre de sélection) lui est subordonné, jamais un pont indépendant câblé par
// l'app (`2026-07-16-position-bridge-reconciliation-plan.md`). dedit n'importe jamais
// `selection-frame` : cette interface, fournie par l'hôte, est le seul lien.

export type Unsubscribe = () => void

export interface OffsetEditorBridge {
  /** `'transform'` est le mode sélectionné par défaut (spec §6) — seul mode câblé à ce stade
   *  (`'position'`/`'flex-anchor'` n'ont pas encore d'éditeur visuel intégré à l'app). */
  activate(mode: 'position' | 'transform' | 'flex-anchor'): void
  deactivate(): void
  /** champs → geste : une saisie dedit convertie en px, appliquée sur l'élément. */
  apply(patch: OffsetValuesPx): void
  /** geste → champs : diffs continus du cadre de sélection, en px (pas de debounce ici). */
  onValues(cb: (values: OffsetValuesPx) => void): Unsubscribe
  /** Référence de conversion cqw — largeur du conteneur en px. */
  containerRefWidthPx(): number
  /**
   * Extension au-delà du spec §6 (`2026-07-16-position-bridge-reconciliation-plan.md` §Étape D) :
   * un geste CS est-il actuellement en cours ? Seul moyen pour l'hôte de généraliser le flush de
   * fin de phase (chantier 3) à TOUTE édition continue du décor (position ET couleur ET curseur),
   * pas seulement au CS — sans ça, le pont couleur/curseur n'aurait aucun moyen de savoir qu'une
   * phase de manipulation de position est en cours ailleurs.
   */
  isGestureActive(): boolean
  /**
   * Signal de bord (pas un sondage) pour la même raison — un geste CS peut rester actif plus de
   * 250ms sans produire de nouveau delta (pointer immobile, toujours enfoncé) ; un flush purement
   * temporisé le couperait à tort. L'hôte s'abonne pour déclencher le flush exactement à la
   * transition actif → inactif, jamais avant.
   */
  onGestureActiveChange(cb: (active: boolean) => void): Unsubscribe
  /**
   * Message explicite « ce geste vient de se terminer » (`2026-07-18-pose-edit-architecture-
   * study.md` §7) — remplace `onGestureActiveChange(false)` comme déclencheur du regroupement de
   * phase : l'hôte réagit désormais à un événement reçu directement du geste qui vient de finir,
   * jamais à un état (`isGestureActive()`) redéduit à un instant sans rapport garanti avec la fin
   * réelle du geste. Ne porte aucune valeur — celle-ci a déjà atteint `onValues` en continu.
   */
  onCommit(cb: (kind: 'move' | 'resize' | 'rotate' | 'scale') => void): Unsubscribe
  /**
   * Canal unique geste → Decor (`2026-07-25-decor-unified-channel-plan.md` §2/§4) — état
   * `idle`/`live`/`committing` + `DecorPatch` accumulé, consulté par `decor-editor-bridge.ts` au lieu
   * de s'abonner à `onValues`/`onCommit` ci-dessus (qui restent pour d'autres usages — voir
   * `decor-live-session.ts`).
   */
  getLiveSession(): DecorLiveSession
}
