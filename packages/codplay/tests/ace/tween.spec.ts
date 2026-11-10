import { describe, expect, it } from 'vitest'

import { prepareTween, resolveTween, resolveTweenProgress } from '../../src/ace/tween'

describe('prepareTween', () => {
  it('prepares defaults without mutable globals', () => {
    const tween = prepareTween({ from: 0, to: 100 })

    expect(tween.duration).toBe(1000)
    expect(tween.delay).toBe(0)
    expect(tween.iterationCount).toBe(1)
    expect(tween.totalDuration).toBe(1000)
  })

  it('rejects the imperative zero-duration setter form', () => {
    expect(() => prepareTween({ from: 0, to: 100, duration: 0 })).toThrow(/strictement positif/)
  })
})

describe('resolveTween', () => {
  it('holds the initial value during delay and the final value after completion', () => {
    const tween = prepareTween({ from: 0, to: 100, duration: 100, delay: 30, ease: 'linear' })

    expect(resolveTween(tween, 0)).toBe(0)
    expect(resolveTween(tween, 30)).toBe(0)
    expect(resolveTween(tween, 80)).toBe(50)
    expect(resolveTween(tween, 130)).toBe(100)
    expect(resolveTween(tween, 200)).toBe(100)
  })

  it('holds the endpoint during a loop delay', () => {
    const tween = prepareTween({
      from: 0,
      to: 100,
      duration: 100,
      loop: 1,
      loopDelay: 20,
      ease: 'linear',
    })

    expect(resolveTween(tween, 100)).toBe(100)
    expect(resolveTween(tween, 110)).toBe(100)
    expect(resolveTween(tween, 120)).toBe(0)
  })

  it('applies reversed and alternate to each iteration', () => {
    const tween = prepareTween({
      from: 0,
      to: 100,
      duration: 100,
      loop: 1,
      reversed: true,
      alternate: true,
      ease: 'linear',
    })

    expect(resolveTween(tween, 0)).toBe(100)
    expect(resolveTween(tween, 50)).toBe(50)
    expect(resolveTween(tween, 100)).toBe(0)
    expect(resolveTween(tween, 150)).toBe(50)
    expect(resolveTween(tween, 200)).toBe(100)
  })

  it('is reversible because the same instant always yields the same progress', () => {
    const tween = prepareTween({ from: 0, to: 100, duration: 100, loop: 2, alternate: true })
    const instants = [0, 35, 100, 145, 230, 300]
    const forward = instants.map((instant) => resolveTweenProgress(tween, instant))
    const backwards = [...instants].reverse().map((instant) => resolveTweenProgress(tween, instant)).reverse()

    expect(backwards).toEqual(forward)
  })
})
