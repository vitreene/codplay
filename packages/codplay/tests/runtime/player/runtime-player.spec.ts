import { describe, expect, it } from 'vitest'

import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import {
  createMarkupModuleServiceDefinition,
  type MarkupModuleServiceInstance,
} from '../../../src/runtime/capabilities/markup'
import { createListModuleServiceDefinition } from '../../../src/runtime/capabilities/list'
import {
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
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
import type { CompiledFunctionCollection, CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-07-31T00:00:00.000Z',
  scene: { id: 'scene-a', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('RuntimePlayer', () => {
  it('journals every transformed event and replays them through seek without rerunning transforms', async () => {
    let transformCalls = 0
    const transformedScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            listen: [{ on: 'source:event', transform: [{ ref: 'fn:fanout' }] }],
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { className: 'idle' },
              actions: {
                'first:event': { className: { add: 'first' } },
                'second:event': { className: { add: 'second' } },
              },
            }],
          },
        },
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'transform-instance',
      engine,
      transformedScene,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      {
        'fn:fanout': () => {
          transformCalls += 1
          return [
            { name: 'first:event' },
            { name: 'second:event' },
          ]
        },
      },
    )

    expect(player.init().ok).toBe(true)
    const emitted = await player.emit({ name: 'source:event', storyId: 'main', applyAtMs: 10 })
    expect(emitted.ok).toBe(true)
    expect(player.seek(10).ok).toBe(true)
    expect(transformCalls).toBe(1)
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('first'),
    )
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('second'),
    )

    expect(player.seek(0).ok).toBe(true)
    expect(player.seek(10).ok).toBe(true)
    expect(transformCalls).toBe(1)
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('first'),
    )
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('second'),
    )
    player.destroy()
  })

  it('emits through the journal and seeks the same live result without rerunning straps', async () => {
    let strapCalls = 0
    const liveScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            straps: ['mark'],
            listen: [{ on: 'source:event', straps: ['mark'], emit: [{ name: 'done:event' }] }],
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { className: 'idle' },
              actions: {
                'source:event': { className: { add: 'source' } },
                'mark:event': { className: { add: 'marked' } },
                'done:event': { className: { add: 'done' } },
              },
            }],
          },
        },
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'live-instance',
      engine,
      liveScene,
      undefined,
      {
        scene: {},
        stories: {
          main: {
            mark: () => {
              strapCalls += 1
              return { events: [{ name: 'mark:event' }] }
            },
          },
        },
      },
    )

    expect(player.init().ok).toBe(true)
    const emitted = await player.emit({ name: 'source:event', storyId: 'main' })
    expect(emitted.ok).toBe(true)
    expect(strapCalls).toBe(1)
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('marked'),
    )
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('done'),
    )

    expect(player.seek(0).ok).toBe(true)
    expect(strapCalls).toBe(1)
    expect(player.getSolvedScene()?.persos['main:root']?.state.className).toEqual(
      expect.stringContaining('done'),
    )
    player.destroy()
  })

  it('evaluates compiled TweenAction through the same reconstruction for seek and play', () => {
    const tweenScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            listen: [],
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { style: { opacity: 0 } },
              actions: { run: { duration: 1000, fn: { ref: 'fn:opacity' } } },
            }],
            eventimes: [{ name: 'run', startAt: 0 }],
          },
        },
      },
    }
    const functions: CompiledFunctionCollection = {
      'fn:opacity': (input) => {
        const { progress } = input as { progress: number }
        return { style: { opacity: progress } }
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'tween-instance',
      engine,
      tweenScene,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      functions,
    )

    expect(player.init().ok).toBe(true)
    expect(player.seek(500).ok).toBe(true)
    expect(player.getSolvedScene()?.persos['main:root']?.state.style).toMatchObject({ opacity: 0.5 })

    player.seek(0)
    player.play()
    engine.advance(100)
    engine.advance(600)
    expect(player.getCurrentTimeMs()).toBe(500)
    expect(player.getSolvedScene()?.persos['main:root']?.state.style).toMatchObject({ opacity: 0.5 })
    player.destroy()
  })

  it('reuses the solved state after a time-dependent action has reached its endpoint', () => {
    let evaluations = 0
    const staticAfterTweenScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            listen: [],
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { style: { opacity: 0 } },
              actions: { run: { duration: 100, fn: { ref: 'fn:opacity' } } },
            }],
            eventimes: [{ name: 'run', startAt: 0 }],
          },
        },
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'static-after-tween-instance',
      engine,
      staticAfterTweenScene,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      undefined,
      {
        'fn:opacity': () => {
          evaluations += 1
          return { style: { opacity: 1 } }
        },
      },
    )

    expect(player.init().ok).toBe(true)
    player.play()
    engine.advance(0)
    engine.advance(100)
    const evaluationsAtEndpoint = evaluations
    engine.advance(200)
    engine.advance(300)

    expect(evaluationsAtEndpoint).toBeGreaterThan(0)
    expect(evaluations).toBe(evaluationsAtEndpoint)
    player.destroy()
  })

  it('reconstructs when an action sequence reaches an internal step boundary', () => {
    const sequenceScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            listen: [],
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { content: 'first' },
              actions: {
                run: [
                  { action: { content: 'first' }, durationMs: 100 },
                  { action: { content: 'second' } },
                ],
              },
            }],
            eventimes: [{ name: 'run', startAt: 0 }],
          },
        },
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('sequence-boundary-instance', engine, sequenceScene)

    expect(player.init().ok).toBe(true)
    player.play()
    engine.advance(0)
    engine.advance(150)

    expect(player.getSolvedScene()?.persos['main:root']?.state.content).toBe('second')
    player.destroy()
  })

  it('owns lifecycle and logical time without creating a clock', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('instance-a', engine, scene)

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
  })

  it('applies V1 sequence:end terminal cleanup for authored eventimes and replays from zero', () => {
    const lifecycleCalls: string[] = []
    const lifecycleOptionsAreCallable: boolean[] = []
    const terminalScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        id: 'terminal-scene',
        init: { ref: 'fn:init' },
        onStart: { ref: 'fn:start' },
        onSequenceEnd: { ref: 'fn:end' },
        stories: {
          main: {
            id: 'main',
            persos: [],
            listen: [],
            eventimes: [{ name: 'sequence:end', startAt: 100 }],
          },
        },
      },
    }
    const functions: CompiledFunctionCollection = {
      'fn:init': (...args) => {
        lifecycleCalls.push('init')
        lifecycleOptionsAreCallable.push(typeof (args[1] as { schedule: unknown }).schedule === 'function')
      },
      'fn:start': (...args) => {
        lifecycleCalls.push('start')
        lifecycleOptionsAreCallable.push(typeof (args[1] as { schedule: unknown }).schedule === 'function')
      },
      'fn:end': (...args) => {
        lifecycleCalls.push('end')
        lifecycleOptionsAreCallable.push(typeof (args[1] as { schedule: unknown }).schedule === 'function')
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('terminal-instance', engine, terminalScene, undefined, undefined, undefined, [], undefined, undefined, functions)

    expect(player.init().ok).toBe(true)
    expect(lifecycleCalls).toEqual(['init'])
    player.play()
    engine.advance(0)
    engine.advance(200)

    expect(player.getCurrentTimeMs()).toBe(100)
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(player.hasSequenceEnded()).toBe(true)
    expect(lifecycleCalls).toEqual(['init', 'start', 'end'])
    expect(lifecycleOptionsAreCallable).toEqual([true, true, true])
    expect(() => player.pause()).toThrow('PLAYER_SEQUENCE_ENDED')
    expect(player.seek(0).ok).toBe(false)

    player.play()
    expect(player.getCurrentTimeMs()).toBe(0)
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PLAYING)
    expect(player.hasSequenceEnded()).toBe(false)
    expect(lifecycleCalls).toEqual(['init', 'start', 'end', 'init', 'start'])
    player.destroy()
  })

  it('terminalizes an externally anchored sequence:end on the next playing frame', async () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('eventime-terminal-instance', engine, scene)

    expect(player.init().ok).toBe(true)
    player.play()
    engine.advance(0)
    await player.emitEventime({ name: 'sequence:end' }, { scope: 'scene' })
    engine.advance(100)

    expect(player.hasSequenceEnded()).toBe(true)
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(player.getCurrentTimeMs()).toBe(0)
    player.destroy()
  })

  it('does not terminalize sequence:end when seek only crosses its boundary', () => {
    const terminalScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [],
            listen: [],
            eventimes: [{ name: 'sequence:end', startAt: 100 }],
          },
        },
      },
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('seek-sequence-end-instance', engine, terminalScene)

    expect(player.init().ok).toBe(true)
    expect(player.seek(200).ok).toBe(true)
    expect(player.hasSequenceEnded()).toBe(false)
    player.play()

    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PLAYING)
    expect(player.hasSequenceEnded()).toBe(false)
    player.destroy()
  })

  it('does not initialize when the engine lacks a compiled requirement', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
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
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'instance-a',
      engine,
      { ...scene, scene: { ...scene.scene, straps: ['missing-scene-strap'] } },
      undefined,
      { scene: {}, stories: {} },
    )

    const result = player.init()

    expect(result.ok).toBe(true)
    expect(result.diagnostics.warnings.map((entry) => entry.code)).toEqual(['AUTHOR_SCENE_STRAP_MISSING'])
  })

  it('resets the instance delta baseline after pause/resume', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
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
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const ticks: Array<{ nowMs: number; deltaMs: number; timelineMs: number }> = []
    const seeks: Array<{ nowMs: number; timelineMs: number }> = []
    const adapter: RenderAdapter = {
      tick: ({ nowMs, deltaMs, timelineMs }) => ticks.push({ nowMs, deltaMs, timelineMs }),
      seek: ({ nowMs, timelineMs }) => seeks.push({ nowMs, timelineMs }),
    }
    const player = new RuntimePlayer('instance-a', engine, scene, new RenderSync([adapter]))

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
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const firstTimes: number[] = []
    const secondTimes: number[] = []
    const first = new RuntimePlayer('first', engine, scene, undefined, undefined, undefined, [], {
      id: 'test:first',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: (solved) => firstTimes.push(solved.timeMs),
    })
    const second = new RuntimePlayer('second', engine, scene, undefined, undefined, undefined, [], {
      id: 'test:second',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: (solved) => secondTimes.push(solved.timeMs),
    })

    first.init()
    second.init()
    const result = engine.seek([
      { instanceId: 'first', timeMs: 3000 },
      { instanceId: 'second', timeMs: 2000 },
    ])

    expect(result.ok).toBe(true)
    expect(Object.keys(result.diagnostics)).toEqual(['first', 'second'])
    expect(firstTimes.at(-1)).toBe(3000)
    expect(secondTimes.at(-1)).toBe(2000)
  })

  it('returns structured diagnostics from a seek reconstruction', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
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
               actions: { invalid: { move: { target: 42 } } },
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
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer('instance-a', engine, scene)

    const result = player.seek(100)

    expect(result).toMatchObject({ ok: false, timeMs: 100 })
    expect(result.diagnostics.errors[0]?.code).toBe('RUNTIME_SEEK_FAILED')
  })

  it('restores the presented scene when materialization fails during seek', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const materializedTimes: number[] = []
    let failAtTarget = true
    const player = new RuntimePlayer(
      'instance-a',
      engine,
      scene,
      undefined,
      undefined,
      undefined,
      [],
      {
        id: 'test:materializer',
        context: {},
        materializeComponent: () => ({ destroy: () => undefined }),
        materializeScene: (solved) => {
          materializedTimes.push(solved.timeMs)
          if (failAtTarget && solved.timeMs === 100) throw new Error('materialization failed')
        },
      },
    )

    expect(player.init().ok).toBe(true)
    const failed = player.seek(100)

    expect(failed.ok).toBe(false)
    expect(player.getCurrentTimeMs()).toBe(0)
    expect(player.getSolvedScene()?.timeMs).toBe(0)
    expect(materializedTimes).toEqual([0, 100, 0])

    failAtTarget = false
    expect(player.seek(100).ok).toBe(true)
    expect(player.getCurrentTimeMs()).toBe(100)
    player.destroy()
  })

  it('aggregates seek diagnostics by instance at the engine boundary', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const invalidScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
             persos: [{ id: 'item', type: 'tag', initial: {}, actions: { invalid: { move: { target: 42 } } } }],
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
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerModule({
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
    const engine = new RuntimeEngine(catalog)
    const moduleScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'item', type: 'tag', initial: { move: '@root' }, actions: {
               transfer: { move: { target: 'outlet' } },
            } }],
            listen: [],
            eventimes: [{ name: 'transfer', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['probe'] },
    }
    const player = new RuntimePlayer('module-player', engine, moduleScene, undefined, undefined, undefined, [
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
    const catalog = new RuntimeCapabilityCatalog()
    const markupDefinition = createMarkupModuleServiceDefinition()
    catalog.registerModule({
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
               actions: { attach: { move: { target: 'layout-content' } } },
            }],
            listen: [],
            eventimes: [{ name: 'attach', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['markup'] },
    }
    const engine = new RuntimeEngine(catalog)
    const player = new RuntimePlayer('layout-player', engine, moduleScene, undefined, undefined, undefined, [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
    ])

    expect(player.init().ok).toBe(true)
    expect(player.seek(100).ok).toBe(true)
    expect(events).toEqual(['move:layout-content'])
  })

  it('materializes the initial scene, committed seeks, and destruction through one boundary', () => {
    const materializedTimes: number[] = []
    const materializer = {
      id: 'test',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: (solved: SolvedScene) => materializedTimes.push(solved.timeMs),
      destroy: () => materializedTimes.push(-1),
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'materializer-player',
      engine,
      scene,
      undefined,
      undefined,
      undefined,
      [],
      materializer,
    )

    expect(player.init().ok).toBe(true)
    expect(player.seek(100).ok).toBe(true)
    player.destroy()

    expect(materializedTimes).toEqual([0, 100, -1])
  })

  it('resolves list order from the same structural timeline used by materialization', () => {
    const events: Array<Readonly<{ timeMs: number; order?: readonly string[] }>> = []
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerModule(createListModuleServiceDefinition())
    const listScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [
              { id: 'list', type: 'list', initial: { move: '@root' }, actions: {} },
              { id: 'first', type: 'tag', initial: { move: { target: 'list' } }, actions: {
                moveLast: { move: { target: 'list', mode: 'last' } },
              } },
              { id: 'second', type: 'tag', initial: { move: { target: 'list' } }, actions: {} },
            ],
            listen: [],
            eventimes: [{ name: 'moveLast', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['list'] },
    }
    const engine = new RuntimeEngine(catalog)
    const materializer = {
      id: 'test',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: (solved: SolvedScene) => {
        events.push({
          timeMs: solved.timeMs,
          order: solved.graph.childrenByTarget.list,
        })
      },
    }
    const player = new RuntimePlayer('list-player', engine, listScene, undefined, undefined, undefined, [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
    ], materializer)

    expect(player.init().ok).toBe(true)
    expect(player.seek(100).ok).toBe(true)

    expect(events[1]).toEqual({
      timeMs: 100,
      order: ['main:second', 'main:first'],
    })
  })

  it('resolves historical list order directly from the structural timeline', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerModule(createListModuleServiceDefinition())
    const listScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [
              { id: 'list', type: 'list', initial: { move: '@root' }, actions: {} },
              { id: 'first', type: 'tag', initial: { move: { target: 'list' } }, actions: {
                moveLast: { move: { target: 'list', mode: 'last' } },
              } },
              { id: 'second', type: 'tag', initial: { move: { target: 'list' } }, actions: {} },
            ],
            listen: [],
            eventimes: [{ name: 'moveLast', startAt: 100 }],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['list'] },
    }
    const engine = new RuntimeEngine(catalog)
    const player = new RuntimePlayer('historical-list-player', engine, listScene, undefined, undefined, undefined, [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
    ])

    expect(player.init().ok).toBe(true)
    expect(player.resolveSceneAt(100).graph.childrenByTarget.list).toEqual(['main:second', 'main:first'])
    expect(player.resolveSceneAt(0).graph.childrenByTarget.list).toEqual(['main:first', 'main:second'])
    player.destroy()
  })

  it('ports the V1 automatic reorder policies while keeping explicit modes effective', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerModule(createListModuleServiceDefinition())
    const listScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            persos: [
              {
                id: 'list',
                type: 'list',
                initial: {
                  move: '@root',
                  config: { reorderOnMove: false, reorderOnAdd: false, reorderOnRemove: false },
                },
                actions: {},
              },
              {
                id: 'first',
                type: 'tag',
                initial: { move: { target: 'list' } },
                actions: {
                  moveAuto: { move: { target: 'list' } },
                },
              },
              {
                id: 'second',
                type: 'tag',
                initial: { move: { target: 'list' } },
                actions: {
                  moveSecondFirst: { move: { target: 'list', mode: 'first' } },
                },
              },
              {
                id: 'third',
                type: 'tag',
                initial: { move: { target: 'list' } },
                actions: {
                  moveFirst: { move: { target: 'list', mode: 'first' } },
                },
              },
            ],
            listen: [],
            eventimes: [
              { name: 'moveAuto', startAt: 100 },
              { name: 'moveFirst', startAt: 200 },
              { name: 'moveSecondFirst', startAt: 300 },
            ],
          },
        },
      },
      requirements: { ...scene.requirements, modules: ['list'] },
    }
    const player = new RuntimePlayer(
      'list-policy-player',
      new RuntimeEngine(catalog),
      listScene,
      undefined,
      undefined,
      undefined,
      [{ id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' }],
    )

    expect(player.init().ok).toBe(true)
    expect(player.resolveSceneAt(0).graph.childrenByTarget.list).toEqual([
      'main:first',
      'main:second',
      'main:third',
    ])
    expect(player.resolveSceneAt(100).graph.childrenByTarget.list).toEqual([
      'main:first',
      'main:second',
      'main:third',
    ])
    expect(player.resolveSceneAt(200).graph.childrenByTarget.list).toEqual([
      'main:third',
      'main:first',
      'main:second',
    ])
    expect(player.resolveSceneAt(300).graph.childrenByTarget.list).toEqual([
      'main:third',
      'main:second',
      'main:first',
    ])
    player.destroy()
  })
})
