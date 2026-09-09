/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { createCoreRuntimeCatalog } from '../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../src/runtime/runner-html'
import {
  FIRST_VIEW_MOVE_OFFSET_MS,
  POSITION_LIVE_A_RELEASED_EVENT,
  POSITION_LIVE_B_RELEASED_EVENT,
  POSITION_LIVE_INITIALIZE_EVENT,
  POSITION_LIVE_ITEM_MOVE_EVENT,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_FOUR_ID,
  POSITION_VIEW_STORY_IDS,
} from '../../../demos/src/v2/demos/position/constants'
import { createScene } from '../../../demos/src/v2/demos/position/main'
import {
  CAROUSEL_EVENTS,
  CAROUSEL_EVENTS_BY_STORY_ID,
} from '../../../demos/src/v2/demos/position/carousel'

/** Creates a scheduler whose frame advancement stays under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Finds the unmarked overlay layer by its presentation contract. */
function findTestOverlayLayer(root: Element): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).find((candidate) => (
    candidate.style.position === 'absolute'
      && candidate.style.width === '100%'
      && candidate.style.height === '100%'
      && candidate.style.pointerEvents === 'none'
      && candidate.style.zIndex === '20'
  ))
}

/** Lets the queued DOM event source and listen straps finish their dispatch. */
async function flushDomEvent(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

/** Dispatches a pointer event with the numeric sample fields used by the V2 capture adapter. */
function dispatchPointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  sample: Readonly<{ clientX?: number; clientY?: number; movementX?: number; movementY?: number }>,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    clientX: { value: sample.clientX ?? 0 },
    clientY: { value: sample.clientY ?? 0 },
    movementX: { value: sample.movementX ?? 0 },
    movementY: { value: sample.movementY ?? 0 },
  })
  target.dispatchEvent(event)
}

/** Reads the vertical control coordinate of a prepared quadratic move. */
function readQuadraticControlY(data: Readonly<Record<string, unknown>> | undefined): number | undefined {
  const move = data?.move
  if (typeof move !== 'object' || move === null || Array.isArray(move)) return undefined
  const transition = (move as Readonly<Record<string, unknown>>).transition
  if (typeof transition !== 'object' || transition === null || Array.isArray(transition)) return undefined
  const path = (transition as Readonly<Record<string, unknown>>).path
  if (typeof path !== 'object' || path === null || Array.isArray(path)) return undefined
  const pathRecord = path as Readonly<Record<string, unknown>>
  if (pathRecord.kind !== 'quadratic') return undefined
  const control = pathRecord.control
  if (!Array.isArray(control) || typeof control[1] !== 'number') return undefined
  return control[1]
}

/** Reads the destination outlet of one move payload. */
function readMoveTarget(data: Readonly<Record<string, unknown>> | undefined): string | undefined {
  const move = data?.move
  if (typeof move !== 'object' || move === null || Array.isArray(move)) return undefined
  const target = (move as Readonly<Record<string, unknown>>).target
  return typeof target === 'string' ? target : undefined
}

/** Reads the number of effective motion segments for one runner item. */
function readMotionSegmentCount(runner: HtmlPlayerRunner, itemId: string): number {
  const frame = runner.getPresentationFrame()
  if (frame === undefined) return 0
  const revision = JSON.parse(frame.graphRevision) as Readonly<{
    tracks?: readonly (readonly [string, readonly unknown[]])[]
  }>
  return revision.tracks?.find(([candidate]) => candidate === itemId)?.[1].length ?? 0
}

describe('position V2 demo', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    vi.restoreAllMocks()
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps carousel progression manual and inside the scene event circuit', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    expect(Object.keys(build.compiledScene.scene.stories)).toEqual([
      'main',
      'position-story-one',
      'position-story-two',
      'position-story-three',
      'position-story-four',
      'position-story-five',
      'position-story-six',
    ])
    expect(build.compiledScene.scene.stories.main?.listen).toEqual([])
    for (const storyId of POSITION_VIEW_STORY_IDS) {
      expect(build.compiledScene.scene.stories[storyId]?.listen).toContainEqual({
        on: CAROUSEL_EVENTS_BY_STORY_ID[storyId].reset,
        reset: true,
      })
    }
    const storyTwoSource = build.compiledScene.scene.stories['position-story-two']?.persos.find((perso) => perso.id === 'position-view-two-source')
    const storyTwoTarget = build.compiledScene.scene.stories['position-story-two']?.persos.find((perso) => perso.id === 'position-view-two-target')
    const storyFive = build.compiledScene.scene.stories['position-story-five']
    const storyFiveSourceContainer = storyFive?.persos.find((perso) => perso.id === 'position-view-five-source-container')
    const storyFiveTargetContainer = storyFive?.persos.find((perso) => perso.id === 'position-view-five-target-container')
    const storySix = build.compiledScene.scene.stories['position-story-six']
    const storySixTransferQFrame = storySix?.persos.find((perso) => perso.id === 'position-view-six-transfer-q-frame')
    const storySixTransferKFrame = storySix?.persos.find((perso) => perso.id === 'position-view-six-transfer-k-frame')
    const storySixQa = storySix?.persos.find((perso) => perso.id === 'position-view-six-item-qa')
    expect(storyTwoSource?.actions['position:demo:view:2:source:shift']).toMatchObject({
      style: { translateY: { from: 0, to: 15, duration: 3_650 } },
    })
    expect(storyTwoTarget?.actions['position:demo:view:2:target:shift']).toMatchObject({
      style: { translateY: { from: 0, to: -15, duration: 3_650 } },
    })
    expect(storyTwoSource?.actions['position:demo:view:2:source:shift']).not.toHaveProperty('style.y')
    expect(storyTwoTarget?.actions['position:demo:view:2:target:shift']).not.toHaveProperty('style.y')
    expect(storyFiveSourceContainer?.initial?.move).toEqual({ target: 'position:view-five:source' })
    expect(storyFiveTargetContainer?.initial?.move).toEqual({ target: 'position:view-five:target' })
    expect(storyFiveSourceContainer?.actions['position:demo:view:5:q:shift']).toMatchObject({
      move: {
        target: 'position:view-five:source',
        transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
      },
      className: {
        add: 'position-nested-container--flex-end',
        remove: 'position-nested-container--flex-start',
      },
    })
    expect(storyFiveSourceContainer?.actions['position:demo:view:5:q:return']).toMatchObject({
      move: {
        target: 'position:view-five:source',
        transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
      },
      className: {
        add: 'position-nested-container--flex-start',
        remove: 'position-nested-container--flex-end',
      },
    })
    expect(storyFiveTargetContainer?.actions['position:demo:view:5:k:shift']).toMatchObject({
      move: {
        target: 'position:view-five:target',
        transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
      },
      className: {
        add: 'position-nested-container--flex-start',
        remove: 'position-nested-container--flex-end',
      },
    })
    expect(storyFiveTargetContainer?.actions['position:demo:view:5:k:return']).toMatchObject({
      move: {
        target: 'position:view-five:target',
        transition: { duration: POSITION_MOVE_DURATION_MS, ease: 'inOutSine' },
      },
      className: {
        add: 'position-nested-container--flex-end',
        remove: 'position-nested-container--flex-start',
      },
    })
    expect(storySix?.persos).toHaveLength(21)
    expect(storySix?.persos.filter((perso) => perso.type === 'layout')).toHaveLength(7)
    expect(storySix?.persos.filter((perso) => perso.type === 'list')).toHaveLength(2)
    expect(storySixTransferQFrame?.actions['position:demo:conclusion:transfer-q']).toMatchObject({
      move: {
        target: 'position:view-six:node:b',
        transition: {
          duration: 7_275,
          ease: 'inOutQuad',
          path: { kind: 'segments' },
        },
      },
    })
    expect(storySixTransferKFrame?.actions['position:demo:conclusion:transfer-k']).toMatchObject({
      move: {
        target: 'position:view-six:node:c',
        transition: {
          duration: 7_275,
          ease: 'inOutQuad',
          path: { kind: 'segments' },
        },
      },
    })
    expect(storySixQa?.initial?.move).toEqual({ target: 'position-view-six-transfer-q' })
    expect(storySixQa?.actions['position:demo:conclusion:exchange-qa']).toMatchObject({
      move: {
        target: 'position-view-six-transfer-k',
        transition: {
          duration: 875,
          ease: 'inOutQuad',
          path: { kind: 'segments' },
        },
      },
    })
    const firstStory = build.compiledScene.scene.stories['position-story-one']
    const firstItem = firstStory?.persos.find((perso) => perso.id === 'position-view-one-item')
    const liveItem = build.compiledScene.scene.stories['position-story-four']?.persos.find((perso) => perso.id === 'position-view-four-item')
    const liveStory = build.compiledScene.scene.stories['position-story-four']
    expect(firstStory?.eventimes).toBeUndefined()
    expect(build.compiledScene.scene.stories['position-story-two']?.eventimes).toBeUndefined()
    expect(storySix?.eventimes).toEqual([])
    expect(firstItem?.actions['position:demo:view:1:move']).toBe(true)
    expect(liveItem?.actions['position:demo:live:bounce:1']).toBeUndefined()
    expect(liveItem?.actions['position:demo:live:item:move']).toBe(true)
    expect(liveStory?.persos.map((perso) => perso.id)).toEqual(expect.arrayContaining([
      'position-view-four-a',
      'position-view-four-b',
    ]))
    expect(liveStory?.persos.find((perso) => perso.id === 'position-view-four-a')?.initial.markup).toContain('<strong>A</strong>')
    expect(liveStory?.persos.find((perso) => perso.id === 'position-view-four-b')?.initial.markup).toContain('<strong>B</strong>')

    const instance = codplay.instances.create({
      instanceId: 'position-demo-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{
      name: string
      timeMs: number
      visibility?: 'story' | 'scene' | 'public'
      data?: Readonly<Record<string, unknown>>
    }> = []
    const stopTrace = instance.diagnostic.onTrace((event) => trace.push({
      name: event.name,
      timeMs: event.timeMs,
      visibility: event.visibility,
      data: event.data,
    }))

    codplay.engine.advance(0)
    await instance.telco.play()
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('01 / 06')
    expect(root.querySelector('.position-view--visible .position-anchor--a')).not.toBeNull()

    codplay.engine.advance(0)
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('01 / 06')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('02 / 06')

    codplay.engine.advance(7_400)
    const activeStoryTwo = root.querySelector<HTMLElement>('.position-view--visible')
    const viewTwoItem = activeStoryTwo?.querySelector<HTMLElement>('.position-item') ?? null
    const viewTwoSource = activeStoryTwo?.querySelector<HTMLElement>('.position-anchor--source .position-node__outlet') ?? null
    const viewTwoTarget = activeStoryTwo?.querySelector<HTMLElement>('.position-anchor--target .position-node__outlet') ?? null
    expect(viewTwoItem).not.toBeNull()
    expect(viewTwoSource).not.toBeNull()
    expect(viewTwoTarget).not.toBeNull()
    expect(activeStoryTwo?.querySelectorAll('.position-moving-stage.position-two-node-stage > .position-anchor.position-node--source')).toHaveLength(1)
    expect(activeStoryTwo?.querySelectorAll('.position-moving-stage.position-two-node-stage > .position-anchor.position-node--target')).toHaveLength(1)
    if (viewTwoItem === null || viewTwoSource === null || viewTwoTarget === null) return
    expect(viewTwoSource.contains(viewTwoItem)).toBe(false)
    expect(viewTwoTarget.contains(viewTwoItem)).toBe(true)
    codplay.engine.advance(9_401)
    expect(viewTwoTarget.contains(viewTwoItem)).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('03 / 06')
    expect(trace.map((event) => event.name)).toContain('position:demo:keyboard:navigate')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('04 / 06')

    codplay.engine.advance(12_000)
    const scheduledPathMove = trace.filter((event) => event.name === 'position:demo:path:item:move').at(-1)
    expect(scheduledPathMove?.data).toMatchObject({
      move: {
        target: 'position:view-three:target',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          path: { kind: 'segments' },
        },
      },
    })

    const pathControl = root.querySelector<HTMLElement>('.position-path-control')
    expect(pathControl).not.toBeNull()
    if (pathControl === null) return
    dispatchPointer(pathControl, 'pointerdown', {})
    await flushDomEvent()
    dispatchPointer(pathControl, 'pointermove', {
      clientX: 80,
      clientY: 40,
      movementX: 46,
      movementY: 22,
    })
    dispatchPointer(pathControl, 'pointerup', { clientX: 80, clientY: 40 })
    await flushDomEvent()

    const pathMove = trace.filter((event) => event.name === 'position:demo:path:item:move').at(-1)
    expect(trace.map((event) => event.name)).toContain('position:demo:path:captured')
    expect(pathMove?.data).toMatchObject({
      move: {
        transition: { duration: POSITION_MOVE_DURATION_MS },
      },
    })
    expect(pathMove?.data).toMatchObject({
      move: {
        transition: {
          path: { kind: 'segments' },
        },
      },
    })

    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
      await flushDomEvent()
    }
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('01 / 06')

    codplay.engine.advance(26_000)
    const scheduledLiveMoves = trace.filter((event) => event.name === 'position:demo:live:item:move')
    expect(scheduledLiveMoves.length).toBeGreaterThanOrEqual(20)
    const liveBounceMove = scheduledLiveMoves.at(-20)
    const reverseLiveBounceMove = scheduledLiveMoves.at(-19)
    expect(liveBounceMove?.data).toMatchObject({
      move: {
        target: 'position:view-four:b',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          ease: 'linear',
          path: { kind: 'quadratic' },
        },
      },
    })
    expect(readQuadraticControlY(liveBounceMove?.data)).toBeLessThan(0)
    expect(readQuadraticControlY(reverseLiveBounceMove?.data)).toBeGreaterThan(0)

    const liveA = root.querySelector<HTMLElement>('.position-live-anchor.position-anchor--a')
    expect(liveA).not.toBeNull()
    if (liveA === null) return
    dispatchPointer(liveA, 'pointerdown', {})
    await flushDomEvent()
    dispatchPointer(liveA, 'pointermove', { movementX: 34, movementY: -18 })
    dispatchPointer(liveA, 'pointerup', {})
    await flushDomEvent()

    const liveSettled = trace.filter((event) => event.name === 'position:demo:live:a:settled').at(-1)
    expect(liveSettled?.data).toMatchObject({ style: { x: '34px', y: '-18px' } })
    expect(liveA.style.transform).toBe('translate(34px, -18px)')
    const liveMove = trace
      .filter((event) => event.name === 'position:demo:live:item:move')
      .findLast((event) => event.timeMs === liveSettled?.timeMs)
    expect(trace.map((event) => event.name)).toContain('position:demo:live:a:settled')
    expect(liveMove).toBeUndefined()

    for (let index = 0; index < 4; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('05 / 06')

    codplay.engine.advance(42_000)
    const viewFiveSourceCard = root.querySelector<HTMLElement>('.position-view--visible .position-node--source')
    const viewFiveTargetCard = root.querySelector<HTMLElement>('.position-view--visible .position-node--target')
    const viewFiveSourceContainer = root.querySelector<HTMLElement>('.position-view--visible .position-nested-container--q')
    const viewFiveTargetContainer = root.querySelector<HTMLElement>('.position-view--visible .position-nested-container--k')
    expect(viewFiveSourceContainer?.classList.contains('position-nested-container--flex-start')).toBe(true)
    expect(viewFiveTargetContainer?.classList.contains('position-nested-container--flex-end')).toBe(true)
    expect(viewFiveSourceContainer?.parentElement).toBe(viewFiveSourceCard)
    expect(viewFiveTargetContainer?.parentElement).toBe(viewFiveTargetCard)
    const viewFiveMoves = trace.filter((event) => event.name === 'position:demo:view:5:move')
    expect(viewFiveMoves).toHaveLength(4)
    expect(viewFiveMoves.at(-1)?.data).toMatchObject({
      move: {
        target: 'position:view-five:q',
        reparent: true,
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
        },
      },
    })
    expect(viewFiveMoves.at(-1)?.data).not.toHaveProperty('move.transition.path')
    const nestedSource = root.querySelector<HTMLElement>('.position-view--visible .position-nested-container--q')
    expect(nestedSource?.querySelector<HTMLElement>('.position-item')).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('06 / 06')
    codplay.engine.advance(52_000)
    expect(trace.filter((event) => event.name === 'position:demo:conclusion:transfer-q')).toHaveLength(1)
    expect(trace.filter((event) => event.name === 'position:demo:conclusion:transfer-k')).toHaveLength(1)
    expect(trace.filter((event) => event.name.startsWith('position:demo:conclusion:exchange-'))).toHaveLength(12)
    const conclusionTargetB = root.querySelector<HTMLElement>('.position-conclusion-node--b .position-conclusion-node__outlet')
    const conclusionTargetC = root.querySelector<HTMLElement>('.position-conclusion-node--c .position-conclusion-node__outlet')
    const conclusionTransferQ = root.querySelector<HTMLElement>('.position-conclusion-transfer-frame--q')
    const conclusionTransferK = root.querySelector<HTMLElement>('.position-conclusion-transfer-frame--k')
    expect(conclusionTargetB?.contains(conclusionTransferQ)).toBe(true)
    expect(conclusionTargetC?.contains(conclusionTransferK)).toBe(true)
    const conclusionQList = root.querySelector<HTMLElement>('.position-conclusion-list--q')
    const conclusionKList = root.querySelector<HTMLElement>('.position-conclusion-list--k')
    expect(conclusionQList).not.toBeNull()
    expect(conclusionKList).not.toBeNull()
    for (const itemId of ['qa', 'qb', 'qc', 'qd', 'qe', 'qf']) {
      const item = root.querySelector<HTMLElement>(`.position-conclusion-item--${itemId}`)
      expect(conclusionKList?.contains(item)).toBe(true)
    }
    for (const itemId of ['ka', 'kb', 'kc', 'kd', 'ke', 'kf']) {
      const item = root.querySelector<HTMLElement>(`.position-conclusion-item--${itemId}`)
      expect(conclusionQList?.contains(item)).toBe(true)
    }
    const conclusionViews = root.querySelectorAll('.position-view')
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(conclusionViews[5]?.classList.contains('position-view--visible')).toBe(true)
    stopTrace()
  }, 15_000)

  it('starts the first item move at its story offset', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-demo-first-move-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const geometryReads = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    codplay.engine.advance(0)
    await instance.telco.play()
    for (let index = 0; index < 2; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }
    const item = root.querySelector<HTMLElement>('.position-view--visible .position-item')
    expect(item).not.toBeNull()
    if (item === null) return
    const visibleStory = root.querySelector<HTMLElement>('.position-view--visible')
    const source = visibleStory?.querySelector<HTMLElement>('.position-node--source .position-node__outlet')
    const target = visibleStory?.querySelector<HTMLElement>('.position-node--target .position-node__outlet')
    expect(source?.contains(item)).toBe(true)
    codplay.engine.advance(999)
    expect(source?.contains(item)).toBe(true)
    expect(geometryReads).not.toHaveBeenCalled()
    codplay.engine.advance(1_000)
    expect(target?.contains(item)).toBe(true)
    const readsAfterMove = geometryReads.mock.calls.length
    expect(readsAfterMove).toBeGreaterThan(0)
    codplay.engine.advance(1_100)
    expect(geometryReads).toHaveBeenCalledTimes(readsAfterMove)
    codplay.engine.advance(FIRST_VIEW_MOVE_OFFSET_MS + POSITION_MOVE_DURATION_MS + 1)
    expect(target?.contains(item)).toBe(true)
  })

  it('keeps the A-to-B trajectory when A, the current source, is repositioned', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-source-trajectory-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{ name: string; timeMs: number; data?: Readonly<Record<string, unknown>> }> = []
    instance.diagnostic.onTrace((event) => trace.push({
      name: event.name,
      timeMs: event.timeMs,
      data: event.data,
    }))

    codplay.engine.advance(0)
    await instance.events.emit(
      { name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FOUR_ID].enter, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.events.emit(
      { name: POSITION_LIVE_INITIALIZE_EVENT, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.telco.play()
    codplay.engine.advance(700)

    const initialTargetMove = trace
      .filter((event) => event.name === POSITION_LIVE_ITEM_MOVE_EVENT)
      .findLast((event) => readMoveTarget(event.data) === 'position:view-four:b')
    const initialControlY = readQuadraticControlY(initialTargetMove?.data)
    expect(initialControlY).toBeDefined()

    await instance.events.emit(
      {
        name: POSITION_LIVE_A_RELEASED_EVENT,
        visibility: 'story',
        data: { captureState: { x: 34, y: -18 } },
      },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    codplay.engine.advance(2_701)

    const targetMoveAfterSourceRelease = trace
      .filter((event) => event.name === POSITION_LIVE_ITEM_MOVE_EVENT)
      .findLast((event) => readMoveTarget(event.data) === 'position:view-four:b' && event.timeMs > 700)
    expect(readQuadraticControlY(targetMoveAfterSourceRelease?.data)).toBeCloseTo(initialControlY ?? 0)
  })

  it('keeps A pose when B, the current target, is repositioned', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-source-anchor-retarget-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(
      { name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FOUR_ID].enter, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.events.emit(
      { name: POSITION_LIVE_INITIALIZE_EVENT, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.telco.play()
    codplay.engine.advance(700)

    const anchorA = root.querySelector<HTMLElement>('.position-live-anchor.position-anchor--a')
    const anchorB = root.querySelector<HTMLElement>('.position-live-anchor.position-anchor--b')
    expect(anchorA).not.toBeNull()
    expect(anchorB).not.toBeNull()
    if (anchorA === null || anchorB === null) return

    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
    const geometryReads: Element[] = []
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      geometryReads.push(this)
      return originalGetBoundingClientRect.call(this)
    })

    await instance.events.emit(
      {
        name: POSITION_LIVE_A_RELEASED_EVENT,
        visibility: 'story',
        data: { captureState: { x: 34, y: -18 } },
      },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    codplay.engine.advance(200)
    const anchorABeforeTarget = anchorA.style.transform

    await instance.events.emit(
      {
        name: POSITION_LIVE_B_RELEASED_EVENT,
        visibility: 'story',
        data: { captureState: { x: 60, y: 24 } },
      },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )

    const visibleStory = root.querySelector<HTMLElement>('.position-view--visible')
    expect(visibleStory).not.toBeNull()
    expect(geometryReads.length).toBeGreaterThan(0)
    expect(geometryReads.every((element) => visibleStory?.contains(element) === true)).toBe(true)
    expect(anchorABeforeTarget).toBe('translate(34px, -18px)')
    expect(anchorA.style.transform).toBe(anchorABeforeTarget)
  })

  it('replaces a same-time direct move instead of accumulating effective segments', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const runner = new HtmlPlayerRunner({
      id: 'position-same-time-move-replacement-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
      catalog,
    })
    const ticker = { start: () => undefined, stop: () => undefined, isRunning: () => false }
    try {
      expect(runner.init().ok).toBe(true)
      runner.play(ticker)
      const enterResult = await runner.emit({
        name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FOUR_ID].enter,
        storyId: POSITION_STORY_FOUR_ID,
        visibility: 'story',
      })
      expect(enterResult.ok).toBe(true)
      const initializeResult = await runner.emit({
        name: POSITION_LIVE_INITIALIZE_EVENT,
        storyId: POSITION_STORY_FOUR_ID,
        visibility: 'story',
      })
      expect(initializeResult.ok).toBe(true)
      const seekResult = runner.seek(700)
      expect(seekResult.ok).toBe(true)

      await runner.emit({
        name: POSITION_LIVE_B_RELEASED_EVENT,
        storyId: POSITION_STORY_FOUR_ID,
        visibility: 'story',
        applyAtMs: 700,
        data: { captureState: { x: 60, y: 24 } },
      })
      const segmentsAfterFirstMove = readMotionSegmentCount(
        runner,
        `${POSITION_STORY_FOUR_ID}:position-view-four-item`,
      )

      await runner.emit({
        name: POSITION_LIVE_B_RELEASED_EVENT,
        storyId: POSITION_STORY_FOUR_ID,
        visibility: 'story',
        applyAtMs: 700,
        data: { captureState: { x: 80, y: 32 } },
      })
      const segmentsAfterSecondMove = readMotionSegmentCount(
        runner,
        `${POSITION_STORY_FOUR_ID}:position-view-four-item`,
      )

      expect(segmentsAfterFirstMove).toBeGreaterThan(0)
      expect(segmentsAfterSecondMove).toBe(segmentsAfterFirstMove)
    } finally {
      runner.destroy()
    }
  })

  it('retargets A after the bounce direction has become B-to-A', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-reverse-target-retarget-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{ name: string; timeMs: number; data?: Readonly<Record<string, unknown>> }> = []
    instance.diagnostic.onTrace((event) => trace.push({
      name: event.name,
      timeMs: event.timeMs,
      data: event.data,
    }))

    codplay.engine.advance(0)
    await instance.events.emit(
      { name: CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FOUR_ID].enter, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.events.emit(
      { name: POSITION_LIVE_INITIALIZE_EVENT, visibility: 'story' },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    await instance.telco.play()
    codplay.engine.advance(2_700)

    const reverseMoveBeforeDrag = trace
      .filter((event) => event.name === POSITION_LIVE_ITEM_MOVE_EVENT)
      .findLast((event) => readMoveTarget(event.data) === 'position:view-four:a')
    expect(reverseMoveBeforeDrag).toBeDefined()

    await instance.events.emit(
      {
        name: POSITION_LIVE_B_RELEASED_EVENT,
        visibility: 'story',
        data: { captureState: { x: 22, y: -11 } },
      },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    const moveAfterSourceRelease = trace
      .filter((event) => event.name === POSITION_LIVE_ITEM_MOVE_EVENT)
      .findLast((event) => event.timeMs === 2_700)
    expect(moveAfterSourceRelease).toBeUndefined()

    await instance.events.emit(
      {
        name: POSITION_LIVE_A_RELEASED_EVENT,
        visibility: 'story',
        data: { captureState: { x: 48, y: 16 } },
      },
      { scope: 'story', storyId: POSITION_STORY_FOUR_ID },
    )
    const moveAfterTargetRelease = trace
      .filter((event) => event.name === POSITION_LIVE_ITEM_MOVE_EVENT)
      .findLast((event) => event.timeMs === 2_700)
    expect(readMoveTarget(moveAfterTargetRelease?.data)).toBe('position:view-four:a')
    expect(moveAfterTargetRelease?.data).toMatchObject({ liveTargetId: 'a' })
  })

  it('resets every position story when its view exits, without resetting main', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-story-reset-navigation-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{ name: string; visibility?: 'story' | 'scene' | 'public' }> = []
    const stopTrace = instance.diagnostic.onTrace((event) => trace.push({ name: event.name, visibility: event.visibility }))

    codplay.engine.advance(0)
    await instance.telco.play()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    const firstView = root.querySelector<HTMLElement>('.position-view--visible')
    expect(firstView?.querySelector('.position-node--source .position-node__outlet .position-item')).not.toBeNull()
    for (let index = 0; index < 5; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }
    for (let index = 5; index > 0; index -= 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
      await flushDomEvent()
    }

    for (const event of CAROUSEL_EVENTS) {
      expect(trace).toContainEqual({ name: event.reset, visibility: 'scene' })
    }
    expect(build.compiledScene.scene.stories.main?.listen).toEqual([])
    stopTrace()
  }, 15_000)

  it('does not recapture historical geometry for a reset-only story event', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-story-reset-geometry-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    const geometryReads = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    codplay.engine.advance(0)
    await instance.telco.play()
    const readsAfterInit = geometryReads.mock.calls.length
    expect(readsAfterInit).toBe(0)

    await instance.events.emit(
      { name: CAROUSEL_EVENTS[0]!.reset, visibility: 'scene' },
      { scope: 'scene' },
    )

    expect(geometryReads).toHaveBeenCalledTimes(readsAfterInit)
  }, 15_000)

  it('keeps story five to two cards, two moving containers and one reparented item', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-story-five-structure-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    for (let index = 0; index < 4; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('05 / 06')
    codplay.engine.advance(16_000)

    const storyRoot = root.querySelector<HTMLElement>('.position-view--visible')
    const source = storyRoot?.querySelector<HTMLElement>('.position-node--source')
    const target = storyRoot?.querySelector<HTMLElement>('.position-node--target')
    const q = storyRoot?.querySelector<HTMLElement>('.position-nested-container--q')
    const k = storyRoot?.querySelector<HTMLElement>('.position-nested-container--k')
    const item = storyRoot?.querySelector<HTMLElement>('.position-item')
    expect(storyRoot?.querySelector('.position-node__outlet')).toBeNull()
    expect(storyRoot?.querySelector('.position-nested-parent__item-mount')).toBeNull()
    expect(q?.parentElement).toBe(source)
    expect(k?.parentElement).toBe(target)
    expect(q?.classList.contains('position-nested-container--flex-start')).toBe(true)
    expect(k?.classList.contains('position-nested-container--flex-end')).toBe(true)
    expect(q?.contains(item ?? null)).toBe(true)
  })

  it('keeps the active story end available across backward and forward seek', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-story-end-seek-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    codplay.engine.advance(1)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 1, durationMs: 4_100 })

    await instance.telco.seek(4_000)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 4_000, durationMs: 4_100 })

    await instance.telco.seek(1_000)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 1_000, durationMs: 4_100 })

    await instance.telco.seek(4_000)
    expect(instance.telco.getProgress()).toEqual({ timelineMs: 4_000, durationMs: 4_100 })
  })

  it('does not project future targeted story plans into a later structural seek', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-targeted-story-seek-isolation-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const diagnostics: string[] = []
    instance.diagnostic.onDiagnostic((diagnostic) => diagnostics.push(diagnostic.code))

    codplay.engine.advance(0)
    await instance.telco.play()
    for (let index = 0; index < 5; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }

    await instance.telco.rewind()
    await instance.telco.seek(3_000)
    expect(diagnostics).not.toContain('TELCO_COMMAND_FAILED')
    expect(diagnostics).not.toContain('RUNTIME_SEEK_FAILED')
  }, 15_000)

  it('keeps a position story overlay inside that story root', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    const instance = codplay.instances.create({
      instanceId: 'position-story-overlay-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    codplay.engine.advance(FIRST_VIEW_MOVE_OFFSET_MS + 500)

    const storyRoot = root.querySelector<HTMLElement>('.position-view--visible')
    const overlay = storyRoot === null ? undefined : findTestOverlayLayer(storyRoot)
    expect(storyRoot).not.toBeNull()
    expect(overlay).not.toBeNull()
    expect(overlay?.parentElement).toBe(storyRoot)
    expect(overlay?.children.length).toBeGreaterThan(0)
  })
})
