import type { RuntimeCaptureSourcePort, RuntimeCaptureSourceSession } from '../../capture'
import { resolveScrollProgressAxis, type ScrollProgressAxis } from '../../components/scroll-container'
import type { HtmlSourceAdapter, HtmlSourceAdapterContext } from '../source-adapter'
import type { ScrollProgressMetrics } from './scroll-source-types'

const SCROLL_SOURCE = 'scroll'

type ScrollCaptureActivity = {
  sessions: RuntimeCaptureSourceSession[]
}

/**
 * HTML source of `emit.scroll`: reads the progress of each scroll-container that declares a
 * scroll capture and feeds it to the shared capture circuit, like the pointer source.
 */
export class HtmlScrollProgressSource implements HtmlSourceAdapter {
  private readonly context: HtmlSourceAdapterContext
  private readonly captureSources: RuntimeCaptureSourcePort
  private bindings: readonly ScrollProgressBinding[] = []

  /** Keeps the host context and the player-scoped capture port. */
  constructor(context: HtmlSourceAdapterContext, captureSources: RuntimeCaptureSourcePort) {
    this.context = context
    this.captureSources = captureSources
  }

  /** Binds every materialized scroll-container that declares a scroll capture. */
  attach(): void {
    const bindings: ScrollProgressBinding[] = []
    for (const [storyId, story] of Object.entries(this.context.compiledScene.scene.stories)) {
      for (const perso of story.persos) {
        if (perso.type !== 'scroll-container') continue
        if (!this.captureSources.hasRules({ storyId, persoId: perso.id, source: SCROLL_SOURCE })) continue
        const element = this.context.resolvePersoElement(`${storyId}:${perso.id}`)
        if (element === undefined) continue
        bindings.push(new ScrollProgressBinding({
          element,
          axis: resolveScrollProgressAxis(perso.initial),
          storyId,
          persoId: perso.id,
          captureSources: this.captureSources,
        }))
      }
    }
    this.bindings = bindings
    for (const binding of bindings) binding.attach()
  }

  /** Cancels open sessions while the player reconstructs a seek target. */
  beforeSeek(): void {
    for (const binding of this.bindings) binding.suspend()
  }

  /** Resumes sampling after the seek presentation. */
  afterSeek(): void {
    for (const binding of this.bindings) binding.resume()
  }

  /** Detaches listeners before the player finalizes its terminal event. */
  onSequenceEnd(): void {
    for (const binding of this.bindings) binding.detach()
  }

  /** Reattaches and samples after the component has reset its scroll offset. */
  onReset(): void {
    for (const binding of this.bindings) binding.reattach()
  }

  /** Releases every listener and session at teardown. */
  destroy(): void {
    for (const binding of this.bindings) binding.destroy()
    this.bindings = []
  }
}

/** Scroll listeners, coalesced progress and capture sessions of one scrollport. */
class ScrollProgressBinding {
  private readonly element: Element
  private readonly axis: ScrollProgressAxis
  private readonly storyId: string
  private readonly persoId: string
  private readonly captureSources: RuntimeCaptureSourcePort
  private activeActivities: ScrollCaptureActivity[] = []
  private resizeObserver: ResizeObserver | undefined
  private resizeListener: EventListener | undefined
  private frameHandle: number | undefined
  private microtaskScheduled = false
  private pendingProgress: number | undefined
  private attached = false
  private seeking = false
  private destroyed = false

  /** Keeps the scrollport identity and its configured axis. */
  constructor(input: Readonly<{
    element: Element
    axis: ScrollProgressAxis
    storyId: string
    persoId: string
    captureSources: RuntimeCaptureSourcePort
  }>) {
    this.element = input.element
    this.axis = input.axis
    this.storyId = input.storyId
    this.persoId = input.persoId
    this.captureSources = input.captureSources
  }

  /** Attaches scroll, scrollend and resize listeners, then samples once. */
  attach(): void {
    if (this.attached || this.destroyed) return
    this.attached = true
    this.element.addEventListener('scroll', this.handleScroll, { passive: true })
    this.element.addEventListener('scrollend', this.handleScrollEnd)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.sample())
      this.resizeObserver.observe(this.element)
    }
    if (typeof window !== 'undefined') {
      this.resizeListener = this.handleWindowResize
      window.addEventListener('resize', this.resizeListener, { passive: true })
    }
    this.sample()
  }

  /** Cancels the queued frame and open sessions during a seek. */
  suspend(): void {
    this.seeking = true
    this.cancelPendingFrame()
    this.cancelActivities()
  }

  /** Samples again once the seek presentation is complete. */
  resume(): void {
    if (this.destroyed) return
    this.seeking = false
    this.sample()
  }

  /** Cancels sessions and removes listeners at the terminal boundary. */
  detach(): void {
    this.cancelPendingFrame()
    this.cancelActivities()
    this.removeListeners()
  }

  /** Reattaches and samples after an explicit player reset. */
  reattach(): void {
    if (this.destroyed) return
    this.seeking = false
    this.attach()
    this.sample()
  }

  /** Releases listeners and sessions for good. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.detach()
  }

  /** Removes DOM listeners and forgets the queued progress. */
  private removeListeners(): void {
    if (!this.attached) return
    this.attached = false
    this.element.removeEventListener('scroll', this.handleScroll)
    this.element.removeEventListener('scrollend', this.handleScrollEnd)
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    if (this.resizeListener !== undefined && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener)
    }
    this.resizeListener = undefined
    this.pendingProgress = undefined
  }

  /** Reads the current geometry and coalesces it to one presentation. */
  private sample(): void {
    if (!this.attached || this.destroyed || this.seeking) return
    this.pendingProgress = calculateScrollProgress(readScrollMetrics(this.element, this.axis))
    this.schedulePresentation()
  }

  /** Schedules a single frame presentation without advancing player time. */
  private schedulePresentation(): void {
    if (this.frameHandle !== undefined || this.microtaskScheduled || this.destroyed || this.seeking) return
    if (typeof requestAnimationFrame === 'function') {
      this.frameHandle = requestAnimationFrame(() => {
        this.frameHandle = undefined
        this.present()
      })
      return
    }
    this.microtaskScheduled = true
    queueMicrotask(() => {
      this.microtaskScheduled = false
      this.present()
    })
  }

  /** Publishes the latest coalesced progress to the capture sessions. */
  private present(): void {
    if (!this.attached || this.destroyed || this.seeking || this.pendingProgress === undefined) return
    const progress = this.pendingProgress
    this.pendingProgress = undefined
    this.track(progress)
  }

  /** Cancels one queued frame before seek, sequence end, or destruction. */
  private cancelPendingFrame(): void {
    if (this.frameHandle !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameHandle)
    }
    this.frameHandle = undefined
    this.microtaskScheduled = false
  }

  /** Opens capture on the first useful progress and tracks later samples. */
  private track(progress: number): void {
    if (this.activeActivities.length === 0) {
      const activity: ScrollCaptureActivity = { sessions: [] }
      const closedDuringOpen = new Set<string>()
      const sessions = this.captureSources.open({
        storyId: this.storyId,
        persoId: this.persoId,
        source: SCROLL_SOURCE,
        eventContext: { source: SCROLL_SOURCE, userEvent: 'scroll', persoId: this.persoId },
      }, {
        onClose: ({ captureId }) => {
          closedDuringOpen.add(captureId)
          activity.sessions = activity.sessions.filter((session) => session.captureId !== captureId)
          if (activity.sessions.length === 0) {
            this.activeActivities = this.activeActivities.filter((current) => current !== activity)
          }
        },
      })
      activity.sessions.push(...sessions.filter((session) => !closedDuringOpen.has(session.captureId)))
      if (activity.sessions.length === 0) return
      this.activeActivities.push(activity)
    }
    const sample = { progress }
    for (const activity of this.activeActivities) {
      for (const session of activity.sessions) session.track(sample)
    }
  }

  /** Ends all active sessions at the native scrollend boundary. */
  private endActivities(): void {
    const activities = this.activeActivities.splice(0)
    for (const activity of activities) {
      for (const session of activity.sessions) {
        void session.end({ source: SCROLL_SOURCE, eventType: 'scrollend' })
      }
    }
  }

  /** Cancels sessions on seek, terminal completion, or teardown. */
  private cancelActivities(): void {
    const activities = this.activeActivities.splice(0)
    for (const activity of activities) {
      for (const session of activity.sessions) session.cancel()
    }
  }

  /** Samples on native scroll. */
  private readonly handleScroll: EventListener = () => this.sample()

  /** Closes the activity at the native end boundary. */
  private readonly handleScrollEnd: EventListener = () => this.endActivities()

  /** Samples after a viewport resize. */
  private readonly handleWindowResize: EventListener = () => this.sample()
}

/** Converts one scroll extent and offset into a finite progress in [0, 1]. */
export function calculateScrollProgress(metrics: ScrollProgressMetrics): number {
  const { offset, extent, viewportExtent } = metrics
  if (![offset, extent, viewportExtent].every(Number.isFinite)) return 0
  const scrollableExtent = extent - viewportExtent
  if (scrollableExtent <= 0) return 0
  return Math.min(1, Math.max(0, offset / scrollableExtent))
}

/** Reads the scrollport geometry along the configured axis. */
function readScrollMetrics(element: Element, axis: ScrollProgressAxis): ScrollProgressMetrics {
  return axis === 'inline'
    ? { offset: element.scrollLeft, extent: element.scrollWidth, viewportExtent: element.clientWidth }
    : { offset: element.scrollTop, extent: element.scrollHeight, viewportExtent: element.clientHeight }
}
