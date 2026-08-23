import { isPlainRecord } from '../../shared'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../capture'
import type { CompiledRecord, CompiledValue } from '../../scene/compiled'
import { captureHtmlPose, worldDeltaToLocalDelta } from '../motion/html-pose'
import type { HtmlMatrix } from '../motion/html-types'
import {
  captureHtmlTransientRects,
  measureHtmlSettledRect,
  playHtmlTransientFlip,
  type HtmlTransientRect,
} from './html-transient-flip'
import {
  clearHtmlTransientNode,
  markHtmlTransientNode,
} from './html-transient-node'

/** Resolves one mounted HTML perso root owned by the runner. */
export type HtmlListDndNodeResolver = (persoKey: string) => unknown

/** Resolves the canonical child order exposed by one mounted list target. */
export type HtmlListDndListItemResolver = (
  storyId: string,
  listId: string,
) => readonly unknown[] | undefined

/** Dependencies needed by the HTML list preview, without exposing runner internals. */
export type HtmlListDndPreviewOptions = Readonly<{
  resolveNode: HtmlListDndNodeResolver
  resolveListNode: (storyId: string, listId: string) => unknown
  resolveListItemNodes?: HtmlListDndListItemResolver
  resolveAuthorId?: (persoKey: string) => string
  ghostClassName?: string
}>

type DropTarget = Readonly<{
  listId: string
  index: number
}>

type ResolvedDropTarget = DropTarget & Readonly<{
  children: readonly HTMLElement[]
}>

type LocalBox = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

type ActivePreview = {
  captureId?: string
  origin?: DropTarget
  target?: ResolvedDropTarget
  targetResolved?: boolean
  ghost?: HTMLElement
  sourceList?: HTMLElement
  sourceIndex?: number
  sourceRectsBeforeFloat?: ReadonlyMap<HTMLElement, HtmlTransientRect>
  flipCleanups?: Map<HTMLElement, () => void>
  lastClientX?: number
  lastClientY?: number
  offsetX?: number
  offsetY?: number
  width?: number
  height?: number
}

/**
 * Owns the HTML-only preview half of list DnD. It never changes logical
 * placement and never appends an event to the runtime journal.
 */
export class HtmlListDndPreview {
  private readonly resolveNode: HtmlListDndNodeResolver
  private readonly resolveListNode: HtmlListDndPreviewOptions['resolveListNode']
  private readonly resolveListItemNodes: HtmlListDndPreviewOptions['resolveListItemNodes']
  private readonly resolveAuthorId: (persoKey: string) => string
  private readonly ghostClassName: string
  private readonly active = new Map<string, ActivePreview>()

  /** Creates one preview controller bound to one HTML materializer registry. */
  constructor(options: HtmlListDndPreviewOptions) {
    this.resolveNode = options.resolveNode
    this.resolveListNode = options.resolveListNode
    this.resolveListItemNodes = options.resolveListItemNodes
    this.resolveAuthorId = options.resolveAuthorId ?? defaultAuthorId
    this.ghostClassName = options.ghostClassName ?? 'codplay-dnd-ghost'
  }

  /** Processes one observed capture sample and updates only the transient preview. */
  track(input: Readonly<{
    captureId?: string
    persoKey: string
    sample: RuntimeCaptureSample
    captureState: RuntimeCaptureState
  }>): void {
    const clientX = readFiniteNumber(input.sample.clientX)
    const clientY = readFiniteNumber(input.sample.clientY)
    if (clientX === undefined || clientY === undefined) return

    const previous = this.active.get(input.persoKey)
    const preview = this.resolvePreview(input.captureId, previous)
    if (preview !== previous && previous !== undefined) this.clearPreviewResources(input.persoKey, previous)
    if (input.captureId !== undefined) preview.captureId = input.captureId
    const node = asElement(this.resolveNode(input.persoKey))
    if (node === undefined) return
    if (preview.offsetX === undefined || preview.offsetY === undefined) {
      const rect = node.getBoundingClientRect()
      preview.sourceList = node.parentElement instanceof HTMLElement ? node.parentElement : undefined
      preview.sourceRectsBeforeFloat = preview.sourceList === undefined
        ? new Map()
        : this.captureNeighborRects(
          input.persoKey.slice(0, input.persoKey.indexOf(':')),
          readItemId(preview.sourceList),
          preview.sourceList,
          input.persoKey,
        )
      preview.offsetX = clientX - rect.left
      preview.offsetY = clientY - rect.top
      preview.width = rect.width
      preview.height = rect.height
      preview.origin = this.resolveOrigin(input.persoKey)
      preview.sourceIndex = preview.origin?.index
      // V1 removes the dragged root from the source list before resolving the
      // first target. The V2 logical placement is untouched; this is only the
      // transient HTML escape that makes the source geometry identical to V1.
      node.remove()
      markHtmlTransientNode(node)
      node.ownerDocument.body?.appendChild(node)
      this.applyFloatingStyle(node, preview, clientX, clientY)
    } else {
      this.applyFloatingStyle(node, preview, clientX, clientY)
    }

    if (preview.lastClientX === clientX && preview.lastClientY === clientY) return
    preview.lastClientX = clientX
    preview.lastClientY = clientY

    const candidateListIds = readCandidateListIds(input.captureState)
    const resolvedTarget = this.resolveDropTarget(input.persoKey, input.sample, candidateListIds, preview.target)
    const target = this.resolveInitialSourceTarget(preview, resolvedTarget)
    if (!preview.targetResolved || !sameTarget(preview.target, target)) {
      this.applyTarget(preview, input.persoKey, input.captureState, target)
      preview.target = target
      preview.targetResolved = true
    }
    this.active.set(input.persoKey, preview)
  }

  /** Resolves the last previewed target once at the native end boundary. */
  resolveEndState(
    persoKey: string,
    captureState: RuntimeCaptureState,
    endEvent?: Event,
    captureId?: string,
  ): RuntimeCaptureState | undefined {
    const finalSample = readPointerSample(endEvent)
    if (finalSample !== undefined) {
      this.track({ captureId, persoKey, sample: finalSample, captureState })
    }
    const preview = this.resolvePreview(captureId, this.active.get(persoKey))
    if (preview === undefined) return captureState
    const target = preview.target ?? preview.origin
    if (target === undefined) return captureState

    const move: Record<string, CompiledValue> = {
      ...(isPlainRecord(captureState.move) ? captureState.move : {}),
      target: target.listId,
      mode: target.index,
      flipMode: 'overlay-world',
    }
    return {
      ...captureState,
      persoId: this.resolveAuthorId(persoKey),
      move,
    }
  }

  /** Releases the ghost and floating style after the normal move has committed. */
  close(persoKey: string, captureId?: string, completed = true): void {
    const preview = this.active.get(persoKey)
    if (preview === undefined) return
    if (captureId !== undefined && preview.captureId !== undefined && preview.captureId !== captureId) return
    this.clearGhost(preview)
    if (!completed) this.restoreSourceNode(persoKey, preview)
    else this.clearFloatingStyle(this.resolveNode(persoKey))
    this.clearFlipTransitions(preview)
    this.active.delete(persoKey)
  }

  /** Clears every preview resource during runner teardown. */
  destroy(): void {
    for (const persoKey of this.active.keys()) this.close(persoKey, undefined, false)
  }

  /** Resolves the original list and index from the current persistent DOM order. */
  private resolveOrigin(persoKey: string): DropTarget | undefined {
    const node = asElement(this.resolveNode(persoKey))
    const parent = node?.parentElement
    if (node === undefined || parent === null || parent === undefined) return undefined
    const listId = readItemId(parent)
    if (listId === undefined) return undefined
    // The dragged item must stay in this list's order while the origin is
    // recorded. Excluding it here made `indexOf(persoKey)` impossible and
    // silently changed every fallback origin to the end of the list.
    const storyId = persoKey.slice(0, persoKey.indexOf(':'))
    const canonicalNodes = this.resolveListItemNodes?.(storyId, listId)
    const itemIds = canonicalNodes === undefined
      ? readDirectItemIds(parent)
      : canonicalNodes
        .map(asElement)
        .filter((item): item is HTMLElement => item !== undefined)
        .filter((item) => !item.hasAttribute('data-codplay-dnd-ghost'))
        .map((item) => item.getAttribute('data-item-id') ?? '')
    const index = itemIds.indexOf(persoKey)
    return { listId, index: index < 0 ? itemIds.length : index }
  }

  /** Starts a fresh preview when a delayed close belongs to an older capture. */
  private resolvePreview(
    captureId: string | undefined,
    previous: ActivePreview | undefined,
  ): ActivePreview {
    if (previous === undefined
      || captureId === undefined
      || previous.captureId === undefined
      || previous.captureId === captureId) return previous ?? {}
    return {}
  }

  /** Keeps the first source-list preview in the slot vacated by the dragged item. */
  private resolveInitialSourceTarget(
    preview: ActivePreview,
    target: ResolvedDropTarget | undefined,
  ): ResolvedDropTarget | undefined {
    if (
      target === undefined
      || preview.targetResolved === true
      || preview.origin === undefined
      || preview.sourceIndex === undefined
      || target.listId !== preview.origin.listId
    ) return target

    return {
      ...target,
      index: Math.min(preview.sourceIndex, target.children.length),
    }
  }

  /** Releases transient resources while replacing one stale capture preview. */
  private clearPreviewResources(persoKey: string, preview: ActivePreview): void {
    this.clearGhost(preview)
    this.clearFloatingStyle(this.resolveNode(persoKey))
    this.clearFlipTransitions(preview)
  }

  /** Restores a floating root to its source slot when a capture is cancelled. */
  private restoreSourceNode(persoKey: string, preview: ActivePreview): void {
    const node = asElement(this.resolveNode(persoKey))
    const list = preview.sourceList
    if (node === undefined || list === undefined) return
    this.clearFloatingStyle(node)
    const children = readDirectItemElements(list, persoKey, preview.ghost)
    const reference = preview.sourceIndex === undefined ? undefined : children[preview.sourceIndex]
    if (reference === undefined) list.appendChild(node)
    else list.insertBefore(node, reference)
  }

  /** Performs one HTML geometry lookup against the candidate list roots. */
  private resolveDropTarget(
    persoKey: string,
    sample: RuntimeCaptureSample,
    candidateListIds: readonly string[],
    currentTarget?: DropTarget,
  ): ResolvedDropTarget | undefined {
    const clientX = readFiniteNumber(sample.clientX)
    const clientY = readFiniteNumber(sample.clientY)
    const storyId = persoKey.slice(0, persoKey.indexOf(':'))
    if (clientX === undefined || clientY === undefined || storyId.length === 0) return undefined

    for (const listId of candidateListIds) {
      const list = asElement(this.resolveListNode(storyId, listId))
      if (list === undefined) continue
      const pose = captureHtmlPose(list)
      const rect = list.getBoundingClientRect()
      const localPoint = worldDeltaToLocalDelta(
        pose.matrix,
        clientX - pose.origin.x,
        clientY - pose.origin.y,
      )
      const localListBox = toLocalBox(pose.matrix, pose.origin, rect)
      if (
        localPoint.x < localListBox.left
        || localPoint.x > localListBox.left + localListBox.width
        || localPoint.y < localListBox.top
        || localPoint.y > localListBox.top + localListBox.height
      ) continue

      const children = this.readListItemElements(storyId, listId, list, persoKey)
      const childBoxes = children.map((child) => toLocalBox(
        pose.matrix,
        pose.origin,
        measureHtmlSettledRect(child),
      ))
      return {
        listId,
        index: resolveInsertionIndex(
          localPoint.y,
          childBoxes,
          currentTarget?.listId === listId ? currentTarget.index : undefined,
        ),
        children,
      }
    }
    return undefined
  }

  /** Creates or repositions a transient placeholder in the resolved list. */
  private positionGhost(
    preview: ActivePreview,
    persoKey: string,
    captureState: RuntimeCaptureState,
    target: ResolvedDropTarget,
  ): void {
    const storyId = persoKey.slice(0, persoKey.indexOf(':'))
    const list = asElement(this.resolveListNode(storyId, target.listId))
    if (list === undefined) return
    const ghost = preview.ghost ?? createGhost(this.ghostClassName, preview, captureState)
    preview.ghost = ghost
    const reference = target.children[target.index]
    if (reference === undefined) list.appendChild(ghost)
    else list.insertBefore(ghost, reference)
  }

  /** Captures settled rectangles from the same mounted child order used by hit-testing. */
  private captureNeighborRects(
    storyId: string,
    listId: string | undefined,
    list: HTMLElement,
    excludedPersoKey: string,
    excludedGhost?: HTMLElement,
  ): ReadonlyMap<HTMLElement, HtmlTransientRect> {
    const children = listId === undefined
      ? readDirectItemElements(list, excludedPersoKey, excludedGhost)
      : this.readListItemElements(storyId, listId, list, excludedPersoKey, excludedGhost)
    return captureHtmlTransientRects(children)
  }

  /** Reads one list's canonical children, excluding transient preview nodes. */
  private readListItemElements(
    storyId: string,
    listId: string,
    list: HTMLElement,
    excludedPersoKey: string,
    excludedGhost?: HTMLElement,
  ): readonly HTMLElement[] {
    const resolved = this.resolveListItemNodes?.(storyId, listId)
    if (resolved === undefined) return readDirectItemElements(list, excludedPersoKey, excludedGhost)
    return resolved
      .map(asElement)
      .filter((node): node is HTMLElement => node !== undefined)
      .filter((node) => node.parentElement === list)
      .filter((node) => node !== excludedGhost)
      .filter((node) => !node.hasAttribute('data-codplay-dnd-ghost'))
      .filter((node) => node.getAttribute('data-item-id') !== excludedPersoKey)
  }

  /** Repositions one ghost and animates every affected sibling with one FLIP pair. */
  private applyTarget(
    preview: ActivePreview,
    persoKey: string,
    captureState: RuntimeCaptureState,
    target: ResolvedDropTarget | undefined,
  ): void {
    const previousList = preview.ghost?.parentElement instanceof HTMLElement
      ? preview.ghost.parentElement
      : undefined
    const targetList = target === undefined
      ? undefined
      : asElement(this.resolveListNode(persoKey.slice(0, persoKey.indexOf(':')), target.listId))
    const beforeByList = new Map<HTMLElement, ReadonlyMap<HTMLElement, HtmlTransientRect>>()

    if (preview.targetResolved !== true && preview.sourceRectsBeforeFloat !== undefined && preview.sourceList !== undefined) {
      beforeByList.set(preview.sourceList, preview.sourceRectsBeforeFloat)
    } else if (previousList !== undefined) {
      beforeByList.set(
        previousList,
        this.captureNeighborRects(
          persoKey.slice(0, persoKey.indexOf(':')),
          readItemId(previousList),
          previousList,
          persoKey,
          preview.ghost,
        ),
      )
    }
    if (targetList !== undefined && !beforeByList.has(targetList) && target !== undefined) {
      beforeByList.set(targetList, captureHtmlTransientRects(target.children))
    }

    if (target === undefined) this.clearGhost(preview)
    else this.positionGhost(preview, persoKey, captureState, target)

    const duration = readTransitionDuration(captureState)
    for (const rectsBefore of beforeByList.values()) {
      this.playFlipTransitions(preview, rectsBefore, duration)
    }
  }

  /** Plays transient HTML FLIP transitions without changing logical ordering. */
  private playFlipTransitions(
    preview: ActivePreview,
    rectsBefore: ReadonlyMap<HTMLElement, HtmlTransientRect>,
    duration: number,
  ): void {
    const cleanups = preview.flipCleanups ?? new Map<HTMLElement, () => void>()
    preview.flipCleanups = cleanups
    for (const [node, rectBefore] of rectsBefore) {
      playHtmlTransientFlip(node, rectBefore, duration, cleanups)
    }
  }

  /** Cancels preview-owned sibling transitions before a capture is replaced. */
  private clearFlipTransitions(preview: ActivePreview): void {
    for (const cleanup of preview.flipCleanups?.values() ?? []) cleanup()
    preview.flipCleanups?.clear()
  }

  /** Removes one transient placeholder without touching an author node. */
  private clearGhost(preview: ActivePreview): void {
    if (preview.ghost === undefined) return
    clearHtmlTransientNode(preview.ghost)
    preview.ghost.remove()
    preview.ghost = undefined
  }

  /** Applies the temporary fixed pose used while the item leaves list flow. */
  private applyFloatingStyle(node: HTMLElement, preview: ActivePreview, clientX: number, clientY: number): void {
    node.style.position = 'fixed'
    node.style.left = `${clientX - (preview.offsetX ?? 0)}px`
    node.style.top = `${clientY - (preview.offsetY ?? 0)}px`
    if (preview.width !== undefined) node.style.width = `${preview.width}px`
    if (preview.height !== undefined) node.style.height = `${preview.height}px`
    node.style.margin = '0'
    node.style.zIndex = '1000'
    node.style.pointerEvents = 'none'
  }

  /** Removes only the inline properties owned by this preview controller. */
  private clearFloatingStyle(node: unknown): void {
    const element = asElement(node)
    if (element === undefined) return
    for (const property of ['position', 'left', 'top', 'width', 'height', 'margin', 'z-index', 'pointer-events']) {
      element.style.removeProperty(property)
    }
    clearHtmlTransientNode(element)
  }
}

/** Creates one non-author ghost with dimensions copied from the dragged node. */
function createGhost(
  className: string,
  preview: ActivePreview,
  captureState: RuntimeCaptureState,
): HTMLElement {
  if (typeof document === 'undefined') throw new Error('HTML DnD preview requires a document.')
  const configured = isPlainRecord(captureState.ghost)
    ? captureState.ghost as CompiledRecord
    : undefined
  const configuredClassName = typeof configured?.className === 'string' ? configured.className : className
  const ghost = document.createElement('div')
  ghost.className = configuredClassName
  ghost.setAttribute('data-codplay-dnd-ghost', '')
  markHtmlTransientNode(ghost)
  if (preview.width !== undefined) ghost.style.width = `${preview.width}px`
  if (preview.height !== undefined) ghost.style.height = `${preview.height}px`
  const ghostStyle = isPlainRecord(configured?.style) ? configured.style : undefined
  if (ghostStyle !== undefined) {
    for (const [property, value] of Object.entries(ghostStyle)) ghost.style.setProperty(property, String(value))
  }
  return ghost
}

/** Reads the authored live transition duration used by the list preview. */
function readTransitionDuration(captureState: RuntimeCaptureState): number {
  const move = isPlainRecord(captureState.move) ? captureState.move as CompiledRecord : undefined
  const transition = move !== undefined && isPlainRecord(move.transition)
    ? move.transition as CompiledRecord
    : undefined
  return typeof transition?.duration === 'number'
    && Number.isFinite(transition.duration)
    && transition.duration > 0
    ? transition.duration
    : 220
}

/** Reads the final pointer sample when the native end event carries coordinates. */
function readPointerSample(event: Event | undefined): RuntimeCaptureSample | undefined {
  if (event === undefined) return undefined
  const pointer = event as Partial<PointerEvent>
  if (!isFiniteNumber(pointer.clientX) || !isFiniteNumber(pointer.clientY)) return undefined
  return {
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    movementX: isFiniteNumber(pointer.movementX) ? pointer.movementX : 0,
    movementY: isFiniteNumber(pointer.movementY) ? pointer.movementY : 0,
  }
}

/** Converts one viewport rectangle into the list's local coordinate system. */
function toLocalBox(matrix: HtmlMatrix, origin: Readonly<{ x: number; y: number }>, rect: HtmlTransientRect): LocalBox {
  const topLeft = worldDeltaToLocalDelta(matrix, rect.left - origin.x, rect.top - origin.y)
  const bottomRight = worldDeltaToLocalDelta(
    matrix,
    rect.left + rect.width - origin.x,
    rect.top + rect.height - origin.y,
  )
  return {
    left: Math.min(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    width: Math.abs(bottomRight.x - topLeft.x),
    height: Math.abs(bottomRight.y - topLeft.y),
  }
}

/** Accepts only finite native pointer values. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Resolves one insertion slot with the V1 midpoint hysteresis rule. */
function resolveInsertionIndex(
  localY: number,
  childBoxes: readonly LocalBox[],
  currentIndex?: number,
): number {
  for (let index = 0; index < childBoxes.length; index += 1) {
    const midpoint = childBoxes[index]!.top + childBoxes[index]!.height / 2
    const margin = childBoxes[index]!.height * 0.3
    const threshold = currentIndex === undefined
      ? midpoint
      : index < currentIndex
        ? midpoint - margin
        : midpoint + margin
    if (localY < threshold) return index
  }
  return childBoxes.length
}

/** Reads candidate list IDs from the author-controlled capture guard. */
function readCandidateListIds(captureState: RuntimeCaptureState): readonly string[] {
  return Array.isArray(captureState.dropIn)
    ? captureState.dropIn.filter((value): value is string => typeof value === 'string')
    : []
}

/** Reads the list perso ID attached to a materialized list root. */
function readItemId(node: Element): string | undefined {
  const itemId = node.getAttribute('data-item-id')
  if (itemId === null || !itemId.includes(':')) return undefined
  return itemId.slice(itemId.indexOf(':') + 1)
}

/** Reads direct author item keys while excluding the currently floating item. */
function readDirectItemIds(list: Element, excludedPersoKey?: string): readonly string[] {
  return readDirectItemElements(list, excludedPersoKey).map((element) => element.getAttribute('data-item-id') ?? '')
}

/** Reads direct materialized item roots, excluding ghosts and one dragged root. */
function readDirectItemElements(
  list: Element,
  excludedPersoKey?: string,
  excludedGhost?: HTMLElement,
): readonly HTMLElement[] {
  return Array.from(list.children).filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement) || child === excludedGhost) return false
    if (child.hasAttribute('data-codplay-dnd-ghost')) return false
    return child.getAttribute('data-item-id') !== excludedPersoKey
  })
}

/** Compares two drop targets without depending on object identity. */
function sameTarget(left: DropTarget | undefined, right: DropTarget | undefined): boolean {
  return left?.listId === right?.listId && left?.index === right?.index
}

/** Narrows a runtime node to the DOM element operations used by the preview. */
function asElement(value: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement ? value : undefined
}

/** Reads one finite numeric sample field. */
function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Resolves an author ID from the stable story-qualified runtime key. */
function defaultAuthorId(persoKey: string): string {
  const separator = persoKey.indexOf(':')
  return separator < 0 ? persoKey : persoKey.slice(separator + 1)
}
