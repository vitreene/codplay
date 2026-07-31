import { describe, expect, it } from 'vitest'

import { applyRelative, composeComplex, compose, decompose, lerp, round, type UnitValue } from '../../src/ace/values'

describe('decompose', () => {
  it('reconnaît un nombre nu, en nombre comme en chaîne', () => {
    expect(decompose(42)).toMatchObject({ kind: 'number', number: 42, unit: null })
    expect(decompose('42')).toMatchObject({ kind: 'number', number: 42 })
    expect(decompose('-3.5')).toMatchObject({ kind: 'number', number: -3.5 })
  })

  it('porte une unité relative négative — le cas qui justifie le chantier', () => {
    expect(decompose('-8.62cqw')).toMatchObject({ kind: 'unit', number: -8.62, unit: 'cqw' })
    expect(decompose('-100%')).toMatchObject({ kind: 'unit', number: -100, unit: '%' })
  })

  it('porte les unités usuelles sans les valider par propriété', () => {
    for (const [raw, number, unit] of [
      ['12px', 12, 'px'],
      ['1.5rem', 1.5, 'rem'],
      ['50vh', 50, 'vh'],
      ['33.33cqh', 33.33, 'cqh'],
      ['90deg', 90, 'deg'],
      ['1.5turn', 1.5, 'turn'],
    ] as Array<[string, number, string]>) {
      expect(decompose(raw)).toMatchObject({ kind: 'unit', number, unit })
    }
  })

  it('expose une valeur numérique séparée de son unité', () => {
    const value: UnitValue = decompose('50%')

    expect(value).toEqual(expect.objectContaining({ number: 50, unit: '%' }))
  })

  it('reconnaît les opérateurs relatifs', () => {
    expect(decompose('+=10')).toMatchObject({ operator: '+', number: 10 })
    expect(decompose('-=4.5')).toMatchObject({ operator: '-', number: 4.5 })
    expect(decompose('*=2')).toMatchObject({ operator: '*', number: 2 })
    expect(decompose('+=10px')).toMatchObject({ operator: '+', kind: 'unit', number: 10, unit: 'px' })
  })

  it('signale une couleur sans la décomposer', () => {
    for (const raw of ['#fff', '#a1b2c3', 'rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(10,20%,30%)']) {
      expect(decompose(raw).kind).toBe('color')
    }
  })

  it('découpe une valeur complexe en nombres et fragments', () => {
    const d = decompose('blur(5px) saturate(2)')
    expect(d.kind).toBe('complex')
    expect(d.numbers).toEqual([5, 2])
    expect(d.strings).toEqual(['blur(', 'px) saturate(', ')'])
  })

  it('rend une valeur neutre pour vide, nul ou indéfini', () => {
    for (const raw of ['', null, undefined]) {
      expect(decompose(raw)).toMatchObject({ kind: 'number', number: 0, unit: null })
    }
  })

  it('produit un objet neuf à chaque appel', () => {
    expect(decompose('1px')).not.toBe(decompose('1px'))
  })
})

describe('recomposition', () => {
  it('recolle l’unité', () => {
    expect(compose('unit', 3.4, 'cqw')).toBe('3.4cqw')
    expect(compose('number', 3.4, null)).toBe(3.4)
  })

  it('interpole une valeur complexe en préservant sa structure', () => {
    const from = decompose('blur(0px) saturate(1)')
    const to = decompose('blur(10px) saturate(3)')
    expect(composeComplex(from, to, 0, 4)).toBe('blur(0px) saturate(1)')
    expect(composeComplex(from, to, 0.5, 4)).toBe('blur(5px) saturate(2)')
    expect(composeComplex(from, to, 1, 4)).toBe('blur(10px) saturate(3)')
  })
})

describe('opérations', () => {
  it('applique les opérateurs relatifs', () => {
    expect(applyRelative(5, 10, '+')).toBe(15)
    expect(applyRelative(5, 10, '-')).toBe(-5)
    expect(applyRelative(5, 10, '*')).toBe(50)
  })

  it('interpole', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5)
    expect(lerp(-8.62, 12, 0)).toBe(-8.62)
    expect(lerp(-8.62, 12, 1)).toBe(12)
  })

  it('arrondit, et laisse intact sur une précision négative', () => {
    expect(round(1.23456, 2)).toBe(1.23)
    expect(round(1.23456, -1)).toBe(1.23456)
  })
})
