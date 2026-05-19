import { BaseComponent } from './base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  createComponentRoot,
  resetComponentRoot,
  setComponentRootId
} from './lib'
import { isDomElement } from './dom-component-adapter'
import type { RuntimeComponentUpdateInput } from './types'

type MediaState = {
  id?: unknown
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

/**
 * Checks whether one node can expose media playback methods.
 */
function toMediaNodeLike(nodeRef: unknown): MediaNodeLike | null {
  return typeof nodeRef === 'object' && nodeRef !== null ? (nodeRef as MediaNodeLike) : null
}

/**
 * Implements one simple media component rendered as one video tag.
 */
export class MediaComponent extends BaseComponent implements MediaComponentApi {
  private playbackState: 'playing' | 'paused' = 'paused'

  /**
   * Creates the component root and applies the authored initial state.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as MediaState
    const rootNode = createComponentRoot(this.item, 'video', this.createElementOptions)

    resetComponentRoot(rootNode)
    setComponentRootId(rootNode, this.item.id, state.id)

    applyClassNameProps(rootNode, state.className)
    applyStyleProps(rootNode, state.style)
    applyAttrProps(rootNode, state.attr)

    if (typeof state.src === 'string') {
      this.setMediaSource(rootNode, state.src)
    }

    this.playbackState = 'paused'
    this.setRoot(rootNode)
  }

  /**
   * Applies one resolved runtime action on the media node.
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

    applyStyleProps(this.rootNode, state.style, {
      skipTransitionValues: true
    })
    applyClassNameProps(this.rootNode, state.className)
    applyAttrProps(this.rootNode, state.attr)

    if (state.src !== undefined && typeof state.src === 'string') {
      this.setMediaSource(this.rootNode, state.src)
    }
  }

  /**
   * Starts playback from one target media position.
   */
  seekTo(mediaMs: number): void {
    if (this.rootNode === null) {
      return
    }

    this.setCurrentTimeMs(mediaMs)
  }

  /**
   * Starts media playback without forcing a new seek.
   */
  play(): void {
    if (this.rootNode === null) {
      return
    }

    if (this.playbackState === 'playing') {
      return
    }

    const mediaNode = toMediaNodeLike(this.rootNode)
    this.playbackState = 'playing'
    const playResult = mediaNode?.play?.()
    if (playResult && typeof playResult === 'object' && 'catch' in playResult && typeof playResult.catch === 'function') {
      void playResult.catch(() => undefined)
    }
  }

  /**
   * Pauses playback without forcing a new seek.
   */
  pause(): void {
    if (this.rootNode === null) {
      return
    }

    if (this.playbackState === 'paused') {
      return
    }

    const mediaNode = toMediaNodeLike(this.rootNode)
    this.playbackState = 'paused'
    mediaNode?.pause?.()
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
    const mediaNode = this.rootNode === null ? null : toMediaNodeLike(this.rootNode)
    const currentTimeSeconds = typeof mediaNode?.currentTime === 'number' ? mediaNode.currentTime : 0
    return Math.max(0, currentTimeSeconds * 1000)
  }

  /**
   * Returns the media duration in milliseconds when available.
   */
  getDurationMs(): number | null {
    const mediaNode = this.rootNode === null ? null : toMediaNodeLike(this.rootNode)
    if (typeof mediaNode?.duration !== 'number' || !Number.isFinite(mediaNode.duration)) {
      return null
    }

    return Math.max(0, mediaNode.duration * 1000)
  }

  /**
   * Returns true when the underlying media node is currently paused.
   */
  isPaused(): boolean {
    const mediaNode = this.rootNode === null ? null : toMediaNodeLike(this.rootNode)
    if (typeof mediaNode?.paused === 'boolean') {
      return mediaNode.paused
    }

    return this.playbackState === 'paused'
  }

  /**
   * Applies one source url on the underlying video element.
   */
  private setMediaSource(nodeRef: unknown, src: string): void {
    if (isDomElement(nodeRef) && typeof globalThis.HTMLMediaElement !== 'undefined' && nodeRef instanceof globalThis.HTMLMediaElement) {
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
  private setCurrentTimeMs(mediaMs: number): void {
    const mediaNode = this.rootNode === null ? null : toMediaNodeLike(this.rootNode)
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
