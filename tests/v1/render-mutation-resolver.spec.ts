import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from '../../src/runtime/components'
import type { SceneDoc } from '../../src/player/types'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  textContent?: string
  updateCount?: number
}

class CounterRuntimeComponent implements RuntimeComponent {
  private rootNode: RuntimeNodeFixture | null = null

  constructor(private readonly input: RuntimeComponentClassInput) {
    void this.input
  }

  init(initial: Record<string, unknown>): void {
    this.rootNode ??= {
      tagName: 'DIV',
      style: {},
      attributes: {}
    }
    this.rootNode.textContent = typeof initial.content === 'string' ? initial.content : undefined
    this.rootNode.updateCount = 0
  }

  render(): unknown {
    return this.rootNode
  }

  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      return
    }

    if (typeof input.action.content === 'string') {
      this.rootNode.textContent = input.action.content
    }

    this.rootNode.updateCount = (this.rootNode.updateCount ?? 0) + 1
  }
}

/**
 * Creates one scene fixture with two same-time events on one custom component.
 */
function createNoResolverSceneFixture(): SceneDoc {
  return {
    id: 'scene-no-resolver',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__counter'],
        initial: undefined,
        persos: [
          {
            id: 'story-main__counter',
            name: 'counter',
            type: 'counter',
            initial: {
              content: 'zero'
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
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    onStart(scene, options) {
      options.schedule(scene.rootStories[0])
    },
    tracks: {}
  }
}

describe('V1 - render mutation resolver', () => {
  it('passes through unresolved custom items without HTML conflict filtering', async () => {
    const player = new PlayerFacade()
    expect(player.registerComponent('counter', CounterRuntimeComponent)).toEqual({ ok: true })
    expect(await player.init(createNoResolverSceneFixture())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })

    expect(await player.seek(150)).toEqual({ ok: true })

    expect(player.getRuntimeRegistry().getNodeById('story-main__counter')).toMatchObject({
      textContent: 'two',
      updateCount: 2
    })
  })
})
