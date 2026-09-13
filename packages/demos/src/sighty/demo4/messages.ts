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

/** Events used by Sighty to update the authored telco button state. */
export const DEMO4_TELCO_STATE_EVENTS = {
  enable: 'sighty-demo4:telco:enable',
  disable: 'sighty-demo4:telco:disable',
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

/** Private scene-telco updates used to reflect the selected scene playback state. */
export const DEMO4_PLAYBACK_STATE_EVENTS = {
  playing: 'sighty-demo4:playback-state:playing',
  paused: 'sighty-demo4:playback-state:paused',
} as const

/** Private scene-telco update used to display the selected scene position. */
export const DEMO4_PROGRESS_STATE_EVENTS = {
  update: 'sighty-demo4:progress:update',
} as const

export type Demo4MenuIntentName = typeof DEMO4_MENU_INTENTS[keyof typeof DEMO4_MENU_INTENTS]
export type Demo4NavigationIntentName = typeof DEMO4_NAVIGATION_INTENTS[keyof typeof DEMO4_NAVIGATION_INTENTS]
export type Demo4PlaybackIntentName = typeof DEMO4_PLAYBACK_INTENTS[keyof typeof DEMO4_PLAYBACK_INTENTS]
