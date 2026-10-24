import type { AppearanceDensity, AppearancePalette, AppearancePreset, AppearanceTypographyPair } from './appearance-types'
import { APPEARANCE_PALETTE_COLORS } from './appearance-palette-colors.generated.ts'

export const APPEARANCE_COLOR_ROLES = ['background', 'surface', 'text', 'muted', 'accent', 'border'] as const

export const APPEARANCE_DENSITIES = [
  { value: 'none', label: 'Aucun' },
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
] as const satisfies readonly Readonly<{ value: AppearanceDensity; label: string }>[]

export const APPEARANCE_PALETTES = [
  { id: 'classic', label: 'Classique', brightness: 'light', colors: APPEARANCE_PALETTE_COLORS.classic },
  { id: 'ocean', label: 'Océan', brightness: 'light', colors: APPEARANCE_PALETTE_COLORS.ocean },
  { id: 'forest', label: 'Forêt', brightness: 'light', colors: APPEARANCE_PALETTE_COLORS.forest },
  { id: 'plum', label: 'Prune', brightness: 'dark', colors: APPEARANCE_PALETTE_COLORS.plum },
  { id: 'slate', label: 'Ardoise', brightness: 'dark', colors: APPEARANCE_PALETTE_COLORS.slate },
] as const satisfies readonly AppearancePalette[]

export const APPEARANCE_TYPOGRAPHY_PAIRS = [
  { id: 'inter-krub', label: 'Inter / Krub', headingLabel: 'Inter', bodyLabel: 'Krub', headingFamily: 'Inter', bodyFamily: 'Krub' },
  { id: 'montserrat-karla', label: 'Montserrat / Karla', headingLabel: 'Montserrat', bodyLabel: 'Karla', headingFamily: 'Montserrat', bodyFamily: 'Karla' },
  { id: 'nunito-pt-sans', label: 'Nunito / PT Sans', headingLabel: 'Nunito', bodyLabel: 'PT Sans', headingFamily: 'Nunito', bodyFamily: 'PT Sans' },
  { id: 'raleway-merriweather', label: 'Raleway / Merriweather', headingLabel: 'Raleway', bodyLabel: 'Merriweather', headingFamily: 'Raleway', bodyFamily: 'Merriweather' },
  { id: 'crimson-dm-sans', label: 'Crimson Text / DM Sans', headingLabel: 'Crimson Text', bodyLabel: 'DM Sans', headingFamily: 'Crimson Text', bodyFamily: 'DM Sans' },
  { id: 'instrument-sans-geist', label: 'Instrument Sans / Geist', headingLabel: 'Instrument Sans', bodyLabel: 'Geist', headingFamily: 'Instrument Sans', bodyFamily: 'Geist' },
  { id: 'philosopher-mulish', label: 'Philosopher / Mulish', headingLabel: 'Philosopher', bodyLabel: 'Mulish', headingFamily: 'Philosopher', bodyFamily: 'Mulish' },
  { id: 'bubblegum-sans-open-sans', label: 'Bubblegum Sans / Open Sans', headingLabel: 'Bubblegum Sans', bodyLabel: 'Open Sans', headingFamily: 'Bubblegum Sans', bodyFamily: 'Open Sans' },
] as const satisfies readonly AppearanceTypographyPair[]

export type AppearancePaletteId = typeof APPEARANCE_PALETTES[number]['id']
export type AppearanceTypographyPairId = typeof APPEARANCE_TYPOGRAPHY_PAIRS[number]['id']

export const APPEARANCE_PRESETS = [
  { id: 'classic', label: 'Classique', paletteId: 'classic', typographyPairId: 'crimson-dm-sans', density: 'normal' },
  { id: 'ocean', label: 'Océan', paletteId: 'ocean', typographyPairId: 'inter-krub', density: 'normal' },
  { id: 'forest', label: 'Forêt', paletteId: 'forest', typographyPairId: 'nunito-pt-sans', density: 'large' },
  { id: 'plum', label: 'Prune', paletteId: 'plum', typographyPairId: 'raleway-merriweather', density: 'normal' },
  { id: 'slate', label: 'Ardoise', paletteId: 'slate', typographyPairId: 'instrument-sans-geist', density: 'compact' },
] as const satisfies readonly (AppearancePreset & {
  readonly paletteId: AppearancePaletteId
  readonly typographyPairId: AppearanceTypographyPairId
})[]

export type AppearancePresetId = typeof APPEARANCE_PRESETS[number]['id']

export const APP_APPEARANCE_DEFAULTS = {
  presetId: 'classic',
  autoContrast: false,
} as const

/** Returns a palette by its stable reference and rejects unknown references. */
export function getAppearancePalette(id: string): AppearancePalette {
  const palette = APPEARANCE_PALETTES.find((entry) => entry.id === id)
  if (!palette) throw new Error(`Palette d’apparence inconnue : ${id}`)
  return palette
}

/** Returns an editorial typography pair without substituting another family. */
export function getAppearanceTypographyPair(id: string): AppearanceTypographyPair {
  const pair = APPEARANCE_TYPOGRAPHY_PAIRS.find((entry) => entry.id === id)
  if (!pair) throw new Error(`Duo typographique inconnu : ${id}`)
  return pair
}

/** Returns the coordinated appearance preset independently of content layouts. */
export function getAppearancePreset(id: string): AppearancePreset {
  const preset = APPEARANCE_PRESETS.find((entry) => entry.id === id)
  if (!preset) throw new Error(`Preset d’apparence inconnu : ${id}`)
  return preset
}
