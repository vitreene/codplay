import { TimeClock, type Clock } from './clock'

/** Payload emitted when the ticker accepts one frame. */
export type TickPayload = {
  prevMs: number
  nowMs: number
  deltaMs: number
  marginMs: number
}

/** Receives one accepted frame payload. */
export type TickHandler = (payload: TickPayload) => void

/** Configuration for the V2 frame ticker. */
export type TickerOptions = {
  clock?: Clock
  intervalMs?: number
  marginMs?: number
  scheduler?: FrameScheduler
  pauseOnDocumentHidden?: boolean
  visibilityController?: VisibilityController
}

/** Public ticker lifecycle contract. */
export type Ticker = {
  start: (onTick: TickHandler) => void
  stop: () => void
  isRunning: () => boolean
}

/** Identifier returned by an injected frame scheduler. */
export type FrameRequestId = number

/** Abstracts requestAnimationFrame for deterministic tests. */
export type FrameScheduler = {
  request: (callback: () => void) => FrameRequestId
  cancel: (requestId: FrameRequestId) => void
}

/** Creates a macrotask scheduler when requestAnimationFrame is unavailable. */
function createMessageChannelScheduler(): FrameScheduler | null {
  if (typeof globalThis.MessageChannel !== 'function') return null

  const channel = new globalThis.MessageChannel()
  const pendingCallbacks = new Map<number, () => void>()
  const queuedRequestIds: number[] = []
  let nextRequestId = 1

  channel.port1.onmessage = () => {
    const requestId = queuedRequestIds.shift()
    if (requestId === undefined) return
    const callback = pendingCallbacks.get(requestId)
    if (callback === undefined) return
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
    },
  }
}

/** Creates the browser or fallback frame scheduler. */
function createFrameScheduler(): FrameScheduler {
  if (
    typeof globalThis.requestAnimationFrame === 'function'
    && typeof globalThis.cancelAnimationFrame === 'function'
  ) {
    return {
      request: (callback) => globalThis.requestAnimationFrame(() => callback()),
      cancel: (requestId) => globalThis.cancelAnimationFrame(requestId),
    }
  }

  const messageChannelScheduler = createMessageChannelScheduler()
  if (messageChannelScheduler !== null) return messageChannelScheduler
  throw new Error('TimeTicker requires requestAnimationFrame or MessageChannel support')
}

/** Abstracts document visibility for deterministic tests. */
export type VisibilityController = {
  isHidden: () => boolean
  subscribe: (onChange: () => void) => () => void
}

/** Creates a visibility controller from the browser document API. */
function createVisibilityController(): VisibilityController | null {
  if (typeof globalThis.document === 'undefined') return null
  const documentRef = globalThis.document
  return {
    isHidden: () => documentRef.hidden,
    subscribe: (onChange) => {
      documentRef.addEventListener('visibilitychange', onChange)
      return () => documentRef.removeEventListener('visibilitychange', onChange)
    },
  }
}

/** Implements an idempotent frame loop backed by a relative clock. */
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

  /** Configures a ticker with deterministic timing dependencies. */
  constructor(options: TickerOptions = {}) {
    this.clock = options.clock ?? new TimeClock()
    this.frameDurationMs = Math.max(1, options.intervalMs ?? 16)
    this.marginMs = options.marginMs ?? 0
    this.scheduler = options.scheduler ?? createFrameScheduler()
    this.pauseOnDocumentHidden = options.pauseOnDocumentHidden ?? true
    this.visibilityController = options.visibilityController ?? createVisibilityController()
  }

  /** Builds and emits one payload from the current clock state. */
  private runTick(onTick: TickHandler): void {
    const nowMs = this.clock.nowMs()
    const prevMs = this.lastTickMs
    const deltaMs = Math.max(0, nowMs - prevMs)
    onTick({ prevMs, nowMs, deltaMs, marginMs: this.marginMs })
    this.lastTickMs = nowMs
  }

  /** Checks whether the next scheduled frame is due. */
  private shouldEmitTick(nowMs: number): boolean {
    return nowMs >= this.scheduledTickMs
  }

  /** Advances the schedule while absorbing frame drift. */
  private updateScheduledTick(nowMs: number): void {
    const frameDeltaMs = nowMs - this.scheduledTickMs
    this.scheduledTickMs += frameDeltaMs < this.frameDurationMs ? this.frameDurationMs : frameDeltaMs
  }

  /** Cancels the pending scheduler request, if any. */
  private cancelScheduledFrame(): void {
    if (this.requestId === null) return
    this.scheduler.cancel(this.requestId)
    this.requestId = null
  }

  /** Resets timing anchors before scheduling a new loop. */
  private resetTimingAnchor(): void {
    this.lastTickMs = this.clock.nowMs()
    this.scheduledTickMs = this.lastTickMs + this.frameDurationMs
  }

  /** Runs one scheduler iteration and queues the next one. */
  private loop = (): void => {
    if (!this.running || this.tickHandler === null) return
    const nowMs = this.clock.nowMs()
    if (this.shouldEmitTick(nowMs)) {
      this.runTick(this.tickHandler)
      this.updateScheduledTick(nowMs)
    }
    this.requestId = this.scheduler.request(this.loop)
  }

  /** Starts the ticker idempotently. */
  start(onTick: TickHandler): void {
    if (this.running) return
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

  /** Stops the ticker idempotently. */
  stop(): void {
    if (!this.running) return
    this.running = false
    this.pausedByVisibility = false
    this.tickHandler = null
    this.cancelScheduledFrame()
    this.detachVisibilityListener()
  }

  /** Returns whether the ticker currently has an active lifecycle. */
  isRunning(): boolean {
    return this.running
  }

  /** Returns whether visibility currently prevents frame scheduling. */
  private isVisibilityPaused(): boolean {
    if (!this.pauseOnDocumentHidden || this.visibilityController === null) return false
    return this.visibilityController.isHidden()
  }

  /** Registers one visibility listener for the active ticker lifecycle. */
  private attachVisibilityListener(): void {
    if (!this.pauseOnDocumentHidden || this.visibilityController === null || this.visibilityUnsubscribe !== null) return
    this.visibilityUnsubscribe = this.visibilityController.subscribe(() => this.handleVisibilityChange())
  }

  /** Removes the visibility listener when the ticker stops. */
  private detachVisibilityListener(): void {
    if (this.visibilityUnsubscribe === null) return
    this.visibilityUnsubscribe()
    this.visibilityUnsubscribe = null
  }

  /** Pauses or resumes scheduling after a visibility transition. */
  private handleVisibilityChange(): void {
    if (!this.running) return
    if (this.isVisibilityPaused()) {
      this.pausedByVisibility = true
      this.cancelScheduledFrame()
      return
    }
    if (!this.pausedByVisibility || this.tickHandler === null) return
    this.pausedByVisibility = false
    this.resetTimingAnchor()
    this.requestId = this.scheduler.request(this.loop)
  }
}
