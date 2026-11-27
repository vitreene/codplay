/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

const RUN_DURATION_MS = 1000

/** Creates a scheduler that leaves frame advancement under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Declares one perso whose `run` TweenAction fades it in over one second and can be stopped. */
function createStoppableTweenScene(): SceneDoc<string> {
  return {
    id: 'tween-stop-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'bar',
          type: 'tag',
          initial: { move: '@root', tag: 'div', className: 'bar', style: { opacity: 0 } },
          actions: {
            run: {
              duration: RUN_DURATION_MS,
              ease: 'linear',
              fn: ({ progress }: { progress: number }) => ({ style: { opacity: progress } }),
            },
            'tween:stop': {},
          },
        }],
        eventimes: [],
      },
    },
  }
}

describe('live TweenAction stop', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('stops a running TweenAction through the facade without pausing the player', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({ frameScheduler: createManualScheduler(), pauseOnDocumentHidden: false })
    const build = codplay.build({ scene: createStoppableTweenScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'tween-stop-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    /** Reads the live node on each call: it is replaced when the player starts. */
    const readOpacity = (): string => root.querySelector<HTMLElement>('.bar')?.style.opacity ?? ''

    codplay.engine.advance(0)
    await instance.telco.play()
    await instance.events.emit({ name: 'run', visibility: 'public' }, { scope: 'story', storyId: 'main' })
    codplay.engine.advance(400)
    expect(Number(readOpacity())).toBeCloseTo(0.4, 5)

    await instance.events.emit({ name: 'tween:stop', visibility: 'public' }, { scope: 'story', storyId: 'main' })
    expect(instance.telco.getState().status).toBe('playing')

    // The stopped TweenAction leaves the reconstruction: it no longer drives the perso as time moves on.
    codplay.engine.advance(900)
    expect(instance.telco.getState().status).toBe('playing')
    expect(instance.telco.getProgress().timelineMs).toBe(900)
    expect(Number(readOpacity())).toBe(0)
  })
})
