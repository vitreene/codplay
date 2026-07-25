import { describe, it, expect } from 'vitest'
import { createDecorLiveSession } from '../src/decor-editor/decor-live-session'

describe('createDecorLiveSession', () => {
  it('starts idle with an empty patch', () => {
    const session = createDecorLiveSession()
    expect(session.getSnapshot()).toEqual({ status: 'idle', patch: {} })
  })

  it('idle → live on the first reported values', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    expect(session.getSnapshot()).toEqual({ status: 'live', patch: { offset: { rotate: 15 } } })
  })

  it('accumulates successive values by merging, never replacing wholesale', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    session.reportValues({ style: { 'background-color': 'red' } })
    expect(session.getSnapshot()).toEqual({
      status: 'live',
      patch: { offset: { rotate: 15 }, style: { 'background-color': 'red' } }
    })
  })

  it('live → committing on COMMIT, patch stays readable until WRITTEN', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    session.commit()
    expect(session.getSnapshot()).toEqual({ status: 'committing', patch: { offset: { rotate: 15 } } })
  })

  it('committing → idle on notifyWritten, patch cleared', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    session.commit()
    session.notifyWritten()
    expect(session.getSnapshot()).toEqual({ status: 'idle', patch: {} })
  })

  it('live → idle on abort, patch discarded, nothing to write', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    session.abort()
    expect(session.getSnapshot()).toEqual({ status: 'idle', patch: {} })
  })

  it('subscribe fires immediately with the current snapshot, then on every transition', () => {
    const session = createDecorLiveSession()
    const seen: string[] = []
    const unsubscribe = session.subscribe((snapshot) => seen.push(snapshot.status))
    session.reportValues({ style: { color: 'blue' } })
    session.commit()
    session.notifyWritten()
    expect(seen).toEqual(['idle', 'live', 'committing', 'idle'])
    unsubscribe()
    session.reportValues({ style: { color: 'green' } })
    expect(seen).toEqual(['idle', 'live', 'committing', 'idle']) // unsubscribed — no further pushes
  })

  it('a fresh session after a full cycle behaves exactly like a brand-new one', () => {
    const session = createDecorLiveSession()
    session.reportValues({ offset: { rotate: 15 } })
    session.commit()
    session.notifyWritten()
    session.reportValues({ style: { color: 'blue' } })
    expect(session.getSnapshot()).toEqual({ status: 'live', patch: { style: { color: 'blue' } } })
  })
})
