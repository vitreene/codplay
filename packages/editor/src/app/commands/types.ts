/**
 * Le document d'ed2 — modèle NORMATIF, `app/2026-07-11-ed2-document-model.md`. Seul ce modèle
 * fait foi ; `sequence-editor/types.ts` le réexporte, ne le redéclare jamais.
 */

import type { CapsuleKind } from '@codplay/scene-factory'

// ─── Transitions ────────────────────────────────────────────────────────────

export type TransitionKey =
  | '--'
  | 'cut'
  | 'fade'
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-top'
  | 'swipe-down'
  | 'zoom'

export type Easing =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | { kind: 'cubic-bezier'; p1x: number; p1y: number; p2x: number; p2y: number }

export type Transition =
  | { kind: 'named'; name: TransitionKey; durationMs: number }
  | {
      kind: 'interpolated'
      durationMs: number
      easing: Easing
      /**
       * Raccourcissement d'une transition d'état de décor entre deux kf internes quelconques
       * (`2026-06-11-sequence-editor-grid-spec.md` §2.2) — `'before'` la fait se terminer AU kf
       * destination (même logique de recul qu'une `transitionIn` nommée) ; `'after'` (défaut) la
       * fait démarrer AU kf source, comportement historique inchangé.
       */
      direction?: 'before' | 'after'
    }

// ─── Item ───────────────────────────────────────────────────────────────────

/**
 * `bloc` = le type fondateur, sans contenu (tout item naît `bloc` puis se différencie —
 * document-model, discussion §« Tout item naît en type bloc »). Les futurs types média
 * (story-média, lottie, rive…) s'ajoutent ici à la disponibilité de leur composant Codplay —
 * jamais fusionnés sous un `media` générique (item-model-spec §5, confirmé document-model).
 */
export type ItemType = 'bloc' | 'text' | 'image' | 'media' | 'video' | 'capsule'

/**
 * Réexporté depuis `@codplay/scene-factory` — source UNIQUE de vérité pour ce vocabulaire
 * (`2026-06-12-capsule-distribution-spec.md` §3.3). Une redéclaration séparée a déjà divergé une
 * fois dans ce repo (`sequence-editor/types.ts`, commentaire sur `CapsuleKind`) — jamais reproduite.
 */
export type { CapsuleKind }

export interface CapsuleDef {
  kind: CapsuleKind
  distribution: { mode: 'sequential' | 'stagger'; staggerInMs?: number; staggerOutMs?: number }
  grid?: { rows: number; cols: number; gap?: { row: number; col: number } }
  defaultTransitionIn?: string
  defaultTransitionOut?: string
  behavior?: string
}

export interface Keyframe {
  id: string
  timeMs: number
  decorId: string
  transitionIn?: Transition
  transitionOut?: Transition
  name?: string
  markerId?: string
}

export interface Item {
  id: string
  type: ItemType
  /** Libellé d'affichage libre (timeline) — PAS le contenu, cf. `Content.text`. Absent : l'éditeur dérive un affichage par défaut. */
  label?: string
  parentId: string | null
  order: string
  visible: boolean
  contentId: string | null
  initialDecorId: string
  keyframes: Keyframe[]
  capsule?: CapsuleDef
}

// ─── Content ────────────────────────────────────────────────────────────────

export interface Waveform {
  version: 1
  sampleRate: number
  durationSec: number
  points: number
  min: number[]
  max: number[]
}

export interface Cue {
  id: string
  timeMs: number
  text: string
}

export interface Content {
  id: string
  type: ItemType
  source?: string
  text?: string
  textAutoSize?: { enabled: boolean }
  lang?: string
  waveform?: Waveform
  cues?: Cue[]
}

// ─── Decor ──────────────────────────────────────────────────────────────────

/**
 * Décalage libre (transform + dimensions) — distinct de la future notion de `position` (placement
 * dans la grille d'une capsule, pas encore construite). Nommage précisé par l'auteur : ce que ce
 * type porte (translate/rotate/scale/x/y/width/height) est un OFFSET par rapport à l'état résolu
 * normalement (zone/placement automatique), jamais une position de grille — `position` reste
 * réservé à ce concept futur, pour ne pas les confondre une fois construit.
 */
export interface OffsetData {
  x?: number
  y?: number
  width?: number
  height?: number
  anchor?: { alignSelf?: string; justifySelf?: string }
  translate?: { x: number; y: number }
  rotate?: number
  scale?: { x: number; y: number }
  ratio?: number | null
}

export type ClassNameValue = string | string[]

export interface Decor {
  id: string
  style?: Record<string, string>
  classes?: ClassNameValue
  offset?: OffsetData
  zoneId?: string | null
  /** CSS libre, responsabilité auteur (`decor-editor/types.ts`'s `DecorPatch.custom`, panneau
   * « Custom ») — même traitement qu'`offset` : un champ structuré côté document, résolu en
   * propriétés de style au build (`build-scene.ts::resolveCustomAsStyle`), bien plus simple
   * (une chaîne à parser, pas plusieurs champs à convertir) mais de même nature. */
  custom?: string
}

// ─── Zone ───────────────────────────────────────────────────────────────────

export type Orientation = 'portrait' | 'landscape'

export interface ZoneRect {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export interface ZoneContainer {
  grid: { rows: number; cols: number; gap?: { row: number; col: number } }
  children: ZoneRect[]
}

export interface Zone {
  id: string
  name: string
  surfaces: Record<Orientation, ZoneRect>
  container?: ZoneContainer
}

// ─── MarkerTrack ────────────────────────────────────────────────────────────

/** Repère temporel ponctuel, libre — posé par l'auteur sur la timeline, sans rattachement à un média (à la différence de `Cue`, qui vit dans `Content` d'une source). */
export interface Marker {
  id: string
  timeMs: number
  label: string
  color?: string
}

/** Table indépendante des items (même patron que `zones`) — regroupement visuel de marqueurs dans la timeline. */
export interface MarkerTrack {
  id: string
  label: string
  color?: string
  visible: boolean
  markers: Marker[]
}

// ─── Scene ──────────────────────────────────────────────────────────────────

export type DurationSource = 'arbitrary' | 'audio-primary' | 'mixed'

export interface SceneMeta {
  title: string
  durationMs: number
  durationSource: DurationSource
  timeUnit: 's' | 'ms'
  capsuleOrder: 'forward' | 'backward'
  sceneState?: Record<string, unknown>
  hooks?: { onStart?: string; onSequenceEnd?: string }
}

export interface EditorScene {
  id: string
  meta: SceneMeta
  items: Item[]
  contents: Record<string, Content>
  decors: Record<string, Decor>
  zones: Record<string, Zone>
  /** Marqueurs libres sur la timeline, indépendants de tout item/média (même patron que `zones`). */
  markerTracks: Record<string, MarkerTrack>
  /** Décor de la capsule racine IMPLICITE (jamais un item) — posé une fois, jamais keyframé. */
  rootDecorId?: string
  masterItemId?: string
}
