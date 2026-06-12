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

export type CapsuleKind =
  | 'carrousel'
  | 'rangee'
  | 'liste'
  | 'grille'
  | 'position'
  | 'card'
  | 'legacy'

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
  order?: 'forward' | 'backward'
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
  cues: TextCue[]
  markers: AuthorMarker[]
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
}
