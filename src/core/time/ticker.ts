import { TimeClock, type Clock } from './clock'

export type TickPayload = {
  prevMs: number
  nowMs: number
  deltaMs: number
  marginMs: number
}

export type TickHandler = (payload: TickPayload) => void

export type TickerOptions = {
  clock?: Clock
  intervalMs?: number
  marginMs?: number
  scheduler?: FrameScheduler
  pauseOnDocumentHidden?: boolean
  visibilityController?: VisibilityController
}

export type Ticker = {
  start: (onTick: TickHandler) => void
  stop: () => void
  isRunning: () => boolean
}

export type FrameRequestId = number

export type FrameScheduler = {
  request: (callback: () => void) => FrameRequestId
  cancel: (requestId: FrameRequestId) => void
}

/**
 * Creates one macrotask-based frame scheduler when requestAnimationFrame is unavailable.
 */
function createMessageChannelScheduler(): FrameScheduler | null {
  if (typeof globalThis.MessageChannel !== 'function') {
    return null
  }

  const channel = new globalThis.MessageChannel()
  const pendingCallbacks = new Map<number, () => void>()
  const queuedRequestIds: number[] = []
  let nextRequestId = 1

  channel.port1.onmessage = () => {
    const requestId = queuedRequestIds.shift()
    if (requestId === undefined) {
      return
    }

    const callback = pendingCallbacks.get(requestId)
    if (callback === undefined) {
      return
    }

    pendingCallbacks.delete(requestId)
    callback()
  }

  return {
    request: (callback) => {
      const requestId = nextRequestId
      nextRequestId += 1
      pendingCallbacks.set(requestId, callback)
      queuedRequestIds.push(requestId)
      channel.port2.postMessage(requestId)
      return requestId
    },
    cancel: (requestId) => {
      pendingCallbacks.delete(requestId)
    }
  }
}

export type VisibilityController = {
  isHidden: () => boolean
  subscribe: (onChange: () => void) => () => void
}

/**
 * Creates a frame scheduler inspired by animation engine main loops.
 */
function createFrameScheduler(): FrameScheduler {
  if (
    typeof globalThis.requestAnimationFrame === 'function' &&
    typeof globalThis.cancelAnimationFrame === 'function'
  ) {
    return {
      request: (callback) => globalThis.requestAnimationFrame(() => callback()),
      cancel: (requestId) => globalThis.cancelAnimationFrame(requestId)
    }
  }

  const messageChannelScheduler = createMessageChannelScheduler()
  if (messageChannelScheduler !== null) {
    return messageChannelScheduler
  }

  throw new Error('TimeTicker requires requestAnimationFrame or MessageChannel support')
}

/**
 * Creates a visibility controller from the browser document API.
 */
function createVisibilityController(): VisibilityController | null {
  if (typeof globalThis.document === 'undefined') {
    return null
  }

  const documentRef = globalThis.document

  return {
    isHidden: () => documentRef.hidden,
    subscribe: (onChange) => {
      documentRef.addEventListener('visibilitychange', onChange)
      return () => documentRef.removeEventListener('visibilitychange', onChange)
    }
  }
}

/**
 * Implements an idempotent ticker loop backed by a clock.
 */
export class TimeTicker implements Ticker {
  private readonly clock: Clock
  private readonly frameDurationMs: number
  private readonly marginMs: number
  private readonly scheduler: FrameScheduler

  private requestId: FrameRequestId | null = null
  private running = false
  private lastTickMs = 0
  private scheduledTickMs = 0
  private tickHandler: TickHandler | null = null

  private pausedByVisibility = false
  private readonly pauseOnDocumentHidden: boolean
  private readonly visibilityController: VisibilityController | null
  private visibilityUnsubscribe: (() => void) | null = null

  /**
   * Configures the ticker instance with deterministic defaults.
   */
  constructor(options: TickerOptions = {}) {
    this.clock = options.clock ?? new TimeClock()
    this.frameDurationMs = Math.max(1, options.intervalMs ?? 16)
    this.marginMs = options.marginMs ?? 0
    this.scheduler = options.scheduler ?? createFrameScheduler()
    this.pauseOnDocumentHidden = options.pauseOnDocumentHidden ?? true
    this.visibilityController = options.visibilityController ?? createVisibilityController()
  }

  /**
   * Builds and emits one tick payload from the current clock state.
   */
  private runTick(onTick: TickHandler): void {
    const nowMs = this.clock.nowMs()
    const prevMs = this.lastTickMs
    const deltaMs = Math.max(0, nowMs - prevMs)

    onTick({ prevMs, nowMs, deltaMs, marginMs: this.marginMs })
    this.lastTickMs = nowMs
  }

  /**
   * Evaluates whether enough time elapsed to produce a new tick.
   */
  private shouldEmitTick(nowMs: number): boolean {
    return nowMs >= this.scheduledTickMs
  }

  /**
   * Updates the next scheduled tick time while absorbing frame drift.
   */
  private updateScheduledTick(nowMs: number): void {
    const frameDeltaMs = nowMs - this.scheduledTickMs
    this.scheduledTickMs += frameDeltaMs < this.frameDurationMs ? this.frameDurationMs : frameDeltaMs
  }

  /**
   * Cancels the currently scheduled frame request when present.
   */
  private cancelScheduledFrame(): void {
    if (this.requestId === null) {
      return
    }

    this.scheduler.cancel(this.requestId)
    this.requestId = null
  }

  /**
   * Resets timing anchors before scheduling a fresh loop.
   */
  private resetTimingAnchor(): void {
    this.lastTickMs = this.clock.nowMs()
    this.scheduledTickMs = this.lastTickMs + this.frameDurationMs
  }

  /**
   * Runs one scheduler loop iteration and re-queues the next frame.
   */
  private loop = (): void => {
    if (!this.running || this.tickHandler === null) {
      return
    }

    const nowMs = this.clock.nowMs()

    if (this.shouldEmitTick(nowMs)) {
      this.runTick(this.tickHandler)
      this.updateScheduledTick(nowMs)
    }

    this.requestId = this.scheduler.request(this.loop)
  }

  /**
   * Starts the ticker loop with idempotent behavior.
   */
  start(onTick: TickHandler): void {
    if (this.running) {
      return
    }

    this.running = true
    this.pausedByVisibility = false
    this.tickHandler = onTick
    this.attachVisibilityListener()

    if (this.isVisibilityPaused()) {
      this.pausedByVisibility = true
      return
    }

    this.resetTimingAnchor()
    this.requestId = this.scheduler.request(this.loop)
  }

  /**
   * Stops the ticker loop with idempotent behavior.
   */
  stop(): void {
    if (!this.running) {
      return
    }

    this.running = false
    this.pausedByVisibility = false
    this.tickHandler = null
    this.cancelScheduledFrame()
    this.detachVisibilityListener()
  }

  /**
   * Returns whether the ticker currently runs.
   */
  isRunning(): boolean {
    return this.running
  }

  /**
   * Computes whether ticking should pause because the document is hidden.
   */
  private isVisibilityPaused(): boolean {
    if (!this.pauseOnDocumentHidden || this.visibilityController === null) {
      return false
    }

    return this.visibilityController.isHidden()
  }

  /**
   * Registers visibility listeners once while the ticker is active.
   */
  private attachVisibilityListener(): void {
    if (!this.pauseOnDocumentHidden || this.visibilityController === null || this.visibilityUnsubscribe !== null) {
      return
    }

    this.visibilityUnsubscribe = this.visibilityController.subscribe(() => {
      this.handleVisibilityChange()
    })
  }

  /**
   * Removes visibility listeners when the ticker stops.
   */
  private detachVisibilityListener(): void {
    if (this.visibilityUnsubscribe === null) {
      return
    }

    this.visibilityUnsubscribe()
    this.visibilityUnsubscribe = null
  }

  /**
   * Reacts to document visibility changes while preserving time continuity.
   */
  private handleVisibilityChange(): void {
    if (!this.running) {
      return
    }

    if (this.isVisibilityPaused()) {
      this.pausedByVisibility = true
      this.cancelScheduledFrame()
      return
    }

    if (!this.pausedByVisibility || this.tickHandler === null) {
      return
    }

    this.pausedByVisibility = false
    this.resetTimingAnchor()
    this.requestId = this.scheduler.request(this.loop)
  }
}
