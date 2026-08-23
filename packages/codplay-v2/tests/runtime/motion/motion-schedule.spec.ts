import { describe, expect, it } from 'vitest'
import { compileMotionSchedule } from '../../../src/runtime/motion'
import { RuntimeTrackJournal } from '../../../src/runtime/player/pipeline'
import type { CompiledScene } from '../../../src/scene/compiled'

describe('compileMotionSchedule', () => {
  it('compiles nested events into one absolute immutable schedule', () => {
    const schedule = compileMotionSchedule(compiledScene())

    expect(schedule.map((intent) => intent.startAt)).toEqual([50, 75])
    expect(schedule[1]).toMatchObject({
      id: 'motion:main:item:move:0.0:75',
      eventId: 'main:item:move:0.0',
      itemId: 'main:item',
      declarationPath: [0, 0],
      duration: 100,
      ease: 'out(2)',
      presentationMode: 'local',
    })
    expect(Object.isFrozen(schedule)).toBe(true)
  })

  it('accepts one action-owned pose transition through the materializer resolver', () => {
    const base = compiledScene()
    const schedule = compileMotionSchedule({
      ...base,
      scene: {
        ...base.scene,
        stories: {
          main: {
            ...base.scene.stories.main!,
            persos: [{
              ...base.scene.stories.main!.persos[0]!,
              actions: { style: { style: { top: { from: '0px', to: '100px', duration: 250, delay: 40, ease: 'linear' } } } },
            }],
            eventimes: [{ name: 'style', startAt: 50 }],
          },
        },
      },
    },
      undefined,
      {
        resolveActionTransition: (action) => action?.style === undefined
          ? undefined
          : { duration: 250, delay: 40, ease: 'linear' },
      },
    )

    expect(schedule).toHaveLength(1)
    expect(schedule[0]).toMatchObject({
      startAt: 50,
      duration: 250,
      delay: 40,
      endAt: 340,
      ease: 'linear',
      presentationMode: 'local',
    })
  })

  it('keeps only the last command for one item at one event boundary', () => {
    const base = compiledScene()
    const schedule = compileMotionSchedule({
      ...base,
      scene: {
        ...base.scene,
        stories: {
          main: {
            ...base.scene.stories.main!,
            eventimes: [{ name: 'move', startAt: 50 }, { name: 'move', startAt: 50 }],
          },
        },
      },
    })

    expect(schedule).toHaveLength(1)
    expect(schedule[0]?.declarationPath).toEqual([1])
  })

  it('maps the optional overlay author mode to a reparent presentation hint', () => {
    const base = compiledScene()
    const story = base.scene.stories.main!
    const schedule = compileMotionSchedule({
      ...base,
      scene: {
        ...base.scene,
        stories: {
          main: {
            ...story,
            persos: [{
              ...story.persos[0]!,
              actions: {
                move: { move: { target: 'target', flipMode: 'overlay-world', transition: { duration: 100 } } },
              },
            }],
          },
        },
      },
    })

    expect(schedule.every((intent) => intent.presentationMode === 'reparent')).toBe(true)
  })

  it('can exclude persist-only runtime moves from the current playback schedule', () => {
    const base = compiledScene()
    const runtimeScene: CompiledScene = {
      ...base,
      scene: {
        ...base.scene,
        stories: {
          main: {
            ...base.scene.stories.main!,
            persos: [{
              ...base.scene.stories.main!.persos[0]!,
              actions: {
                ...base.scene.stories.main!.persos[0]!.actions,
                'runtime-move': {},
              },
            }],
          },
        },
      },
      actionTargetIndex: {
        'runtime-move': [{ storyId: 'main', persoId: 'item' }],
      },
    }
    const journal = new RuntimeTrackJournal(runtimeScene)
    journal.appendLiveEvent({
      eventId: 'persist-move',
      trackId: 'main',
      storyId: 'main',
      name: 'runtime-move',
      applyAtMs: 100,
      data: { move: { target: 'target', transition: { duration: 100 } } },
      mode: 'persist-only',
    })
    journal.appendLiveEvent({
      eventId: 'live-move',
      trackId: 'main',
      storyId: 'main',
      name: 'runtime-move',
      applyAtMs: 200,
      data: { move: { target: 'target', transition: { duration: 100 } } },
    })

    const replay = compileMotionSchedule(runtimeScene, journal)
    const current = compileMotionSchedule(runtimeScene, journal, { includePersistOnly: false })

    expect(replay.map((intent) => intent.eventId)).toContain('persist-move')
    expect(current.map((intent) => intent.eventId)).not.toContain('persist-move')
    expect(current.map((intent) => intent.eventId)).toContain('live-move')
  })
})

/** Creates one compiled scene containing nested direct movement commands. */
function compiledScene(): CompiledScene {
  return {
    schemaVersion: 'v2',
    createdAt: '2026-08-19T00:00:00.000Z',
    scene: {
      id: 'motion-schedule-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'tag',
            initial: { move: '@root' },
            actions: {
              move: { move: { target: 'target', transition: { duration: 100 } } },
            },
          }],
          listen: [],
          eventimes: [{
            name: 'move',
            startAt: 50,
            events: [{ name: 'move', startAt: 25 }],
          }],
        },
      },
      listen: [],
      tracks: {},
    },
    resources: { entries: [] },
    rootNodeIds: [],
    requirements: { components: [], services: [], modules: [], resources: [] },
    actionTargetIndex: {},
  }
}
