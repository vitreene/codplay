/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay } from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Builds one scene carrying a logical cqw position and width. */
function cqwScene(): SceneDoc {
  return {
    id: 'facade-cqw-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'item',
          type: 'tag',
          initial: {
            tag: 'article',
            move: '@root',
            style: {
              x: { kind: 'length', unit: 'cqw', value: 10 },
              width: { kind: 'length', unit: 'cqw', value: 25 },
            },
          },
          actions: {},
        }],
      },
    },
  }
}

/** Creates one fake ResizeObserver whose callback can be triggered by the test. */
function installResizeObserver(): { trigger: () => void } {
  let callback: (() => void) | undefined
  class FakeResizeObserver {
    constructor(next: () => void) {
      callback = next
    }

    observe(): void {
      // The host only needs registration for this boundary test.
    }

    disconnect(): void {
      callback = undefined
    }
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  return {
    trigger: () => callback?.(),
  }
}

describe('CodPlay facade cqw projection', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('derives the initial scale from the root and reapplies it after resize', () => {
    const resizeObserver = installResizeObserver()
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const build = codplay.build({ scene: cqwScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800 }),
    })
    document.body.append(root)
    const instance = codplay.instances.create({
      instanceId: 'facade-cqw-instance',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: 'main' }],
    })
    const node = root.querySelector<HTMLElement>('article')
    if (node === null) throw new Error('cqw facade test node is missing.')

    expect(node.style.transform).toBe('translateX(80px)')
    expect(node.style.width).toBe('200px')

    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1200 }),
    })
    resizeObserver.trigger()

    expect(node.style.transform).toBe('translateX(120px)')
    expect(node.style.width).toBe('300px')
    codplay.instances.destroy(instance.instanceId)
  })
})
