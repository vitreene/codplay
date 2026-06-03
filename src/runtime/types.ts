/**
 * Defines supported built-in item types while allowing custom types.
 */
export type ItemType = 'text' | 'img' | 'media' | 'list' | 'layout' | string

export type LayoutFormat = 'html' | 'svg'

export type BroadcastAction = {
  type: 'START' | 'PAUSE' | 'STOP'
  startAt?: number
  endAt?: number
  transition?: {
    from?: Record<string, unknown>
    to?: Record<string, unknown>
    duration?: number
  }
}

/**
 * Defines one move mode accepted by the component runtime.
 */
export type MoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

/**
 * Defines one FLIP rendering mode used for move transitions.
 */
export type MoveFlipMode = 'local' | 'overlay-world'

/**
 * Defines one normalized move command payload.
 */
export type MoveCommand = {
  parentId: string
  mode?: MoveMode
  flip?: boolean
  flipMode?: MoveFlipMode
  reorder?: boolean
}

/**
 * Defines list reorder policy values for runtime placement behavior.
 */
export type ListPlacementConfig = {
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}

/**
 * Defines one raw move value accepted from authored story docs.
 */
export type MoveValue =
  | MoveCommand
  | string
  | { mode?: string; targetId?: string; parentId?: string; flip?: boolean; flipMode?: string; reorder?: boolean }

/**
 * Defines one emit rule used by user interactions.
 */
export type EmitRuleEvent = {
  name: string
  cascade?: boolean
}

/**
 * Defines one interaction capture session attached to one emit trigger.
 */
export type EmitCapture = {
  /** Event emitted on each tracked pointer move (e.g. pointermove). Carries {dx, dy, baseX, baseY, x, y}. */
  event: EmitRuleEvent
  /** Event emitted on capture end (e.g. pointerup) with retroactive ms. Carries {fromX, fromY, toX, toY, duration, snapAt}. If absent, falls back to emitting `event` at capture end. */
  endEvent?: EmitRuleEvent
  duration: number
  snapAt: 'start' | 'end'
  /** DOM event names that trigger the live tracking on each tick. Defaults to ['pointermove']. */
  trackOn?: string[]
  /** DOM event names that end the capture session. Defaults to ['pointerup']. */
  endOn?: string[]
}

/**
 * Defines one runtime event declaration emitted from one user interaction.
 */
export type EmitRuleAction = {
  ref?: string
  event: EmitRuleEvent
  data?: Record<string, unknown>
  capture?: EmitCapture
}

/**
 * Defines one authored user-event mapping to one or more runtime emits.
 */
export type EmitRule = EmitRuleAction | EmitRuleAction[]

export type RuntimeEmitSelf = {
  id: string
  name?: string
  storyId: string
}

export type RuntimeEmitEvent = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
  scopeStoryId?: string
  ms?: number
  source?: 'user' | 'system'
}

/**
 * Defines one emit declaration entry keyed by DOM event name.
 */
export type EmitDeclaration = Record<string, EmitRule>

/**
 * Defines one item initial state payload.
 */
export type ItemState = {
  id?: string
  tag?: string
  className?: string
  move?: MoveValue
  markup?: string
  format?: LayoutFormat
  master?: boolean
  config?: ListPlacementConfig
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
}

export type InputVisualStateValue =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'

/**
 * Defines one module command payload used by module integration.
 */
export type ModuleCommandDoc = {
  name: string
} & Record<string, unknown>

/**
 * Defines one generic payload forwarded to custom command handlers.
 */
export type ActionPayloadDoc = Record<string, unknown>

/**
 * Defines one item module configuration payload.
 */
export type ItemModuleConfig = Record<string, unknown>

/**
 * Defines one authored action payload resolved by Director dispatch.
 */
export type ActionDoc = {
  ref?: string
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: MoveValue
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
  checked?: boolean
  disabled?: boolean
  visualState?: InputVisualStateValue
  canValidate?: boolean
  disableAnswers?: boolean
  showCorrection?: boolean
  selectedAnswerIds?: string[]
  correctAnswerIds?: string[]
  broadcast?: BroadcastAction
  cmd?: ModuleCommandDoc
  payload?: ActionPayloadDoc
  targetId?: string
}

/**
 * Defines list animation policy values stored in authored docs.
 */
export type ListAutoAnimateConfig = {
  insert?: boolean
  remove?: boolean
  move?: boolean
  durationMs?: number
  easing?: string
  staggerMs?: number
}

/**
 * Defines list performance policy values stored in authored docs.
 */
export type ListPerfConfig = {
  maxMoveAnimations?: number
}

/**
 * Defines list-specific authored configuration payload.
 */
export type ListConfig = {
  autoAnimate?: ListAutoAnimateConfig
  perf?: ListPerfConfig
}

/**
 * Defines one authored runtime item document.
 */
export type ItemDoc = {
  id: string
  name?: string
  storyId: string
  trackId?: string
  type: ItemType
  module?: ItemModuleConfig
  initial: ItemState
  emit?: EmitDeclaration
  list?: ListConfig
  actions: Record<string, ActionDoc>
}

/**
 * Defines one runtime perso graph consumed by renderer integrations.
 */
export type RuntimePersos = {
  id: string
  persos: Record<string, ItemDoc>
  entriesByStoryId?: Record<string, string[]>
  storyMovesByStoryId?: Record<string, MoveValue>
}

/**
 * Defines one plain object runtime node fallback structure.
 */
export type RuntimeNode = {
  tagName: string
  id?: string
  className?: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  textContent?: string
  src?: string
  namespaceURI?: string
  children?: unknown[]
  parentNode?: unknown | null
  appendChild?: (childNode: unknown) => unknown
  removeChild?: (childNode: unknown) => unknown
}

/**
 * Defines one runtime element entry indexed by item id.
 */
export type RuntimeElement = {
  runtimeItemId: string
  nodeRef: unknown
  plugins?: unknown[]
}

/**
 * Defines the runtime element map used by the current paths.
 */
export type RuntimeElementMap = Map<string, RuntimeElement>

/**
 * Defines one runtime node factory used by tests/integration adapters.
 */
export type RuntimeNodeFactory = (item: ItemDoc) => unknown
