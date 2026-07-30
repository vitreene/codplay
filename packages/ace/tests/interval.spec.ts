import { describe, expect, it } from 'vitest'
import { animate } from 'animejs'

import { prepareInterval, resolveInterval, type ColorValue } from '../src/interval'

const srgb = (coords: readonly number[], alpha = 1): ColorValue => ({
  kind: 'color',
  space: 'srgb',
  coords,
  alpha,
})

const oklch = (coords: readonly number[], alpha = 1): ColorValue => ({
  kind: 'color',
  space: 'oklch',
  coords,
  alpha,
})

describe('prepareInterval', () => {
  it('prepare deux nombres explicites', () => {
    expect(prepareInterval(10, 30)).toEqual({ kind: 'number', from: 10, to: 30, unit: null })
  })

  it('preserve une unite relative negative', () => {
    expect(prepareInterval('-8.62cqw', '12cqw')).toEqual({
      kind: 'number',
      from: -8.62,
      to: 12,
      unit: 'cqw',
    })
  })

  it('resout to relatif depuis from, comme anime', () => {
    expect(prepareInterval('12px', '+=8px')).toEqual({
      kind: 'number',
      from: 12,
      to: 20,
      unit: 'px',
    })
    expect(prepareInterval(12, '*=2')).toEqual({ kind: 'number', from: 12, to: 24, unit: null })
  })

  it('rejette from relatif, faute d etat amont a lire', () => {
    expect(() => prepareInterval('+=8px', '20px')).toThrow(/from ne peut pas etre une valeur relative/)
  })

  it('rejette les unites incompatibles', () => {
    expect(() => prepareInterval('0px', '50%')).toThrow(/meme unite/)
    expect(() => prepareInterval(0, '50px')).toThrow(/meme unite/)
  })

  it('rejette une chaine CSS couleur non normalisee', () => {
    expect(() => prepareInterval('#f00', '#00f')).toThrow(/couleur doit etre normalisee/)
    expect(() => prepareInterval('oklch(60% .2 30)', 'oklch(70% .2 60)')).toThrow(/couleur doit etre normalisee/)
  })
})

describe('resolveInterval', () => {
  it('interpole un nombre aux bornes et au milieu', () => {
    const interval = prepareInterval(10, 30)

    expect(resolveInterval(interval, 0)).toBe(10)
    expect(resolveInterval(interval, 0.5)).toBe(20)
    expect(resolveInterval(interval, 1)).toBe(30)
  })

  it('recolle l unite de l auteur', () => {
    const interval = prepareInterval('-8cqw', '12cqw')

    expect(resolveInterval(interval, 0)).toBe('-8cqw')
    expect(resolveInterval(interval, 0.5)).toBe('2cqw')
    expect(resolveInterval(interval, 1)).toBe('12cqw')
  })

  it('laisse passer une progression qui depasse les bornes', () => {
    expect(resolveInterval(prepareInterval(0, 10), 1.2)).toBe(12)
  })

  it('interpole une couleur sRGB preparee', () => {
    expect(resolveInterval(prepareInterval(srgb([1, 0, 0]), srgb([0, 0, 1], 0.5)), 0.5)).toEqual({
      kind: 'color',
      space: 'srgb',
      coords: [0.5, 0, 0.5],
      alpha: 0.75,
    })
  })

  it('interpole une teinte OKLCH par le chemin court', () => {
    expect(resolveInterval(prepareInterval(oklch([0.6, 0.2, 350]), oklch([0.8, 0.1, 10])), 0.5)).toEqual({
      kind: 'color',
      space: 'oklch',
      coords: [0.7, 0.15000000000000002, 360],
      alpha: 1,
    })
  })

  it('interpole les nombres d une chaine composee', () => {
    expect(resolveInterval(prepareInterval('blur(0px) saturate(1)', 'blur(10px) saturate(3)'), 0.5)).toBe(
      'blur(5px) saturate(2)',
    )
  })

  it('interpole recursivement les tableaux et retourne une nouvelle valeur', () => {
    const from = [0, srgb([1, 0, 0])] as const
    const to = [20, srgb([0, 0, 1])] as const
    const interval = prepareInterval(from, to)
    const first = resolveInterval(interval, 0.5)
    const second = resolveInterval(interval, 0.5)

    expect(first).toEqual([10, srgb([0.5, 0, 0.5])])
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
  })

  it('interpole recursivement les objets selon la forme cible de D3', () => {
    const interval = prepareInterval(
      { x: 0, obsolete: true },
      { x: 20, visible: false },
    )

    expect(resolveInterval(interval, 0.5)).toEqual({ x: 10, visible: false })
  })

  it('reproduit anime pour une chaine composee', () => {
    const from = 'blur(0px) saturate(1)'
    const to = 'blur(10px) saturate(3)'
    const target = { value: from }
    const animation = animate(target, { value: [from, to], duration: 1000, ease: 'linear', autoplay: false })
    const interval = prepareInterval(from, to)

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      animation.seek(progress * 1000)
      expect(resolveInterval(interval, progress)).toBe(target.value)
    }
  })
})
