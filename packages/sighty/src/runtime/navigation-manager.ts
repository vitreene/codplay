import {
  resolveAccessCondition,
  resolveExitCondition,
} from '../navigation/conditions'
import { createSelection, resolveRouteTarget } from '../navigation/composition'
import { resolveViewData } from '../navigation/data'
import { findContainingSlot, getStartEntry, isPathPrefix } from '../navigation/graph-index'
import { resolveActionCandidates } from '../navigation/resolver'
import { sameSelection } from '../navigation/transition'
import type { ActiveComposition, ActiveSelection } from '../navigation/types'
import type {
  SightyActionKey,
  SightyActionHandler,
  SightyCondition,
  SightyConditionContext,
  SightyRuntimeEvent,
  SightyRouteTarget,
  SightyScenarioSelection,
  SightyScenarioStateApi,
  SightyViewReference,
} from '../types'
import { occurrenceKeyForSelection, reportWarning } from './helpers'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimeCompositionManager } from './composition-manager'
import { RuntimeCouplingManager } from './coupling-manager'
import { RuntimeSceneEventGateway } from './scene-event-gateway'
import { RuntimeTransitionManager } from './transition-manager'
import type { SightyRuntimeState } from './state'
import type {
  DispatchRequest,
} from './types'

/** Coordinates event routing, conditions, actions and declared entry events. */
export class RuntimeNavigationManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly composition: RuntimeCompositionManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly couplings: RuntimeCouplingManager<SceneKey, SlotName>
  private readonly transitions: RuntimeTransitionManager<SceneKey, SlotName>
  private readonly events: RuntimeSceneEventGateway<SceneKey, SlotName>
  private scenarioState: SightyScenarioStateApi<SceneKey, SlotName> | undefined
  private activePointer: ActiveSelection<SceneKey, SlotName> | undefined

  /** Creates a navigation manager over the shared state and runtime boundaries. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    composition: RuntimeCompositionManager<SceneKey, SlotName>,
    bindings: RuntimeBindingManager<SceneKey, SlotName>,
    couplings: RuntimeCouplingManager<SceneKey, SlotName>,
    transitions: RuntimeTransitionManager<SceneKey, SlotName>,
    events: RuntimeSceneEventGateway<SceneKey, SlotName>,
  ) {
    this.state = state
    this.composition = composition
    this.bindings = bindings
    this.couplings = couplings
    this.transitions = transitions
    this.events = events
  }

  /** Connects the shared progression reader used by external action handlers. */
  setScenarioState(scenarioState: SightyScenarioStateApi<SceneKey, SlotName>): void {
    this.scenarioState = scenarioState
  }

  /** Returns the current scene selection followed by Sighty's navigation pointer. */
  get active(): SightyScenarioSelection<SceneKey, SlotName> | undefined {
    const current = this.currentPointerSelection()
    if (current === undefined) return undefined
    return {
      slotName: current.slotName,
      view: { path: current.entry.path },
      sceneKey: current.sceneKey,
    }
  }

  /** Points scenario state at the target committed by the latest composition. */
  setActiveSelection(
    target: ActiveSelection<SceneKey, SlotName> | undefined,
    selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): void {
    this.activePointer = this.findActiveSelection(target, selections)
  }

  /** Resolves one admitted event and executes its first valid authored action. */
  async dispatchNow(request: DispatchRequest<SceneKey>): Promise<boolean> {
    if (!this.isAdmissibleRequest(request)) return false
    if (await this.couplings.dispatch(request)) return true

    const candidates = resolveActionCandidates(this.state.composition, request.event)
    for (const candidate of candidates) {
      const { action } = candidate
      if (action.go !== undefined) {
        const rawTarget = this.resolveNavigationTarget(action.go, candidate.selection, 0, true)
        if (rawTarget === undefined) {
          if ('direction' in action.go) continue
          return false
        }
        const target = this.composition.withCurrentGeneration(rawTarget)
        const resolved = await this.resolveAccessibleComposition(target, request.event)
        if (resolved === undefined) return false
        if (!await this.allowsExit(this.state.composition, resolved.selections, request.event)) return false
        await this.transitions.execute(resolved.selections, {
          entryBehavior: 'show',
          notify: true,
          deliverEnteredEvents: (selections) => this.deliverEnteredEvents(selections),
        })
        this.setActiveSelection(resolved.target, resolved.selections)
      }

      if (action.action !== undefined) {
        const activeSelection = this.state.composition.selections.get(candidate.selection.slotAddress)
          ?? candidate.selection
        await this.executeAction(action.action, request.event, activeSelection)
      }
      return action.go !== undefined || action.action !== undefined
    }
    return false
  }

  /** Determines whether an incoming request can change the active composition. */
  isTransitionRequest(request: DispatchRequest<SceneKey>): boolean {
    if (!this.isAdmissibleRequest(request)) return false
    if (this.couplings.hasMatch(request)) return false
    return resolveActionCandidates(this.state.composition, request.event)
      .some((candidate) => candidate.action.go !== undefined)
  }

  /** Checks the binding or external source before any route resolution occurs. */
  private isAdmissibleRequest(request: DispatchRequest<SceneKey>): boolean {
    if (request.binding !== undefined) return this.bindings.isCurrentBinding(request.binding)
    return request.event.sourceSceneKey === undefined
      || this.bindings.isAdmissibleExternalSource(request.event.sourceSceneKey)
  }

  /** Resolves a target and redirects denied entries through their declared escape. */
  async resolveAccessibleComposition(
    target: ActiveSelection<SceneKey, SlotName> | undefined,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<Readonly<{
    target: ActiveSelection<SceneKey, SlotName> | undefined
    selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>
  }> | undefined> {
    let candidateTarget = target
    const visited = new Set<string>()

    for (;;) {
      const desired = this.composition.buildDesiredComposition(candidateTarget)
      const denied = await this.findDeniedSelection(desired, event)
      if (denied === undefined) return { target: candidateTarget, selections: desired }

      const access = resolveAccessCondition(denied)
      if (access === undefined) return { target: candidateTarget, selections: desired }
      const fallback = access.onDenied === undefined
        ? this.resolveNavigationTarget({ direction: 'next' }, denied, 0)
        : this.resolveNavigationTarget(access.onDenied, denied, 0)
      if (fallback === undefined) {
        reportWarning(
          'SIGHTY_ACCESS_DENIED',
          `La vue Sighty « ${denied.entry.path} » est refusée et ne possède aucune échappatoire résolue.`,
        )
        return undefined
      }
      const visitKey = `${denied.slotAddress}:${fallback.entry.path}`
      if (visited.has(visitKey)) {
        reportWarning(
          'SIGHTY_ACCESS_REDIRECT_LOOP',
          `Les échappatoires d'accès Sighty forment une boucle autour de « ${denied.entry.path} ».`,
        )
        return undefined
      }
      visited.add(visitKey)
      candidateTarget = this.composition.withCurrentGeneration(fallback)
    }
  }

  /** Finds the routed view or the initial graph branch in one composition. */
  private findActiveSelection(
    target: ActiveSelection<SceneKey, SlotName> | undefined,
    selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): ActiveSelection<SceneKey, SlotName> | undefined {
    if (target !== undefined) {
      const routed = selections.get(target.slotAddress)
      if (routed !== undefined && isPathPrefix(target.entry.path, routed.entry.path)) return routed
    }

    const branchPath = target?.entry.path ?? this.state.initialAnchor?.path
    const candidates = [...selections.values()].filter((selection) => (
      branchPath === undefined || isPathPrefix(branchPath, selection.entry.path)
    ))
    candidates.sort((left, right) => right.entry.path.length - left.entry.path.length)
    return candidates[0]
  }

  /** Finds the first newly admitted selection whose access condition refuses it. */
  private async findDeniedSelection(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<ActiveSelection<SceneKey, SlotName> | undefined> {
    for (const selection of desired.values()) {
      const current = this.state.composition.selections.get(selection.slotAddress)
      if (current !== undefined && sameSelection(current, selection)) continue
      if (!await this.allowsAccess(selection, event)) return selection
    }
    return undefined
  }

  /** Blocks a transition when an outgoing view exit condition is false. */
  async allowsExit(
    previous: ActiveComposition<SceneKey, SlotName>,
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const checked = new Set<string>()

    for (const selection of previous.selections.values()) {
      const exit = resolveExitCondition(selection)
      const nextSelection = desired.get(selection.slotAddress)
      if (exit === undefined || (nextSelection !== undefined && sameSelection(selection, nextSelection))) continue
      const checkKey = `${selection.slotAddress}:${exit.path}`
      if (checked.has(checkKey)) continue
      checked.add(checkKey)
      if (!await this.allowsExitForSelection(selection, event, exit)) {
        reportWarning(
          'SIGHTY_EXIT_BLOCKED',
          `La sortie de la vue Sighty « ${exit.path} » est bloquée par sa condition.`,
        )
        return false
      }
    }
    return true
  }

  /** Resolves directional movement from the current pointer, bubbling at graph edges. */
  private resolveNavigationTarget(
    target: SightyRouteTarget,
    selection: ActiveSelection<SceneKey, SlotName>,
    generation: number,
    usePointer = false,
  ): ActiveSelection<SceneKey, SlotName> | undefined {
    if ('direction' in target && (target.direction === 'next' || target.direction === 'previous')) {
      const origin = usePointer ? this.currentPointerSelection() : selection
      return origin === undefined ? undefined : this.resolvePointer(target.direction, origin, generation)
    }
    return resolveRouteTarget(this.state.viewIndex, target, selection, generation)
  }

  /** Reads the pointer only while its view remains the active slot selection. */
  private currentPointerSelection(): ActiveSelection<SceneKey, SlotName> | undefined {
    if (this.activePointer === undefined) return undefined
    const current = this.state.composition.selections.get(this.activePointer.slotAddress)
    return current !== undefined && sameSelection(current, this.activePointer) ? current : undefined
  }

  /** Advances the active selection locally, then searches each parent graph. */
  private resolvePointer(
    direction: 'next' | 'previous',
    selection: ActiveSelection<SceneKey, SlotName>,
    generation: number,
  ): ActiveSelection<SceneKey, SlotName> | undefined {
    const local = resolveRouteTarget(this.state.viewIndex, { direction }, selection, generation)
    if (local !== undefined) return local

    const offset = direction === 'next' ? 1 : -1
    for (const parent of [...selection.entry.parentViews].reverse()) {
      const graph = this.state.viewIndex.graphs.get(parent.graphPath)
      const parentIndex = graph?.entries.findIndex((entry) => entry.path === parent.path) ?? -1
      if (graph === undefined || parentIndex < 0) continue

      const adjacent = graph.entries[parentIndex + offset]
      if (adjacent === undefined) continue

      const slot = this.state.viewIndex.slotsByAddress.get(`${adjacent.path}/${selection.slotName}`)
      if (slot !== undefined) {
        const targetEntry = direction === 'next'
          ? getStartEntry(this.state.viewIndex, slot.graphPath)
          : this.state.viewIndex.graphs.get(slot.graphPath)?.entries.at(-1)
        if (targetEntry !== undefined) {
          return createSelection(this.state.viewIndex, slot, targetEntry, generation)
        }
      }

      const containingSlot = findContainingSlot(this.state.viewIndex, adjacent.path)
      if (containingSlot !== undefined) {
        return createSelection(this.state.viewIndex, containingSlot, adjacent, generation)
      }
    }

    return undefined
  }

  /** Answers whether one authored view is admitted by its access condition. */
  async canAccessView(
    reference: SightyViewReference,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const target = resolveRouteTarget(this.state.viewIndex, reference, undefined, 0)
    if (target === undefined) return false
    return this.allowsAccess(this.composition.withCurrentGeneration(target), event)
  }

  /** Answers whether an active authored view passes its exit condition. */
  async canExitView(
    reference: SightyViewReference,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const target = resolveRouteTarget(this.state.viewIndex, reference, undefined, 0)
    if (target === undefined) return false
    const current = this.state.composition.selections.get(target.slotAddress)
    if (current === undefined || !sameSelection(current, target)) return false
    return this.allowsExitForSelection(current, event)
  }

  /** Reuses the navigation admission rule for active and incoming selections. */
  private async allowsAccess(
    selection: ActiveSelection<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const current = this.state.composition.selections.get(selection.slotAddress)
    if (current !== undefined && sameSelection(current, selection)) return true
    const access = resolveAccessCondition(selection)
    return access === undefined || this.evaluateCondition(access.condition, selection, event)
  }

  /** Evaluates one active selection's resolved exit condition. */
  private async allowsExitForSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
    exit = resolveExitCondition(selection),
  ): Promise<boolean> {
    return exit === undefined || this.evaluateCondition(exit.condition, selection, event)
  }

  /** Evaluates one inline guard or a guard named by the scenario. */
  async evaluateCondition(
    condition: SightyCondition<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const evaluator = typeof condition === 'function' ? condition : this.state.scenario.guards[condition]
    if (evaluator === undefined) {
      throw new Error(`Le guard Sighty « ${String(condition)} » n'est pas défini dans scenario.guards.`)
    }
    const resolvedData = this.resolveData(selection)
    const conditionContext: SightyConditionContext<SceneKey> = {
      event: {
        name: event.name,
        ...(event.sourceSceneKey === undefined ? {} : { sourceSceneKey: event.sourceSceneKey }),
        ...(event.data === undefined ? {} : { data: event.data }),
      },
      sceneKey: selection.sceneKey,
      data: resolvedData,
      context: this.state.context,
      state: this.readState(selection),
    }
    return Boolean(await evaluator(conditionContext))
  }

  /** Resolves static data visible from one active selection. */
  resolveData(selection: ActiveSelection<SceneKey, SlotName>): Readonly<Record<string, unknown>> {
    return resolveViewData(selection, this.state.scenario.data)
  }

  /** Reads the current logical state exposed by one CodPlay instance snapshot. */
  readState(selection: ActiveSelection<SceneKey, SlotName>): Readonly<Record<string, unknown>> {
    const snapshot = this.state.instances.get(occurrenceKeyForSelection(selection))?.snapshot.get()
    if (snapshot === null || snapshot === undefined) return {}
    const state: Record<string, unknown> = {}
    for (const item of snapshot.states) Object.assign(state, item.state)
    return state
  }

  /** Applies one context patch for guards and action handlers. */
  async applyContextPatch(patch: Readonly<Record<string, unknown>>): Promise<void> {
    this.state.context = { ...this.state.context, ...patch }
  }

  /** Delivers declared entry events to newly admitted selections. */
  async deliverEnteredEvents(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): Promise<void> {
    for (const selection of selections) {
      const entry = selection.entry.view.entry
      if (entry === undefined) continue
      const eventimes = Array.isArray(entry) ? entry : [entry]
      for (const eventime of eventimes) await this.events.sendToBinding(selection, eventime)
    }
  }

  /** Executes one scenario action after its declared route is active. */
  async executeAction(
    action: SightyActionKey | SightyActionHandler<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
  ): Promise<void> {
    const handler = typeof action === 'function' ? action : this.state.scenario.actions[action]
    if (handler === undefined) {
      throw new Error(`L'action Sighty « ${action} » n'est pas définie dans scenario.actions.`)
    }

    const resolvedData = this.resolveData(selection)
    await handler({
      event,
      data: resolvedData,
      context: this.state.context,
      state: this.readState(selection),
      scenarioState: this.requireScenarioState(),
      updateContext: (patch) => this.applyContextPatch(patch),
      send: (sceneKey, eventime, target) => this.events.sendToActiveScene(sceneKey, eventime, target),
    })
  }

  /** Returns the helper installed by the runtime controller. */
  private requireScenarioState(): SightyScenarioStateApi<SceneKey, SlotName> {
    if (this.scenarioState === undefined) {
      throw new Error('Le runtime Sighty n’a pas connecté son état de scénario.')
    }
    return this.scenarioState
  }
}
