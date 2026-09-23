import { describe, expect, it } from 'vitest'
import { getAvatarActionMotion } from '../src/avatar/gesture/motion-catalog'

describe('Avatar motion catalogue', () => {
  it('keeps a native gesture through null command slots until the action releases', () => {
    const motion = getAvatarActionMotion('celebrate', 41, 2_200)

    expect(motion?.sample(1_600)).toMatchObject({
      gesture: 'handup',
      mirror: true,
      released: false,
    })
    expect(motion?.sample(motion?.durationMs ?? 0)).toMatchObject({
      gesture: null,
      released: true,
    })
  })
})
