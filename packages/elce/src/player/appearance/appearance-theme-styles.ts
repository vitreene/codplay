import type { AppearanceDensity } from '../../config/appearance/appearance-types'
import type { AppearancePaletteId, AppearanceTypographyPairId } from '../../config/appearance/appearance-config'

const PALETTE_CSS_FILES: Readonly<Record<AppearancePaletteId, string>> = {
  classic: 'palettes/classic.css',
  ocean: 'palettes/ocean.css',
  forest: 'palettes/forest.css',
  plum: 'palettes/plum.css',
  slate: 'palettes/slate.css',
}

const TYPOGRAPHY_CSS_FILES: Readonly<Record<AppearanceTypographyPairId, string>> = {
  'inter-krub': 'typography/inter-krub.css',
  'montserrat-karla': 'typography/montserrat-karla.css',
  'nunito-pt-sans': 'typography/nunito-pt-sans.css',
  'raleway-merriweather': 'typography/raleway-merriweather.css',
  'crimson-dm-sans': 'typography/crimson-dm-sans.css',
  'instrument-sans-geist': 'typography/instrument-sans-geist.css',
  'philosopher-mulish': 'typography/philosopher-mulish.css',
  'bubblegum-sans-open-sans': 'typography/bubblegum-sans-open-sans.css',
}

const DENSITY_CSS_FILES: Readonly<Record<AppearanceDensity, string>> = {
  none: 'densities/none.css',
  compact: 'densities/compact.css',
  normal: 'densities/normal.css',
  large: 'densities/large.css',
}

const APPEARANCE_CSS_DIRECTORY = 'config/appearance/css'

/** Returns only the authored theme CSS files referenced by a document's settings. */
export function appearanceThemeCssAssetPaths(
  paletteIds: Iterable<string>,
  typographyPairIds: Iterable<string>,
  densities: Iterable<AppearanceDensity>,
): readonly string[] {
  const paletteFiles = unique(paletteIds).map((id) => requireCssFile(PALETTE_CSS_FILES, id, 'Palette'))
  const typographyFiles = unique(typographyPairIds)
    .map((id) => requireCssFile(TYPOGRAPHY_CSS_FILES, id, 'Duo typographique'))
  const densityFiles = unique(densities).map((density) => DENSITY_CSS_FILES[density])
  return unique(['appearance-surface.css', ...paletteFiles, ...typographyFiles, ...densityFiles])
}

/** Builds the Remix asset URL for one authored appearance stylesheet. */
export function appearanceThemeCssAssetUrl(path: string): string {
  return `/assets/elce/${APPEARANCE_CSS_DIRECTORY}/${path}`
}

/** Builds the local CSS import used by CodPlay's existing Sighty package exporter. */
export function appearanceThemeCssImport(path: string): string {
  return `@import "./appearance/css/${path}";`
}

/** Resolves a catalog identifier to its authored stylesheet path. */
function requireCssFile<Id extends string>(
  cssFiles: Readonly<Record<Id, string>>,
  id: string,
  label: string,
): string {
  const path = cssFiles[id as Id]
  if (path === undefined) throw new Error(`${label} CSS absent pour la référence ${id}.`)
  return path
}

/** Removes duplicate references while preserving first-use order. */
function unique<Value>(values: Iterable<Value>): Value[] {
  return [...new Set(values)]
}
