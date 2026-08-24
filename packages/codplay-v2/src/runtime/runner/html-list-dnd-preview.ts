import { isPlainRecord } from '../../shared'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../capture'
import type { CompiledValue } from '../../scene/compiled'
import { captureHtmlPose, worldDeltaToLocalDelta } from '../motion/html-pose'
import {
  captureHtmlTransientRects,
  playHtmlTransientFlip,
  type HtmlTransientRect,
} from './html-transient-flip'
import {
  clearHtmlTransientNode,
  markHtmlTransientNode,
} from './html-transient-node'
import {
  asElement,
  defaultAuthorId,
  readCandidateListIds,
  readDirectItemElements,
  readDirectItemIds,
  readFiniteNumber,
  readItemId,
  readPointerSample,
  readTransitionDuration,
  resolveInsertionIndex,
  sameTarget,
  toLocalBox,
} from './html-list-dnd-preview/geometry'
import {
  applyFloatingStyle,
  clearFloatingStyle,
  createGhost,
} from './html-list-dnd-preview/effects'
import type {
  ActivePreview,
  DropTarget,
  HtmlListDndNodeResolver,
  HtmlListDndPreviewOptions,
  ResolvedDropTarget,
} from './html-list-dnd-preview/index'

export type {
  HtmlListDndListItemResolver,
  HtmlListDndPreviewOptions,
  HtmlListDndNodeResolver,
} from './html-list-dnd-preview/index'

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
      applyFloatingStyle(node, preview, clientX, clientY)
    } else {
      applyFloatingStyle(node, preview, clientX, clientY)
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
    else clearFloatingStyle(this.resolveNode(persoKey))
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
    clearFloatingStyle(this.resolveNode(persoKey))
    this.clearFlipTransitions(preview)
  }

  /** Restores a floating root to its source slot when a capture is cancelled. */
  private restoreSourceNode(persoKey: string, preview: ActivePreview): void {
    const node = asElement(this.resolveNode(persoKey))
    const list = preview.sourceList
    if (node === undefined || list === undefined) return
    clearFloatingStyle(node)
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
      const childrenRects = captureHtmlTransientRects(children)
      const childBoxes = children.map((child) => toLocalBox(pose.matrix, pose.origin, childrenRects.get(child)!))
      return {
        listId,
        index: resolveInsertionIndex(
          localPoint.y,
          childBoxes,
          currentTarget?.listId === listId ? currentTarget.index : undefined,
        ),
        children,
        childrenRects,
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
      beforeByList.set(targetList, target.childrenRects)
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

}
