/** Validation target for a perso initial payload. */
export const VALIDATION_TARGET_INITIAL = 'initial' as const

/** Validation target for one perso action payload. */
export const VALIDATION_TARGET_ACTION = 'action' as const

/** Shared validation target state. */
export type ValidationTarget = typeof VALIDATION_TARGET_INITIAL | typeof VALIDATION_TARGET_ACTION
