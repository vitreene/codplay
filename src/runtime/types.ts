export type ItemType = 'text' | 'img' | 'list' | string

export type ItemState = {
  id?: string
  tag?: string
  className?: string
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  content?: string
  src?: string
}

export type ActionDoc = {
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  payload?: Record<string, unknown>
  targetId?: string
}

export type ListAutoAnimateConfig = {
  insert?: boolean
  remove?: boolean
  move?: boolean
  durationMs?: number
  easing?: string
  staggerMs?: number
}

export type ListPerfConfig = {
  maxMoveAnimations?: number
}

export type ListConfig = {
  autoAnimate?: ListAutoAnimateConfig
  perf?: ListPerfConfig
}

export type ItemDoc = {
  id: string
  type: ItemType
  initial: ItemState
  children?: string[]
  list?: ListConfig
  actions: Record<string, ActionDoc>
}

export type StoryDoc = {
  id: string
  items: Record<string, ItemDoc>
}

export type RuntimeNode = {
  tagName: string
  id?: string
  className?: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  textContent?: string
  src?: string
}

export type RuntimeElement = {
  runtimeItemId: string
  nodeRef: unknown
  plugins?: unknown[]
}

export type RuntimeElementMap = Map<string, RuntimeElement>

export type RuntimeNodeFactory = (item: ItemDoc) => unknown
