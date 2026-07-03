import { createActor } from 'xstate'
import { worldDeltaToLocalDelta } from 'codplay/runtime/modules/list-flip/engine/dom-matrix'
import type { Matrix2D } from 'codplay/runtime/modules/list-flip/engine/types'
import { csMachine } from './machine'
import { calibrateGhostToWorldSnapshot, captureOverlayPose, ensureOverlayLayer, measureWorldRect } from './overlay-pose'
import type {
  CapabilityPreset,
  CreationGeometry,
  CsValueAdapter,
  MultiSelectionFrameOptions,
  SelectionFrameHandle,
  SelectionFramePart
} from './types'

const COMMON_ANGLE_TOLERANCE_RAD = (1 * Math.PI) / 180

const IDENTITY: Matrix2D = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

type TrackedItem = {
  itemId: string
  adapter: CsValueAdapter
  node: HTMLElement | null
}

/**
 * One shared cs over the union bounding rect of several items. Emits the same
 * raw diff to every item adapter; grid positioning and flex mode are disabled
 * by construction (single-item contexts). applyPreset/setAdapter/
 * setContainerGrid are present on the handle but inert.
 */
export function createMultiSelectionFrame(options: MultiSelectionFrameOptions): SelectionFrameHandle {
  const doc = options.sceneRoot.ownerDocument
  const overlayLayer = ensureOverlayLayer(options.sceneRoot)

  const items: TrackedItem[] = options.items.map((item) => ({
    itemId: item.itemId,
    adapter: item.adapter,
    node: null
  }))
  let destroyed = false
  let unionRect: { left: number; top: number; width: number; height: number } | null = null
  let commonMatrix: Matrix2D = IDENTITY

  const actor = createActor(csMachine)
  actor.start()
  actor.send({ type: 'OPERATION_ENABLED_CHANGED', op: 'positioning', enabled: false })
  actor.send({ type: 'OPERATION_ENABLED_CHANGED', op: 'flex', enabled: false })

  const csRoot = doc.createElement('div')
  csRoot.setAttribute('data-selection-frame-multi', '')
  csRoot.style.position = 'fixed'
  csRoot.style.boxSizing = 'border-box'
  csRoot.style.border = '1px solid #4a90d9'
  csRoot.style.transformOrigin = '0px 0px'
  csRoot.style.display = 'none'
  csRoot.style.pointerEvents = 'auto'
  csRoot.style.touchAction = 'none'
  csRoot.style.cursor = 'move'
  overlayLayer.appendChild(csRoot)

  const presentItems = (): TrackedItem[] => items.filter((item) => item.node !== null)

  const detectCommonMatrix = (nodes: HTMLElement[]): Matrix2D => {
    const poses = nodes.map((node) => captureOverlayPose(node))
    const angles = poses.map((pose) => Math.atan2(pose.matrix.b, pose.matrix.a))
    const reference = angles[0]
    const allEqual = angles.every((angle) => Math.abs(angle - reference) <= COMMON_ANGLE_TOLERANCE_RAD)
    return allEqual ? poses[0].rotationMatrix : IDENTITY
  }

  const recompute = (): void => {
    const present = presentItems()
    if (present.length === 0) {
      unionRect = null
      csRoot.style.display = 'none'
      return
    }

    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const item of present) {
      const rect = measureWorldRect(item.node!)
      left = Math.min(left, rect.left)
      top = Math.min(top, rect.top)
      right = Math.max(right, rect.left + rect.width)
      bottom = Math.max(bottom, rect.top + rect.height)
    }
    unionRect = { left, top, width: right - left, height: bottom - top }
    commonMatrix = detectCommonMatrix(present.map((item) => item.node!))

    if (
      options.minSizePx !== undefined &&
      (unionRect.width < options.minSizePx || unionRect.height < options.minSizePx)
    ) {
      csRoot.style.display = 'none'
      return
    }

    const context = actor.getSnapshot().context
    csRoot.style.display = context.csVisible ? '' : 'none'
    csRoot.style.width = `${unionRect.width}px`
    csRoot.style.height = `${unionRect.height}px`
    csRoot.style.transform = `matrix(${commonMatrix.a}, ${commonMatrix.b}, ${commonMatrix.c}, ${commonMatrix.d}, 0, 0)`
    csRoot.style.translate = '0px 0px'
    calibrateGhostToWorldSnapshot(csRoot, unionRect)
  }

  // ── gestures: same raw diff broadcast to every adapter ───────────────────

  type DragSession = {
    pointerId: number
    startX: number
    startY: number
    startUnionLeft: number
    startUnionTop: number
    emittedX: number
    emittedY: number
  }
  let dragSession: DragSession | null = null

  const measureUnionCorner = (): { left: number; top: number } | null => {
    const present = presentItems()
    if (present.length === 0) return null
    let left = Infinity
    let top = Infinity
    for (const item of present) {
      const rect = measureWorldRect(item.node!)
      left = Math.min(left, rect.left)
      top = Math.min(top, rect.top)
    }
    return { left, top }
  }

  const endDragSession = (): void => {
    if (dragSession === null) return
    const session = dragSession
    dragSession = null
    try {
      if (csRoot.hasPointerCapture(session.pointerId)) {
        csRoot.releasePointerCapture(session.pointerId)
      }
    } catch {
      // Capture already gone: nothing to do.
    }
    actor.send({ type: 'DRAG_END' })
    csRoot.style.translate = '0px 0px'
    recompute()
  }

  csRoot.addEventListener('pointerdown', (event: PointerEvent) => {
    if (unionRect === null || event.button !== 0) return
    actor.send({ type: 'DRAG_START' })
    if (!actor.getSnapshot().matches({ active: 'dragging' })) return
    dragSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startUnionLeft: unionRect.left,
      startUnionTop: unionRect.top,
      emittedX: 0,
      emittedY: 0
    }
    csRoot.setPointerCapture(event.pointerId)
    event.preventDefault()
  })

  csRoot.addEventListener('pointermove', (event: PointerEvent) => {
    if (dragSession === null || event.pointerId !== dragSession.pointerId) return
    if (event.buttons === 0) {
      endDragSession()
      return
    }
    const viewportDx = event.clientX - dragSession.startX
    const viewportDy = event.clientY - dragSession.startY
    csRoot.style.translate = `${viewportDx}px ${viewportDy}px`

    const local = worldDeltaToLocalDelta(commonMatrix, viewportDx, viewportDy)
    const targetX = Math.round(local.x)
    const targetY = Math.round(local.y)
    const dx = targetX - dragSession.emittedX
    const dy = targetY - dragSession.emittedY
    if (dx === 0 && dy === 0) return
    dragSession.emittedX = targetX
    dragSession.emittedY = targetY
    for (const item of presentItems()) {
      item.adapter.applyMove({ dx, dy })
    }

    // Measured correction before repaint: glue the cs to where the items
    // actually landed, absorbing any layout interference.
    const corner = measureUnionCorner()
    if (corner !== null) {
      csRoot.style.translate = `${corner.left - dragSession.startUnionLeft}px ${corner.top - dragSession.startUnionTop}px`
    }
  })

  csRoot.addEventListener('pointerup', (event: PointerEvent) => {
    if (dragSession === null || event.pointerId !== dragSession.pointerId) return
    endDragSession()
  })
  csRoot.addEventListener('pointercancel', endDragSession)
  csRoot.addEventListener('lostpointercapture', () => {
    if (dragSession !== null) endDragSession()
  })

  // ── node lifecycle ───────────────────────────────────────────────────────

  const unsubscribers = items.map((item) =>
    options.authorApi.subscribeToNode(item.itemId, (node) => {
      if (destroyed) return
      item.node = node instanceof HTMLElement ? node : null
      const anyPresent = presentItems().length > 0
      actor.send({ type: anyPresent ? 'NODE_APPEARED' : 'NODE_DISAPPEARED' })
      recompute()
    })
  )

  return {
    destroy(): void {
      if (destroyed) return
      destroyed = true
      for (const unsubscribe of unsubscribers) unsubscribe()
      actor.stop()
      csRoot.remove()
    },

    setPartVisibility(part: SelectionFramePart, visible: boolean): void {
      actor.send({ type: 'VISIBILITY_CHANGED', part, visible })
      if (part === 'element') {
        for (const item of presentItems()) {
          item.node!.style.visibility = visible ? '' : 'hidden'
        }
      }
      recompute()
    },

    setPartActive(_part: 'cs', active: boolean): void {
      actor.send({ type: 'CS_ACTIVE_CHANGED', active })
      csRoot.style.pointerEvents = active ? 'auto' : 'none'
    },

    sync(): void {
      if (!destroyed) recompute()
    },

    setOperationEnabled(op: string, enabled: boolean): void {
      actor.send({ type: 'OPERATION_ENABLED_CHANGED', op, enabled })
    },

    applyPreset(_preset: CapabilityPreset): void {
      // Inert in multi-selection: one preset per item does not apply here.
    },

    setAdapter(_adapter: CsValueAdapter): void {
      // Inert in multi-selection: adapters are provided per item.
    },

    setContainerGrid(): void {
      // Inert in multi-selection: grid positioning is a single-item context.
    },

    applyCreationGeometry(_geometry: CreationGeometry): void {
      // Inert in multi-selection: create mode targets a single new item.
    },

    attachItem(): void {
      // Inert in multi-selection: create mode targets a single new item.
    }
  }
}
