import type { CompiledCaptureDeclaration, CompiledRecord } from '../../scene/compiled'
import type { RuntimeEventInsertMode } from '../config/event-insertion'
import type { RuntimeCaptureSession } from './runtime-capture-session'

/** One source sample captured during a continuous session. */
export type RuntimeCaptureSample = Readonly<Record<string, unknown>>

/** Ephemeral state owned by one capture session. */
export type RuntimeCaptureState = CompiledRecord

/** Selects one action already declared in the target compiled persos. */
export type RuntimeCaptureAction = Readonly<{
  actionName: string
  data?: CompiledRecord
}>

/** Normal event declaration produced when a capture reaches its end. */
export type RuntimeCaptureEvent = Readonly<{
  name: string
  data?: CompiledRecord
  cascade?: boolean
  mode?: RuntimeEventInsertMode
}>

/** Identifies which independent capture conclusion produced one routed event. */
export type RuntimeCaptureEndEventSource = 'endCapture' | 'endEmit'

/** Event normalized by the session before it reaches the standard dispatcher. */
export type RuntimeCaptureEndEvent = RuntimeCaptureEvent & Readonly<{
  source: RuntimeCaptureEndEventSource
  applyAtMs: number
  mode: RuntimeEventInsertMode
}>

/** Input supplied once when a capture session is opened. */
export type RuntimeCaptureInitInput = Readonly<{
  state: CompiledRecord
}>

/** Initializes the private state of one capture session. */
export type RuntimeCaptureInitFunction = (
  input: RuntimeCaptureInitInput,
) => RuntimeCaptureState | false

/** Input supplied to the live command for each captured sample. */
export type RuntimeCaptureTrackInput = Readonly<{
  sample: RuntimeCaptureSample
  samples: readonly RuntimeCaptureSample[]
  captureState: RuntimeCaptureState
}>

/** Live result returned by one capture sample. */
export type RuntimeCaptureTrackOutput = Readonly<{
  action?: RuntimeCaptureAction
  captureState?: RuntimeCaptureState
  updateState?: CompiledRecord
}>

/** Resolves one live sample without producing a journal event. */
export type RuntimeCaptureTrackFunction = (
  input: RuntimeCaptureTrackInput,
) => RuntimeCaptureTrackOutput | void

/** Input supplied once when a capture session closes. */
export type RuntimeCaptureEndInput = Readonly<{
  samples: readonly RuntimeCaptureSample[]
  captureState: RuntimeCaptureState
  state: CompiledRecord
  meta: Readonly<Record<string, unknown>>
}>

/** Result optionally returned by the capture end function. */
export type RuntimeCaptureEndOutput = Readonly<{
  events?: readonly RuntimeCaptureEvent[]
  duration?: number
  durationMode?: RuntimeCaptureEndDurationMode
}>

/** Duration policy used to anchor events returned by `endCapture`. */
export type RuntimeCaptureEndDurationMode = 'value' | 'default' | 'capture'

/** Resolves the accumulated capture into ordinary end events. */
export type RuntimeCaptureEndFunction = (
  input: RuntimeCaptureEndInput,
) => RuntimeCaptureEndOutput | void

/** Capture declaration after its functions have been resolved for runtime use. */
export type RuntimeCaptureDeclaration = Readonly<{
  trackOn?: readonly string[]
  endOn?: readonly string[]
  stateScope?: 'scene' | 'story'
  initCaptureState?: RuntimeCaptureInitFunction
  trackCommand?: RuntimeCaptureTrackFunction
  endEmit?: RuntimeCaptureEvent
  endCapture?: RuntimeCaptureEndFunction
}>

/** Input used by a player to open one named capture session. */
export type RuntimeCaptureBeginInput = Readonly<{
  captureId: string
  storyId: string
  declaration: RuntimeCaptureDeclaration
}>

/** Input used when a source adapter starts a capture from compiled scene data. */
export type RuntimeCompiledCaptureBeginInput = Readonly<{
  captureId: string
  storyId: string
  declaration: CompiledCaptureDeclaration
}>

/** Result returned after a player opens one capture session. */
export type RuntimeCaptureBeginResult = Readonly<{
  ok: true
  captureId: string
  captureState: RuntimeCaptureState
}> | RuntimeCaptureFailure

/** Non-fatal authoring diagnostic emitted when a capture has no persistent end event. */
export type RuntimeCaptureWarning = Readonly<{
  code: 'CAPTURE_REPLAY_NOT_IDENTICAL'
  message: string
}>

/** Result of one successful capture closure. */
export type RuntimeCaptureEndResult = Readonly<{
  ok: true
  events: readonly RuntimeCaptureEndEvent[]
  endCaptureEvents: readonly RuntimeCaptureEndEvent[]
  endEmitEvent?: RuntimeCaptureEndEvent
  samples: readonly RuntimeCaptureSample[]
  captureState: RuntimeCaptureState
  startedAtMs: number
  endedAtMs: number
  resolvedDurationMs: number
  endCaptureApplyAtMs?: number
  warnings: readonly RuntimeCaptureWarning[]
}> 

/** Result returned after the player routes all capture end events. */
export type RuntimeCapturePlayerEndResult = RuntimeCaptureEndResult & Readonly<{
  dispatchResults: readonly import('../player/pipeline/runtime-event-dispatcher').RuntimeEventDispatchResult[]
}>

/** Result of one rejected capture operation. */
export type RuntimeCaptureFailure = Readonly<{
  ok: false
  code: string
  message: string
}>

/** Result of opening one source-agnostic capture session. */
export type RuntimeCaptureOpenResult =
  | Readonly<{ ok: true; session: RuntimeCaptureSession }>
  | RuntimeCaptureFailure

/** Result of one live sample submission. */
export type RuntimeCaptureTrackResult = Readonly<{
  ok: true
  action?: RuntimeCaptureAction
  captureState: RuntimeCaptureState
  updateState?: CompiledRecord
  sampleCount: number
}> | RuntimeCaptureFailure

/** Runtime lifecycle of one capture session. */
export type RuntimeCaptureStatus = 'active' | 'ended' | 'cancelled'
