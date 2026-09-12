/** Public messages emitted by the command scene of demo 3. */
export const DEMO3_CONTENT_INTENTS = {
  first: 'sighty-demo3:content:first',
  second: 'sighty-demo3:content:second',
} as const

/** Text payloads carried by the two command-scene messages. */
export const DEMO3_CONTENT_VALUES = {
  first: 'Texte reçu depuis la scène de commandes',
  second: 'Nouveau contenu injecté dans la scène A',
} as const

/** Names used by the Sighty composition when targeting scene A. */
export const DEMO3_COLOR_INTENTS = {
  blue: 'sighty-demo3:color:blue',
  coral: 'sighty-demo3:color:coral',
} as const

/** Colors carried by the two Sighty-level messages. */
export const DEMO3_COLOR_VALUES = {
  blue: '#7dd3fc',
  coral: '#fda4af',
} as const

export type Demo3ContentIntentName = typeof DEMO3_CONTENT_INTENTS[keyof typeof DEMO3_CONTENT_INTENTS]
export type Demo3ColorName = keyof typeof DEMO3_COLOR_VALUES
export type Demo3Color = typeof DEMO3_COLOR_VALUES[Demo3ColorName]
