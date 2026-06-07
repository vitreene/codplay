// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one layout scene used to verify outlet mounting.
 */
function createLayoutSceneFixture(input: { format?: 'html' | 'svg'; includeMissingOutlet?: boolean } = {}): SceneDoc {
  const layoutMarkup =
    input.format === 'svg'
      ? '<g data-part="scene-layout:header"></g><g data-part="scene-layout:slot"></g>'
      : '<section class="layout-shell"><header data-part="scene-layout:header"></header><main data-part="scene-layout:slot"></main></section>'

  const persos: SceneDoc['stories'][string]['persos'] = [
    {
      id: 'scene-layout',
      name: 'layout',
      type: 'layout',
      initial: {
        format: input.format,
        markup: layoutMarkup
      },
      actions: {
        'scene-layout': null
      }
    },
    {
      id: 'story-main__title',
      name: 'title',
      type: 'text',
      initial: {
        move: {
          parentId: 'scene-layout:slot',
        },
        content: 'hello'
      },
      actions: {
        'story-main__title': null
      }
    }
  ]

  if (input.includeMissingOutlet) {
    persos.push({
      id: 'story-main__orphan',
      name: 'orphan',
      type: 'text',
      initial: {
        move: {
          parentId: 'scene-layout:missing',
        },
        content: 'orphan'
      },
      actions: {
        'story-main__orphan': null
      }
    })
  }

  return {
    id: 'scene-layout',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['scene-layout', 'story-main__title', ...(input.includeMissingOutlet ? ['story-main__orphan'] : [])],
        initial: undefined,
        persos,
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}

describe('V1 - layout runtime', () => {
  it('mounts child persos into declared layout outlets', async () => {
    const player = new PlayerFacade()

    expect(await player.init(createLayoutSceneFixture())).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    expect(registry.getNodeById('scene-layout:header')).not.toBeNull()
    expect(registry.getNodeById('scene-layout:slot')).not.toBeNull()

    const insertedNode = registry.getNodeById('story-main__title') as Element | null
    const slotNode = registry.getNodeById('scene-layout:slot') as Element | null
    expect(insertedNode?.parentNode).toBe(slotNode)

    const layoutRoot = registry.getNodeById('scene-layout') as Element | null
    expect(layoutRoot?.className).toBe('layout-shell')
    expect(Array.from(layoutRoot?.children ?? []).map((child) => child.tagName.toLowerCase())).toEqual([
      'header',
      'main'
    ])
  })

  it('wraps multi-root svg markup in an svg root', async () => {
    const player = new PlayerFacade()

    expect(await player.init(createLayoutSceneFixture({ format: 'svg' }))).toEqual({ ok: true })

    const layoutRoot = player.getRuntimeRegistry().getNodeById('scene-layout') as Element | null
    expect(layoutRoot?.tagName.toLowerCase()).toBe('svg')
    expect(player.getRuntimeRegistry().getNodeById('scene-layout:slot')).not.toBeNull()
  })

  it('warns when one declared outlet is missing from markup', async () => {
    const traces: Array<{ eventName: string; payload?: Record<string, unknown> }> = []
    const player = new PlayerFacade()

    player.onTrace((row) => {
      traces.push({
        eventName: row.eventName,
        payload: row.payload
      })
    })

    expect(await player.init(createLayoutSceneFixture({ includeMissingOutlet: true }))).toEqual({ ok: true })

    expect(
      traces.some((trace) => trace.eventName === 'renderer:error' && trace.payload?.code === 'AUTHOR_LAYOUT_OUTLET_NOT_FOUND')
    ).toBe(true)
  })
})
