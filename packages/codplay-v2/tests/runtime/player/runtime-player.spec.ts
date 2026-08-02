import { describe, expect, it } from 'vitest'

import { RuntimeEngine, RuntimeModuleServiceCatalog } from '../../../src/runtime/engine'
import {
  createMarkupModuleServiceDefinition,
  type MarkupModuleServiceInstance,
} from '../../../src/runtime/capabilities/markup'
import {
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
  MemoryRenderSink,
  RenderSync,
  RuntimePlayer,
  type RenderAdapter,
  type SolvedScene,
} from '../../../src/runtime/player'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-07-31T00:00:00.000Z',
  scene: { id: 'scene-a', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('RuntimePlayer', () => {
  it('owns lifecycle and logical time without creating a clock', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const sink = new MemoryRenderSink()
    const player = new RuntimePlayer('instance-a', engine, scene, sink)

    expect(player.init().ok).toBe(true)
    player.play()
    engine.advance(100)
    engine.advance(160)

    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PLAYING)
    expect(player.getCurrentTimeMs()).toBe(60)

    player.pause()
    player.seek(500)
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(player.getCurrentTimeMs()).toBe(500)
    player.destroy()
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_DESTROYED)
    expect(sink.getSnapshots()).toEqual([
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 0, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 0, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 60, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 500, persos: {} },
    ])
  })

  it('does not initialize when the engine lacks a compiled requirement', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer('instance-a', engine, {
      ...scene,
      requirements: { ...scene.requirements, components: ['tag'] },
    })

    const result = player.init()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics.errors[0]?.code).toBe('RUNTIME_COMPONENT_UNAVAILABLE')
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_IDLE)
  })

  it('warns when declared straps are missing from their owned collections', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer(
      'instance-a',
      engine,
      { ...scene, scene: { ...scene.scene, straps: ['missing-scene-strap'] } },
      undefined,
      undefined,
      { scene: {}, stories: {} },
    )

    const result = player.init()

    expect(result.ok).toBe(true)
    expect(result.diagnostics.warnings.map((entry) => entry.code)).toEqual(['AUTHOR_SCENE_STRAP_MISSING'])
  })

  it('resets the instance delta baseline after pause/resume', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer('instance-a', engine, scene)

    player.init()
    player.play()
    engine.advance(100)
    engine.advance(140)
    player.pause()
    engine.advance(1000)
    player.play()
    engine.advance(1016)
    engine.advance(1032)

    expect(player.getCurrentTimeMs()).toBe(56)
  })

  it('routes play, pause, resume, and seek baselines through RenderSync', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const ticks: Array<{ nowMs: number; deltaMs: number; timelineMs: number }> = []
    const seeks: Array<{ nowMs: number; timelineMs: number }> = []
    const adapter: RenderAdapter = {
      tick: ({ nowMs, deltaMs, timelineMs }) => ticks.push({ nowMs, deltaMs, timelineMs }),
      seek: ({ nowMs, timelineMs }) => seeks.push({ nowMs, timelineMs }),
    }
    const player = new RuntimePlayer('instance-a', engine, scene, undefined, new RenderSync([adapter]))

    player.init()
    player.play()
    engine.advance(100)
    engine.advance(140)
    player.pause()
    engine.advance(1000)
    player.seek(500)
    player.play()
    engine.advance(1016)
    engine.advance(1032)

    expect(ticks).toEqual([
      { nowMs: 100, deltaMs: 0, timelineMs: 0 },
      { nowMs: 140, deltaMs: 40, timelineMs: 40 },
      { nowMs: 1016, deltaMs: 0, timelineMs: 500 },
      { nowMs: 1032, deltaMs: 16, timelineMs: 516 },
    ])
    expect(seeks).toEqual([{ nowMs: 1000, timelineMs: 500 }])
  })

  it('reconstructs selected players before presenting a grouped seek', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const firstSink = new MemoryRenderSink()
    const secondSink = new MemoryRenderSink()
    const first = new RuntimePlayer('first', engine, scene, firstSink)
    const second = new RuntimePlayer('second', engine, scene, secondSink)

    first.init()
    second.init()
    const result = engine.seek([
      { instanceId: 'first', timeMs: 3000 },
      { instanceId: 'second', timeMs: 2000 },
    ])

    expect(result.ok).toBe(true)
    expect(Object.keys(result.diagnostics)).toEqual(['first', 'second'])
    expect(firstSink.getSnapshots().at(-1)?.timeMs).toBe(3000)
    expect(secondSink.getSnapshots().at(-1)?.timeMs).toBe(2000)
  })

  it('returns structured diagnostics from a seek reconstruction', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const seekScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'item',
              type: 'tag',
              initial: {},
              actions: { invalid: { move: { parentId: 42 } } },
            }],
            listen: [],
            eventimes: [{ name: 'invalid', startAt: 100 }],
          },
        },
      },
    }
    const player = new RuntimePlayer('instance-a', engine, seekScene)
    player.init()

    const result = player.seek(100)

    expect(result.ok).toBe(true)
    expect(result.diagnostics.warnings.map((entry) => entry.code)).toContain('AUTHOR_MOVE_LAST_INVALID_SAME_TICK')
  })

  it('returns a failed seek result instead of hiding lifecycle errors', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer('instance-a', engine, scene)

    const result = player.seek(100)

    expect(result).toMatchObject({ ok: false, timeMs: 100 })
    expect(result.diagnostics.errors[0]?.code).toBe('RUNTIME_SEEK_FAILED')
  })

  it('aggregates seek diagnostics by instance at the engine boundary', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const invalidScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'item', type: 'tag', initial: {}, actions: { invalid: { move: { parentId: 42 } } } }],
            listen: [],
            eventimes: [{ name: 'invalid', startAt: 100 }],
          },
        },
      },
    }
    const first = new RuntimePlayer('first', engine, scene)
    const second = new RuntimePlayer('second', engine, invalidScene)
    first.init()
    second.init()

    const result = engine.seek([
      { instanceId: 'first', timeMs: 100 },
      { instanceId: 'second', timeMs: 100 },
    ])

    expect(result.diagnostics.second?.warnings.map((entry) => entry.code)).toContain('AUTHOR_MOVE_LAST_INVALID_SAME_TICK')
  })

  it('initializes, updates, and destroys player-scoped module services', () => {
    const events: string[] = []
    const catalog = new RuntimeModuleServiceCatalog()
    catalog.register({
      id: 'probe',
      create: () => ({
        initializeScene: (solved) => events.push(`init:${solved.timeMs}`),
        prepareSeek: (solved) => {
          events.push(`prepare:${solved.timeMs}`)
          return { commit: () => events.push('commit'), abort: () => events.push('abort') }
        },
        onMoveDelta: (delta) => events.push(`${delta.operation}:${delta.persoKey}`),
        destroy: () => events.push('destroy'),
      }),
    })
    const engine = new RuntimeEngine(
      { components: [], services: [], modules: ['probe'], resources: [] },
      { moduleServiceCatalog: catalog },
    )
    const moduleScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'item', type: 'tag', initial: { move: '@root' }, actions: {
              transfer: { move: { parentId: 'outlet' } },
            } }],
            listen: [],
            eventimes: [{ name: 'transfer', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['probe'] },
    }
    const player = new RuntimePlayer('module-player', engine, moduleScene, undefined, undefined, undefined, undefined, [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
      { id: 'outlet', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
    ])

    expect(player.init().ok).toBe(true)
    expect(events).toEqual(['init:0'])
    player.seek(100)
    expect(events).toEqual(['init:0', 'prepare:100', 'commit'])
    player.destroy()
    expect(events.at(-1)).toBe('destroy')
  })

  it('feeds mount targets exposed by a module into scene solving', () => {
    const events: string[] = []
    const catalog = new RuntimeModuleServiceCatalog()
    const markupDefinition = createMarkupModuleServiceDefinition()
    catalog.register({
      id: 'markup',
      create: (context) => {
        const markup = markupDefinition.create(context) as MarkupModuleServiceInstance
        markup.registerComponent({
          componentId: 'page-layout',
          storyId: 'main',
          componentType: 'layout',
          parts: [{
            id: 'layout-content',
            ownerId: 'page-layout',
            storyId: 'main',
            componentType: 'layout',
            partId: 'content',
            kind: 'outlet',
          }],
        })
        return {
          ...markup,
          onMoveDelta: (delta) => events.push(`${delta.operation}:${delta.toTargetId}`),
        }
      },
    })
    const moduleScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'item',
              type: 'tag',
              initial: { move: '@root' },
              actions: { attach: { move: { parentId: 'layout-content' } } },
            }],
            listen: [],
            eventimes: [{ name: 'attach', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['markup'] },
    }
    const engine = new RuntimeEngine(
      { components: [], services: [], modules: ['markup'], resources: [] },
      { moduleServiceCatalog: catalog },
    )
    const player = new RuntimePlayer('layout-player', engine, moduleScene, undefined, undefined, undefined, undefined, [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
    ])

    expect(player.init().ok).toBe(true)
    expect(player.seek(100).ok).toBe(true)
    expect(events).toEqual(['move:layout-content'])
  })

  it('projects the initial scene, committed seeks, and destruction through the layout boundary', () => {
    const projectedTimes: number[] = []
    const projection = {
      project: (solved: SolvedScene) => projectedTimes.push(solved.timeMs),
      destroy: () => projectedTimes.push(-1),
    }
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer(
      'projection-player',
      engine,
      scene,
      undefined,
      undefined,
      undefined,
      undefined,
      [],
      projection,
    )

    expect(player.init().ok).toBe(true)
    expect(player.seek(100).ok).toBe(true)
    player.destroy()

    expect(projectedTimes).toEqual([0, 100, -1])
  })
})
