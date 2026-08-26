import { isFiniteNumber, isPlainRecord } from '../../../shared'
import type { CompiledRecord } from '../../../scene/compiled'
import type { RuntimeCaptureSample, RuntimeCaptureState } from '../../capture'
import { worldDeltaToLocalDelta } from '../../motion/html-pose'
import type { HtmlMatrix } from '../../motion/html-types'
import type { HtmlTransientRect } from '../transient-flip'
import type { DropTarget, LocalBox } from './types'

/** Reads the authored live transition duration used by the list preview. */
export function readTransitionDuration(captureState: RuntimeCaptureState): number {
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
export function readPointerSample(event: Event | undefined): RuntimeCaptureSample | undefined {
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
export function toLocalBox(
  matrix: HtmlMatrix,
  origin: Readonly<{ x: number; y: number }>,
  rect: HtmlTransientRect,
): LocalBox {
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

/** Resolves one insertion slot with the V1 midpoint hysteresis rule. */
export function resolveInsertionIndex(
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
export function readCandidateListIds(captureState: RuntimeCaptureState): readonly string[] {
  return Array.isArray(captureState.dropIn)
    ? captureState.dropIn.filter((value): value is string => typeof value === 'string')
    : []
}

/** Reads the list perso ID attached to a materialized list root. */
export function readItemId(node: Element): string | undefined {
  const itemId = node.getAttribute('data-item-id')
  if (itemId === null || !itemId.includes(':')) return undefined
  return itemId.slice(itemId.indexOf(':') + 1)
}

/** Reads direct author item keys while excluding the currently floating item. */
export function readDirectItemIds(list: Element, excludedPersoKey?: string): readonly string[] {
  return readDirectItemElements(list, excludedPersoKey).map((element) => element.getAttribute('data-item-id') ?? '')
}

/** Reads direct materialized item roots, excluding ghosts and one dragged root. */
export function readDirectItemElements(
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
export function sameTarget(left: DropTarget | undefined, right: DropTarget | undefined): boolean {
  return left?.listId === right?.listId && left?.index === right?.index
}

/** Narrows a runtime node to the DOM element operations used by the preview. */
export function asElement(value: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement ? value : undefined
}

/** Reads one finite numeric sample field. */
export function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Resolves an author ID from the stable story-qualified runtime key. */
export function defaultAuthorId(persoKey: string): string {
  const separator = persoKey.indexOf(':')
  return separator < 0 ? persoKey : persoKey.slice(separator + 1)
}
