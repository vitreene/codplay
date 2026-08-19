import { describe, expect, it } from 'vitest'
import {
  BaseComponent,
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  RuntimeComponentServiceCatalog,
} from '../../../src/runtime/components'
import type { ComponentUpdateInput } from '../../../src/runtime/components'
import type { SolvedScene } from '../../../src/runtime/player'
import { buildSolvedGraph } from '../../../src/runtime/player'

class TestComponent extends BaseComponent<Record<string, unknown>> {
  readonly updates: number[] = []

  render(): string {
    return '<section></section>'
  }

  update(input: ComponentUpdateInput): void {
    this.updates.push(input.timeMs)
  }
}

function solvedScene(timeMs: number, includePerso = true): SolvedScene {
  return {
    scene: {
      scene: {
        id: 'scene',
        stories: {
          main: {
            id: 'main',
            persos: [{ id: 'item', type: 'test', initial: {}, actions: {} }],
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
        type: 'test',
        state: {},
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    } : {},
    graph: buildSolvedGraph(includePerso ? {
      'main:item': {
        key: 'main:item',
        storyId: 'main',
        persoId: 'item',
        type: 'test',
        state: {},
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    } : {}),
    moveIssues: [],
  }
}

describe('RuntimeComponentRuntime', () => {
  it('creates, updates and destroys factory instances from solved scenes', () => {
    const catalog = new RuntimeComponentCatalog()
    const components: TestComponent[] = []
    const events: string[] = []
    const mountablePartIds: string[][] = []
    let receivedModuleServices: ReadonlyMap<string, unknown> | undefined
    catalog.register({
      type: 'test',
      services: [],
      modules: [],
      mountableParts: ['content'],
      create: () => {
        const component = new TestComponent({
          perso: { id: 'item', storyId: 'main', initial: {} },
          services: { declare: () => undefined, apply: () => undefined },
        })
        components.push(component)
        return component
      },
    })
    const runtime = new RuntimeComponentRuntime({
      catalog,
      serviceCatalog: new RuntimeComponentServiceCatalog(),
      materialize: (_component, _identity, _initial, partIds, moduleServices) => {
        mountablePartIds.push([...partIds])
        receivedModuleServices = moduleServices
        return { destroy: () => events.push('destroy') }
      },
    })
    const markupService = {}
    const moduleServices = new Map([['markup', markupService]])
    runtime.setModuleServices(moduleServices)

    runtime.sync(solvedScene(0))
    runtime.sync(solvedScene(100))
    runtime.sync(solvedScene(200, false))

    expect(components).toHaveLength(1)
    expect(components[0]?.updates).toEqual([0, 100])
    expect(mountablePartIds).toEqual([['content']])
    expect(receivedModuleServices?.get('markup')).toBe(markupService)
    expect(events).toEqual(['destroy'])
  })
})
