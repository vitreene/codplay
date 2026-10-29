import { describe, expect, it, vi } from 'vitest'
import { ExclusiveSyncSession } from '../src/exclusive-sync-session'
import type { ConfirmedValue, ExclusiveSyncPorts } from '../src/exclusive-sync-session'

/** Creates a transport-free fixture that records transitions for an opaque value. */
function fixture<T>(initial: ConfirmedValue<T>) {
  let confirmed = initial
  let held = false
  let grantNumber = 0
  const installed: ConfirmedValue<T>[] = []
  const editable: boolean[] = []
  const publishPending = vi.fn(async () => undefined)
  const ports: ExclusiveSyncPorts<T> = {
    acquire: async () => {
      if (held) return null
      held = true
      grantNumber += 1
      return { grantId: `grant-${grantNumber}` }
    },
    release: async () => { held = false },
    stillHeld: async () => held,
    readConfirmed: async () => confirmed,
    publishPending,
    installConfirmed: async (value) => { installed.push(value) },
    setEditable: (value) => { editable.push(value) },
  }
  return {
    ports,
    installed,
    editable,
    publishPending,
    update: (value: ConfirmedValue<T>) => { confirmed = value },
  }
}

describe('ExclusiveSyncSession', () => {
  it('uses the same ownership and revision policy for distinct payloads', async () => {
    /** Exercises the policy without constraining the application's value type. */
    async function check<T>(initial: ConfirmedValue<T>): Promise<void> {
      const state = fixture(initial)
      const session = new ExclusiveSyncSession(state.ports)
      await session.refreshReader()
      expect(state.installed).toEqual([initial])
      expect(await session.requestEdit()).toBe(true)
      expect(state.publishPending).toHaveBeenCalledTimes(1)
      expect(state.editable).toEqual([true])
      await session.yieldEdit()
      expect(state.editable).toEqual([true, false])
      expect(session.hasGrant()).toBe(false)
    }
    await check({ revision: 0, value: { title: 'First' } })
    await check({ revision: 0, value: ['one', 'two'] })
  })

  it('never releases a grant when publication fails', async () => {
    const state = fixture({ revision: 1, value: 'saved' })
    const session = new ExclusiveSyncSession(state.ports)
    await session.requestEdit()
    state.publishPending.mockRejectedValueOnce(new Error('offline'))
    await expect(session.yieldEdit()).rejects.toThrow('offline')
    expect(session.hasGrant()).toBe(true)
    expect(state.editable).toEqual([true, false])
    await session.yieldEdit()
    expect(session.hasGrant()).toBe(false)
  })

  it('does not activate when the right is occupied or the confirmed read fails', async () => {
    const state = fixture({ revision: 1, value: 'saved' })
    const session = new ExclusiveSyncSession({ ...state.ports, acquire: async () => null })
    expect(await session.requestEdit()).toBe(false)
    expect(state.editable).toEqual([])
    expect(session.hasGrant()).toBe(false)

    const failed = new ExclusiveSyncSession({
      ...state.ports,
      readConfirmed: async () => { throw new Error('offline') },
    })
    await expect(failed.requestEdit()).rejects.toThrow('offline')
    expect(failed.hasGrant()).toBe(true)
    expect(state.editable).toEqual([])
  })

  it('reconciles a release whose response was lost', async () => {
    const state = fixture({ revision: 1, value: 'saved' })
    const session = new ExclusiveSyncSession({
      ...state.ports,
      release: async (grant) => {
        await state.ports.release(grant)
        throw new Error('response lost')
      },
    })
    await session.requestEdit()
    await session.yieldEdit()
    expect(session.hasGrant()).toBe(false)
  })

  it('ignores a repeated reader revision and installs a newer one', async () => {
    const state = fixture({ revision: 1, value: 'one' })
    const session = new ExclusiveSyncSession(state.ports)
    await session.refreshReader()
    await session.refreshReader()
    state.update({ revision: 2, value: 'two' })
    await session.refreshReader()
    expect(state.installed).toEqual([
      { revision: 1, value: 'one' },
      { revision: 2, value: 'two' },
    ])
  })

  it('releases only after the caller has preserved an independent copy', async () => {
    const state = fixture({ revision: 1, value: { title: 'local' } })
    const session = new ExclusiveSyncSession(state.ports)
    await session.requestEdit()
    await session.releaseAfterIndependentCopy()
    expect(state.publishPending).toHaveBeenCalledTimes(1)
    expect(session.hasGrant()).toBe(false)
    expect(state.editable).toEqual([true, false])
  })
})
