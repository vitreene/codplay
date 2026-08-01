/** Stable logical ordering modes for mounted children. */
export const MOVE_ORDER_MODE_AUTO = 'auto' as const
export const MOVE_ORDER_MODE_FIRST = 'first' as const
export const MOVE_ORDER_MODE_LAST = 'last' as const
export const MOVE_ORDER_MODE_APPEND = 'append' as const
export const MOVE_ORDER_MODE_PREPEND = 'prepend' as const
export const MOVE_ISSUE_COMMAND_INVALID = 'AUTHOR_MOVE_COMMAND_INVALID' as const
export const MOVE_ISSUE_CONFLICT_SAME_TICK = 'AUTHOR_MOVE_CONFLICT_SAME_TICK' as const
export const MOVE_ISSUE_LAST_INVALID_SAME_TICK = 'AUTHOR_MOVE_LAST_INVALID_SAME_TICK' as const

export type MoveOrderMode =
  | typeof MOVE_ORDER_MODE_AUTO
  | typeof MOVE_ORDER_MODE_FIRST
  | typeof MOVE_ORDER_MODE_LAST
  | typeof MOVE_ORDER_MODE_APPEND
  | typeof MOVE_ORDER_MODE_PREPEND
  | number

export type MovePolicyIssue = Readonly<{
  code: typeof MOVE_ISSUE_COMMAND_INVALID
    | typeof MOVE_ISSUE_CONFLICT_SAME_TICK
    | typeof MOVE_ISSUE_LAST_INVALID_SAME_TICK
  message: string
}>
