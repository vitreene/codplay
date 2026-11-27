/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Creates a scheduler that leaves frame advancement under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Declares a scene with no eventime and no sequence end: its duration is open. */
function createOpenDurationScene(): SceneDoc<string> {
  return {
    id: 'open-duration-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{ id: 'label', type: 'tag', initial: { move: '@root', tag: 'p', content: 'open' }, actions: {} }],
        eventimes: [],
      },
    },
  }
}

describe('open scene duration discovery', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('discovers the duration from the running head without a fixed scene duration', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createOpenDurationScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'open-duration-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 0, durationMs: 0 })

    await instance.telco.play()
    codplay.engine.advance(1_500)

    expect(instance.telco.getState()).toMatchObject({
      timelineMs: 1_500,
      durationMs: 1_500,
      sequenceEnded: false,
    })

    await instance.events.emit(
      { name: 'open-duration:future-event', startAt: 1_000 },
      { scope: 'scene' },
    )
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 1_500, durationMs: 2_500 })

    await instance.telco.seek(2_000)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 2_000, durationMs: 2_500 })
  })

  it('keeps the discovered horizon when the head seeks backward', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createOpenDurationScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'open-duration-backward-seek-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(1_500)

    await instance.telco.seek(500)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 500, durationMs: 1_500 })

    await instance.telco.seek(0)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 0, durationMs: 1_500 })
  })
})
