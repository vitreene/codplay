import {
  buildMotionGraph,
  collectMotionPresentationItemIds,
  resolvePresentationFrame,
  type LayoutSnapshot,
  type MotionBoundary,
  type MotionGraph,
} from '../motion'
import { HtmlMotionPresentationHost } from './html-motion-presentation-host'

/** Owns one immutable captured graph and one absolute-time HTML presentation. */
export class HtmlMotionSystem {
  private graph: MotionGraph = buildMotionGraph([])
  private boundaries: readonly MotionBoundary[] = []
  private dirty = true
  private initialized = false
  private readonly host: HtmlMotionPresentationHost
  private readonly captureCurrent: ((timeMs: number, itemIds: ReadonlySet<string>) => LayoutSnapshot) | undefined
  private readonly resolveSourceRevision: ((itemId: string) => string | undefined) | undefined

  /** Creates one motion system from already captured geometry boundaries. */
  constructor(options: Readonly<{
    host: HtmlMotionPresentationHost
    /** Captures only the active item closure from the visible author nodes. */
    captureCurrent?: (timeMs: number, itemIds: ReadonlySet<string>) => LayoutSnapshot
    /** Resolves the current author materialization revision for overlay reuse. */
    resolveSourceRevision?: (itemId: string) => string | undefined
    boundaries?: readonly MotionBoundary[]
  }>) {
    this.host = options.host
    this.captureCurrent = options.captureCurrent
    this.resolveSourceRevision = options.resolveSourceRevision
    this.boundaries = options.boundaries ?? []
  }

  /** Builds the graph before the first animated presentation. */
  initialize(): void {
    this.rebuild()
    this.initialized = true
  }

  /** Resolves and commits the same frame regardless of the caller transport. */
  present(timeMs: number): void {
    if (!this.initialized) return
    if (this.dirty) this.rebuild()
    this.host.prepareNaturalCapture()
    const layout = this.captureCurrent?.(
      timeMs,
      collectMotionPresentationItemIds(this.graph, timeMs),
    ) ?? createEmptySnapshot(timeMs)
    this.host.commit(resolvePresentationFrame(this.graph, layout, timeMs), this.resolveSourceRevision)
  }

  /** Prepares the visible author nodes before the runner captures geometry. */
  prepareGeometryCapture(): void {
    this.host.prepareNaturalCapture()
  }

  /** Replaces the immutable boundary data after an explicit geometry capture. */
  setBoundaries(boundaries: readonly MotionBoundary[]): void {
    this.boundaries = Object.freeze([...boundaries])
    this.dirty = true
  }

  /** Invalidates the graph after a new boundary capture or host geometry change. */
  invalidate(): void {
    this.dirty = true
  }

  /** Releases all HTML presentation resources. */
  destroy(): void {
    this.host.destroy()
    this.initialized = false
  }

  /** Rebuilds the pure graph from the latest captured boundary data. */
  private rebuild(): void {
    this.graph = buildMotionGraph(this.boundaries)
    this.dirty = false
  }
}

/** Creates a data-only empty snapshot for lightweight DOM and structural tests. */
function createEmptySnapshot(timeMs: number): LayoutSnapshot {
  return Object.freeze({
    timeMs,
    revision: `${timeMs}:empty`,
    items: new Map(),
  })
}
