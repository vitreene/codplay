import { AbstractLiveSourceProvider } from './abstract-live-source-provider'
import type { ScrollProgressMetrics } from './scroll-source-types'
import type { ScrollProgressAxis } from './scroll-container-types'

/** Publishes the latest normalized scroll progress without owning DOM reads. */
export class ScrollProgressProvider extends AbstractLiveSourceProvider {
  readonly axis: ScrollProgressAxis
  private readonly publish: (progress: number) => void
  private pendingProgress: number | undefined

  /** Creates one axis-specific provider whose geometry is supplied by its adapter. */
  constructor(options: Readonly<{
    axis?: ScrollProgressAxis
    onProgress: (progress: number) => void
    reportDiagnostic?: ConstructorParameters<typeof AbstractLiveSourceProvider>[0]
  }>) {
    super(options.reportDiagnostic)
    this.axis = options.axis ?? 'block'
    this.publish = options.onProgress
  }

  /** Replaces any queued sample with the latest geometry-derived progress. */
  sample(metrics: ScrollProgressMetrics): void {
    if (!this.isAttached()) return
    this.pendingProgress = calculateScrollProgress(metrics)
  }

  /** Publishes at most one sample, taking the most recent queued value. */
  present(): number | undefined {
    if (!this.isAttached() || this.pendingProgress === undefined) return undefined
    const progress = this.pendingProgress
    this.pendingProgress = undefined
    this.publish(progress)
    return progress
  }

  /** Clears pending geometry when a source detaches. */
  protected override onDetach(): void {
    this.pendingProgress = undefined
  }
}

/** Converts one scroll extent and offset into a finite normalized progress. */
export function calculateScrollProgress(metrics: ScrollProgressMetrics): number {
  const { offset, extent, viewportExtent } = metrics
  if (![offset, extent, viewportExtent].every(Number.isFinite)) return 0
  const scrollableExtent = extent - viewportExtent
  if (scrollableExtent <= 0) return 0
  return Math.min(1, Math.max(0, offset / scrollableExtent))
}
