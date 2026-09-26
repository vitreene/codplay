import type {
  CompiledCaptureDeclaration,
  CompiledEmitRule,
  CompiledPerso,
  CompiledScene,
  CompiledScrollObservationEvent,
  CompiledScrollObservation,
} from 'codplay/scene/compiled'
import { resolveCaptureEventTarget } from 'codplay/runtime/capture'
import type { Diagnostic } from 'codplay/diagnostics'
import {
  PLAYER_LIFECYCLE_PLAYING,
  resolveAncestorChain,
} from 'codplay/runtime/player'
import type {
  SolvedScene,
} from 'codplay/runtime/player'
import type {
  HtmlSourceAdapter,
  HtmlSourceAdapterContext,
  HtmlSourceAdapterFactory,
} from 'codplay/runtime/runner-html'
import { isMeasurableHtmlElement } from 'codplay/runtime/runner-html'
import { IntersectionObservationProvider } from './intersection-observation-provider'
import { ScrollProgressProvider } from './scroll-progress-provider'
import type {
  ScrollObservationUpdate,
  ScrollObservationRule,
  ScrollProgressMetrics,
} from './scroll-source-types'
import type { ScrollProgressAxis } from './scroll-container-types'

type CompiledCaptureRule = Extract<CompiledEmitRule, { capture: CompiledCaptureDeclaration }>

type ScrollSourceDefinition = Readonly<{
  storyId: string
  perso: CompiledPerso
  axis: ScrollProgressAxis
  captureRules: readonly Readonly<{ id: string; rule: CompiledCaptureRule }>[]
}>

type CaptureActivity = {
  captureId: string
  rule: CompiledCaptureRule
  pendingSamples: number[]
  starting: boolean
  started: boolean
  endRequested: boolean
  cancelled: boolean
}

type ScrollSourceBinding = {
  definition: ScrollSourceDefinition
  element: Element
  progressProvider: ScrollProgressProvider
  activities: Map<string, CaptureActivity>
  onScroll: EventListener
  onScrollEnd: EventListener
  resizeObserver?: ResizeObserver
}

type ExtendedIntersectionObserverInit = IntersectionObserverInit & Readonly<{
  scrollMargin?: string
  trackVisibility?: boolean
}>

type ObservationBinding = Readonly<{
  rule: ScrollObservationRule
  target: Element
  root: Element
  options: ExtendedIntersectionObserverInit
  optionsKey: string
}>

type ObserverGroup = {
  root: Element
  options: ExtendedIntersectionObserverInit
  observer: IntersectionObserver
  rulesByTarget: Map<Element, Map<string, ScrollObservationRule>>
}

/** Creates the optional HTML source adapter for a compiled scroll-container scene. */
export const createScrollContainerSourceAdapter: HtmlSourceAdapterFactory = (context) => (
  new ScrollContainerSourceAdapter(context)
)

/** Owns scroll listeners, capture bridges, and logical descendant observations for one player. */
class ScrollContainerSourceAdapter implements HtmlSourceAdapter {
  private readonly context: HtmlSourceAdapterContext
  private readonly compiledScene: CompiledScene
  private readonly sourceDefinitions: readonly ScrollSourceDefinition[]
  private readonly observationRules: readonly ScrollObservationRule[]
  private readonly observationProvider: IntersectionObservationProvider
  private readonly sourceBindings = new Map<string, ScrollSourceBinding>()
  private readonly observerGroups = new Map<Element, Map<string, ObserverGroup>>()
  private readonly reportedDiagnostics = new Set<string>()
  private readonly emittedOnce = new Set<CompiledScrollObservationEvent>()
  private pendingDispatch: Promise<void> = Promise.resolve()
  private resizeListener: EventListener | undefined
  private frameHandle: number | undefined
  private microtaskScheduled = false
  private nextCaptureId = 0
  private attached = false
  private seeking = false
  private destroyed = false

  /** Builds immutable source declarations without touching the DOM. */
  constructor(context: HtmlSourceAdapterContext) {
    this.context = context
    this.compiledScene = context.compiledScene
    this.sourceDefinitions = collectScrollSources(this.compiledScene)
    this.observationRules = collectObservationRules(this.compiledScene)
    this.observationProvider = new IntersectionObservationProvider(this.observationRules)
  }

  /** Attaches source providers only after the runner has materialized the initial scene. */
  attach(): void {
    if (this.attached || this.destroyed) return
    this.attached = true
    this.observationProvider.attach()
    this.attachResizeListener()
    const scene = this.context.getSolvedScene()
    if (scene !== undefined) {
      this.attachScrollSources(scene)
      this.attachObservations(scene)
    }
  }

  /** Publishes pending progress after a scene presentation without resolving ancestry again. */
  onScenePresented(_scene: SolvedScene): void {
    if (!this.attached || this.destroyed || this.seeking) return
    this.flushProgressSamples()
  }

  /** Suspends source delivery and cancels open scroll capture before reconstruction. */
  beforeSeek(): void {
    if (this.destroyed) return
    this.seeking = true
    this.cancelPendingFrame()
    this.cancelActivities()
  }

  /** Resumes live progress after seek while keeping the initial observation roots. */
  afterSeek(_scene: SolvedScene | undefined): void {
    if (this.destroyed) return
    this.seeking = false
    for (const source of this.sourceBindings.values()) this.sampleSource(source)
  }

  /** Cancels source sessions before the player finalizes sequence:end. */
  onSequenceEnd(): void {
    this.attached = false
    this.seeking = true
    this.cancelPendingFrame()
    this.cancelActivities()
    this.detachResizeListener()
    this.detachScrollSources()
    this.disconnectObservationBindings()
  }

  /** Removes listeners and observers, cancels captures, and invalidates queued emissions. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.attached = false
    this.seeking = true
    this.cancelPendingFrame()
    this.detachResizeListener()
    this.detachScrollSources()
    this.disconnectObservationBindings()
    this.observationProvider.destroy()
    this.pendingDispatch = Promise.resolve()
  }

  /** Attaches each initially mounted scroll-container source once. */
  private attachScrollSources(scene: SolvedScene): void {
    for (const definition of this.sourceDefinitions) {
      const persoKey = runtimePersoKey(definition.storyId, definition.perso.id)
      const solved = scene.persos[persoKey]
      if (solved?.placement.mounted !== true) continue
      if (this.sourceBindings.has(persoKey)) continue
      const element = this.context.resolvePersoElement(persoKey)
      if (element === undefined || !isMeasurableHtmlElement(element)) {
        this.reportOnce(`source-element:${persoKey}`, {
          severity: 'error',
          code: 'RUNTIME_SCROLL_CONTAINER_ELEMENT_MISSING',
          message: `The scroll-container element is not available: ${definition.perso.id}.`,
          details: { refs: { sceneId: this.compiledScene.scene.id, storyId: definition.storyId, persoId: definition.perso.id } },
        })
        continue
      }
      this.attachScrollSource(persoKey, definition, element)
    }
  }

  /** Installs one source provider and its passive scroll and scrollend listeners. */
  private attachScrollSource(
    persoKey: string,
    definition: ScrollSourceDefinition,
    element: Element,
  ): void {
    const binding = {} as ScrollSourceBinding
    binding.definition = definition
    binding.element = element
    binding.activities = new Map()
    binding.progressProvider = new ScrollProgressProvider({
      axis: definition.axis,
      onProgress: (progress) => this.trackProgress(binding, progress),
      reportDiagnostic: (diagnostic) => this.context.reportDiagnostic(diagnostic),
    })
    binding.onScroll = () => this.sampleSource(binding)
    binding.onScrollEnd = () => this.endActivities(binding)
    binding.progressProvider.attach()
    element.addEventListener('scroll', binding.onScroll, { passive: true })
    element.addEventListener('scrollend', binding.onScrollEnd)
    if (typeof ResizeObserver !== 'undefined') {
      binding.resizeObserver = new ResizeObserver(() => this.sampleSource(binding))
      binding.resizeObserver.observe(element)
    }
    this.sourceBindings.set(persoKey, binding)
    this.sampleSource(binding)
  }

  /** Removes one scroll source and cancels capture sessions tied to its old root. */
  private detachScrollSource(persoKey: string, binding: ScrollSourceBinding): void {
    binding.element.removeEventListener('scroll', binding.onScroll)
    binding.element.removeEventListener('scrollend', binding.onScrollEnd)
    binding.resizeObserver?.disconnect()
    binding.progressProvider.destroy()
    this.cancelActivities(binding)
    this.sourceBindings.delete(persoKey)
  }

  /** Removes all source listeners before the adapter is destroyed. */
  private detachScrollSources(): void {
    for (const [persoKey, binding] of [...this.sourceBindings]) {
      this.detachScrollSource(persoKey, binding)
    }
  }

  /** Samples the configured scroll axis and queues one coalesced provider presentation. */
  private sampleSource(binding: ScrollSourceBinding): void {
    if (!this.attached || this.destroyed || this.seeking) return
    binding.progressProvider.sample(readScrollMetrics(binding.element, binding.definition.axis))
    this.scheduleProgressPresentation()
  }

  /** Samples every bound source when the host viewport changes size. */
  private sampleAllSources(): void {
    for (const binding of this.sourceBindings.values()) this.sampleSource(binding)
  }

  /** Schedules one animation-frame publication without advancing the CodPlay clock. */
  private scheduleProgressPresentation(): void {
    if (this.frameHandle !== undefined || this.microtaskScheduled || this.destroyed || this.seeking) return
    if (typeof requestAnimationFrame === 'function') {
      this.frameHandle = requestAnimationFrame(() => {
        this.frameHandle = undefined
        this.flushProgressSamples()
      })
      return
    }
    this.microtaskScheduled = true
    queueMicrotask(() => {
      this.microtaskScheduled = false
      this.flushProgressSamples()
    })
  }

  /** Publishes the latest queued progress once per source at one presentation boundary. */
  private flushProgressSamples(): void {
    if (!this.attached || this.destroyed || this.seeking) return
    for (const binding of this.sourceBindings.values()) binding.progressProvider.present()
  }

  /** Cancels one queued animation-frame callback when the source is suspended. */
  private cancelPendingFrame(): void {
    if (this.frameHandle !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.frameHandle)
    }
    this.frameHandle = undefined
    this.microtaskScheduled = false
  }

  /** Registers host and element resize notifications for progress recalculation. */
  private attachResizeListener(): void {
    if (typeof window === 'undefined') return
    this.resizeListener = () => this.sampleAllSources()
    window.addEventListener('resize', this.resizeListener, { passive: true })
  }

  /** Removes the host resize notification. */
  private detachResizeListener(): void {
    if (this.resizeListener === undefined || typeof window === 'undefined') return
    window.removeEventListener('resize', this.resizeListener)
    this.resizeListener = undefined
  }

  /** Starts or extends one capture session for each declared scroll capture rule. */
  private trackProgress(binding: ScrollSourceBinding, progress: number): void {
    if (!this.attached || this.destroyed || this.seeking) return
    for (const { id, rule } of binding.definition.captureRules) {
      let activity = binding.activities.get(id)
      if (activity === undefined) {
        activity = {
          captureId: `${runtimePersoKey(binding.definition.storyId, binding.definition.perso.id)}:scroll:${this.nextCaptureId++}`,
          rule,
          pendingSamples: [],
          starting: false,
          started: false,
          endRequested: false,
          cancelled: false,
        }
        binding.activities.set(id, activity)
      }
      activity.pendingSamples.push(progress)
      if (!activity.starting && !activity.started) void this.startActivity(binding, id, activity)
      else if (activity.started) this.trackPendingSamples(binding, id, activity)
    }
  }

  /** Emits one capture start event and opens the existing player capture session. */
  private async startActivity(
    binding: ScrollSourceBinding,
    ruleId: string,
    activity: CaptureActivity,
  ): Promise<void> {
    activity.starting = true
    const { definition } = binding
    const { event, capture } = activity.rule
    try {
      const emitted = await this.context.commands.emit({
        name: event.name,
        applyAtMs: this.context.getCurrentTimeMs(),
        ...resolveCaptureEventTarget(event, definition.storyId),
        data: event.data,
        mode: event.mode,
        context: {
          source: 'scroll',
          userEvent: 'scroll',
          persoId: definition.perso.id,
        },
      })
      if (!emitted.ok) throw new Error(`Scroll capture start event was rejected: ${event.name}`)
      if (activity.cancelled || this.destroyed || this.seeking) return
      const opened = this.context.commands.beginCompiledCapture({
        captureId: activity.captureId,
        storyId: definition.storyId,
        declaration: capture,
      })
      if (!opened.ok) throw new Error(opened.message)
      activity.started = true
      this.trackPendingSamples(binding, ruleId, activity)
      if (activity.endRequested) this.finishActivity(binding, ruleId, activity)
    } catch (error) {
      this.cancelActivity(binding, ruleId, activity)
      this.reportError('RUNTIME_SCROLL_CAPTURE_FAILED', error, definition.storyId, definition.perso.id)
    } finally {
      activity.starting = false
    }
  }

  /** Routes each queued progress sample through the existing capture controller. */
  private trackPendingSamples(
    binding: ScrollSourceBinding,
    ruleId: string,
    activity: CaptureActivity,
  ): void {
    if (!activity.started || activity.cancelled || this.destroyed || this.seeking) return
    while (activity.pendingSamples.length > 0) {
      const progress = activity.pendingSamples.shift()
      if (progress === undefined) continue
      const tracked = this.context.commands.trackCapture(activity.captureId, { progress })
      if (tracked.ok) continue
      this.cancelActivity(binding, ruleId, activity)
      this.reportError('RUNTIME_SCROLL_CAPTURE_FAILED', new Error(tracked.message), binding.definition.storyId, binding.definition.perso.id)
      return
    }
  }

  /** Closes every active capture when the native scrollend boundary arrives. */
  private endActivities(binding: ScrollSourceBinding): void {
    for (const [ruleId, activity] of [...binding.activities]) {
      if (activity.cancelled) continue
      if (activity.starting) {
        activity.endRequested = true
        continue
      }
      if (activity.started) this.finishActivity(binding, ruleId, activity)
      else binding.activities.delete(ruleId)
    }
  }

  /** Ends one scroll capture through the existing endCapture operation. */
  private finishActivity(binding: ScrollSourceBinding, ruleId: string, activity: CaptureActivity): void {
    if (!activity.started || activity.cancelled) return
    activity.cancelled = true
    binding.activities.delete(ruleId)
    void this.context.commands.endCapture(activity.captureId, {
      source: 'scroll',
      eventType: 'scrollend',
    }).then((result) => {
      if (!result.ok) this.reportError('RUNTIME_SCROLL_CAPTURE_FAILED', new Error(result.message), binding.definition.storyId, binding.definition.perso.id)
    }).catch((error: unknown) => {
      this.reportError('RUNTIME_SCROLL_CAPTURE_FAILED', error, binding.definition.storyId, binding.definition.perso.id)
    })
  }

  /** Cancels one active capture without producing its declared end event. */
  private cancelActivity(binding: ScrollSourceBinding, ruleId: string, activity: CaptureActivity): void {
    if (activity.cancelled) return
    activity.cancelled = true
    activity.pendingSamples.length = 0
    binding.activities.delete(ruleId)
    if (!activity.started) return
    const cancelled = this.context.commands.cancelCapture(activity.captureId)
    if (!cancelled.ok && cancelled.code !== 'RUNTIME_CAPTURE_UNKNOWN') {
      this.reportError('RUNTIME_SCROLL_CAPTURE_FAILED', new Error(cancelled.message), binding.definition.storyId, binding.definition.perso.id)
    }
  }

  /** Cancels scroll activities from one source or from every current source. */
  private cancelActivities(binding?: ScrollSourceBinding): void {
    const bindings = binding === undefined ? [...this.sourceBindings.values()] : [binding]
    for (const source of bindings) {
      for (const [ruleId, activity] of [...source.activities]) {
        this.cancelActivity(source, ruleId, activity)
      }
    }
  }

  /** Resolves each observed perso's initial logical root and attaches its observer. */
  private attachObservations(scene: SolvedScene): void {
    for (const rule of this.observationRules) {
      const targetKey = runtimePersoKey(rule.storyId, rule.persoId)
      const targetPerso = scene.persos[targetKey]
      if (targetPerso?.placement.mounted !== true) continue
      const ancestors = [...resolveAncestorChain(scene, targetKey)].reverse()
      const scrollAncestor = rule.declaration.root === undefined
        ? ancestors.find((key) => isScrollContainer(scene.persos[key], rule.storyId))
        : ancestors.find((key) => (
          scene.persos[key]?.persoId === rule.declaration.root
          && isScrollContainer(scene.persos[key], rule.storyId)
        ))
      if (scrollAncestor === undefined) {
        this.reportOnce(`observation-root:${rule.id}`, {
          severity: 'error',
          code: 'RUNTIME_SCROLL_OBSERVATION_ROOT_INVALID',
          message: `No matching ancestor scroll-container exists for observed perso ${rule.persoId}.`,
          details: { refs: { sceneId: this.compiledScene.scene.id, storyId: rule.storyId, persoId: rule.persoId }, context: { root: rule.declaration.root } },
        })
        continue
      }
      const rootPerso = scene.persos[scrollAncestor]
      const root = this.context.resolvePersoElement(scrollAncestor)
      const target = this.context.resolvePersoElement(targetKey)
      if (rootPerso === undefined || root === undefined || target === undefined) {
        this.reportOnce(`observation-element:${rule.id}`, {
          severity: 'error',
          code: 'RUNTIME_SCROLL_OBSERVATION_ELEMENT_MISSING',
          message: `The scroll root or observed element is not materialized for perso ${rule.persoId}.`,
          details: { refs: { sceneId: this.compiledScene.scene.id, storyId: rule.storyId, persoId: rule.persoId }, context: { rootPersoId: rootPerso?.persoId } },
        })
        continue
      }
      const options = observerOptions(rule.declaration)
      const binding: ObservationBinding = {
        rule,
        target,
        root,
        options,
        optionsKey: JSON.stringify(options),
      }
      const group = this.getOrCreateObserverGroup(binding)
      if (group === undefined) continue
      const rules = group.rulesByTarget.get(target) ?? new Map<string, ScrollObservationRule>()
      const shouldObserveTarget = rules.size === 0
      rules.set(rule.id, rule)
      group.rulesByTarget.set(target, rules)
      if (shouldObserveTarget) group.observer.observe(target)
    }
  }

  /** Finds or creates the single native observer for one exact root/options pair. */
  private getOrCreateObserverGroup(binding: ObservationBinding): ObserverGroup | undefined {
    let groupsForRoot = this.observerGroups.get(binding.root)
    if (groupsForRoot === undefined) {
      groupsForRoot = new Map()
      this.observerGroups.set(binding.root, groupsForRoot)
    }
    const existing = groupsForRoot.get(binding.optionsKey)
    if (existing !== undefined) return existing
    if (typeof IntersectionObserver === 'undefined') {
      this.reportOnce('intersection-observer-unavailable', {
        severity: 'error',
        code: 'RUNTIME_INTERSECTION_OBSERVER_UNAVAILABLE',
        message: 'IntersectionObserver is not available in this browser.',
        details: { refs: { sceneId: this.compiledScene.scene.id } },
      })
      return undefined
    }
    const group = {
      root: binding.root,
      options: binding.options,
      rulesByTarget: new Map<Element, Map<string, ScrollObservationRule>>(),
      observer: undefined as unknown as IntersectionObserver,
    }
    try {
      group.observer = new IntersectionObserver((entries) => this.handleIntersectionEntries(group, entries), {
        root: binding.root,
        ...binding.options,
      })
    } catch (error) {
      this.reportOnce(`observer-options:${binding.optionsKey}`, {
        severity: 'error',
        code: 'RUNTIME_INTERSECTION_OBSERVER_OPTIONS_UNSUPPORTED',
        message: error instanceof Error ? error.message : String(error),
        details: { refs: { sceneId: this.compiledScene.scene.id }, context: { options: binding.options } },
      })
      return undefined
    }
    const unsupportedOptions = []
    if (binding.options.scrollMargin !== '0px' && !('scrollMargin' in group.observer)) {
      unsupportedOptions.push('scrollMargin')
    }
    if (binding.options.trackVisibility === true
      && (!('trackVisibility' in group.observer) || !supportsIntersectionVisibility())) {
      unsupportedOptions.push('trackVisibility')
    }
    if (unsupportedOptions.length > 0) {
      group.observer.disconnect()
      this.reportOnce(`observer-unsupported:${binding.optionsKey}`, {
        severity: 'error',
        code: 'RUNTIME_INTERSECTION_OBSERVER_OPTIONS_UNSUPPORTED',
        message: `IntersectionObserver options are not supported: ${unsupportedOptions.join(', ')}.`,
        details: { refs: { sceneId: this.compiledScene.scene.id }, context: { options: binding.options, unsupportedOptions } },
      })
      return undefined
    }
    groupsForRoot.set(binding.optionsKey, group)
    return group
  }

  /** Normalizes one native batch, applies ratio actions, and queues phase events. */
  private handleIntersectionEntries(group: ObserverGroup, entries: readonly IntersectionObserverEntry[]): void {
    if (this.destroyed || this.seeking || !this.attached) return
    const updates: ScrollObservationUpdate[] = []
    for (const entry of entries) {
      const rules = group.rulesByTarget.get(entry.target)
      if (rules === undefined) continue
      for (const rule of rules.values()) {
        const visible = rule.declaration.zone?.trackVisibility !== true || isVisibleIntersectionEntry(entry)
        const phase = entry.isIntersecting && visible
          ? 'inside'
          : 'outside'
        updates.push({ ruleId: rule.id, phase, ratio: entry.intersectionRatio })
      }
    }
    const { emissions, liveActions } = this.observationProvider.update(updates)
    for (const action of liveActions) {
      try {
        this.context.commands.setLiveActions(
          `observe:${action.ruleId}`,
          [{ name: action.actionName, data: { ratio: action.ratio } }],
        )
      } catch (error) {
        this.reportOnce(`observation-live-action:${action.ruleId}`, {
          severity: 'error',
          code: 'RUNTIME_SCROLL_OBSERVATION_LIVE_ACTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
          details: { refs: { sceneId: this.compiledScene.scene.id, storyId: action.storyId, persoId: action.persoId } },
        })
      }
    }
    if (this.context.getLifecycleState() !== PLAYER_LIFECYCLE_PLAYING || emissions.length === 0) return
    const applyAtMs = this.context.getCurrentTimeMs()
    this.pendingDispatch = this.pendingDispatch.then(async () => {
      for (const emission of emissions) {
        if (this.destroyed || this.seeking || this.context.getLifecycleState() !== PLAYER_LIFECYCLE_PLAYING) continue
        if (emission.event.once === true && this.emittedOnce.has(emission.event)) continue
        const visibility = emission.event.visibility ?? 'story'
        const result = await this.context.commands.emit({
          name: emission.event.name,
          applyAtMs,
          storyId: visibility === 'story' ? emission.storyId : undefined,
          visibility,
          data: emission.event.data,
          mode: emission.event.mode,
          context: {
            source: 'intersection-observer',
            persoId: emission.persoId,
            phase: emission.phase,
          },
        })
        if (result.ok && emission.event.once === true) this.emittedOnce.add(emission.event)
        if (!result.ok) this.reportError('RUNTIME_SCROLL_OBSERVATION_EMIT_REJECTED', new Error(`Intersection event was rejected: ${emission.event.name}`), emission.storyId, emission.persoId)
        for (const issue of result.issues) {
          this.reportError(issue.code, new Error(issue.message), emission.storyId, emission.persoId)
        }
      }
    }).catch((error: unknown) => {
      this.reportError('RUNTIME_SCROLL_OBSERVATION_EMIT_FAILED', error)
    })
  }

  /** Disconnects every initially attached observer at the source teardown boundary. */
  private disconnectObservationBindings(): void {
    for (const groupsForRoot of this.observerGroups.values()) {
      for (const group of groupsForRoot.values()) group.observer.disconnect()
    }
    this.observerGroups.clear()
  }

  /** Reports one diagnostic only once for the adapter lifetime. */
  private reportOnce(key: string, diagnostic: Diagnostic): void {
    if (this.reportedDiagnostics.has(key)) return
    this.reportedDiagnostics.add(key)
    this.context.reportDiagnostic(diagnostic)
  }

  /** Reports one source error with scene and persona identity when available. */
  private reportError(code: string, error: unknown, storyId?: string, persoId?: string): void {
    this.context.reportDiagnostic({
      severity: 'error',
      code,
      message: error instanceof Error ? error.message : String(error),
      details: {
        refs: { sceneId: this.compiledScene.scene.id, storyId, persoId },
      },
    })
  }
}

/** Collects the scroll-container personas and their capture declarations in compiled order. */
function collectScrollSources(scene: CompiledScene): readonly ScrollSourceDefinition[] {
  const sources: ScrollSourceDefinition[] = []
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      if (perso.type !== 'scroll-container') continue
      const initialValues = perso.initial.values as unknown as Readonly<Record<string, unknown>> | undefined
      const progressCandidate = initialValues?.progress
      const progressValues = isRecord(progressCandidate)
        ? progressCandidate
        : undefined
      const captureRules = normalizeRules(perso.emit?.scroll as CompiledEmitRule | readonly CompiledEmitRule[] | undefined)
        .flatMap((rule, index) => rule.capture === undefined
          ? []
          : [{ id: `scroll:${storyId}:${perso.id}:${index}`, rule: rule as CompiledCaptureRule }])
      sources.push({
        storyId,
        perso,
        axis: progressValues?.axis === 'inline' ? 'inline' : 'block',
        captureRules,
      })
    }
  }
  return sources
}

/** Collects the direct `emit.observe` declaration from each compiled target perso. */
function collectObservationRules(scene: CompiledScene): readonly ScrollObservationRule[] {
  const result: ScrollObservationRule[] = []
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      const declaration = perso.emit?.observe as CompiledScrollObservation | undefined
      if (declaration === undefined) continue
      result.push({
        id: `${storyId}:${perso.id}:emit:observe`,
        storyId,
        persoId: perso.id,
        declaration,
      })
    }
  }
  return result
}

/** Normalizes a compiled emit entry to an ordered list. */
function normalizeRules(value: CompiledEmitRule | readonly CompiledEmitRule[] | undefined): readonly CompiledEmitRule[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value as CompiledEmitRule]
}

/** Derives the canonical runtime key already used by materialization and existing sources. */
function runtimePersoKey(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}`
}

/** Checks that one solved ancestor is a scroll-container in the target's story. */
function isScrollContainer(
  perso: SolvedScene['persos'][string] | undefined,
  storyId: string,
): boolean {
  return perso?.type === 'scroll-container' && perso.storyId === storyId
}

/** Reads the profile axis without adding a runtime value to the compiled artifact. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads the configured scroll axis into the DOM-free metric shape. */
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

/** Builds exact native observer options and their sharing identity from one rule. */
function observerOptions(declaration: CompiledScrollObservation): ExtendedIntersectionObserverInit {
  const zone = declaration.zone
  const threshold = zone?.threshold
  return {
    rootMargin: zone?.rootMargin ?? '0px',
    scrollMargin: zone?.scrollMargin ?? '0px',
    threshold: typeof threshold === 'number'
      ? threshold
      : threshold === undefined ? 0 : [...threshold],
    trackVisibility: zone?.trackVisibility ?? false,
  }
}

/** Checks the native visibility extension required by `trackVisibility`. */
function supportsIntersectionVisibility(): boolean {
  return typeof IntersectionObserverEntry !== 'undefined'
    && 'isVisible' in IntersectionObserverEntry.prototype
}

/** Checks IntersectionObserver's optional isVisible bit without retaining the native entry. */
function isVisibleIntersectionEntry(entry: IntersectionObserverEntry): boolean {
  return 'isVisible' in entry && (entry as IntersectionObserverEntry & { isVisible?: boolean }).isVisible === true
}
