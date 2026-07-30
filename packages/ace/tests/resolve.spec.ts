import { describe, expect, it } from 'vitest'

import { prepareKeyframes } from '../src/keyframes'
import { resolve } from '../src/resolve'
import { prepareTween } from '../src/tween'

describe('resolve', () => {
  it('resolves tweens and keyframes in declaration order', () => {
    const movement = prepareTween({ from: [0, 0], to: [500, 500], duration: 1000, ease: 'linear' })
    const opacity = prepareTween({ from: 0, to: 1, duration: 1000, ease: 'linear' })
    const scale = prepareKeyframes([
      { from: 0.8, to: 1.2, duration: 500, ease: 'linear' },
      { from: 1.2, to: 1, duration: 500, ease: 'linear' },
    ])

    expect(resolve([movement, opacity, scale], 750)).toEqual([[375, 375], 0.75, 1.1])
  })

  it('does not assign results to state or a render target', () => {
    const tween = prepareTween({ from: 0, to: 1, duration: 1000, ease: 'linear' })

    expect(resolve([tween], 500)).toEqual([0.5])
  })
})
