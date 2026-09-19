import { describe, expect, it } from 'vitest'

import { RuntimeTargetRegistry } from '../../../src/runtime/targets'

describe('RuntimeTargetRegistry', () => {
  it('keeps host and target identities distinct and unavailable until mounted', () => {
    const registry = new RuntimeTargetRegistry()
    const hostRegistration = registry.publish({ host: 'host-a' }, { kind: 'host' })
    const targetRegistration = registry.publish({ host: 'host-a', target: 'target-a' }, { kind: 'target' })

    expect(registry.resolve({ host: 'host-a' })).toBeUndefined()
    expect(registry.resolve({ host: 'host-a', target: 'target-a' })).toBeUndefined()

    hostRegistration.setAvailable(true)
    targetRegistration.setAvailable(true)

    expect(registry.resolve({ host: 'host-a' })).toEqual({ kind: 'host' })
    expect(registry.resolve({ host: 'host-a', target: 'target-a' })).toEqual({ kind: 'target' })
  })

  it('does not let a stale registration release a replacement target', () => {
    const registry = new RuntimeTargetRegistry()
    const first = registry.publish({ host: 'host-a', target: 'target-a' }, 'first')
    first.setAvailable(true)
    const second = registry.publish({ host: 'host-a', target: 'target-a' }, 'second')
    second.setAvailable(true)

    first.release()

    expect(registry.resolve({ host: 'host-a', target: 'target-a' })).toBe('second')
  })

  it('isolates target state between player-local registries', () => {
    const firstPlayer = new RuntimeTargetRegistry()
    const secondPlayer = new RuntimeTargetRegistry()
    const registration = firstPlayer.publish({ host: 'host-a', target: 'target-a' }, 'first-player')
    registration.setAvailable(true)

    expect(firstPlayer.resolve({ host: 'host-a', target: 'target-a' })).toBe('first-player')
    expect(secondPlayer.resolve({ host: 'host-a', target: 'target-a' })).toBeUndefined()
  })

  it('invalidates a target before the next consumer update', () => {
    const registry = new RuntimeTargetRegistry()
    const registration = registry.publish({ host: 'host-a', target: 'target-a' }, 'target')
    registration.setAvailable(true)
    expect(registry.resolve({ host: 'host-a', target: 'target-a' })).toBe('target')

    registration.setAvailable(false)

    expect(registry.resolve({ host: 'host-a', target: 'target-a' })).toBeUndefined()
  })
})
