/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CodPlay,
  type CodPlayFrameScheduler,
  type CodPlayInstance,
} from '../../src'
import type { SceneDoc } from '../../src/scene/types'

/** Creates a scheduler whose frame callbacks remain under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Queues real CodPlay ticker callbacks so the integration test controls each frame. */
function createQueuedScheduler(): Readonly<{
  scheduler: CodPlayFrameScheduler
  flushNext: () => void
}> {
  const callbacks = new Map<number, () => void>()
  let nextId = 1
  return {
    scheduler: {
      request: (callback) => {
        const requestId = nextId
        nextId += 1
        callbacks.set(requestId, callback)
        return requestId
      },
      cancel: (requestId) => callbacks.delete(requestId),
    },
    flushNext: () => {
      const entry = callbacks.entries().next().value as [number, () => void] | undefined
      if (entry === undefined) throw new Error('CodPlay ticker has no queued frame.')
      callbacks.delete(entry[0])
      entry[1]()
    },
  }
}

/** Declares one layout scene containing the logical foreign-content host. */
function createLayoutScene(): SceneDoc<string> {
  return {
    id: 'foreign-layout-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'body-host',
          name: 'body',
          type: 'slot',
          initial: { move: '@root' },
        }],
        eventimes: [],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Declares one autonomous child scene rendered inside its supplied root. */
function createChildScene(content = 'child'): SceneDoc<string> {
  return {
    id: 'foreign-child-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'child-content',
          type: 'tag',
          initial: {
            tag: 'article',
            move: '@root',
            content,
          },
        }],
        eventimes: [],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates one autonomous child instance with a distinct public identity. */
function createChildInstance(codplay: CodPlay, instanceId: string, content: string): CodPlayInstance {
  const build = codplay.build({ scene: createChildScene(content) })
  if (!build.ok) throw new Error(`Foreign child scene did not compile: ${instanceId}`)
  return codplay.instances.create({
    instanceId,
    compiledScene: build.compiledScene,
    functions: build.functions,
  })
}

/** Creates the layout and child instances through the public CodPlay facade. */
function createForeignInstances(codplay: CodPlay): Readonly<{
  layout: CodPlayInstance
  child: CodPlayInstance
  layoutRoot: HTMLElement
}> {
  const layoutBuild = codplay.build({ scene: createLayoutScene() })
  const childBuild = codplay.build({ scene: createChildScene() })
  if (!layoutBuild.ok || !childBuild.ok) throw new Error('Foreign mount scenes did not compile.')

  const layoutRoot = document.createElement('main')
  document.body.append(layoutRoot)
  const layout = codplay.instances.create({
    instanceId: 'layout-1',
    compiledScene: layoutBuild.compiledScene,
    functions: layoutBuild.functions,
    root: layoutRoot,
  })
  const child = codplay.instances.create({
    instanceId: 'child-1',
    compiledScene: childBuild.compiledScene,
    functions: childBuild.functions,
  })
  return { layout, child, layoutRoot }
}

describe('CodPlay instance foreign mount', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    vi.useRealTimers()
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('mounts child materialized roots directly through the addressed slot', async () => {
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const { layout, child, layoutRoot } = createForeignInstances(codplay)
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    const mount = codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    })

    const childRoot = hostRoot.querySelector('article')
    if (!(childRoot instanceof HTMLElement)) throw new Error('Child materialized root is missing.')
    expect([...hostRoot.children]).toEqual([childRoot])
    expect(childRoot.textContent).toBe('child')

    await child.telco.seek(0)
    await layout.telco.seek(0)
    expect(childRoot.parentNode).toBe(hostRoot)
    expect(codplay.instances.get('layout-1')).toBe(layout)
    expect(codplay.instances.get('child-1')).toBe(child)

    mount.detach()
    mount.detach()
    expect(hostRoot.contains(childRoot)).toBe(false)
    expect(codplay.instances.get('child-1')).toBe(child)
  })

  it('detaches the relation before destroying a child while preserving the host instance', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { layout, layoutRoot } = createForeignInstances(codplay)
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    })
    expect(hostRoot.querySelector('article')).not.toBeNull()

    codplay.instances.destroy('child-1')

    expect(hostRoot.querySelector('article')).toBeNull()
    expect(codplay.instances.get('child-1')).toBeUndefined()
    expect(codplay.instances.get('layout-1')).toBe(layout)
    expect(hostRoot.parentNode).toBe(layoutRoot)
  })

  it('rejects a second relation for the same host and reports the mount failure', () => {
    const diagnostics: string[] = []
    const owner = new CodPlay({
      engine: {
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
      pauseOnDocumentHidden: false,
    })
    codplay = owner
    const { layoutRoot } = createForeignInstances(owner)
    const request = {
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    } as const

    const mount = owner.instances.mount(request)
    expect(() => owner.instances.mount(request)).toThrow('already mounted')
    expect(diagnostics).toContain('CODPLAY_INSTANCE_MOUNT_FAILED')

    mount.detach()
    expect(layoutRoot.querySelector('article')).toBeNull()
  })

  it('detaches the relation before destroying a host while preserving the child instance', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { child, layoutRoot } = createForeignInstances(codplay)
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    })
    expect(hostRoot.querySelector('article')).not.toBeNull()

    codplay.instances.destroy('layout-1')

    expect(hostRoot.querySelector('article')).toBeNull()
    expect(codplay.instances.get('layout-1')).toBeUndefined()
    expect(codplay.instances.get('child-1')).toBe(child)
  })

  it('advances slot replacement on shared engine frames independently of host seek and reset', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const frameQueue = createQueuedScheduler()
    codplay = new CodPlay({
      frameScheduler: frameQueue.scheduler,
      pauseOnDocumentHidden: false,
    })
    const { layout, child, layoutRoot } = createForeignInstances(codplay)
    const childB = createChildInstance(codplay, 'child-2', 'child-b')
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    const firstMount = codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    })
    await layout.telco.play()
    await child.telco.play()
    await layout.telco.pause()

    const replacementMount = codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: childB.instanceId,
      replace: { transition: 'mask-reveal', duration: 100, shape: 'star' },
    })

    const snapshots = (): HTMLElement[] => Array.from(layoutRoot.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    expect(snapshots()).toHaveLength(2)
    expect(snapshots()[0]?.textContent).toBe('child')
    expect(snapshots()[1]?.textContent).toBe('child-b')
    expect(snapshots()[1]?.style.getPropertyValue('mask-image')).toContain('data:image/svg+xml')
    expect(hostRoot.querySelector('article')?.textContent).toBe('child-b')
    expect(hostRoot.style.visibility).toBe('hidden')

    const incoming = snapshots()[1]
    expect(incoming?.style.getPropertyValue('mask-size')).toBe('0% auto')

    await vi.advanceTimersByTimeAsync(40)
    expect(snapshots()).toHaveLength(2)
    expect(incoming?.style.getPropertyValue('mask-size')).toBe('0% auto')

    frameQueue.flushNext()
    const firstFrameMaskSize = Number.parseFloat(incoming?.style.getPropertyValue('mask-size') ?? '0')
    expect(firstFrameMaskSize).toBeGreaterThan(0)

    await layout.telco.seek(0)
    expect(snapshots()).toHaveLength(2)
    expect(hostRoot.style.visibility).toBe('hidden')
    expect(incoming?.style.getPropertyValue('mask-size')).toBe(`${firstFrameMaskSize}% auto`)

    await layout.telco.reset()
    await layout.telco.play()
    expect(snapshots()).toHaveLength(2)
    expect(hostRoot.style.visibility).toBe('hidden')
    expect(incoming?.style.getPropertyValue('mask-size')).toBe(`${firstFrameMaskSize}% auto`)
    await layout.telco.pause()

    layoutRoot.style.width = '640px'
    window.dispatchEvent(new Event('resize'))
    expect(snapshots()).toHaveLength(2)
    expect(hostRoot.style.visibility).toBe('hidden')

    await vi.advanceTimersByTimeAsync(20)
    expect(incoming?.style.getPropertyValue('mask-size')).toBe(`${firstFrameMaskSize}% auto`)
    frameQueue.flushNext()
    const secondFrameMaskSize = Number.parseFloat(incoming?.style.getPropertyValue('mask-size') ?? '0')
    expect(secondFrameMaskSize).toBeGreaterThan(firstFrameMaskSize)
    await vi.advanceTimersByTimeAsync(40)
    frameQueue.flushNext()
    expect(snapshots()).toHaveLength(0)
    expect(hostRoot.style.opacity).toBe('')
    expect(hostRoot.querySelector('article')?.textContent).toBe('child-b')

    firstMount.detach()
    replacementMount.detach()
  })

  it('cleans an in-flight slot presentation when its mounted child is destroyed', () => {
    vi.useFakeTimers()
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const { layoutRoot } = createForeignInstances(codplay)
    const childB = createChildInstance(codplay, 'child-2', 'child-b')
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    codplay.instances.mount({
      host: { instanceId: 'layout-1', storyId: 'main', persoId: 'body-host' },
      childInstanceId: 'child-1',
    })
    codplay.instances.mount({
      host: { instanceId: 'layout-1', storyId: 'main', persoId: 'body-host' },
      childInstanceId: childB.instanceId,
      replace: { transition: 'stack', duration: 1000 },
    })

    expect(layoutRoot.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(2)
    expect(hostRoot.style.visibility).toBe('hidden')

    codplay.instances.destroy(childB.instanceId)

    expect(layoutRoot.querySelectorAll('[data-codplay-transient]')).toHaveLength(0)
    expect(hostRoot.style.visibility).toBe('')
    expect(hostRoot.children).toHaveLength(0)
  })
})
