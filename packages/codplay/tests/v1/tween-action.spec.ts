import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

type PersoFixture = SceneDoc['stories'][string]['persos'][number]

/**
 * Creates one strict scene fixture with root mount/start hooks and a raw track.
 * `sequence:end` is scheduled far in the future so `seek()` is never clamped
 * back by `resolveCurrentSeekEndMs` to the last authored event's own ms.
 */
function temp__createTweenSceneFixture(input: {
  sceneId: string
  storyId: string
  persos: PersoFixture[]
  events: Array<{ id: string; ms: number; name: string }>
}): SceneDoc {
  return {
    id: input.sceneId,
    rootStories: [input.storyId],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      [input.storyId]: {
        id: input.storyId,
        initial: undefined,
        persos: input.persos,
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    tracks: {
      [`track-${input.storyId}`]: {
        id: `track-${input.storyId}`,
        source: 'story',
        order: 0,
        events: [
          ...input.events.map((event, index) => ({
            id: event.id,
            ms: event.ms,
            name: event.name,
            index,
            source: 'story'
          })),
          {
            id: 'evt-sequence-end',
            ms: 10000,
            name: 'sequence:end',
            index: input.events.length,
            source: 'story'
          }
        ]
      }
    }
  }
}

/**
 * Creates one runtime node fixture compatible with the player's nodeFactory contract.
 */
function temp__createRuntimeNode(): Record<string, unknown> {
  return {
    tagName: 'DIV',
    style: { opacity: 0 },
    attributes: {}
  }
}

/**
 * Creates one perso with a single TweenAction declared on the "intro" action key.
 */
function temp__createTweenPerso(durationMs: number): PersoFixture {
  return {
    id: 'title',
    type: 'tag',
    initial: { move: '@root' },
    actions: {
      intro: {
        duration: durationMs,
        fn: ({ progress }: { progress: number }) => ({ style: { opacity: progress } })
      }
    }
  }
}

describe('V1 - TweenAction characterization (pre Phase 1 unification)', () => {
  it('TW-T1 fn is evaluated at the exact progress for successive seek positions and clamps past duration', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const scene = temp__createTweenSceneFixture({
      sceneId: 'scene-tween-progress',
      storyId: 'story-tween-progress',
      persos: [temp__createTweenPerso(1000)],
      events: [{ id: 'evt-intro', ms: 0, name: 'intro' }]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    await player.seek(0)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0)

    await player.seek(400)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0.4)

    await player.seek(1000)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(1)

    await player.seek(1500)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(1)
  })

  it('TW-T2 seek evaluates fn at the exact target progress without live ticking', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const scene = temp__createTweenSceneFixture({
      sceneId: 'scene-tween-seek',
      storyId: 'story-tween-seek',
      persos: [temp__createTweenPerso(1000)],
      events: [{ id: 'evt-intro', ms: 0, name: 'intro' }]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()
    await player.seek(300)

    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0.3)

    await player.seek(2000)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(1)
  })

  it('TW-T3 (seek reconstruction) tween:stop removes the tween from the replayed timeline entirely', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const scene = temp__createTweenSceneFixture({
      sceneId: 'scene-tween-stop',
      storyId: 'story-tween-stop',
      persos: [temp__createTweenPerso(1000)],
      events: [
        { id: 'evt-intro', ms: 0, name: 'intro' },
        { id: 'evt-stop', ms: 400, name: 'tween:stop' }
      ]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // Before the stop point, the tween still evaluates normally on seek.
    await player.seek(200)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBe(0.2)

    // Past the stop point, the seek replay re-registers then cancels the tween
    // before ever evaluating it at the target. The reset pass clears any style
    // property not part of `perso.initial` (here, none was declared), so
    // `opacity` is absent altogether rather than holding a "frozen" or default
    // value. This documents the current seek-reconstruction behavior
    // precisely; it is a separate question from how live playback freezes the
    // value (not exercised here: this test environment has no
    // requestAnimationFrame to drive live ticks deterministically, so only the
    // seek path is characterized).
    await player.seek(1500)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBeUndefined()
  })

  it('TW-T4 re-triggering the same actionKey restarts the tween from progress 0 (Cas 1)', async () => {
    const runtimeNode = temp__createRuntimeNode()
    const scene = temp__createTweenSceneFixture({
      sceneId: 'scene-tween-restart',
      storyId: 'story-tween-restart',
      persos: [temp__createTweenPerso(1000)],
      events: [
        { id: 'evt-intro-1', ms: 0, name: 'intro' },
        { id: 'evt-intro-2', ms: 400, name: 'intro' }
      ]
    })

    const player = new PlayerFacade({
      createElementOptions: { nodeFactory: () => runtimeNode }
    })

    await player.init(scene)
    await player.play()

    // If the second trigger did NOT restart the tween, progress at ms 420
    // relative to the FIRST start (ms 0) would be 0.42. Since the same
    // actionKey re-registers and cancels the prior instance, progress is
    // instead relative to the SECOND start (ms 400): (420-400)/1000 = 0.02.
    await player.seek(420)
    expect((runtimeNode.style as Record<string, unknown>).opacity).toBeCloseTo(0.02, 5)
  })
})
