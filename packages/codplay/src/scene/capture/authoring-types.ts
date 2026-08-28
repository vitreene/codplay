/** Insertion policy available to an event produced by a capture conclusion. */
export type CaptureEventMode = 'apply-now' | 'persist-only'

/** Duration policy used to anchor events returned by `endCapture`. */
export type CaptureEndDurationMode = 'value' | 'default' | 'capture'

/** Ordinary event declaration emitted by a capture conclusion. */
export type AuthorCaptureEvent = Readonly<{
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
  mode?: CaptureEventMode
}>

/** Read-only state supplied to the capture initializer. */
export type AuthorCaptureInitInput = Readonly<{
  state: Readonly<Record<string, unknown>>
}>

/** Initializes one capture-local state value. */
export type AuthorCaptureInitFunction = (
  input: AuthorCaptureInitInput,
) => Record<string, unknown> | false

/** Read-only values supplied to one continuous capture sample. */
export type AuthorCaptureTrackInput = Readonly<{
  sample: Readonly<Record<string, unknown>>
  samples: readonly Readonly<Record<string, unknown>>[]
  captureState: Readonly<Record<string, unknown>>
}>

/** Logical action returned by a live capture sample. */
export type AuthorCaptureAction = Readonly<{
  actionName: string
  data?: Record<string, unknown>
}>

/** Result returned by one live capture sample. */
export type AuthorCaptureTrackOutput = Readonly<{
  action?: AuthorCaptureAction
  captureState?: Record<string, unknown>
  updateState?: Record<string, unknown>
}>

/** Resolves one live capture sample without creating an event. */
export type AuthorCaptureTrackFunction = (
  input: AuthorCaptureTrackInput,
) => AuthorCaptureTrackOutput | void

/** Values supplied when a capture is closed. */
export type AuthorCaptureEndInput = Readonly<{
  samples: readonly Readonly<Record<string, unknown>>[]
  captureState: Readonly<Record<string, unknown>>
  state: Readonly<Record<string, unknown>>
  meta: Readonly<Record<string, unknown>>
}>

/** Optional ordinary events returned by the capture conclusion function. */
export type AuthorCaptureEndOutput = Readonly<{
  events?: readonly AuthorCaptureEvent[]
  duration?: number
  durationMode?: CaptureEndDurationMode
}>

/** Resolves a capture into ordinary events at its closing boundary. */
export type AuthorCaptureEndFunction = (
  input: AuthorCaptureEndInput,
) => AuthorCaptureEndOutput | void

/** Capture declaration attached to one authoring emit rule. */
export type AuthorCaptureDeclaration = Readonly<{
  trackOn?: readonly string[]
  endOn?: readonly string[]
  stateScope?: 'scene' | 'story'
  initCaptureState?: AuthorCaptureInitFunction
  trackCommand?: AuthorCaptureTrackFunction
  endEmit?: AuthorCaptureEvent
  endCapture?: AuthorCaptureEndFunction
}>

/** One authoring emit rule, following the V1 event-plus-capture shape. */
export type AuthorEmitRule = Readonly<{
  event: AuthorCaptureEvent
  capture?: AuthorCaptureDeclaration
}>

/** Emit declarations indexed by the source trigger understood by an adapter. */
export type AuthorEmitDeclaration = Record<string, AuthorEmitRule | readonly AuthorEmitRule[]>
