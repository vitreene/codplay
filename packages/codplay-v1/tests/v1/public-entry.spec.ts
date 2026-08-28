import { describe, expect, it } from 'vitest'

import { CodPlay } from '../../src'

describe('V1 - public entry point', () => {
  it('exports CodPlay from the root module', () => {
    const studio = new CodPlay()

    expect(typeof CodPlay).toBe('function')
    expect(typeof studio.builder.compile).toBe('function')
    expect(typeof studio.player.init).toBe('function')
    expect(typeof studio.player.resume).toBe('function')
    expect(typeof studio.player.stop).toBe('function')
    expect(typeof studio.player.schedule.wait).toBe('function')
    expect(typeof studio.player.schedule.delay).toBe('function')
    expect(typeof studio.player.schedule.repeat).toBe('function')
    expect(typeof studio.player.schedule.loop).toBe('function')
    expect(typeof studio.player.schedule.stagger).toBe('function')
  })
})
