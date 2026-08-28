import { isDomElement } from '../../components/lib/dom-component-adapter'
import { captureCombinedMatrixForNode, readElementTransformValue, worldDeltaToLocalDelta } from '../list-flip/engine/dom-matrix'
import { parseCssMatrix } from '../list-flip/engine/matrix-2d'
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

/**
 * Reads `node`'s true layout rect, mathematically subtracting out whatever
 * FLIP transform this module currently has running on it — a sibling still
 * mid-transition (the common case: `pointermove` ticks fire faster than the
 * 220ms transition duration) has a `transform` actively interpolating.
 * Checking `node.style.transform` to detect this (an earlier version of
 * this function did) does not work: `playFlipTransition` sets `transform`
 * to its *final* value (`''`) as the very last step of its own synchronous
 * block, before the transition has actually finished playing — so the
 * inline style already reads empty while the rendered/computed transform is
 * still interpolating away from its inverse. Reading `getComputedStyle`
 * instead gets the real, currently-rendered matrix regardless of what the
 * inline style says, and subtracting it out (this module only ever
 * produces translate+scale from `transform-origin: top left`, never
 * rotation, so the correction is a simple offset/divide, no rotation-aware
 * math needed) gives the node's true layout rect without ever touching its
 * `transition`/`transform` — the running animation is never interrupted.
 */
function measureSettledRect(node: HTMLElement): DOMRect {
  const rect = node.getBoundingClientRect()
  const matrix = parseCssMatrix(readElementTransformValue(node))
  if (matrix.a === 1 && matrix.b === 0 && matrix.c === 0 && matrix.d === 1 && matrix.e === 0 && matrix.f === 0) {
    return rect
  }
  return new DOMRect(
    rect.left - matrix.e,
    rect.top - matrix.f,
    matrix.a !== 0 ? rect.width / matrix.a : rect.width,
    matrix.d !== 0 ? rect.height / matrix.d : rect.height
  )
}

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
 * Fraction of a child's own height added as a dead zone around its midpoint
 * when a `currentIndex` anchor is known — without it, a pointer sitting
 * almost exactly on a midpoint (typically right where an item was just
 * grabbed, once its neighbors close the vacated slot) flips the resolved
 * index back and forth on the smallest real-world jitter, each flip now
 * playing a visible FLIP transition on the ghost's neighbors.
 */
const HYSTERESIS_RATIO = 0.3

/**
 * Resolves the insertion index within `childBoxes` (already in the list's
 * local space) a local point lands at — before the first child whose
 * (possibly biased) vertical midpoint is below the point, or at the end
 * when the point is past every child. The dragged item itself is never
 * part of `childBoxes` (filtered by the caller).
 *
 * `currentIndex`, when given (the index last resolved for this same list),
 * biases every midpoint away from flipping the result: a child before
 * `currentIndex` requires the point to go further past it to resolve a
 * smaller index, and a child at or after `currentIndex` requires the point
 * to go further past it to resolve a larger one — a dead zone around
 * whichever boundary the pointer is currently sitting on, not a global
 * shift of every boundary.
 */
function resolveIndexFromLocalChildBoxes(localY: number, childBoxes: LocalBox[], currentIndex?: number): number {
  for (let index = 0; index < childBoxes.length; index += 1) {
    const midpointY = childBoxes[index].top + childBoxes[index].height / 2
    const margin = childBoxes[index].height * HYSTERESIS_RATIO
    const biasedMidpointY = currentIndex === undefined
      ? midpointY
      : index < currentIndex
        ? midpointY - margin
        : midpointY + margin
    if (localY < biasedMidpointY) {
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

  const toRect = measureSettledRect(node)
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
 * Resolves the perso a module hook's resolved action applies to via
 * `listenerId` alone — the fallback half of the same `targetId ?? listenerId`
 * convention `moveModule.beforeUpdate` uses for every `move` action
 * (`runtime/modules/move/index.ts`): this module's own `beforeUpdate` now
 * fires for *every* `move`, not only ones a `list-dnd` drag produced, so it
 * must resolve the moved perso the identical way to correctly recognize its
 * own drops (self-targeting, `listenerId`) alongside anything else.
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
   * at the first `previewAt` detach — `getCommitTarget`'s fallback, so a
   * drop point landing outside every candidate list still resolves a valid
   * `move` (back to origin) instead of leaving the item detached from any
   * list. Cleared by `finalizeDrop`, once the drop's `move` action has run.
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
        childLocalBoxes.push(toLocalBox(listMatrix, origin, measureSettledRect(childNode)))
      }

      const lastTarget = this.lastTargetByPersoId.get(input.draggedPersoId)
      const currentIndex = lastTarget?.listId === listId ? lastTarget.index : undefined

      return {
        listId,
        index: resolveIndexFromLocalChildBoxes(localDropPoint.y, childLocalBoxes, currentIndex)
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
        rects.set(childId, measureSettledRect(node))
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
    // Captured on the source list only when this tick performs the detach
    // below — reused, not immediately played, so the source list's siblings
    // get exactly one FLIP pair for this tick instead of two. Playing the
    // "close the vacated slot" transition here and, a few lines below in the
    // very same synchronous tick, a second "open a slot for the ghost"
    // transition (the common case: the pointer hasn't left the source list
    // yet at grab time) reads an intermediate, never-painted state as if it
    // were real — a spurious close-then-reopen pulse on the very siblings
    // that shouldn't visibly move at all when the ghost lands back roughly
    // where the item was.
    let rectsBeforeDetach: Map<string, DOMRect> | null = null
    let detachedFromListId: string | null = null

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
      rectsBeforeDetach = this.captureChildRects(sourceListComponent, input.draggedPersoId)
      detachedFromListId = sourceListId

      sourceListComponent?.detachChild({
        childId: input.draggedPersoId,
        mode: undefined,
        ...nextSyntheticEventRef()
      })
      this.registries.container.setParentId(input.draggedPersoId, null)
      this.registries.mounted.set(input.draggedPersoId, false)

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

    const lastTarget = this.lastTargetByPersoId.get(input.draggedPersoId)
    if (target !== null && lastTarget !== undefined && lastTarget.listId === target.listId && lastTarget.index === target.index) {
      // Same target resolved again (a real, distinct pointer position that
      // still lands on the same slot): nothing to reposition, nothing to
      // re-animate. Re-running the FLIP capture below would otherwise
      // restart on every `pointermove`, tearing a still-running transition
      // mid-flight and reading its interpolating (not settled) position as
      // if it were final.
      return target
    }

    // The real children of a list are never reordered during preview — only
    // the ghost (a raw DOM sibling, untracked by `ListComponent`) occupies
    // the gap. The final `move` action's own `attachChild({ mode: target.index
    // })` (applied by `moveModule`, `parentId`/`mode` read from
    // `getCommitTarget`) places the dragged item correctly against this
    // same, never-reordered order, since `target.index` was itself resolved
    // by hit-testing against it. The
    // "écart"/"resserrement" a neighbor plays is therefore driven entirely by
    // the ghost's own insertion/removal reflowing the flex layout around
    // it — captured here as one FLIP pair per affected list, read before and
    // after the single DOM mutation that moves/removes the ghost.
    const previousListComponent = lastTarget !== undefined ? this.registries.container.get(lastTarget.listId) : null
    const isLeavingPreviousList = lastTarget !== undefined && (target === null || target.listId !== lastTarget.listId)
    const rectsBeforeGhostLeaves = isLeavingPreviousList ? this.captureChildRects(previousListComponent, input.draggedPersoId) : null

    const targetListComponent = target !== null ? this.registries.container.get(target.listId) : null
    // On the tick that just detached the dragged item, if the ghost lands
    // back in that very list, `rectsBeforeDetach` (captured before the
    // detach even ran) is reused as the "before" half instead of capturing
    // again here — nothing has painted since, so re-capturing would only
    // read the already-closed state and pair it with the ghost's arrival,
    // producing the spurious pulse described above.
    const rectsBeforeGhostArrives = targetListComponent === null
      ? null
      : detachedFromListId === target?.listId && rectsBeforeDetach !== null
        ? rectsBeforeDetach
        : this.captureChildRects(targetListComponent, input.draggedPersoId)

    // The detach's own close transition only still needs to play on its own
    // when the ghost does *not* land back in the same list this tick (it
    // moved to a different list, or off every list entirely) — otherwise
    // it was folded into `rectsBeforeGhostArrives` above.
    if (rectsBeforeDetach !== null && detachedFromListId !== target?.listId) {
      this.playFlipTransitionsFor(rectsBeforeDetach)
    }

    if (target === null || targetListComponent === null) {
      this.clearGhost(input.draggedPersoId)
    } else {
      const ghostEl = this.ensureGhost(input.draggedPersoId, input.ghost)
      if (ghostEl !== null) {
        this.positionGhost(ghostEl, target)
      }
    }

    if (rectsBeforeGhostLeaves !== null) {
      this.playFlipTransitionsFor(rectsBeforeGhostLeaves)
    }
    if (rectsBeforeGhostArrives !== null) {
      this.playFlipTransitionsFor(rectsBeforeGhostArrives)
    }

    if (target === null) {
      this.lastTargetByPersoId.delete(input.draggedPersoId)
    } else {
      this.lastTargetByPersoId.set(input.draggedPersoId, target)
    }

    return target
  }

  getCommitTarget(draggedPersoId: string): { parentId: string; mode: number } | null {
    const lastTarget = this.lastTargetByPersoId.get(draggedPersoId)
    if (lastTarget !== undefined) {
      return { parentId: lastTarget.listId, mode: lastTarget.index }
    }
    const origin = this.originByPersoId.get(draggedPersoId)
    if (origin !== undefined) {
      return { parentId: origin.listId, mode: origin.index }
    }
    return null
  }

  finalizeDrop(draggedPersoId: string): boolean {
    const wasTracked =
      this.originByPersoId.has(draggedPersoId) ||
      this.lastTargetByPersoId.has(draggedPersoId) ||
      this.grabOffsetByPersoId.has(draggedPersoId)

    // Clears the floating escape `previewAt` applied at drag start *before*
    // `list-flip`'s own `afterUpdate` (registered before this module's, see
    // `runtime-component-orchestrator.ts:131-134`) captures the node's
    // "last"/settled rect for its own FLIP — reading it while still
    // `position: fixed` would measure the stale floating position instead
    // of where the node truly now sits in its new list's flow. Ghost/state
    // cleanup order doesn't carry the same constraint, done here too for
    // one single per-drag teardown.
    this.clearGhost(draggedPersoId)
    this.clearFloatingStyle(this.registries.node.get(draggedPersoId))
    this.originByPersoId.delete(draggedPersoId)
    this.grabOffsetByPersoId.delete(draggedPersoId)
    this.lastTargetByPersoId.delete(draggedPersoId)
    this.lastClientPositionByPersoId.delete(draggedPersoId)
    return wasTracked
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
 * The live `list-dnd` module instance, set once per player lifetime (modules
 * are installed once, never per-seek — see `project-installmodules-seek-
 * optimization`), read by `resolveListDndCommitTarget` below. A direct
 * module-scope reference rather than new generic orchestrator plumbing:
 * `create-player.ts` already imports specific runtime modules directly
 * (`../runtime/modules/move`, `../runtime/modules/media-sync`) for this same
 * kind of narrow, deliberate integration — not a pattern unique to this one.
 */
let activeListDndModule: ListDndModule | null = null

/**
 * Resolves what the drag currently tracked for `draggedPersoId` should
 * commit to, right now — the channel `capture-runtime.ts`'s `onEnd` calls to
 * populate `captureState.move` before its `endEmit` materializes, so the
 * resulting action is a plain `move` (`parentId`/`mode`), handled entirely
 * by `moveModule`/`list-flip` — this module never attaches/detaches/animates
 * the drop itself anymore. `null` when no `list-dnd` module is installed, or
 * no drag is currently tracked for `draggedPersoId`.
 */
export function resolveListDndCommitTarget(draggedPersoId: string): { parentId: string; mode: number } | null {
  return activeListDndModule?.getCommitTarget(draggedPersoId) ?? null
}

/**
 * Real `RuntimeModule` entry point, registered via `registerModule` next to
 * `moveModule`/`listModule`/`replaceModule` (registered *after* `moveModule`
 * — `runtime-component-orchestrator.ts:131-134` — so this module's
 * `beforeUpdate` always runs after `moveModule`'s own, see `finalizeDrop`).
 * Two independent channels: `events['list-dnd:preview']` (preview,
 * transitory, dispatched directly by `applyCaptureTickActions`, never
 * materialized) and `runtime.hooks.beforeUpdate` (drop teardown for a real,
 * plain `move` action — resolved and applied entirely by `moveModule`/
 * `list-flip`, this module only cleans up its own live-drag traces
 * afterward — `match.actionKeys: ['move']`).
 */
export const listDndModule: RuntimeModule = {
  install(host: RuntimeModuleHost): RuntimeModuleBinding {
    const module = createListDndModule(host.registries)
    activeListDndModule = module

    function beforeUpdate(payload: RuntimeModuleHookPayload): void {
      const action = payload.resolvedAction?.action as Record<string, unknown> | undefined
      if (action === undefined) {
        return
      }

      const persoId = (action.targetId as string | undefined) ?? resolvePersoId(payload)
      if (persoId === null) {
        return
      }

      // A no-op (`false` return) for any `move` unrelated to a `list-dnd`
      // drag — this hook fires for every `move` action in the scene, not
      // only the ones this module produced.
      module.finalizeDrop(persoId)
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
      runtime: { hooks: { beforeUpdate }, match: { actionKeys: ['move'] } },
      events: { 'list-dnd:preview': onPreview }
    }
  }
}
