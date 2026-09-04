/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import {
  FIRST_VIEW_MOVE_OFFSET_MS,
  POSITION_MOVE_DURATION_MS,
} from '../../../demos/src/v2/demos/position/constants'
import { createScene } from '../../../demos/src/v2/demos/position/main'

/** Creates a scheduler whose frame advancement stays under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
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

describe('position V2 demo', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
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
    const firstItem = build.compiledScene.scene.stories.main?.persos.find((perso) => perso.id === 'position-view-one-item')
    const liveItem = build.compiledScene.scene.stories.main?.persos.find((perso) => perso.id === 'position-view-four-item')
    expect(firstItem?.actions['position:demo:view:1:move']).toMatchObject({
      move: {
        target: 'position:view-one:target',
        transition: { duration: POSITION_MOVE_DURATION_MS },
      },
    })
    expect(liveItem?.actions['position:demo:live:bounce:1']).toBeUndefined()
    expect(liveItem?.actions['position:demo:live:item:move']).toBe(true)

    const instance = codplay.instances.create({
      instanceId: 'position-demo-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{ name: string; timeMs: number; data?: Readonly<Record<string, unknown>> }> = []
    const stopTrace = instance.diagnostic.onTrace((event) => trace.push({ name: event.name, timeMs: event.timeMs, data: event.data }))

    codplay.engine.advance(0)
    await instance.telco.play()
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('01 / 06')

    codplay.engine.advance(6_000)
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('01 / 06')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()

    const navigatedViews = root.querySelectorAll('.position-view')
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(navigatedViews[1]?.classList.contains('position-view--visible')).toBe(true)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('02 / 06')
    expect(trace.map((event) => event.name)).toContain('position:demo:keyboard:navigate')

    codplay.engine.advance(7_400)
    const viewTwoMove = trace.filter((event) => event.name === 'position:demo:view:2:move').at(-1)
    expect(viewTwoMove?.data).toMatchObject({
      move: {
        target: 'position:view-two:target',
        flipMode: 'overlay-world',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          path: { kind: 'segments' },
        },
      },
    })
    expect(viewTwoMove?.data).not.toHaveProperty('move.transition.traversal')
    expect(viewTwoMove?.data).not.toHaveProperty('move.transition.pathAnchor')
    const viewTwoItem = root.querySelector<HTMLElement>('[data-item-id="main:position-view-two-item"]')
    const viewTwoSource = root.querySelector<HTMLElement>('.position-anchor--source .position-node__outlet')
    const viewTwoTarget = root.querySelector<HTMLElement>('.position-anchor--target .position-node__outlet')
    expect(viewTwoItem).not.toBeNull()
    expect(viewTwoSource).not.toBeNull()
    expect(viewTwoTarget).not.toBeNull()
    expect(root.querySelectorAll('.position-moving-stage.position-two-node-stage > .position-anchor.position-node--source')).toHaveLength(1)
    expect(root.querySelectorAll('.position-moving-stage.position-two-node-stage > .position-anchor.position-node--target')).toHaveLength(1)
    if (viewTwoItem === null || viewTwoSource === null || viewTwoTarget === null) return
    expect(viewTwoSource.contains(viewTwoItem)).toBe(false)
    expect(viewTwoTarget.contains(viewTwoItem)).toBe(true)
    codplay.engine.advance(9_401)
    expect(viewTwoTarget.contains(viewTwoItem)).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('03 / 06')

    codplay.engine.advance(9_000)
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

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('04 / 06')

    codplay.engine.advance(14_000)
    const scheduledLiveMoves = trace.filter((event) => event.name === 'position:demo:live:item:move')
    expect(scheduledLiveMoves).toHaveLength(4)
    const liveBounceMove = scheduledLiveMoves[0]
    expect(liveBounceMove?.data).toMatchObject({
      move: {
        target: 'position:view-four:target',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          path: { kind: 'segments' },
        },
      },
    })

    const liveSource = root.querySelector<HTMLElement>('.position-live-anchor--source')
    expect(liveSource).not.toBeNull()
    if (liveSource === null) return
    dispatchPointer(liveSource, 'pointerdown', {})
    await flushDomEvent()
    dispatchPointer(liveSource, 'pointermove', { movementX: 34, movementY: -18 })
    dispatchPointer(liveSource, 'pointerup', {})
    await flushDomEvent()

    const liveSettled = trace.filter((event) => event.name === 'position:demo:live:source:settled').at(-1)
    expect(liveSettled?.data).toMatchObject({ style: { x: '34px', y: '-18px' } })
    expect(liveSource.style.transform).toBe('translate(34px, -18px)')
    const liveMove = trace.filter((event) => event.name === 'position:demo:live:item:move').at(-1)
    expect(trace.map((event) => event.name)).toContain('position:demo:live:source:settled')
    expect(liveMove?.data).toMatchObject({
      move: {
        target: 'position:view-four:target',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          path: { kind: 'segments' },
        },
      },
    })

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('05 / 06')
    codplay.engine.advance(16_000)
    const viewFiveMove = trace.filter((event) => event.name === 'position:demo:view:5:move').at(-1)
    expect(viewFiveMove?.data).toMatchObject({
      move: {
        target: 'position:view-five:target:item',
        transition: {
          duration: POSITION_MOVE_DURATION_MS,
          path: { kind: 'segments' },
        },
      },
    })
    const nestedItem = root.querySelector<HTMLElement>('[data-item-id="main:position-view-five-item"]')
    const nestedTarget = root.querySelector<HTMLElement>('.position-nested-parent--target .position-nested-parent__item-mount')
    expect(nestedTarget?.contains(nestedItem)).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector('.position-carousel-status')?.textContent).toBe('06 / 06')
    codplay.engine.advance(22_000)
    for (const transfer of ['a-to-b', 'b-to-c', 'c-to-d', 'd-to-a', 'b-to-d', 'a-to-c', 'd-to-b', 'c-to-a']) {
      const conclusionMove = trace.filter((event) => event.name === `position:demo:conclusion:${transfer}`).at(-1)
      expect(conclusionMove?.data).toMatchObject({
        move: {
          transition: {
            duration: POSITION_MOVE_DURATION_MS,
            path: { kind: 'segments' },
          },
        },
      })
    }
    const conclusionItemB = root.querySelector<HTMLElement>('[data-item-id="main:position-view-six-item-b"]')
    const conclusionTargetD = root.querySelector<HTMLElement>('.position-conclusion-node--d')
    expect(conclusionTargetD?.contains(conclusionItemB)).toBe(true)
    const conclusionViews = root.querySelectorAll('.position-view')
    expect(root.querySelectorAll('.position-view--visible')).toHaveLength(1)
    expect(conclusionViews[5]?.classList.contains('position-view--visible')).toBe(true)
    stopTrace()
  })

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
    codplay.engine.advance(0)
    await instance.telco.play()
    const item = root.querySelector<HTMLElement>('[data-item-id="main:position-view-one-item"]')
    expect(item).not.toBeNull()
    if (item === null) return
    const source = root.querySelector<HTMLElement>('.position-node--source .position-node__outlet')
    const target = root.querySelector<HTMLElement>('.position-node--target .position-node__outlet')
    expect(source?.contains(item)).toBe(true)
    codplay.engine.advance(999)
    expect(source?.contains(item)).toBe(true)
    codplay.engine.advance(1)
    expect(source?.contains(item)).toBe(true)
    codplay.engine.advance(FIRST_VIEW_MOVE_OFFSET_MS + POSITION_MOVE_DURATION_MS + 1)
    expect(target?.contains(item)).toBe(true)
  })
})
