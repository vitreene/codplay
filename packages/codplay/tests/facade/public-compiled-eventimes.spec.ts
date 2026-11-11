/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayPublicEvent, type CodPlayTraceEvent, type SceneDoc } from '../../src'

/** Builds an independent scene with public, private, nested and inactive occurrences. */
function createPublicScene(calls: string[]): SceneDoc {
  return {
    id: 'public-compiled',
    tracks: { muted: { active: false } },
    listen: [
      { on: 'scene:public', straps: ['unexpected'] },
      { on: 'sequence:end', straps: ['finish'] },
    ],
    straps: {
      // Detects any accidental redispatch of an ordinary authored occurrence.
      unexpected: () => { calls.push('unexpected') },
      // Records the established terminal dispatch boundary.
      finish: () => { calls.push('finish') },
    },
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'label',
          type: 'tag',
          initial: { tag: 'p', attr: { id: 'public-label' }, content: 'Initial', move: '@root' },
          actions: { 'scene:public': true, 'story:public': true, 'story:child': true, 'scene:child': true },
        }],
        eventimes: [{
          name: 'story:public', startAt: 150, visibility: 'public', data: { content: 'Story' },
          events: [{ name: 'story:child', startAt: 25, visibility: 'public', data: { content: 'Story child' } }],
        }],
      },
      inactive: {
        id: 'inactive', trackId: 'muted', persos: [],
        eventimes: [{ name: 'muted:public', startAt: 160, visibility: 'public' }],
      },
    },
    eventimes: [
      { name: 'zero:public', startAt: 0, visibility: 'public' },
      { name: 'scene:public', startAt: 100, visibility: 'public', data: { content: 'Scene' } },
      {
        name: 'private', startAt: 120,
        events: [{ name: 'scene:child', startAt: 60, visibility: 'public', data: { content: 'Scene child' } }],
      },
      { name: 'sequence:end', startAt: 250, visibility: 'public' },
    ],
  }
}

describe('public compiled eventimes', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    document.body.replaceChildren()
  })

  /** Mounts the real HTML runner and observes both public and diagnostic channels. */
  function mount() {
    codplay = new CodPlay({
      frameScheduler: { request: () => 1, cancel: () => undefined },
      pauseOnDocumentHidden: false,
    })
    const calls: string[] = []
    const build = codplay.build({ scene: createPublicScene(calls) })
    if (!build.ok) throw new Error('Public event fixture must compile')
    const root = document.createElement('main')
    root.id = 'public-test-root'
    document.body.append(root)
    const instance = codplay.instances.create({
      instanceId: 'public-instance', compiledScene: build.compiledScene,
      functions: build.functions, root,
    })
    const events: CodPlayPublicEvent[] = []
    const traces: CodPlayTraceEvent[] = []
    const presented: string[] = []
    instance.events.onEvent(event => {
      events.push(event)
      presented.push(root.textContent ?? '')
    })
    instance.diagnostic.onTrace(event => traces.push(event))
    codplay.engine.advance(0)
    return { instance, events, traces, calls, presented, root, engine: codplay.engine }
  }

  it('publishes reached scene/story/nested eventimes once after presentation without redispatching them', async () => {
    const { instance, events, traces, calls, presented, engine } = mount()
    expect(events).toEqual([])
    await instance.telco.play()
    engine.advance(0)
    engine.advance(100)
    engine.advance(100)
    expect(events.map(event => [event.name, event.timeMs])).toEqual([
      ['zero:public', 0], ['scene:public', 100],
    ])
    expect(presented.at(-1)).toBe('Scene')
    expect(calls).toEqual([])
    expect(events.every(event => event.eventSeq === undefined)).toBe(true)
    expect(events[1]?.eventId).toBe(traces.find(event => event.name === 'scene:public')?.eventId)

    engine.advance(200)
    expect(events.map(event => event.name)).toEqual([
      'zero:public', 'scene:public', 'story:public', 'story:child', 'scene:child',
    ])
    expect(presented.at(-1)).toBe('Scene child')
    await instance.events.emit({ name: 'live:public', visibility: 'public' }, { scope: 'scene' })
    engine.advance(200)
    expect(events.at(-1)).toMatchObject({ name: 'live:public', eventSeq: expect.any(Number) })
    expect(new Set(events.map(event => event.eventId)).size).toBe(events.length)

    engine.advance(300)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(events.filter(event => event.name === 'sequence:end')).toHaveLength(1)
    expect(calls).toEqual(['finish'])
    expect(instance.telco.getState().sequenceEnded).toBe(true)
  })

  it('does not publish during pause or seek and publishes a fresh cycle after reset', async () => {
    const { instance, events, engine } = mount()
    await instance.telco.seek(190)
    expect(events).toEqual([])
    engine.advance(10)
    expect(events).toEqual([])
    await instance.telco.play()
    engine.advance(10)
    engine.advance(20)
    expect(events).toEqual([])
    await instance.telco.pause()
    engine.advance(30)
    expect(events).toEqual([])

    await instance.telco.reset()
    await instance.telco.play()
    engine.advance(30)
    engine.advance(130)
    expect(events.map(event => event.name)).toEqual(['zero:public', 'scene:public'])
    await instance.telco.seek(0)
    expect(events).toHaveLength(2)
    await instance.telco.play()
    engine.advance(130)
    engine.advance(230)
    expect(events).toHaveLength(2)
  })
})
