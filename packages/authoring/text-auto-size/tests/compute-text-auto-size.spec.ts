import { describe, expect, it } from 'vitest'
import { computeTextAutoSizeWithMeasurer } from '../src/compute-text-auto-size'
import { FORCED_LINE_HEIGHT } from '../src/config'
import type { MeasureLine } from '../src/core/measure'

const font = { family: 'test', weight: 400 } as const

/** Mesure factice déterministe : largeur = nb caractères × taille de police. */
const measure: MeasureLine = ({ text, fontSizePx }) => ({ widthPx: text.length * fontSizePx })

describe('computeTextAutoSizeWithMeasurer (§7, §8)', () => {
  it('convertit le résultat en cqw et force line-height à 1.2', () => {
    const result = computeTextAutoSizeWithMeasurer(
      {
        text: 'hi',
        font,
        blockWidthCqw: 50, // référentiel 1000px -> 500px
        blockHeightCqw: 50,
        referenceWidthPx: 1000,
        minReadableSizePx: 1,
        fitSafetyMargin: 0, // isole la conversion cqw de la marge de sécurité (§3.2)
      },
      measure,
    )

    expect(result.lineHeight).toBe(FORCED_LINE_HEIGHT)
    expect(result.mode).toBe('single-line')
    // 'hi' (2 car.) : 2 × taille <= 500px => taille <= 250px => 25cqw
    expect(result.fontSizeCqw).toBeCloseTo(25, 0)
  })

  it('applique le seuil de lisibilité par défaut (9px) quand non fourni', () => {
    const result = computeTextAutoSizeWithMeasurer(
      {
        text: 'a very very very long paragraph line that will never fit at all',
        font,
        blockWidthCqw: 1,
        blockHeightCqw: 1,
        referenceWidthPx: 100, // bloc minuscule : 1px x 1px
      },
      measure,
    )

    expect(result.mode).toBe('scroll')
    // seuil par défaut 9px, référentiel 100px -> 9cqw
    expect(result.fontSizeCqw).toBeCloseTo(9)
  })
})
