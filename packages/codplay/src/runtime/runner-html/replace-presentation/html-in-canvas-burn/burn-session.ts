import type { ReplacePresentationSession } from '../../../components'
import { markHtmlTransientNode, clearHtmlTransientNode, isHtmlTransientNode } from '../../transient-node'
import { isHtmlElement } from '../dom'
import { nextReplacePresentationId } from '../ids'
import { areMediaFramesReady, getMediaFrameReadiness, watchMediaFrames } from '../media'
import type { HtmlReplaceProfile } from '../profile'
import { createHtmlInCanvasBurnRenderer, type BurnInitialMedia } from './burn-renderer'

/** Presents native outgoing and incoming media through H-i-C slots, without cloning either state. */
export function createHtmlInCanvasBurnSession(
  root: unknown,
  profile: HtmlReplaceProfile,
  sourceComposition?: unknown,
): ReplacePresentationSession | undefined {
  if (!isHtmlElement(root) || root.localName !== 'div' || root.parentElement === null) return undefined
  if (profile.motion !== undefined || profile.mediaCells !== undefined) return undefined
  const existingShadow = root.shadowRoot
  if (existingShadow !== null && existingShadow.querySelector('[data-codplay-hic-rest]') === null) return undefined
  const renderer = createHtmlInCanvasBurnRenderer()
  if (renderer === undefined) return undefined

  const originalPosition = root.style.position
  const needsPosition = getComputedStyle(root).position === 'static'
  if (needsPosition) root.style.position = 'relative'
  const outgoingSlot = `codplay-hic-outgoing-${nextReplacePresentationId()}`
  const originalChildren = Array.from(root.children).filter(isHtmlElement)
  const outgoing = isHtmlElement(sourceComposition) ? [sourceComposition] : originalChildren
  const source = outgoing[0]
  const initialMedia: BurnInitialMedia | undefined = source instanceof HTMLCanvasElement
    ? { source, width: source.width, height: source.height, objectFit: 'fill' }
    : (source instanceof HTMLImageElement || source instanceof HTMLVideoElement)
      && getMediaFrameReadiness(source) === 'ready'
      ? {
        source,
        width: source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth,
        height: source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight,
        objectFit: getComputedStyle(source).objectFit || 'fill',
      }
      : undefined
  const shadow = existingShadow ?? root.attachShadow({ mode: 'open' })
  const slots = outgoing.map((element) => ({ element, slot: element.getAttribute('slot'), transient: isHtmlTransientNode(element) }))
  for (const element of outgoing) {
    element.slot = outgoingSlot
    markHtmlTransientNode(element)
  }
  renderer.mount(shadow, outgoingSlot, initialMedia)

  let finished = false
  let progress = 0
  const waiters = new Set<() => void>()

  /** Releases this transition's renderer and restores ordinary projection of the persistent DOM. */
  const finish = (): void => {
    if (finished) return
    finished = true
    for (const cancel of waiters) cancel()
    waiters.clear()
    renderer.dispose()
    if (needsPosition && root.style.position === 'relative') root.style.position = originalPosition
    // A shadow root cannot be detached. Its sole resting slot owns no graphics resources.
    const slot = document.createElement('slot')
    slot.setAttribute('data-codplay-hic-rest', '')
    shadow.replaceChildren(slot)
    for (const { element, slot: originalSlot, transient } of slots) {
      if (originalSlot === null) element.removeAttribute('slot')
      else element.setAttribute('slot', originalSlot)
      if (!transient) clearHtmlTransientNode(element)
      if (root.children.length > 1 && element.parentNode === root) element.remove()
    }
  }

  /** Keeps the outgoing state drawable while the shared media readiness circuit prepares the incoming view. */
  const start = (): boolean => {
    if (finished) return true
    for (const element of outgoing) {
      if (element.parentNode !== root) root.append(element)
    }
    if (!areMediaFramesReady(root)) return false
    renderer.sample(progress)
    return true
  }

  /** Samples the shared player clock; browser paint events update the DOM textures. */
  const sample = (value: number): void => {
    if (finished) return
    progress = Math.min(1, Math.max(0, value))
    renderer.sample(progress)
  }

  renderer.onContextLost(finish)
  return {
    start,
    tryStart: start,
    sample,
    finish,
    cancel: finish,
    getDuration: () => profile.duration ?? 900,
    reflow: () => sample(progress),
    captureCurrent: () => finished ? undefined : renderer.capture(),
    waitForIncomingFrame: (onReady) => {
      const cancel = watchMediaFrames(root, onReady)
      waiters.add(cancel)
      return () => { cancel(); waiters.delete(cancel) }
    },
  }
}
