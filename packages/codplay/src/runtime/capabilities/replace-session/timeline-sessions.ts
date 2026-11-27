import type {
  ComponentAnimation,
  ReplaceComponentSurface,
  ReplacePresentationSession,
} from '../../components'
import type {
  RuntimeComponentUpdateContext,
  RuntimeModuleServiceContext,
  RuntimeModuleServiceSeekHandle,
} from '../../engine'
import type { SolvedScene } from '../../player/pipeline/types'
import { ReplaceSeekRequirements, type ReplaceSeekOccurrenceCollector } from './seek-requirements'

/** One player-clocked replace session retained for one component. */
export type ReplaceTimelineSession = {
  key: string
  session: ReplacePresentationSession
  animation?: ComponentAnimation
}

/** Resolves the HTML replace surface of one component, when the runtime exposes surfaces. */
export function createReplaceSurfaceResolver(
  context: RuntimeModuleServiceContext,
): (componentId: string) => ReplaceComponentSurface | undefined {
  return (componentId) => context.componentSurfaces?.getReplaceSurface?.(componentId)
}

/**
 * Owns the player-clocked sessions of one replace module: at most one session
 * per component, the occurrences already handled, and the seek selection.
 */
export class ReplaceTimelineSessions<Entry extends ReplaceTimelineSession = ReplaceTimelineSession> {
  private readonly entries = new Map<string, Entry>()
  private readonly handled = new Map<string, string>()
  private readonly seekRequirements: ReplaceSeekRequirements
  private readonly onCancel: ((entry: Entry) => void) | undefined
  private nextSessionId = 1

  /** Creates the session owner of one module; `onCancel` releases module-owned waits. */
  constructor(collect: ReplaceSeekOccurrenceCollector, onCancel?: (entry: Entry) => void) {
    this.seekRequirements = new ReplaceSeekRequirements(collect)
    this.onCancel = onCancel
  }

  /** Returns the session currently retained for one component. */
  get(componentId: string): Entry | undefined {
    return this.entries.get(componentId)
  }

  /** Retains the session just opened for one occurrence and marks it handled. */
  open(componentId: string, entry: Entry): void {
    this.handled.set(componentId, entry.key)
    this.entries.set(componentId, entry)
  }

  /** Iterates the retained sessions by component. */
  entriesByComponent(): IterableIterator<[string, Entry]> {
    return this.entries.entries()
  }

  /** Returns a fresh session number used in animation identifiers. */
  nextId(): number {
    const id = this.nextSessionId
    this.nextSessionId += 1
    return id
  }

  /** Cancels one component session and forgets it. */
  cancel(componentId: string): void {
    const entry = this.entries.get(componentId)
    if (entry === undefined) return
    this.onCancel?.(entry)
    entry.session.cancel()
    this.entries.delete(componentId)
  }

  /** Forgets a session that finished by itself, unless a newer one replaced it. */
  release(componentId: string, session: ReplacePresentationSession): void {
    if (this.entries.get(componentId)?.session === session) this.entries.delete(componentId)
  }

  /** Reports whether one occurrence already had its session, or was skipped. */
  isHandled(componentId: string, key: string): boolean {
    return this.handled.get(componentId) === key
  }

  /** Marks one occurrence handled without opening a session. */
  markHandled(componentId: string, key: string): void {
    this.cancel(componentId)
    this.handled.set(componentId, key)
  }

  /** Forgets the occurrence handled for one component. */
  forget(componentId: string): void {
    this.cancel(componentId)
    this.handled.delete(componentId)
  }

  /**
   * Applies the rules shared by every replace module before an update and
   * reports whether the occurrence needs a new session.
   */
  needsSession(update: RuntimeComponentUpdateContext, key: string | undefined): boolean {
    const componentId = update.componentId
    if (update.phase === 'geometry-capture') {
      if (key === undefined) this.forget(componentId)
      else this.markHandled(componentId, key)
      return false
    }
    if (key === undefined) {
      this.forget(componentId)
      return false
    }
    const active = this.entries.get(componentId)
    if (active?.key === key) {
      active.session.reflow?.()
      return false
    }
    if (this.handled.get(componentId) === key) return false
    if (this.seekRequirements.skips(update, key)) {
      this.markHandled(componentId, key)
      return false
    }
    return true
  }

  /**
   * Samples the interrupted session at the update time, then captures it. Play
   * updates a component before sampling its animations and Seek samples first:
   * both then capture the same composition.
   */
  captureInterrupted(update: RuntimeComponentUpdateContext): unknown {
    this.entries.get(update.componentId)?.animation?.sample(update.timeMs)?.apply()
    return this.entries.get(update.componentId)?.session.captureCurrent?.()
  }

  /** Returns the session to register after an update, when it belongs to this occurrence. */
  activeFor(update: RuntimeComponentUpdateContext, key: string | undefined): Entry | undefined {
    if (update.phase === 'geometry-capture' || key === undefined) return undefined
    const active = this.entries.get(update.componentId)
    return active?.key === key ? active : undefined
  }

  /** Stages the sessions a seek target needs. */
  prepareSeek(scene: SolvedScene): RuntimeModuleServiceSeekHandle {
    return this.seekRequirements.prepare(scene)
  }

  /** Ends the seek selection once its target has been presented. */
  endSeek(): void {
    this.seekRequirements.clear()
  }

  /** Cancels every session before the player reconstructs a seek target. */
  cancelAll(): void {
    for (const componentId of [...this.entries.keys()]) this.cancel(componentId)
    this.handled.clear()
  }

  /** Releases every session and resets this owner. */
  destroy(): void {
    this.cancelAll()
    this.seekRequirements.clear()
    this.nextSessionId = 1
  }
}

/**
 * Creates the player-clocked stream of one replace session: a normalized
 * progress between `startAt` and its end, then one completion sample.
 */
export function createPlayerReplaceAnimation(options: Readonly<{
  id: string
  startAt: number
  duration: number
  sample: (progress: number) => void
  complete: () => void
  /** Sample key; defaults to the progress. */
  value?: (progress: number) => unknown
}>): ComponentAnimation {
  const endAt = options.startAt + options.duration
  return {
    id: options.id,
    startAt: options.startAt,
    endAt,
    sample: (timeMs) => {
      if (timeMs < options.startAt) return undefined
      if (timeMs >= endAt) return { value: 'complete', apply: options.complete }
      const progress = endAt === options.startAt ? 1 : (timeMs - options.startAt) / (endAt - options.startAt)
      const normalized = Math.min(1, Math.max(0, progress))
      return {
        value: options.value?.(normalized) ?? normalized,
        apply: () => options.sample(normalized),
      }
    },
  }
}
