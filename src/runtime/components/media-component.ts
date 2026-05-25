import { BaseComponent } from './lib/base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  bindComponentEmitDeclarations,
  createComponentRoot,
  resetComponentRoot,
  setComponentRootId
} from './lib/dom'
import { appendDomChild, isDomElement, resetRuntimeNodeState } from './lib/dom-component-adapter'
import type { RuntimeComponentUpdateInput } from './types'

type MediaState = {
  id?: unknown
  ref?: unknown
  src?: unknown
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

type MediaNodeLike = Record<string, unknown> & {
  src?: string
  currentTime?: number
  duration?: number
  paused?: boolean
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
}

const MEDIA_TIME_SYNC_TOLERANCE_MS = 40
const MEDIA_REF = 'media'

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
   * Creates the component root and applies the authored initial state.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as MediaState
    const rootNode = createComponentRoot(this.item, 'div', this.createElementOptions)
    const mediaNode = ensureMediaNode(rootNode, this.getPart(MEDIA_REF))

    resetComponentRoot(rootNode)
    resetRuntimeNodeState(mediaNode)
    setComponentRootId(rootNode, this.item.id, state.id)

    this.setRoot(rootNode)
    this.setPart(MEDIA_REF, mediaNode)

    this.applyVisualState(state)

    if (typeof state.src === 'string') {
      this.setMediaSource(mediaNode, state.src)
    }

    this.playbackState = 'paused'

    bindComponentEmitDeclarations({
      item: this.item,
      createElementOptions: this.createElementOptions,
      resolveRef: (ref) => this.resolveRef(ref),
      warn: (warning) => {
        this.warn(warning.code, warning.message, warning.details)
      }
    })
  }

  /**
   * Applies one resolved runtime action on the media component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.warn('RUNTIME_MEDIA_NOT_INITIALIZED', 'Media component update rejected because init is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const state = input.action as MediaState
    this.applyVisualState(state, {
      skipTransitionValues: true,
      eventId: input.eventId,
      eventSeq: input.eventSeq
    })

    if (state.src !== undefined && typeof state.src === 'string') {
      this.setMediaSource(this.getPart(MEDIA_REF), state.src)
    }
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
   * Applies root or internal ref visual props according to one optional author ref.
   */
  private applyVisualState(
    state: MediaState,
    styleOptions: { skipTransitionValues?: boolean; eventId?: string; eventSeq?: number } = {}
  ): void {
    if (state.ref !== undefined && state.ref !== 'root' && state.ref !== MEDIA_REF) {
      this.warn('AUTHOR_COMPONENT_REF_UNKNOWN', 'Component ref is unknown', {
        ref: state.ref,
        eventId: styleOptions.eventId,
        eventSeq: styleOptions.eventSeq
      })
      return
    }

    const targetNode = this.resolveRef(typeof state.ref === 'string' ? state.ref : undefined)
    applyClassNameProps(targetNode, state.className)
    applyStyleProps(targetNode, state.style, styleOptions)
    applyAttrProps(targetNode, state.attr)
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
}
