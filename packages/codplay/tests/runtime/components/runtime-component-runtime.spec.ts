import { describe, expect, it } from 'vitest'
import {
  BaseComponent,
  BaseHTMLComponent,
  RuntimeComponentRuntime,
} from '../../../src/runtime/components'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import type {
  ComponentAnimation,
  ComponentInput,
  ComponentUpdateInput,
  MediaComponentSurface,
} from '../../../src/runtime/components'
import type { RuntimeMaterializer } from '../../../src/runtime/materializer'
import type { CompiledRecord } from '../../../src/scene/compiled'
import type { SolvedScene } from '../../../src/runtime/player'
import { buildSolvedGraph } from '../../../src/runtime/player'
import {
  MOUNT_PLACEMENT_OFF,
  MOUNT_PLACEMENT_ROOT,
} from '../../../src/runtime/config/mount-placement'

class TestComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const
  static readonly instances: TestComponent[] = []
  readonly updates: number[] = []

  constructor(input: ComponentInput<Record<string, unknown>>) {
    super(input)
    TestComponent.instances.push(this)
  }

  render(): string {
    return '<section></section>'
  }

  update(input: ComponentUpdateInput): void {
    this.updates.push(input.timeMs)
  }
}

class AnimatedComponent extends BaseHTMLComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const
  static readonly instances: AnimatedComponent[] = []
  readonly updates: number[] = []
  readonly frames: number[] = []

  constructor(input: ComponentInput<Record<string, unknown>>) {
    super(input)
    AnimatedComponent.instances.push(this)
  }

  render(): string {
    return '<section></section>'
  }

  update(input: ComponentUpdateInput): void {
    this.updates.push(input.timeMs)
    if (input.state.animate !== true || input.registerAnimation === undefined) return
    const animation: ComponentAnimation = {
      id: 'test-animation',
      startAt: 0,
      endAt: 100,
      sample: (timeMs) => {
        const value = Math.min(100, Math.max(0, timeMs))
        return {
          value,
          apply: () => this.frames.push(value),
        }
      },
    }
    input.registerAnimation(animation)
  }
}

class TargetHostComponent extends BaseComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const

  update(_input: ComponentUpdateInput): void {}
}

class InitializedTargetHostComponent extends BaseComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const
  readonly target = { kind: 'initialized-target' }
  initialized = false

  initialize(): void {
    this.initialized = true
  }

  update(_input: ComponentUpdateInput): void {}
}

class TargetConsumerComponent extends BaseComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const
  static readonly instances: TargetConsumerComponent[] = []
  readonly receivedTargets: unknown[] = []

  constructor(input: ComponentInput<Record<string, unknown>>) {
    super(input)
    TargetConsumerComponent.instances.push(this)
  }

  update(input: ComponentUpdateInput): void {
    this.receivedTargets.push(input.target)
  }
}

class PresentationOrderComponent extends BaseComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const
  static readonly applied: string[] = []

  update(input: ComponentUpdateInput): void {
    input.registerAnimation?.({
      id: this.perso.id,
      startAt: 0,
      endAt: Number.MAX_SAFE_INTEGER,
      presentationPhase: this.perso.id === 'host' ? 'commit' : 'content',
      sample: (timeMs) => ({
        value: timeMs,
        apply: () => PresentationOrderComponent.applied.push(this.perso.id),
      }),
    })
  }
}

function solvedScene(
  timeMs: number,
  includePerso = true,
  state: CompiledRecord = {},
  type = 'test',
): SolvedScene {
  return {
    scene: {
      scene: {
        id: 'scene',
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'item', type, initial: {}, actions: {} }],
            listen: [],
          },
        },
        listen: [],
        tracks: {},
      },
    } as unknown as SolvedScene['scene'],
    timeMs,
    sceneState: {},
    storyStates: {},
    persos: includePerso ? {
      'main:item': {
        key: 'main:item',
        storyId: 'main',
        persoId: 'item',
        type,
        state,
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    } : {},
    graph: buildSolvedGraph(includePerso ? {
      'main:item': {
        key: 'main:item',
        storyId: 'main',
        persoId: 'item',
        type,
        state,
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    } : {}),
    moveIssues: [],
  }
}

function solvedTargetScene(hostMounted: boolean): SolvedScene {
  const persos = {
    // The consumer deliberately precedes its host in the solved record.
    'main:consumer': {
      key: 'main:consumer',
      storyId: 'main',
      persoId: 'consumer',
      type: 'target-consumer',
      state: {},
      placement: { kind: 'unspecified' as const, mounted: false },
      moveIssues: [],
    },
    'main:host': {
      key: 'main:host',
      storyId: 'main',
      persoId: 'host',
      type: 'target-host',
      state: {},
      placement: hostMounted
        ? {
            kind: MOUNT_PLACEMENT_ROOT,
            mounted: true,
            targetId: 'root',
            target: { id: 'root', kind: 'root' as const, storyId: 'main' },
          }
        : { kind: MOUNT_PLACEMENT_OFF, mounted: false },
      moveIssues: [],
    },
  }

  return {
    scene: {
      scene: {
        id: 'scene',
        stories: {
          main: {
            id: 'main',
            // The compiled order also puts the consumer before the host.
            persos: [
              {
                id: 'consumer',
                type: 'target-consumer',
                initial: {},
                rel: { host: 'host' },
                actions: {},
              },
              {
                id: 'host',
                type: 'target-host',
                initial: {},
                actions: {},
              },
            ],
            listen: [],
          },
        },
        listen: [],
        tracks: {},
      },
    } as unknown as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos,
    graph: buildSolvedGraph(persos),
    moveIssues: [],
  }
}

function solvedPublishedTargetScene(): SolvedScene {
  const persos = {
    'main:consumer': {
      key: 'main:consumer',
      storyId: 'main',
      persoId: 'consumer',
      type: 'target-consumer',
      state: {},
      placement: { kind: MOUNT_PLACEMENT_OFF, mounted: false },
      moveIssues: [],
    },
    'main:target': {
      key: 'main:target',
      storyId: 'main',
      persoId: 'target',
      type: 'target-object',
      state: {},
      placement: {
        kind: MOUNT_PLACEMENT_ROOT,
        mounted: true,
        targetId: 'root',
        target: { id: 'root', kind: 'root' as const, storyId: 'main' },
      },
      moveIssues: [],
    },
    'main:host': {
      key: 'main:host',
      storyId: 'main',
      persoId: 'host',
      type: 'target-host',
      state: {},
      placement: {
        kind: MOUNT_PLACEMENT_ROOT,
        mounted: true,
        targetId: 'root',
        target: { id: 'root', kind: 'root' as const, storyId: 'main' },
      },
      moveIssues: [],
    },
  }

  return {
    scene: {
      scene: {
        id: 'scene',
        stories: {
          main: {
            id: 'main',
            persos: [
              {
                id: 'consumer',
                type: 'target-consumer',
                initial: {},
                rel: { host: 'host', target: 'target' },
                actions: {},
              },
              {
                id: 'target',
                type: 'target-object',
                initial: {},
                rel: { host: 'host' },
                actions: {},
              },
              {
                id: 'host',
                type: 'target-host',
                initial: {},
                actions: {},
              },
            ],
            listen: [],
          },
        },
        listen: [],
        tracks: {},
      },
    } as unknown as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos,
    graph: buildSolvedGraph(persos),
    moveIssues: [],
  }
}

function solvedAttachedTargetScene(): SolvedScene {
  const scene = solvedTargetScene(false)
  const host = scene.persos['main:host']!
  const persos = {
    ...scene.persos,
    'main:host': {
      ...host,
      placement: { kind: 'unspecified' as const, mounted: false },
    },
  }
  return {
    ...scene,
    persos,
    graph: buildSolvedGraph(persos),
  }
}

function solvedPresentationOrderScene(): SolvedScene {
  const persos = {
    'main:host': {
      key: 'main:host',
      storyId: 'main',
      persoId: 'host',
      type: 'presentation-order',
      state: {},
      placement: { kind: 'unspecified' as const, mounted: false },
      moveIssues: [],
    },
    'main:grid': {
      key: 'main:grid',
      storyId: 'main',
      persoId: 'grid',
      type: 'presentation-order',
      state: {},
      placement: { kind: 'unspecified' as const, mounted: false },
      moveIssues: [],
    },
  }

  return {
    scene: {
      scene: {
        id: 'scene',
        stories: {
          main: {
            id: 'main',
            persos: [
              { id: 'host', type: 'presentation-order', initial: {}, actions: {} },
              { id: 'grid', type: 'presentation-order', initial: {}, actions: {} },
            ],
            listen: [],
          },
        },
        listen: [],
        tracks: {},
      },
    } as unknown as SolvedScene['scene'],
    timeMs: 0,
    sceneState: {},
    storyStates: {},
    persos,
    graph: buildSolvedGraph(persos),
    moveIssues: [],
  }
}

describe('RuntimeComponentRuntime', () => {
  it('keeps component instances through scene snapshots and destroys them at final teardown', () => {
    const catalog = new RuntimeCapabilityCatalog()
    TestComponent.instances.length = 0
    const components = TestComponent.instances
    const events: string[] = []
    const mountablePartIds: string[][] = []
    let receivedModuleServices: ReadonlyMap<string, unknown> | undefined
    const surface: MediaComponentSurface = {
      seekTo: () => undefined,
      play: () => undefined,
      pause: () => undefined,
      stopAt: () => undefined,
      getCurrentTimeMs: () => 0,
      getDurationMs: () => null,
      isPaused: () => true,
    }
    catalog.registerComponent({
      type: 'test',
      component: TestComponent,
      modules: [],
      validateInitial: () => undefined,
      mountableParts: ['content'],
      surfaces: () => ({ media: surface }),
    })
    const materializer: RuntimeMaterializer = {
      id: 'test',
      context: {},
      materializeComponent: (_component, _identity, _initial, partIds, moduleServices) => {
        mountablePartIds.push([...partIds])
        receivedModuleServices = moduleServices
        return { destroy: () => events.push('destroy') }
      },
      materializeScene: () => undefined,
    }
    const runtime = new RuntimeComponentRuntime({ catalog, materializer })
    const surfaces = runtime.getComponentSurfaces()
    expect(surfaces.getSurface('main:item', 'media')).toBeUndefined()
    const markupService = {}
    const moduleServices = new Map([['markup', markupService]])
    runtime.setModuleServices(moduleServices)

    runtime.sync(solvedScene(0))
    expect(surfaces.getSurface('main:item', 'media')).toBe(surface)
    runtime.sync(solvedScene(100))
    runtime.sync(solvedScene(200, true, { changed: true }))
    runtime.sync(solvedScene(200, false))

    expect(components).toHaveLength(1)
    expect(components[0]?.updates).toEqual([0, 200])
    expect(runtime.getStateRevision('main:item')).toBe(2)
    expect(mountablePartIds).toEqual([['content']])
    expect(receivedModuleServices?.get('markup')).toBe(markupService)
    expect(events).toEqual([])

    runtime.destroy()
    expect(events).toEqual(['destroy'])
  })

  it('presents component-owned animation samples without repeating the logical update', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerComponent({
      type: 'animated',
      component: AnimatedComponent,
      modules: [],
      validateInitial: () => undefined,
      mountableParts: [],
    })
    const materializer: RuntimeMaterializer = {
      id: 'test',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: () => undefined,
    }
    const runtime = new RuntimeComponentRuntime({ catalog, materializer })
    AnimatedComponent.instances.length = 0
    runtime.sync(solvedScene(0, true, { animate: true }, 'animated'))
    const component = AnimatedComponent.instances[0]
    if (component === undefined) throw new Error('Animated component was not mounted.')

    runtime.presentAt(0)
    runtime.sync(solvedScene(50, true, { animate: true }, 'animated'))
    runtime.presentAt(50)
    runtime.presentAt(100)
    runtime.presentAt(150)
    runtime.presentAt(50)

    expect(component.updates).toEqual([0])
    expect(component.frames).toEqual([0, 50, 100, 50])
  })

  it('presents content before the host commit regardless of component registration order', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerComponent({
      type: 'presentation-order',
      component: PresentationOrderComponent,
      modules: [],
      validateInitial: () => undefined,
      mountableParts: [],
    })
    const runtime = new RuntimeComponentRuntime({
      catalog,
      materializer: {
        id: 'test',
        context: {},
        materializeComponent: () => ({ destroy: () => undefined }),
        materializeScene: () => undefined,
      },
    })

    PresentationOrderComponent.applied.length = 0
    runtime.sync(solvedPresentationOrderScene())
    runtime.presentAt(1_000)

    expect(PresentationOrderComponent.applied).toEqual(['grid', 'host'])
  })

  it('publishes targets only after every component is mounted and follows host availability', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const hostTarget = { kind: 'opaque-target' }
    TargetConsumerComponent.instances.length = 0
    catalog.registerComponent({
      type: 'target-host',
      component: TargetHostComponent,
      modules: [],
      validateInitial: () => undefined,
      targetProvider: () => ({ value: hostTarget, scope: 'host' }),
    })
    catalog.registerComponent({
      type: 'target-consumer',
      component: TargetConsumerComponent,
      modules: [],
      validateInitial: () => undefined,
    })

    let materializeCalls = 0
    let replaceSurfaceCalls = 0
    const runtime = new RuntimeComponentRuntime({
      catalog,
      materializer: {
        id: 'test',
        context: {},
        materializeComponent: () => {
          materializeCalls += 1
          throw new Error('Substrate-neutral components must not be materialized as HTML.')
        },
        materializeScene: () => undefined,
        getReplaceSurface: () => {
          replaceSurfaceCalls += 1
          return undefined
        },
      },
    })

    runtime.sync(solvedTargetScene(true))
    const consumer = TargetConsumerComponent.instances[0]
    if (consumer === undefined) throw new Error('Target consumer was not mounted.')
    expect(materializeCalls).toBe(0)
    expect(replaceSurfaceCalls).toBe(0)
    expect(consumer.receivedTargets).toEqual([hostTarget])

    runtime.sync(solvedTargetScene(false))
    expect(consumer.receivedTargets).toEqual([hostTarget, undefined])

    runtime.sync(solvedTargetScene(true))
    expect(consumer.receivedTargets).toEqual([hostTarget, undefined, hostTarget])
  })

  it('keeps an attached target available without authored placement', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const hostTarget = { kind: 'attached-target' }
    TargetConsumerComponent.instances.length = 0
    catalog.registerComponent({
      type: 'target-host',
      component: TargetHostComponent,
      modules: [],
      runtimeProfile: 'attached',
      validateInitial: () => undefined,
      targetProvider: () => ({ value: hostTarget, scope: 'host' }),
    })
    catalog.registerComponent({
      type: 'target-consumer',
      component: TargetConsumerComponent,
      modules: [],
      validateInitial: () => undefined,
    })

    const runtime = new RuntimeComponentRuntime({
      catalog,
      materializer: {
        id: 'test',
        context: {},
        materializeComponent: () => { throw new Error('These components are substrate-neutral.') },
        materializeScene: () => undefined,
      },
    })

    runtime.sync(solvedAttachedTargetScene())

    expect(TargetConsumerComponent.instances[0]?.receivedTargets).toEqual([hostTarget])
  })

  it('initializes a component before asking it to publish a target', () => {
    const catalog = new RuntimeCapabilityCatalog()
    let host: InitializedTargetHostComponent | undefined
    catalog.registerComponent({
      type: 'initialized-target-host',
      component: class extends InitializedTargetHostComponent {
        constructor(input: ComponentInput<Record<string, unknown>>) {
          super(input)
          host = this
        }
      },
      modules: [],
      validateInitial: () => undefined,
      targetProvider: (component) => {
        const initialized = component as InitializedTargetHostComponent
        return initialized.initialized ? { value: initialized.target, scope: 'host' } : undefined
      },
    })

    const runtime = new RuntimeComponentRuntime({
      catalog,
      materializer: {
        id: 'test',
        context: {},
        materializeComponent: () => { throw new Error('This component is substrate-neutral.') },
        materializeScene: () => undefined,
      },
    })

    runtime.sync(solvedScene(0, true, {}, 'initialized-target-host'))

    expect(host?.initialized).toBe(true)
  })

  it('resolves a target published by a component attached to a host', () => {
    const catalog = new RuntimeCapabilityCatalog()
    const publishedTarget = { kind: 'published-target' }
    TargetConsumerComponent.instances.length = 0
    catalog.registerComponent({
      type: 'target-host',
      component: TargetHostComponent,
      modules: [],
      validateInitial: () => undefined,
      targetProvider: () => ({ value: { kind: 'host-target' }, scope: 'host' }),
    })
    catalog.registerComponent({
      type: 'target-object',
      component: TargetHostComponent,
      modules: [],
      validateInitial: () => undefined,
      targetProvider: () => ({ value: publishedTarget, scope: 'target' }),
    })
    catalog.registerComponent({
      type: 'target-consumer',
      component: TargetConsumerComponent,
      modules: [],
      validateInitial: () => undefined,
    })

    const runtime = new RuntimeComponentRuntime({
      catalog,
      materializer: {
        id: 'test',
        context: {},
        materializeComponent: () => { throw new Error('These components are substrate-neutral.') },
        materializeScene: () => undefined,
      },
    })

    runtime.sync(solvedPublishedTargetScene())

    expect(TargetConsumerComponent.instances[0]?.receivedTargets).toEqual([publishedTarget])
  })
})
