/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyFile } from '../src'

type SceneKey = 'layout' | 'menu' | 'sceneA' | 'sceneB'

type SlotName = 'main'

type NavigationSceneKey = 'scene-layout' | 'scene-menu' | 'scene-a' | 'scene-b' | 'scene-c' | 'scene-telco'

type NavigationSlotName = 'slot-scene' | 'slot-telco'

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
function createLayoutScene(): SceneDoc<string> {
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
            name: 'main',
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
})
