// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { AuthorApi } from '../src/author-api'
import { createFlexAdapter } from '../src/adapters/flex-adapter'
import { createFlexAnchorTool } from '../src/flex-anchor-tool'

function temp__createAuthorApiStub(): AuthorApi & {
  emitNode: (persoId: string, node: Element | null) => void
} {
  const subscribers = new Map<string, Set<(node: Element | null) => void>>()
  const current = new Map<string, Element | null>()

  return {
    subscribeToNode: (persoId, cb) => {
      let set = subscribers.get(persoId)
      if (set === undefined) {
        set = new Set()
        subscribers.set(persoId, set)
      }
      set.add(cb)
      cb(current.get(persoId) ?? null)
      return () => set!.delete(cb)
    },
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
    emitNode(persoId, node) {
      current.set(persoId, node)
      for (const cb of subscribers.get(persoId) ?? []) cb(node)
    }
  }
}

describe('createFlexAnchorTool', () => {
  it('renders the 11 interaction points once the container is present', () => {
    const authorApi = temp__createAuthorApiStub()
    const container = document.createElement('div')
    const element = document.createElement('div')
    container.appendChild(element)
    authorApi.emitNode('container', container)
    authorApi.emitNode('item', element)

    const adapter = createFlexAdapter({ authorApi, itemId: 'item' })
    const tool = createFlexAnchorTool({
      itemId: 'item',
      containerId: 'container',
      authorApi,
      sceneRoot: document.body,
      adapter
    })

    const points = document.querySelectorAll('[data-flex-anchor-point]')
    expect(points).toHaveLength(11)

    tool.destroy()
  })

  it('applies the alignment of a clicked point through the adapter', () => {
    const authorApi = temp__createAuthorApiStub()
    const container = document.createElement('div')
    const element = document.createElement('div')
    container.appendChild(element)
    authorApi.emitNode('container', container)
    authorApi.emitNode('item', element)

    const adapter = createFlexAdapter({ authorApi, itemId: 'item' })
    const tool = createFlexAnchorTool({
      itemId: 'item',
      containerId: 'container',
      authorApi,
      sceneRoot: document.body,
      adapter
    })

    const point = document.querySelector<HTMLElement>('[data-flex-anchor-point="BR"]')!
    point.click()
    expect(element.style.alignSelf).toBe('end')
    expect(element.style.justifySelf).toBe('end')

    tool.destroy()
  })

  it('stays hidden while the container node is absent and shows on arrival', () => {
    const authorApi = temp__createAuthorApiStub()
    const adapter = createFlexAdapter({ authorApi, itemId: 'item' })
    const tool = createFlexAnchorTool({
      itemId: 'item',
      containerId: 'container',
      authorApi,
      sceneRoot: document.body,
      adapter
    })

    const root = document.querySelector<HTMLElement>('[data-flex-anchor-tool]')!
    expect(root.style.display).toBe('none')

    authorApi.emitNode('container', document.createElement('div'))
    expect(root.style.display).not.toBe('none')

    tool.setVisible(false)
    expect(root.style.display).toBe('none')

    tool.destroy()
  })
})
