/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import type { SceneDoc } from 'codplay/scene/types'
import {
  Sighty,
  type SightyConditionContext,
  type SightyFile,
  type SightyScenarioResources,
  type SightyViewList,
} from '../src'

type FeatureSceneKey = 'layout' | 'menu' | 'open' | 'locked' | 'form' | 'lazy' | 'dynamic'
type FeatureSlotName = 'main'

const scenePaths: Readonly<Record<FeatureSceneKey, string>> = {
  layout: './layout',
  menu: './menu',
  open: './open',
  locked: './locked',
  form: './form',
  lazy: './lazy',
  dynamic: './dynamic',
}

/** Creates the layout document that exposes one physical Sighty slot. */
function createFeatureLayout(): SceneDoc<string> {
  return {
    id: 'feature-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'feature-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="feature-layout-root"><section id="feature-slot-main" data-part="feature:main"></section></main>',
            },
          },
          {
            id: 'feature-main-slot',
            name: 'main',
            type: 'slot',
            initial: { move: { target: 'feature:main' } },
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates a visible child scene and optionally attaches a story listen pipeline. */
function createFeatureScene(
  sceneKey: Exclude<FeatureSceneKey, 'layout'>,
  listen: NonNullable<SceneDoc<string>['stories'][string]['listen']> = [],
): SceneDoc<string> {
  return {
    id: `feature-${sceneKey}`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `feature-${sceneKey}-content`,
          type: 'tag',
          initial: {
            tag: 'article',
            content: sceneKey,
            attr: { id: `feature-${sceneKey}-root` },
            move: '@root',
          },
          actions: sceneKey === 'open' ? {
            'data:update': null,
            'feature:data-received': null,
          } : {},
        }],
        listen,
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Builds the recursive feature file used by access, data, reset and lazy tests. */
function createFeatureFile(options: Readonly<{ includeLazy?: boolean }> = {}): SightyFile<FeatureSceneKey, FeatureSlotName> {
  const canEnterLocked = ({ context }: SightyConditionContext<FeatureSceneKey>): boolean => context.allowed === true
  const children: SightyViewList<FeatureSceneKey, FeatureSlotName> = [
    {
      id: 'menu',
      actions: {
        'feature:open-locked': { go: { path: 'layout-view/main/locked' } },
        'feature:open': { go: { path: 'layout-view/main/open' } },
        'feature:open-form': { go: { path: 'layout-view/main/form' } },
        ...(options.includeLazy ? { 'feature:open-lazy': { go: { path: 'layout-view/main/lazy' } } } : {}),
      },
      view: { scene: 'menu' as const },
    },
    {
      id: 'open',
      data: {
        content: { from: 'context.title', update: 'live' as const },
        mode: { from: 'data.mode', update: 'entry' as const },
      },
      view: { scene: 'open' as const },
    },
    {
      id: 'locked',
      accessBy: canEnterLocked,
      onDenied: { path: 'layout-view/main/open' },
      view: { scene: 'locked' as const },
    },
    {
      id: 'form',
      actions: { 'feature:leave-form': { go: { path: 'layout-view/main/menu' } } },
      exitBy: ({ context }: SightyConditionContext<FeatureSceneKey>): boolean => context.complete === true,
      view: { scene: 'form' as const },
    },
    ...(options.includeLazy
      ? [{ id: 'lazy', view: { scene: 'lazy' as const } }]
      : []),
  ]

  return {
    format: 'sighty',
    version: 2,
    id: 'sighty-feature-file',
    data: { mode: 'base' },
    resources: {
      scenes: {
        layout: scenePaths.layout,
        menu: scenePaths.menu,
        open: scenePaths.open,
        locked: scenePaths.locked,
        form: scenePaths.form,
        ...(options.includeLazy ? { lazy: scenePaths.lazy } : {}),
      },
    },
    views: [{
      id: 'layout-view',
      view: {
        scene: 'layout',
        slots: { main: children },
      },
    }],
  }
}

/** Creates a mutation file whose initially active list contains only its menu. */
function createMutationFile(): SightyFile<FeatureSceneKey, FeatureSlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'sighty-mutation-file',
    resources: {
      scenes: {
        layout: scenePaths.layout,
        menu: scenePaths.menu,
        dynamic: scenePaths.dynamic,
      },
    },
    views: [{
      id: 'layout-view',
      view: {
        scene: 'layout',
        slots: {
          main: [{
            id: 'menu',
            actions: { 'feature:next': { go: { direction: 'next' } } },
            view: { scene: 'menu' },
          }],
        },
      },
    }],
  }
}

/** Creates one Sighty project with direct scenes and optional deferred sources. */
function createProject(
  file: SightyFile<FeatureSceneKey, FeatureSlotName>,
  options: Readonly<{
    context?: Readonly<Record<string, unknown>>
    lazySource?: () => SceneDoc<string>
  }> = {},
): Sighty<FeatureSceneKey, FeatureSlotName> {
  const availableScenes: NonNullable<SightyScenarioResources<FeatureSceneKey, FeatureSlotName>['scenes']> = {
    layout: createFeatureLayout(),
    menu: createFeatureScene('menu'),
    open: createFeatureScene('open'),
    locked: createFeatureScene('locked'),
    form: createFeatureScene('form'),
    dynamic: createFeatureScene('dynamic'),
  }
  const sceneSources = options.lazySource === undefined ? undefined : { lazy: options.lazySource }
  const scenes = Object.fromEntries(
    Object.entries(availableScenes).filter(([sceneKey]) => (
      file.resources?.scenes?.[sceneKey as FeatureSceneKey] !== undefined
      && sceneKey !== 'lazy'
    )),
  )

  return new Sighty({
    scenario: {
      file,
      scenes,
      ...(sceneSources === undefined ? {} : { sceneSources }),
    },
    runtime: {
      root: document.body.appendChild(document.createElement('div')),
      instanceIds: {
        layout: 'feature-layout-1',
        menu: 'feature-menu-1',
        open: 'feature-open-1',
        locked: 'feature-locked-1',
        form: 'feature-form-1',
        lazy: 'feature-lazy-1',
        dynamic: 'feature-dynamic-1',
      },
      layout: { sceneKey: 'layout', storyId: 'main' },
      context: options.context,
    },
  })
}

describe('Sighty runtime feature reconstruction', () => {
  let project: Sighty<FeatureSceneKey, FeatureSlotName> | undefined

  afterEach(() => {
    project?.runtime.destroy()
    project = undefined
    document.body.replaceChildren()
  })

  it('redirects a refused access condition through its declared escape', async () => {
    project = createProject(createFeatureFile(), { context: { allowed: false } })

    await project.runtime.initialize()
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(await project.runtime.dispatch({ name: 'feature:open-locked', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
  })

  it('blocks a view exit until its condition becomes true', async () => {
    project = createProject(createFeatureFile(), { context: { complete: false } })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'feature:open-form', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')
    expect(await project.runtime.dispatch({ name: 'feature:leave-form', sourceSceneKey: 'form' })).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')

    await project.runtime.updateContext({ complete: true })
    expect(await project.runtime.dispatch({ name: 'feature:leave-form', sourceSceneKey: 'form' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
  })

  it('delivers entry and live data through the active scene event path', async () => {
    project = createProject(createFeatureFile(), { context: { title: 'initial' } })

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')

    await project.runtime.updateContext({ title: 'updated' })
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('updated')
  })

  it('recreates scene instances and restores the initial context on reset', async () => {
    project = createProject(createFeatureFile(), { context: { allowed: false } })

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    const previousOpen = project.runtime.getInstance('open')
    await project.runtime.updateContext({ allowed: true })
    await project.runtime.reset()

    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.getInstance('open')).not.toBe(previousOpen)
    await project.runtime.dispatch({ name: 'feature:open-locked', sourceSceneKey: 'menu' })
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
  })

  it('resolves a lazy scene only when its view is selected', async () => {
    let sourceCalls = 0
    project = createProject(createFeatureFile({ includeLazy: true }), {
      lazySource: () => {
        sourceCalls += 1
        return createFeatureScene('lazy')
      },
    })

    await project.runtime.initialize()
    expect(sourceCalls).toBe(0)
    expect(project.runtime.getInstance('lazy')).toBeUndefined()

    await project.runtime.dispatch({ name: 'feature:open-lazy', sourceSceneKey: 'menu' })
    expect(sourceCalls).toBe(1)
    expect(project.runtime.getMountedSceneKey('main')).toBe('lazy')
    expect(project.runtime.getInstance('lazy')).toBeDefined()
  })

  it('applies a validated view mutation and removes a hidden active view', async () => {
    project = createProject(createMutationFile())

    await project.runtime.initialize()
    expect(await project.runtime.mutate({
      kind: 'add-view',
      parent: { path: 'layout-view' },
      slot: 'main',
      id: 'dynamic',
      view: { view: { scene: 'dynamic' } },
    })).toBe(true)
    expect(project.scenario.file.version).toBe(3)
    expect(await project.runtime.dispatch({ name: 'feature:next', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('dynamic')

    expect(await project.runtime.mutate({
      kind: 'hide-view',
      target: { path: 'layout-view/main/dynamic' },
    })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.getInstance('dynamic')).toBeUndefined()
  })
})
