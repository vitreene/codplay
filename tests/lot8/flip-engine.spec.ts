import { describe, expect, it } from 'vitest'
import { animate } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { runAnimationBatch } from '../../src/animation/run-batch'
import type { AnimationAdapter, AnimationHandle, TransitionRequest } from '../../src/animation/types'
import { createFlipEngine } from '../../src/runtime/flip-engine'

type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

type FakeNode = {
  style: {
    transform?: string
    width?: string
    height?: string
    transformOrigin?: string
  }
  parentNode?: FakeNode
  x?: number
  y?: number
  scaleX?: number
  scaleY?: number
  setRect: (rect: RectLike) => void
  getBoundingClientRect: () => RectLike
}

/**
 * Creates one measurable fake node with mutable geometry.
 */
function temp__createFakeNode(
  initialRect: RectLike,
  transform = 'none',
  transformOrigin = '50% 50%',
  parentNode?: FakeNode
): FakeNode {
  let rect = { ...initialRect }

  return {
    style: {
      transform,
      transformOrigin
    },
    parentNode,
    setRect: (nextRect) => {
      rect = { ...nextRect }
    },
    getBoundingClientRect: () => ({ ...rect })
  }
}

/**
 * Creates one animation adapter stub that records started transitions.
 */
function temp__createRecordingAnimationAdapter(onRun: (transitions: TransitionRequest[]) => void): AnimationAdapter {
  return {
    run: (transitions) => {
      onRun(transitions)
      return transitions.map<AnimationHandle>((transition) => ({
        transitionId: transition.transitionId,
        target: transition.target,
        stop: () => {
          return
        }
      }))
    },
    stop: () => {
      return
    }
  }
}

/**
 * Waits for the specified duration in milliseconds.
 */
async function sleep(durationMs: number): Promise<void> {
  const startedAtMs = Date.now()

  while (Date.now() - startedAtMs < durationMs) {
    await new Promise<void>((resolve) => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => resolve())
        return
      }

      const withSetImmediate = globalThis as { setImmediate?: (callback: () => void) => unknown }
      if (typeof withSetImmediate.setImmediate === 'function') {
        withSetImmediate.setImmediate(() => resolve())
        return
      }

      Promise.resolve().then(() => resolve())
    })
  }
}

/**
 * Creates one real anime.js implementation compatible with the runtime adapter.
 */
function temp__createRealAnimeImplementation(): AnimeImplementation {
  return (parameters) => {
    const targets = parameters.targets
    const { targets: _ignoredTargets, ...rest } = parameters

    const animationTargets = targets as Parameters<typeof animate>[0]
    const animationParameters = rest as Parameters<typeof animate>[1]
    return animate(animationTargets, animationParameters)
  }
}

describe('Lot 08 - generic FLIP engine', () => {
  it('L8-T1 capture reads rect, matrix and transform-origin from nodes', () => {
    const engine = createFlipEngine()
    const node = temp__createFakeNode(
      {
        left: 10,
        top: 20,
        width: 120,
        height: 40
      },
      'matrix(1, 0, 0, 1, 12, -6)',
      '0px 0px'
    )

    const snapshots = engine.capture([{ id: 'item-a', nodeRef: node }])

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      id: 'item-a',
      left: 10,
      top: 20,
      width: 120,
      height: 40,
      transformValue: 'matrix(1, 0, 0, 1, 12, -6)',
      translateX: 0,
      translateY: 0,
      transformOrigin: '0px 0px',
      matrix: {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 12,
        f: -6
      }
    })
  })

  it('L8-T2 plan prepares x/y/width/height interpolation', () => {
    const engine = createFlipEngine()
    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 50 })

    const first = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 0,
        top: 0,
        width: 100,
        height: 50,
        parentMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const last = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 40,
        top: 10,
        width: 160,
        height: 80,
        parentMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const result = engine.plan(first, last, { durationMs: 500, easing: 'linear' })

    expect(result.transitions).toHaveLength(1)
    expect(result.transitions[0]).toMatchObject({
      transitionId: 'flip-item-a',
      duration: 500,
      easing: 'linear',
      from: {
        x: -40,
        y: -10,
        width: 100,
        height: 50
      },
      to: {
        x: 0,
        y: 0,
        width: 160,
        height: 80
      }
    })
  })

  it('L8-T3 run enforces one frame barrier between inversion and play', async () => {
    const events: string[] = []
    const frameCallbacks: Array<() => void> = []

    const engine = createFlipEngine({
      requestFrame: (callback) => {
        events.push('raf:scheduled')
        frameCallbacks.push(callback)
      }
    })

    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 })
    const playedTransitions: TransitionRequest[][] = []
    const animationAdapter = temp__createRecordingAnimationAdapter((transitions) => {
      events.push('play:run')
      playedTransitions.push(transitions)
    })

    const runPromise = engine.run({
      entries: [{ id: 'item-a', nodeRef: node }],
      mutate: () => {
        events.push('mutate')
        node.setRect({ left: 80, top: 20, width: 140, height: 60 })
      },
      animationAdapter,
      options: { durationMs: 200 }
    })

    expect(playedTransitions).toHaveLength(0)
    expect(events).toContain('raf:scheduled')

    const firstFrameCallback = frameCallbacks[0]
    if (firstFrameCallback === undefined) {
      throw new Error('Expected one requestAnimationFrame callback')
    }

    firstFrameCallback()

    const result = await runPromise

    expect(playedTransitions).toHaveLength(1)
    expect(result.animation.appliedCount).toBeGreaterThan(0)
    expect(events.indexOf('mutate')).toBeLessThan(events.indexOf('raf:scheduled'))
    expect(events.indexOf('raf:scheduled')).toBeLessThan(events.indexOf('play:run'))
  })

  it('L8-T4 plan converts world delta to local delta using transformed parent matrix', () => {
    const engine = createFlipEngine()
    const parentNode = temp__createFakeNode({ left: 0, top: 0, width: 400, height: 300 }, 'matrix(0, 1, -1, 0, 0, 0)')
    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 }, 'none', '50% 50%', parentNode)

    const first = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 10,
        top: 0,
        width: 100,
        height: 40,
        parentMatrix: { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const last = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 0,
        top: 0,
        width: 100,
        height: 40,
        parentMatrix: { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const result = engine.plan(first, last, { includeSize: false, includeTransformMatrix: true })

    expect(result.transitions).toHaveLength(1)
    expect(result.transitions[0]?.from.x).toBe(0)
    expect(result.transitions[0]?.from.y).toBe(-10)
  })

  it('L8-T5 toAnimationTransitions emits additive channels with composition merge', () => {
    const engine = createFlipEngine()
    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 })

    const transitions = engine.toAnimationTransitions([
      {
        transitionId: 'flip-a',
        nodeRef: node,
        from: { x: 12, y: -6 },
        to: { x: 0, y: 0 },
        duration: 250,
        easing: 'linear'
      }
    ])

    expect(transitions.some((transition) => transition.property === 'transform')).toBe(false)
    expect(transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'x', from: 12, to: 0, composition: 'merge' }),
        expect.objectContaining({ property: 'y', from: -6, to: 0, composition: 'merge' })
      ])
    )
  })

  it('L8-T6 integration uses real animejs and animates intermediate values', async () => {
    const adapter = createAnimationAdapter(temp__createRealAnimeImplementation())
    const target = { x: 0 }

    const result = runAnimationBatch(
      [
        {
          transitionId: 'tr-real-anime-x',
          eventId: 'evt-real-anime',
          eventName: 'flip:play',
          listenerId: 'item-real-anime',
          property: 'x',
          target,
          from: 0,
          to: 100,
          duration: 260,
          easing: 'linear'
        }
      ],
      adapter
    )

    await sleep(90)
    expect(target.x).toBeGreaterThan(0)
    expect(target.x).toBeLessThan(100)

    await sleep(240)
    expect(target.x).toBeGreaterThanOrEqual(99)
    expect(result.appliedCount).toBe(1)
  })

  it('L8-T7 run supports no pre-invert mode and keeps from/to channels', async () => {
    const frameCallbacks: Array<() => void> = []

    const engine = createFlipEngine({
      requestFrame: (callback) => {
        frameCallbacks.push(callback)
      }
    })

    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 })
    const adapter = createAnimationAdapter(temp__createRealAnimeImplementation())

    const runPromise = engine.run({
      entries: [{ id: 'item-a', nodeRef: node }],
      mutate: () => {
        node.setRect({ left: 80, top: 20, width: 100, height: 40 })
      },
      animationAdapter: adapter,
      applyInvertTransformToTarget: false,
      options: {
        includeSize: false,
        durationMs: 240,
        easing: 'linear'
      }
    })

    expect(node.style.transform).toBe('none')

    const frameCallback = frameCallbacks[0]
    if (frameCallback === undefined) {
      throw new Error('Expected one frame callback to start animation playback')
    }

    frameCallback()

    const result = await runPromise
    const xTransition = result.animationTransitions.find((transition) => transition.property === 'x')

    expect(xTransition).toMatchObject({
      from: -80,
      to: 0,
      composition: 'merge'
    })
    expect(result.animation.appliedCount).toBeGreaterThan(0)
  })

  it('L8-T8 plan maps world delta with target pre-transform matrix', () => {
    const engine = createFlipEngine()
    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 }, 'matrix(0, 1, -1, 0, 0, 0)')

    const first = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 10,
        top: 0,
        width: 100,
        height: 40,
        parentMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformValue: 'matrix(0, 1, -1, 0, 0, 0)',
        translateX: 0,
        translateY: 0,
        matrix: { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const last = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 0,
        top: 0,
        width: 100,
        height: 40,
        parentMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformValue: 'matrix(0, 1, -1, 0, 0, 0)',
        translateX: 0,
        translateY: 0,
        matrix: { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const result = engine.plan(first, last, { includeSize: false, includeTransformMatrix: true })

    expect(result.transitions).toHaveLength(1)
    expect(result.transitions[0]?.from.x).toBe(0)
    expect(result.transitions[0]?.from.y).toBe(-10)
  })

  it('L8-T9 transform baseline is preserved when pre-invert is disabled', async () => {
    const frameCallbacks: Array<() => void> = []
    const engine = createFlipEngine({
      requestFrame: (callback) => {
        frameCallbacks.push(callback)
      }
    })

    const node = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 }, 'rotate(6deg)')
    const playedTransitions: TransitionRequest[][] = []
    const adapter = temp__createRecordingAnimationAdapter((transitions) => {
      playedTransitions.push(transitions)
    })

    const runPromise = engine.run({
      entries: [{ id: 'item-a', nodeRef: node }],
      mutate: () => {
        node.setRect({ left: 60, top: 20, width: 100, height: 40 })
      },
      animationAdapter: adapter,
      applyInvertTransformToTarget: false,
      options: {
        includeSize: false,
        durationMs: 200,
        easing: 'linear'
      }
    })

    expect(node.style.transform).toBe('rotate(6deg)')

    const frameCallback = frameCallbacks[0]
    if (frameCallback === undefined) {
      throw new Error('Expected one frame callback')
    }

    frameCallback()
    await runPromise

    expect(playedTransitions).toHaveLength(1)
    expect(node.style.transform).toBe('rotate(6deg)')
  })

  it('L8-T10 keeps size channels consistent under parent scale transform', () => {
    const engine = createFlipEngine()
    const node = temp__createFakeNode({ left: 20, top: 10, width: 50, height: 30 })

    const first = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 0,
        top: 0,
        width: 100,
        height: 60,
        parentMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const last = [
      {
        id: 'item-a',
        nodeRef: node,
        left: 20,
        top: 10,
        width: 50,
        height: 30,
        parentMatrix: { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 },
        transformValue: 'none',
        translateX: 0,
        translateY: 0,
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        transformOrigin: '50% 50%'
      }
    ]

    const planResult = engine.plan(first, last, { includeSize: true, includeTransformMatrix: true })
    expect(planResult.transitions).toHaveLength(1)

    const transition = planResult.transitions[0]
    if (transition === undefined) {
      throw new Error('Expected one FLIP transition')
    }

    expect(transition.from).toMatchObject({
      x: -20,
      y: -10
    })
    expect(transition.to).toMatchObject({
      x: 0,
      y: 0
    })
    expect(transition.from.scaleX).toBe(2)
    expect(transition.from.scaleY).toBe(2)
    expect(transition.to.scaleX).toBe(1)
    expect(transition.to.scaleY).toBe(1)

    engine.applyInvert(planResult.transitions)

    expect(node.x).toBe(-20)
    expect(node.y).toBe(-10)
    expect(node.scaleX).toBe(2)
    expect(node.scaleY).toBe(2)

    const parentScaleX = 0.5
    const parentScaleY = 0.5
    const scaleX = transition.from.scaleX ?? 1
    const scaleY = transition.from.scaleY ?? 1

    const projectedWorldDeltaX = (transition.from.x ?? 0) * parentScaleX * scaleX
    const projectedWorldDeltaY = (transition.from.y ?? 0) * parentScaleY * scaleY
    const projectedWorldWidth = last[0]!.width * parentScaleX * scaleX
    const projectedWorldHeight = last[0]!.height * parentScaleY * scaleY

    expect(projectedWorldDeltaX).toBe(first[0]!.left - last[0]!.left)
    expect(projectedWorldDeltaY).toBe(first[0]!.top - last[0]!.top)

    if (transition.from.width !== undefined) {
      expect(projectedWorldWidth).toBe(first[0]!.width)
    } else {
      expect(projectedWorldWidth).toBe(last[0]!.width)
    }

    if (transition.from.height !== undefined) {
      expect(projectedWorldHeight).toBe(first[0]!.height)
    } else {
      expect(projectedWorldHeight).toBe(last[0]!.height)
    }
  })

  it('L8-T11 repeated reorder runs do not accumulate drift', async () => {
    const frameCallbacks: Array<() => void> = []
    const engine = createFlipEngine({
      requestFrame: (callback) => {
        frameCallbacks.push(callback)
      }
    })

    const nodeA = temp__createFakeNode({ left: 0, top: 0, width: 100, height: 40 })
    const nodeB = temp__createFakeNode({ left: 100, top: 0, width: 100, height: 40 })
    const adapter = temp__createRecordingAnimationAdapter(() => {
      return
    })

    let flipped = false

    for (let index = 0; index < 20; index += 1) {
      const runPromise = engine.run({
        entries: [
          { id: 'a', nodeRef: nodeA },
          { id: 'b', nodeRef: nodeB }
        ],
        animationAdapter: adapter,
        applyInvertTransformToTarget: false,
        options: {
          includeSize: false,
          durationMs: 120,
          easing: 'linear'
        },
        mutate: () => {
          flipped = !flipped
          if (flipped) {
            nodeA.setRect({ left: 100, top: 0, width: 100, height: 40 })
            nodeB.setRect({ left: 0, top: 0, width: 100, height: 40 })
          } else {
            nodeA.setRect({ left: 0, top: 0, width: 100, height: 40 })
            nodeB.setRect({ left: 100, top: 0, width: 100, height: 40 })
          }
        }
      })

      const frameCallback = frameCallbacks.shift()
      if (frameCallback === undefined) {
        throw new Error('Expected one frame callback per run')
      }

      frameCallback()
      const result = await runPromise
      const xTransitions = result.animationTransitions.filter((transition) => transition.property === 'x')
      for (const transition of xTransitions) {
        expect(Math.abs(Number(transition.from))).toBe(100)
        expect(Number(transition.to)).toBe(0)
      }
    }
  })

  it('L8-T12 reference A/B1/B2/C keeps transformed reparent channels stable', () => {
    const engine = createFlipEngine()

    const nodeA = temp__createFakeNode(
      { left: 0, top: 0, width: 900, height: 600 },
      'matrix(1.1276311, 0.4104241, -0.4104241, 1.1276311, 0, 0)'
    )
    const nodeB1 = temp__createFakeNode(
      { left: 120, top: 140, width: 260, height: 260 },
      'matrix(0.8426489, -0.7070664, 0.7070664, 0.8426489, 50, 0)',
      '50% 50%',
      nodeA
    )
    const nodeB2 = temp__createFakeNode(
      { left: 440, top: 170, width: 240, height: 240 },
      'matrix(1, 0, 0, 1, 200, 0)',
      '50% 50%',
      nodeA
    )
    const nodeC = temp__createFakeNode(
      { left: 232, top: 260, width: 120, height: 90 },
      'matrix(-0.6472136, 0.4702282, -0.4702282, -0.6472136, 0, 150)',
      '50% 50%',
      nodeB1
    )

    const first = engine.capture([{ id: 'item-c', nodeRef: nodeC }])

    nodeC.parentNode = nodeB2
    nodeC.setRect({ left: 470, top: 186, width: 164, height: 120 })

    const last = engine.capture([{ id: 'item-c', nodeRef: nodeC }])
    const withMatrix = engine.plan(first, last, {
      includeSize: true,
      includeTransformMatrix: true
    })
    const withoutMatrix = engine.plan(first, last, {
      includeSize: true,
      includeTransformMatrix: false
    })

    expect(withMatrix.transitions).toHaveLength(1)
    expect(withoutMatrix.transitions).toHaveLength(1)

    const withMatrixTransition = withMatrix.transitions[0]
    const withoutMatrixTransition = withoutMatrix.transitions[0]
    if (!withMatrixTransition || !withoutMatrixTransition) {
      throw new Error('Expected one FLIP transition in both plans')
    }

    expect(withMatrixTransition.from.x).toBeTypeOf('number')
    expect(withMatrixTransition.from.y).toBeTypeOf('number')
    expect(withMatrixTransition.from.width).toBeTypeOf('number')
    expect(withMatrixTransition.from.height).toBeTypeOf('number')
    expect(withMatrixTransition.from.rotate).toBeTypeOf('number')
    expect(withMatrixTransition.from.scaleX).toBeTypeOf('number')
    expect(withMatrixTransition.from.scaleY).toBeTypeOf('number')

    expect(Math.abs((withMatrixTransition.from.rotate as number) - 0)).toBeGreaterThan(1)
    expect(Math.abs((withMatrixTransition.from.scaleX as number) - 1)).toBeGreaterThan(0.05)
    expect(Math.abs((withMatrixTransition.from.scaleY as number) - 1)).toBeGreaterThan(0.05)

    expect(Math.abs((withMatrixTransition.from.x as number) - (withoutMatrixTransition.from.x as number))).toBeGreaterThan(1)
    expect(Math.abs((withMatrixTransition.from.y as number) - (withoutMatrixTransition.from.y as number))).toBeGreaterThan(1)

    const properties = engine.toAnimationTransitions(withMatrix.transitions).map((transition) => transition.property)
    expect(properties).toEqual(
      expect.arrayContaining(['x', 'y', 'width', 'height', 'rotate', 'scaleX', 'scaleY'])
    )
  })
})
