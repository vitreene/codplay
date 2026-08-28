import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { ComponentModules, RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from '../../src/runtime/components'
import type { SceneDoc } from '../../src/player/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  textContent?: string
  updateCount?: number
}

class CounterRuntimeComponent implements RuntimeComponent {
  public node: unknown = null
  readonly modules: ComponentModules

  constructor(private readonly input: RuntimeComponentClassInput) {
    this.modules = input.modules
  }

  render(): RuntimeNodeFixture {
    const initial = this.input.perso.initial as Record<string, unknown>
    return {
      tagName: 'DIV',
      style: {},
      attributes: {},
      textContent: typeof initial.content === 'string' ? initial.content : undefined,
      updateCount: 0
    }
  }

  _init(): void {
    this.node = this.render()
  }

  update(input: RuntimeComponentUpdateInput): void {
    const rootNode = this.node as RuntimeNodeFixture | null
    if (rootNode === null) {
      return
    }

    if (typeof input.action.content === 'string') {
      rootNode.textContent = input.action.content
    }

    rootNode.updateCount = (rootNode.updateCount ?? 0) + 1
  }
}

/**
 * Creates one scene fixture with two same-time events on one custom component.
 */
function createNoResolverSceneFixture(): SceneDoc {
  return {
    id: 'scene-no-resolver',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'story-main__counter',
            name: 'counter',
            type: 'counter',
            initial: {
              content: 'zero',
              move: '@root'
            },
            actions: {
              'story-main__counter': null,
              'counter:one': {
                content: 'one'
              },
              'counter:two': {
                content: 'two'
              }
            }
          }
        ],
        straps: undefined,
        listen: [],
        eventimes: [
          {
            name: 'counter:one',
            startAt: 100
          },
          {
            name: 'counter:two',
            startAt: 100
          }
        ]
      }
    },
    onStart(scene, options) {
      options.schedule('story-main')
    },
    tracks: {}
  }
}

describe('V1 - render mutation resolver', () => {
  it('passes through unresolved custom items without HTML conflict filtering', async () => {
    const player = new PlayerFacade()
    expect(player.component.register({ type: 'counter', component: CounterRuntimeComponent })).toMatchObject({ ok: true })
    expect(await player.init(createNoResolverSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    expect(await player.seek(150)).toEqual({ ok: true })

    expect(player.getRuntimeRegistry().getNodeById('story-main__counter')).toMatchObject({
      textContent: 'two',
      updateCount: 2
    })
  })
})
