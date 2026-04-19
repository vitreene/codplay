/**
 * Defines supported built-in item types while allowing custom types.
 */
export type ItemType = 'text' | 'img' | 'list' | string

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
export type EmitRule = {
  events: string[]
  data?: Record<string, unknown>
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
  config?: ListPlacementConfig
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
}

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
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: MoveValue
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
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
  type: ItemType
  module?: ItemModuleConfig
  initial: ItemState
  emit?: EmitDeclaration[]
  children?: string[]
  list?: ListConfig
  actions: Record<string, ActionDoc>
}

/**
 * Defines one authored story document loaded by renderer/player.
 */
export type StoryDoc = {
  id: string
  items: Record<string, ItemDoc>
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
 * Defines the runtime element map used by legacy and current paths.
 */
export type RuntimeElementMap = Map<string, RuntimeElement>

/**
 * Defines one runtime node factory used by tests/integration adapters.
 */
export type RuntimeNodeFactory = (item: ItemDoc) => unknown
