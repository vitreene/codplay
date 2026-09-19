/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Creates a scheduler whose frame progression remains under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Creates a scene containing only ordinary compiled eventimes. */
function createTraceScene(): SceneDoc<string> {
  return {
    id: 'compiled-trace-scene',
    stories: {
      main: {
        id: 'main',
        persos: [],
        eventimes: [
          { name: 'first', startAt: 100, data: { value: 'one' } },
          { name: 'second', startAt: 200, data: { value: 'two' } },
        ],
      },
    },
    eventimes: [],
  }
}

describe('compiled eventime diagnostic trace', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('traces reached eventimes during play without tracing seek reconstruction', async () => {
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createTraceScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'compiled-trace-instance',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root: document.createElement('main'),
    })
    const trace: Array<{ name: string; timeMs: number; eventSeq?: number }> = []
    instance.diagnostic.onTrace((event) => {
      trace.push({ name: event.name, timeMs: event.timeMs, eventSeq: event.eventSeq })
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(150)
    expect(trace.map((event) => [event.name, event.timeMs])).toEqual([['first', 100]])
    expect(trace[0]?.eventSeq).toBeUndefined()

    codplay.engine.advance(250)
    expect(trace.map((event) => [event.name, event.timeMs])).toEqual([
      ['first', 100],
      ['second', 200],
    ])

    await instance.telco.seek(200)
    expect(trace.map((event) => [event.name, event.timeMs])).toEqual([
      ['first', 100],
      ['second', 200],
    ])
  })
})
