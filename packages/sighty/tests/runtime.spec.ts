/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayFrameScheduler } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyFile } from '../src'

type SceneKey = 'layout' | 'menu' | 'sceneA' | 'sceneB'

type SlotName = 'main'

type NavigationSceneKey = 'scene-layout' | 'scene-menu' | 'scene-a' | 'scene-b' | 'scene-c' | 'scene-telco'

type NavigationSlotName = 'slot-scene' | 'slot-telco'

/** Creates a deterministic CodPlay frame scheduler for public-event tests. */
function createManualFrameScheduler(): CodPlayFrameScheduler & { flush: () => void } {
  let nextRequestId = 1
  const pending = new Map<number, () => void>()
  return {
    request(callback) {
      const requestId = nextRequestId
      nextRequestId += 1
      pending.set(requestId, callback)
      return requestId
    },
    cancel(requestId) {
      pending.delete(requestId)
    },
    flush() {
      for (const [requestId, callback] of [...pending.entries()]) {
        pending.delete(requestId)
        callback()
      }
    },
  }
}

/** Creates one child document with a visible root and no page-specific logic. */
function createChildScene(sceneKey: Exclude<SceneKey, 'layout'>): SceneDoc<string> {
  const slug = sceneKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  return {
    id: `runtime-${sceneKey}-scene`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `${sceneKey}-content`,
          type: 'tag',
          initial: {
            tag: 'article',
            content: sceneKey,
            className: `runtime-${slug}`,
            attr: { id: `runtime-${slug}-root` },
            move: '@root',
          },
        }],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates a minimal visible scene for the recursive navigation fixture. */
function createNavigationScene(sceneKey: Exclude<NavigationSceneKey, 'scene-layout'>): SceneDoc<string> {
  return {
    id: `navigation-${sceneKey}`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `${sceneKey}-content`,
          type: 'tag',
          initial: {
            tag: 'article',
            content: sceneKey,
            attr: { id: `${sceneKey}-root` },
            move: '@root',
          },
        }],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates a layout with one slot and three declared selectable placements. */
function createLayoutScene(slotName = 'main'): SceneDoc<string> {
  return {
    id: 'runtime-layout-scene',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'runtime-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="runtime-layout-root"><section id="runtime-slot-anchor" data-part="runtime:main"></section></main>',
            },
          },
          {
            id: 'runtime-main-slot',
            name: slotName,
            type: 'slot',
            initial: {
              className: 'runtime-slot',
              move: { target: 'runtime:main' },
            },
            actions: {
              'runtime:macro-open-b': { className: 'runtime-slot runtime-slot--macro' },
            },
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates a physical layout whose slot names match the recursive scenario. */
function createNavigationLayoutScene(): SceneDoc<string> {
  return {
    id: 'navigation-layout-scene',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'navigation-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="navigation-layout-root"><section id="navigation-scene" data-part="navigation-scene"></section><section id="navigation-telco" data-part="navigation-telco"></section></main>',
            },
          },
          {
            id: 'navigation-scene-slot',
            name: 'slot-scene',
            type: 'slot',
            initial: { move: { target: 'navigation-scene' } },
          },
          {
            id: 'navigation-telco-slot',
            name: 'slot-telco',
            type: 'slot',
            initial: { move: { target: 'navigation-telco' } },
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Builds the minimal Sighty file whose slot has several legal child choices. */
function createFile(): SightyFile<SceneKey, SlotName> {
  return {
    format: 'sighty',
    version: 1,
    id: 'runtime-multiple-placements',
    resources: {
      scenes: {
        layout: './layout',
        menu: './menu',
        sceneA: './scene-a',
        sceneB: './scene-b',
      },
    },
    views: [{
      view: {
        scene: 'layout',
        slots: {
          main: [
            { view: { scene: 'menu' } },
            { view: { scene: 'sceneA' } },
            { view: { scene: 'sceneB' } },
          ],
        },
      },
    }],
  }
}

/** Builds one recursive view graph with inherited direction and direct routes. */
function createGraphFile(): SightyFile<SceneKey, SlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'runtime-view-graph',
    resources: {
      scenes: {
        layout: './layout',
        menu: './menu',
        sceneA: './scene-a',
        sceneB: './scene-b',
      },
    },
    views: {
      start: 'main',
      views: {
        main: {
          actions: {
            'runtime:next': { go: { direction: 'next' } },
          },
          view: {
            scene: 'layout',
            slots: {
              main: {
                start: 'menu',
                views: {
                  menu: {
                    actions: {
                      'runtime:open-b': {
                        action: 'runtime:macro-open-b',
                        go: { path: 'main/main/sceneB' },
                      },
                      'runtime:send-inactive': {
                        action: 'runtime:send-inactive',
                        go: { path: 'main/main/sceneA' },
                      },
                    },
                    view: { scene: 'menu' },
                  },
                  sceneA: { view: { scene: 'sceneA' } },
                  sceneB: { view: { scene: 'sceneB' } },
                },
              },
            },
          },
        },
      },
    },
  }
}

/** Builds the target recursive scenario without embedding scene sources. */
function createNavigationFile(): SightyFile<NavigationSceneKey, NavigationSlotName> {
  return {
    views: {
      start: 'view-main',
      views: {
        'view-main': {
          actions: {
            'navigation:next': { go: { direction: 'next' } },
            'navigation:previous': { go: { direction: 'previous' } },
          },
          view: {
            scene: 'scene-layout',
            views: {
              start: 'view-summary',
              views: {
                'view-summary': {
                  view: {
                    slots: {
                      'slot-scene': {
                        start: 'view-summary-menu',
                        views: {
                          'view-summary-menu': {
                            actions: {
                              'navigation:open-a': {
                                go: { path: 'view-main/view-chapter/slot-scene/view-page-a' },
                              },
                            },
                            view: { scene: 'scene-menu' },
                          },
                        },
                      },
                    },
                  },
                },
                'view-chapter': {
                  actions: {
                    'navigation:previous': {
                      go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                    },
                    'navigation:next': {
                      go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                    },
                  },
                  view: {
                    slots: {
                      'slot-scene': [
                        {
                          id: 'view-page-a',
                          actions: {
                            'navigation:previous': { go: { direction: 'previous' } },
                            'navigation:next': { go: { direction: 'next' } },
                          },
                          view: { scene: 'scene-a' },
                        },
                        {
                          id: 'view-page-b',
                          actions: {
                            'navigation:previous': { go: { direction: 'previous' } },
                            'navigation:next': { go: { direction: 'next' } },
                          },
                          view: { scene: 'scene-b' },
                        },
                        {
                          id: 'view-page-c',
                          actions: {
                            'navigation:previous': { go: { direction: 'previous' } },
                            'navigation:next': { go: { direction: 'next' } },
                            'navigation:sequence-end': {
                              go: { path: 'view-main/view-summary/slot-scene/view-summary-menu' },
                            },
                          },
                          view: { scene: 'scene-c' },
                        },
                      ],
                      'slot-telco': {
                        start: 'view-chapter-telco',
                        views: {
                          'view-chapter-telco': { view: { scene: 'scene-telco' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }
}

describe('Sighty runtime slot selection', () => {
  let project: Sighty<SceneKey, SlotName> | undefined
  let navigationProject: Sighty<NavigationSceneKey, NavigationSlotName> | undefined

  afterEach(() => {
    project?.runtime.destroy()
    navigationProject?.runtime.destroy()
    project = undefined
    navigationProject = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('mounts only the declared child selected by scene key', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'runtime-layout-1',
          menu: 'runtime-menu-1',
          sceneA: 'runtime-scene-a-1',
          sceneB: 'runtime-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    await project.runtime.initialize()
    expect(stage.querySelector('#runtime-menu-root')).not.toBeNull()
    expect(stage.querySelector('#runtime-scene-a-root')).toBeNull()

    project.runtime.mountSlot('main', 'sceneB')
    expect(stage.querySelector('#runtime-menu-root')).toBeNull()
    expect(stage.querySelector('#runtime-scene-b-root')).not.toBeNull()

    project.runtime.mountSlot('main', 'sceneA')
    expect(stage.querySelector('#runtime-scene-b-root')).toBeNull()
    expect(stage.querySelector('#runtime-scene-a-root')).not.toBeNull()

    expect(() => project!.runtime.mountSlot('main', 'unknown' as SceneKey)).toThrow(
      "La scène Sighty unknown n'est pas déclarée dans le slot main.",
    )
    expect(stage.querySelector('#runtime-scene-a-root')).not.toBeNull()
  })

  it('routes graph actions and inherited directions inside Sighty', async () => {
    const stage = document.createElement('div')
    const selected: (SceneKey | undefined)[] = []
    let macroExecuted = false
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'graph-layout-1',
          menu: 'graph-menu-1',
          sceneA: 'graph-scene-a-1',
          sceneB: 'graph-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
        actionCatalog: {
          'runtime:macro-open-b': async ({ send }) => {
            macroExecuted = true
            await send('layout', { name: 'runtime:macro-open-b' }, { scope: 'story', storyId: 'main' })
          },
          'runtime:send-inactive': async ({ send }) => {
            await send('menu', { name: 'runtime:should-not-be-sent' }, { scope: 'story', storyId: 'main' })
          },
        },
      },
    })
    const unsubscribe = project.runtime.onSlotChange('main', (sceneKey) => selected.push(sceneKey))

    await project.runtime.initialize()
    expect(selected).toEqual(['menu'])
    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneA')
    expect(stage.querySelector('#runtime-scene-a-root')).not.toBeNull()

    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'sceneA' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneB')

    project.runtime.mountSlot('main', 'menu')
    expect(await project.runtime.dispatch({ name: 'runtime:open-b', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneB')
    expect(macroExecuted).toBe(true)
    unsubscribe()
  })

  it('rejects an action send addressed to a scene that just left the composition', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'send-inactive-layout-1',
          menu: 'send-inactive-menu-1',
          sceneA: 'send-inactive-scene-a-1',
          sceneB: 'send-inactive-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
        actionCatalog: {
          'runtime:macro-open-b': async () => undefined,
          'runtime:send-inactive': async ({ send }) => {
            await send('menu', { name: 'runtime:should-not-be-sent' }, { scope: 'story', storyId: 'main' })
          },
        },
      },
    })

    await project.runtime.initialize()
    await expect(project.runtime.dispatch({ name: 'runtime:send-inactive', sourceSceneKey: 'menu' })).rejects.toThrow(
      "La scène Sighty menu n'est pas active dans la composition.",
    )
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneA')
    expect(stage.querySelector('#runtime-scene-a-root')).not.toBeNull()
  })

  it('ignores external events that name an inactive source scene', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'inactive-source-layout-1',
          menu: 'inactive-source-menu-1',
          sceneA: 'inactive-source-scene-a-1',
          sceneB: 'inactive-source-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
        actionCatalog: {
          'runtime:macro-open-b': async () => undefined,
          'runtime:send-inactive': async () => undefined,
        },
      },
    })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'sceneA' })).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(stage.querySelector('#runtime-menu-root')).not.toBeNull()
  })

  it('rejects a referenced action that is absent from the supplied catalog', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'missing-action-layout-1',
          menu: 'missing-action-menu-1',
          sceneA: 'missing-action-scene-a-1',
          sceneB: 'missing-action-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    await expect(project.runtime.initialize()).rejects.toThrow(
      "L'action Sighty « runtime:macro-open-b » n'est pas enregistrée dans le catalogue.",
    )
  })

  it('cleans partial instances and mounts after initialization fails', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene('unexpected-main'),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'failed-init-layout-1',
          menu: 'failed-init-menu-1',
          sceneA: 'failed-init-scene-a-1',
          sceneB: 'failed-init-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
        actionCatalog: {
          'runtime:macro-open-b': async () => undefined,
          'runtime:send-inactive': async () => undefined,
        },
      },
    })

    await expect(project.runtime.initialize()).rejects.toThrow('Slot "main" was not found')
    expect(project.runtime.getInstance('layout')).toBeUndefined()
    expect(project.runtime.getInstance('menu')).toBeUndefined()
    expect(stage.querySelector('#runtime-layout-root')).toBeNull()
  })

  it('navigates recursive views and changes the active composition branch', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        file: createNavigationFile(),
        scenes: {
          'scene-layout': createNavigationLayoutScene(),
          'scene-menu': createNavigationScene('scene-menu'),
          'scene-a': createNavigationScene('scene-a'),
          'scene-b': createNavigationScene('scene-b'),
          'scene-c': createNavigationScene('scene-c'),
          'scene-telco': createNavigationScene('scene-telco'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          'scene-layout': 'navigation-layout-1',
          'scene-menu': 'navigation-menu-1',
          'scene-a': 'navigation-a-1',
          'scene-b': 'navigation-b-1',
          'scene-c': 'navigation-c-1',
          'scene-telco': 'navigation-telco-1',
        },
        layout: { sceneKey: 'scene-layout', storyId: 'main' },
      },
    })

    await navigationProject.runtime.initialize()
    expect(stage.querySelector('#scene-menu-root')).not.toBeNull()
    expect(navigationProject.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()

    expect(await navigationProject.runtime.dispatch({ name: 'navigation:open-a', sourceSceneKey: 'scene-menu' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    expect(navigationProject.runtime.getMountedSceneKey('slot-telco')).toBe('scene-telco')
    expect(stage.querySelector('#scene-menu-root')).toBeNull()
    expect(stage.querySelector('#scene-a-root')).not.toBeNull()

    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-a' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:previous', sourceSceneKey: 'scene-b' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')

    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-a' })).toBe(true)
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-b' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-c' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:open-a', sourceSceneKey: 'scene-menu' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:previous', sourceSceneKey: 'scene-a' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:open-a', sourceSceneKey: 'scene-menu' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-a' })).toBe(true)
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-b' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')
    expect(await navigationProject.runtime.dispatch({ name: 'navigation:sequence-end', sourceSceneKey: 'scene-c' })).toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(navigationProject.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()
  })

  it('publishes active CodPlay events through the Sighty host event surface', async () => {
    const stage = document.createElement('div')
    const scheduler = createManualFrameScheduler()
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const events: Array<{ name: string; sourceSceneKey?: NavigationSceneKey; data?: unknown }> = []
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        file: createNavigationFile(),
        scenes: {
          'scene-layout': createNavigationLayoutScene(),
          'scene-menu': createNavigationScene('scene-menu'),
          'scene-a': createNavigationScene('scene-a'),
          'scene-b': createNavigationScene('scene-b'),
          'scene-c': createNavigationScene('scene-c'),
          'scene-telco': createNavigationScene('scene-telco'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          'scene-layout': 'events-layout-1',
          'scene-menu': 'events-menu-1',
          'scene-a': 'events-a-1',
          'scene-b': 'events-b-1',
          'scene-c': 'events-c-1',
          'scene-telco': 'events-telco-1',
        },
        layout: { sceneKey: 'scene-layout', storyId: 'main' },
        codplay: { frameScheduler: scheduler, pauseOnDocumentHidden: false },
      },
    })
    const unsubscribe = navigationProject.runtime.events.onEvent((event) => events.push({
      name: event.name,
      sourceSceneKey: event.sourceSceneKey,
      data: event.data,
    }))

    await navigationProject.runtime.initialize()
    const menu = navigationProject.runtime.getInstance('scene-menu')
    if (menu === undefined) throw new Error('La scène menu de test est absente.')
    await navigationProject.runtime.play('scene-menu')
    await menu.events.emit(
      { name: 'navigation:open-a', visibility: 'public', data: { choice: 'a' } },
      { scope: 'story', storyId: 'main' },
    )

    expect(events).toEqual([])
    now.mockReturnValue(20)
    scheduler.flush()

    expect(events).toEqual([{
      name: 'navigation:open-a',
      sourceSceneKey: 'scene-menu',
      data: { choice: 'a' },
    }])
    await vi.waitFor(() => {
      expect(navigationProject!.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    })

    unsubscribe()
    const sceneA = navigationProject.runtime.getInstance('scene-a')
    if (sceneA === undefined) throw new Error('La scène A de test est absente.')
    await sceneA.events.emit(
      { name: 'host:after-unsubscribe', visibility: 'public' },
      { scope: 'scene' },
    )
    now.mockReturnValue(40)
    scheduler.flush()
    expect(events).toHaveLength(1)
  })

  it('inherits the CodPlay engine idle policy without a Sighty override', async () => {
    const stage = document.createElement('div')
    const scheduler = createManualFrameScheduler()
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const events: string[] = []
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        file: createNavigationFile(),
        scenes: {
          'scene-layout': createNavigationLayoutScene(),
          'scene-menu': createNavigationScene('scene-menu'),
          'scene-a': createNavigationScene('scene-a'),
          'scene-b': createNavigationScene('scene-b'),
          'scene-c': createNavigationScene('scene-c'),
          'scene-telco': createNavigationScene('scene-telco'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          'scene-layout': 'idle-layout-1',
          'scene-menu': 'idle-menu-1',
          'scene-a': 'idle-a-1',
          'scene-b': 'idle-b-1',
          'scene-c': 'idle-c-1',
          'scene-telco': 'idle-telco-1',
        },
        layout: { sceneKey: 'scene-layout', storyId: 'main' },
        codplay: {
          frameScheduler: scheduler,
          pauseOnDocumentHidden: false,
          engine: {
            idle: {
              durationMs: 100,
              event: { name: 'engine:idle', visibility: 'public' },
            },
          },
        },
      },
    })
    navigationProject.runtime.events.onEvent((event) => events.push(event.name))

    await navigationProject.runtime.initialize()
    const menu = navigationProject.runtime.getInstance('scene-menu')
    if (menu === undefined) throw new Error('La scène menu de test est absente.')
    await menu.telco.play()

    now.mockReturnValue(100)
    scheduler.flush()
    await vi.waitFor(() => {
      expect(events).toContain('engine:idle')
    })
  })

  it('drops public events emitted by a scene after its binding has ended', async () => {
    const stage = document.createElement('div')
    const events: string[] = []
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        file: createNavigationFile(),
        scenes: {
          'scene-layout': createNavigationLayoutScene(),
          'scene-menu': createNavigationScene('scene-menu'),
          'scene-a': createNavigationScene('scene-a'),
          'scene-b': createNavigationScene('scene-b'),
          'scene-c': createNavigationScene('scene-c'),
          'scene-telco': createNavigationScene('scene-telco'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          'scene-layout': 'stale-layout-1',
          'scene-menu': 'stale-menu-1',
          'scene-a': 'stale-a-1',
          'scene-b': 'stale-b-1',
          'scene-c': 'stale-c-1',
          'scene-telco': 'stale-telco-1',
        },
        layout: { sceneKey: 'scene-layout', storyId: 'main' },
      },
    })
    navigationProject.runtime.events.onEvent((event) => events.push(event.name))

    await navigationProject.runtime.initialize()
    await navigationProject.runtime.dispatch({ name: 'navigation:open-a', sourceSceneKey: 'scene-menu' })
    await navigationProject.runtime.dispatch({ name: 'navigation:next', sourceSceneKey: 'scene-a' })
    const sceneB = navigationProject.runtime.getInstance('scene-b')
    if (sceneB === undefined) throw new Error('La scène B de test est absente.')
    await navigationProject.runtime.dispatch({ name: 'navigation:previous', sourceSceneKey: 'scene-b' })
    await sceneB.events.emit(
      { name: 'navigation:next', visibility: 'public' },
      { scope: 'story', storyId: 'main' },
    )

    expect(events).toEqual([])
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
  })

  it('closes a binding when a slot is detached explicitly', async () => {
    const stage = document.createElement('div')
    const events: string[] = []
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'detach-binding-layout-1',
          menu: 'detach-binding-menu-1',
          sceneA: 'detach-binding-scene-a-1',
          sceneB: 'detach-binding-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })
    project.runtime.events.onEvent((event) => events.push(event.name))

    await project.runtime.initialize()
    const menu = project.runtime.getInstance('menu')
    if (menu === undefined) throw new Error('La scène menu de test est absente.')
    project.runtime.detachSlot('main')
    await menu.events.emit(
      { name: 'navigation:after-detach', visibility: 'public' },
      { scope: 'scene' },
    )

    expect(project.runtime.getMountedSceneKey('main')).toBeUndefined()
    expect(events).toEqual([])
  })

  it('does not roll back a composition when a slot observer fails', async () => {
    const stage = document.createElement('div')
    const warnings: string[] = []
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        file: createGraphFile(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'observer-layout-1',
          menu: 'observer-menu-1',
          sceneA: 'observer-scene-a-1',
          sceneB: 'observer-scene-b-1',
        },
        layout: { sceneKey: 'layout', storyId: 'main' },
        actionCatalog: {
          'runtime:macro-open-b': async () => undefined,
          'runtime:send-inactive': async () => undefined,
        },
        onPreloadWarning: (warning) => warnings.push(warning.code),
      },
    })
    project.runtime.onSlotChange('main', () => {
      throw new Error('observer failure')
    })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneA')
    expect(warnings).toContain('SIGHTY_SLOT_LISTENER_FAILED')
  })
})
