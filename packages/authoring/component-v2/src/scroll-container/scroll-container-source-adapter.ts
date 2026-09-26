import type {
  CompiledScene,
  CompiledScrollObservation,
  CompiledScrollObservationEvent,
} from 'codplay/scene/compiled'
import type { Diagnostic } from 'codplay/diagnostics'
import {
  PLAYER_LIFECYCLE_PLAYING,
  resolveAncestorChain,
} from 'codplay/runtime/player'
import type { SolvedScene } from 'codplay/runtime/player'
import type {
  HtmlSourceAdapter,
  HtmlSourceAdapterContext,
  HtmlSourceAdapterFactory,
} from 'codplay/runtime/runner-html'
import { IntersectionObservationProvider } from './intersection-observation-provider'
import type { ScrollObservationRule, ScrollObservationUpdate } from './scroll-source-types'

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

/** Creates the optional adapter for descendant intersection observations. */
export const createScrollContainerSourceAdapter: HtmlSourceAdapterFactory = (context) => (
  new ScrollContainerObservationAdapter(context)
)

/** Owns logical descendant observations and their native IntersectionObservers. */
class ScrollContainerObservationAdapter implements HtmlSourceAdapter {
  private readonly context: HtmlSourceAdapterContext
  private readonly compiledScene: CompiledScene
  private readonly observationRules: readonly ScrollObservationRule[]
  private readonly observationProvider: IntersectionObservationProvider
  private readonly observerGroups = new Map<Element, Map<string, ObserverGroup>>()
  private readonly reportedDiagnostics = new Set<string>()
  private readonly emittedOnce = new Set<CompiledScrollObservationEvent>()
  private pendingDispatch: Promise<void> = Promise.resolve()
  private attached = false
  private seeking = false
  private destroyed = false

  /** Builds immutable observation declarations without touching the DOM. */
  constructor(context: HtmlSourceAdapterContext) {
    this.context = context
    this.compiledScene = context.compiledScene
    this.observationRules = collectObservationRules(this.compiledScene)
    this.observationProvider = new IntersectionObservationProvider(this.observationRules)
  }

  /** Attaches descendant observers after the runner has materialized the scene. */
  attach(): void {
    if (this.attached || this.destroyed) return
    this.attached = true
    this.observationProvider.attach()
    const scene = this.context.getSolvedScene()
    if (scene !== undefined) this.attachObservations(scene)
  }

  /** Silences observations while the runner reconstructs a seek target. */
  beforeSeek(): void {
    if (this.destroyed) return
    this.seeking = true
  }

  /** Resumes observation delivery after seek presentation. */
  afterSeek(): void {
    if (this.destroyed) return
    this.seeking = false
  }

  /** Disconnects observers before the player finalizes sequence:end. */
  onSequenceEnd(): void {
    this.attached = false
    this.seeking = true
    this.disconnectObservationBindings()
  }

  /** Disconnects every observer and invalidates queued observation emissions. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.attached = false
    this.seeking = true
    this.disconnectObservationBindings()
    this.observationProvider.destroy()
    this.pendingDispatch = Promise.resolve()
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
        const phase = entry.isIntersecting && visible ? 'inside' : 'outside'
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

  /** Disconnects each observer group before the component or runner is torn down. */
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

  /** Reports one observation error with scene and persona identity when available. */
  private reportError(code: string, error: unknown, storyId?: string, persoId?: string): void {
    this.context.reportDiagnostic({
      severity: 'error',
      code,
      message: error instanceof Error ? error.message : String(error),
      details: { refs: { sceneId: this.compiledScene.scene.id, storyId, persoId } },
    })
  }
}

/** Collects direct `emit.observe` declarations from compiled target persos. */
function collectObservationRules(scene: CompiledScene): readonly ScrollObservationRule[] {
  const result: ScrollObservationRule[] = []
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      const declaration = perso.emit?.observe as CompiledScrollObservation | undefined
      if (declaration === undefined) continue
      result.push({ id: `${storyId}:${perso.id}:emit:observe`, storyId, persoId: perso.id, declaration })
    }
  }
  return result
}

/** Derives the canonical runtime key already used by materialization and the runner. */
function runtimePersoKey(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}`
}

/** Checks that one solved ancestor is a scroll-container in the target's story. */
function isScrollContainer(perso: SolvedScene['persos'][string] | undefined, storyId: string): boolean {
  return perso?.type === 'scroll-container' && perso.storyId === storyId
}

/** Builds native observer options and their sharing identity from one rule. */
function observerOptions(declaration: CompiledScrollObservation): ExtendedIntersectionObserverInit {
  const zone = declaration.zone
  const threshold = zone?.threshold
  return {
    rootMargin: zone?.rootMargin ?? '0px',
    scrollMargin: zone?.scrollMargin ?? '0px',
    threshold: typeof threshold === 'number' ? threshold : threshold === undefined ? 0 : [...threshold],
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
