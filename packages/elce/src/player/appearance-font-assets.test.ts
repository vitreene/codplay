import { describe, expect, it } from 'vitest'
import { appearanceFontAssetsForPairs, appearanceFontFaceStyleSheet } from './appearance-font-assets'

describe('appearance font assets', () => {
  it('emits one local font-face rule for each unique family, style, and weight', () => {
    const fonts = appearanceFontAssetsForPairs([
      'crimson-dm-sans',
      'instrument-sans-geist',
      'crimson-dm-sans',
    ])
    const styleSheet = appearanceFontFaceStyleSheet([...fonts, ...fonts])
    const packagedStyleSheet = appearanceFontFaceStyleSheet(fonts, './')
    const descriptors = [...styleSheet.matchAll(/font-family: (.+);\n  font-style: (.+);\n  font-weight: (.+);/g)]
      .map((match) => `${match[1]}|${match[2]}|${match[3]}`)

    expect(descriptors).toHaveLength(16)
    expect(new Set(descriptors).size).toBe(descriptors.length)
    expect(styleSheet.match(/@font-face \{/g)).toHaveLength(16)
    expect(styleSheet).toContain('src: url("/fonts/crimson-text/normal-400.ttf")')
    expect(packagedStyleSheet).toContain('src: url("./fonts/crimson-text/normal-400.ttf")')
  })
})
