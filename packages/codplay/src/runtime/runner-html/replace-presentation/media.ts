import { markHtmlTransientNode } from '../transient-node'
import { cloneSnapshotNode } from './dom'
import { nextReplacePresentationId } from './ids'



export type FrozenMediaFrame = Readonly<{
  rawFrame: HTMLCanvasElement
  objectFit: string
}>

const frozenMediaFrames = new WeakMap<HTMLCanvasElement, FrozenMediaFrame>()
const frozenMediaCloneListeners = new WeakMap<HTMLElement, Array<() => void>>()


/** Wraps one cloned root and freezes its media descendants when requested. */
export function createMotionSnapshot(
  root: HTMLElement,
  view: 'outgoing' | 'incoming',
  freezeMedia = false,
): HTMLElement | undefined {
  const wrapper = document.createElement('div')
  wrapper.id = `codplay-replace-motion-${nextReplacePresentationId()}`
  wrapper.setAttribute('data-codplay-replace-view', view)
  wrapper.setAttribute('aria-hidden', 'true')
  markHtmlTransientNode(wrapper)
  wrapper.style.overflow = 'visible'
  const content = cloneSnapshotNode(root)
  if (freezeMedia && !freezeMediaFrames(root, content)) return undefined
  wrapper.append(content)
  return wrapper
}


/** Copies each image/video frame into a static canvas owned by one replace snapshot. */
export function freezeMediaFrames(liveRoot: HTMLElement, snapshotRoot: HTMLElement): boolean {
  const liveMedia = collectMediaElements(liveRoot)
  const copiedMedia = collectMediaElements(snapshotRoot)
  if (liveMedia.length !== copiedMedia.length) return false

  for (let index = 0; index < liveMedia.length; index += 1) {
    const source = liveMedia[index]
    const copied = copiedMedia[index]
    if (source === undefined || copied === undefined) return false
    const rawFrame = createRawMediaFrame(source)
    if (rawFrame === undefined) return false
    const frame = document.createElement('canvas')
    frame.dataset.codplayReplaceFrame = ''
    frame.id = `codplay-replace-frame-${nextReplacePresentationId()}`
    frame.width = rawFrame.width
    frame.height = rawFrame.height
    copyMediaFrameStyle(source, frame)
    const objectFit = getComputedStyle(source).objectFit || 'fill'
    if (!drawFittedFrame(frame, rawFrame, objectFit, source.getBoundingClientRect())) return false
    frozenMediaFrames.set(frame, { rawFrame, objectFit })
    copied.replaceWith(frame)
  }
  return true
}

/** Pauses each cloned video at the source time without copying media into a canvas. */
export function freezeMediaClone(liveRoot: HTMLElement, snapshotRoot: HTMLElement): boolean {
  const liveMedia = collectMediaElements(liveRoot)
  const copiedMedia = collectMediaElements(snapshotRoot)
  if (liveMedia.length !== copiedMedia.length) return false

  const removeListeners: Array<() => void> = []
  for (let index = 0; index < liveMedia.length; index += 1) {
    const source = liveMedia[index]
    const copied = copiedMedia[index]
    if (source === undefined || copied === undefined) return false
    if (copied.tagName.toLowerCase() !== 'video') continue

    const sourceVideo = source as HTMLVideoElement
    const copiedVideo = copied as HTMLVideoElement
    const sourceTime = Number.isFinite(sourceVideo.currentTime) ? sourceVideo.currentTime : 0
    copiedVideo.pause()
    copiedVideo.autoplay = false
    copiedVideo.removeAttribute('autoplay')
    copiedVideo.controls = false
    copiedVideo.preload = 'auto'
    copiedVideo.playsInline = true

    const seekCloneToSource = (): void => {
      if (copiedVideo.readyState < 1 || copiedVideo.error !== null) return
      if (Math.abs(copiedVideo.currentTime - sourceTime) < 0.001) return
      try {
        copiedVideo.currentTime = sourceTime
      } catch {
        // The readiness listener retries when the browser accepts a seek.
      }
    }
    if (copiedVideo.readyState >= 1) seekCloneToSource()
    else {
      const listener = (): void => seekCloneToSource()
      copiedVideo.addEventListener('loadedmetadata', listener)
      removeListeners.push(() => copiedVideo.removeEventListener('loadedmetadata', listener))
    }
  }
  frozenMediaCloneListeners.set(snapshotRoot, removeListeners)
  return true
}

/** Removes pending metadata listeners owned by a frozen media clone. */
export function releaseFrozenMediaClone(snapshotRoot: HTMLElement): void {
  for (const removeListener of frozenMediaCloneListeners.get(snapshotRoot) ?? []) removeListener()
  frozenMediaCloneListeners.delete(snapshotRoot)
}


/** Collects only native image/video elements from one component root. */
export function collectMediaElements(root: HTMLElement): Array<HTMLImageElement | HTMLVideoElement> {
  const elements: Array<HTMLImageElement | HTMLVideoElement> = []
  if (isMediaElement(root)) elements.push(root)
  elements.push(...Array.from(root.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video')))
  return elements
}


/** Narrows one HTML element to a native media frame source. */
export function isMediaElement(value: HTMLElement): value is HTMLImageElement | HTMLVideoElement {
  return value.tagName.toLowerCase() === 'img' || value.tagName.toLowerCase() === 'video'
}


/** Reports whether every current media element has a decoded frame available. */
export function areMediaFramesReady(root: HTMLElement): boolean {
  const media = collectMediaElements(root)
  return media.every((source) => getMediaFrameReadiness(source) === 'ready')
}


/** Waits for current media sources without cloning or changing their persistent nodes. */
export function watchMediaFrames(
  root: HTMLElement,
  onReady: (state: 'ready' | 'error') => void,
): () => void {
  const media = collectMediaElements(root)
  let active = true
  const removeListeners: Array<() => void> = []

  /** Removes native listeners and prevents a stale callback from reaching the player. */
  const cancel = (): void => {
    if (!active) return
    active = false
    for (const removeListener of removeListeners) removeListener()
    removeListeners.length = 0
  }

  /** Settles once all sources are ready or any source reports a terminal error. */
  const check = (): void => {
    if (!active) return
    const readiness = media.map(getMediaFrameReadiness)
    if (readiness.includes('error')) {
      cancel()
      onReady('error')
      return
    }
    if (readiness.every((state) => state === 'ready')) {
      cancel()
      onReady('ready')
    }
  }

  for (const source of media) {
    const events = source.tagName.toLowerCase() === 'img'
      ? ['load', 'error']
      : ['loadedmetadata', 'loadeddata', 'canplay', 'seeked', 'timeupdate', 'error']
    for (const eventName of events) {
      const listener = (): void => check()
      source.addEventListener(eventName, listener)
      removeListeners.push(() => source.removeEventListener(eventName, listener))
    }
    if (source.tagName.toLowerCase() === 'img') {
      const image = source as HTMLImageElement
      if (typeof image.decode === 'function') void image.decode().then(check).catch(check)
    }
  }
  queueMicrotask(check)
  return cancel
}


/** Distinguishes a decoded frame from a still-pending or failed native source. */
export function getMediaFrameReadiness(source: HTMLImageElement | HTMLVideoElement): 'ready' | 'error' | undefined {
  if (source.tagName.toLowerCase() === 'img') {
    const image = source as HTMLImageElement
    if (!image.complete) return undefined
    return image.naturalWidth > 0 && image.naturalHeight > 0 ? 'ready' : 'error'
  }
  const video = source as HTMLVideoElement
  if (video.error !== null) return 'error'
  if (video.seeking || video.readyState < 2) return undefined
  return video.videoWidth > 0 && video.videoHeight > 0 ? 'ready' : undefined
}


/** Copies a currently available decoded image or video frame to an offscreen canvas. */
export function createRawMediaFrame(source: HTMLImageElement | HTMLVideoElement): HTMLCanvasElement | undefined {
  if (getMediaFrameReadiness(source) !== 'ready') return undefined
  const isVideo = source.tagName.toLowerCase() === 'video'
  const width = isVideo ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth
  const height = isVideo ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined

  const frame = document.createElement('canvas')
  frame.width = width
  frame.height = height
  const context = frame.getContext('2d')
  if (context === null) return undefined
  try {
    context.drawImage(source, 0, 0, width, height)
  } catch {
    return undefined
  }
  return frame
}


/** Retains layout styles needed for a canvas to occupy the source media rectangle. */
export function copyMediaFrameStyle(source: HTMLElement, frame: HTMLCanvasElement): void {
  const computed = getComputedStyle(source)
  frame.className = source.className
  frame.style.cssText = source.style.cssText
  frame.style.display = computed.display === 'inline' ? 'inline-block' : computed.display
  frame.style.boxSizing = computed.boxSizing
  frame.style.margin = computed.margin
  frame.style.padding = computed.padding
  frame.style.border = computed.border
  frame.style.borderRadius = computed.borderRadius
  frame.style.verticalAlign = computed.verticalAlign
  frame.style.opacity = computed.opacity
  copyMediaFrameDimensions(source, frame)
}


/** Updates fallback pixel dimensions from the current live media box. */
export function copyMediaFrameDimensions(
  source: HTMLElement,
  frame: HTMLCanvasElement,
): DOMRectReadOnly {
  const rect = source.getBoundingClientRect()
  if (source.style.width === '') frame.style.width = `${rect.width || frame.width}px`
  if (source.style.height === '') frame.style.height = `${rect.height || frame.height}px`
  return rect
}


/** Draws a fixed raw frame into its measured media rectangle with the authored fit rule. */
export function drawFittedFrame(
  target: HTMLCanvasElement,
  source: HTMLCanvasElement,
  objectFit: string,
  fallbackRect?: Pick<DOMRectReadOnly, 'width' | 'height'>,
): boolean {
  const rect = target.getBoundingClientRect()
  const pixelRatio = getDevicePixelRatio()
  const width = Math.max(1, Math.round((rect.width || fallbackRect?.width || source.width) * pixelRatio))
  const height = Math.max(1, Math.round((rect.height || fallbackRect?.height || source.height) * pixelRatio))
  if (target.width !== width) target.width = width
  if (target.height !== height) target.height = height
  const context = target.getContext('2d')
  if (context === null) return false
  context.clearRect(0, 0, width, height)

  const sourceWidth = source.width
  const sourceHeight = source.height
  const containScale = Math.min(width / sourceWidth, height / sourceHeight)
  const coverScale = Math.max(width / sourceWidth, height / sourceHeight)
  const fit = objectFit === 'cover'
    ? 'cover'
    : objectFit === 'contain' || objectFit === 'scale-down'
      ? 'contain'
      : objectFit
  if (fit === 'fill' || fit === 'cover' || fit === 'contain' || fit === 'scale-down') {
    const scale = fit === 'cover'
      ? coverScale
      : fit === 'scale-down'
        ? Math.min(1, containScale)
        : fit === 'contain'
          ? containScale
          : 0
    if (fit === 'fill') {
      context.drawImage(source, 0, 0, width, height)
      return true
    }
    const drawnWidth = sourceWidth * scale
    const drawnHeight = sourceHeight * scale
    const left = (width - drawnWidth) / 2
    const top = (height - drawnHeight) / 2
    context.drawImage(source, left, top, drawnWidth, drawnHeight)
    return true
  }

  const left = (width - sourceWidth) / 2
  const top = (height - sourceHeight) / 2
  context.drawImage(source, left, top)
  return true
}


/** Redraws immutable raw frames to their current responsive canvas dimensions. */
export function resizeFrozenMediaFrames(snapshot: HTMLElement, liveRoot: HTMLElement): void {
  const liveMedia = collectMediaElements(liveRoot)
  const frames = snapshot.querySelectorAll<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]
    const frozen = frozenMediaFrames.get(frame)
    if (frozen === undefined) continue
    const liveSource = liveMedia[index]
    const fallbackRect = liveSource === undefined
      ? undefined
      : copyMediaFrameDimensions(liveSource, frame)
    drawFittedFrame(frame, frozen.rawFrame, frozen.objectFit, fallbackRect)
  }
}

/** Reads the device scale used to keep whole-view media snapshots crisp. */
export function getDevicePixelRatio(): number {
  return typeof globalThis.devicePixelRatio === 'number' && globalThis.devicePixelRatio > 0
    ? globalThis.devicePixelRatio
    : 1
}


