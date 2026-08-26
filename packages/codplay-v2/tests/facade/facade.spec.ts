/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import {
  codplay,
  type CompiledScene,
} from '../../src'

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

describe('CodPlay facade', () => {
  it('groups instance playback under telco and keeps the engine clock external', async () => {
    const engine = codplay.engine.create()
    const instance = createInstance(engine)

    expect(instance.telco.getState()).toMatchObject({
      instanceId: 'instance-a',
      status: 'ready',
      timelineMs: 0,
      durationMs: 1_000,
    })

    await instance.telco.play()
    engine.advance(0)
    engine.advance(150)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 150, durationMs: 1_000 })

    await instance.telco.pause()
    engine.advance(300)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 150, durationMs: 1_000 })

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

    await instance.telco.play()
    engine.advance(0)
    expect(localEvents).toEqual(['public:root'])
    expect(engineEvents).toEqual(['public:root'])

    engine.advance(100)
    expect(localEvents).toEqual(['public:root', 'public:child'])
    expect(engineEvents).toEqual(['public:root', 'public:child'])
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

  it('does not treat skipped preload resources as available', () => {
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

    expect(() => createInstance(engine, 'skipped-resource', scene(resourceRequirements))).toThrow()
    expect(diagnostics).toContain('RUNTIME_RESOURCE_UNAVAILABLE')
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
