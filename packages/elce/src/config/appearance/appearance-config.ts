import { APPEARANCE_PALETTE_COLORS } from './appearance-palette-colors.generated.ts'
import {
  APPEARANCE_COLOR_ROLES,
  APPEARANCE_BACKGROUND_GRADIENT_DEFINITIONS,
  APPEARANCE_DENSITIES,
  APPEARANCE_FONT_DEFINITIONS,
  APPEARANCE_PALETTE_DEFINITIONS,
  APPEARANCE_PRESETS,
  APPEARANCE_TYPOGRAPHY_PAIRS,
  APP_APPEARANCE_DEFAULTS,
} from './appearance-definitions.ts'
import type {
  AppearanceDensity,
  AppearanceBackgroundGradientDefinition,
  AppearanceBackgroundGradientId,
  AppearanceGradientColors,
  AppearanceFont,
  AppearancePalette,
  AppearancePreset,
  AppearanceTypographyPair,
} from './appearance-types'

export {
  APPEARANCE_COLOR_ROLES,
  APPEARANCE_DENSITIES,
  APPEARANCE_PRESETS,
  APPEARANCE_TYPOGRAPHY_PAIRS,
  APP_APPEARANCE_DEFAULTS,
}

export const APPEARANCE_PALETTES = APPEARANCE_PALETTE_DEFINITIONS.map((definition) => ({
  ...definition,
  colors: APPEARANCE_PALETTE_COLORS[definition.id],
})) satisfies readonly AppearancePalette[]

export const APPEARANCE_BACKGROUND_GRADIENTS = APPEARANCE_BACKGROUND_GRADIENT_DEFINITIONS

export const APPEARANCE_FONTS = APPEARANCE_FONT_DEFINITIONS satisfies readonly AppearanceFont[]

export type AppearancePaletteId = typeof APPEARANCE_PALETTES[number]['id']
export type AppearanceFontId = typeof APPEARANCE_FONTS[number]['id']
export type AppearanceTypographyPairId = typeof APPEARANCE_TYPOGRAPHY_PAIRS[number]['id']
export type AppearancePresetId = typeof APPEARANCE_PRESETS[number]['id']

export {
  type AppearanceBackgroundGradientDefinition,
  type AppearanceBackgroundGradientId,
  type AppearanceDensity,
  type AppearanceGradientColors,
  type AppearancePalette,
  type AppearancePreset,
  type AppearanceTypographyPair,
}

/** Returns a palette by its stable reference and rejects unknown references. */
export function getAppearancePalette(id: string): AppearancePalette {
  const palette = APPEARANCE_PALETTES.find((entry) => entry.id === id)
  if (!palette) throw new Error(`Palette d’apparence inconnue : ${id}`)
  return palette
}

/** Returns a configured Card background gradient by its stable reference. */
export function getAppearanceBackgroundGradient(id: string): AppearanceBackgroundGradientDefinition {
  const gradient = APPEARANCE_BACKGROUND_GRADIENTS.find((entry) => entry.id === id)
  if (gradient === undefined) throw new Error(`Dégradé d’apparence inconnu : ${id}`)
  return gradient
}

/** Builds one CSS gradient from the generated semantic colors of the active theme. */
export function appearanceBackgroundGradientCss(
  id: string,
  colors: AppearanceGradientColors,
): string {
  const gradient = getAppearanceBackgroundGradient(id)
  return `linear-gradient(${gradient.angle}, ${colors[gradient.from]}, ${colors[gradient.to]})`
}

/** Returns one font family without substituting another configured family. */
export function getAppearanceFont(id: string): AppearanceFont {
  const font = APPEARANCE_FONTS.find((entry) => entry.id === id)
  if (!font) throw new Error(`Police d’apparence inconnue : ${id}`)
  return font
}

/** Returns an interface-only font pairing suggestion. */
export function getAppearanceTypographyPair(id: string): AppearanceTypographyPair {
  const pair = APPEARANCE_TYPOGRAPHY_PAIRS.find((entry) => entry.id === id)
  if (!pair) throw new Error(`Association typographique inconnue : ${id}`)
  return pair
}

/** Returns the coordinated appearance preset independently of content layouts. */
export function getAppearancePreset(id: string): AppearancePreset {
  const preset = APPEARANCE_PRESETS.find((entry) => entry.id === id)
  if (!preset) throw new Error(`Preset d’apparence inconnu : ${id}`)
  return preset
}

/** Returns the stylesheet and class reference for one configured density. */
export function getAppearanceDensity(density: AppearanceDensity) {
  const definition = APPEARANCE_DENSITIES.find((entry) => entry.value === density)
  if (definition === undefined) throw new Error(`Densité d’apparence inconnue : ${density}`)
  return definition
}
