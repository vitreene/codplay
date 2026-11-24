// ─── Document — réexporté depuis le modèle normatif ──────────────────────────
//
// `app/commands/types.ts` est la source de vérité du document (`specs/editor-document-model-spec.md`).
// Le sequence-editor n'a pas son propre `EditorScene`/`TrackNode`. Ce qui reste ici est propre au
// sequence-editor : layout et display config — aucun n'a d'équivalent dans le modèle document (ce
// sont des états d'ÉDITEUR, jamais persistés dans `EditorScene`).

export type {
  EditorScene, Item, ItemType, Keyframe, Content, Decor, Zone, ZoneRect, ZoneContainer, Orientation,
  MarkerTrack, Marker, CapsuleDef, CapsuleKind, OffsetData, ClassNameValue, SceneMeta, DurationSource,
  Transition, TransitionKey, Easing, Waveform, Cue, KeyframeChannel,
} from '../app/commands/types'
export { resolveKeyframeChannel } from '../app/commands/types'

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
