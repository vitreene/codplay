import {
  buildNaturalLayoutTimeline,
  buildMotionGraph,
  resolveNaturalLayout,
  resolvePresentationFrame,
  type MotionBoundary,
  type MotionGraph,
  type NaturalLayoutTimeline,
  type LayoutSnapshot,
  type PresentationFrame,
} from '../motion'
import { HtmlMotionPresentationHost } from './motion-presentation-host'

/** Owns one immutable captured graph and one absolute-time HTML presentation. */
export class HtmlMotionSystem {
  private graph: MotionGraph = buildMotionGraph([])
  private boundaries: readonly MotionBoundary[] = []
  private naturalLayoutTimeline: NaturalLayoutTimeline = buildNaturalLayoutTimeline([])
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
    this.boundaries = Object.freeze([...boundaries])
    if (this.initialized) this.rebuild()
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
    this.graph = buildMotionGraph(this.boundaries)
    this.naturalLayoutTimeline = buildNaturalLayoutTimeline(this.boundaries)
  }
}
