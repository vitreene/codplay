import type { InputCorrectionIconDefinition, InputPartDefinition } from './components/input-component'
import type { CorePersoType, PersoTypeRegistry } from './perso-type-registry'

export type {
  ActionPayloadDoc,
  AttrValue,
  BroadcastAction,
  ClassNameValue,
  InputVisualStateValue,
  ItemModuleConfig,
  LayoutFormat,
  ListAutoAnimateConfig,
  ListConfig,
  ListPerfConfig,
  ListPlacementConfig,
  ModuleCommandDoc,
  MoveCommand,
  MoveFlipMode,
  MoveMode,
  MoveValue,
  PersoActionCommon,
  PersoInitialCommon,
  PersoInnerNodePatch,
  ReplaceActionValue,
  ReplaceDirection,
  ReplaceSplit,
  StyleEntryValue,
  StyleTransitionValue,
  StyleValue,
} from './perso-shared-types'
import type {
  InputVisualStateValue,
  ItemModuleConfig,
  LayoutFormat,
  ListConfig,
  ListPlacementConfig,
  MoveValue,
  PersoActionCommon,
  PersoInitialCommon,
  PersoInnerNodePatch,
} from './perso-shared-types'

/**
 * Defines supported built-in item types while allowing custom types.
 */
export type ItemType = CorePersoType | (string & {})

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
  source?: 'user' | 'system' | 'module'
  mode?: 'persist-future' | 'persist-only'
}

/**
 * Defines one emit declaration entry keyed by DOM event name.
 */
export type EmitDeclaration = Record<string, EmitRule>

export type CustomItemState = PersoInitialCommon & {
  tag?: string
  markup?: string
  format?: LayoutFormat
  config?: ListPlacementConfig
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
  img?: PersoInnerNodePatch
  video?: PersoInnerNodePatch
  selectionIcon?: InputPartDefinition
  correctionIcon?: InputCorrectionIconDefinition
}

export type CustomActionDoc = PersoActionCommon & {
  content?: string
  src?: string
  alt?: string
  fitMode?: 'wallpaper' | 'sprite'
  img?: PersoInnerNodePatch
  video?: PersoInnerNodePatch
  checked?: boolean
  disabled?: boolean
  visualState?: InputVisualStateValue
  canValidate?: boolean
  disableAnswers?: boolean
  showCorrection?: boolean
  selectedAnswerIds?: string[]
  correctAnswerIds?: string[]
}

export type ItemState<T extends ItemType = ItemType> =
  T extends CorePersoType ? PersoTypeRegistry[T]['initial'] : CustomItemState

export type ActionDoc<T extends ItemType = ItemType> =
  T extends CorePersoType ? PersoTypeRegistry[T]['action'] : CustomActionDoc

/**
 * Defines one authored runtime item document.
 */
export type ItemDoc<T extends ItemType = ItemType> = T extends ItemType ? {
  id: string
  name?: string
  storyId: string
  trackId?: string
  type: T
  module?: ItemModuleConfig
  initial: ItemState<T>
  emit?: EmitDeclaration
  list?: ListConfig
  actions: Record<string, ActionDoc<T>>
} : never

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
