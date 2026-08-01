/** Scene-level event that activates declared tracks. */
export const TRACK_EVENT_ACTIVATE = 'track:activate' as const

/** Scene-level event that deactivates declared tracks. */
export const TRACK_EVENT_DEACTIVATE = 'track:deactivate' as const

/** Scene-level event that toggles declared tracks. */
export const TRACK_EVENT_TOGGLE = 'track:toggle' as const

/** Replayed event carrying one explicit scene or story state patch. */
export const RUNTIME_STATE_UPDATE_EVENT = 'runtime:state:update' as const
