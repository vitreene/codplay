/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import {
  codplay,
  type CompiledScene,
  type Ticker,
} from '../../src'
import type { SceneDoc } from '../../src/scene/types'

const emptyRequirements: CompiledScene['requirements'] = {
  components: [],
  services: [],
  modules: [],
  resources: [],
}

/** Creates the smallest immutable compiled scene accepted by the public API. */
function scene(requirements = emptyRequirements): CompiledScene {
  return {
    schemaVersion: 'codplay.v2.scene.v1',
    createdAt: '2026-08-26T00:00:00.000Z',
    scene: { id: 'facade-scene', stories: {}, listen: [], tracks: {} },
    resources: { entries: [] },
    rootNodeIds: [],
    requirements,
    actionTargetIndex: {},
  }
}

/** Creates one instance on the public HTML/DOM path. */
function createInstance(
  engine: ReturnType<typeof codplay.engine.create>,
  instanceId = 'instance-a',
  compiledScene = scene(),
) {
  const root = document.createElement('div')
  return engine.instances.create({
    instanceId,
    compiledScene,
    durationMs: 1_000,
    root,
    mountTargets: [{ id: `${instanceId}:root`, kind: 'root', storyId: 'facade-scene' }],
  })
}

/** Declares one structural move used to verify facade-to-runner initialization. */
function motionSceneDoc(): SceneDoc {
  return {
    id: 'facade-motion-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section><div data-part="source"></div><div data-part="target"></div></section>',
          },
          actions: {},
        }, {
          id: 'item',
          type: 'tag',
          initial: { tag: 'article', move: { target: 'source' }, content: 'item' },
          actions: {
            transfer: { move: { target: 'target', transition: { duration: 100, ease: 'linear' } } },
          },
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: 100 }],
      },
    },
  }
}

type ManualTickHandler = Parameters<Ticker['start']>[0]
type ManualTickPayload = Parameters<ManualTickHandler>[0]

/** Creates a deterministic ticker that exposes the frames accepted by the facade engine. */
function createManualTicker(): Ticker & {
  emit: (nowMs: number) => void
  startCount: () => number
  stopCount: () => number
} {
  let handler: ManualTickHandler | undefined
  let previousMs = 0
  let running = false
  let starts = 0
  let stops = 0
  return {
    start(nextHandler) {
      handler = nextHandler
      running = true
      starts += 1
    },
    stop() {
      running = false
      stops += 1
    },
    isRunning: () => running,
    emit(nowMs) {
      if (!running) return
      const payload: ManualTickPayload = {
        prevMs: previousMs,
        nowMs,
        deltaMs: nowMs - previousMs,
        marginMs: 0,
      }
      previousMs = nowMs
      handler?.(payload)
    },
    startCount: () => starts,
    stopCount: () => stops,
  }
}

describe('CodPlay facade', () => {
  it('exposes compilation through the engine configured for the runtime', () => {
    const engine = codplay.engine.create()
    const result = engine.builder.compile({
      scene: {
        id: 'compiled-through-facade',
        stories: {
          main: { id: 'main', persos: [] },
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.scene.id).toBe('compiled-through-facade')
    expect(result.functions).toEqual({})
    expect(result.diagnostics.errors).toEqual([])
    engine.destroy()
  })

  it('uses the core layout component to publish every authored data-part', () => {
    const engine = codplay.engine.create()
    const build = engine.builder.compile({
      scene: {
        id: 'layout-parts-through-facade',
        stories: {
          main: {
            id: 'main',
            persos: [
              {
                id: 'layout',
                type: 'layout',
                initial: {
                  move: '@root',
                  markup: '<section><div data-part="custom-a"></div><div data-part="custom-b"></div></section>',
                },
                actions: {},
              },
              {
                id: 'child',
                type: 'tag',
                initial: {
                  tag: 'span',
                  move: { target: 'custom-b' },
                  content: 'child',
                },
                actions: {},
              },
            ],
          },
        },
      },
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    const root = document.createElement('div')
    engine.instances.create({
      instanceId: 'layout-instance',
      compiledScene: build.compiledScene,
      functions: build.functions,
      durationMs: 1_000,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: 'main' }],
    })

    const outlets = [...root.querySelectorAll('section > div')]
    expect(outlets).toHaveLength(2)
    expect(outlets[0]?.textContent).toBe('')
    expect(outlets[1]?.textContent).toBe('child')
    expect(root.querySelector('[data-part]')).toBeNull()
    engine.destroy()
  })

  it('routes instance telco seek through the HTML runner so FLIP moves are prepared', async () => {
    const engine = codplay.engine.create()
    const build = engine.builder.compile({ scene: motionSceneDoc() })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    const root = document.createElement('div')
    const instance = engine.instances.create({
      instanceId: 'motion-instance',
      compiledScene: build.compiledScene,
      functions: build.functions,
      durationMs: 1_000,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: 'main' }],
    })

    await instance.telco.seek(150)

    expect(root.querySelector('[data-codplay-motion-overlay]')).not.toBeNull()
    expect(root.querySelector('[data-codplay-motion-item="main:item"]')).not.toBeNull()
    engine.destroy()
  })

  it('groups instance playback under telco and keeps the engine clock external', async () => {
    const engine = codplay.engine.create()
    const instance = createInstance(engine)

    expect(instance.telco.getState()).toMatchObject({
      instanceId: 'instance-a',
      status: 'ready',
      timelineMs: 0,
      durationMs: 1_000,
    })

    engine.advance(0)
    await instance.telco.play()
    engine.advance(150)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 150, durationMs: 1_000 })

    await instance.telco.pause()
    engine.advance(300)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 150, durationMs: 1_000 })

    engine.destroy()
  })

  it('routes every telco command through one player and publishes its progress', async () => {
    const ticker = createManualTicker()
    const engine = codplay.engine.create({ ticker })
    const instance = createInstance(engine)
    const changes: string[] = []
    const progress: number[] = []
    const removeChangeListener = instance.telco.onChange((state) => {
      changes.push(`${state.status}:${state.timelineMs}`)
    })
    const removeProgressListener = instance.telco.onProgress((state) => {
      progress.push(state.timelineMs)
    })

    await instance.telco.play()
    expect(instance.telco.getState().status).toBe('playing')
    expect(ticker.startCount()).toBe(1)

    ticker.emit(100)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 100, durationMs: 1_000 })
    expect(progress).toContain(100)

    await instance.telco.togglePlay()
    expect(instance.telco.getState().status).toBe('paused')
    expect(ticker.stopCount()).toBe(1)
    const pausedProgressCount = progress.length
    ticker.emit(200)
    expect(instance.telco.getProgress().timelineMs).toBe(100)
    expect(progress).toHaveLength(pausedProgressCount)

    instance.telco.setRate(2)
    expect(instance.telco.rate).toBe(2)
    await instance.telco.togglePlay()
    expect(instance.telco.getState().status).toBe('playing')
    expect(ticker.startCount()).toBe(2)
    ticker.emit(200)
    ticker.emit(250)
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    await instance.telco.pause()
    await instance.telco.rewind()
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 0, durationMs: 1_000 })
    expect(changes.some((change) => change.startsWith('playing:'))).toBe(true)
    expect(changes.some((change) => change.startsWith('paused:'))).toBe(true)

    removeChangeListener()
    removeProgressListener()
    engine.destroy()
  })

  it('keeps an eventime in the single journal until the next normal tick', async () => {
    const engine = codplay.engine.create()
    const instance = createInstance(engine)
    const localEvents: string[] = []
    const engineEvents: string[] = []
    instance.events.onEvent((event) => localEvents.push(event.name))
    engine.events.onEvent((event) => engineEvents.push(event.name))

    await engine.events.emit({
      instanceId: 'instance-a',
      address: { scope: 'scene' },
      eventime: {
        name: 'public:root',
        visibility: 'public',
        events: [{ name: 'public:child', startAt: 25, visibility: 'public' }],
      },
    })
    expect(localEvents).toEqual([])

    engine.advance(0)
    await instance.telco.play()
    engine.advance(0)
    expect(localEvents).toEqual(['public:root'])
    expect(engineEvents).toEqual(['public:root'])

    engine.advance(100)
    expect(localEvents).toEqual(['public:root', 'public:child'])
    expect(engineEvents).toEqual(['public:root', 'public:child'])
    engine.destroy()
  })

  it('routes direct instance event injection through the normal next-tick path', async () => {
    const engine = codplay.engine.create()
    const instance = createInstance(engine)
    const events: string[] = []
    instance.events.onEvent((event) => events.push(event.name))

    engine.advance(0)
    await instance.events.emit(
      { name: 'public:direct', visibility: 'public' },
      { scope: 'scene' },
    )
    expect(events).toEqual([])

    await instance.telco.play()
    engine.advance(0)
    expect(events).toEqual(['public:direct'])
    engine.destroy()
  })

  it('wakes and suspends the CodPlay-owned clock from instance telco playback', async () => {
    let running = false
    const ticker = {
      start: () => { running = true },
      stop: () => { running = false },
      isRunning: () => running,
    }
    const engine = codplay.engine.create({ ticker })
    const instance = createInstance(engine)

    await instance.telco.play()
    expect(running).toBe(true)

    await instance.telco.pause()
    expect(running).toBe(false)

    engine.destroy()
  })

  it('keeps engine lifecycle controls distinct from instance playback state', async () => {
    const ticker = createManualTicker()
    const engine = codplay.engine.create({ ticker })
    const instance = createInstance(engine)

    await instance.telco.play()
    expect(instance.telco.getState().status).toBe('playing')
    expect(ticker.isRunning()).toBe(true)

    ticker.emit(100)
    expect(instance.telco.getProgress().timelineMs).toBe(100)

    engine.pause()
    expect(instance.telco.getState().status).toBe('playing')
    expect(instance.telco.getProgress().timelineMs).toBe(100)
    expect(ticker.isRunning()).toBe(false)

    ticker.emit(200)
    expect(instance.telco.getProgress().timelineMs).toBe(100)

    engine.start()
    expect(instance.telco.getState().status).toBe('playing')
    expect(ticker.isRunning()).toBe(true)

    ticker.emit(200)
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    engine.stop()
    expect(instance.telco.getState().status).toBe('playing')
    expect(instance.telco.getProgress().timelineMs).toBe(200)
    expect(ticker.isRunning()).toBe(false)

    engine.destroy()
  })

  it('requires explicit resource registration before instance initialization', () => {
    const diagnostics: string[] = []
    const engine = codplay.engine.create({
      diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
    })
    const resourceRequirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      resources: ['/movie.mp4'],
    }

    expect(() => createInstance(engine, 'missing-resource', scene(resourceRequirements))).toThrow()
    expect(diagnostics).toContain('RUNTIME_RESOURCE_UNAVAILABLE')

    engine.resources.register({
      loaded: ['/movie.mp4'],
      skipped: [],
      metadata: { '/movie.mp4': { type: 'video', durationMs: 1_000 } },
    })
    expect(createInstance(engine, 'ready-resource', scene(resourceRequirements))).toBeDefined()
    engine.destroy()
  })

  it('treats skipped preload resources as already available', () => {
    const diagnostics: string[] = []
    const engine = codplay.engine.create({
      diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      resources: {
        loaded: [],
        skipped: ['/movie.mp4'],
        metadata: {},
      },
    })
    const resourceRequirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      resources: ['/movie.mp4'],
    }

    expect(createInstance(engine, 'skipped-resource', scene(resourceRequirements))).toBeDefined()
    expect(diagnostics).not.toContain('RUNTIME_RESOURCE_UNAVAILABLE')
    engine.destroy()
  })

  it('keeps telco commands resolved when a diagnostic listener fails', async () => {
    const diagnostics: string[] = []
    const engine = codplay.engine.create({
      diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
    })
    const instance = createInstance(engine)
    instance.diagnostic.onDiagnostic(() => { throw new Error('observer failure') })

    await expect(instance.telco.seek(-1)).resolves.toBeUndefined()
    expect(diagnostics).toContain('TELCO_COMMAND_FAILED')
    engine.destroy()
  })

  it('creates preload through the public CodPlay namespace', async () => {
    const preload = codplay.preload.create({
      strategies: {
        fixture: async () => ({ type: 'fixture' }),
      },
    })
    const result = await preload.load({
      manifest: {
        entries: [{
          url: '/public-fixture',
          type: 'fixture',
          policy: { cache: 'default', priority: 'normal' },
        }],
      },
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        loaded: ['/public-fixture'],
        metadata: { '/public-fixture': { type: 'fixture' } },
      },
    })
    expect(preload.state.status).toBe('ready')
  })

  it('composes foreign modules once per instance and keeps them behind the facade', () => {
    let createdCount = 0
    let destroyedCount = 0
    const engine = codplay.engine.create({
      modules: {
        register: [{
          id: 'foreign-module',
          create: () => {
            createdCount += 1
            return { destroy: () => { destroyedCount += 1 } }
          },
        }],
      },
    })
    const requirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      modules: ['foreign-module'],
    }

    const instance = createInstance(engine, 'foreign-instance', scene(requirements))
    expect(instance).toBeDefined()
    expect(createdCount).toBe(1)

    engine.instances.destroy('foreign-instance')
    expect(destroyedCount).toBe(1)
    engine.destroy()
  })

  it('rejects concurrent owned and external clocks through diagnostics', () => {
    const diagnostics: string[] = []
    let running = false
    const ticker = {
      start: () => { running = true },
      stop: () => { running = false },
      isRunning: () => running,
    }
    const engine = codplay.engine.create({
      diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
    })

    engine.start(ticker)
    engine.advance(0)
    expect(diagnostics).toContain('CODPLAY_ENGINE_ADVANCE_FAILED')
    engine.stop()
    engine.destroy()
  })

  it('destroys each public instance once when the engine is destroyed', () => {
    const engine = codplay.engine.create()
    createInstance(engine, 'instance-a')
    createInstance(engine, 'instance-b')

    engine.destroy()

    expect(engine.instances.get('instance-a')).toBeUndefined()
    expect(engine.instances.get('instance-b')).toBeUndefined()
    expect(() => engine.destroy()).not.toThrow()
  })
})
