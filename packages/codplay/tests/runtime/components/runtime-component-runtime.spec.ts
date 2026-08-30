import { describe, expect, it } from 'vitest'
import {
  BaseComponent,
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

class TestComponent extends BaseComponent<Record<string, unknown>> {
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

class AnimatedComponent extends BaseComponent<Record<string, unknown>> {
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
})
