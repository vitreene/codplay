// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import type { AuthorApi } from '../src/author-api'
import { createFlexAdapter } from '../src/adapters/flex-adapter'
import { createFlexAnchorTool } from '../src/flex-anchor-tool'

const temp__emittedNodes = new Set<Element>()

afterEach(() => {
  for (const node of temp__emittedNodes) node.remove()
  temp__emittedNodes.clear()
})

/**
 * `emitNode` auto-attaches a not-yet-connected element (matching real usage — a node handed to a
 * live scene is always eventually attached): node tracking now gates on `isConnected`
 * (Étape 5 of the shared-tracking-layer migration), so a detached test node would never be picked
 * up instead of exercising it.
 */
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
    getNodePose: () => null,
    emitNode(persoId, node) {
      if (node !== null && !node.isConnected) {
        document.body.appendChild(node)
        temp__emittedNodes.add(node)
      }
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

  it('stays hidden while the container node is present but not yet connected — the guard this migration added (a node can be notified before it is attached, tracked-nodes.ts)', () => {
    let deliverContainer: ((node: Element | null) => void) | null = null
    const authorApi: AuthorApi = {
      subscribeToNode: (persoId, cb) => {
        if (persoId === 'container') deliverContainer = cb
        cb(null)
        return () => {
          if (persoId === 'container') deliverContainer = null
        }
      },
      subscribeToPlayerState: (cb) => {
        cb({ isPlaying: false })
        return () => {}
      },
      getPlayerState: () => ({ isPlaying: false }),
      getNodePose: () => null
    }
    const adapter = createFlexAdapter({ authorApi, itemId: 'item' })
    const tool = createFlexAnchorTool({
      itemId: 'item',
      containerId: 'container',
      authorApi,
      sceneRoot: document.body,
      adapter
    })
    const root = document.querySelector<HTMLElement>('[data-flex-anchor-tool]')!

    const disconnectedNode = document.createElement('div')
    deliverContainer!(disconnectedNode)
    expect(root.style.display).toBe('none')

    // The corrective re-notification once the tree is actually attached (same node, tracked-nodes.ts).
    document.body.appendChild(disconnectedNode)
    deliverContainer!(disconnectedNode)
    expect(root.style.display).not.toBe('none')

    tool.destroy()
    disconnectedNode.remove()
  })
})
