import { describe, expect, it } from 'vitest'

import { RuntimeTargetRegistry } from '../../../src/runtime/targets'

describe('RuntimeTargetRegistry', () => {
  it('keeps scene and perso identities distinct and unavailable until mounted', () => {
    const registry = new RuntimeTargetRegistry()
    const sceneRegistration = registry.publish({ scene: 'scene-a' }, { kind: 'scene' })
    const persoRegistration = registry.publish({ scene: 'scene-a', perso: 'host' }, { kind: 'perso' })

    expect(registry.resolve({ scene: 'scene-a' })).toBeUndefined()
    expect(registry.resolve({ scene: 'scene-a', perso: 'host' })).toBeUndefined()

    sceneRegistration.setAvailable(true)
    persoRegistration.setAvailable(true)

    expect(registry.resolve({ scene: 'scene-a' })).toEqual({ kind: 'scene' })
    expect(registry.resolve({ scene: 'scene-a', perso: 'host' })).toEqual({ kind: 'perso' })
  })

  it('does not let a stale registration release a replacement target', () => {
    const registry = new RuntimeTargetRegistry()
    const first = registry.publish({ scene: 'scene-a', perso: 'host' }, 'first')
    first.setAvailable(true)
    const second = registry.publish({ scene: 'scene-a', perso: 'host' }, 'second')
    second.setAvailable(true)

    first.release()

    expect(registry.resolve({ scene: 'scene-a', perso: 'host' })).toBe('second')
  })

  it('isolates target state between player-local registries', () => {
    const firstPlayer = new RuntimeTargetRegistry()
    const secondPlayer = new RuntimeTargetRegistry()
    const registration = firstPlayer.publish({ scene: 'scene-a', perso: 'host' }, 'first-player')
    registration.setAvailable(true)

    expect(firstPlayer.resolve({ scene: 'scene-a', perso: 'host' })).toBe('first-player')
    expect(secondPlayer.resolve({ scene: 'scene-a', perso: 'host' })).toBeUndefined()
  })

  it('invalidates a target before the next consumer update', () => {
    const registry = new RuntimeTargetRegistry()
    const registration = registry.publish({ scene: 'scene-a', perso: 'host' }, 'target')
    registration.setAvailable(true)
    expect(registry.resolve({ scene: 'scene-a', perso: 'host' })).toBe('target')

    registration.setAvailable(false)

    expect(registry.resolve({ scene: 'scene-a', perso: 'host' })).toBeUndefined()
  })
})
