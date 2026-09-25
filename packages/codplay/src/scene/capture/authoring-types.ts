/** Insertion policy available to an event produced by a capture conclusion. */
export type CaptureEventMode = 'apply-now' | 'persist-only'

/** Named visibility of one V2 runtime event. */
export type EventVisibility = 'story' | 'scene' | 'public'

/** Duration policy used to anchor events returned by `endCapture`. */
export type CaptureEndDurationMode = 'value' | 'default' | 'capture'

/** Ordinary event declaration emitted by a capture conclusion. */
export type AuthorCaptureEvent = Readonly<{
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
  mode?: CaptureEventMode
}>

/** Ordinary V2 event carried by a non-capture `Perso.emit` rule. */
export type AuthorEmitEvent = Readonly<{
  name: string
  data?: Record<string, unknown>
  visibility?: EventVisibility
  mode?: CaptureEventMode
}>

/** One observation output that may be emitted once or at every transition. */
export type AuthorScrollObservationEvent = AuthorEmitEvent & Readonly<{
  once?: true
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
  name: string
  data?: Record<string, unknown>
}>

/** Result returned by one live capture sample. */
export type AuthorCaptureTrackOutput = Readonly<{
  actions?: readonly AuthorCaptureAction[]
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

/** Native IntersectionObserver options allowed for one declared scroll zone. */
export type AuthorScrollObservationZone = Readonly<{
  rootMargin?: string
  scrollMargin?: string
  threshold?: number | readonly number[]
  trackVisibility?: boolean
}>

/** Discrete enter and leave events declared by one observed perso. */
export type AuthorScrollObservationDeclaration = Readonly<{
  /** Logical id of an ancestor scroll-container used to disambiguate the root. */
  root?: string
  /** Compiled TweenAction on this perso, updated with the visible ratio. */
  liveAction?: string
  zone?: AuthorScrollObservationZone
  enter?: readonly AuthorScrollObservationEvent[]
  leave?: readonly AuthorScrollObservationEvent[]
}>

/** Common authoring fields shared by ordinary and captured emit rules. */
type AuthorEmitRuleBase = Readonly<{
  /** Optional materialized part reference used by the DOM source adapter. */
  ref?: string
  /** Matches KeyboardEvent.code, retaining the V1 property name. */
  keyCode?: string
  /** Prevents the native browser default for a matched event. */
  preventDefault?: boolean
  /** Author data attached to this action, at the same level as `event`. */
  data?: Record<string, unknown>
}>

/** Ordinary V2 `Perso.emit` rule with named event visibility. */
export type AuthorEmitRule =
  | (AuthorEmitRuleBase & Readonly<{
    event: AuthorEmitEvent
    capture?: undefined
    observe?: undefined
  }>)
  | (AuthorEmitRuleBase & Readonly<{
    /** The existing source-agnostic capture declaration keeps its own event shape. */
    event: AuthorCaptureEvent
    capture: AuthorCaptureDeclaration
    observe?: undefined
  }>)
  | AuthorScrollObservationDeclaration

/** Emit declarations indexed by the source trigger understood by an adapter. */
export type AuthorEmitDeclaration = Record<string, AuthorEmitRule | readonly AuthorEmitRule[]>
