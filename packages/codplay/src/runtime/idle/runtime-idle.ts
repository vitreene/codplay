import type { CompiledEventime, CompiledRecord } from '../../scene/compiled'
import { cloneValue } from '../../shared'

/** Default inactivity duration used when no idle duration is configured. */
export const DEFAULT_RUNTIME_IDLE_DURATION_MS = 30_000

/** Runtime event emitted by default when the player becomes idle. */
export const DEFAULT_RUNTIME_IDLE_EVENT_NAME = 'sequence:end' as const

/** Event descriptor emitted when one idle threshold is reached. */
export type RuntimeIdleEvent = Readonly<{
  name: string
  data?: CompiledRecord
  visibility?: CompiledEventime['visibility']
  storyId?: string
}>

/** Public configuration accepted by an engine or one player. */
export type RuntimeIdleOptions = false | Readonly<{
  durationMs?: number
  event?: RuntimeIdleEvent
}>

/** Configuration normalized once before a player starts using the monitor. */
export type ResolvedRuntimeIdleOptions = Readonly<{
  durationMs: number
  event: RuntimeIdleEvent
}>

/** Resolves defaults and validates one idle configuration. */
export function resolveRuntimeIdleOptions(
  options?: RuntimeIdleOptions | ResolvedRuntimeIdleOptions,
): ResolvedRuntimeIdleOptions | false {
  if (options === false) return false

  const durationMs = options?.durationMs ?? DEFAULT_RUNTIME_IDLE_DURATION_MS
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Runtime idle durationMs must be a finite positive number.')
  }

  const event = options?.event ?? { name: DEFAULT_RUNTIME_IDLE_EVENT_NAME }
  if (event.name.trim().length === 0) {
    throw new Error('Runtime idle event name must not be empty.')
  }
  if (event.visibility !== undefined
    && event.visibility !== 'story'
    && event.visibility !== 'scene'
    && event.visibility !== 'public') {
    throw new Error(`Runtime idle event visibility is invalid: ${event.visibility}`)
  }
  if (event.visibility === 'story' && event.storyId === undefined) {
    throw new Error('Runtime idle story-visible event requires storyId.')
  }
  if (event.visibility !== 'story' && event.storyId !== undefined) {
    throw new Error('Runtime idle storyId is only valid for story-visible events.')
  }

  return {
    durationMs,
    event: {
      name: event.name,
      data: event.data === undefined ? undefined : cloneValue(event.data),
      visibility: event.visibility,
      storyId: event.storyId,
    },
  }
}

/** Tracks one player's active inactivity period without creating a timer. */
export class RuntimeIdleMonitor {
  private elapsedMs = 0
  private thresholdReached = false
  private readonly options: ResolvedRuntimeIdleOptions | false

  /** Creates a monitor around one already normalized configuration. */
  constructor(options: ResolvedRuntimeIdleOptions | false) {
    this.options = options
  }

  /** Starts a new inactivity period and permits one future notification. */
  reset(): void {
    this.elapsedMs = 0
    this.thresholdReached = false
  }

  /** Advances the period and reports exactly once when the threshold is crossed. */
  advance(deltaMs: number): boolean {
    if (this.options === false || this.thresholdReached || deltaMs <= 0) return false
    this.elapsedMs += deltaMs
    if (this.elapsedMs < this.options.durationMs) return false
    this.thresholdReached = true
    return true
  }

  /** Returns the event associated with the threshold, or nothing when disabled. */
  getEvent(): RuntimeIdleEvent | undefined {
    return this.options === false ? undefined : this.options.event
  }
}
