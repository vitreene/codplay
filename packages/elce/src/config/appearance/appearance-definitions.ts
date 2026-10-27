import type { AppearanceBackgroundGradientDefinition } from './appearance-types'

export const APPEARANCE_COLOR_ROLES = [
  'background',
  'surface',
  'text',
  'muted',
  'accent',
  'border',
] as const

export const APPEARANCE_BACKGROUND_GRADIENT_DEFINITIONS = [
  { id: 'background-surface', label: 'Fond → Surface', from: 'background', to: 'surface', angle: '135deg' },
  { id: 'background-accent', label: 'Fond → Accent', from: 'background', to: 'accent', angle: '135deg' },
  { id: 'background-accent-secondary', label: 'Fond → Accent secondaire', from: 'background', to: 'accent-secondary', angle: '135deg' },
] as const satisfies readonly AppearanceBackgroundGradientDefinition[]

export const APPEARANCE_DENSITIES = [
  {
    value: 'none',
    label: 'Transparent',
    cssFile: 'densities/none.css',
    className: 'density-none',
  },
  {
    value: 'compact',
    label: 'Compact',
    cssFile: 'densities/compact.css',
    className: 'density-compact',
  },
  {
    value: 'normal',
    label: 'Normal',
    cssFile: 'densities/normal.css',
    className: 'density-normal',
  },
  {
    value: 'large',
    label: 'Large',
    cssFile: 'densities/large.css',
    className: 'density-large',
  },
] as const

export const APPEARANCE_READING_CSS_FILE = 'typography/reading.css'

export const APPEARANCE_PALETTE_DEFINITIONS = [
  {
    id: 'classic',
    label: 'Classique',
    brightness: 'light',
    cssFile: 'palettes/classic.css',
  },
  {
    id: 'ocean',
    label: 'Océan',
    brightness: 'light',
    cssFile: 'palettes/ocean.css',
  },
  {
    id: 'forest',
    label: 'Forêt',
    brightness: 'light',
    cssFile: 'palettes/forest.css',
  },
  {
    id: 'plum',
    label: 'Prune',
    brightness: 'dark',
    cssFile: 'palettes/plum.css',
  },
  {
    id: 'slate',
    label: 'Ardoise',
    brightness: 'dark',
    cssFile: 'palettes/slate.css',
  },
] as const

export const APPEARANCE_FONT_DEFINITIONS = [
  {
    id: 'bubblegum-sans',
    label: 'Bubblegum Sans',
    family: 'Bubblegum Sans',
    fontDirectory: 'bubblegum-sans',
    cssFile: 'typography/bubblegum-sans.css',
    headingClassName: 'headings-bubblegum-sans',
    bodyClassName: 'body-bubblegum-sans',
  },
  {
    id: 'crimson-text',
    label: 'Crimson Text',
    family: 'Crimson Text',
    fontDirectory: 'crimson-text',
    cssFile: 'typography/crimson-text.css',
    headingClassName: 'headings-crimson-text',
    bodyClassName: 'body-crimson-text',
  },
  {
    id: 'dm-sans',
    label: 'DM Sans',
    family: 'DM Sans',
    fontDirectory: 'dm-sans',
    cssFile: 'typography/dm-sans.css',
    headingClassName: 'headings-dm-sans',
    bodyClassName: 'body-dm-sans',
  },
  {
    id: 'geist',
    label: 'Geist',
    family: 'Geist',
    fontDirectory: 'geist',
    cssFile: 'typography/geist.css',
    headingClassName: 'headings-geist',
    bodyClassName: 'body-geist',
  },
  {
    id: 'instrument-sans',
    label: 'Instrument Sans',
    family: 'Instrument Sans',
    fontDirectory: 'instrument-sans',
    cssFile: 'typography/instrument-sans.css',
    headingClassName: 'headings-instrument-sans',
    bodyClassName: 'body-instrument-sans',
  },
  {
    id: 'inter',
    label: 'Inter',
    family: 'Inter',
    fontDirectory: 'inter',
    cssFile: 'typography/inter.css',
    headingClassName: 'headings-inter',
    bodyClassName: 'body-inter',
  },
  {
    id: 'karla',
    label: 'Karla',
    family: 'Karla',
    fontDirectory: 'karla',
    cssFile: 'typography/karla.css',
    headingClassName: 'headings-karla',
    bodyClassName: 'body-karla',
  },
  {
    id: 'krub',
    label: 'Krub',
    family: 'Krub',
    fontDirectory: 'krub',
    cssFile: 'typography/krub.css',
    headingClassName: 'headings-krub',
    bodyClassName: 'body-krub',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    family: 'Merriweather',
    fontDirectory: 'merriweather',
    cssFile: 'typography/merriweather.css',
    headingClassName: 'headings-merriweather',
    bodyClassName: 'body-merriweather',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    family: 'Montserrat',
    fontDirectory: 'montserrat',
    cssFile: 'typography/montserrat.css',
    headingClassName: 'headings-montserrat',
    bodyClassName: 'body-montserrat',
  },
  {
    id: 'mulish',
    label: 'Mulish',
    family: 'Mulish',
    fontDirectory: 'mulish',
    cssFile: 'typography/mulish.css',
    headingClassName: 'headings-mulish',
    bodyClassName: 'body-mulish',
  },
  {
    id: 'nunito',
    label: 'Nunito',
    family: 'Nunito',
    fontDirectory: 'nunito',
    cssFile: 'typography/nunito.css',
    headingClassName: 'headings-nunito',
    bodyClassName: 'body-nunito',
  },
  {
    id: 'open-sans',
    label: 'Open Sans',
    family: 'Open Sans',
    fontDirectory: 'open-sans',
    cssFile: 'typography/open-sans.css',
    headingClassName: 'headings-open-sans',
    bodyClassName: 'body-open-sans',
  },
  {
    id: 'philosopher',
    label: 'Philosopher',
    family: 'Philosopher',
    fontDirectory: 'philosopher',
    cssFile: 'typography/philosopher.css',
    headingClassName: 'headings-philosopher',
    bodyClassName: 'body-philosopher',
  },
  {
    id: 'pt-sans',
    label: 'PT Sans',
    family: 'PT Sans',
    fontDirectory: 'pt-sans',
    cssFile: 'typography/pt-sans.css',
    headingClassName: 'headings-pt-sans',
    bodyClassName: 'body-pt-sans',
  },
  {
    id: 'raleway',
    label: 'Raleway',
    family: 'Raleway',
    fontDirectory: 'raleway',
    cssFile: 'typography/raleway.css',
    headingClassName: 'headings-raleway',
    bodyClassName: 'body-raleway',
  },
] as const

export const APPEARANCE_TYPOGRAPHY_PAIRS = [
  {
    id: 'crimson-dm-sans',
    label: 'Crimson Text / DM Sans',
    headingFontId: 'crimson-text',
    bodyFontId: 'dm-sans',
  },
  {
    id: 'inter-krub',
    label: 'Inter / Krub',
    headingFontId: 'inter',
    bodyFontId: 'krub',
  },
  {
    id: 'montserrat-karla',
    label: 'Montserrat / Karla',
    headingFontId: 'montserrat',
    bodyFontId: 'karla',
  },
  {
    id: 'nunito-pt-sans',
    label: 'Nunito / PT Sans',
    headingFontId: 'nunito',
    bodyFontId: 'pt-sans',
  },
  {
    id: 'raleway-merriweather',
    label: 'Raleway / Merriweather',
    headingFontId: 'raleway',
    bodyFontId: 'merriweather',
  },
  {
    id: 'instrument-sans-geist',
    label: 'Instrument Sans / Geist',
    headingFontId: 'instrument-sans',
    bodyFontId: 'geist',
  },
  {
    id: 'philosopher-mulish',
    label: 'Philosopher / Mulish',
    headingFontId: 'philosopher',
    bodyFontId: 'mulish',
  },
  {
    id: 'bubblegum-sans-open-sans',
    label: 'Bubblegum Sans / Open Sans',
    headingFontId: 'bubblegum-sans',
    bodyFontId: 'open-sans',
  },
] as const

export const APPEARANCE_PRESETS = [
  {
    id: 'classic',
    label: 'Classique',
    paletteId: 'classic',
    headingFontId: 'crimson-text',
    bodyFontId: 'dm-sans',
    density: 'normal',
  },
  {
    id: 'ocean',
    label: 'Océan',
    paletteId: 'ocean',
    headingFontId: 'inter',
    bodyFontId: 'krub',
    density: 'normal',
  },
  {
    id: 'forest',
    label: 'Forêt',
    paletteId: 'forest',
    headingFontId: 'nunito',
    bodyFontId: 'pt-sans',
    density: 'large',
  },
  {
    id: 'plum',
    label: 'Prune',
    paletteId: 'plum',
    headingFontId: 'raleway',
    bodyFontId: 'merriweather',
    density: 'normal',
  },
  {
    id: 'slate',
    label: 'Ardoise',
    paletteId: 'slate',
    headingFontId: 'instrument-sans',
    bodyFontId: 'geist',
    density: 'compact',
  },
] as const

export const APP_APPEARANCE_DEFAULTS = {
  presetId: 'classic',
  autoContrast: false,
  frame: false,
} as const
