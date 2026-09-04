import { describe, expect, it } from 'vitest'
import {
  applyDecorModifications,
  collectDecorModifications,
  modificationsFromDecorPatch,
  modificationsToDecorPatch,
} from '../src/decor-editor/modified-properties'
import type { DecorPatch } from '../src/decor-editor/types'

/** Builds a complete Decor value containing documented and future nested properties. */
function baseDecor(): DecorPatch {
  return {
    style: { color: 'red', opacity: '0.5' },
    offset: {
      translate: { x: 10, y: 20 },
      scale: { x: 1, y: 1 },
    },
    futureModule: {
      enabled: true,
      options: { first: 'a', second: 'b' },
    },
  }
}

describe('registre générique des propriétés Decor modifiées', () => {
  it('retient les feuilles modifiées, y compris un futur groupe imbriqué', () => {
    const base = baseDecor()
    const current: DecorPatch = {
      ...base,
      style: { ...base.style, color: 'blue' },
      offset: { ...base.offset, translate: { x: 42, y: 20 } },
      futureModule: {
        ...base.futureModule,
        options: { ...(base.futureModule as { options: Record<string, string> }).options, first: 'changed' },
      },
    }

    const modifications = collectDecorModifications(base, current)

    expect([...modifications.keys()]).toEqual([
      'style.color',
      'offset.translate.x',
      'futureModule.options.first',
    ])
    expect(modificationsToDecorPatch(modifications)).toEqual({
      style: { color: 'blue' },
      offset: { translate: { x: 42 } },
      futureModule: { options: { first: 'changed' } },
    })
    expect(applyDecorModifications(base, modifications)).toEqual(current)
  })

  it('reconstruit un candidat sparse sans figer les valeurs interpolées intactes', () => {
    const base = baseDecor()
    const candidate: DecorPatch = {
      style: { color: 'green' },
      offset: { translate: { x: 55 } },
      futureModule: { options: { second: 'edited' } },
    }

    const modifications = modificationsFromDecorPatch(base, candidate)

    expect(modificationsToDecorPatch(modifications)).toEqual({
      style: { color: 'green' },
      offset: { translate: { x: 55 } },
      futureModule: { options: { second: 'edited' } },
    })
    expect(applyDecorModifications(base, modifications)).toEqual({
      ...base,
      style: { color: 'green', opacity: '0.5' },
      offset: { ...base.offset, translate: { x: 55, y: 20 } },
      futureModule: {
        ...base.futureModule,
        options: { first: 'a', second: 'edited' },
      },
    })
  })
})
