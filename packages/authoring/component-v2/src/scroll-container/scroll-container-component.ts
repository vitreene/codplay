import { TagComponent, sanitizeTagInitial } from 'codplay/runtime/components'
import type { RuntimeComponentDefinition } from 'codplay/runtime/catalog'
import type { RuntimeCaptureSourceSession } from 'codplay/runtime/capture'
import { isMeasurableHtmlElement } from 'codplay/runtime/runner-html'
import { SCROLL_CONTAINER_MODULE_SERVICE_ID } from './scroll-container-types'
import type { ScrollContainerInitial, ScrollProgressAxis } from './scroll-container-types'
import { ScrollProgressProvider } from './scroll-progress-provider'
import type { ScrollProgressMetrics } from './scroll-source-types'
import { validateScrollContainerInitial } from './scroll-container-validation'

type ScrollCaptureActivity = {
  sessions: RuntimeCaptureSourceSession[]
}

/** Reuses the core one-tag projection for the scroll-container persona type. */
export class ScrollContainerComponent extends TagComponent {
  private element: Element | undefined
  private progressProvider: ScrollProgressProvider | undefined
  private activeActivities: ScrollCaptureActivity[] = []
  private resizeObserver: ResizeObserver | undefined
  private resizeListener: EventListener | undefined
  private frameHandle: number | undefined
  private microtaskScheduled = false
  private attached = false
  private seeking = false
  private destroyed = false

  /** Resolves the materialized root and attaches its capture source. */
  override initialize(): void {
    super.initialize()
    if (!isMeasurableHtmlElement(this.node)) return
    this.element = this.node
    const initial = this.perso.initial as ScrollContainerInitial
    const axis: ScrollProgressAxis = initial.values?.progress?.axis ?? 'block'
    this.progressProvider = new ScrollProgressProvider({
      axis,
      onProgress: (progress) => this.trackProgress(progress),
    })
    this.attachSource()
  }

  /** Cancels active source sessions while the player reconstructs a seek target. */
  override beforeSeek(): void {
    this.seeking = true
    this.cancelPendingFrame()
    this.cancelActivities()
  }

  /** Resumes progress sampling after seek presentation. */
  override afterSeek(): void {
    if (this.destroyed) return
    this.seeking = false
    this.sampleSource()
  }

  /** Detaches the source before the player finalizes its terminal sequence event. */
  override onSequenceEnd(): void {
    this.cancelPendingFrame()
    this.cancelActivities()
    this.detachSource()
  }

  /** Reattaches the scroll source when the player is explicitly reset. */
  override onReset(): void {
    if (this.destroyed) return
    this.seeking = false
    this.attachSource()
    this.sampleSource()
  }

  /** Releases component-owned listeners and capture sessions at player teardown. */
  override destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.cancelPendingFrame()
    this.cancelActivities()
    this.detachSource()
    this.progressProvider?.destroy()
  }

  /** Attaches progress and capture listeners to the node resolved during initialize. */
  private attachSource(): void {
    const element = this.element
    const provider = this.progressProvider
    if (this.attached || this.destroyed || element === undefined || provider === undefined) return
    if (!this.captureSources?.hasRules({
      storyId: this.perso.storyId,
      persoId: this.perso.id,
      source: 'scroll',
    })) return
    this.attached = true
    provider.attach()
    element.addEventListener('scroll', this.handleScroll, { passive: true })
    element.addEventListener('scrollend', this.handleScrollEnd)
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.sampleSource())
      this.resizeObserver.observe(element)
    }
    if (typeof window !== 'undefined') {
      this.resizeListener = this.handleWindowResize
      window.addEventListener('resize', this.resizeListener, { passive: true })
    }
    this.sampleSource()
  }

  /** Removes DOM listeners while retaining provider state for a later reset. */
  private detachSource(): void {
    if (!this.attached) return
    this.attached = false
    this.element?.removeEventListener('scroll', this.handleScroll)
    this.element?.removeEventListener('scrollend', this.handleScrollEnd)
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    if (this.resizeListener !== undefined && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeListener)
    }
    this.resizeListener = undefined
    this.progressProvider?.detach()
  }

  /** Samples the current scrollport geometry and coalesces one presentation. */
  private sampleSource(): void {
    if (!this.attached || this.destroyed || this.seeking || this.element === undefined) return
    const axis = this.progressProvider?.axis ?? 'block'
    this.progressProvider?.sample(readScrollMetrics(this.element, axis))
    this.scheduleProgressPresentation()
  }

  /** Schedules a single animation-frame presentation without advancing player time. */
  private scheduleProgressPresentation(): void {
    if (this.frameHandle !== undefined || this.microtaskScheduled || this.destroyed || this.seeking) return
    if (typeof requestAnimationFrame === 'function') {
      this.frameHandle = requestAnimationFrame(() => {
        this.frameHandle = undefined
        this.presentProgress()
      })
      return
    }
    this.microtaskScheduled = true
    queueMicrotask(() => {
      this.microtaskScheduled = false
      this.presentProgress()
    })
  }

  /** Publishes the latest coalesced progress through the component provider. */
  private presentProgress(): void {
    if (!this.attached || this.destroyed || this.seeking) return
    this.progressProvider?.present()
  }

  /** Cancels one queued frame before seek, sequence end, or destruction. */
  private cancelPendingFrame(): void {
    if (this.frameHandle !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameHandle)
    }
    this.frameHandle = undefined
    this.microtaskScheduled = false
  }

  /** Starts capture on the first useful progress and tracks later coalesced samples. */
  private trackProgress(progress: number): void {
    if (!this.attached || this.destroyed || this.seeking || this.captureSources === undefined) return
    if (this.activeActivities.length === 0) {
      const activity: ScrollCaptureActivity = { sessions: [] }
      const closedDuringOpen = new Set<string>()
      const sessions = this.captureSources.open({
        storyId: this.perso.storyId,
        persoId: this.perso.id,
        source: 'scroll',
        eventContext: {
          source: 'scroll',
          userEvent: 'scroll',
          persoId: this.perso.id,
        },
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

  /** Ends all active scroll sessions at the native scrollend boundary. */
  private endActivities(): void {
    const activities = this.activeActivities.splice(0)
    for (const activity of activities) {
      for (const session of activity.sessions) {
        void session.end({ source: 'scroll', eventType: 'scrollend' })
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

  /** Handles native scroll changes through the component-owned root listener. */
  private readonly handleScroll: EventListener = () => this.sampleSource()

  /** Handles the native end boundary through the component-owned root listener. */
  private readonly handleScrollEnd: EventListener = () => this.endActivities()

  /** Recalculates progress after a viewport resize. */
  private readonly handleWindowResize: EventListener = () => this.sampleSource()
}

/** Registers the scrollport profile over the existing HTML tag materializer. */
export const SCROLL_CONTAINER_COMPONENT_DEFINITION: RuntimeComponentDefinition = {
  type: 'scroll-container',
  component: ScrollContainerComponent,
  modules: [SCROLL_CONTAINER_MODULE_SERVICE_ID],
  validateInitial: validateScrollContainerInitial,
  sanitizeInitial: sanitizeTagInitial,
}

/** Reads the configured scroll axis into the provider's numeric metric shape. */
function readScrollMetrics(element: Element, axis: ScrollProgressAxis): ScrollProgressMetrics {
  const scrollElement = element as Element & Readonly<{
    scrollTop?: number
    scrollLeft?: number
    scrollHeight?: number
    scrollWidth?: number
    clientHeight?: number
    clientWidth?: number
  }>
  return axis === 'inline'
    ? {
      offset: scrollElement.scrollLeft ?? 0,
      extent: scrollElement.scrollWidth ?? 0,
      viewportExtent: scrollElement.clientWidth ?? 0,
    }
    : {
      offset: scrollElement.scrollTop ?? 0,
      extent: scrollElement.scrollHeight ?? 0,
      viewportExtent: scrollElement.clientHeight ?? 0,
    }
}
