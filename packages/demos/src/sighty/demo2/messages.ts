/** Public intentions emitted by the demo 2 command scene. */
export const TELCO_INTENTS = {
  play: 'sighty-demo2:intent:play',
  pause: 'sighty-demo2:intent:pause',
  replay: 'sighty-demo2:intent:replay',
} as const

export type TelcoIntentName = typeof TELCO_INTENTS[keyof typeof TELCO_INTENTS]
