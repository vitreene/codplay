import { isDomElement } from '../../components/lib/dom-component-adapter'
import { captureCombinedMatrixForNode, worldDeltaToLocalDelta } from '../list-flip/engine/dom-matrix'
import type { Matrix2D } from '../list-flip/engine/types'
import type {
  RuntimeListComponent,
  RuntimeModule,
  RuntimeModuleBinding,
  RuntimeModuleEventPayload,
  RuntimeModuleHookPayload,
  RuntimeModuleHost
} from '../../components/types'
import type { ListDndDropTarget, ListDndGhostConfig, ListDndModule, ListDndRegistries } from './types'

type LocalPoint = { x: number; y: number }
type LocalBox = { left: number; top: number; width: number; height: number }

let nextSyntheticEventSeq = 0

/** Conventional class always present on the ghost element, even without author config. */
export const DEFAULT_GHOST_CLASS_NAME = 'codplay-dnd-ghost'

/**
 * Builds one `{ eventId, eventSeq }` pair for a `ListComponent` container
 * operation issued directly by this module (not through the normal `move`
 * event pipeline) — both `ListComponent.attachChild`/`detachChild`/
 * `repositionChild` explicitly ignore these fields (`void input.eventId`),
 * so a locally incrementing synthetic value is sufficient and never
 * collides with a real event's tracing.
 */
function nextSyntheticEventRef(): { eventId: string; eventSeq: number } {
  nextSyntheticEventSeq += 1
  return { eventId: `list-dnd-${nextSyntheticEventSeq}`, eventSeq: nextSyntheticEventSeq }
}

/**
 * Transposes one screen-space point into `matrix`'s local space, using
 * `origin` (the list's own screen-space top-left) as the reference the
 * matrix's translation is relative to — mirrors how `list-flip` transposes
 * deltas rather than raw points, adapted here for an absolute drop position.
 */
function toLocalPoint(matrix: Matrix2D, origin: { left: number; top: number }, screenX: number, screenY: number): LocalPoint {
  return worldDeltaToLocalDelta(matrix, screenX - origin.left, screenY - origin.top)
}

/**
 * Transposes one element's screen rect into `matrix`'s local space (top-left
 * + size), relative to the same `origin` as `toLocalPoint`. Rotation-aware:
 * never assumes the element's own `getBoundingClientRect()` is axis-aligned
 * with the list's local axes.
 */
function toLocalBox(matrix: Matrix2D, origin: { left: number; top: number }, rect: DOMRect): LocalBox {
  const topLeft = toLocalPoint(matrix, origin, rect.left, rect.top)
  const bottomRight = toLocalPoint(matrix, origin, rect.right, rect.bottom)
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y)
  }
}

/**
 * Resolves the insertion index within `childBoxes` (already in the list's
 * local space) a local point lands at — before the first child whose
 * vertical midpoint is below the point, or at the end when the point is
 * past every child. The dragged item itself is never part of `childBoxes`
 * (filtered by the caller).
 */
function resolveIndexFromLocalChildBoxes(localY: number, childBoxes: LocalBox[]): number {
  for (let index = 0; index < childBoxes.length; index += 1) {
    const midpointY = childBoxes[index].top + childBoxes[index].height / 2
    if (localY < midpointY) {
      return index
    }
  }
  return childBoxes.length
}

/**
 * Plays a plain-CSS FLIP transition on `node`, from `fromRect` (captured
 * before whatever DOM change already happened) to wherever `node` naturally
 * sits right now. Not the `list-flip` engine (`TransitionRequest`/
 * `runAnimationBatch`) — that pipeline only runs inside `routeUpdates`, for
 * a real materialized action; the preview channel (`events`, per-tick,
 * never materialized) has no access to it. A self-contained First-Last-
 * Invert-Play, entirely on the node itself: freeze the inverse transform,
 * force one reflow, then transition to identity. A no-op for a non-DOM node
 * or when nothing actually moved/resized.
 */
function playFlipTransition(node: unknown, fromRect: { left: number; top: number; width: number; height: number }, durationMs = 220): void {
  if (!isDomElement(node)) {
    return
  }

  const toRect = node.getBoundingClientRect()
  const deltaX = fromRect.left - toRect.left
  const deltaY = fromRect.top - toRect.top
  const scaleX = toRect.width === 0 ? 1 : fromRect.width / toRect.width
  const scaleY = toRect.height === 0 ? 1 : fromRect.height / toRect.height
  if (deltaX === 0 && deltaY === 0 && scaleX === 1 && scaleY === 1) {
    return
  }

  node.style.transition = 'none'
  node.style.transformOrigin = 'top left'
  node.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`

  // Forces layout so the browser registers the inverse transform as the
  // starting frame — without this, both style writes would coalesce into
  // the same frame and nothing would visibly animate.
  void node.getBoundingClientRect()

  node.style.transition = `transform ${durationMs}ms ease`
  node.style.transform = ''

  // Cleans up after itself: a lingering `transition`/`transform-origin`
  // would otherwise silently affect whatever the author's own `style`
  // actions animate on this node next.
  node.addEventListener('transitionend', function onTransitionEnd(event) {
    if (event.propertyName !== 'transform') {
      return
    }
    node.removeEventListener('transitionend', onTransitionEnd)
    node.style.removeProperty('transition')
    node.style.removeProperty('transform-origin')
  })
}

/**
 * Resolves the perso a module hook's resolved action applies to — same
 * pattern as `replaceModule.resolvePersoId` (`runtime/modules/replace/
 * index.ts:16-23`): a capture always belongs to exactly one perso (the one
 * that owns the `emit.pointerdown` declaring it), so `listenerId` alone is
 * enough — no `targetId` concept for list-dnd (unlike `replace`, there is no
 * cross-perso targeting here).
 */
function resolvePersoId(payload: RuntimeModuleHookPayload): string | null {
  const listenerId = payload.resolvedAction?.listenerId
  return typeof listenerId === 'string' ? listenerId : null
}

/**
 * Implements the list-dnd geometric module — registry access exclusively
 * through `ListDndRegistries` (a direct subset of `RuntimeModuleHost.
 * registries`), never through a public-facing facade. See this folder's
 * `README.md`/the plan for why (low-level node access from a scene-facing
 * mechanism belongs to the module system alone).
 */
class ListDndModuleInstance implements ListDndModule {
  private readonly registries: ListDndRegistries
  private readonly ghostByPersoId = new Map<string, HTMLElement>()
  /**
   * Remembers where a dragged item came from (list + index), recorded once
   * at the first `previewAt` detach — the only way `commit` can snap the
   * item back to its origin when the drop point lands outside every
   * candidate list, instead of leaving it detached from any list. Cleared
   * whenever `commit` resolves, by success or by this fallback.
   */
  private readonly originByPersoId = new Map<string, { listId: string; index: number }>()
  /** Cursor-to-node-top-left offset at grab time, per dragged persoId — see `previewAt`'s initial detach. */
  private readonly grabOffsetByPersoId = new Map<string, { x: number; y: number }>()
  /**
   * Last resolved target per dragged persoId — `previewAt` runs once per
   * tick (every `pointermove`), but neighbor repositioning/FLIP must only
   * run when the target actually changed. Re-running it on an unchanged
   * target restarts the CSS transition mid-flight on every tick, reading
   * each node's still-interpolating position as if it were settled —
   * compounding into wrong deltas and visibly flinging items around.
   */
  private readonly lastTargetByPersoId = new Map<string, ListDndDropTarget>()
  /**
   * Last processed pointer position per dragged persoId. The ghost itself
   * occupies real layout space once inserted — its presence shifts the
   * neighbors `resolveDropTarget` measures next, which can resolve a
   * *different* index on the following tick even though the pointer never
   * moved, oscillating back and forth forever. Skipping the hit-test
   * entirely when the pointer position is unchanged since the last
   * processed tick removes the only thing that could re-trigger it.
   */
  private readonly lastClientPositionByPersoId = new Map<string, { clientX: number; clientY: number }>()

  constructor(registries: ListDndRegistries) {
    this.registries = registries
  }

  resolveDropTarget(input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
  }): ListDndDropTarget | null {
    for (const listId of input.candidateListIds) {
      if (!this.registries.mounted.get(listId)) {
        continue
      }

      const listComponent = this.registries.container.get(listId)
      if (listComponent === null) {
        continue
      }

      const listNode = this.registries.node.get(listId)
      if (!isDomElement(listNode)) {
        continue
      }

      // The list's own combined matrix (all ancestor transforms included) —
      // rotation/scale-aware, unlike a raw `getBoundingClientRect()` axis-aligned
      // comparison, which would misorder children under a rotated list.
      const listMatrix = captureCombinedMatrixForNode(listNode)
      const listRect = listNode.getBoundingClientRect()
      const origin = { left: listRect.left, top: listRect.top }
      const listLocalBox = toLocalBox(listMatrix, origin, listRect)

      const localDropPoint = toLocalPoint(listMatrix, origin, input.clientX, input.clientY)
      const isWithinListBounds =
        localDropPoint.x >= listLocalBox.left &&
        localDropPoint.x <= listLocalBox.left + listLocalBox.width &&
        localDropPoint.y >= listLocalBox.top &&
        localDropPoint.y <= listLocalBox.top + listLocalBox.height
      if (!isWithinListBounds) {
        continue
      }

      const childIds = listComponent.getChildrenSnapshot().filter((childId) => childId !== input.draggedPersoId)
      const childLocalBoxes: LocalBox[] = []
      for (const childId of childIds) {
        const childNode = this.registries.node.get(childId)
        if (!isDomElement(childNode)) {
          continue
        }
        childLocalBoxes.push(toLocalBox(listMatrix, origin, childNode.getBoundingClientRect()))
      }

      return {
        listId,
        index: resolveIndexFromLocalChildBoxes(localDropPoint.y, childLocalBoxes)
      }
    }

    return null
  }

  /**
   * Creates the ghost element once, on the first `previewAt` for a given
   * `draggedPersoId` — dimensions always matched to the dragged node's own
   * rect (imposed, independent of `ghost` config), class/style from `ghost`
   * when provided, a conventional default class otherwise. Never a perso,
   * never tracked by `registries` — a raw DOM node this module owns
   * entirely.
   */
  private ensureGhost(draggedPersoId: string, ghost: ListDndGhostConfig | undefined): HTMLElement | null {
    const existing = this.ghostByPersoId.get(draggedPersoId)
    if (existing !== undefined) {
      return existing
    }

    const draggedNode = this.registries.node.get(draggedPersoId)
    if (!isDomElement(draggedNode)) {
      return null
    }

    const rect = draggedNode.getBoundingClientRect()
    const ghostEl = globalThis.document.createElement('div')
    ghostEl.classList.add(ghost?.className ?? DEFAULT_GHOST_CLASS_NAME)
    ghostEl.style.width = `${rect.width}px`
    ghostEl.style.height = `${rect.height}px`
    if (ghost?.style !== undefined) {
      for (const [property, value] of Object.entries(ghost.style)) {
        ghostEl.style.setProperty(property, String(value))
      }
    }

    this.ghostByPersoId.set(draggedPersoId, ghostEl)
    return ghostEl
  }

  /**
   * Inserts (or moves — `insertBefore`/`appendChild` relocate an already
   * mounted node) the ghost as a raw DOM sibling of `target.listId`'s
   * children, at `target.index` among them — never through `attachChild`,
   * never tracked by `registries`/FLIP.
   */
  private positionGhost(ghostEl: HTMLElement, target: ListDndDropTarget): void {
    const listNode = this.registries.node.get(target.listId)
    if (!isDomElement(listNode)) {
      return
    }

    const listComponent = this.registries.container.get(target.listId)
    const childIds = listComponent?.getChildrenSnapshot() ?? []
    const referenceChildId = childIds[target.index]
    const referenceNode = referenceChildId !== undefined ? this.registries.node.get(referenceChildId) : null

    if (isDomElement(referenceNode)) {
      listNode.insertBefore(ghostEl, referenceNode)
    } else {
      listNode.appendChild(ghostEl)
    }
  }

  /** Removes and forgets the ghost for one `draggedPersoId`, if any — safe to call when none exists. */
  private clearGhost(draggedPersoId: string): void {
    const ghostEl = this.ghostByPersoId.get(draggedPersoId)
    if (ghostEl === undefined) {
      return
    }
    ghostEl.remove()
    this.ghostByPersoId.delete(draggedPersoId)
  }

  /**
   * Snapshots the current screen rect of every child a list component still
   * tracks — the "First" half of a FLIP pair, read before whatever DOM
   * change is about to reorder them. `excludeChildId`, when given, leaves
   * out the dragged item itself: it is about to be detached from the DOM
   * entirely (`ListComponent.detachChild` removes the node, not just the
   * bookkeeping), so reading its rect *after* would return an all-zero
   * rect (detached nodes have no box) and produce a bogus FLIP delta on
   * the dragged item's own node.
   */
  private captureChildRects(listComponent: RuntimeListComponent | null | undefined, excludeChildId?: string): Map<string, DOMRect> {
    const rects = new Map<string, DOMRect>()
    if (listComponent === undefined || listComponent === null) {
      return rects
    }
    for (const childId of listComponent.getChildrenSnapshot()) {
      if (childId === excludeChildId) {
        continue
      }
      const node = this.registries.node.get(childId)
      if (isDomElement(node)) {
        rects.set(childId, node.getBoundingClientRect())
      }
    }
    return rects
  }

  /** Plays the "Last-Invert-Play" half of a FLIP pair for every entry captured by `captureChildRects`, reading each node's current (already reflowed) position. */
  private playFlipTransitionsFor(rectsBefore: Map<string, DOMRect>): void {
    for (const [childId, rectBefore] of rectsBefore) {
      playFlipTransition(this.registries.node.get(childId), rectBefore)
    }
  }

  previewAt(input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
    ghost?: ListDndGhostConfig
  }): ListDndDropTarget | null {
    // Idempotent initial detach: the dragged item leaves its source list's
    // logical order as soon as the drag starts (first `previewAt` call), so
    // neighbor repositioning below never has to exclude/compensate for its
    // presence. A no-op on every call after the first, since `getParentId`
    // returns `null` once detached. `ListComponent.detachChild` physically
    // removes the node from the DOM (not just bookkeeping — same contract
    // `moveModule` relies on), so the dragged node must escape the list's
    // normal flow into a `position: fixed` floating state to remain visible
    // and keep following the pointer while neighbors reflow freely around
    // its now-vacated slot.
    const sourceListId = this.registries.container.getParentId(input.draggedPersoId)
    if (sourceListId !== null) {
      const sourceListComponent = this.registries.container.get(sourceListId)
      const originalIndex = sourceListComponent?.getChildrenSnapshot().indexOf(input.draggedPersoId) ?? -1
      this.originByPersoId.set(input.draggedPersoId, {
        listId: sourceListId,
        index: originalIndex >= 0 ? originalIndex : 0
      })

      const draggedNode = this.registries.node.get(input.draggedPersoId)
      const rect = isDomElement(draggedNode) ? draggedNode.getBoundingClientRect() : null
      const siblingRectsBeforeDetach = this.captureChildRects(sourceListComponent, input.draggedPersoId)

      sourceListComponent?.detachChild({
        childId: input.draggedPersoId,
        mode: undefined,
        ...nextSyntheticEventRef()
      })
      this.registries.container.setParentId(input.draggedPersoId, null)
      this.registries.mounted.set(input.draggedPersoId, false)
      this.playFlipTransitionsFor(siblingRectsBeforeDetach)

      if (isDomElement(draggedNode) && rect !== null) {
        draggedNode.style.position = 'fixed'
        draggedNode.style.left = `${rect.left}px`
        draggedNode.style.top = `${rect.top}px`
        // Fixed explicitly: escaping the source list's flex flow would
        // otherwise shrink-to-fit the node to its content (losing whatever
        // width the flex container's cross-axis stretch gave it), a visible
        // size jump the instant the drag starts.
        draggedNode.style.width = `${rect.width}px`
        draggedNode.style.height = `${rect.height}px`
        draggedNode.style.margin = '0'
        draggedNode.style.zIndex = '1000'
        draggedNode.style.pointerEvents = 'none'
        globalThis.document.body.appendChild(draggedNode)
        // Grab offset: keeps the pointer over the same relative point of the
        // node it grabbed, instead of snapping the node's top-left to it.
        this.grabOffsetByPersoId.set(input.draggedPersoId, { x: input.clientX - rect.left, y: input.clientY - rect.top })
      }
    }

    const draggedNode = this.registries.node.get(input.draggedPersoId)
    const grabOffset = this.grabOffsetByPersoId.get(input.draggedPersoId)
    if (isDomElement(draggedNode) && grabOffset !== undefined) {
      draggedNode.style.left = `${input.clientX - grabOffset.x}px`
      draggedNode.style.top = `${input.clientY - grabOffset.y}px`
    }

    const lastClientPosition = this.lastClientPositionByPersoId.get(input.draggedPersoId)
    if (lastClientPosition !== undefined && lastClientPosition.clientX === input.clientX && lastClientPosition.clientY === input.clientY) {
      // Pointer hasn't actually moved since the last processed tick: never
      // re-run the hit-test at all. The ghost occupies real layout space
      // once inserted, so re-measuring neighbors here could resolve a
      // different index purely because of the ghost's own presence,
      // oscillating forever on an otherwise still pointer.
      return this.lastTargetByPersoId.get(input.draggedPersoId) ?? null
    }
    this.lastClientPositionByPersoId.set(input.draggedPersoId, { clientX: input.clientX, clientY: input.clientY })

    const target = this.resolveDropTarget(input)
    if (target === null) {
      return null
    }

    const lastTarget = this.lastTargetByPersoId.get(input.draggedPersoId)
    if (lastTarget !== undefined && lastTarget.listId === target.listId && lastTarget.index === target.index) {
      // Same target resolved again (a real, distinct pointer position that
      // still lands on the same slot): nothing to reposition, nothing to
      // re-animate. `repositionChild`/`playFlipTransition` would otherwise
      // restart on every `pointermove`, tearing a still-running transition
      // mid-flight and reading its interpolating (not settled) position as
      // if it were final.
      return target
    }
    this.lastTargetByPersoId.set(input.draggedPersoId, target)

    const listComponent = this.registries.container.get(target.listId)
    if (listComponent === null) {
      return target
    }

    // Reposition every neighbor whose current position is at or past the
    // resolved insertion index by one slot, opening the place the dragged
    // item would land at — the dragged item itself is never part of
    // `getChildrenSnapshot()` here (detached above), so no exclusion/
    // compensation is needed in this loop.
    const childIds = listComponent.getChildrenSnapshot()
    const siblingRectsBeforeReposition = this.captureChildRects(listComponent, input.draggedPersoId)
    for (let currentIndex = 0; currentIndex < childIds.length; currentIndex += 1) {
      const desiredIndex = currentIndex >= target.index ? currentIndex + 1 : currentIndex
      if (desiredIndex === currentIndex) {
        continue
      }

      listComponent.repositionChild({
        childId: childIds[currentIndex],
        mode: desiredIndex,
        ...nextSyntheticEventRef()
      })
    }
    this.playFlipTransitionsFor(siblingRectsBeforeReposition)

    const ghostEl = this.ensureGhost(input.draggedPersoId, input.ghost)
    if (ghostEl !== null) {
      this.positionGhost(ghostEl, target)
    }

    return target
  }

  commit(input: {
    clientX: number
    clientY: number
    draggedPersoId: string
    candidateListIds: readonly string[]
  }): ListDndDropTarget | null {
    this.clearGhost(input.draggedPersoId)

    const target = this.resolveDropTarget(input)
    if (target === null) {
      this.snapBackToOrigin(input.draggedPersoId)
      return null
    }

    const targetListComponent = this.registries.container.get(target.listId)
    if (targetListComponent === null) {
      this.originByPersoId.delete(input.draggedPersoId)
      this.grabOffsetByPersoId.delete(input.draggedPersoId)
      this.lastTargetByPersoId.delete(input.draggedPersoId)
      this.lastClientPositionByPersoId.delete(input.draggedPersoId)
      return target
    }

    const sourceListId = this.registries.container.getParentId(input.draggedPersoId)
    const draggedNode = this.registries.node.get(input.draggedPersoId)

    if (sourceListId !== null) {
      const sourceListComponent = this.registries.container.get(sourceListId)
      sourceListComponent?.detachChild({ childId: input.draggedPersoId, mode: undefined, ...nextSyntheticEventRef() })
    }

    if (draggedNode !== null && draggedNode !== undefined) {
      const rectBeforeSettle = isDomElement(draggedNode) ? draggedNode.getBoundingClientRect() : null
      this.clearFloatingStyle(draggedNode)
      targetListComponent.attachChild({
        childId: input.draggedPersoId,
        childNode: draggedNode,
        mode: target.index,
        ...nextSyntheticEventRef()
      })
      this.registries.container.setParentId(input.draggedPersoId, target.listId)
      this.registries.mounted.set(input.draggedPersoId, true)
      if (rectBeforeSettle !== null) {
        playFlipTransition(draggedNode, rectBeforeSettle)
      }
    }

    this.originByPersoId.delete(input.draggedPersoId)
    this.grabOffsetByPersoId.delete(input.draggedPersoId)
    this.lastTargetByPersoId.delete(input.draggedPersoId)
    return target
  }

  /**
   * Reattaches a dragged item to the list/index it was detached from at the
   * first `previewAt` — the drop point landed outside every candidate list,
   * so there is no new position to commit to. Without this, the item would
   * stay detached from every list (structurally, not just visually) once
   * its `CaptureUpdate` style handles are released at `endOn`. A no-op when
   * no origin was ever recorded (drag ended without a single `previewAt`
   * call — e.g. a pointerdown/pointerup with no movement in between).
   */
  private snapBackToOrigin(draggedPersoId: string): void {
    const origin = this.originByPersoId.get(draggedPersoId)
    this.originByPersoId.delete(draggedPersoId)
    this.grabOffsetByPersoId.delete(draggedPersoId)
    this.lastTargetByPersoId.delete(draggedPersoId)
    if (origin === undefined) {
      return
    }

    const listComponent = this.registries.container.get(origin.listId)
    const draggedNode = this.registries.node.get(draggedPersoId)
    if (listComponent === null || draggedNode === null || draggedNode === undefined) {
      return
    }

    const rectBeforeSettle = isDomElement(draggedNode) ? draggedNode.getBoundingClientRect() : null
    this.clearFloatingStyle(draggedNode)
    listComponent.attachChild({
      childId: draggedPersoId,
      childNode: draggedNode,
      mode: origin.index,
      ...nextSyntheticEventRef()
    })
    this.registries.container.setParentId(draggedPersoId, origin.listId)
    this.registries.mounted.set(draggedPersoId, true)
    if (rectBeforeSettle !== null) {
      playFlipTransition(draggedNode, rectBeforeSettle)
    }
  }

  /** Clears the inline floating-state properties `previewAt` applies to escape normal flow — a no-op for a non-DOM/non-floated node. */
  private clearFloatingStyle(node: unknown): void {
    if (!isDomElement(node)) {
      return
    }
    node.style.removeProperty('position')
    node.style.removeProperty('left')
    node.style.removeProperty('top')
    node.style.removeProperty('width')
    node.style.removeProperty('height')
    node.style.removeProperty('margin')
    node.style.removeProperty('z-index')
    node.style.removeProperty('pointer-events')
  }
}

export function createListDndModule(registries: ListDndRegistries): ListDndModule {
  return new ListDndModuleInstance(registries)
}

/**
 * Real `RuntimeModule` entry point, registered via `registerModule` next to
 * `moveModule`/`listModule`/`replaceModule`. Two independent channels (see
 * `docs/plans/2026-07-22-dnd-list-positioned-drop-plan.md`, "Faits vérifiés"):
 * `events['list-dnd:preview']` (preview, transitory, dispatched directly by
 * `applyCaptureTickActions`, never materialized) and `runtime.hooks.afterUpdate`
 * (commit, a real perso action resolved through the normal, seek-safe
 * pipeline — `match.actionKeys: ['listDnd']`).
 */
export const listDndModule: RuntimeModule = {
  install(host: RuntimeModuleHost): RuntimeModuleBinding {
    const module = createListDndModule(host.registries)

    function afterUpdate(payload: RuntimeModuleHookPayload): void {
      const action = payload.resolvedAction?.action as Record<string, unknown> | undefined
      if (action === undefined || action.listDnd === undefined) {
        return
      }

      const persoId = resolvePersoId(payload)
      if (persoId === null) {
        return
      }

      const clientX = action.clientX
      const clientY = action.clientY
      const candidateListIds = action.dropIn
      if (typeof clientX !== 'number' || typeof clientY !== 'number' || !Array.isArray(candidateListIds)) {
        return
      }

      const target = module.commit({ clientX, clientY, draggedPersoId: persoId, candidateListIds })
      if (target === null) {
        return
      }

      host.emit({
        name: 'list-dnd:dropped',
        payload: { persoId, listId: target.listId, index: target.index },
        insertMode: 'persist-only',
        ms: host.timeline.currentMs,
        // Without this, `Player.routeSceneEvent` sees `scopeStoryId ===
        // undefined` and never checks the story's own `listen` rules — a
        // story-scoped strap on this event would silently never run.
        scopeStoryId: host.helpers.getStoryId(persoId) ?? undefined
      })
    }

    function onPreview(payload: RuntimeModuleEventPayload): void {
      const data = payload.payload as {
        clientX?: unknown
        clientY?: unknown
        candidateListIds?: unknown
        draggedPersoId?: unknown
        ghost?: ListDndGhostConfig
      }
      if (
        typeof data.clientX !== 'number' ||
        typeof data.clientY !== 'number' ||
        typeof data.draggedPersoId !== 'string' ||
        !Array.isArray(data.candidateListIds)
      ) {
        return
      }

      module.previewAt({
        clientX: data.clientX,
        clientY: data.clientY,
        draggedPersoId: data.draggedPersoId,
        candidateListIds: data.candidateListIds,
        ghost: data.ghost
      })
    }

    return {
      runtime: { hooks: { afterUpdate }, match: { actionKeys: ['listDnd'] } },
      events: { 'list-dnd:preview': onPreview }
    }
  }
}
