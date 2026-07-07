import { describe, expect, it } from 'vitest'
import { searchFontSizePx } from '../src/core/search-font-size'
import { wrapLineCount } from '../src/core/wrap-lines'
import { FORCED_LINE_HEIGHT } from '../src/config'
import type { FontStretchKeyword, MeasureLine } from '../src/core/measure'

const font = { family: 'test', weight: 400 } as const

/** Multiplicateurs correspondant aux 9 paliers CSS standard (§2.3 de la spec). */
const STRETCH_MULTIPLIER: Record<FontStretchKeyword, number> = {
  'ultra-condensed': 0.5,
  'extra-condensed': 0.625,
  condensed: 0.75,
  'semi-condensed': 0.875,
  normal: 1,
  'semi-expanded': 1.125,
  expanded: 1.25,
  'extra-expanded': 1.5,
  'ultra-expanded': 2,
}

/**
 * Mesure factice déterministe : largeur = nb caractères × taille de police × multiplicateur
 * du palier font-stretch. Pour `fontStretch: 'normal'` (multiplicateur 1), identique à la
 * mesure d'origine (nb caractères × taille) — aucun test existant n'est affecté.
 */
const measure: MeasureLine = ({ text, fontSizePx, fontStretch }) =>
  ({ widthPx: text.length * fontSizePx * STRETCH_MULTIPLIER[fontStretch] })

describe('searchFontSizePx (§2)', () => {
  it('résout en mono-ligne quand le texte tient dans la largeur du bloc', () => {
    // fitSafetyMargin: 0 — isole la recherche elle-même de la marge de sécurité (§3.2),
    // testée séparément ci-dessous.
    const result = searchFontSizePx({
      text: 'hi',
      font,
      blockWidthPx: 100,
      blockHeightPx: 100,
      minSizePx: 1,
      measure,
      fitSafetyMargin: 0,
    })

    expect(result.mode).toBe('single-line')
    expect(result.fontStretch).toBe('normal') // aucune marge : largeur pile à la frontière, rien à élargir
    expect(measure({ text: 'hi', fontSizePx: result.fontSizePx, font, fontStretch: 'normal' }).widthPx).toBeLessThanOrEqual(100)
    expect(measure({ text: 'hi', fontSizePx: result.fontSizePx + 1, font, fontStretch: 'normal' }).widthPx).toBeGreaterThan(100)
  })

  it('marge de sécurité (§3.2) : la taille trouvée tient avec une marge sous la largeur brute', () => {
    const result = searchFontSizePx({
      text: 'hi',
      font,
      blockWidthPx: 100,
      blockHeightPx: 100,
      minSizePx: 1,
      measure,
      fitSafetyMargin: 0.02,
    })

    expect(result.mode).toBe('single-line')
    const widthAtResult = measure({ text: 'hi', fontSizePx: result.fontSizePx, font, fontStretch: result.fontStretch }).widthPx
    // Tient confortablement sous la largeur brute (100), pas pile à la frontière.
    expect(widthAtResult).toBeLessThanOrEqual(98 + 1e-6)
  })

  it('passe en multi-ligne quand le mono-ligne ne tient pas mais le multi-ligne tient', () => {
    const result = searchFontSizePx({
      text: 'aa bb cc dd',
      font,
      blockWidthPx: 5,
      blockHeightPx: 12,
      minSizePx: 1,
      measure,
    })

    expect(result.mode).toBe('multi-line')
    const lineCount = wrapLineCount('aa bb cc dd', result.fontSizePx, font, 5, measure)
    expect(lineCount * result.fontSizePx * FORCED_LINE_HEIGHT).toBeLessThanOrEqual(12 + 1e-6)
  })

  it('se rabat sur le scroll quand même la taille minimale déborde (§2.2)', () => {
    const result = searchFontSizePx({
      text: 'a very very very long paragraph that will never fit',
      font,
      blockWidthPx: 5,
      blockHeightPx: 6,
      minSizePx: 9,
      measure,
    })

    expect(result.mode).toBe('scroll')
    expect(result.fontSizePx).toBe(9)
  })

  describe('seuil de longueur (§2, config DEFAULT_SINGLE_LINE_MAX_CHARS = 30)', () => {
    const shortText = 'aa bb cc dd ee ff gg hh ii jj' // 29 caractères — sous le seuil
    const longText = 'aa bb cc dd ee ff gg hh ii jj kk' // 32 caractères — au-dessus

    it('sous le seuil : tente le mono-ligne', () => {
      const result = searchFontSizePx({
        text: shortText,
        font,
        blockWidthPx: 1000,
        blockHeightPx: 1000,
        minSizePx: 1,
        measure,
      })
      expect(result.mode).toBe('single-line')
    })

    it('au-dessus du seuil : saute le mono-ligne même s\'il tiendrait géométriquement', () => {
      const result = searchFontSizePx({
        text: longText,
        font,
        blockWidthPx: 1000, // largement assez large pour un mono-ligne, si tenté
        blockHeightPx: 1000,
        minSizePx: 1,
        measure,
      })
      expect(result.mode).toBe('multi-line')
    })

    it('singleLineMaxChars personnalisé autorise le mono-ligne au-delà du défaut', () => {
      const result = searchFontSizePx({
        text: longText,
        font,
        blockWidthPx: 1000,
        blockHeightPx: 1000,
        minSizePx: 1,
        measure,
        singleLineMaxChars: 40,
      })
      expect(result.mode).toBe('single-line')
    })
  })

  describe('élargissement de l\'axe width (§2.3)', () => {
    it('élargit quand la hauteur limite la taille avant la largeur (occuper l\'espace)', () => {
      const result = searchFontSizePx({
        text: 'hi',
        font,
        blockWidthPx: 24, // large, mais pas illimité : n'admet que jusqu'à semi-expanded
        blockHeightPx: 12, // hauteur serrée : borne la taille avant que la largeur ne serve
        minSizePx: 1,
        measure,
        fitSafetyMargin: 0,
      })

      expect(result.mode).toBe('single-line')
      // taille ≈ 10 (bornée par la hauteur : 10 × 1.2 = 12) — à cette taille, 'hi' à
      // normal (largeur 20) laisse de la place jusqu'à 24 : semi-expanded (22.5) tient,
      // expanded (25) déborde.
      expect(result.fontStretch).toBe('semi-expanded')
      expect(measure({ text: 'hi', fontSizePx: result.fontSizePx, font, fontStretch: result.fontStretch }).widthPx)
        .toBeLessThanOrEqual(24 + 1e-6)
    })

    it('n\'élargit pas quand la largeur est déjà la contrainte active (aucune place à occuper)', () => {
      const result = searchFontSizePx({
        text: 'hi',
        font,
        blockWidthPx: 100,
        blockHeightPx: 1000, // hauteur très généreuse : la largeur est la seule contrainte active
        minSizePx: 1,
        measure,
        fitSafetyMargin: 0,
      })

      expect(result.mode).toBe('single-line')
      expect(result.fontStretch).toBe('normal')
    })

    it('n\'élargit jamais en mode scroll', () => {
      const result = searchFontSizePx({
        text: 'a very very very long paragraph that will never fit',
        font,
        blockWidthPx: 5,
        blockHeightPx: 6,
        minSizePx: 9,
        measure,
      })

      expect(result.mode).toBe('scroll')
      expect(result.fontStretch).toBe('normal')
    })
  })
})
