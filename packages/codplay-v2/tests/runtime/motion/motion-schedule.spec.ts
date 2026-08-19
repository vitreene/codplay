import { describe, expect, it } from 'vitest'
import { compileMotionSchedule } from '../../../src/runtime/motion'
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
      projectionMode: 'local',
    })
    expect(Object.isFrozen(schedule)).toBe(true)
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

  it('maps the optional overlay author mode to a reparent projection hint', () => {
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

    expect(schedule.every((intent) => intent.projectionMode === 'reparent')).toBe(true)
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
  }
}
