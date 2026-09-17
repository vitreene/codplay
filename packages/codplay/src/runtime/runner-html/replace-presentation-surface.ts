import type {
  ReplaceComponentSurface,
  ReplacePresentationSession,
  ReplaceTransition,
} from '../components'
import { markHtmlTransientNode } from './transient-node'

/** Creates a presentation-only replace surface for one materialized HTML root. */
export function createHtmlReplacePresentationSurface(root: unknown): ReplaceComponentSurface {
  return {
    begin: (transition = 'fade') => createReplaceSession(root, transition),
  }
}

/** Captures the outgoing snapshot before the component changes its live content. */
function createReplaceSession(root: unknown, transition: ReplaceTransition): ReplacePresentationSession | undefined {
  if (!isHtmlElement(root)) return undefined
  const parent = root.parentElement
  if (parent === null) return undefined

  const outgoingSnapshot = root.cloneNode(true)
  if (!isHtmlElement(outgoingSnapshot)) return undefined

  const originalVisibility = root.style.visibility
  const originalOpacity = root.style.opacity
  const originalRootPosition = root.style.position
  const originalParentPosition = parent.style.position
  if (originalParentPosition === '' || originalParentPosition === 'static') {
    parent.style.position = 'relative'
  }
  if (originalRootPosition === '' || originalRootPosition === 'static') {
    root.style.position = 'relative'
  }

  sanitizeSnapshot(outgoingSnapshot)
  outgoingSnapshot.style.opacity = originalOpacity || '1'
  positionSnapshot(outgoingSnapshot, root, parent)
  parent.insertBefore(outgoingSnapshot, root)
  root.style.visibility = 'hidden'

  let incomingSnapshot: HTMLElement | undefined
  let state: 'prepared' | 'started' | 'finished' | 'cancelled' = 'prepared'
  let restoredOpacity = originalOpacity

  /** Creates the incoming presentation clone after the logical component update. */
  const start = (): void => {
    if (state !== 'prepared') return
    restoredOpacity = root.style.opacity

    // Keep the logical root hidden while the V1-compatible incoming clone is
    // prepared. The component has already applied its new state at this point.
    root.style.visibility = originalVisibility
    const nextSnapshot = root.cloneNode(true)
    if (!isHtmlElement(nextSnapshot)) {
      root.style.visibility = 'hidden'
      return
    }
    sanitizeSnapshot(nextSnapshot)
    nextSnapshot.style.opacity = '0'
    positionSnapshot(nextSnapshot, root, parent)
    parent.insertBefore(nextSnapshot, root)
    incomingSnapshot = nextSnapshot
    root.style.visibility = 'hidden'
    state = 'started'
  }

  /** Applies the selected replacement profile to the two temporary layers. */
  const sample = (progress: number): void => {
    if (state !== 'started') return
    const normalized = Math.min(1, Math.max(0, progress))
    if (transition === 'fade') outgoingSnapshot.style.opacity = String(1 - normalized)
    incomingSnapshot?.style.setProperty('opacity', String(normalized))
  }

  /** Completes the transition and leaves only the updated persistent root. */
  const finish = (): void => {
    if (state === 'finished' || state === 'cancelled') return
    removeSnapshot(outgoingSnapshot, parent)
    if (incomingSnapshot !== undefined) removeSnapshot(incomingSnapshot, parent)
    root.style.visibility = originalVisibility
    root.style.opacity = restoredOpacity
    root.style.position = originalRootPosition
    restoreParentPosition(parent, originalParentPosition)
    state = 'finished'
  }

  /** Cancels the transition and removes every presentation-only contribution. */
  const cancel = (): void => {
    if (state === 'finished' || state === 'cancelled') return
    removeSnapshot(outgoingSnapshot, parent)
    if (incomingSnapshot !== undefined) removeSnapshot(incomingSnapshot, parent)
    root.style.visibility = originalVisibility
    root.style.opacity = state === 'started' ? restoredOpacity : originalOpacity
    root.style.position = originalRootPosition
    restoreParentPosition(parent, originalParentPosition)
    state = 'cancelled'
  }

  return { start, sample, finish, cancel }
}

/** Positions a snapshot over the same parent-local rectangle as its source. */
function positionSnapshot(snapshot: HTMLElement, root: HTMLElement, parent: HTMLElement): void {
  const offset = getOffsetFromParent(root, parent)
  snapshot.style.position = 'absolute'
  snapshot.style.left = `${offset.left}px`
  snapshot.style.top = `${offset.top}px`
  snapshot.style.width = `${root.offsetWidth}px`
  snapshot.style.height = `${root.offsetHeight}px`
  snapshot.style.margin = '0'
  snapshot.style.pointerEvents = 'none'
}

/** Reads the source offset without measuring or cloning any foreign resource. */
function getOffsetFromParent(root: HTMLElement, parent: HTMLElement): Readonly<{ left: number; top: number }> {
  let left = 0
  let top = 0
  let current: HTMLElement | null = root
  while (current !== null && current !== parent) {
    left += current.offsetLeft
    top += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  return { left, top }
}

/** Removes identities and inline handlers from the temporary presentation copy. */
function sanitizeSnapshot(snapshot: HTMLElement): void {
  markHtmlTransientNode(snapshot)
  for (const element of [snapshot, ...Array.from(snapshot.querySelectorAll<HTMLElement>('*'))]) {
    element.removeAttribute('id')
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name)
    }
    element.setAttribute('aria-hidden', 'true')
    element.style.pointerEvents = 'none'
  }
}

/** Removes one snapshot only if it is still attached to the presentation parent. */
function removeSnapshot(snapshot: HTMLElement, parent: HTMLElement): void {
  if (snapshot.parentNode === parent) parent.removeChild(snapshot)
}

/** Restores the parent positioning contribution left by the snapshot. */
function restoreParentPosition(parent: HTMLElement, originalPosition: string): void {
  if (parent.style.position === 'relative') parent.style.position = originalPosition
}

/** Narrows the materialized root to the HTML element contract used by this surface. */
function isHtmlElement(value: unknown): value is HTMLElement {
  return typeof globalThis.HTMLElement !== 'undefined' && value instanceof globalThis.HTMLElement
}
