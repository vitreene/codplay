/** Scope owned by the scene-level strap collection. */
export const STRAP_SCOPE_SCENE = 'scene' as const

/** Scope owned by one story-level strap collection. */
export const STRAP_SCOPE_STORY = 'story' as const

/** Shared strap ownership scope state. */
export type StrapScope = typeof STRAP_SCOPE_SCENE | typeof STRAP_SCOPE_STORY
