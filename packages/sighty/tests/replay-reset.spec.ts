/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'

import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyScenarioDefinition } from '../src'

type ReplaySceneKey = 'layout' | 'menu' | 'quiz' | 'landing' | 'lazy'
type ReplaySlotName = 'left' | 'right'

/** Creates a layout with two independent scene slots. */
function createReplayLayout(): SceneDoc<string> {
  return {
    id: 'replay-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'replay-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="replay-layout-root"><section id="replay-left-host" data-part="replay:left"></section><section id="replay-right-host" data-part="replay:right"></section></main>',
            },
          },
          { id: 'replay-left-slot', name: 'left', type: 'slot', initial: { move: { target: 'replay:left' } } },
          { id: 'replay-right-slot', name: 'right', type: 'slot', initial: { move: { target: 'replay:right' } } },
        ],
      },
    },
  }
}

/** Creates a minimal scene that reports each reset event received by its story. */
function createReplayScene(
  sceneKey: Exclude<ReplaySceneKey, 'layout' | 'lazy'>,
  onEvent: () => void = () => undefined,
): SceneDoc<string> {
  const stories: Record<string, ReturnType<typeof createReplayStory>> = {
    main: createReplayStory(sceneKey, 'main', onEvent),
  }
  if (sceneKey === 'quiz') stories.secondary = createReplayStory(sceneKey, 'secondary', onEvent)

  return {
    id: `replay-${sceneKey}`,
    stories,
  }
}

/** Creates one story that handles reset events through its own listen pipeline. */
function createReplayStory(
  sceneKey: string,
  storyId: string,
  onEvent: () => void,
) {
  return {
    id: storyId,
    initial: { move: '@root' },
    state: { resetCount: 0 },
    straps: {
      'replay-record-reset': () => {
        onEvent()
        return { update: { resetCount: 1 } }
      },
    },
    listen: [{ on: 'replay:scene-reset', straps: ['replay-record-reset'] }],
    eventimes: [{ name: 'replay:timeline-marker', startAt: 4_000 }],
    persos: [{
      id: `replay-${sceneKey}-${storyId}-content`,
      type: 'tag' as const,
      initial: { tag: 'article', content: sceneKey, move: '@root' },
    }],
  }
}

/** Creates the two-slot scenario used to exercise replay reset routing. */
function createReplayScenario(
  onReset: (keys: readonly string[]) => void,
  onSceneReset: () => void,
  afterReset: (result: Readonly<{ contextValue: unknown; activeSceneKey: ReplaySceneKey | undefined }>) => void,
  onLazyResolve: () => void = () => undefined,
): SightyScenarioDefinition<ReplaySceneKey, ReplaySlotName> {
  return {
    format: 'sighty',
    version: 1,
    id: 'replay-reset-fixture',
    views: [{
      id: 'layout-view',
      view: {
        scene: 'layout',
        slots: {
          left: [
            {
              id: 'menu',
              actions: {
                'replay:open-left-quiz': { go: { path: 'layout-view/left/left-quiz' } },
                'replay:reset-all': {
                  go: { path: 'layout-view/left/landing' },
                  reset: ['all'],
                  action: ({ context, scenarioState }) => afterReset({
                    contextValue: context.value,
                    activeSceneKey: scenarioState.active?.sceneKey,
                  }),
                },
                'replay:reset-quiz': { reset: ['quiz'] },
                'replay:no-reset': { action: async () => undefined },
                'replay:open-lazy': { go: { path: 'layout-view/left/lazy' } },
              },
              view: { scene: 'menu' },
            },
            {
              id: 'left-quiz',
              showMode: 'maintain',
              actions: { 'replay:leave-left-quiz': { go: { path: 'layout-view/left/menu' } } },
              view: { scene: 'quiz' },
            },
            { id: 'landing', view: { scene: 'landing' } },
            {
              id: 'lazy',
              actions: { 'replay:leave-lazy': { go: { path: 'layout-view/left/menu' } } },
              view: { scene: 'lazy' },
            },
          ],
          right: [{ id: 'right-quiz', showMode: 'maintain', view: { scene: 'quiz' } }],
        },
      },
    }],
    scenes: {
      layout: createReplayLayout(),
      menu: createReplayScene('menu'),
      landing: createReplayScene('landing'),
      quiz: {
        sceneDoc: createReplayScene('quiz', onSceneReset),
        onReset: (keys) => {
          onReset(keys)
          return keys.includes('all') || keys.includes('quiz')
            ? { name: 'replay:scene-reset', data: { keys: [...keys] } }
            : undefined
        },
      },
    },
    sceneSources: {
      lazy: () => resolveLazyScene(onLazyResolve, onSceneReset, onReset),
    },
  }
}

/** Records that a deferred scene was actually needed and returns its source. */
function resolveLazyScene(
  onResolve: () => void,
  onSceneReset: () => void,
  onReset: (keys: readonly string[]) => void,
) {
  onResolve()
  return {
    sceneDoc: createReplayScene('quiz', onSceneReset),
    onReset: (keys: readonly string[]) => {
      onReset(keys)
      return keys.includes('all') || keys.includes('quiz')
        ? { name: 'replay:scene-reset', data: { keys: [...keys] } }
        : undefined
    },
  }
}

describe('Sighty replay reset', () => {
  it('resets context after routing and notifies every retained occurrence once per scene key', async () => {
    const onReset = vi.fn()
    const onSceneReset = vi.fn()
    const afterReset = vi.fn()
    const onLazyResolve = vi.fn()
    const project = new Sighty<ReplaySceneKey, ReplaySlotName>({
      scenario: createReplayScenario(onReset, onSceneReset, afterReset, onLazyResolve),
      runtime: {
        root: document.body.appendChild(document.createElement('div')),
        instanceIds: {
          layout: 'replay-layout-1',
          menu: 'replay-menu-1',
          quiz: 'replay-quiz-1',
          landing: 'replay-landing-1',
          lazy: 'replay-lazy-1',
        },
        context: { value: 'initial' },
      },
    })

    try {
      await project.runtime.initialize()
      const rightQuiz = project.runtime.getInstanceAt('layout-view/right')
      expect(rightQuiz).toBeDefined()
      await rightQuiz!.telco.play()
      await rightQuiz!.telco.pause()
      await rightQuiz!.telco.seek(1_500)

      await project.runtime.dispatch({ name: 'replay:open-left-quiz' })
      const leftQuiz = project.runtime.getInstanceAt('layout-view/left')
      expect(leftQuiz).toBeDefined()
      await project.runtime.dispatch({ name: 'replay:leave-left-quiz' })
      expect(project.runtime.getMountedSceneKey('left')).toBe('menu')

      await project.runtime.updateContext({ value: 'progressed' })
      expect(await project.runtime.dispatch({ name: 'replay:no-reset' })).toBe(true)
      expect(project.runtime.scenarioState.context.value).toBe('progressed')
      expect(onReset).not.toHaveBeenCalled()

      expect(await project.runtime.dispatch({ name: 'replay:reset-all' })).toBe(true)
      expect(project.runtime.getMountedSceneKey('left')).toBe('landing')
      expect(project.runtime.scenarioState.context.value).toBe('initial')
      expect(onReset).toHaveBeenCalledTimes(1)
      expect(onReset).toHaveBeenCalledWith(['all'])
      expect(onLazyResolve).not.toHaveBeenCalled()
      expect(onSceneReset).toHaveBeenCalledTimes(4)
      expect(project.runtime.getInstanceAt('layout-view/right')).toBe(rightQuiz)
      expect(rightQuiz!.telco.getProgress().timelineMs).toBeCloseTo(1_500, -2)
      expect(rightQuiz!.telco.getState().status).toBe('paused')
      expect(afterReset).toHaveBeenCalledWith({ contextValue: 'initial', activeSceneKey: 'landing' })
    } finally {
      project.runtime.destroy()
      document.body.replaceChildren()
    }
  })

  it('does not resolve a deferred source merely to run a reset callback', async () => {
    let lazySourceCalls = 0
    const onSceneReset = vi.fn()
    const onLazyReset = vi.fn()
    const scenario = createReplayScenario(vi.fn(), onSceneReset, vi.fn())
    const project = new Sighty<ReplaySceneKey, ReplaySlotName>({
      scenario: {
        ...scenario,
        scenes: {
          ...scenario.scenes,
          layout: createReplayLayout(),
          menu: createReplayScene('menu'),
        },
        sceneSources: {
          lazy: () => {
            lazySourceCalls += 1
            return {
              sceneDoc: createReplayScene('quiz', onSceneReset),
              onReset: (keys) => {
                onLazyReset(keys)
                return { name: 'replay:scene-reset' }
              },
            }
          },
        },
      },
      runtime: {
        root: document.body.appendChild(document.createElement('div')),
        instanceIds: {
          layout: 'replay-lazy-layout-1',
          menu: 'replay-lazy-menu-1',
          quiz: 'replay-lazy-quiz-1',
          landing: 'replay-lazy-landing-1',
          lazy: 'replay-lazy-scene-1',
        },
        context: { value: 'initial' },
      },
    })

    try {
      await project.runtime.initialize()
      expect(lazySourceCalls).toBe(0)
      await project.runtime.dispatch({ name: 'replay:open-lazy' })
      expect(lazySourceCalls).toBe(1)
      const lazyInstance = project.runtime.getInstanceAt('layout-view/left')
      expect(lazyInstance).toBeDefined()
      await project.runtime.dispatch({ name: 'replay:leave-lazy' })
      expect(await project.runtime.dispatch({ name: 'replay:reset-all' })).toBe(true)
      expect(lazySourceCalls).toBe(1)
      expect(onLazyReset).toHaveBeenCalledWith(['all'])
      expect(onSceneReset).toHaveBeenCalledTimes(4)
    } finally {
      project.runtime.destroy()
      document.body.replaceChildren()
    }
  })

  it('passes selected scene keys without resetting context or changing the route', async () => {
    const onReset = vi.fn()
    const onSceneReset = vi.fn()
    const project = new Sighty<ReplaySceneKey, ReplaySlotName>({
      scenario: createReplayScenario(onReset, onSceneReset, vi.fn()),
      runtime: {
        root: document.body.appendChild(document.createElement('div')),
        instanceIds: {
          layout: 'replay-selective-layout-1',
          menu: 'replay-selective-menu-1',
          quiz: 'replay-selective-quiz-1',
          landing: 'replay-selective-landing-1',
          lazy: 'replay-selective-lazy-1',
        },
        context: { value: 'initial' },
      },
    })

    try {
      await project.runtime.initialize()
      await project.runtime.updateContext({ value: 'progressed' })

      expect(await project.runtime.dispatch({ name: 'replay:reset-quiz' })).toBe(true)
      expect(project.runtime.getMountedSceneKey('left')).toBe('menu')
      expect(project.runtime.scenarioState.context.value).toBe('progressed')
      expect(onReset).toHaveBeenCalledOnce()
      expect(onReset).toHaveBeenCalledWith(['quiz'])
      expect(onSceneReset).toHaveBeenCalledTimes(2)
    } finally {
      project.runtime.destroy()
      document.body.replaceChildren()
    }
  })
})
