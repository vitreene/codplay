/**
 * Le document d'ed2 — modèle NORMATIF, `app/2026-07-11-ed2-document-model.md`.
 *
 * `sequence-editor/types.ts` est du code de prototype, pas une version antérieure à faire
 * cohabiter : il s'aligne sur ce modèle-ci (`app/2026-07-13-model-alignment-state-and-plan.md`),
 * qui seul fait foi.
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
  | { kind: 'interpolated'; durationMs: number; easing: Easing }

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

export interface PositionData {
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
  position?: PositionData
  zoneId?: string | null
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
  /** Décor de la capsule racine IMPLICITE (jamais un item) — posé une fois, jamais keyframé. */
  rootDecorId?: string
  masterItemId?: string
}
