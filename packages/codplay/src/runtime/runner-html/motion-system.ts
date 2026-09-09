import {
  buildNaturalLayoutTimeline,
  buildMotionGraph,
  resolveNaturalLayout,
  resolvePresentationFrame,
  type MotionBoundary,
  type MotionGraph,
  type NaturalLayoutTimeline,
  type LayoutSnapshot,
  type MotionResetTimesByItem,
  type PresentationFrame,
} from '../motion'
import { HtmlMotionPresentationHost } from './motion-presentation-host'

/** Owns one immutable captured graph and one absolute-time HTML presentation. */
export class HtmlMotionSystem {
  private graph: MotionGraph = buildMotionGraph([])
  private boundaries: readonly MotionBoundary[] = []
  private naturalLayoutTimeline: NaturalLayoutTimeline = buildNaturalLayoutTimeline([])
  private resetTimesByItem: MotionResetTimesByItem = new Map()
  private currentFrame: PresentationFrame | undefined
  private initialized = false
  private readonly host: HtmlMotionPresentationHost
  private readonly resolveSourceRevision: ((itemId: string) => string | undefined) | undefined

  /** Creates one motion system from already captured geometry boundaries. */
  constructor(options: Readonly<{
    host: HtmlMotionPresentationHost
    /** Resolves the current author materialization revision for overlay reuse. */
    resolveSourceRevision?: (itemId: string) => string | undefined
    boundaries?: readonly MotionBoundary[]
  }>) {
    this.host = options.host
    this.resolveSourceRevision = options.resolveSourceRevision
    this.boundaries = options.boundaries ?? []
  }

  /** Builds the graph before the first animated presentation. */
  initialize(): void {
    this.rebuild()
    this.initialized = true
  }

  /** Resolves and commits the same frame regardless of the caller transport. */
  present(timeMs: number, naturalLayout?: LayoutSnapshot): void {
    if (!this.initialized) return
    const layout = naturalLayout ?? resolveNaturalLayout(this.naturalLayoutTimeline, timeMs)
    const frame = resolvePresentationFrame(this.graph, layout, timeMs)
    this.host.commit(frame, this.resolveSourceRevision, layout)
    this.currentFrame = frame
  }

  /** Returns the latest numeric frame committed by this runtime presenter. */
  getFrame(): PresentationFrame | undefined {
    return this.currentFrame
  }

  /** Returns the end of the segment currently presented for one item. */
  resolveActiveMotionEndAt(itemId: string, timeMs: number): number | undefined {
    const presentation = this.currentFrame?.items.get(itemId)
    const segmentId = presentation?.activeSegmentId
    if (segmentId === undefined) return undefined
    const segment = this.graph.tracksByItem.get(itemId)?.segments.find((candidate) => candidate.id === segmentId)
    if (segment === undefined || timeMs < segment.startAt || timeMs >= segment.endAt) return undefined
    return segment.endAt
  }

  /** Prepares the visible author nodes before the runner captures geometry. */
  prepareGeometryCapture(): void {
    this.host.prepareNaturalCapture()
  }

  /** Disables authored CSS transitions for one atomic seek transaction. */
  prepareSeek(): void {
    this.host.prepareSeek?.()
  }

  /** Restores authored CSS transitions after one seek transaction. */
  completeSeek(): void {
    this.host.completeSeek?.()
  }

  /** Replaces the immutable boundary data after an explicit geometry capture. */
  setBoundaries(boundaries: readonly MotionBoundary[]): void {
    this.commit(boundaries, this.resetTimesByItem)
  }

  /** Replaces the logical reset barriers used by the immutable motion graph. */
  setResetTimesByItem(resetTimesByItem: MotionResetTimesByItem): void {
    this.commit(this.boundaries, resetTimesByItem)
  }

  /** Commits boundaries and reset partitioning as one immutable graph update. */
  commit(
    boundaries: readonly MotionBoundary[],
    resetTimesByItem: MotionResetTimesByItem,
  ): void {
    this.boundaries = Object.freeze([...boundaries])
    this.resetTimesByItem = resetTimesByItem
    if (this.initialized) this.rebuild()
  }

  /** Removes selected transient HTML resources before a story reset is shown. */
  clearTransientPresentation(itemIds?: ReadonlySet<string>): void {
    this.host.clearTransientPresentation(itemIds)
    this.currentFrame = undefined
  }

  /** Invalidates the graph after a new boundary capture or host geometry change. */
  invalidate(): void {
    if (this.initialized) this.rebuild()
  }

  /** Releases all HTML presentation resources. */
  destroy(): void {
    this.host.destroy()
    this.initialized = false
    this.currentFrame = undefined
  }

  /** Rebuilds the pure graph from the latest captured boundary data. */
  private rebuild(): void {
    this.graph = buildMotionGraph(this.boundaries, {
      resetTimesByItem: this.resetTimesByItem,
    })
    this.naturalLayoutTimeline = buildNaturalLayoutTimeline(this.boundaries)
  }
}
