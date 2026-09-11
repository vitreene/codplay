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
function createChildScene(): SceneDoc<string> {
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
            content: 'child',
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
})
