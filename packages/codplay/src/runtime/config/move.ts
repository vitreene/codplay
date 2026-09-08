import type { CompiledValue } from '../../scene/compiled'

/** Stable logical ordering modes for mounted children. */
export const MOVE_ORDER_MODE_AUTO = 'auto' as const
export const MOVE_ORDER_MODE_FIRST = 'first' as const
export const MOVE_ORDER_MODE_LAST = 'last' as const
export const MOVE_ORDER_MODE_APPEND = 'append' as const
export const MOVE_ORDER_MODE_PREPEND = 'prepend' as const
export const MOVE_ISSUE_COMMAND_INVALID = 'AUTHOR_MOVE_COMMAND_INVALID' as const
export const MOVE_ISSUE_CONFLICT_SAME_TICK = 'AUTHOR_MOVE_CONFLICT_SAME_TICK' as const
export const MOVE_ISSUE_LAST_INVALID_SAME_TICK = 'AUTHOR_MOVE_LAST_INVALID_SAME_TICK' as const
export const MOVE_OPERATION_MOUNT = 'mount' as const
export const MOVE_OPERATION_UNMOUNT = 'unmount' as const
export const MOVE_OPERATION_MOVE = 'move' as const

export type MoveOrderMode =
  | typeof MOVE_ORDER_MODE_AUTO
  | typeof MOVE_ORDER_MODE_FIRST
  | typeof MOVE_ORDER_MODE_LAST
  | typeof MOVE_ORDER_MODE_APPEND
  | typeof MOVE_ORDER_MODE_PREPEND
  | number

/** Legacy subpath type retained for compatibility; it is not an accepted V2 author field. */
export type MoveFlipMode = 'local' | 'overlay-world'

/** Legacy subpath type retained for compatibility; path anchoring is now fixed to center. */
export type MovePathAnchor = 'aabb' | 'center'

/** Compiled transition data carried by a move and consumed by the motion materializer. */
export type MoveTransition = Readonly<{
  duration?: number
  delay?: number
  ease?: CompiledValue
  path?: CompiledValue
}>

export type MovePolicyIssue = Readonly<{
  code: typeof MOVE_ISSUE_COMMAND_INVALID
    | typeof MOVE_ISSUE_CONFLICT_SAME_TICK
    | typeof MOVE_ISSUE_LAST_INVALID_SAME_TICK
  message: string
}>

export type MoveOperation =
  | typeof MOVE_OPERATION_MOUNT
  | typeof MOVE_OPERATION_UNMOUNT
  | typeof MOVE_OPERATION_MOVE
