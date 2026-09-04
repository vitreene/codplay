// ─── Document — réexporté depuis le modèle normatif ──────────────────────────
//
// `app/commands/types.ts` est la source de vérité du document (`app/2026-07-11-ed2-document-model.md`).
// Le sequence-editor n'a pas son propre `EditorScene`/`TrackNode`. Ce qui reste ici est propre au
// sequence-editor : viewport, sélection, interaction, layout/display config — aucun n'a d'équivalent
// dans le modèle document (ce sont des états d'ÉDITEUR, jamais persistés dans `EditorScene`).

export type {
  EditorScene, Item, ItemType, Keyframe, Content, Decor, Zone, ZoneRect, ZoneContainer, Orientation,
  MarkerTrack, Marker, CapsuleDef, CapsuleKind, OffsetData, ClassNameValue, SceneMeta, DurationSource,
  Transition, TransitionKey, Easing, Waveform, Cue, KeyframeChannel,
} from '../app/commands/types'
export { resolveKeyframeChannel } from '../app/commands/types'

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
