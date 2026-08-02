import { describe, expect, it } from 'vitest'
import {
  BaseComponent,
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
} from '../../../src/runtime/components'
import type { ComponentUpdateInput } from '../../../src/runtime/components'
import type { SolvedScene } from '../../../src/runtime/player'

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
    rootPersoKeys: [],
    childrenByTarget: {},
    moveIssues: [],
  }
}

describe('RuntimeComponentRuntime', () => {
  it('creates, updates and destroys factory instances from solved scenes', () => {
    const catalog = new RuntimeComponentCatalog()
    const components: TestComponent[] = []
    const events: string[] = []
    catalog.register({
      type: 'test',
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
      createServices: () => ({ declare: () => undefined, apply: () => undefined }),
      materialize: () => ({ destroy: () => events.push('destroy') }),
    })

    runtime.sync(solvedScene(0))
    runtime.sync(solvedScene(100))
    runtime.sync(solvedScene(200, false))

    expect(components).toHaveLength(1)
    expect(components[0]?.updates).toEqual([0, 100])
    expect(events).toEqual(['destroy'])
  })
})
