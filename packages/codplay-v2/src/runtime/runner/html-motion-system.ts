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
  private readonly intents: readonly ScheduledMotionIntent[]

  /** Creates one motion system from the compiled schedule and isolated measurer. */
  constructor(options: Readonly<{
    host: HtmlMotionPresentationHost
    measureAt: (timeMs: number) => LayoutSnapshot
    measureBefore: (timeMs: number) => LayoutSnapshot
    intents: readonly ScheduledMotionIntent[]
  }>) {
    this.host = options.host
    this.measureAt = options.measureAt
    this.measureBefore = options.measureBefore
    this.intents = options.intents
  }

  /** Builds every compiled boundary before the first animated presentation. */
  initialize(): void {
    this.rebuild()
    this.initialized = true
  }

  /** Resolves and commits the same frame regardless of the caller transport. */
  present(timeMs: number): void {
    if (!this.initialized) return
    if (this.dirty) this.rebuild()
    const layout = this.measureAt(timeMs)
    this.host.commit(resolvePresentationFrame(this.graph, layout, timeMs))
  }

  /** Invalidates host-dependent endpoints while preserving the compiled schedule. */
  invalidate(): void {
    this.dirty = true
  }

  /** Releases all HTML projection resources. */
  destroy(): void {
    this.host.destroy()
    this.initialized = false
  }

  /** Re-measures immediate before/after states and rebuilds item tracks. */
  private rebuild(): void {
    const grouped = groupIntents(this.intents)
    const boundaries: MotionBoundary[] = []
    for (const [timeMs, scheduledIntents] of grouped) {
      const before = this.measureBefore(timeMs)
      const after = this.measureAt(timeMs)
      const intents: MotionIntent[] = scheduledIntents.map((intent) => Object.freeze({
        id: intent.id,
        itemId: intent.itemId,
        startAt: intent.startAt,
        duration: intent.duration,
        ease: intent.ease,
        projectionMode: intent.projectionMode,
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
