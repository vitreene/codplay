/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayFrameScheduler } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyScenarioDefinition } from '../src'

type SceneKey = 'layout' | 'menu' | 'sceneA' | 'sceneB'

type SlotName = 'main'

type NavigationSceneKey = 'scene-layout' | 'scene-menu' | 'scene-a' | 'scene-b' | 'scene-c' | 'scene-telco'

type NavigationSlotName = 'slot-scene' | 'slot-telco'

type PlaybackSceneKey = 'layout' | 'parent' | 'child' | 'leaf' | 'inactive'

type PlaybackSlotName = 'main' | 'nested' | 'inner'

type GatewaySceneKey = 'layout' | 'menu'

type GatewaySlotName = 'main'

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

/** Creates the active target scene used by the gateway event-routing test. */
function createGatewayMenuScene(): SceneDoc<string> {
  return {
    id: 'runtime-gateway-menu-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'gateway-menu-content',
          type: 'tag',
          initial: {
            tag: 'article',
            content: 'initial',
            attr: { id: 'gateway-menu-root' },
            move: '@root',
          },
          actions: { 'runtime:set-content': null },
        }],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Builds one active scene action that sends a CodPlay event through Sighty. */
function createGatewayScenario(): SightyScenarioDefinition<GatewaySceneKey, GatewaySlotName> {
  return {
    format: 'sighty',
    version: 1,
    id: 'runtime-event-gateway',
    views: {
      start: 'layout-view',
      views: {
        'layout-view': {
          view: {
            scene: 'layout',
            slots: {
              main: {
                start: 'menu-view',
                views: {
                  'menu-view': {
                    actions: {
                      'runtime:send-content': { action: 'action:runtime:send-content' },
                    },
                    view: { scene: 'menu' },
                  },
                },
              },
            },
          },
        },
      },
    },
    actions: {
      'action:runtime:send-content': async ({ send }) => {
        await send('menu', {
          name: 'runtime:set-content',
          data: { content: 'updated' },
        }, { scope: 'story', storyId: 'main' })
      },
    },
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

/** Creates a layout scene that owns the declared child slots. */
function createPlaybackScene(sceneKey: PlaybackSceneKey, slotNames: readonly string[]): SceneDoc<string> {
  const slotMarkup = slotNames.map((slotName) => `
    <section id="${sceneKey}-${slotName}-host" data-part="${sceneKey}:${slotName}"></section>`).join('')
  return {
    id: `playback-${sceneKey}-scene`,
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: `playback-${sceneKey}-layout`,
            type: 'layout',
            initial: {
              move: '@root',
              markup: `<main id="${sceneKey}-root">${slotMarkup}</main>`,
            },
          },
          ...slotNames.map((slotName) => ({
            id: `playback-${sceneKey}-${slotName}-slot`,
            name: slotName,
            type: 'slot' as const,
            initial: { move: { target: `${sceneKey}:${slotName}` } },
          })),
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates a three-level selected scene tree plus an inactive authored sibling. */
function createPlaybackScenario(): SightyScenarioDefinition<PlaybackSceneKey, PlaybackSlotName> {
  return {
    format: 'sighty',
    version: 1,
    id: 'sighty-playback-scenario',
    views: {
      start: 'layout-view',
      views: {
        'layout-view': {
          view: {
            scene: 'layout',
            slots: {
              main: [
                {
                  id: 'parent',
                  actions: {
                    'playback:open-leaf': {
                      go: { path: 'layout-view/main/parent/nested/child/inner/leaf' },
                    },
                  },
                  view: {
                    scene: 'parent',
                    slots: {
                      nested: [{
                        id: 'child',
                        view: {
                          scene: 'child',
                          slots: { inner: [{ id: 'leaf', view: { scene: 'leaf' } }] },
                        },
                      }],
                    },
                  },
                },
                { id: 'inactive', view: { scene: 'inactive' } },
              ],
            },
          },
        },
      },
    },
  }
}

/** Builds one recursive view graph with inherited direction and direct routes. */
function createGraphScenario(): SightyScenarioDefinition<SceneKey, SlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'runtime-view-graph',
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
                        action: 'action:runtime:macro-open-b',
                        go: { path: 'main/main/sceneB' },
                      },
                      'runtime:send-inactive': {
                        action: async ({ send }) => {
                          await send('menu', { name: 'runtime:should-not-be-sent' }, { scope: 'story', storyId: 'main' })
                        },
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
function createNavigationScenario(): SightyScenarioDefinition<NavigationSceneKey, NavigationSlotName> {
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
  let playbackProject: Sighty<PlaybackSceneKey, PlaybackSlotName> | undefined
  let gatewayProject: Sighty<GatewaySceneKey, GatewaySlotName> | undefined

  afterEach(() => {
    project?.runtime.destroy()
    navigationProject?.runtime.destroy()
    playbackProject?.runtime.destroy()
    gatewayProject?.runtime.destroy()
    project = undefined
    navigationProject = undefined
    playbackProject = undefined
    gatewayProject = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('routes a declared graph action through Sighty', async () => {
    const stage = document.createElement('div')
    const selected: (SceneKey | undefined)[] = []
    let macroExecuted = false
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async ({ send }) => {
            macroExecuted = true
            await send('layout', { name: 'runtime:macro-open-b' }, { scope: 'story', storyId: 'main' })
          },
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
      },
    })
    const unsubscribe = project.runtime.onSlotChange('main', (sceneKey) => selected.push(sceneKey))

    await project.runtime.initialize()
    expect(selected).toEqual(['menu'])
    expect(await project.runtime.dispatch({ name: 'runtime:open-b', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneB')
    expect(macroExecuted).toBe(true)
    unsubscribe()
  })

  it('forwards an action event to the active scene without seeking its transport', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    gatewayProject = new Sighty({
      scenario: {
        ...createGatewayScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createGatewayMenuScene(),
        },
      },
      runtime: {
        root: stage,
        instanceIds: { layout: 'gateway-layout-1', menu: 'gateway-menu-1' },
      },
    })

    await gatewayProject.runtime.initialize()
    const menuInstance = gatewayProject.runtime.getInstance('menu')
    if (menuInstance === undefined) throw new Error('Gateway menu instance is missing.')
    const emit = vi.spyOn(menuInstance.events, 'emit')
    const seek = vi.spyOn(menuInstance.telco, 'seek')

    expect(await gatewayProject.runtime.dispatch({
      name: 'runtime:send-content',
      sourceSceneKey: 'menu',
    })).toBe(true)
    expect(emit).toHaveBeenCalledWith(
      { name: 'runtime:set-content', data: { content: 'updated' } },
      { scope: 'story', storyId: 'main' },
    )
    expect(seek).not.toHaveBeenCalled()
  })

  it('sends host styles through CodPlay preload and releases them on destroy', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: { 'action:runtime:macro-open-b': async () => undefined },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'host-style-layout-1',
          menu: 'host-style-menu-1',
          sceneA: 'host-style-scene-a-1',
          sceneB: 'host-style-scene-b-1',
        },
        styles: [{ slot: 'sighty-host-style-test', cssText: '.host-style-test { color: red; }' }],
      },
    })

    await project.runtime.initialize()
    const style = document.head.querySelector('style[data-codplay-preload-css-slot="sighty-host-style-test"]')
    expect(style?.textContent).toContain('.host-style-test { color: red; }')

    project.runtime.destroy()
    expect(document.head.querySelector('style[data-codplay-preload-css-slot="sighty-host-style-test"]')).toBeNull()
  })

  it('rejects an action send addressed to a scene that just left the composition', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async () => undefined,
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
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async () => undefined,
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
      },
    })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'sceneA' })).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(stage.querySelector('#runtime-menu-root')).not.toBeNull()
  })

  it('rejects a referenced action that is absent from scenario.actions', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
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
      },
    })

    await expect(project.runtime.initialize()).rejects.toThrow(
      "L'action Sighty « action:runtime:macro-open-b » n'est pas définie dans scenario.actions.",
    )
  })

  it('cleans partial instances and mounts after initialization fails', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene('unexpected-main'),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async () => undefined,
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
        ...createNavigationScenario(),
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
    expect(stage.querySelector('#scene-telco-root')).not.toBeNull()
  })

  it('plays the active scene tree nested under the requested scene', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    playbackProject = new Sighty({
      scenario: {
        ...createPlaybackScenario(),
        scenes: {
          layout: createPlaybackScene('layout', ['main', 'nested', 'inner']),
          parent: createPlaybackScene('parent', []),
          child: createPlaybackScene('child', []),
          leaf: createPlaybackScene('leaf', []),
          inactive: createPlaybackScene('inactive', []),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'playback-layout-1',
          parent: 'playback-parent-1',
          child: 'playback-child-1',
          leaf: 'playback-leaf-1',
          inactive: 'playback-inactive-1',
        },
      },
    })

    await playbackProject.runtime.initialize()
    const layout = playbackProject.runtime.getInstance('layout')
    const parent = playbackProject.runtime.getInstance('parent')
    if (layout === undefined || parent === undefined) throw new Error('La composition initiale de lecture est incomplète.')

    expect(playbackProject.runtime.getInstance('child')).toBeUndefined()
    expect(playbackProject.runtime.getInstance('leaf')).toBeUndefined()
    expect(await playbackProject.runtime.dispatch({
      name: 'playback:open-leaf',
      sourceSceneKey: 'parent',
    })).toBe(true)

    const child = playbackProject.runtime.getInstance('child')
    const leaf = playbackProject.runtime.getInstance('leaf')
    if (child === undefined || leaf === undefined) throw new Error('La composition imbriquée n’a pas été sélectionnée.')
    const layoutPlay = vi.spyOn(layout.telco, 'play')
    const parentPlay = vi.spyOn(parent.telco, 'play')
    const childPlay = vi.spyOn(child.telco, 'play')
    const leafPlay = vi.spyOn(leaf.telco, 'play')
    parentPlay.mockClear()
    childPlay.mockClear()
    leafPlay.mockClear()

    await playbackProject.runtime.play('parent')
    expect(parentPlay).toHaveBeenCalledOnce()
    expect(childPlay).toHaveBeenCalledOnce()
    expect(leafPlay).toHaveBeenCalledOnce()
    expect(layoutPlay).not.toHaveBeenCalled()
    expect(playbackProject.runtime.getInstance('inactive')).toBeUndefined()

    await playbackProject.runtime.play('layout')
    expect(layoutPlay).toHaveBeenCalledOnce()
    expect(parentPlay).toHaveBeenCalledTimes(2)
    expect(childPlay).toHaveBeenCalledTimes(2)
    expect(leafPlay).toHaveBeenCalledTimes(2)
  })

  it('rejects a second composition-changing intent during the changing phase', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        ...createNavigationScenario(),
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
          'scene-layout': 'concurrent-layout-1',
          'scene-menu': 'concurrent-menu-1',
          'scene-a': 'concurrent-a-1',
          'scene-b': 'concurrent-b-1',
          'scene-c': 'concurrent-c-1',
          'scene-telco': 'concurrent-telco-1',
        },
      },
    })

    await navigationProject.runtime.initialize()
    const first = navigationProject.runtime.dispatch({
      name: 'navigation:open-a',
      sourceSceneKey: 'scene-menu',
    })
    const second = navigationProject.runtime.dispatch({
      name: 'navigation:open-a',
      sourceSceneKey: 'scene-menu',
    })

    await expect(second).resolves.toBe(false)
    await expect(first).resolves.toBe(true)
    expect(navigationProject.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
  })

  it('publishes active CodPlay events through the Sighty host event surface', async () => {
    const stage = document.createElement('div')
    const scheduler = createManualFrameScheduler()
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const events: Array<{ name: string; sourceSceneKey?: NavigationSceneKey; data?: unknown }> = []
    document.body.append(stage)
    navigationProject = new Sighty({
      scenario: {
        ...createNavigationScenario(),
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
        ...createNavigationScenario(),
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
        ...createNavigationScenario(),
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

  it('closes a binding when a scene leaves through navigation', async () => {
    const stage = document.createElement('div')
    const events: string[] = []
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async () => undefined,
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
      },
    })
    project.runtime.events.onEvent((event) => events.push(event.name))

    await project.runtime.initialize()
    const menu = project.runtime.getInstance('menu')
    if (menu === undefined) throw new Error('La scène menu de test est absente.')
    await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'menu' })
    await menu.events.emit(
      { name: 'navigation:after-exit', visibility: 'public' },
      { scope: 'scene' },
    )

    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneA')
    expect(events).toEqual([])
  })

  it('does not roll back a composition when a slot observer fails', async () => {
    const stage = document.createElement('div')
    const warning = vi.spyOn(console, 'warn')
    document.body.append(stage)
    project = new Sighty({
      scenario: {
        ...createGraphScenario(),
        scenes: {
          layout: createLayoutScene(),
          menu: createChildScene('menu'),
          sceneA: createChildScene('sceneA'),
          sceneB: createChildScene('sceneB'),
        },
        actions: {
          'action:runtime:macro-open-b': async () => undefined,
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
      },
    })
    project.runtime.onSlotChange('main', () => {
      throw new Error('observer failure')
    })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'runtime:next', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('sceneA')
    expect(warning).toHaveBeenCalledWith('SIGHTY_SLOT_LISTENER_FAILED: observer failure')
  })
})
