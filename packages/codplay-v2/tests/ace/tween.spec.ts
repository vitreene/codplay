import { describe, expect, it } from 'vitest'
import { animate } from 'animejs'

import { prepareTween, resolveTween, resolveTweenProgress } from '../../src/ace/tween'

describe('prepareTween', () => {
  it('prepares anime defaults without globals mutables', () => {
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

  it('matches anime 4.5 timing for linear scalar tweens', () => {
    const cases = [
      { delay: 0, loop: 0, loopDelay: 0, reversed: false, alternate: false },
      { delay: 30, loop: 0, loopDelay: 0, reversed: false, alternate: false },
      { delay: 0, loop: 1, loopDelay: 20, reversed: false, alternate: false },
      { delay: 0, loop: 2, loopDelay: 15, reversed: false, alternate: true },
      { delay: 10, loop: 1, loopDelay: 20, reversed: true, alternate: true },
    ]

    for (const options of cases) {
      const target = { value: 0 }
      const animation = animate(target, {
        value: [0, 100],
        duration: 100,
        ease: 'linear',
        autoplay: false,
        ...options,
      })
      const tween = prepareTween({ from: 0, to: 100, duration: 100, ease: 'linear', ...options })

      for (const instant of [-20, 0, 10, 30, 50, 100, 110, 120, 150, 200, 250, 300, 400]) {
        // anime.seek() takes an instant relative to its delay, unlike ACE's bare scene instant.
        animation.seek(instant - options.delay)
        expect(resolveTween(tween, instant)).toBe(target.value)
      }
    }
  })
})
