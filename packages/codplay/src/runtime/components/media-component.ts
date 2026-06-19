import { BaseComponent } from './lib/base-component'
import { bindComponentEmitDeclarations } from './lib/dom'
import { appendDomChild, applyClassNamePatch, isDomElement, resetRuntimeNodeState } from './lib/dom-component-adapter'
import { injectBaseStyle } from './lib/inject-base-style'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type MediaNodeLike = Record<string, unknown> & {
  src?: string
  currentTime?: number
  duration?: number
  paused?: boolean
  playbackRate?: number
  play?: () => unknown
  pause?: () => void
}

export type MediaComponentApi = {
  seekTo: (mediaMs: number) => void
  play: () => void
  pause: () => void
  stopAt: (mediaMs: number) => void
  getCurrentTimeMs: () => number
  getDurationMs: () => number | null
  isPaused: () => boolean
  setRate: (rate: number) => void
}

const MEDIA_TIME_SYNC_TOLERANCE_MS = 40
const MEDIA_REF = 'media'
const VIDEO_BASE_CLASS = 'cp-video-inner'

/**
 * Checks whether one node can expose media playback methods.
 */
function toMediaNodeLike(nodeRef: unknown): MediaNodeLike | null {
  return typeof nodeRef === 'object' && nodeRef !== null ? (nodeRef as MediaNodeLike) : null
}

/**
 * Returns true when one media node is currently paused.
 */
function isMediaNodePaused(mediaNode: MediaNodeLike | null): boolean {
  return mediaNode?.paused === true
}

/**
 * Creates or reuses one internal video node attached to the wrapper root.
 */
function ensureMediaNode(rootNode: unknown, currentNode: unknown | null): unknown {
  if (isDomElement(rootNode)) {
    const existingNode = currentNode ?? rootNode.querySelector('video') ?? globalThis.document.createElement('video')
    appendDomChild(rootNode, existingNode)
    return existingNode
  }

  const existingFallbackNode = currentNode as MediaNodeLike | null
  const fallbackNode: MediaNodeLike = existingFallbackNode ?? {
    tagName: 'VIDEO',
    style: {},
    attributes: {},
    currentTime: 0,
    duration:
      typeof rootNode === 'object' &&
      rootNode !== null &&
      typeof (rootNode as { __mediaDurationSeconds?: unknown }).__mediaDurationSeconds === 'number'
        ? (rootNode as { __mediaDurationSeconds: number }).__mediaDurationSeconds
        : 12,
    paused: true
  }

  fallbackNode.play ??= () => {
    fallbackNode.paused = false
  }
  fallbackNode.pause ??= () => {
    fallbackNode.paused = true
  }

  if (typeof rootNode === 'object' && rootNode !== null) {
    ;(rootNode as Record<string, unknown>).mediaNode = fallbackNode
  }

  return fallbackNode
}

/**
 * Implements one simple media component rendered as one wrapper + video.
 */
export class MediaComponent extends BaseComponent implements MediaComponentApi {
  private playbackState: 'playing' | 'paused' = 'paused'

  /**
   * Declares services used for className, style and attr patches.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
    injectBaseStyle(
      'cp-video-inner-style',
      ':where(.cp-video-inner){width:100%;height:100%}'
    )
  }

  /**
   * Binds authored emit declarations once the root node is available.
   */
  init(): void {
    bindComponentEmitDeclarations({
      perso: this.perso,
      createElementOptions: this.createElementOptions,
      resolveRef: (ref) => this.resolveRef(ref),
      report: (warning) => {
        this.report(warning.code, warning.message, warning.details)
      }
    })
  }

  /**
   * Seeks media to one target position.
   */
  seekTo(mediaMs: number): void {
    const mediaNode = this.getPart(MEDIA_REF)
    this.setCurrentTimeMs(mediaNode, mediaMs)
  }

  /**
   * Starts media playback without forcing a new seek.
   */
  play(): void {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    if (mediaNode === null) {
      return
    }

    if (this.playbackState === 'playing' && !isMediaNodePaused(mediaNode)) {
      return
    }

    this.playbackState = 'playing'
    const playResult = mediaNode.play?.()
    if (playResult && typeof playResult === 'object' && 'catch' in playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => undefined)
    }
  }

  /**
   * Pauses media playback without forcing a new seek.
   */
  pause(): void {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    if (mediaNode === null) {
      return
    }

    if (this.playbackState === 'paused' && isMediaNodePaused(mediaNode)) {
      return
    }

    this.playbackState = 'paused'
    mediaNode.pause?.()
  }

  /**
   * Stops playback and freezes the media at one target position.
   */
  stopAt(mediaMs: number): void {
    this.seekTo(mediaMs)
    this.pause()
  }

  /**
   * Returns the current media time in milliseconds.
   */
  getCurrentTimeMs(): number {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    const currentTimeSeconds = typeof mediaNode?.currentTime === 'number' ? mediaNode.currentTime : 0
    return Math.max(0, currentTimeSeconds * 1000)
  }

  /**
   * Returns the media duration in milliseconds when available.
   */
  getDurationMs(): number | null {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    if (typeof mediaNode?.duration !== 'number' || !Number.isFinite(mediaNode.duration)) {
      return null
    }

    return Math.max(0, mediaNode.duration * 1000)
  }

  /**
   * Returns true when the underlying media node is currently paused.
   */
  isPaused(): boolean {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    if (typeof mediaNode?.paused === 'boolean') {
      return mediaNode.paused
    }

    return this.playbackState === 'paused'
  }

  /**
   * Applies the player rate to the underlying media element's native playbackRate.
   * The media element is its own engine: scaling its native clock keeps native
   * `play()` advancement in sync with the rate-scaled timeline without forced seeks.
   */
  setRate(rate: number): void {
    const mediaNode = toMediaNodeLike(this.getPart(MEDIA_REF))
    if (mediaNode === null) {
      return
    }

    mediaNode.playbackRate = rate
  }

  /**
   * Applies one source url on the internal video element.
   */
  private setMediaSource(nodeRef: unknown, src: string): void {
    if (isDomElement(nodeRef) && typeof globalThis.HTMLMediaElement !== 'undefined' && nodeRef instanceof globalThis.HTMLMediaElement) {
      nodeRef.pause()
      nodeRef.src = src
      return
    }

    const mediaNode = toMediaNodeLike(nodeRef)
    if (mediaNode !== null) {
      mediaNode.src = src
    }
  }

  /**
   * Synchronizes the media current time when drift exceeds one small tolerance.
   */
  private setCurrentTimeMs(nodeRef: unknown, mediaMs: number): void {
    const mediaNode = toMediaNodeLike(nodeRef)
    if (mediaNode === null) {
      return
    }

    const nextCurrentTimeSeconds = Math.max(0, mediaMs) / 1000
    const currentTimeSeconds = typeof mediaNode.currentTime === 'number' ? mediaNode.currentTime : 0
    if (Math.abs(currentTimeSeconds - nextCurrentTimeSeconds) * 1000 <= MEDIA_TIME_SYNC_TOLERANCE_MS) {
      return
    }

    mediaNode.currentTime = nextCurrentTimeSeconds
  }

  /**
   * Applies one resolved runtime action on the media component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    const action = input.action as { ref?: unknown; src?: unknown; video?: unknown }
    const targetNode = this.resolveRef(typeof action.ref === 'string' ? action.ref : undefined) ?? this.node
    this.services.apply(targetNode, input.action)
    if (typeof action.src === 'string') {
      this.setMediaSource(this.getPart(MEDIA_REF), action.src)
    }
    this.applyVideoProps(action.video)
  }

  /**
   * Ensures the video part exists, registers it, and initializes state.
   * existingMediaNode must be captured before buildNode clears the parts map.
   * On refresh (existingMediaNode !== null) the media element is reused without
   * reset or src reload — syncTimeline is responsible for repositioning it.
   */
  private setupMediaNode(rootNode: unknown, existingMediaNode: unknown | null): void {
    const mediaNode = ensureMediaNode(rootNode, existingMediaNode)
    this.setPart(MEDIA_REF, mediaNode)
    this.playbackState = 'paused'
    if (existingMediaNode !== null) {
      return
    }
    const initial = this.perso.initial as { src?: unknown }
    resetRuntimeNodeState(mediaNode)
    if (typeof initial.src === 'string') {
      this.setMediaSource(mediaNode, initial.src)
    }
  }

  /**
   * Applies video-specific props targeting the inner video element directly.
   */
  /**
   * Applies video-specific props targeting the inner video element.
   * The base class cp-video-inner is always re-ensured last so any authored
   * CSS selector or inline style can override defaults without !important.
   */
  private applyVideoProps(videoProps: unknown): void {
    if (videoProps !== null && typeof videoProps === 'object') {
      this.services.apply(this.getPart(MEDIA_REF), videoProps as Record<string, unknown>)
    }
    applyClassNamePatch(this.getPart(MEDIA_REF), { add: VIDEO_BASE_CLASS })
  }

  /**
   * Creates the component root with an internal video part.
   * The existing media node is captured before buildNode clears the parts map so
   * setupMediaNode can reuse it on seek refresh without reset or src reload.
   */
  render(): ComponentRenderResult {
    const existingMediaNode = this.getPart(MEDIA_REF)
    const rootNode = this.buildNode(`<div><video data-part="${MEDIA_REF}"/></div>`)
    this.setupMediaNode(rootNode, existingMediaNode)
    this.services.apply(rootNode, this.perso.initial)
    this.applyVideoProps((this.perso.initial as Record<string, unknown>).video)
    return rootNode as Node
  }
}
