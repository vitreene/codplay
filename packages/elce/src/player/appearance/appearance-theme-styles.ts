import {
  APPEARANCE_READING_CSS_FILE,
  APPEARANCE_FONT_DEFINITIONS,
  APPEARANCE_PALETTE_DEFINITIONS,
} from '../../config/appearance/appearance-definitions.ts'
import { getAppearanceDensity } from '../../config/appearance/appearance-config'
import type { AppearanceDensity } from '../../config/appearance/appearance-types'

const APPEARANCE_CSS_DIRECTORY = 'config/appearance/css'

/** Returns each CSS source referenced by the resolved content settings once. */
export function appearanceThemeCssAssetPaths(
  paletteIds: Iterable<string>,
  fontIds: Iterable<string>,
  densities: Iterable<AppearanceDensity>,
): readonly string[] {
  return unique([
    ...unique(paletteIds).map((id) => requireCssFile(APPEARANCE_PALETTE_DEFINITIONS, id, 'Palette')),
    ...unique(fontIds).map((id) => requireCssFile(APPEARANCE_FONT_DEFINITIONS, id, 'Police')),
    APPEARANCE_READING_CSS_FILE,
    ...unique(densities).map((density) => {
      return getAppearanceDensity(density).cssFile
    }),
  ])
}

/** Builds the Remix asset URL for one authored appearance stylesheet. */
export function appearanceThemeCssAssetUrl(path: string): string {
  return `/assets/elce/${APPEARANCE_CSS_DIRECTORY}/${path}`
}

/** Builds the local CSS import used by CodPlay's existing Sighty package exporter. */
export function appearanceThemeCssImport(path: string): string {
  return `@import "./appearance/css/${path}";`
}

/** Resolves one catalog reference to its authored stylesheet path. */
function requireCssFile<Definition extends Readonly<{ id: string; cssFile: string }>>(
  definitions: readonly Definition[],
  id: string,
  label: string,
): string {
  const definition = definitions.find((entry) => entry.id === id)
  if (definition === undefined) throw new Error(`${label} CSS absente pour la référence ${id}.`)
  return definition.cssFile
}

/** Removes duplicate references while preserving first-use order. */
function unique<Value>(values: Iterable<Value>): Value[] {
  return [...new Set(values)]
}
