import { describe, expect, it } from 'vitest'

import { get, set } from '../../src/ace/state'

describe('get', () => {
  it('lit une valeur de l etat logique', () => {
    const state = { x: 12, visible: false, label: 'hello' }

    expect(get<number>(state, 'x')).toBe(12)
    expect(get<boolean>(state, 'visible')).toBe(false)
    expect(get<string>(state, 'label')).toBe('hello')
  })

  it('signale une cle absente par undefined, sans lui attribuer de defaut', () => {
    const state = { scale: 1 }

    expect(get(state, 'opacity')).toBeUndefined()
    expect(get(state, 'scale')).toBe(1)
  })
})

describe('set', () => {
  it('applique un patch et retourne le nouvel etat', () => {
    const state = { x: 12, y: 8, scale: 1 }

    expect(set(state, { x: 20, opacity: 0.5 })).toEqual({
      x: 20,
      y: 8,
      scale: 1,
      opacity: 0.5,
    })
  })

  it('ne modifie pas l etat source', () => {
    const state = { x: 12, scale: 1 }
    const updated = set(state, { x: 20 })

    expect(updated).not.toBe(state)
    expect(state).toEqual({ x: 12, scale: 1 })
    expect(updated).toEqual({ x: 20, scale: 1 })
  })

  it('accepte undefined comme valeur explicite du patch', () => {
    const updated = set({ opacity: 1 }, { opacity: undefined })

    expect('opacity' in updated).toBe(true)
    expect(get(updated, 'opacity')).toBeUndefined()
  })
})
