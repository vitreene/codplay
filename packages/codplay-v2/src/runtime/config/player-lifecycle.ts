/** Lifecycle state used before a player is initialized. */
export const PLAYER_LIFECYCLE_IDLE = 'idle' as const

/** Lifecycle state used after a player has been initialized. */
export const PLAYER_LIFECYCLE_READY = 'ready' as const

/** Lifecycle state used while a player advances its logical time. */
export const PLAYER_LIFECYCLE_PLAYING = 'playing' as const

/** Lifecycle state used while a player keeps its logical position still. */
export const PLAYER_LIFECYCLE_PAUSED = 'paused' as const

/** Lifecycle state used after a player has released its runtime resources. */
export const PLAYER_LIFECYCLE_DESTROYED = 'destroyed' as const

/** All legal player lifecycle states. */
export type PlayerLifecycleState =
  | typeof PLAYER_LIFECYCLE_IDLE
  | typeof PLAYER_LIFECYCLE_READY
  | typeof PLAYER_LIFECYCLE_PLAYING
  | typeof PLAYER_LIFECYCLE_PAUSED
  | typeof PLAYER_LIFECYCLE_DESTROYED
