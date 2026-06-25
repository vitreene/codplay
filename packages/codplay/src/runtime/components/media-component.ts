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
 * Creates one fresh internal media node (one per src). DOM env returns a real <video>;
 * the object fallback mirrors the media playback surface used by media-sync in tests.
 */
function createMediaNode(rootNode: unknown): unknown {
  if (typeof globalThis.document !== 'undefined') {
    return globalThis.document.createElement('video')
  }

  const fallbackNode: MediaNodeLike = {
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

  return fallbackNode
}

/**
 * Implements one simple media component rendered as one wrapper + video.
 */
export class MediaComponent extends BaseComponent implements MediaComponentApi {
  private playbackState: 'playing' | 'paused' = 'paused'
  /** One persistent media node per src. Inactive nodes are detached but retained here. */
  private readonly mediaBySrc = new Map<string, unknown>()
  /** The src whose node is currently attached to the root. */
  private activeSrc: string | null = null

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
      this.setActiveSrc(this.node, action.src)
    }
    this.applyVideoProps(action.video)
  }

  /**
   * Collects the statically declared srcs of this perso (initial + actions).
   */
  private staticSrcs(): string[] {
    const srcs: string[] = []
    const initial = this.perso.initial as { src?: unknown }
    if (typeof initial.src === 'string') {
      srcs.push(initial.src)
    }
    const actions = (this.perso.actions ?? {}) as Record<string, unknown>
    for (const action of Object.values(actions)) {
      if (action !== null && typeof action === 'object' && !Array.isArray(action)) {
        const src = (action as Record<string, unknown>).src
        if (typeof src === 'string') {
          srcs.push(src)
        }
      }
    }
    return srcs
  }

  /**
   * Returns the persistent media node for one src, creating it (src assigned once) on first
   * use. A src outside the static set warns the author: all scene media should be preloaded.
   */
  private ensureNodeForSrc(rootNode: unknown, src: string): unknown {
    const existing = this.mediaBySrc.get(src)
    if (existing !== undefined) {
      return existing
    }

    if (!this.staticSrcs().includes(src)) {
      this.report(
        'AUTHOR_MEDIA_SRC_NOT_PRELOADED',
        'Media src is not in the perso static set; all scene media should be preloaded',
        { src }
      )
    }

    const node = createMediaNode(rootNode)
    resetRuntimeNodeState(node)
    this.setMediaSource(node, src)
    this.applyVideoProps((this.perso.initial as Record<string, unknown>).video, node)
    this.mediaBySrc.set(src, node)
    return node
  }

  /**
   * Makes the node for one src the single attached media child of the root: detaches the
   * previously active node and attaches the target one. No src reassignment on an existing
   * node, so playback/decoding of inactive nodes is preserved.
   */
  private setActiveSrc(rootNode: unknown, src: string): void {
    const node = this.ensureNodeForSrc(rootNode, src)

    const previous =
      this.activeSrc !== null ? this.mediaBySrc.get(this.activeSrc) : undefined
    if (previous !== undefined && previous !== node && isDomElement(previous)) {
      previous.remove()
    }

    if (isDomElement(rootNode) && isDomElement(node) && node.parentNode !== rootNode) {
      appendDomChild(rootNode, node)
    } else if (!isDomElement(rootNode) && typeof rootNode === 'object' && rootNode !== null) {
      ;(rootNode as Record<string, unknown>).mediaNode = node
    }

    this.activeSrc = src
    this.setPart(MEDIA_REF, node)
    this.playbackState = 'paused'
  }

  /**
   * Applies video-specific props targeting the inner video element directly.
   */
  /**
   * Applies video-specific props targeting the inner video element.
   * The base class cp-video-inner is always re-ensured last so any authored
   * CSS selector or inline style can override defaults without !important.
   */
  private applyVideoProps(videoProps: unknown, target?: unknown): void {
    const node = target ?? this.getPart(MEDIA_REF)
    if (videoProps !== null && typeof videoProps === 'object') {
      this.services.apply(node, videoProps as Record<string, unknown>)
    }
    applyClassNamePatch(node, { add: VIDEO_BASE_CLASS })
  }

  /**
   * Creates the component root with an internal video part.
   * The existing media node is captured before buildNode clears the parts map so
   * setupMediaNode can reuse it on seek refresh without reset or src reload.
   */
  render(): ComponentRenderResult {
    const rootNode = this.buildNode('<div></div>')
    this.services.apply(rootNode, this.perso.initial)

    const initialSrc = (this.perso.initial as { src?: unknown }).src
    if (typeof initialSrc === 'string') {
      this.setActiveSrc(rootNode, initialSrc)
    }
    this.applyVideoProps((this.perso.initial as Record<string, unknown>).video)

    return rootNode as Node
  }
}
