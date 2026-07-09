// ─── Transitions ────────────────────────────────────────────────────────────

import type { CapsuleKind } from '@codplay/scene-factory'

export type TransitionKey =
  | '--'
  | 'cut'
  | 'fade'
  | 'swipe-left'
  | 'swipe-right'
  | 'swipe-top'
  | 'swipe-down'
  | 'zoom'

export type EasingValue =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | { type: 'cubic-bezier'; p1x: number; p1y: number; p2x: number; p2y: number }

export type TransitionDef =
  | { kind: 'named'; name: TransitionKey; durationMs: number }
  | { kind: 'interpolated'; durationMs: number; easing: EasingValue }

// ─── Scene ──────────────────────────────────────────────────────────────────

/**
 * Re-exported, not redeclared — `@codplay/scene-factory`'s `CapsulePreset` is the single source of
 * truth for this vocabulary (resolves `CapsuleKind` + author settings, `TrackDistribution`, into
 * the concrete `mode`/values `CapsuleDistribution.compute()` needs — `2026-06-12-capsule-
 * distribution-spec.md` §3.3). A second, separately-declared `CapsuleKind` here previously drifted
 * out of sync with reality once — never again (same class of bug as the old `GRID_MODE`/
 * `GRID_POLICY` duplication).
 */
export type { CapsuleKind }

export interface Keyframe {
  id: string
  timeMs: number
  name?: string
  decorId: string | null
  markerId?: string
  transitionIn?: TransitionDef
  transitionOut?: TransitionDef
}

export interface TrackDistribution {
  mode: 'sequential' | 'stagger'
  staggerInMs?: number
  staggerOutMs?: number
}

export interface TrackNode {
  id: string
  kind: 'element' | 'capsule'
  label: string
  visible: boolean
  contentType?: 'text' | 'image' | 'media' | 'video'
  capsuleType?: CapsuleKind
  /**
   * Provisional override for a `capsule` track's grid size — TEMPORARY, for the ed2-builder demo
   * only (2026-07-09), not a real authored setting. Real grid presets belong to `CapsulePatch`
   * (`2026-07-08-capsule-spec.md` §10, `grid?: {rows?, cols?, gap?}` — panel not yet built).
   */
  grid?: { rows?: number; cols?: number }
  distribution?: TrackDistribution
  children?: TrackNode[]
  keyframes: Keyframe[]
}

export interface EditorDecor {
  id: string
  data: Record<string, unknown>
}

export interface TextCue {
  id: string
  timeMs: number
  label: string
}

export interface AuthorMarker {
  id: string
  timeMs: number
  label: string
  color?: string
}

export interface MarkerTrack {
  id: string
  label: string
  color?: string        // couleur par défaut des marqueurs de cette piste
  visible: boolean
  markers: AuthorMarker[]
}

export interface WaveformDataV1 {
  version: 1
  sampleRate: number
  durationSec: number
  points: number
  min: number[]
  max: number[]
}

export interface AudioTrack {
  id: string
  label: string
  srcUrl: string
  durationMs: number
  waveform?: WaveformDataV1
}

export interface EditorScene {
  id: string
  title: string
  durationMs: number
  durationSource: 'arbitrary' | 'audio-primary' | 'mixed'
  tracks: TrackNode[]
  decors: Record<string, EditorDecor>
  /** Décor de la capsule racine — sans keyframe, posé une seule fois (pas un détournement de Keyframe.decorId). */
  rootDecorId: string | null
  cues: TextCue[]
  markerTracks: MarkerTrack[]
  audio?: AudioTrack
}

// ─── Viewport ───────────────────────────────────────────────────────────────

export interface ViewportState {
  pxPerSec: number
  scrollLeftMs: number
  visibleDurationMs: number
}

// ─── Selection ──────────────────────────────────────────────────────────────

export type SelectionTarget =
  | { type: 'keyframe'; trackId: string; keyframeId: string }
  | { type: 'track'; trackId: string }
  | { type: 'cue'; cueId: string }
  | { type: 'marker'; markerId: string }
  | null

// ─── Interaction ────────────────────────────────────────────────────────────

export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'dragging-playhead'; startMs: number }
  | { kind: 'dragging-keyframe'; trackId: string; keyframeId: string; originMs: number }
  | { kind: 'placing-keyframe'; trackId: string; proposedMs: number }

// ─── Snap ───────────────────────────────────────────────────────────────────

export interface SnapPoint {
  timeMs: number
  source: 'cue' | 'keyframe' | 'marker'
  id: string
}

// ─── XState context ─────────────────────────────────────────────────────────

export type ViewMode = 'compact' | 'expanded'

export interface SequenceEditorContext {
  scene: EditorScene
  viewport: ViewportState
  playheadMs: number
  isPlaying: boolean
  selection: SelectionTarget
  interaction: InteractionState
  viewMode: ViewMode
  layoutProfile: LayoutProfile
  displayConfig: DisplayConfig
  snapGrid: SnapPoint[]
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export interface LayoutProfile {
  rowHeightElement: number
  rowHeightCapsule: number
  rowHeightCues: number
  rowHeightCuesExpanded: number
  rowHeightMarkers: number
  rowHeightWaveform: number
  snapThresholdPx: number
  keyframeHandleSizePx: number
}

// ─── Display ────────────────────────────────────────────────────────────────

export interface DisplayConfig {
  timeUnit: 's' | 'ms'
  capsuleOrder: 'forward' | 'backward'
}
