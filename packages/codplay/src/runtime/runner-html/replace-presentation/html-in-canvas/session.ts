import type { ReplacePresentationSession } from '../../../components'
import { markHtmlTransientNode, clearHtmlTransientNode, isHtmlTransientNode } from '../../transient-node'
import { cloneSnapshotNode, isHtmlElement } from '../dom'
import { nextReplacePresentationId } from '../ids'
import { areMediaFramesReady, getMediaFrameReadiness, watchMediaFrames } from '../media'
import type { HtmlReplaceProfile } from '../profile'
import { isHtmlInCanvasEffectName } from './effects'
import { createHtmlInCanvasRenderer, type HtmlInCanvasInitialMedia } from './webgpu-renderer'

/** Default duration of an HTML-in-Canvas effect, in milliseconds. */
export const HTML_IN_CANVAS_DEFAULT_DURATION_MS = 900

/**
 * Presents the outgoing and incoming DOM states through HTML-in-Canvas slots
 * and one WebGPU effect. Media keep their native outgoing node; a slot, like
 * its other transitions, presents a temporary copy of its outgoing content,
 * since that content belongs to another owner. Returns undefined when the
 * effect cannot be presented, so the caller selects its fallback.
 */
export function createHtmlInCanvasSession(
  root: unknown,
  profile: HtmlReplaceProfile,
  sourceComposition?: unknown,
): ReplacePresentationSession | undefined {
  if (!isHtmlInCanvasEffectName(profile.transition)) return undefined
  if (!isHtmlElement(root) || root.parentElement === null) return undefined
  if (profile.motion !== undefined || profile.mediaCells !== undefined) return undefined
  const existingShadow = root.shadowRoot
  if (existingShadow !== null && existingShadow.querySelector('[data-codplay-hic-rest]') === null) return undefined
  const renderer = createHtmlInCanvasRenderer(profile.transition)
  if (renderer === undefined) return undefined

  const originalPosition = root.style.position
  const needsPosition = getComputedStyle(root).position === 'static'
  if (needsPosition) root.style.position = 'relative'
  const outgoingSlot = `codplay-hic-outgoing-${nextReplacePresentationId()}`
  const originalChildren = Array.from(root.children).filter(isHtmlElement)
  const copies = !isHtmlElement(sourceComposition) && !profile.freezeMedia
    ? originalChildren.map((element) => cloneSnapshotNode(element))
    : []
  const outgoing = isHtmlElement(sourceComposition)
    ? [sourceComposition]
    : profile.freezeMedia ? originalChildren : copies
  const shadow = existingShadow ?? root.attachShadow({ mode: 'open' })
  const slots = outgoing.map((element) => ({
    element,
    slot: element.getAttribute('slot'),
    transient: isHtmlTransientNode(element),
  }))
  for (const element of outgoing) {
    element.slot = outgoingSlot
    markHtmlTransientNode(element)
  }
  // A slot copy is shown above the canvas until its first DOM frame; a media
  // frame is drawn natively instead. Either way no empty canvas is displayed.
  const coverSlot = copies.length > 0 ? `codplay-hic-cover-${nextReplacePresentationId()}` : undefined
  const covers = coverSlot === undefined ? [] : originalChildren.map((element) => {
    const cover = cloneSnapshotNode(element)
    cover.slot = coverSlot
    markHtmlTransientNode(cover)
    return cover
  })
  for (const element of [...copies, ...covers]) root.append(element)
  renderer.mount(shadow, outgoingSlot, {
    ...(coverSlot === undefined ? {} : { coverSlot }),
    ...(copies.length > 0 ? {} : resolveInitialMedia(outgoing[0])),
  })

  let finished = false
  let progress = 0
  const waiters = new Set<() => void>()

  /** Releases this transition's GPU resources and restores ordinary projection of the persistent DOM. */
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
      if (copies.includes(element) || (root.children.length > 1 && element.parentNode === root)) element.remove()
    }
    for (const cover of covers) cover.remove()
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

  /** Samples the shared player or operation clock; paint events update the DOM textures. */
  const sample = (value: number): void => {
    if (finished) return
    progress = Math.min(1, Math.max(0, value))
    renderer.sample(progress)
  }

  renderer.onFailure(finish)
  return {
    start,
    tryStart: start,
    sample,
    finish,
    cancel: finish,
    getDuration: () => profile.duration ?? HTML_IN_CANVAS_DEFAULT_DURATION_MS,
    reflow: () => {
      if (!finished) renderer.reflow()
    },
    captureCurrent: () => finished ? undefined : renderer.capture(),
    waitForIncomingFrame: (onReady) => {
      const cancel = watchMediaFrames(root, onReady)
      waiters.add(cancel)
      return () => { cancel(); waiters.delete(cancel) }
    },
  }
}

/** Reads the native outgoing frame drawn before the first paint, when one is ready. */
function resolveInitialMedia(source: HTMLElement | undefined): Readonly<{ initialMedia?: HtmlInCanvasInitialMedia }> {
  if (source instanceof HTMLCanvasElement) {
    return { initialMedia: { source, width: source.width, height: source.height, objectFit: 'fill' } }
  }
  if (!(source instanceof HTMLImageElement || source instanceof HTMLVideoElement)) return {}
  if (getMediaFrameReadiness(source) !== 'ready') return {}
  return {
    initialMedia: {
      source,
      width: source instanceof HTMLImageElement ? source.naturalWidth : source.videoWidth,
      height: source instanceof HTMLImageElement ? source.naturalHeight : source.videoHeight,
      objectFit: getComputedStyle(source).objectFit || 'fill',
    },
  }
}
