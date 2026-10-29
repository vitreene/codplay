/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayFrameScheduler } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyScenarioDefinition } from '../src'

type SceneKey = 'layout' | 'alpha' | 'beta' | 'gamma'
type SlotName = 'main'

const NEXT_EVENT = 'replace-view:next'
const PREVIOUS_EVENT = 'replace-view:previous'

/** Gives tests explicit control over the shared CodPlay ticker frames. */
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

/** Creates a layout with one host slot and a fixed wipe fallback profile. */
function createLayoutScene(): SceneDoc<string> {
  return {
    id: 'replace-view-layout',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'replace-view-layout-frame',
            type: 'layout',
            initial: {
              move: '@root',
              markup: '<main id="replace-view-layout-root"><section id="replace-view-host" data-part="replace-view:main"></section></main>',
            },
            actions: {},
          },
          {
            id: 'replace-view-host-slot',
            name: 'main',
            type: 'slot',
            initial: {
              move: { target: 'replace-view:main' },
              replace: { transition: 'wipe', duration: 1_000 },
            },
            actions: {},
          },
        ],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Creates one materialized child root whose text identifies its authored page. */
function createPageScene(sceneKey: Exclude<SceneKey, 'layout'>): SceneDoc<string> {
  return {
    id: `replace-view-${sceneKey}`,
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: `replace-view-${sceneKey}-root`,
          type: 'tag',
          initial: {
            tag: 'article',
            content: `page ${sceneKey}`,
            attr: { id: `replace-view-${sceneKey}-article` },
            move: '@root',
          },
          actions: {},
        }],
      },
    },
    listen: [],
    eventimes: [],
    tracks: {},
  }
}

/** Builds a scenario where the incoming beta page overrides the host profile. */
function createScenario(): SightyScenarioDefinition<SceneKey, SlotName> {
  return {
    id: 'sighty-replace-incoming-view-test',
    views: [{
      id: 'layout-view',
      view: {
        scene: 'layout',
        slots: {
          main: [
            {
              id: 'page-alpha',
              actions: { [NEXT_EVENT]: { go: { direction: 'next' } } },
              view: { scene: 'alpha' },
            },
            {
              id: 'page-beta',
              replace: {
                transition: 'mask-reveal',
                shape: 'circle',
                duration: 1_000,
                split: 'cells',
                cellSize: 40,
                direction: 'center',
                stagger: 100,
              },
              actions: { [NEXT_EVENT]: { go: { direction: 'next' } } },
              view: { scene: 'beta' },
            },
            {
              id: 'page-gamma',
              actions: { [PREVIOUS_EVENT]: { go: { direction: 'previous' } } },
              view: { scene: 'gamma' },
            },
          ],
        },
      },
    }],
    scenes: {
      layout: createLayoutScene(),
      alpha: createPageScene('alpha'),
      beta: createPageScene('beta'),
      gamma: createPageScene('gamma'),
    },
  }
}

/** Creates the Sighty runtime with the test-owned scene and identity fixtures. */
function createProject(scheduler: CodPlayFrameScheduler): Sighty<SceneKey, SlotName> {
  return new Sighty({
    scenario: createScenario(),
    runtime: {
      root: document.body.appendChild(document.createElement('div')),
      instanceIds: {
        layout: 'replace-view-layout-instance',
        alpha: 'replace-view-alpha-instance',
        beta: 'replace-view-beta-instance',
        gamma: 'replace-view-gamma-instance',
      },
      codplay: {
        frameScheduler: scheduler,
        pauseOnDocumentHidden: false,
      },
    },
  })
}

describe('Sighty incoming-view replacement profile', () => {
  let project: Sighty<SceneKey, SlotName> | undefined
  let restoreGeometry: SceneGeometryMock | undefined

  afterEach(() => {
    vi.useRealTimers()
    project?.runtime.destroy()
    project = undefined
    restoreGeometry?.()
    restoreGeometry = undefined
    document.body.replaceChildren()
  })

  it('uses the incoming page profile, then falls back to the host slot profile', async () => {
    vi.useFakeTimers()
    const geometry = mockSceneGeometry(120, 80)
    restoreGeometry = geometry
    const scheduler = createManualFrameScheduler()
    project = createProject(scheduler)
    await project.runtime.initialize()

    const root = document.body.querySelector<HTMLElement>('#replace-view-layout-root')
    if (root === null) throw new Error('The Sighty layout root is missing.')

    expect(project.runtime.getMountedSceneKey('main')).toBe('alpha')
    expect(await project.runtime.dispatch({ name: NEXT_EVENT, sourceSceneKey: 'alpha' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('beta')

    const betaSnapshots = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    expect(betaSnapshots).toHaveLength(1)
    const outgoing = betaSnapshots.find((snapshot) => snapshot.dataset.codplayReplaceView === 'outgoing')
    expect(outgoing?.textContent)
      .toContain('page alpha')
    const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
    expect(maskHost?.querySelectorAll('mask')).toHaveLength(1)
    expect(maskHost?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(6)
    expect(root.querySelector('#replace-view-host')?.getAttribute('style') ?? '')
      .not.toContain('mask-image')
    expect(outgoing?.querySelector<HTMLElement>('[style*="mask-image"]')?.style.maskImage)
      .toContain('#codplay-replace-mask-')
    expect(root.querySelectorAll('canvas')).toHaveLength(0)

    geometry.setSize(80, 80)
    window.dispatchEvent(new Event('resize'))
    expect(maskHost?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(9)

    await vi.advanceTimersByTimeAsync(1_050)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)
    scheduler.flush()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(100)
    scheduler.flush()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(root.querySelector('[data-codplay-replace-mask-host]')).toBeNull()

    expect(await project.runtime.dispatch({ name: NEXT_EVENT, sourceSceneKey: 'beta' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('gamma')
    const gammaIncoming = root.querySelector<HTMLElement>('[data-codplay-replace-view="incoming"]')
    if (gammaIncoming === null) throw new Error('The host-default replacement view is missing.')
    expect(gammaIncoming.style.clipPath).toContain('inset(0 0 0')

    await vi.advanceTimersByTimeAsync(1_200)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(2)
    scheduler.flush()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)

    expect(await project.runtime.dispatch({ name: PREVIOUS_EVENT, sourceSceneKey: 'gamma' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('beta')
    expect(root.querySelector('[data-codplay-replace-mask-host]')).not.toBeNull()
    expect(await project.runtime.dispatch({ name: NEXT_EVENT, sourceSceneKey: 'beta' })).toBe(true)
    expect(project.runtime.getMountedSceneKey('main')).toBe('gamma')
    expect(root.querySelector('[data-codplay-replace-mask-host]')).toBeNull()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1_200)
    scheduler.flush()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
  })
})

type SceneGeometryMock = (() => void) & Readonly<{
  setSize: (width: number, height: number) => void
}>

/** Supplies the responsive slot rectangle used to size the SVG cell grid. */
function mockSceneGeometry(width: number, height: number): SceneGeometryMock {
  const prototype = HTMLElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'getBoundingClientRect')
  let currentWidth = width
  let currentHeight = height
  Object.defineProperty(prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, 0, currentWidth, currentHeight),
  })
  const restore = (): void => {
    if (descriptor === undefined) delete (prototype as unknown as Record<string, unknown>).getBoundingClientRect
    else Object.defineProperty(prototype, 'getBoundingClientRect', descriptor)
  }
  return Object.assign(restore, {
    setSize: (nextWidth: number, nextHeight: number): void => {
      currentWidth = nextWidth
      currentHeight = nextHeight
    },
  })
}
