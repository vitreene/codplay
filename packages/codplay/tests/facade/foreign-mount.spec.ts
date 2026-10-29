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

/** Declares a multi-root child whose compiled move uses a reparent overlay. */
function createMovingChildScene(): SceneDoc<string> {
  return {
    id: 'foreign-moving-child-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'source-container',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section><div data-part="source"></div></section>',
          },
        }, {
          id: 'target-container',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section><div data-part="target"></div></section>',
          },
        }, {
          id: 'moving-item',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'source' },
            content: 'moving child',
          },
          actions: {
            transfer: {
              move: {
                target: 'target',
                reparent: true,
                transition: { duration: 100, ease: 'linear' },
              },
            },
          },
        }],
        eventimes: [{ name: 'transfer', startAt: 100 }],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Reuses the move contract while exposing it only to live event discovery. */
function createLiveMovingChildScene(): SceneDoc<string> {
  const scene = createMovingChildScene()
  const main = scene.stories.main
  if (main === undefined) throw new Error('Foreign live motion story is missing.')
  return {
    ...scene,
    eventimes: [{ name: 'sequence:end', startAt: 1_000 }],
    stories: { main: { ...main, eventimes: [] } },
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

/** Finds the transient overlay owned by one root-local motion host. */
function findTestOverlayLayer(root: Element): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).find((candidate) => (
    candidate.style.position === 'fixed'
      && candidate.style.width === '100vw'
      && candidate.style.height === '100vh'
      && candidate.style.pointerEvents === 'none'
      && candidate.style.zIndex === '20'
  ))
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

  it('uses the addressed slot as the motion root of a child created without a root', async () => {
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const layoutBuild = codplay.build({ scene: createLayoutScene() })
    const childBuild = codplay.build({ scene: createMovingChildScene() })
    if (!layoutBuild.ok || !childBuild.ok) throw new Error('Foreign motion scenes did not compile.')

    const layoutRoot = document.createElement('main')
    document.body.append(layoutRoot)
    const layout = codplay.instances.create({
      instanceId: 'motion-layout',
      compiledScene: layoutBuild.compiledScene,
      functions: layoutBuild.functions,
      root: layoutRoot,
    })
    const child = codplay.instances.create({
      instanceId: 'motion-child',
      compiledScene: childBuild.compiledScene,
      functions: childBuild.functions,
    })
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    const mount = codplay.instances.mount({
      host: { instanceId: layout.instanceId, storyId: 'main', persoId: 'body-host' },
      childInstanceId: child.instanceId,
    })
    codplay.engine.advance(0)
    await child.telco.play()
    codplay.engine.advance(150)

    const overlay = findTestOverlayLayer(hostRoot)
    expect(overlay).toBeDefined()
    expect(overlay?.parentElement).toBe(hostRoot)
    expect(overlay?.children).toHaveLength(1)

    mount.detach()
    expect(overlay?.isConnected).toBe(false)

    const remount = codplay.instances.mount({
      host: { instanceId: layout.instanceId, storyId: 'main', persoId: 'body-host' },
      childInstanceId: child.instanceId,
    })
    expect(hostRoot.querySelector('article')?.textContent).toBe('moving child')
    remount.detach()
  })

  it('uses the addressed slot as the motion root for a live move', async () => {
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const layoutBuild = codplay.build({ scene: createLayoutScene() })
    const childBuild = codplay.build({ scene: createLiveMovingChildScene() })
    if (!layoutBuild.ok || !childBuild.ok) throw new Error('Foreign live motion scenes did not compile.')

    const layoutRoot = document.createElement('main')
    document.body.append(layoutRoot)
    const layout = codplay.instances.create({
      instanceId: 'live-motion-layout',
      compiledScene: layoutBuild.compiledScene,
      functions: layoutBuild.functions,
      root: layoutRoot,
    })
    const child = codplay.instances.create({
      instanceId: 'live-motion-child',
      compiledScene: childBuild.compiledScene,
      functions: childBuild.functions,
    })
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    const mount = codplay.instances.mount({
      host: { instanceId: layout.instanceId, storyId: 'main', persoId: 'body-host' },
      childInstanceId: child.instanceId,
    })
    await child.events.emit(
      { name: 'transfer', visibility: 'public' },
      { scope: 'story', storyId: 'main' },
    )
    codplay.engine.advance(0)
    await child.telco.play()
    codplay.engine.advance(1)

    const overlay = findTestOverlayLayer(hostRoot)
    expect(overlay).toBeDefined()
    expect(overlay?.parentElement).toBe(hostRoot)
    expect(overlay?.children).toHaveLength(1)
    mount.detach()
  })

  it('restores the creation root after detaching and remounting a scene', () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const layoutBuild = codplay.build({ scene: createLayoutScene() })
    const childBuild = codplay.build({ scene: createChildScene() })
    if (!layoutBuild.ok || !childBuild.ok) throw new Error('Foreign mount scenes did not compile.')

    const layoutRoot = document.createElement('main')
    const childRoot = document.createElement('aside')
    document.body.append(layoutRoot, childRoot)
    const layout = codplay.instances.create({
      instanceId: 'restore-layout',
      compiledScene: layoutBuild.compiledScene,
      functions: layoutBuild.functions,
      root: layoutRoot,
    })
    const child = codplay.instances.create({
      instanceId: 'restore-child',
      compiledScene: childBuild.compiledScene,
      functions: childBuild.functions,
      root: childRoot,
    })
    const hostRoot = layoutRoot.firstElementChild
    const content = childRoot.querySelector('article')
    if (!(hostRoot instanceof HTMLElement) || !(content instanceof HTMLElement)) {
      throw new Error('Foreign mount roots were not materialized.')
    }

    const mountRequest = {
      host: { instanceId: layout.instanceId, storyId: 'main', persoId: 'body-host' },
      childInstanceId: child.instanceId,
    } as const
    const firstMount = codplay.instances.mount(mountRequest)
    expect(content.parentElement).toBe(hostRoot)
    firstMount.detach()
    expect(content.parentElement).toBe(childRoot)

    const secondMount = codplay.instances.mount(mountRequest)
    expect(content.parentElement).toBe(hostRoot)
    secondMount.detach()
    expect(content.parentElement).toBe(childRoot)
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
