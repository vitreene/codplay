/** Applies one runtime event to the current logical presentation. */
export const EVENT_INSERT_MODE_APPLY_NOW = 'apply-now' as const

/** Retains one runtime event for a later reconstruction without applying it at insertion. */
export const EVENT_INSERT_MODE_PERSIST_ONLY = 'persist-only' as const

/** Insertion policies shared by normal events and capture conclusions. */
export type RuntimeEventInsertMode =
  | typeof EVENT_INSERT_MODE_APPLY_NOW
  | typeof EVENT_INSERT_MODE_PERSIST_ONLY
