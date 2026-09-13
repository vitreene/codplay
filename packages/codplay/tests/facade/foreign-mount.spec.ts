/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

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

  it('replaces the mounted child through the shared replace presentation', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const { layout, layoutRoot } = createForeignInstances(codplay)
    const childB = createChildInstance(codplay, 'child-2', 'child-b')
    const hostRoot = layoutRoot.firstElementChild
    if (!(hostRoot instanceof HTMLElement)) throw new Error('Foreign host root is missing.')

    codplay.engine.advance(0)
    const firstMount = codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: 'child-1',
    })
    await layout.telco.play()
    codplay.engine.advance(0)

    const replacementMount = codplay.instances.mount({
      host: {
        instanceId: 'layout-1',
        storyId: 'main',
        persoId: 'body-host',
      },
      childInstanceId: childB.instanceId,
      replace: { transition: 'fade', duration: 100 },
    })

    const snapshots = (): HTMLElement[] => Array.from(layoutRoot.children)
      .filter((child): child is HTMLElement => child.getAttribute('data-codplay-transient') !== null)
    expect(snapshots()).toHaveLength(1)
    expect(snapshots()[0]?.textContent).toBe('child')
    expect(hostRoot.querySelector('article')?.textContent).toBe('child-b')
    expect(hostRoot.style.opacity).toBe('0')

    codplay.engine.advance(50)
    expect(snapshots()[0]?.style.opacity).toBe('0.5')
    expect(hostRoot.style.opacity).toBe('0.5')

    codplay.engine.advance(100)
    expect(snapshots()).toHaveLength(0)
    expect(hostRoot.style.opacity).toBe('')
    expect(hostRoot.querySelector('article')?.textContent).toBe('child-b')

    firstMount.detach()
    replacementMount.detach()
  })
})
