export type ClassNameValue = string | { add?: string; remove?: string }

export type StyleTransitionValue = {
  from?: number | string
  to: number | string
  duration?: number
  delay?: number
  easing?: string
  ease?: string
  stagger?: number
  loopDelay?: number
  reversed?: boolean
  alternate?: boolean
  loop?: boolean | number
  ignoreDuration?: boolean
}

export type StyleEntryValue = string | number | null | undefined | StyleTransitionValue

export type StyleValue = Record<string, unknown>

export type AttrValue = Record<string, unknown>

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

export type MoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

export type MoveFlipMode = 'local' | 'overlay-world'

export type MoveCommand = {
  parentId: string
  mode?: MoveMode
  flip?: boolean
  flipMode?: MoveFlipMode
  reorder?: boolean
  duration?: number
  easing?: string
  ease?: string
  attraction?: number
}

export type ListPlacementConfig = {
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}

export type MoveValue =
  | MoveCommand
  | string
  | { mode?: string; targetId?: string; parentId?: string; flip?: boolean; flipMode?: string; reorder?: boolean; duration?: number; easing?: string; ease?: string; attraction?: number }

export type InputVisualStateValue =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'

export type ModuleCommandDoc = {
  name: string
} & Record<string, unknown>

export type ActionPayloadDoc = Record<string, unknown>

export type ItemModuleConfig = Record<string, unknown>

export type ReplaceDirection =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'left-top'
  | 'right-top'
  | 'left-bottom'
  | 'right-bottom'
  | 'center'
  | 'edges'

export type ReplaceSplit = 'letter' | 'word' | 'line' | 'cells'

export type ReplaceActionValue =
  | string
  | {
      transition: string
      duration?: number
      split?: ReplaceSplit
      stagger?: number
      direction?: ReplaceDirection
      cellX?: number
      cellY?: number
      skipUnchanged?: boolean
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

export type PersoInnerNodePatch = {
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}

export type PersoInitialCommon = {
  id?: string
  className?: ClassNameValue
  move?: MoveValue
  master?: boolean
  style?: StyleValue
  attr?: AttrValue
}

export type PersoActionCommon = {
  ref?: string
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
  move?: MoveValue
  broadcast?: BroadcastAction
  cmd?: ModuleCommandDoc
  payload?: ActionPayloadDoc
  targetId?: string
  replace?: ReplaceActionValue
}
