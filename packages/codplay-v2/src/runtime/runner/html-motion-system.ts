import {
  buildMotionGraph,
  resolvePresentationFrame,
  type LayoutSnapshot,
  type MotionBoundary,
  type MotionGraph,
  type MotionIntent,
  type ScheduledMotionIntent,
} from '../motion'
import { HtmlMotionPresentationHost } from './html-motion-presentation-host'

/** Owns immutable motion planning and one absolute-time HTML presentation. */
export class HtmlMotionSystem {
  private graph: MotionGraph = buildMotionGraph([])
  private dirty = true
  private initialized = false
  private readonly host: HtmlMotionPresentationHost
  private readonly measureAt: (timeMs: number) => LayoutSnapshot
  private readonly measureBefore: (timeMs: number) => LayoutSnapshot
  private readonly getIntents: () => readonly ScheduledMotionIntent[]
  private readonly getScheduleRevision: (() => number) | undefined
  private readonly includePersistOnly: () => boolean
  private readonly liveFirstByTime = new Map<number, LayoutSnapshot>()
  private intentSignature = ''
  private scheduleRevision: number | undefined
  private scheduleIncludesPersistOnly = true

  /** Creates one motion system from a schedule provider and isolated measurer. */
  constructor(options: Readonly<{
    host: HtmlMotionPresentationHost
    measureAt: (timeMs: number) => LayoutSnapshot
    measureBefore: (timeMs: number) => LayoutSnapshot
    intents?: readonly ScheduledMotionIntent[]
    getIntents?: () => readonly ScheduledMotionIntent[]
    /** Cheap invalidation token for dynamic schedules; it must change when intents change. */
    getScheduleRevision?: () => number
    includePersistOnly?: () => boolean
  }>) {
    this.host = options.host
    this.measureAt = options.measureAt
    this.measureBefore = options.measureBefore
    this.getIntents = options.getIntents ?? (() => options.intents ?? [])
    this.getScheduleRevision = options.getScheduleRevision
    this.includePersistOnly = options.includePersistOnly ?? (() => true)
  }

  /** Builds every compiled boundary before the first animated presentation. */
  initialize(): void {
    this.rebuild()
    this.initialized = true
  }

  /** Resolves and commits the same frame regardless of the caller transport. */
  present(timeMs: number): void {
    if (!this.initialized) return
    if (this.getScheduleRevision === undefined) {
      const intents = this.getIntents()
      const nextSignature = createIntentSignature(intents, this.includePersistOnly())
      if (nextSignature !== this.intentSignature) this.dirty = true
    } else {
      const nextRevision = this.getScheduleRevision()
      const includePersistOnly = this.includePersistOnly()
      if (nextRevision !== this.scheduleRevision
        || includePersistOnly !== this.scheduleIncludesPersistOnly) {
        this.dirty = true
      }
    }
    if (this.dirty) this.rebuild()
    const layout = this.measureAt(timeMs)
    this.host.commit(resolvePresentationFrame(this.graph, layout, timeMs))
  }

  /** Invalidates host-dependent endpoints while preserving the compiled schedule. */
  invalidate(): void {
    this.dirty = true
  }

  /**
   * Retains the visible FIRST layout of one live HTML boundary.
   *
   * A continuous source can leave an element in a transient pose that the
   * isolated logical measurer cannot reconstruct. The first snapshot observed
   * at the live `endEmit` boundary is therefore the source of the release
   * handoff. It is a presentation-only value and is cleared before a seek so
   * that replay uses the persist-only source-to-target boundary instead.
   */
  setLiveFirstLayout(snapshot: LayoutSnapshot): void {
    // A second capture can close at the same logical time as the first one
    // (the player may be paused while the author performs several drops).
    // The latest snapshot is the source of the latest live move; retaining
    // the first snapshot would make every subsequent drop start there.
    this.liveFirstByTime.set(snapshot.timeMs, snapshot)
    this.dirty = true
  }

  /** Drops live capture handoff snapshots before a historical reconstruction. */
  clearLiveFirstLayouts(): void {
    if (this.liveFirstByTime.size === 0) return
    this.liveFirstByTime.clear()
    this.dirty = true
  }

  /** Releases all HTML materialization resources. */
  destroy(): void {
    this.host.destroy()
    this.liveFirstByTime.clear()
    this.initialized = false
  }

  /** Re-measures immediate before/after states and rebuilds item tracks. */
  private rebuild(): void {
    const intents = this.getIntents()
    const includePersistOnly = this.includePersistOnly()
    if (this.getScheduleRevision === undefined) {
      this.intentSignature = createIntentSignature(intents, includePersistOnly)
    } else {
      this.scheduleRevision = this.getScheduleRevision()
      this.scheduleIncludesPersistOnly = includePersistOnly
    }
    const grouped = groupIntents(intents)
    const boundaries: MotionBoundary[] = []
    for (const [timeMs, scheduledIntents] of grouped) {
      const before = !includePersistOnly
        ? this.liveFirstByTime.get(timeMs) ?? this.measureBefore(timeMs)
        : this.measureBefore(timeMs)
      const after = this.measureAt(timeMs)
      const intents: MotionIntent[] = scheduledIntents.map((intent) => Object.freeze({
        id: intent.id,
        itemId: intent.itemId,
        startAt: intent.startAt,
        duration: intent.duration,
        ease: intent.ease,
        presentationMode: intent.presentationMode,
        ...(intent.path === undefined ? {} : { path: intent.path }),
      }))
      boundaries.push(Object.freeze({
        id: `boundary:${timeMs}:${intents.map((intent) => intent.id).join(',')}`,
        timeMs,
        before,
        after,
        intents: Object.freeze(intents),
      }))
    }
    this.graph = buildMotionGraph(boundaries)
    this.dirty = false
  }
}

/** Detects dynamic intent changes for standalone callers without a revision token. */
function createIntentSignature(intents: readonly ScheduledMotionIntent[], includePersistOnly: boolean): string {
  return JSON.stringify([includePersistOnly, ...intents.map((intent) => [
    intent.id,
    intent.itemId,
    intent.startAt,
    intent.duration,
    intent.ease,
    intent.presentationMode,
    intent.path,
  ])])
}

/** Groups simultaneous direct moves into one structural measurement boundary. */
function groupIntents(
  intents: readonly ScheduledMotionIntent[],
): ReadonlyMap<number, readonly ScheduledMotionIntent[]> {
  const grouped = new Map<number, ScheduledMotionIntent[]>()
  for (const intent of intents) {
    const entries = grouped.get(intent.startAt) ?? []
    entries.push(intent)
    grouped.set(intent.startAt, entries)
  }
  return new Map([...grouped].sort(([left], [right]) => left - right))
}
