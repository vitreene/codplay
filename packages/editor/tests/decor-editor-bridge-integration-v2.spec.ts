/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { EditorActionsFacade } from '../src/app/facades/editor-actions-facade'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../src/builder-v2'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../src/item-presentation/item-motion-reference'
import { readItemTransformProjection } from '../src/item-presentation/item-style-projection'
import {
  frameVisualCenter,
  frameWithTangentAtPathAnchor,
  motionPathAnchorForFrame,
  motionPathTangentAngle,
} from '../src/motion-editor/geometry'
import type { SelectionFrameValue } from '../src/decor-editor/types'
import type { EditorPlayerPresentationFrame } from '../src/app/commands/editor-player-command-facade'
import type { EditorScene } from '../src/app/commands/types'

/** Creates the two-keyframe scene used to exercise a temporary decor preview end to end. */
function scene() {
  return {
    id: 'decor-preview-integration',
    meta: {
      title: 'Decor preview integration V2',
      durationMs: 5_000,
      durationSource: 'arbitrary' as const,
      timeUnit: 'ms' as const,
      capsuleOrder: 'forward' as const,
    },
    items: [{
      id: 'item',
      type: 'text' as const,
      parentId: null,
      order: 'a',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'last-kf', timeMs: 5_000, decorId: 'last' },
      ],
    }],
    contents: { content: { id: 'content', type: 'text' as const, text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { 'background-color': 'oklch(0.628 0.2577 29.23)' } },
      last: { id: 'last', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 }, style: { 'background-color': 'oklch(0.452 0.3132 264.05)' } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Reproduces the menu-created text item: its initial type preset supplies border values. */
function positionTestScene(firstBorderWidth = '0.6cqw', lastBorderWidth = '0.6cqw') {
  const base = scene()
  return {
    ...base,
    id: 'decor-border-position-test',
    decors: {
      first: {
        ...base.decors.first,
        style: {
          ...base.decors.first.style,
          'border-color': 'oklch(0.85 0.15 195)',
          'border-width': firstBorderWidth,
          'border-style': 'solid',
        },
      },
      last: {
        ...base.decors.last,
        style: {
          ...base.decors.last.style,
          'border-color': 'oklch(0.85 0.15 195)',
          'border-width': lastBorderWidth,
          'border-style': 'solid',
        },
      },
    },
  }
}

/** Enables tangent alignment on the second pose segment of the shared two-KF fixture. */
function tangentScene(): EditorScene {
  const documentScene = positionTestScene() as EditorScene
  documentScene.decors.last!.path = 'M 0 0 A 0.7 0.7 0 0 1 1 0'
  documentScene.items[0]!.rotationMode = 'tangent'
  return documentScene
}

/** Lets the asynchronous V2 scene bridge finish binding and acknowledging one seek. */
async function waitTurns(count = 16): Promise<void> {
  for (let i = 0; i < count; i += 1) await Promise.resolve()
}

/** Builds a pointer event whose capture lifecycle is sufficient for the V2 overlay in jsdom. */
function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  return event
}

/** Reads the displayed 2D transform written by the bridge or the base overlay renderer. */
function readFrameMatrix(frame: HTMLElement): readonly [number, number, number, number] {
  const matrix = frame.style.transform.match(/matrix\(([^)]+)\)/)?.[1]?.split(',').map(Number)
  if (matrix?.length === 6 && matrix.every(Number.isFinite)) {
    return [matrix[0]!, matrix[1]!, matrix[2]!, matrix[3]!]
  }
  const rotate = Number.parseFloat(frame.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? '0') * Math.PI / 180
  const scale = frame.style.transform.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/)
  const scaleX = Number.parseFloat(scale?.[1] ?? '1')
  const scaleY = Number.parseFloat(scale?.[2] ?? scale?.[1] ?? '1')
  return [Math.cos(rotate) * scaleX, Math.sin(rotate) * scaleX, -Math.sin(rotate) * scaleY, Math.cos(rotate) * scaleY]
}

/** Reads the frame heading from its complete rendered matrix. */
function readFrameRotation(frame: HTMLElement): number {
  const [a, b] = readFrameMatrix(frame)
  return Math.atan2(b, a) * 180 / Math.PI
}

/** Applies one rotation through the visible needle without depending on fixture coordinates. */
function rotateNeedle(
  frame: HTMLElement,
  tip: HTMLElement,
  degrees: number,
  onPreview?: () => void,
  endType: 'pointerup' | 'pointercancel' = 'pointerup',
): void {
  const left = Number.parseFloat(frame.style.left)
  const top = Number.parseFloat(frame.style.top)
  const width = Number.parseFloat(frame.style.width)
  const height = Number.parseFloat(frame.style.height)
  const [a, b, c, d] = readFrameMatrix(frame)
  const origin = frame.style.transformOrigin.split(/\s+/)
  const originPoint = (value: string | undefined, size: number): number => {
    const part = value ?? '50%'
    if (part === 'center') return size / 2
    if (part === 'left' || part === 'top') return 0
    if (part === 'right' || part === 'bottom') return size
    const coordinate = Number.parseFloat(part)
    return part.endsWith('%') ? size * coordinate / 100 : coordinate
  }
  const transformOriginX = originPoint(origin[0], width)
  const transformOriginY = originPoint(origin[1], height)
  const project = (x: number, y: number) => ({
    x: left + transformOriginX - a * transformOriginX - c * transformOriginY + a * x + c * y,
    y: top + transformOriginY - b * transformOriginX - d * transformOriginY + b * x + d * y,
  })
  const rotationPivot = frame.querySelector<HTMLElement>('[data-selection-frame-pivot]')!
  const pivotX = Number.parseFloat(rotationPivot.style.left)
  const pivotY = Number.parseFloat(rotationPivot.style.top)
  const pivot = project(pivotX, pivotY)
  const start = project(pivotX, pivotY - 36)
  const radians = degrees * Math.PI / 180
  const end = project(
    pivotX + Math.sin(radians) * 36,
    pivotY - Math.cos(radians) * 36,
  )
  tip.dispatchEvent(pointerEvent('pointerdown', start.x, start.y))
  tip.dispatchEvent(pointerEvent('pointermove', end.x, end.y))
  onPreview?.()
  tip.dispatchEvent(pointerEvent(endType, end.x, end.y))
}

/** Reads the authored preview angle in jsdom; browser fixtures check the composed physical pose. */
function readTransformRotationDegrees(element: HTMLElement): number {
  const anchor = element.querySelector<HTMLElement>('[data-editor-visual-for]')?.parentElement
  const authorRule = element.querySelector<HTMLStyleElement>('[data-part="editor-item-style"]')?.textContent ?? ''
  const transform = element.style.transform.includes('rotate(')
    ? element.style.transform
    : authorRule.includes('rotate') ? authorRule
    : anchor?.style.transform.includes('matrix(')
    ? anchor.style.transform
    : getComputedStyle(element).transform
  const rotation = transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]
  if (rotation !== undefined) return Number.parseFloat(rotation)
  const ruleRotation = transform.match(/rotate:\s*([-\d.]+)deg/i)?.[1]
  if (ruleRotation !== undefined) return Number.parseFloat(ruleRotation)
  const cssRotate = element.style.cssText.match(/(?:^|;)\s*rotate:\s*([-\d.]+)deg/i)
    ?? element.style.rotate.match(/([-\d.]+)deg/)
  if (cssRotate?.[1] !== undefined) return Number.parseFloat(cssRotate[1])
  const matrix = transform.match(/matrix\(([^)]+)\)/)?.[1]
  const matrix3d = transform.match(/matrix3d\(([^)]+)\)/)?.[1]
  if (matrix === undefined && matrix3d === undefined) return Number.NaN
  const values = (matrix ?? matrix3d)!.split(',').map(Number)
  const [a, b] = values
  return Math.atan2(b!, a!) * 180 / Math.PI
}

beforeAll(() => {
  if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
    HTMLElement.prototype.setPointerCapture = function (): void {}
    HTMLElement.prototype.hasPointerCapture = function (): boolean { return false }
    HTMLElement.prototype.releasePointerCapture = function (): void {}
  }
})

describe('decor-editor bridge V2 — projection Decor interpolée et création sparse de KF', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let sceneBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let decorBridge: ReturnType<typeof createDecorEditorBridge> | undefined
  let actions: EditorActionsFacade | undefined
  let originalResizeObserver: typeof ResizeObserver | undefined

  afterEach(() => {
    decorBridge?.destroy()
    actions?.destroy()
    sceneBridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    if (originalResizeObserver !== undefined) globalThis.ResizeObserver = originalResizeObserver
    document.body.replaceChildren()
    decorBridge = undefined
    actions = undefined
    sceneBridge = undefined
    coordination = undefined
    actor = undefined
    originalResizeObserver = undefined
  })

  it('uses the live item transform axis for the Selection Frame pivot', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene() as EditorScene
    const documentScene: EditorScene = {
      ...baseScene,
      decors: {
        ...baseScene.decors,
        first: {
          ...baseScene.decors.first!,
          style: { ...baseScene.decors.first!.style, 'transform-origin': '0% 100%' },
        },
      },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns(24)
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    await waitTurns(24)
    const itemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    const transformAnchor = itemNode.ownerDocument.getElementById(`${itemNode.id}-transform`)!
    expect(readItemTransformProjection(transformAnchor).rotationOrigin).toEqual({ fx: 0, fy: 1 })
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 0,
      playerTimeMs: 0,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 80, y: 80 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'local',
        progress: 0,
      }],
    })
    actor.send({ type: 'CLEAR_SELECTION' })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const pivot = frame.querySelector<HTMLElement>('[data-selection-frame-pivot]')!
    const liveItem = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    const liveAnchor = liveItem.ownerDocument.getElementById(`${liveItem.id}-transform`)!
    expect(liveAnchor).toBe(transformAnchor)
    expect(readItemTransformProjection(liveAnchor).rotationOrigin).toEqual({ fx: 0, fy: 1 })
    expect(pivot.style.left).toBe('0px')
    expect(Number.parseFloat(pivot.style.top)).toBeCloseTo(Number.parseFloat(frame.style.height), 5)
    const initialRotation = readFrameRotation(frame)
    let previewRotation = initialRotation
    const tip = frame.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    rotateNeedle(frame, tip, 25, () => { previewRotation = readFrameRotation(frame) }, 'pointercancel')
    expect(previewRotation).toBeCloseTo(initialRotation + 25, 0)
    expect(readFrameRotation(frame)).toBeCloseTo(initialRotation, 5)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
  })

  it('affiche la valeur interpolée, signale la modification et crée un KF sparse au commit', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    actions = new EditorActionsFacade(actor)
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    const facade = new EditorPlayerCommandFacade()
    coordination = new EditorCoordinationBridge(actor, facade)

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()

    let item = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')
    expect(item).not.toBeNull()
    const colorInput = decorPanel.querySelector<HTMLInputElement>('input[type="color"]')
    expect(colorInput).not.toBeNull()
    expect(colorInput!.dataset.colorState).toBe('set')
    expect(colorInput!.value.toLowerCase()).not.toBe('#808080')
    colorInput!.value = '#00ff00'
    colorInput!.dispatchEvent(new Event('input', { bubbles: true }))
    const candidateStyle = item!.getAttribute('style')
    expect(candidateStyle).toContain('oklch')
    expect(coordination.decorPreview.getAt('item', 2_500)).not.toBeNull()
    expect(decorPanel.querySelector('.dedit-field__control[data-decor-property-path="style.background-color"]')?.classList.contains('dedit-field__control--modified')).toBe(true)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    colorInput!.dispatchEvent(new Event('change', { bubbles: true }))
    await waitTurns()
    item = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    const committedScene = actor.getSnapshot().context.scene!
    expect(committedScene).not.toBe(documentScene)
    const committedItem = committedScene.items.find(candidate => candidate.id === 'item')!
    const created = committedItem.keyframes.find(keyframe => keyframe.timeMs === 2_500)
    expect(created).toBeDefined()
    expect(committedScene.decors[created!.decorId]?.style).toEqual({ 'background-color': 'oklch(0.8664 0.2948 142.5)' })
    expect(committedScene.decors[created!.decorId]?.offset).toBeUndefined()
    expect(actions.getHistoryState()).toEqual({ canUndo: true, canRedo: false })

    actions.undo()
    await waitTurns()
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
    expect(actions.getHistoryState()).toEqual({ canUndo: false, canRedo: true })
    actions.redo()
    await waitTurns()
    item = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    expect(actor.getSnapshot().context.scene).toBe(committedScene)
    expect(actions.getHistoryState()).toEqual({ canUndo: true, canRedo: false })

    actor.send({ type: 'SEEK', timelineMs: 3_500 })
    await waitTurns()
    const awayStyle = item!.getAttribute('style')
    expect(awayStyle).not.toBe(candidateStyle)

    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()
    expect(item!.getAttribute('style')).toContain('background-color')
    expect(colorInput!.value.toLowerCase()).not.toBe('#808080')
    expect(item!.style.getPropertyValue('background-color')).toBe(
      committedScene.decors[created!.decorId]?.style?.['background-color'],
    )
    expect(actor.getSnapshot().context.scene).not.toBe(documentScene)
  })

  it('persists one item rotation mode and preserves it through undo and redo', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    actions = new EditorActionsFacade(actor)
    const documentScene = positionTestScene('0.6cqw', '2cqw') as EditorScene
    documentScene.decors.last!.path = 'M 0 0 A 0.7 0.7 0 0 1 1 0'
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()
    const orientationButton = sceneRoot.querySelector<HTMLButtonElement>('#editor-motion-path-orientation')
    expect(orientationButton).not.toBeNull()
    expect(orientationButton!.style.display).toBe('flex')

    /** Checks that ACE receives endpoint style values and a single path owner after each replay. */
    const expectCompiledPathAndBorder = (orientToPath: boolean): void => {
      const currentScene = actor.getSnapshot().context.scene!
      const built = buildSceneDocV2(currentScene)
      expect(built.ok).toBe(true)
      if (!built.ok) return

      const perso = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
      const moveAction = perso.actions['item-kf-last-kf'] as Record<string, unknown>
      const move = moveAction.move as Record<string, unknown>
      const moveTransition = move.transition as Record<string, unknown>
      const moveStyle = moveAction.style as Record<string, unknown>
      const borderAction = perso.actions['item-decor-kf-last-kf'] as Record<string, unknown>
      const borderStyle = borderAction.style as Record<string, unknown>
      const pathMoveActions = Object.values(perso.actions).filter((value) => {
        if (typeof value !== 'object' || value === null) return false
        const actionMove = (value as Record<string, unknown>).move
        if (typeof actionMove !== 'object' || actionMove === null) return false
        const transition = (actionMove as Record<string, unknown>).transition
        return typeof transition === 'object' && transition !== null
          && (transition as Record<string, unknown>).path === 'M 0 0 A 0.7 0.7 0 0 1 1 0'
      })

      expect(pathMoveActions).toHaveLength(1)
      expect(moveTransition).toMatchObject({
        duration: 5_000,
        ease: 'inOut',
        path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
        ...(orientToPath ? { orientToPath: true } : {}),
      })
      expect(moveStyle.x).toEqual({ from: 10, to: 50, duration: 5_000, ease: 'inOut' })
      expect(moveStyle.y).toEqual({ from: 10, to: 50, duration: 5_000, ease: 'inOut' })
      expect(moveStyle).not.toHaveProperty('border-width')
      expect(borderStyle['border-width']).toEqual({
        from: '0.6cqw',
        to: '2cqw',
        duration: 5_000,
        ease: 'inOut',
      })
      expect(borderStyle).not.toHaveProperty('x')
      expect(borderStyle).not.toHaveProperty('y')
    }

    orientationButton!.click()
    await waitTurns()
    expect(actor.getSnapshot().context.scene?.items[0]?.rotationMode).toBe('tangent')
    expectCompiledPathAndBorder(true)

    orientationButton!.click()
    await waitTurns()
    expect(actor.getSnapshot().context.scene?.items[0]?.rotationMode).toBe('manual')
    expect(orientationButton!.getAttribute('aria-pressed')).toBe('false')
    expectCompiledPathAndBorder(false)
    orientationButton!.click()
    await waitTurns()
    expect(actor.getSnapshot().context.scene?.items[0]?.rotationMode).toBe('tangent')
    expect(orientationButton!.getAttribute('aria-pressed')).toBe('true')

    actions.undo()
    await waitTurns()
    expect(actor.getSnapshot().context.scene?.items[0]?.rotationMode).toBe('manual')
    expectCompiledPathAndBorder(false)
    actions.redo()
    await waitTurns()
    expect(actor.getSnapshot().context.scene?.items[0]?.rotationMode).toBe('tangent')
    expectCompiledPathAndBorder(true)
  })

  it('applies a source-owned rotation preview once after a manual curve', async () => {
    actor = createActor(controllerMachine)
    actor.start()
    actions = new EditorActionsFacade(actor)
    const documentScene = scene() as EditorScene
    documentScene.decors.middle = {
      id: 'middle',
      offset: {
        translate: { x: 40, y: 10 },
        width: 20,
        height: 20,
        rotate: 12,
        scale: { x: 1.4, y: 0.7 },
        rotationOrigin: { fx: 0.25, fy: 0.75 },
      },
      path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
    }
    documentScene.items[0]!.keyframes.splice(1, 0, { id: 'middle-kf', timeMs: 2500, decorId: 'middle', channel: 'pose' })
    actions.loadScene(documentScene)
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }) })
    const panel = document.createElement('div')
    document.body.append(sceneRoot, panel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(panel, actor, coordination)
    await waitTurns(24)
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'middle-kf' })
    actor.send({ type: 'SEEK', timelineMs: 2500 })
    await waitTurns(24)
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const tip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    const native = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    expect(coordination.presentation.get()?.items.find(item => item.itemId === 'story-main:item')?.representation).toBe('source')

    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }

    let previewStyle: Record<string, unknown> | undefined
    rotateNeedle(frame, tip, 45, () => {
      previewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
      expect(actor!.getSnapshot().context.scene?.decors.middle?.offset?.rotate).toBe(12)
    })
    await waitTurns(24)
    const current = actor.getSnapshot().context.scene!
    expect(previewStyle?.rotate).toBe(57)
    for (const property of ['width', 'height', 'scaleX', 'scaleY', 'transform-origin']) {
      expect(previewStyle).toHaveProperty(property)
    }
    expect(previewStyle?.['--editor-item-preview-transform']).toEqual(expect.stringMatching(/^matrix\(/))
    expect(readTransformRotationDegrees(native.parentElement!.parentElement!)).toBe(57)
    // jsdom does not materialize the authored CSS transform into the presented pose matrix.
    // The affine rotation needle is covered independently by the V2 Selection Frame test.
    expect(current.decors.middle!.offset?.rotate).toBe(57)
    expect(current.decors.middle!.offset?.scale).toEqual({ x: 1.4, y: 0.7 })
    actions.undo()
    await waitTurns(24)
    expect(actor.getSnapshot().context.scene?.decors.middle?.offset?.rotate).toBe(12)
  })

  it('applies source move and off-center resize deltas in author coordinates', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene() as EditorScene
    documentScene.items[0]!.rotationMode = 'manual'
    documentScene.decors.last!.path = 'M 0 0 A 0.7 0.7 0 0 1 1 0'
    for (const decor of [documentScene.decors.first!, documentScene.decors.last!]) {
      decor.offset = {
        ...decor.offset,
        rotate: 35,
        rotationOrigin: { fx: 0, fy: 1 },
      }
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    const angle = 35 * Math.PI / 180
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 5_000,
      playerTimeMs: 5_000,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 520, y: 460 },
          matrix: {
            a: Math.cos(angle),
            b: Math.sin(angle),
            c: -Math.sin(angle),
            d: Math.cos(angle),
          },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'source',
        progress: 1,
      }],
    })

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    expect(coordination.presentation.get()?.items[0]?.representation).toBe('source')

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const initialLeft = Number.parseFloat(frame.style.left)
    const initialTop = Number.parseFloat(frame.style.top)
    expect(initialLeft).not.toBeCloseTo(50 * 8, 1)
    expect(initialTop).not.toBeCloseTo(50 * 8, 1)

    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }

    frame.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame.dispatchEvent(pointerEvent('pointermove', 200, 190))
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(initialLeft + 40)
    expect(Number.parseFloat(frame.style.top)).toBeCloseTo(initialTop + 30)
    const previewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    expect(previewStyle?.x).toBeCloseTo(55)
    expect(previewStyle?.y).toBeCloseTo(53.75)

    frame.dispatchEvent(pointerEvent('pointercancel', 200, 190))
    await waitTurns(24)
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(initialLeft)
    expect(Number.parseFloat(frame.style.top)).toBeCloseTo(initialTop)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    const southHandle = frame.querySelector<HTMLElement>('[data-selection-frame-handle="s"]')!
    southHandle.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    southHandle.dispatchEvent(pointerEvent('pointermove', 160, 180))
    const resizeStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    const heightDelta = 20 * Math.cos(angle)
    expect(resizeStyle?.height).toBeCloseTo(20 + heightDelta / 8)
    expect(resizeStyle?.x).toBeCloseTo(50 - Math.sin(angle) * heightDelta / 8)
    expect(resizeStyle?.y).toBeCloseTo(50 + (Math.cos(angle) - 1) * heightDelta / 8)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    southHandle.dispatchEvent(pointerEvent('pointerup', 160, 180))
    await waitTurns(24)
    const offset = actor.getSnapshot().context.scene?.decors.last?.offset
    expect(offset?.translate?.x).toBeCloseTo(resizeStyle?.x as number)
    expect(offset?.translate?.y).toBeCloseTo(resizeStyle?.y as number)
    expect(offset?.height).toBeCloseTo(resizeStyle?.height as number)
    expect(offset?.rotationOrigin).toEqual({ fx: 0, fy: 1 })
  })

  it('previews the complete pose while keeping a resize sparse in the document', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene() as EditorScene
    documentScene.items[0]!.rotationMode = 'manual'
    documentScene.decors.first!.offset = {
      ...documentScene.decors.first!.offset,
      scale: { x: 1.4, y: 0.7 },
    }
    documentScene.decors.last!.offset = {
      ...documentScene.decors.last!.offset,
      scale: { x: 1.4, y: 0.7 },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const eastHandle = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="e"]')!
    const initial = {
      left: Number.parseFloat(frame.style.left),
      top: Number.parseFloat(frame.style.top),
      width: Number.parseFloat(frame.style.width),
      height: Number.parseFloat(frame.style.height),
    }
    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }

    eastHandle.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    eastHandle.dispatchEvent(pointerEvent('pointermove', 120, 100))
    expect(Number.parseFloat(frame.style.width)).toBeGreaterThan(initial.width)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
    const previewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    expect(previewStyle).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      rotate: expect.any(Number),
      scaleX: 1.4,
      scaleY: 0.7,
      'transform-origin': '50% 50%',
    })

    eastHandle.dispatchEvent(pointerEvent('pointercancel', 120, 100))
    await waitTurns(24)
    expect(frame.style.left).toBe(`${initial.left}px`)
    expect(frame.style.top).toBe(`${initial.top}px`)
    expect(frame.style.width).toBe(`${initial.width}px`)
    expect(frame.style.height).toBe(`${initial.height}px`)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
    expect(documentScene.decors.last!.offset?.scale).toEqual({ x: 1.4, y: 0.7 })

    const southHandle = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="s"]')!
    const heightBase = Number.parseFloat(frame.style.height)
    const heightPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    snapshotPort.set = (patches) => {
      heightPreviews.push(patches)
      return setSnapshot(patches)
    }
    southHandle.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    southHandle.dispatchEvent(pointerEvent('pointermove', 100, 120))
    expect(Number.parseFloat(frame.style.height)).toBeGreaterThan(heightBase)
    const heightPreviewStyle = heightPreviews.at(-1)?.[0]?.state.style
    expect(heightPreviewStyle).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
      rotate: expect.any(Number),
      scaleX: 1.4,
      scaleY: 0.7,
      'transform-origin': '50% 50%',
    })

    southHandle.dispatchEvent(pointerEvent('pointercancel', 100, 120))
    await waitTurns(24)
    expect(frame.style.left).toBe(`${initial.left}px`)
    expect(frame.style.top).toBe(`${initial.top}px`)
    expect(frame.style.width).toBe(`${initial.width}px`)
    expect(frame.style.height).toBe(`${initial.height}px`)
    expect(documentScene.decors.last!.offset?.scale).toEqual({ x: 1.4, y: 0.7 })
  })

  it('keeps the tangent presentation rotation during a local width preview', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = tangentScene()
    documentScene.items[0]!.keyframes[0]!.timeMs = 800
    documentScene.items[0]!.keyframes[1]!.timeMs = 2500
    documentScene.decors.first!.offset = { ...documentScene.decors.first!.offset, rotate: 35 }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SEEK', timelineMs: 800 })
    await waitTurns(24)
    const presentation = coordination.presentation.get()!
    const tangentAngle = 35 * Math.PI / 180
    const presentedPose = {
      origin: { x: 400, y: 300 },
      matrix: {
        a: Math.cos(tangentAngle),
        b: Math.sin(tangentAngle),
        c: -Math.sin(tangentAngle),
        d: Math.cos(tangentAngle),
      },
      localWidth: 160,
      localHeight: 120,
    }
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      ...presentation,
      items: presentation.items.map((item) => ({ ...item, pose: presentedPose, representation: 'local' })),
    })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    actor.send({ type: 'SEEK', timelineMs: 800 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const item = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    const eastHandle = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="e"]')!
    const baseStyle = coordination.snapshot.get()!.states
      .find((state) => state.target.persoId === 'item')!.state.style as Record<string, unknown>
    const angle = (value: string): number => {
      const matrix = value.match(/matrix\(([^)]+)\)/)?.[1]?.split(',').map(Number)
      return matrix === undefined
        ? Number.parseFloat(value.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? 'NaN')
        : Math.atan2(matrix[1]!, matrix[0]!) * 180 / Math.PI
    }
    const transformAngle = (value: string): number => {
      const matrix = value.match(/matrix\(([^)]+)\)/)?.[1]?.split(',').map(Number)
      const matrixAngle = matrix === undefined ? 0 : Math.atan2(matrix[1]!, matrix[0]!) * 180 / Math.PI
      const rotations = [...value.matchAll(/rotate\(([-\d.]+)deg\)/g)]
        .reduce((sum, match) => sum + Number(match[1]), 0)
      return matrixAngle + rotations
    }
    const renderedItemAngle = (): number => [item, ...item.querySelectorAll<HTMLElement>('[data-part="editor-item-transform"], [data-part="editor-item-visual"]')]
      .reduce((sum, element) => sum + transformAngle(element.style.transform), 0)
    const initialFrameAngle = angle(frame.style.transform)
    const rootAngle = tangentAngle * 180 / Math.PI
    item.style.setProperty('transform', `matrix(${Math.cos(tangentAngle)}, ${Math.sin(tangentAngle)}, ${-Math.sin(tangentAngle)}, ${Math.cos(tangentAngle)}, 0, 0)`, 'important')
    const initialItemAngle = renderedItemAngle()
    expect(initialFrameAngle).toBeCloseTo(rootAngle, 1)
    expect(initialItemAngle).toBeCloseTo(initialFrameAngle, 1)

    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }

    eastHandle.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    eastHandle.dispatchEvent(pointerEvent('pointermove', 120, 100))
    const previewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    expect(previewStyle).toHaveProperty('width')
    expect(previewStyle?.['--editor-item-preview-transform']).toEqual(expect.stringMatching(/^matrix\(/))
    expect(previewStyle).not.toHaveProperty(ITEM_MOTION_REFERENCE_ANGLE)
    expect(previewStyle).not.toHaveProperty(ITEM_MOTION_ROTATION_BASELINE)
    expect(renderedItemAngle()).toBeCloseTo(angle(frame.style.transform), 1)
    expect(angle(frame.style.transform)).toBeCloseTo(initialFrameAngle, 1)

    eastHandle.dispatchEvent(pointerEvent('pointercancel', 120, 100))
    await waitTurns(24)
    expect(renderedItemAngle()).toBeCloseTo(initialItemAngle, 1)
    expect(angle(frame.style.transform)).toBeCloseTo(initialFrameAngle, 1)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    const southHandle = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="s"]')!
    southHandle.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    southHandle.dispatchEvent(pointerEvent('pointermove', 100, 120))
    const heightPreviewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    expect(heightPreviewStyle).toHaveProperty('height')
    expect(heightPreviewStyle?.['--editor-item-preview-transform']).toEqual(expect.stringMatching(/^matrix\(/))
    expect(renderedItemAngle()).toBeCloseTo(angle(frame.style.transform), 1)
    expect(angle(frame.style.transform)).toBeCloseTo(initialFrameAngle, 1)
    southHandle.dispatchEvent(pointerEvent('pointercancel', 100, 120))
    await waitTurns(24)
    expect(renderedItemAngle()).toBeCloseTo(initialItemAngle, 1)
    expect(angle(frame.style.transform)).toBeCloseTo(initialFrameAngle, 1)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
  })

  it('keeps route endpoints independent of previously visited keyframes', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = tangentScene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '100px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    /** Reads persistent route geometry while excluding the moving selected frame. */
    const routeGeometry = () => ({
      paths: [...sceneRoot.querySelectorAll('[data-motion-path]')].map((path) => path.getAttribute('d')),
      ghosts: [...sceneRoot.querySelectorAll<HTMLElement>('[data-motion-keyframe-id]')]
        .map((ghost) => ({
          keyframeId: ghost.dataset.motionKeyframeId,
          left: ghost.style.left,
          top: ghost.style.top,
          width: ghost.style.width,
          height: ghost.style.height,
          transform: ghost.style.transform,
        }))
        .sort((left, right) => String(left.keyframeId).localeCompare(String(right.keyframeId))),
    })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)
    const beforeVisits = routeGeometry()
    for (const [keyframeId, timeMs] of [['last-kf', 5_000], ['first-kf', 0]] as const) {
      actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId })
      actor.send({ type: 'SEEK', timelineMs: timeMs })
      await waitTurns(24)
    }
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)
    expect(routeGeometry()).toEqual(beforeVisits)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
  })

  it('previews a tangent move at the displayed Selection Frame position', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = tangentScene()
    delete documentScene.decors.last!.path
    documentScene.decors.first!.offset = {
      ...documentScene.decors.first!.offset,
      rotationOrigin: { fx: 0, fy: 1 },
    }
    documentScene.decors.last!.offset = {
      ...documentScene.decors.last!.offset,
      rotationOrigin: { fx: 0, fy: 1 },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    const tangentAngle = 35 * Math.PI / 180
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 5_000,
      playerTimeMs: 5_000,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 400, y: 400 },
          matrix: {
            a: Math.cos(tangentAngle),
            b: Math.sin(tangentAngle),
            c: -Math.sin(tangentAngle),
            d: Math.cos(tangentAngle),
          },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'local',
        progress: 1,
      }],
    })

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const initialLeft = Number.parseFloat(frame.style.left)
    const initialTop = Number.parseFloat(frame.style.top)
    const presentedAngle = readFrameRotation(frame)
    expect(presentedAngle).toBe(35)

    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }

    frame.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame.dispatchEvent(pointerEvent('pointermove', 200, 190))
    expect(Number.parseFloat(frame.style.left)).not.toBe(initialLeft)
    expect(Number.parseFloat(frame.style.top)).not.toBe(initialTop)
    const previewStyle = snapshotPreviews.at(-1)?.[0]?.state.style
    const displayedAngle = readFrameRotation(frame)
    expect(previewStyle).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
      rotate: expect.any(Number),
      scaleX: 1,
      scaleY: 1,
      'transform-origin': '0% 100%',
    })
    expect(Number(previewStyle?.rotate)).toBeCloseTo(displayedAngle, 1)
    expect(previewStyle?.['--editor-item-preview-transform']).toEqual(expect.stringMatching(/^matrix\(/))

    frame.dispatchEvent(pointerEvent('pointercancel', 200, 190))
    await waitTurns(24)
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(initialLeft)
    expect(Number.parseFloat(frame.style.top)).toBeCloseTo(initialTop)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
  })

  it('allows one initial tangent rotation, protects other positions, and preserves endpoint ghosts', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = tangentScene()
    documentScene.decors.last!.style = {
      ...documentScene.decors.last!.style,
      padding: '4px 0px 0px 8px',
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '100px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns(24)
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const readFrameValue = (element: HTMLElement): SelectionFrameValue => {
      const origin = element.style.transformOrigin.split(/\s+/)
      const originFraction = (value: string | undefined): number => {
        if (value === undefined || value === 'center') return 0.5
        if (value === 'left' || value === 'top') return 0
        if (value === 'right' || value === 'bottom') return 1
        return Number.parseFloat(value) / 100
      }
      return {
        x: Number.parseFloat(element.style.left),
        y: Number.parseFloat(element.style.top),
        width: Number.parseFloat(element.style.width),
        height: Number.parseFloat(element.style.height),
        rotate: readFrameRotation(element),
        rotationOrigin: { fx: originFraction(origin[0]), fy: originFraction(origin[1]) },
      }
    }
    const readOverlayFrame = readFrameValue
    const targetDocumentFrame: SelectionFrameValue = { x: 50, y: 50, width: 20, height: 20, rotate: 0 }
    const testInsets = { top: 0.6, right: 0.6, bottom: 0.6, left: 0.6 }
    const targetInsets = { top: 4.6, right: 0.6, bottom: 0.6, left: 8.6 }
    const sourceDocumentFrame: SelectionFrameValue = { x: 10, y: 10, width: 20, height: 20, rotate: 0 }
    const sourcePathAnchor = motionPathAnchorForFrame(sourceDocumentFrame, testInsets)
    const targetPathAnchor = motionPathAnchorForFrame(targetDocumentFrame, targetInsets)
    const sourceTangent = motionPathTangentAngle(
      'M 0 0 A 0.7 0.7 0 0 1 1 0',
      sourcePathAnchor,
      targetPathAnchor,
      0,
    )!
    expect(readFrameRotation(sourceGhost)).toBe(readFrameRotation(sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!))

    const targetTangent = motionPathTangentAngle(
      'M 0 0 A 0.7 0.7 0 0 1 1 0',
      sourcePathAnchor,
      targetPathAnchor,
      1,
    )!
    expect(readFrameRotation(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!)).toBeCloseTo(targetTangent, 5)

    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    expect(readFrameRotation(targetGhost)).toBe(readFrameRotation(sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!))
    expect(readFrameRotation(sourceGhost)).toBeCloseTo(sourceTangent, 5)
    const projectedSourceGhost = frameWithTangentAtPathAnchor(
      sourceDocumentFrame,
      sourcePathAnchor,
      sourceTangent,
      testInsets,
    )
    const actualSourceGhost = readOverlayFrame(sourceGhost)
    expect(frameVisualCenter(actualSourceGhost).x).toBeCloseTo(frameVisualCenter(projectedSourceGhost).x, 1)
    expect(frameVisualCenter(actualSourceGhost).y).toBeCloseTo(frameVisualCenter(projectedSourceGhost).y, 1)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    const beforeBlockedGesture = actor.getSnapshot().context.scene
    const blockedFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const blockedTip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    expect(blockedTip.style.display).toBe('none')
    rotateNeedle(blockedFrame, blockedTip, 90)
    await waitTurns(24)
    expect(actor.getSnapshot().context.scene).toBe(beforeBlockedGesture)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns(24)
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const tip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    expect(tip.style.display).toBe('')
    let previewAngle = Number.NaN
    rotateNeedle(frame, tip, 45, () => {
      previewAngle = readFrameRotation(frame)
      expect(Number.isInteger(previewAngle)).toBe(true)
    })
    await waitTurns(24)
    const committedScene = actor.getSnapshot().context.scene!
    const committedItem = committedScene.items[0]!
    const sourceKeyframe = committedItem.keyframes.find((keyframe) => keyframe.id === 'first-kf')!
    expect(committedScene.decors[sourceKeyframe.decorId]?.offset?.rotate).toBeDefined()
    expect(committedItem.keyframes).toHaveLength(2)
    expect(committedScene.decors.last!.offset?.rotate).toBeUndefined()
    expect(committedScene.decors.last!.path).toBe(documentScene.decors.last!.path)
    expect(committedScene.decors[sourceKeyframe.decorId]?.offset?.rotate).toBe(45)
    // jsdom has no captured layout dimensions: preview/commit visual continuity is an MCP gate.
    expect(previewAngle).toBe(45)
    const built = buildSceneDocV2(committedScene)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const perso = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    expect(perso.actions['item-kf-last-kf']).toHaveProperty('move.transition.rotateOffset', {
      from: committedScene.decors[sourceKeyframe.decorId]!.offset!.rotate,
      to: committedScene.decors[sourceKeyframe.decorId]!.offset!.rotate,
    })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    expect(tip.style.display).toBe('none')
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns(24)
    expect(tip.style.display).toBe('')
  })

  it('transporte border-width depuis la palette vers le KF decor de la scène Test position', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()

    const initialFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(initialFrame).not.toBeNull()
    // At 800px root width, the authored offset is the content-box origin. The builder places the
    // border-box before it, so the CS remains at 240px while retaining the 160px content size.
    expect(Number.parseFloat(initialFrame!.style.left)).toBeCloseTo(240, 6)
    expect(Number.parseFloat(initialFrame!.style.top)).toBeCloseTo(240, 6)
    expect(initialFrame!.style.width).toBe('160px')
    expect(initialFrame!.style.height).toBe('160px')

    const borderWidthInput = decorPanel.querySelector<HTMLInputElement>(
      '[data-decor-property-path="style.border-width"] input[type="number"]',
    )
    expect(borderWidthInput).not.toBeNull()
    expect(borderWidthInput!.value).toBe('2.4')

    borderWidthInput!.value = '20'
    borderWidthInput!.dispatchEvent(new Event('change', { bubbles: true }))
    await waitTurns(24)

    const committedScene = actor.getSnapshot().context.scene!
    expect(committedScene).not.toBe(documentScene)
    const committedItem = committedScene.items.find(candidateItem => candidateItem.id === 'item')!
    const created = committedItem.keyframes.find(keyframe => keyframe.timeMs === 2_500)
    expect(created?.channel).toBe('decor')
    expect(committedScene.decors[created!.decorId]?.style?.['border-width']).toBe('5cqw')
    expect(decorPanel.querySelector('.dedit-field__control[data-decor-property-path="style.border-width"]')
      ?.classList.contains('dedit-field__control--modified')).toBe(false)

    const liveItem = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')!
    expect(liveItem.style.getPropertyValue('border-width')).toBe('5cqw')
    expect(liveItem.style.getPropertyValue('border-style')).toBe('solid')
    expect(coordination.transport.getProgress()?.timelineMs).toBe(2_500)
    // Increasing the border changes only the border-box origin/size; the content-box anchor stays
    // at the same authored coordinates.
    expect(Number.parseFloat(initialFrame!.style.left)).toBeCloseTo(240, 6)
    expect(Number.parseFloat(initialFrame!.style.top)).toBeCloseTo(240, 6)
    expect(initialFrame!.style.width).toBe('160px')
    expect(initialFrame!.style.height).toBe('160px')

    actor.send({ type: 'SEEK', timelineMs: 3_500 })
    await waitTurns(24)

    const committedItemNode = sceneRoot.querySelector<HTMLElement>('[data-editor-visual-for="item"]')
    expect(committedItemNode?.style.getPropertyValue('border-width')).not.toBe('')
    expect(committedItemNode?.style.getPropertyValue('border-style')).toBe('solid')
  })

  it('fait suivre le CS au seek intermédiaire malgré le dernier KF sélectionné', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: positionTestScene() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    // The controller deliberately keeps the explicit KF selection during a scrub. The visual CS
    // must nevertheless use the runtime pose at the sought time, including for a bordered item.
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    expect(frame.style.left).toBe('400px')
    expect(frame.style.top).toBe('400px')

    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)
    expect(frame.style.left).toBe('240px')
    expect(frame.style.top).toBe('240px')
  })

  it('garde le CS sur la pose présentée quand un KF bordé reste sélectionné', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene('2cqw', '2cqw')
    documentScene.decors.first.offset.height = 15
    documentScene.decors.last.offset.height = 15
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)

    const pose = {
      origin: { x: 520, y: 280 },
      matrix: { a: 0.8, b: 0.6, c: -0.6, d: 0.8 },
      localWidth: 192,
      localHeight: 152,
    }
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 2_500,
      playerTimeMs: 2_500,
      items: [{ itemId: 'story-main:item', pose, representation: 'local', progress: 0.5 }],
    })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(523.2, 3)
    expect(Number.parseFloat(frame.style.top)).toBeCloseTo(302.4, 3)
    expect(Number.parseFloat(frame.style.width)).toBeCloseTo(160, 3)
    expect(Number.parseFloat(frame.style.height)).toBeCloseTo(120, 3)
  })

  it('ne reprojette pas la bordure du KF source sur le ghost du KF cible', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene('0.6cqw', '2cqw')
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    await waitTurns(24)

    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')
    expect(targetGhost).not.toBeNull()
    // The target keeps its own 2cqw border. Its 16px physical inset moves the ghost's outer
    // border-box origin to 384px, independently of source edits.
    expect(Number.parseFloat(targetGhost!.style.left)).toBeCloseTo(384, 6)
    expect(Number.parseFloat(targetGhost!.style.top)).toBeCloseTo(384, 6)
    expect(Number.parseFloat(targetGhost!.style.width)).toBeCloseTo(192, 6)
    expect(Number.parseFloat(targetGhost!.style.height)).toBeCloseTo(192, 6)

    const borderWidthInput = decorPanel.querySelector<HTMLInputElement>(
      '[data-decor-property-path="style.border-width"] input[type="number"]',
    )
    expect(borderWidthInput).not.toBeNull()
    borderWidthInput!.value = '20'
    borderWidthInput!.dispatchEvent(new Event('change', { bubbles: true }))
    await waitTurns(24)

    expect(Number.parseFloat(targetGhost!.style.left)).toBeCloseTo(384, 6)
    expect(Number.parseFloat(targetGhost!.style.top)).toBeCloseTo(384, 6)
  })

  it('sérialise la pose extérieure après un déplacement du CS content-box bordé', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = positionTestScene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 140, 100))
    moveZone.dispatchEvent(pointerEvent('pointerup', 140, 100))
    await waitTurns(24)

    const committed = actor.getSnapshot().context.scene!
    const committedItem = committed.items.find(candidate => candidate.id === 'item')!
    const middle = committedItem.keyframes.find(keyframe => keyframe.timeMs === 2_500)
    expect(middle?.channel).toBe('pose')
    // The displayed content origin moved from 30cqw by 40px. The persisted pose remains in the
    // content-box coordinate system, so the new offset is 35cqw.
    expect(committed.decors[middle!.decorId]?.offset).toMatchObject({
      translate: { x: 35, y: 30 },
      width: 20,
      height: 20,
    })
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(280, 6)
    expect(Number.parseFloat(frame.style.top)).toBeCloseTo(240, 6)
    expect(frame.style.width).toBe('160px')
    expect(frame.style.height).toBe('160px')
  })

  it('fait passer rotation, axe, preview puis commit par le circuit V2 du décor', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    documentScene.decors.first!.offset!.rotate = 76.694
    documentScene.decors.last!.offset!.rotate = 76.694
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    const tip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')
    const pivot = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')
    expect(frame).not.toBeNull()
    expect(tip).not.toBeNull()
    expect(pivot).not.toBeNull()

    // Snap the fractional absolute angle 76.694° + 13.2° to the nearest whole degree.
    let previewRotation = Number.NaN
    rotateNeedle(frame!, tip!, 13.2, () => {
      previewRotation = Number.parseFloat(frame!.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] ?? 'NaN')
    })
    expect(previewRotation).toBe(90)

    // A Selection Frame rotation is a pose gesture: the middle waypoint is materialized on release.
    const rotatedScene = actor.getSnapshot().context.scene!
    const rotatedItem = rotatedScene.items.find((candidate) => candidate.id === 'item')!
    const rotatedKeyframe = rotatedItem.keyframes.find((keyframe) => keyframe.timeMs === 2_500)
    expect(rotatedKeyframe?.channel).toBe('pose')
    expect(rotatedScene.decors[rotatedKeyframe!.decorId]?.offset?.rotate).toBe(90)
    expect(rotatedItem.keyframes.filter((keyframe) => keyframe.timeMs === 2_500)).toHaveLength(1)

    await waitTurns(24)
    const itemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(frame!.style.transform).toContain('rotate(90deg)')
    expect(frame!.style.transformOrigin).toBe('50% 50%')

    // The pivot drag is previewed in the same frame channel and updates the origin without a
    // second player circuit. Move it to the top-left characteristic point.
    // The pose transaction is synchronous; wait for the scene/player echo before starting the
    // next gesture so the pivot is mounted on the newly-created waypoint.
    await waitTurns(24)
    pivot!.dispatchEvent(pointerEvent('pointerdown', 320, 320))
    pivot!.dispatchEvent(pointerEvent('pointermove', 400, 240))
    pivot!.dispatchEvent(pointerEvent('pointerup', 400, 240))
    await waitTurns(24)
    const pivotedItemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(getComputedStyle(pivotedItemNode).transformOrigin).toBe('0% 0%')
    expect(coordination.decorPreview.getAt('item', 2_500)).toBeNull()
    const middleAfterPivot = actor.getSnapshot().context.scene!.items[0]!.keyframes.find(
      (keyframe) => keyframe.timeMs === 2_500,
    )!
    expect(middleAfterPivot.channel).toBe('pose')
    expect(actor.getSnapshot().context.scene!.decors[middleAfterPivot.decorId]?.offset).toMatchObject({
      rotate: 90,
      rotationOrigin: { fx: 0, fy: 0 },
    })
    expect(actor.getSnapshot().context.scene).not.toBe(documentScene)

    // At an exact keyframe the same modifier path updates the existing pose KF immediately.
    actor.send({ type: 'SEEK', timelineMs: 0 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    await waitTurns()
    const exactFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const exactTip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    const exactPivot = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')!
    rotateNeedle(exactFrame, exactTip, 13.2)
    await waitTurns(24)
    exactPivot.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    exactPivot.dispatchEvent(pointerEvent('pointermove', 240, 80))
    exactPivot.dispatchEvent(pointerEvent('pointerup', 240, 80))
    await waitTurns(24)
    const exactItemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(exactFrame.style.transformOrigin).toBe('0% 0%')
    expect(exactFrame.style.transform).toContain('rotate(90deg)')
    expect(getComputedStyle(exactItemNode).transformOrigin).toBe('0% 0%')

    actor.send({ type: 'CLEAR_SELECTION' })
    await waitTurns(24)
    const committedScene = actor.getSnapshot().context.scene!
    expect(committedScene).not.toBe(documentScene)
    expect(committedScene.decors.first?.offset).toMatchObject({
      rotate: 90,
      rotationOrigin: { fx: 0, fy: 0 },
    })
  })

  it('met à jour le KF exact ou matérialise le playhead entre KFs sans toucher au parent', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns()

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(frame).not.toBeNull()
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('none')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector('[data-motion-path]')).not.toBeNull()
    expect(frame?.style.pointerEvents).toBe('auto')
    expect(sceneRoot.querySelector('[data-motion-move-zone]')).toBeNull()

    // Escape cancels an unreleased Selection Frame preview and leaves the document untouched.
    const frameLeftBeforeEscape = Number.parseFloat(frame!.style.left)
    frame!.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame!.dispatchEvent(pointerEvent('pointermove', 220, 190))
    expect(Number.parseFloat(frame!.style.left)).toBeCloseTo(frameLeftBeforeEscape + 60)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(Number.parseFloat(frame!.style.left)).toBeCloseTo(frameLeftBeforeEscape)
    frame!.dispatchEvent(pointerEvent('pointerup', 220, 190))
    await waitTurns(8)
    expect(actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes).toHaveLength(2)

    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }
    const firstFrameLeft = Number.parseFloat(frame!.style.left)
    const firstFrameTop = Number.parseFloat(frame!.style.top)
    const snapshotCountBeforeMove = snapshotPreviews.length
    frame!.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame!.dispatchEvent(pointerEvent('pointermove', 240, 200))
    expect(Number.parseFloat(frame!.style.left)).toBeCloseTo(firstFrameLeft + 80)
    expect(Number.parseFloat(frame!.style.top)).toBeCloseTo(firstFrameTop + 40)
    expect(snapshotPreviews.length).toBeGreaterThan(snapshotCountBeforeMove)
    expect(snapshotPreviews.at(-1)?.[0]?.state.style).toMatchObject({ x: 20, y: 15 })
    frame!.dispatchEvent(pointerEvent('pointerup', 240, 200))
    await waitTurns(24)

    // At a real KF the Selection Frame gesture updates that KF at the same time; it does not invent a
    // future target from a provisional duration.
    let committedItem = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!
    expect(committedItem.keyframes).toHaveLength(2)
    expect(actor.getSnapshot().context.scene!.decors.first?.offset).toMatchObject({ translate: { x: 20, y: 15 } })

    // Between real KFs the same gesture materializes the current author playhead.
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const betweenFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(betweenFrame).not.toBeNull()
    expect(sceneRoot.querySelector('[data-motion-move-zone]')).toBeNull()
    expect(betweenFrame?.style.zIndex).toBe('1160')
    expect(betweenFrame?.style.pointerEvents).toBe('auto')
    expect(sceneRoot.querySelector('[data-selection-frame-needle-tip]')).not.toBeNull()
    expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')?.style.pointerEvents).toBe('auto')
    expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')?.style.pointerEvents).toBe('auto')
    const betweenHandles = [...sceneRoot.querySelectorAll<HTMLElement>('[data-selection-frame-handle]')]
    expect(betweenHandles).toHaveLength(8)
    expect(betweenHandles.every((handle) => handle.style.pointerEvents === 'auto')).toBe(true)
    betweenFrame!.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    betweenFrame!.dispatchEvent(pointerEvent('pointermove', 180, 140))
    const previewPaths = [...sceneRoot.querySelectorAll<SVGPathElement>('[data-motion-path]')]
    expect(previewPaths).toHaveLength(2)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(1)
    const previewPathData = previewPaths.map((path) => path.getAttribute('d'))
    expect(previewPathData[0]).not.toBe(previewPathData[1])
    betweenFrame!.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const committedScene = actor.getSnapshot().context.scene!
    committedItem = committedScene.items.find((item) => item.id === 'item')!
    const target = committedItem.keyframes.find((keyframe) => keyframe.timeMs === 500)
    expect(target).toBeDefined()
    expect(committedItem.keyframes).toHaveLength(3)
    expect(committedItem.parentId).toBe(documentScene.items[0]!.parentId)
    expect(committedScene.decors[target!.decorId]?.offset?.translate).not.toEqual({ x: 20, y: 15 })
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: target!.id })
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('none')
    expect(sceneRoot.querySelector('[data-selection-frame="v2"]')).not.toBeNull()
    expect([...sceneRoot.querySelectorAll<SVGPathElement>('[data-motion-path]')].map((path) => path.getAttribute('d')))
      .toEqual(previewPathData)

    // A second Selection Frame drag on the newly-created KF updates it without duplication.
    const targetOffsetBeforeSecondMove = committedScene.decors[target!.decorId]?.offset?.translate
    betweenFrame!.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    betweenFrame!.dispatchEvent(pointerEvent('pointermove', 300, 230))
    betweenFrame!.dispatchEvent(pointerEvent('pointerup', 300, 230))
    await waitTurns(24)
    committedItem = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!
    const sameTarget = committedItem.keyframes.find((keyframe) => keyframe.timeMs === 500)
    expect(sameTarget?.id).toBe(target!.id)
    expect(committedItem.keyframes).toHaveLength(3)
    expect(actor.getSnapshot().context.scene!.decors[sameTarget!.decorId]?.offset?.translate).not.toEqual(targetOffsetBeforeSecondMove)

    const pathControl = sceneRoot.querySelector<HTMLElement>('[data-motion-path-control]')
    expect(pathControl).not.toBeNull()
    pathControl!.dispatchEvent(pointerEvent('pointerdown', 200, 180))
    pathControl!.dispatchEvent(pointerEvent('pointermove', 200, 240))
    pathControl!.dispatchEvent(pointerEvent('pointerup', 200, 240))
    await waitTurns(24)
    const pathDecorId = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!.decorId
    expect(actor.getSnapshot().context.scene!.decors[pathDecorId]?.path).toMatch(/^M 0 0 A /)

    // Seeking inside the active segment must not rebuild the path from the live interpolated
    // snapshot. The target decor remains the authored source of the path, while the CS follows
    // its projected point at the new time.
    const pathBeforeSeek = sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')
    const frameBeforeSeek = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(pathBeforeSeek).toContain('A')
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 750,
      playerTimeMs: 750,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 420, y: 300 },
          matrix: { a: 0.8660254037844387, b: 0.5, c: -0.5, d: 0.8660254037844387 },
          localWidth: 80,
          localHeight: 80,
        },
        representation: 'local',
        progress: 0.5,
      }],
    })
    actor.send({ type: 'SEEK', timelineMs: 750 })
    await waitTurns(24)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toBe(pathBeforeSeek)
    expect(frameBeforeSeek?.style.left).not.toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('')
    expect(Number.parseFloat(frameBeforeSeek?.style.left ?? 'NaN')).toBeCloseTo(
      420 - Math.cos(Math.PI / 6) * 40 + Math.sin(Math.PI / 6) * 40,
      6,
    )
    expect(Number.parseFloat(frameBeforeSeek?.style.top ?? 'NaN')).toBeCloseTo(
      300 - Math.sin(Math.PI / 6) * 40 - Math.cos(Math.PI / 6) * 40,
      6,
    )
    expect(readFrameRotation(frameBeforeSeek!)).toBeCloseTo(30, 6)


    // Both endpoint ghosts are navigation targets. Each click selects its KF and seeks through
    // the same controller path as a timeline click; the endpoint projections remain available.
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    sourceGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'first-kf' })
    targetGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: target!.id })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toBe(pathBeforeSeek)

    pathControl!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.scene!.decors[pathDecorId]?.path).toBeUndefined()

    // Selecting a different keyframe on the same item reconstructs its own adjacent segment;
    // the previous active projection must not overwrite this selection.
    const pathAtSecondTarget = sceneRoot.querySelector('[data-motion-path]')?.getAttribute('d')
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    expect(sceneRoot.querySelector('[data-motion-path]')?.getAttribute('d')).not.toBe(pathAtSecondTarget)
  })

  it('promeut un KF décor en KF pose et capture sa pose complète lors d’un mouvement', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene: EditorScene = scene()
    documentScene.decors.first!.offset!.scale = { x: 1.2, y: 0.8 }
    documentScene.decors.last!.offset!.scale = { x: 1.6, y: 1.2 }
    documentScene.items[0] = {
      ...documentScene.items[0]!,
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first', channel: 'pose' },
        { id: 'decor-kf', timeMs: 2_500, decorId: 'decor-only', channel: 'decor' },
        { id: 'last-kf', timeMs: 5_000, decorId: 'last', channel: 'pose' },
      ],
    }
    documentScene.decors['decor-only'] = {
      id: 'decor-only',
      style: { 'background-color': 'oklch(0.7 0.2 120)' },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    const getPresentation = presentationPort.get
    presentationPort.get = () => {
      const presentation = getPresentation()
      if (coordination.transport.getProgress()?.timelineMs !== 2_500) return presentation
      return {
        timeMs: 2_500,
        playerTimeMs: 2_500,
        items: [{
          itemId: 'story-main:item',
          pose: {
            origin: { x: 240, y: 240 },
            localWidth: 160,
            localHeight: 160,
            matrix: { a: 0.6, b: 0, c: 0, d: 0.7 },
          },
          representation: 'local',
          progress: 0.5,
        }],
      }
    }
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'decor-kf' })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns(24)

    expect(sceneRoot.querySelector('[data-motion-keyframe-id="decor-kf"]')).toBeNull()
    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    expect(moveZone).not.toBeNull()
    expect(readFrameMatrix(moveZone)).toEqual([0.6, 0, 0, 0.7])
    const poseStyle = coordination.snapshot.get()?.states.find(state => state.target.persoId === 'item')?.state.style
    expect(poseStyle).toMatchObject({ scaleX: expect.closeTo(1.4), scaleY: expect.closeTo(1) })
    const initialWidth = Number.parseFloat(moveZone.style.width)
    const initialHeight = Number.parseFloat(moveZone.style.height)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const committed = actor.getSnapshot().context.scene!
    const committedItem = committed.items.find((item) => item.id === 'item')!
    const promoted = committedItem.keyframes.find((keyframe) => keyframe.id === 'decor-kf')!
    expect(promoted.channel).toBe('pose')
    expect(committedItem.keyframes).toHaveLength(3)
    expect(committed.decors[promoted.decorId]?.offset).toMatchObject({
      width: initialWidth / 8,
      height: initialHeight / 8,
      scale: { x: expect.closeTo(1.4), y: expect.closeTo(1) },
    })
    expect(sceneRoot.querySelectorAll('[data-motion-path]')).toHaveLength(2)
  })

  it('reconstruit le path actif au chargement d’un décor avec les mêmes identifiants', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    actions = new EditorActionsFacade(actor)
    actions.loadScene(tangentScene())
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    await waitTurns(24)
    const originalPath = sceneRoot.querySelector<SVGPathElement>('[data-motion-path-active]')?.getAttribute('d')
    expect(originalPath).toContain('A')

    const replacementScene = tangentScene()
    replacementScene.decors.last!.path = 'M 0 0 A 0.7 0.7 0 0 0 1 0'
    actions.loadScene(replacementScene)
    await waitTurns(32)

    const replacementPath = sceneRoot.querySelector<SVGPathElement>('[data-motion-path-active]')?.getAttribute('d')
    expect(replacementPath).toContain('A')
    expect(replacementPath).not.toBe(originalPath)
  })

  it('recalcule la pose cible du segment pendant le repositionnement CS du KF matérialisé', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns()

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    const middleBaseTop = Number.parseFloat(moveZone.style.top)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const initialTargetLeft = targetGhost.style.left
    const initialSourceLeft = sourceGhost.style.left
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!

    // Reposition the newly-created target directly through the existing CS move channel. The
    // target ghost follows the live candidate while dragging; pointerup commits it.
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    expect(targetGhost.style.left).not.toBe(initialTargetLeft)
    expect(sourceGhost.style.left).toBe(initialSourceLeft)
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))

    // The move completes at pointerup; the seek replays the committed pose at the same time.
    // The target ghost is hidden because the item occupies that pose; the source stays available.
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    const committed = actor.getSnapshot().context.scene!
    const item = committed.items.find((candidate) => candidate.id === 'item')!
    const target = item.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    expect(committed.decors[target.decorId]?.offset?.translate?.x).toBeCloseTo((middleBaseLeft + 80 + 40) / 8)
    expect(committed.decors[target.decorId]?.offset?.translate?.y).toBeCloseTo((middleBaseTop + 40 + 20) / 8)
    expect(targetGhost.style.display).toBe('none')
    expect(targetGhost.style.left).toBe(frame.style.left)
    expect(sourceGhost.style.left).toBe(initialSourceLeft)
  })

  it('repositionne le dernier KF sans en créer et isole son décor partagé', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const documentScene = {
      ...baseScene,
      items: baseScene.items.map((item) => ({
        ...item,
        keyframes: item.keyframes.map((keyframe) => (
          keyframe.id === 'last-kf' ? { ...keyframe, decorId: 'first' } : keyframe
        )),
      })),
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    expect(sceneRoot.querySelectorAll('[data-motion-move-zone]')).toHaveLength(0)
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const initialFrameLeft = Number.parseFloat(frame.style.left)
    const initialFrameTop = Number.parseFloat(frame.style.top)
    const snapshotPort = coordination.snapshot as unknown as {
      set: (patches: Parameters<typeof coordination.snapshot.set>[0]) => ReturnType<typeof coordination.snapshot.set>
    }
    const snapshotPreviews: Parameters<typeof coordination.snapshot.set>[0][] = []
    const setSnapshot = snapshotPort.set
    snapshotPort.set = (patches) => {
      snapshotPreviews.push(patches)
      return setSnapshot(patches)
    }
    expect(sceneRoot.querySelector('[data-motion-border]')).toBeNull()

    frame.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame.dispatchEvent(pointerEvent('pointermove', 240, 200))
    const previewedFrameLeft = Number.parseFloat(frame.style.left)
    const previewedFrameTop = Number.parseFloat(frame.style.top)
    expect(previewedFrameLeft).toBeCloseTo(initialFrameLeft + 80)
    expect(previewedFrameTop).toBeCloseTo(initialFrameTop + 40)
    expect(snapshotPreviews.at(-1)?.[0]?.state.style).toMatchObject({ x: 20, y: 15 })
    frame.dispatchEvent(pointerEvent('pointerup', 240, 200))
    await waitTurns(24)

    const committedScene = actor.getSnapshot().context.scene!
    const committedItem = committedScene.items.find((item) => item.id === 'item')!
    const firstKeyframe = committedItem.keyframes.find((keyframe) => keyframe.id === 'first-kf')!
    const lastKeyframe = committedItem.keyframes.find((keyframe) => keyframe.id === 'last-kf')!
    expect(committedItem.keyframes).toHaveLength(2)
    expect(firstKeyframe.decorId).toBe('first')
    expect(lastKeyframe.decorId).not.toBe('first')
    expect(committedScene.decors.first?.offset?.translate).toEqual({ x: 10, y: 10 })
    expect(committedScene.decors[lastKeyframe.decorId]?.offset?.translate).toEqual({ x: 20, y: 15 })
  })

  it('projette tous les ghosts de la chaîne et repositionne le KF exact sans en créer un autre', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const chainKeyframes = [0, 500, 1_000, 1_500, 2_000].map((timeMs, index) => ({
      id: `chain-kf-${index}`,
      timeMs,
      decorId: `chain-decor-${index}`,
    }))
    const chainDecors = Object.fromEntries(chainKeyframes.map((keyframe, index) => [keyframe.decorId, {
      id: keyframe.decorId,
      offset: {
        translate: { x: 10 + index * 10, y: 10 + index * 5 },
        width: 20,
        height: 20,
      },
    }]))
    const documentScene = {
      ...baseScene,
      items: [{
        ...baseScene.items[0]!,
        initialDecorId: 'chain-decor-0',
        keyframes: chainKeyframes,
      }],
      decors: chainDecors,
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'chain-kf-2' })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)

    const ghosts = [...sceneRoot.querySelectorAll<HTMLElement>('[data-motion-ghost]')]
    expect(ghosts).toHaveLength(5)
    expect(new Set(ghosts.map((ghost) => ghost.dataset.motionKeyframeId))).toEqual(new Set(
      chainKeyframes.map((keyframe) => keyframe.id),
    ))
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-2"]')?.style.display).toBe('none')
    for (const keyframe of chainKeyframes.filter((candidate) => candidate.id !== 'chain-kf-2')) {
      expect(sceneRoot.querySelector<HTMLElement>(`[data-motion-keyframe-id="${keyframe.id}"]`)?.style.display).not.toBe('none')
    }
    expect(sceneRoot.querySelectorAll('[data-motion-path]')).toHaveLength(4)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(3)
    expect(sceneRoot.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)

    const nearGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-1"]')!
    const nearbyInactiveGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-3"]')!
    const farGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-0"]')!
    expect(nearGhost.dataset.motionGhostDistance).toBe('1')
    expect(farGhost.dataset.motionGhostDistance).toBe('2')
    expect(nearGhost.style.opacity).toBe('1')
    expect(nearbyInactiveGhost.style.opacity).toBe('0.18')
    expect(farGhost.style.opacity).toBe('0.14')
    expect(nearbyInactiveGhost.style.borderColor).not.toBe(farGhost.style.borderColor)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))
    expect(actor.getSnapshot().context.scene!.items[0]!.keyframes).toHaveLength(5)

    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)
    const committed = actor.getSnapshot().context.scene!
    const committedItem = committed.items[0]!
    expect(committedItem.keyframes).toHaveLength(5)
    expect(committed.decors['chain-decor-2']?.offset).toMatchObject({ translate: { x: 35, y: 22.5 } })
    expect(committed.decors['chain-decor-1']?.offset).toMatchObject({ translate: { x: 20, y: 15 } })
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-2"]')?.style.display).toBe('none')

    const distantGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-4"]')!
    distantGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'chain-kf-4' })
  })

  it('déplace le KF terminal depuis la même pose présentée que le CS', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const documentScene = {
      ...baseScene,
      decors: {
        ...baseScene.decors,
        last: {
          ...baseScene.decors.last!,
          path: 'M 0 0 A 0.65 0.65 0 0 1 1 0',
        },
      },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    // The acknowledged presentation owns the visible item/CS pose. The movement surface must
    // use it as well rather than starting from a different authored trajectory endpoint.
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 5_000,
      playerTimeMs: 5_000,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 120, y: 120 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'local',
        progress: 1,
      }],
    })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    expect(moveZone.style.left).toBe(targetGhost.style.left)
    expect(moveZone.style.top).toBe(targetGhost.style.top)

    moveZone.dispatchEvent(pointerEvent('pointerdown', 0, 0))
    moveZone.dispatchEvent(pointerEvent('pointermove', 40, 0))
    moveZone.dispatchEvent(pointerEvent('pointerup', 40, 0))

    const committed = actor.getSnapshot().context.scene!
    const committedItem = committed.items.find((candidate) => candidate.id === 'item')!
    const terminal = committedItem.keyframes.find((keyframe) => keyframe.id === 'last-kf')!
    expect(committed.decors[terminal.decorId]?.path).toBe('M 0 0 A 0.65 0.65 0 0 1 1 0')
    expect(committed.decors[terminal.decorId]?.offset?.translate?.x).toBeCloseTo(20)
  })

  it('conserve la translation repositionnée quand un resize suit sur le même KF', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    const middleBaseTop = Number.parseFloat(moveZone.style.top)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const target = actor.getSnapshot().context.scene!.items.find((candidate) => candidate.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const targetBefore = actor.getSnapshot().context.scene!.decors[target.decorId]?.offset
    // A newly-created pose KF freezes the complete affine waypoint. Width/height are therefore
    // intentionally materialized even though this gesture only repositioned the item; otherwise
    // the second half of the split route would resolve those dimensions from the wrong endpoint.
    expect(targetBefore?.width).toBeCloseTo(20)
    expect(targetBefore?.height).toBeCloseTo(20)
    expect(targetBefore?.translate?.x).toBeCloseTo((middleBaseLeft + 80) / 8)
    expect(targetBefore?.translate?.y).toBeCloseTo((middleBaseTop + 40) / 8)

    // A stale presentation frame is possible during the asynchronous target seek. It must not
    // replace the accepted CS candidate used as the base of the next gesture.
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 500,
      playerTimeMs: 500,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 80, y: 80 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'local',
        progress: 1,
      }],
    })

    // Reposition on the current target KF, then resize it. The resize must start from the
    // repositioned target pose, not from the stale source presentation.
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))
    const targetAfterMove = frame.getAttribute('style')
    const east = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="e"]')!
    east.dispatchEvent(pointerEvent('pointerdown', 300, 220))
    east.dispatchEvent(pointerEvent('pointermove', 330, 220))
    east.dispatchEvent(pointerEvent('pointerup', 330, 220))
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(middleBaseLeft + 80 + 40)
    expect(frame.getAttribute('style')).not.toBe(targetAfterMove)

    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const committed = actor.getSnapshot().context.scene!
    const committedTarget = committed.items.find((candidate) => candidate.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    expect(committed.decors[committedTarget.decorId]?.offset).toMatchObject({
      width: 23.75,
    })
    expect(committed.decors[committedTarget.decorId]?.offset?.translate?.x).toBeCloseTo((middleBaseLeft + 80 + 40) / 8)
    expect(committed.decors[committedTarget.decorId]?.offset?.translate?.y).toBeCloseTo((middleBaseTop + 40 + 20) / 8)
  })

  it('reprojette le CS, les ghosts et tous les paths quand la racine change de largeur', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    const resizeCallbacks: Array<() => void> = []
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(() => callback([], this as unknown as ResizeObserver))
      }
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    let rootWidth = 800
    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = `${rootWidth}px`
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: rootWidth, height: rootWidth * 9 / 16, top: 0, left: 0, right: rootWidth, bottom: rootWidth * 9 / 16 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    // The runtime and decor bridges observe the same root. Give the staged player root the same
    // measurable width so its resize callback refreshes PresentationFrame before the decor pass.
    const playerRoot = sceneRoot.querySelector<HTMLElement>('.editor-v2-instance-root')
    expect(playerRoot).not.toBeNull()
    Object.defineProperty(playerRoot!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: rootWidth, height: rootWidth * 9 / 16, top: 0, left: 0, right: rootWidth, bottom: rootWidth * 9 / 16 }),
    })

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    const path = sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')!
    const before = {
      frame: { left: frame.style.left, width: frame.style.width },
      source: { left: sourceGhost.style.left, width: sourceGhost.style.width },
      target: { left: targetGhost.style.left, width: targetGhost.style.width },
      path: path.getAttribute('d'),
    }
    expect(Number.parseFloat(before.frame.left)).toBeCloseTo(middleBaseLeft + 80)
    expect(before.frame.width).toBe('160px')
    expect(targetGhost.style.display).toBe('none')

    rootWidth = 400
    sceneRoot.style.width = `${rootWidth}px`
    // First callback is CodPlay's runtime resize; the last one is the decor bridge projection.
    resizeCallbacks.forEach((callback) => callback())
    await waitTurns(24)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(Number.parseFloat(frame.style.left)).toBeCloseTo((middleBaseLeft + 80) / 2)
    expect(frame.style.width).toBe('80px')
    expect(sourceGhost.style.left).toBe('40px')
    expect(sourceGhost.style.width).toBe('80px')
    // The overlay uses the empty inline display value for a visible ghost so the
    // stylesheet remains in charge of its layout; only `none` means hidden.
    expect(sourceGhost.style.display).not.toBe('none')
    expect(targetGhost.style.left).toBe(frame.style.left)
    expect(targetGhost.style.width).toBe('80px')
    expect(targetGhost.style.display).toBe('none')
    expect(path.getAttribute('d')).not.toBe(before.path)
  })

  it('garde la pose du dernier KF quand le segment actif commence au KF milieu', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const documentScene = {
      ...baseScene,
      items: [{
        ...baseScene.items[0]!,
        keyframes: [
          baseScene.items[0]!.keyframes[0]!,
          { id: 'middle-kf', timeMs: 500, decorId: 'middle' },
          { ...baseScene.items[0]!.keyframes[1]!, timeMs: 1_000 },
        ],
      }],
      decors: {
        ...baseScene.decors,
        middle: { id: 'middle', offset: { translate: { x: 30, y: 30 }, width: 20, height: 20, rotate: 45 } },
        last: {
          ...baseScene.decors.last!,
          offset: { translate: { x: 60, y: 60 }, width: 20, height: 20, rotate: 90 },
          path: 'M 0 0 A 0.65 0.65 0 0 1 1 0',
        },
      },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'middle-kf' })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const runtimeMotion = coordination.presentation.get()?.items.find((item) => item.itemId === 'story-main:item')
    const itemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(runtimeMotion).toMatchObject({ progress: 1, representation: 'source' })
    expect(getComputedStyle(itemNode).transform).toContain('translate(60cqw, 60cqw)')
    const built = buildSceneDocV2(documentScene)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const perso = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    expect(perso.actions['item-kf-last-kf']).toHaveProperty('style.rotate', expect.objectContaining({ from: 45, to: 90 }))
    // jsdom leaves CSS transform functions uncomputed; CodPlay's pose capture consumes the
    // browser-computed matrix, so exact selection-frame coordinates are covered in browser checks.
    // The selected middle→last segment is the only editable path. The preceding first→middle
    // trajectory remains visible as a faint artefact and does not add another control point.
    expect(sceneRoot.querySelectorAll('[data-motion-path]')).toHaveLength(2)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(1)
    expect(sceneRoot.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path-inactive]')?.style.opacity).toBe('0.15')
    const initialGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="initial"]')
    expect(initialGhost?.style.display).toBe('')
    expect(initialGhost?.style.left).toBe('80px')
    expect(initialGhost?.style.top).toBe('80px')
    expect(initialGhost?.style.opacity).toBe('0.14')
    initialGhost?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'first-kf' })
  })
})
