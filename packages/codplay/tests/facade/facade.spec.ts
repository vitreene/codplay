/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import {
  CodPlay,
  type CodPlayFrameScheduler,
  type CodPlayInstances,
  type CodPlayInstance,
  type CodPlayOptions,
  type CompiledScene,
} from '../../src'
import * as publicApi from '../../src'
import { BaseHTMLComponent } from '../../src/runtime/components'
import type {
  ComponentUpdateInput,
  HTMLComponentInput,
} from '../../src/runtime/components'
import type {
  RuntimeComponentDefinition,
  RuntimeComponentServiceDefinition,
  RuntimeModuleServiceDefinition,
} from '../../src/runtime/catalog'
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
  instances: CodPlayInstances,
  instanceId = 'instance-a',
  compiledScene = scene(),
): CodPlayInstance {
  const root = document.createElement('div')
  return instances.create({
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

/** Creates a scheduler spy that remains behind the public CodPlay boundary. */
function createManualFrameScheduler(): CodPlayFrameScheduler & {
  requestCount: () => number
  cancelCount: () => number
} {
  let nextRequestId = 1
  let requests = 0
  let cancels = 0
  const pending = new Map<number, () => void>()
  return {
    request(callback) {
      const requestId = nextRequestId
      nextRequestId += 1
      requests += 1
      pending.set(requestId, callback)
      return requestId
    },
    cancel(requestId) {
      if (pending.delete(requestId)) cancels += 1
    },
    requestCount: () => requests,
    cancelCount: () => cancels,
  }
}

/** Creates one public CodPlay owner for facade tests. */
function createCodPlay(options: CodPlayOptions = {}): CodPlay {
  return new CodPlay(options)
}

/** Component used to prove that direct facade definitions reach the HTML runtime. */
class RegistryComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = ['registry-service'] as const

  constructor(input: HTMLComponentInput<Record<string, unknown>>) {
    super(input)
    this.services.declare(RegistryComponent.declaredServices)
  }

  render(): string {
    return '<div data-registry-component="registered"></div>'
  }

  update(_input: ComponentUpdateInput): void {
    this.services.get('registry-service').apply(this.node, true)
  }
}

/** Replacement component used to prove that the direct override is selected at runtime. */
class OverriddenRegistryComponent extends RegistryComponent {
  render(): string {
    return '<div data-registry-component="overridden"></div>'
  }
}

/** Creates one component definition with a player module dependency. */
function registryComponentDefinition(
  component: RuntimeComponentDefinition['component'],
): RuntimeComponentDefinition {
  return {
    type: 'registry-component',
    component,
    modules: ['registry-module'],
    validateInitial: () => undefined,
  }
}

/** Creates one service definition whose adapter leaves a visible runtime marker. */
function registryServiceDefinition(marker: string): RuntimeComponentServiceDefinition {
  return {
    name: 'registry-service',
    materializers: ['html'],
    create: () => ({
      apply: (node) => {
        if (node instanceof HTMLElement) node.dataset.registryService = marker
      },
    }),
  }
}

/** Creates one module definition whose construction count identifies the selected override. */
function registryModuleDefinition(onCreate: () => void): RuntimeModuleServiceDefinition {
  return {
    id: 'registry-module',
    create: () => {
      onCreate()
      return { destroy: () => undefined }
    },
  }
}

/** Scene requiring all three definitions registered through the public facade. */
function registrySceneDoc(): SceneDoc {
  return {
    id: 'registry-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'registry-component',
          initial: { move: '@root' },
          actions: {},
        }],
      },
    },
  }
}

describe('CodPlay facade', () => {
  it('keeps runtime implementation details outside the public entry point', () => {
    expect(publicApi.CodPlay).toBeDefined()
    expect(publicApi).not.toHaveProperty('codplay')
    expect(publicApi).not.toHaveProperty('TimeTicker')
    expect(publicApi).not.toHaveProperty('EngineFacadeImpl')
    expect(publicApi).not.toHaveProperty('InstanceFacadeImpl')

    const codplay = createCodPlay()
    expect(codplay.engine).not.toHaveProperty('builder')
    expect(codplay.engine).not.toHaveProperty('events')
    expect(codplay.engine).not.toHaveProperty('resources')
    expect(codplay.engine).not.toHaveProperty('destroy')
    codplay.destroy()
  })

  it('registers and overrides components, services, and modules through one public catalog', () => {
    const diagnostics: string[] = []
    let registeredModuleCreates = 0
    let overriddenModuleCreates = 0
    const codplay = createCodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
    })

    expect(codplay.services.register(registryServiceDefinition('registered'))).toEqual({
      ok: true,
      status: 'registered',
    })
    expect(codplay.modules.register(registryModuleDefinition(() => { registeredModuleCreates += 1 }))).toEqual({
      ok: true,
      status: 'registered',
    })
    expect(codplay.components.register(registryComponentDefinition(RegistryComponent))).toEqual({
      ok: true,
      status: 'registered',
    })

    expect(codplay.services.override(registryServiceDefinition('overridden'))).toEqual({
      ok: true,
      status: 'overridden',
    })
    expect(codplay.modules.override(registryModuleDefinition(() => { overriddenModuleCreates += 1 }))).toEqual({
      ok: true,
      status: 'overridden',
    })
    expect(codplay.components.override(registryComponentDefinition(OverriddenRegistryComponent))).toEqual({
      ok: true,
      status: 'overridden',
    })

    const build = codplay.build({ scene: registrySceneDoc() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const root = document.createElement('div')
    codplay.instances.create({
      instanceId: 'registry-instance',
      compiledScene: build.compiledScene,
      functions: build.functions,
      durationMs: 1_000,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: 'main' }],
    })

    expect(root.querySelector('[data-registry-component="registered"]')).toBeNull()
    expect(root.querySelector('[data-registry-component="overridden"]')).not.toBeNull()
    expect(root.querySelector('[data-registry-service="overridden"]')).not.toBeNull()
    expect(registeredModuleCreates).toBe(0)
    expect(overriddenModuleCreates).toBe(1)

    const lateRegistration = codplay.modules.register(registryModuleDefinition(() => undefined))
    expect(lateRegistration.ok).toBe(false)
    if (!lateRegistration.ok) {
      expect(lateRegistration.error.message).toContain('locked')
    }
    expect(diagnostics).toContain('CODPLAY_MODULE_REGISTER_FAILED')
    codplay.destroy()
  })

  it('exposes compilation through the engine configured for the runtime', () => {
    const codplay = createCodPlay()
    const result = codplay.build({
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
    codplay.destroy()
  })

  it('uses the core layout component to publish every authored data-part', () => {
    const codplay = createCodPlay()
    const build = codplay.build({
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
    codplay.instances.create({
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
    codplay.destroy()
  })

  it('routes instance telco seek through the HTML runner so FLIP moves are prepared', async () => {
    const codplay = createCodPlay()
    const build = codplay.build({ scene: motionSceneDoc() })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    const root = document.createElement('div')
    const instance = codplay.instances.create({
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
    codplay.destroy()
  })

  it('groups instance playback under telco and keeps the engine clock external', async () => {
    const codplay = createCodPlay()
    const engine = codplay.engine
    const instance = createInstance(codplay.instances)

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

    codplay.destroy()
  })

  it('routes every telco command through one player and publishes its progress', async () => {
    const codplay = createCodPlay()
    const engine = codplay.engine
    const instance = createInstance(codplay.instances)
    const changes: string[] = []
    const progress: number[] = []
    const removeChangeListener = instance.telco.onChange((state) => {
      changes.push(`${state.status}:${state.timelineMs}`)
    })
    const removeProgressListener = instance.telco.onProgress((state) => {
      progress.push(state.timelineMs)
    })

    engine.advance(0)
    await instance.telco.play()
    expect(instance.telco.getState().status).toBe('playing')

    engine.advance(100)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 100, durationMs: 1_000 })
    expect(progress).toContain(100)

    await instance.telco.togglePlay()
    expect(instance.telco.getState().status).toBe('paused')
    const pausedProgressCount = progress.length
    engine.advance(200)
    expect(instance.telco.getProgress().timelineMs).toBe(100)
    expect(progress).toHaveLength(pausedProgressCount)

    instance.telco.setRate(2)
    expect(instance.telco.rate).toBe(2)
    await instance.telco.togglePlay()
    expect(instance.telco.getState().status).toBe('playing')
    engine.advance(200)
    engine.advance(250)
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    await instance.telco.pause()
    await instance.telco.rewind()
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 0, durationMs: 1_000 })
    expect(changes.some((change) => change.startsWith('playing:'))).toBe(true)
    expect(changes.some((change) => change.startsWith('paused:'))).toBe(true)

    removeChangeListener()
    removeProgressListener()
    codplay.destroy()
  })

  it('keeps an eventime in the single journal until the next normal tick', async () => {
    const codplay = createCodPlay()
    const engine = codplay.engine
    const instance = createInstance(codplay.instances)
    const localEvents: string[] = []
    const engineEvents: string[] = []
    instance.events.onEvent((event) => localEvents.push(event.name))
    codplay.events.onEvent((event) => engineEvents.push(event.name))

    await codplay.events.emit({
      instanceId: 'instance-a',
      target: { scope: 'scene' },
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
    codplay.destroy()
  })

  it('routes direct instance event injection through the normal next-tick path', async () => {
    const codplay = createCodPlay()
    const engine = codplay.engine
    const instance = createInstance(codplay.instances)
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
    codplay.destroy()
  })

  it('wakes and suspends the CodPlay-owned clock from instance telco playback', async () => {
    const scheduler = createManualFrameScheduler()
    const codplay = new CodPlay({
      frameScheduler: scheduler,
      pauseOnDocumentHidden: false,
    })
    const instance = createInstance(codplay.instances)

    await instance.telco.play()
    expect(scheduler.requestCount()).toBe(1)

    await instance.telco.pause()
    expect(scheduler.cancelCount()).toBe(1)

    codplay.destroy()
  })

  it('keeps engine lifecycle controls distinct from instance playback state', async () => {
    const codplay = createCodPlay()
    const engine = codplay.engine
    const instance = createInstance(codplay.instances)

    engine.advance(0)
    await instance.telco.play()
    expect(instance.telco.getState().status).toBe('playing')

    engine.advance(100)
    expect(instance.telco.getProgress().timelineMs).toBe(100)

    engine.pause()
    expect(instance.telco.getState().status).toBe('playing')
    expect(instance.telco.getProgress().timelineMs).toBe(100)

    engine.advance(200)
    expect(instance.telco.getProgress().timelineMs).toBe(100)

    engine.start()
    expect(instance.telco.getState().status).toBe('playing')

    engine.advance(300)
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    engine.stop()
    expect(instance.telco.getState().status).toBe('playing')
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    engine.advance(400)
    expect(instance.telco.getProgress().timelineMs).toBe(200)

    codplay.destroy()
  })

  it('requires explicit resource registration before instance initialization', () => {
    const diagnostics: string[] = []
    const codplay = createCodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
    })
    const resourceRequirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      resources: ['/movie.mp4'],
    }

    expect(() => createInstance(codplay.instances, 'missing-resource', scene(resourceRequirements))).toThrow()
    expect(diagnostics).toContain('RUNTIME_RESOURCE_UNAVAILABLE')

    codplay.resources.register({
      loaded: ['/movie.mp4'],
      skipped: [],
      metadata: { '/movie.mp4': { type: 'video', durationMs: 1_000 } },
    })
    expect(createInstance(codplay.instances, 'ready-resource', scene(resourceRequirements))).toBeDefined()
    codplay.destroy()
  })

  it('treats skipped preload resources as already available', () => {
    const diagnostics: string[] = []
    const codplay = createCodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
        resources: {
          loaded: [],
          skipped: ['/movie.mp4'],
          metadata: {},
        },
      },
    })
    const resourceRequirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      resources: ['/movie.mp4'],
    }

    expect(createInstance(codplay.instances, 'skipped-resource', scene(resourceRequirements))).toBeDefined()
    expect(diagnostics).not.toContain('RUNTIME_RESOURCE_UNAVAILABLE')
    codplay.destroy()
  })

  it('keeps telco commands resolved when a diagnostic listener fails', async () => {
    const diagnostics: string[] = []
    const codplay = createCodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
    })
    const instance = createInstance(codplay.instances)
    instance.diagnostic.onDiagnostic(() => { throw new Error('observer failure') })

    await expect(instance.telco.seek(-1)).resolves.toBeUndefined()
    expect(diagnostics).toContain('TELCO_COMMAND_FAILED')
    codplay.destroy()
  })

  it('creates preload through the public CodPlay owner', async () => {
    const codplay = new CodPlay({
      preload: {
        strategies: {
          fixture: async () => ({ type: 'fixture' }),
        },
      },
    })
    const preload = codplay.preload
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
    codplay.destroy()
  })

  it('composes foreign modules once per instance and keeps them behind the facade', () => {
    let createdCount = 0
    let destroyedCount = 0
    const codplay = createCodPlay({
      engine: {
        modules: {
          register: [{
            id: 'foreign-module',
            create: () => {
              createdCount += 1
              return { destroy: () => { destroyedCount += 1 } }
            },
          }],
        },
      },
    })
    const requirements: CompiledScene['requirements'] = {
      ...emptyRequirements,
      modules: ['foreign-module'],
    }

    const instance = createInstance(codplay.instances, 'foreign-instance', scene(requirements))
    expect(instance).toBeDefined()
    expect(createdCount).toBe(1)

    codplay.instances.destroy('foreign-instance')
    expect(destroyedCount).toBe(1)
    codplay.destroy()
  })

  it('rejects concurrent owned and external clocks through diagnostics', () => {
    const diagnostics: string[] = []
    const scheduler = createManualFrameScheduler()
    const codplay = createCodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
      frameScheduler: scheduler,
      pauseOnDocumentHidden: false,
    })
    const engine = codplay.engine

    engine.start()
    engine.advance(0)
    expect(diagnostics).toContain('CODPLAY_ENGINE_ADVANCE_FAILED')
    engine.stop()
    codplay.destroy()
  })

  it('destroys each public instance once when the CodPlay owner is destroyed', () => {
    const codplay = createCodPlay()
    codplay.instances.create({
      instanceId: 'instance-a',
      compiledScene: scene(),
      durationMs: 1_000,
      root: document.createElement('div'),
      mountTargets: [{ id: 'root-host-a', kind: 'root', storyId: 'facade-scene' }],
    })
    codplay.instances.create({
      instanceId: 'instance-b',
      compiledScene: scene(),
      durationMs: 1_000,
      root: document.createElement('div'),
      mountTargets: [{ id: 'root-host-b', kind: 'root', storyId: 'facade-scene' }],
    })

    codplay.destroy()

    expect(codplay.instances.get('instance-a')).toBeUndefined()
    expect(codplay.instances.get('instance-b')).toBeUndefined()
    expect(() => codplay.destroy()).not.toThrow()
  })
})
