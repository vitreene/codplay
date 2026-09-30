/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayEventime, CodPlayFrameScheduler } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import {
  Sighty,
  type SightyCondition,
  type SightyConditionContext,
  type SightyScenarioDefinition,
  type SightyScenarioMutation,
  type SightyGuards,
  type SightyShowMode,
  type SightyViewList,
} from '../src'

type FeatureSceneKey = 'layout' | 'menu' | 'open' | 'locked' | 'form' | 'lazy' | 'dynamic'
type FeatureSlotName = 'main'

type RollbackSceneKey = 'layout' | 'first' | 'second' | 'dynamic'
type RollbackSlotName = 'first' | 'second'

/** Creates a deterministic CodPlay scheduler for end-signal integration tests. */
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
            'feature:data-received': null,
            'feature:entry:first': { content: 'Action du premier événement' },
            'feature:entry:second': {
              content: 'Action du second événement',
              attr: { id: `feature-${sceneKey}-root`, 'data-entry-second': 'fallback' },
            },
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

/** Creates a physical layout with two independently addressable child slots. */
function createRollbackLayout(): SceneDoc<string> {
  return {
    id: 'rollback-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'rollback-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="rollback-layout-root"><section id="rollback-first-host" data-part="rollback:first"></section><section id="rollback-second-host" data-part="rollback:second"></section></main>',
            },
          },
          {
            id: 'rollback-first-slot',
            name: 'first',
            type: 'slot',
            initial: { move: { target: 'rollback:first' } },
          },
          {
            id: 'rollback-second-slot',
            name: 'second',
            type: 'slot',
            initial: { move: { target: 'rollback:second' } },
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates one child scene used by the mutation rollback fixture. */
function createRollbackScene(sceneKey: Exclude<RollbackSceneKey, 'layout'>): SceneDoc<string> {
  return {
    id: `rollback-${sceneKey}`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `rollback-${sceneKey}-content`,
          type: 'tag',
          initial: {
            tag: 'article',
            content: sceneKey,
            attr: { id: `rollback-${sceneKey}-root` },
            move: '@root',
          },
        }],
        eventimes: [{ name: `rollback-${sceneKey}:tick`, startAt: 1_000 }],
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: 2_000 }],
    listen: [],
    tracks: {},
  }
}

/** Builds a two-slot scenario whose mutation deliberately reuses one child twice. */
function createRollbackScenario(): SightyScenarioDefinition<RollbackSceneKey, RollbackSlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'sighty-rollback-scenario',
    views: [{
      id: 'layout-view',
      coupling: {
        couplingId: 'rollback-controller',
        controllerSlot: 'first',
        controlledSlot: 'second',
        commands: {
          'rollback:play': 'play',
          'rollback:pause': 'pause',
          'rollback:toggle': 'togglePlay',
          'rollback:rate': 'setRate',
          'rollback:seek': 'seek',
          'rollback:rewind': 'rewind',
          'rollback:reset': 'reset',
        },
      },
      view: {
        scene: 'layout',
        slots: {
          first: [{ id: 'first', view: { scene: 'first' } }],
          second: [{ id: 'second', view: { scene: 'second' } }],
        },
      },
    }],
  }
}

/** Builds the recursive feature scenario used by access, data, reset and lazy tests. */
function createFeatureScenario(options: Readonly<{
  includeLazy?: boolean
  showMode?: SightyShowMode
  parentShowMode?: SightyShowMode
  openShowMode?: SightyShowMode
  openEntry?: CodPlayEventime | readonly CodPlayEventime[]
  lockedGuard?: SightyCondition<FeatureSceneKey>
}> = {}): SightyScenarioDefinition<FeatureSceneKey, FeatureSlotName> {
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
      ...(options.openShowMode === undefined ? {} : { showMode: options.openShowMode }),
      ...(options.openEntry === undefined ? {} : { entry: options.openEntry }),
      id: 'open',
      data: { mode: 'open' },
      actions: { 'feature:leave-open': { go: { path: 'layout-view/main/menu' } } },
      view: { scene: 'open' as const },
    },
    {
      id: 'locked',
      accessBy: options.lockedGuard ?? canEnterLocked,
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
    id: 'sighty-feature-scenario',
    ...(options.showMode === undefined ? {} : { showMode: options.showMode }),
    data: { mode: 'base' },
    views: [{
      id: 'layout-view',
      ...(options.parentShowMode === undefined ? {} : { showMode: options.parentShowMode }),
      view: {
        scene: 'layout',
        slots: { main: children },
      },
    }],
  }
}

/** Builds a two-level course graph with shared parent navigation and guards. */
function createPointerScenario(): SightyScenarioDefinition<FeatureSceneKey, FeatureSlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'sighty-pointer-scenario',
    views: {
      start: 'layout-view',
      views: {
        'layout-view': {
          view: {
            scene: 'layout',
            views: {
              start: 'course-view',
              views: {
                'course-view': {
                  actions: {
                    'feature:pointer-next': { go: { direction: 'next' } },
                    'feature:pointer-previous': { go: { direction: 'previous' } },
                  },
                  exitBy: 'guard:feature:page-exit',
                  view: {
                    views: {
                      start: 'chapter-1',
                      views: {
                        'chapter-1': {
                          view: {
                            slots: {
                              main: [
                                { id: 'page-a', view: { scene: 'menu' } },
                                { id: 'page-b', view: { scene: 'open' } },
                              ],
                            },
                          },
                        },
                        'chapter-2': {
                          view: {
                            slots: {
                              main: [
                                { id: 'page-c', view: { scene: 'locked' } },
                                { id: 'page-d', view: { scene: 'form' } },
                              ],
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
      },
    },
  }
}

/** Creates a mutation scenario whose initially active list contains only its menu. */
function createMutationScenario(): SightyScenarioDefinition<FeatureSceneKey, FeatureSlotName> {
  return {
    format: 'sighty',
    version: 2,
    id: 'sighty-mutation-scenario',
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
  scenario: SightyScenarioDefinition<FeatureSceneKey, FeatureSlotName>,
  options: Readonly<{
    context?: Readonly<Record<string, unknown>>
    openStyleSheet?: string
    dynamicStyleSheet?: string
    lazySource?: () => SceneDoc<string> | Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }>
    guards?: SightyGuards<FeatureSceneKey>
  }> = {},
): Sighty<FeatureSceneKey, FeatureSlotName> {
  const availableScenes: NonNullable<SightyScenarioDefinition<FeatureSceneKey, FeatureSlotName>['scenes']> = {
    layout: createFeatureLayout(),
    menu: createFeatureScene('menu'),
    open: options.openStyleSheet === undefined
      ? createFeatureScene('open')
      : { sceneDoc: createFeatureScene('open'), styleSheet: options.openStyleSheet },
    locked: createFeatureScene('locked'),
    form: createFeatureScene('form'),
    dynamic: options.dynamicStyleSheet === undefined
      ? createFeatureScene('dynamic')
      : { sceneDoc: createFeatureScene('dynamic'), styleSheet: options.dynamicStyleSheet },
  }
  const sceneSources = options.lazySource === undefined ? undefined : { lazy: options.lazySource }
  const scenes = availableScenes

  return new Sighty({
    scenario: {
      ...scenario,
      scenes,
      guards: options.guards,
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
      context: options.context,
    },
  })
}

describe('Sighty runtime feature reconstruction', () => {
  let project: Sighty<FeatureSceneKey, FeatureSlotName> | undefined
  let rollbackProject: Sighty<RollbackSceneKey, RollbackSlotName> | undefined

  afterEach(() => {
    project?.runtime.destroy()
    rollbackProject?.runtime.destroy()
    project = undefined
    rollbackProject = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('redirects a refused access condition through its declared escape', async () => {
    project = createProject(createFeatureScenario(), { context: { allowed: false } })

    await project.runtime.initialize()
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(await project.runtime.dispatch({ name: 'feature:open-locked', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
  })

  it('blocks a view exit until its condition becomes true', async () => {
    project = createProject(createFeatureScenario(), { context: { complete: false } })

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'feature:open-form', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')
    expect(await project.runtime.dispatch({ name: 'feature:leave-form', sourceSceneKey: 'form' })).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')

    await project.runtime.updateContext({ complete: true })
    expect(await project.runtime.dispatch({ name: 'feature:leave-form', sourceSceneKey: 'form' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
  })

  it('resolves a named guard from scenario.guards', async () => {
    project = createProject(
      createFeatureScenario({ lockedGuard: 'guard:feature:can-enter-locked' }),
      {
        context: { allowed: true },
        guards: {
          'guard:feature:can-enter-locked': ({ context }) => context.allowed === true,
        },
      },
    )

    await project.runtime.initialize()
    expect(await project.runtime.dispatch({ name: 'feature:open-locked', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('locked')
  })

  it('moves the internal pointer through child pages and adjacent parent views', async () => {
    project = createProject(createPointerScenario(), {
      context: { mayLeave: true },
      guards: {
        'guard:feature:page-exit': ({ context }) => context.mayLeave === true,
      },
    })

    await project.runtime.initialize()
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.scenarioState.active).toMatchObject({
      slotName: 'main',
      view: { path: 'layout-view/course-view/chapter-1/main/page-a' },
      sceneKey: 'menu',
    })
    expect(await project.runtime.dispatch({ name: 'feature:pointer-previous' })).toBe(false)

    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/course-view/chapter-1/main/page-b' } })
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('locked')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/course-view/chapter-2/main/page-c' } })
    expect(await project.runtime.dispatch({ name: 'feature:pointer-previous' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
    expect(await project.runtime.dispatch({ name: 'feature:pointer-previous' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')

    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(false)
  })

  it('applies an inherited exit guard before leaving a selected child view', async () => {
    const exitGuard = vi.fn(({ context }: { context: Readonly<Record<string, unknown>> }) => context.mayLeave === true)
    project = createProject(createPointerScenario(), {
      context: { mayLeave: false },
      guards: {
        'guard:feature:page-exit': exitGuard,
      },
    })

    await project.runtime.initialize()
    const canLeavePage = await project.runtime.scenarioState.canExit(
      { path: 'layout-view/course-view/chapter-1/main/page-a' },
      { name: 'feature:pointer-next', sourceSceneKey: 'menu' },
    )
    expect(exitGuard).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({ mayLeave: false }),
    }))
    expect(canLeavePage).toBe(false)
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/course-view/chapter-1/main/page-a' } })

    await project.runtime.updateContext({ mayLeave: true })
    expect(await project.runtime.dispatch({ name: 'feature:pointer-next' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/course-view/chapter-1/main/page-b' } })
  })

  it('exposes the active scenario state and evaluates the same access and exit guards as navigation', async () => {
    project = createProject(createFeatureScenario(), {
      context: { allowed: false, complete: false },
    })

    await project.runtime.initialize()
    const activeSelection = project.runtime.scenarioState.current.find(
      (selection) => selection.slotName === 'main',
    )
    expect(activeSelection).toMatchObject({
      slotName: 'main',
      view: { path: 'layout-view/main/menu' },
      sceneKey: 'menu',
    })
    expect(project.runtime.scenarioState.active).toEqual(activeSelection)
    expect(project.runtime.scenarioState.context.allowed).toBe(false)

    const lockedReference = { path: 'layout-view/main/locked' }
    const lockedEvent = { name: 'feature:open-locked', sourceSceneKey: 'menu' as const }
    expect(await project.runtime.scenarioState.canAccess(lockedReference, lockedEvent)).toBe(false)
    expect(await project.runtime.dispatch(lockedEvent)).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/open' } })

    await project.runtime.reset()
    await project.runtime.updateContext({ allowed: true })
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/menu' } })
    expect(project.runtime.scenarioState.context.allowed).toBe(true)
    expect(await project.runtime.scenarioState.canAccess(lockedReference, lockedEvent)).toBe(true)
    expect(await project.runtime.dispatch(lockedEvent)).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('locked')

    await project.runtime.reset()
    await project.runtime.dispatch({ name: 'feature:open-form', sourceSceneKey: 'menu' })
    const formReference = { path: 'layout-view/main/form' }
    const leaveEvent = { name: 'feature:leave-form', sourceSceneKey: 'form' as const }
    expect(await project.runtime.scenarioState.canExit(formReference, leaveEvent)).toBe(false)
    expect(await project.runtime.dispatch(leaveEvent)).toBe(false)
    expect(project.runtime.getMountedSceneKey('main')).toBe('form')

    await project.runtime.updateContext({ complete: true })
    expect(project.runtime.scenarioState.context.complete).toBe(true)
    expect(await project.runtime.scenarioState.canExit(formReference, leaveEvent)).toBe(true)
    expect(await project.runtime.dispatch(leaveEvent)).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
  })

  it('delivers entry data once and keeps context changes out of the scene event path', async () => {
    project = createProject(createFeatureScenario({
      openEntry: { name: 'feature:data-received', data: { content: 'initial' } },
    }), { context: { title: 'initial' } })

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')

    await project.runtime.updateContext({ title: 'updated' })
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')
  })

  it('sends one or more declared entry eventimes to the admitted scene', async () => {
    project = createProject(createFeatureScenario({
      openEntry: [
        {
          name: 'feature:entry:first',
          data: { attr: { id: 'feature-open-root', 'data-entry-first': 'received' } },
        },
        {
          name: 'feature:entry:second',
          data: { attr: { id: 'feature-open-root', 'data-entry-second': 'received' } },
        },
      ],
    }))

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    const openRoot = document.querySelector('#feature-open-root')
    expect(openRoot?.textContent).toBe('Action du second événement')
    expect(openRoot?.getAttribute('data-entry-second')).toBe('received')
  })

  it('accepts one declared entry eventime', async () => {
    project = createProject(createFeatureScenario({
      openEntry: { name: 'feature:entry:first' },
    }))

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    expect(document.querySelector('#feature-open-root')?.textContent).toBe('Action du premier événement')
  })

  it('copies entry event data supplied by a scenario mutation', async () => {
    project = createProject(createFeatureScenario())
    await project.runtime.initialize()

    const entry = {
      name: 'feature:entry:first',
      data: { content: 'Payload copié par la mutation' },
    }
    await project.runtime.mutate({
      kind: 'update-view',
      target: { path: 'layout-view/main/open' },
      patch: { entry },
    })
    entry.data.content = 'Payload muté après la mutation'

    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    expect(document.querySelector('#feature-open-root')?.textContent).toBe('Payload copié par la mutation')
  })

  it('resets a readmitted scene through its inherited showMode on the retained CodPlay instance', async () => {
    project = createProject(
      createFeatureScenario({
        showMode: 'maintain',
        parentShowMode: 'reset',
        openEntry: { name: 'feature:data-received', data: { content: 'initial' } },
      }),
      { context: { title: 'initial' } },
    )

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    const open = project.runtime.getInstance('open')
    if (open === undefined) throw new Error('La scène open de test est absente.')
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')
    await project.runtime.updateContext({ title: 'changed' })
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')
    await open.telco.pause()
    await open.telco.seek(1_500)

    await project.runtime.dispatch({ name: 'feature:leave-open', sourceSceneKey: 'open' })
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    expect(project.runtime.getInstance('open')).toBe(open)
    expect(document.querySelector('#feature-open-root')?.textContent).toBe('initial')
    expect(open.telco.getProgress().timelineMs).toBeLessThan(1_000)
    expect(open.telco.getState().status).toBe('playing')
  })

  it('maintains a scene occurrence and its paused state when its view declares maintain', async () => {
    project = createProject(createFeatureScenario({ showMode: 'maintain' }))

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    const open = project.runtime.getInstance('open')
    if (open === undefined) throw new Error('La scène open de test est absente.')
    await open.telco.pause()
    await open.telco.seek(1_500)

    await project.runtime.dispatch({ name: 'feature:leave-open', sourceSceneKey: 'open' })
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    expect(project.runtime.getInstance('open')).toBe(open)
    expect(open.telco.getProgress().timelineMs).toBeGreaterThanOrEqual(1_500)
    expect(open.telco.getState().status).toBe('paused')
  })

  it('rewinds and starts a retained scene when its view declares rewind', async () => {
    project = createProject(createFeatureScenario({ showMode: 'rewind' }))

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    const open = project.runtime.getInstance('open')
    if (open === undefined) throw new Error('La scène open de test est absente.')
    await open.telco.pause()
    await open.telco.seek(1_500)

    await project.runtime.dispatch({ name: 'feature:leave-open', sourceSceneKey: 'open' })
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })

    expect(project.runtime.getInstance('open')).toBe(open)
    expect(open.telco.getProgress().timelineMs).toBeLessThan(1_000)
    expect(open.telco.getState().status).toBe('playing')
  })

  it('restores the initial context on reset', async () => {
    project = createProject(createFeatureScenario(), { context: { allowed: false } })

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open', sourceSceneKey: 'menu' })
    const open = project.runtime.getInstance('open')
    if (open === undefined) throw new Error('La scène open de test est absente.')
    await project.runtime.updateContext({ allowed: true })
    await project.runtime.reset()

    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.getInstance('open')).toBeUndefined()
    expect(open.telco.getProgress().timelineMs).toBe(0)
    await project.runtime.dispatch({ name: 'feature:open-locked', sourceSceneKey: 'menu' })
    expect(project.runtime.getMountedSceneKey('main')).toBe('open')
    expect(project.runtime.getInstance('open')).toBe(open)
  })

  it('resolves a lazy scene only when its view is selected', async () => {
    let sourceCalls = 0
    project = createProject(createFeatureScenario({ includeLazy: true }), {
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

  it('installs a direct scene stylesheet through the scoped CodPlay preload channel', async () => {
    project = createProject(createFeatureScenario(), {
      openStyleSheet: '.feature-open-root { color: red; }',
    })
    const root = document.body.lastElementChild as HTMLElement

    await project.runtime.initialize()

    const style = document.head.querySelector<HTMLStyleElement>(
      'style[data-codplay-preload-css-slot="sighty-scene:open"]',
    )
    const scope = root.getAttribute('data-codplay-scope')
    expect(style?.textContent).toContain('@scope ([data-codplay-scope=')
    expect(style?.textContent).toContain(`data-codplay-scope="${scope}"`)
    expect(style?.textContent).toContain('.feature-open-root { color: red; }')

    project.runtime.destroy()
    expect(document.head.querySelector('style[data-codplay-preload-css-slot="sighty-scene:open"]')).toBeNull()
  })

  it('installs a deferred scene stylesheet before mounting its selected scene', async () => {
    project = createProject(createFeatureScenario({ includeLazy: true }), {
      lazySource: () => ({
        sceneDoc: createFeatureScene('lazy'),
        styleSheet: '.feature-lazy-root { color: blue; }',
      }),
    })

    await project.runtime.initialize()
    await project.runtime.dispatch({ name: 'feature:open-lazy', sourceSceneKey: 'menu' })

    const style = document.head.querySelector<HTMLStyleElement>(
      'style[data-codplay-preload-css-slot="sighty-scene:lazy"]',
    )
    expect(style?.textContent).toContain('.feature-lazy-root { color: blue; }')
    expect(document.querySelector('#feature-lazy-root')).not.toBeNull()
  })

  it('applies a validated view mutation and removes a hidden active view', async () => {
    project = createProject(createMutationScenario(), {
      dynamicStyleSheet: '.feature-dynamic-root { color: green; }',
    })

    await project.runtime.initialize()
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/menu' } })
    expect(await project.runtime.mutate({
      kind: 'add-view',
      parent: { path: 'layout-view' },
      slot: 'main',
      id: 'dynamic',
      view: { view: { scene: 'dynamic' } },
    })).toBe(true)
    expect(project.scenario.version).toBe(3)
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/menu' } })
    expect(await project.runtime.dispatch({ name: 'feature:next', sourceSceneKey: 'menu' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('dynamic')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/dynamic' } })
    expect(document.head.querySelector('style[data-codplay-preload-css-slot="sighty-scene:dynamic"]')).not.toBeNull()

    expect(await project.runtime.mutate({
      kind: 'hide-view',
      target: { path: 'layout-view/main/dynamic' },
    })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('menu')
    expect(project.runtime.scenarioState.active).toMatchObject({ view: { path: 'layout-view/main/menu' } })
    expect(project.runtime.getInstance('dynamic')).toBeUndefined()
    expect(document.head.querySelector('style[data-codplay-preload-css-slot="sighty-scene:dynamic"]')).toBeNull()
  })

  it('keeps same-scene occurrences independent and restores them after a later mount failure', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    rollbackProject = new Sighty<RollbackSceneKey, RollbackSlotName>({
      scenario: {
        ...createRollbackScenario(),
        scenes: {
          layout: createRollbackLayout(),
          first: createRollbackScene('first'),
          second: createRollbackScene('second'),
          dynamic: createRollbackScene('dynamic'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'rollback-layout-1',
          first: 'rollback-first-1',
          second: 'rollback-second-1',
          dynamic: 'rollback-dynamic-1',
        },
      },
    })
    await rollbackProject.runtime.initialize()
    const firstInstance = rollbackProject.runtime.getInstance('first')
    const secondInstance = rollbackProject.runtime.getInstance('second')
    if (firstInstance === undefined || secondInstance === undefined) {
      throw new Error('Rollback fixture instances are missing.')
    }

    const invalidMutation = {
      kind: 'update-view',
      target: { path: 'layout-view' },
      patch: {
        view: {
          scene: 'layout',
          slots: {
            first: [{ id: 'first', view: { scene: 'dynamic' } }],
            second: [{ id: 'second', view: { scene: 'dynamic' } }],
            broken: [{ id: 'broken', view: { scene: 'dynamic' } }],
          },
        },
      },
    } as unknown as SightyScenarioMutation<RollbackSceneKey, RollbackSlotName>

    await expect(rollbackProject.runtime.mutate(invalidMutation)).rejects.toThrow(
      'Slot "broken" was not found',
    )

    expect(rollbackProject.runtime.getMountedSceneKey('first')).toBe('first')
    expect(rollbackProject.runtime.getMountedSceneKey('second')).toBe('second')
    expect(rollbackProject.runtime.getInstance('first')).toBe(firstInstance)
    expect(rollbackProject.runtime.getInstance('second')).toBe(secondInstance)
    expect(rollbackProject.runtime.getInstance('dynamic')).toBeUndefined()
    expect(stage.querySelector('#rollback-first-root')).not.toBeNull()
    expect(stage.querySelector('#rollback-second-root')).not.toBeNull()
    expect(stage.querySelector('#rollback-dynamic-root')).toBeNull()

    await expect(rollbackProject.runtime.mutate(invalidMutation, 'reload')).rejects.toThrow(
      'Slot "broken" was not found',
    )

    expect(rollbackProject.runtime.getMountedSceneKey('first')).toBe('first')
    expect(rollbackProject.runtime.getMountedSceneKey('second')).toBe('second')
    expect(rollbackProject.runtime.getInstance('first')).toBeDefined()
    expect(rollbackProject.runtime.getInstance('second')).toBeDefined()
    expect(rollbackProject.runtime.getInstance('dynamic')).toBeUndefined()
    expect(stage.querySelector('#rollback-first-root')).not.toBeNull()
    expect(stage.querySelector('#rollback-second-root')).not.toBeNull()
    expect(stage.querySelector('#rollback-dynamic-root')).toBeNull()
  })

  it('exposes and controls each active occurrence independently by slot', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    rollbackProject = new Sighty<RollbackSceneKey, RollbackSlotName>({
      scenario: {
        ...createRollbackScenario(),
        scenes: {
          layout: createRollbackLayout(),
          first: createRollbackScene('first'),
          second: createRollbackScene('second'),
          dynamic: createRollbackScene('dynamic'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'independent-layout-1',
          first: 'independent-first-1',
          second: 'independent-second-1',
          dynamic: 'independent-dynamic-1',
        },
      },
    })

    await rollbackProject.runtime.initialize()
    const mutation = {
      kind: 'update-view',
      target: { path: 'layout-view' },
      patch: {
        view: {
          scene: 'layout',
          slots: {
            first: [{ id: 'first', view: { scene: 'dynamic' } }],
            second: [{ id: 'second', view: { scene: 'dynamic' } }],
          },
        },
      },
    } as unknown as SightyScenarioMutation<RollbackSceneKey, RollbackSlotName>

    await expect(rollbackProject.runtime.mutate(mutation)).resolves.toBe(true)
    const first = rollbackProject.runtime.getInstanceAt('layout-view/first')
    const second = rollbackProject.runtime.getInstanceAt('layout-view/second')
    if (first === undefined || second === undefined) throw new Error('Independent occurrences are missing.')
    expect(first).not.toBe(second)
    expect(first.instanceId).not.toBe(second.instanceId)
    expect(rollbackProject.runtime.getInstance('dynamic')).toBeUndefined()

    first.telco.setRate(0.5)
    second.telco.setRate(1.5)
    expect(first.telco.rate).toBe(0.5)
    expect(second.telco.rate).toBe(1.5)
    await first.telco.play()
    await second.telco.play()
    await first.telco.pause()
    expect(first.telco.getState().status).toBe('paused')
    expect(second.telco.getState().status).not.toBe('paused')
  })

  it('keeps scene:end mounted and lets sequence:end terminalize CodPlay', async () => {
    const stage = document.createElement('div')
    const scheduler = createManualFrameScheduler()
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const events: string[] = []
    document.body.append(stage)
    rollbackProject = new Sighty<RollbackSceneKey, RollbackSlotName>({
      scenario: {
        ...createRollbackScenario(),
        scenes: {
          layout: createRollbackLayout(),
          first: createRollbackScene('first'),
          second: createRollbackScene('second'),
          dynamic: createRollbackScene('dynamic'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'end-layout-1',
          first: 'end-first-1',
          second: 'end-second-1',
          dynamic: 'end-dynamic-1',
        },
        codplay: { frameScheduler: scheduler, pauseOnDocumentHidden: false },
      },
    })
    rollbackProject.runtime.events.onEvent((event) => events.push(event.name))

    await rollbackProject.runtime.initialize()
    const first = rollbackProject.runtime.getInstanceAt('layout-view/first')
    if (first === undefined) throw new Error('La scène first de fin est absente.')
    await first.telco.play()
    await first.events.emit(
      { name: 'scene:end', startAt: 100, visibility: 'public' },
      { scope: 'scene' },
    )

    now.mockReturnValue(150)
    scheduler.flush()
    expect(events).toContain('scene:end')
    expect(first.telco.getState().sequenceEnded).toBe(false)
    expect(rollbackProject.runtime.getMountedSceneKey('first')).toBe('first')
    expect(rollbackProject.runtime.getInstanceAt('layout-view/first')).toBe(first)
    expect(stage.querySelector('#rollback-first-root')).not.toBeNull()

    await first.events.emit(
      { name: 'sequence:end', startAt: 100, visibility: 'public' },
      { scope: 'scene' },
    )
    now.mockReturnValue(300)
    scheduler.flush()
    await vi.waitFor(() => {
      expect(events).toContain('sequence:end')
      expect(first.telco.getState().sequenceEnded).toBe(true)
      expect(first.telco.getState().status).toBe('paused')
    })
    expect(rollbackProject.runtime.getMountedSceneKey('first')).toBe('first')
    expect(rollbackProject.runtime.getInstanceAt('layout-view/first')).toBe(first)
    expect(stage.querySelector('#rollback-first-root')).not.toBeNull()
  })

  it('mediates every declared telco command through the active source binding', async () => {
    const stage = document.createElement('div')
    document.body.append(stage)
    rollbackProject = new Sighty<RollbackSceneKey, RollbackSlotName>({
      scenario: {
        ...createRollbackScenario(),
        scenes: {
          layout: createRollbackLayout(),
          first: createRollbackScene('first'),
          second: createRollbackScene('second'),
          dynamic: createRollbackScene('dynamic'),
        },
      },
      runtime: {
        root: stage,
        instanceIds: {
          layout: 'coupling-layout-1',
          first: 'coupling-first-1',
          second: 'coupling-second-1',
          dynamic: 'coupling-dynamic-1',
        },
      },
    })

    await rollbackProject.runtime.initialize()
    const controller = rollbackProject.runtime.getInstanceAt('layout-view/first')
    const controlled = rollbackProject.runtime.getInstanceAt('layout-view/second')
    if (controller === undefined || controlled === undefined) {
      throw new Error('Coupling fixture instances are missing.')
    }
    await rollbackProject.runtime.play('first')
    await rollbackProject.runtime.play('second')
    await controlled.telco.pause()
    const play = vi.spyOn(controlled.telco, 'play')
    const pause = vi.spyOn(controlled.telco, 'pause')
    const seek = vi.spyOn(controlled.telco, 'seek')
    const rewind = vi.spyOn(controlled.telco, 'rewind')
    const reset = vi.spyOn(controlled.telco, 'reset')
    const published: string[] = []
    rollbackProject.runtime.events.onEvent((event) => published.push(event.name))
    const target = { scope: 'story', storyId: 'main' } as const
    const emit = async (
      name: string,
      data?: CodPlayEventime['data'],
    ): Promise<void> => {
      const eventime: CodPlayEventime = {
        name,
        visibility: 'public',
        ...(data === undefined ? {} : { data }),
      }
      await controller.events.emit(eventime, target)
      await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 100))
    }

    await emit('rollback:play')
    expect(published).toContain('rollback:play')
    expect(play).toHaveBeenCalled()
    expect(controlled.telco.getState().status).toBe('playing')
    await emit('rollback:pause')
    expect(pause).toHaveBeenCalled()
    expect(controlled.telco.getState().status).toBe('paused')
    await emit('rollback:toggle')
    expect(controlled.telco.getState().status).toBe('playing')
    await emit('rollback:rate', { rate: 1.5 })
    expect(controlled.telco.rate).toBe(1.5)
    await emit('rollback:seek', { timeMs: 25 })
    expect(seek).toHaveBeenCalledWith(25)
    await emit('rollback:rewind')
    expect(rewind).toHaveBeenCalled()
    await controlled.telco.seek(1_500)
    await emit('rollback:reset')
    expect(reset).toHaveBeenCalled()
    expect(controlled.telco.getProgress().timelineMs).toBe(0)
    expect(controlled.telco.getState().sequenceEnded).toBe(false)
  })
})
