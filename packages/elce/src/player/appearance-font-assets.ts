import { getAppearanceFont } from '../config/appearance/appearance-config'

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

/** Returns locally stored font files for the independently selected families. */
export function appearanceFontAssetsForIds(fontIds: Iterable<string>): readonly AppearanceFontAsset[] {
  const fonts = new Map([...fontIds].map((id) => {
    const font = getAppearanceFont(id)
    return [font.id, font] as const
  }))

  return [...fonts.values()].sort((left, right) => left.id.localeCompare(right.id)).flatMap((font) => {
    const directory = font.fontDirectory
    const variants = font.id === 'bubblegum-sans' ? [STANDARD_VARIANTS[0]] : STANDARD_VARIANTS
    return variants.map(({ style, weight }) => {
      const fileName = `${style}-${weight}.ttf`
      const relativeFontPath = `${directory}/${fileName}`
      return {
        family: font.family,
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
