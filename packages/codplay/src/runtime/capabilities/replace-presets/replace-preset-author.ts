import presetCatalog from './replace-preset-catalog.json'

/** Canonical name set inferred from the JSON trajectory catalogue. */
export type ReplacePresetName = keyof typeof presetCatalog

/** JSON trajectory record shared by the text and media replacement surfaces. */
export type ReplacePresetDefinition = (typeof presetCatalog)[ReplacePresetName]

/** Secondary author selector that resolves a precise type/orientation pair to one preset ID. */
export const REPLACE_PRESET_CHOICES = {
  fade: { default: 'fade' },
  swipe: {
    left: 'swipe-left',
    right: 'swipe-right',
    up: 'swipe-up',
    down: 'swipe-down',
  },
  'soft-swipe': {
    left: 'swipe-soft-left',
    right: 'swipe-soft-right',
    up: 'swipe-soft-up',
    down: 'swipe-soft-down',
  },
  fly: {
    left: 'fly-left',
    right: 'fly-right',
    up: 'fly-up',
    down: 'fly-down',
  },
  bounce: {
    left: 'bounce-left',
    right: 'bounce-right',
    up: 'bounce-up',
    down: 'bounce-down',
  },
  'swipe-zoom': {
    left: 'swipe-zoom-left',
    right: 'swipe-zoom-right',
    up: 'swipe-zoom-up',
    down: 'swipe-zoom-down',
  },
  'diagonal-swipe': {
    'left-top': 'swipe-left-top',
    'right-top': 'swipe-right-top',
    'left-bottom': 'swipe-left-bottom',
    'right-bottom': 'swipe-right-bottom',
  },
  zoom: {
    in: 'zoom',
    out: 'zoom-out',
    pop: 'zoom-pop',
  },
  scale: {
    in: 'scale-in',
    out: 'scale-out',
    bounce: 'scale-bounce',
    elastic: 'scale-elastic',
  },
  'axis-scale': {
    x: 'scale-x',
    y: 'scale-y',
  },
  stretch: {
    x: 'stretch-x',
    y: 'stretch-y',
  },
  squash: {
    x: 'squash-x',
    y: 'squash-y',
    stretch: 'squash-stretch',
  },
  rotate: {
    in: 'rotate-in',
    left: 'rotate-left',
    right: 'rotate-right',
  },
  spin: {
    left: 'spin-left',
    right: 'spin-right',
  },
  roll: {
    left: 'roll-left',
    right: 'roll-right',
    top: 'roll-top',
    bottom: 'roll-bottom',
  },
  tilt: {
    left: 'tilt-left',
    right: 'tilt-right',
  },
  'rotate-zoom': {
    left: 'rotate-zoom-left',
    right: 'rotate-zoom-right',
  },
  'glyph-roll': {
    up: 'slot-up',
    down: 'slot-down',
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, ReplacePresetName>>>>

/** Names shown as the first author selector level. */
export type ReplacePresetType = keyof typeof REPLACE_PRESET_CHOICES

/** Valid second-level choices for the selected author effect type. */
export type ReplacePresetOrientation<Type extends ReplacePresetType> =
  keyof (typeof REPLACE_PRESET_CHOICES)[Type]

/** One type/orientation choice with its canonical runtime preset name. */
export type ReplacePresetChoice = {
  [Type in ReplacePresetType]: {
    type: Type
    orientation: ReplacePresetOrientation<Type>
    transition: (typeof REPLACE_PRESET_CHOICES)[Type][ReplacePresetOrientation<Type>]
  }
}[ReplacePresetType]

/** Resolves a typed author choice without duplicating its trajectory data. */
export function resolveReplacePresetChoice<
  const Type extends ReplacePresetType,
  const Orientation extends ReplacePresetOrientation<Type>,
>(
  type: Type,
  orientation: Orientation,
): (typeof REPLACE_PRESET_CHOICES)[Type][Orientation] {
  return REPLACE_PRESET_CHOICES[type][orientation]
}

type ChoicePresetName = {
  [Type in ReplacePresetType]: (typeof REPLACE_PRESET_CHOICES)[Type][keyof (typeof REPLACE_PRESET_CHOICES)[Type]]
}[ReplacePresetType]
type UnmappedPresetName = Exclude<ReplacePresetName, ChoicePresetName>
const allPresetNamesHaveAuthorChoices: UnmappedPresetName extends never ? true : never = true

/** Keeps the catalogue coverage assertion visible to the module checker. */
export function assertReplacePresetChoiceCoverage(): true {
  return allPresetNamesHaveAuthorChoices
}
