/** Public intentions emitted by the menu scene of demo 4. */
export const DEMO4_MENU_INTENTS = {
  sceneA: 'sighty-demo4:menu:scene-a',
  sceneB: 'sighty-demo4:menu:scene-b',
  sceneC: 'sighty-demo4:menu:scene-c',
} as const

/** Public intentions emitted by the scene navigation telco. */
export const DEMO4_NAVIGATION_INTENTS = {
  previous: 'sighty-demo4:navigation:previous',
  next: 'sighty-demo4:navigation:next',
} as const

/** Optional events used to activate or deactivate the authored telco feature. */
export const DEMO4_TELCO_STATE_EVENTS = {
  on: 'sighty-demo4:telco:on',
  off: 'sighty-demo4:telco:off',
} as const

/** Identifies the scene event used to leave the final content scene. */
export const DEMO4_SCENARIO_EVENTS = {
  sequenceEnd: 'sequence:end',
} as const

/** Public scene-telco intent used to seek the currently selected scene. */
export const DEMO4_PROGRESS_INTENTS = {
  seek: 'sighty-demo4:progress:seek',
} as const

/** Public scene-telco intents used to control the currently selected scene. */
export const DEMO4_PLAYBACK_INTENTS = {
  toggle: 'sighty-demo4:playback:toggle',
  rewind: 'sighty-demo4:playback:rewind',
} as const

/** Discrete scene-telco updates used to reflect the selected scene playback state. */
export const DEMO4_PLAYBACK_STATE_EVENTS = {
  playing: 'sighty-demo4:playback-state:playing',
  paused: 'sighty-demo4:playback-state:paused',
} as const

export type Demo4PlaybackIntentName = typeof DEMO4_PLAYBACK_INTENTS[keyof typeof DEMO4_PLAYBACK_INTENTS]
