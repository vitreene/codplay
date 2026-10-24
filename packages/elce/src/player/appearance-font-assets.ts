import { getAppearanceTypographyPair } from '../config/appearance/appearance-config'

export interface AppearanceFontAsset {
  readonly family: string
  readonly style: 'normal' | 'italic'
  readonly weight: 400 | 700
  readonly fileName: string
  readonly sourcePath: string
  readonly packagePath: string
  readonly licenseSourcePath: string
  readonly licensePackagePath: string
}

const STANDARD_VARIANTS = [
  { style: 'normal', weight: 400 },
  { style: 'normal', weight: 700 },
  { style: 'italic', weight: 400 },
  { style: 'italic', weight: 700 },
] as const satisfies readonly Readonly<{ style: 'normal' | 'italic'; weight: 400 | 700 }>[]

const FONT_FAMILY_DIRECTORIES: Readonly<Record<string, string>> = {
  'Bubblegum Sans': 'bubblegum-sans',
  'Crimson Text': 'crimson-text',
  'DM Sans': 'dm-sans',
  Geist: 'geist',
  'Instrument Sans': 'instrument-sans',
  Inter: 'inter',
  Karla: 'karla',
  Krub: 'krub',
  Merriweather: 'merriweather',
  Montserrat: 'montserrat',
  Mulish: 'mulish',
  Nunito: 'nunito',
  'Open Sans': 'open-sans',
  Philosopher: 'philosopher',
  'PT Sans': 'pt-sans',
  Raleway: 'raleway',
}

/** Returns locally stored font files for the selected typography pairs. */
export function appearanceFontAssetsForPairs(pairIds: Iterable<string>): readonly AppearanceFontAsset[] {
  const familyNames = new Set<string>()
  for (const pairId of pairIds) {
    const pair = getAppearanceTypographyPair(pairId)
    familyNames.add(pair.headingFamily)
    familyNames.add(pair.bodyFamily)
  }

  return [...familyNames].sort().flatMap((family) => {
    const directory = FONT_FAMILY_DIRECTORIES[family]
    if (directory === undefined) throw new Error(`Répertoire de fonte d’apparence absent : ${family}`)
    const variants = family === 'Bubblegum Sans' ? [STANDARD_VARIANTS[0]] : STANDARD_VARIANTS
    return variants.map(({ style, weight }) => {
      const fileName = `${style}-${weight}.ttf`
      const relativeFontPath = `${directory}/${fileName}`
      return {
        family,
        style,
        weight,
        fileName,
        sourcePath: `assets/fonts/${relativeFontPath}`,
        packagePath: `fonts/${relativeFontPath}`,
        licenseSourcePath: `assets/fonts/${directory}/OFL.txt`,
        licensePackagePath: `licenses/fonts/${directory}/OFL.txt`,
      }
    })
  })
}

/** Builds local @font-face rules once for the document's unique font assets. */
export function appearanceFontFaceStyleSheet(
  fonts: readonly AppearanceFontAsset[],
  sourcePrefix: '/' | './' = '/',
): string {
  const uniqueFonts = new Map<string, AppearanceFontAsset>()
  for (const font of fonts) {
    const key = JSON.stringify([font.family, font.style, font.weight])
    if (!uniqueFonts.has(key)) uniqueFonts.set(key, font)
  }

  return [...uniqueFonts.values()].map((font) => [
    '@font-face {',
    `  font-family: ${JSON.stringify(font.family)};`,
    `  font-style: ${font.style};`,
    `  font-weight: ${font.weight};`,
    '  font-display: swap;',
    `  src: url("${sourcePrefix}${font.packagePath}") format("truetype");`,
    '}',
  ].join('\n')).join('\n')
}
