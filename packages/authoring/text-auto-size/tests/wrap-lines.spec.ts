import { describe, expect, it } from 'vitest'
import { wrapLineCount } from '../src/core/wrap-lines'
import type { MeasureLine } from '../src/core/measure'

const font = { family: 'test', weight: 400 } as const

/** Mesure factice déterministe : largeur = nb caractères × taille de police. */
const measure: MeasureLine = ({ text, fontSizePx }) => ({ widthPx: text.length * fontSizePx })

describe('wrapLineCount (§2, §8)', () => {
  it('groupe les mots tant qu’ils tiennent dans la largeur', () => {
    // fontSizePx = 1 → largeur mesurée = longueur du texte
    const count = wrapLineCount('ab cd ef gh', 1, font, 5, measure)
    expect(count).toBe(2) // "ab cd" (5) / "ef gh" (5)
  })

  it('traite chaque retour à la ligne explicite comme un paragraphe indépendant', () => {
    const count = wrapLineCount('ab cd\nef', 1, font, 5, measure)
    expect(count).toBe(2) // "ab cd" tient sur une ligne, "ef" sur une autre
  })

  it('compte au moins une ligne pour un paragraphe vide', () => {
    expect(wrapLineCount('', 1, font, 5, measure)).toBe(1)
  })
})
