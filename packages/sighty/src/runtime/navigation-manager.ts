import type {
  CodPlayPublicEvent,
} from 'codplay'
import {
  resolveAccessCondition,
  resolveExitCondition,
} from '../navigation/conditions'
import { resolveViewData, type ResolvedViewData } from '../navigation/data'
import { resolveRouteTarget } from '../navigation/composition'
import { resolveActionCandidates } from '../navigation/resolver'
import { sameSelection } from '../navigation/transition'
import type { ActiveComposition, ActiveSelection } from '../navigation/types'
import type {
  SightyCondition,
  SightyConditionContext,
} from '../types'
import { activeScopePaths, occurrenceKeyForSelection, reportWarning } from './helpers'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimeCompositionManager } from './composition-manager'
import { RuntimeCouplingManager } from './coupling-manager'
import { RuntimeSceneEventGateway } from './scene-event-gateway'
import { RuntimeTransitionManager } from './transition-manager'
import type { SightyRuntimeState } from './state'
import type { DispatchRequest, SightyRuntimeEvent } from './types'

/** Coordinates event routing, conditions, actions and live data delivery. */
export class RuntimeNavigationManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly composition: RuntimeCompositionManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly couplings: RuntimeCouplingManager<SceneKey, SlotName>
  private readonly transitions: RuntimeTransitionManager<SceneKey, SlotName>
  private readonly events: RuntimeSceneEventGateway<SceneKey, SlotName>

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

  /** Resolves one admitted event and executes its first valid authored action. */
  async dispatchNow(request: DispatchRequest<SceneKey>): Promise<boolean> {
    if (!this.isAdmissibleRequest(request)) return false
    if (await this.couplings.dispatch(request)) return true

    const candidates = resolveActionCandidates(this.state.composition, request.event)
    for (const candidate of candidates) {
      const { action } = candidate
      if (action.go !== undefined) {
        const rawTarget = resolveRouteTarget(this.state.viewIndex, action.go, candidate.selection, 0)
        if (rawTarget === undefined) {
          if ('direction' in action.go) continue
          return false
        }
        const target = this.composition.withCurrentGeneration(rawTarget)
        const desired = await this.resolveAccessibleComposition(target, request.event)
        if (desired === undefined) return false
        if (!await this.allowsExit(this.state.composition, desired, request.event)) return false
        await this.transitions.execute(desired, {
          entryBehavior: 'show',
          notify: true,
          deliverEnteredData: (selections) => this.deliverEnteredData(selections),
        })
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
  ): Promise<ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> | undefined> {
    let candidateTarget = target
    const visited = new Set<string>()

    for (;;) {
      const desired = this.composition.buildDesiredComposition(candidateTarget)
      const denied = await this.findDeniedSelection(desired, event)
      if (denied === undefined) return desired

      const access = resolveAccessCondition(denied)
      if (access === undefined) return desired
      const fallback = access.onDenied === undefined
        ? resolveRouteTarget(this.state.viewIndex, { direction: 'next' }, denied, 0)
        : resolveRouteTarget(this.state.viewIndex, access.onDenied, denied, 0)
      if (fallback === undefined) {
        reportWarning(
          this.state,
          'SIGHTY_ACCESS_DENIED',
          `La vue Sighty « ${denied.entry.path} » est refusée et ne possède aucune échappatoire résolue.`,
        )
        return undefined
      }
      const visitKey = `${denied.slotAddress}:${fallback.entry.path}`
      if (visited.has(visitKey)) {
        reportWarning(
          this.state,
          'SIGHTY_ACCESS_REDIRECT_LOOP',
          `Les échappatoires d'accès Sighty forment une boucle autour de « ${denied.entry.path} ».`,
        )
        return undefined
      }
      visited.add(visitKey)
      candidateTarget = this.composition.withCurrentGeneration(fallback)
    }
  }

  /** Finds the first newly admitted selection whose access condition refuses it. */
  private async findDeniedSelection(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<ActiveSelection<SceneKey, SlotName> | undefined> {
    for (const selection of desired.values()) {
      const current = this.state.composition.selections.get(selection.slotAddress)
      if (current !== undefined && sameSelection(current, selection)) continue
      const access = resolveAccessCondition(selection)
      if (access === undefined) continue
      if (!await this.evaluateCondition(access.condition, selection, event)) return selection
    }
    return undefined
  }

  /** Blocks a transition when an outgoing view exit condition is false. */
  async allowsExit(
    previous: ActiveComposition<SceneKey, SlotName>,
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const currentPaths = activeScopePaths(previous)
    const nextPaths = activeScopePaths(desired, this.state.layoutEntry?.path)
    const checked = new Set<string>()

    for (const selection of previous.selections.values()) {
      const exit = resolveExitCondition(selection)
      if (exit === undefined || nextPaths.has(exit.path)) continue
      const checkKey = `${selection.slotAddress}:${exit.path}`
      if (checked.has(checkKey)) continue
      checked.add(checkKey)
      if (!currentPaths.has(exit.path)) continue
      if (!await this.evaluateCondition(exit.condition, selection, event)) {
        reportWarning(
          this.state,
          'SIGHTY_EXIT_BLOCKED',
          `La sortie de la vue Sighty « ${exit.path} » est bloquée par sa condition.`,
        )
        return false
      }
    }
    return true
  }

  /** Evaluates one direct author function or catalogued condition reference. */
  async evaluateCondition(
    condition: SightyCondition<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const evaluator = typeof condition === 'function' ? condition : this.state.conditionCatalog[condition]
    if (evaluator === undefined) {
      throw new Error(`La condition Sighty « ${String(condition)} » n'est pas enregistrée dans le catalogue.`)
    }
    const resolvedData = this.resolveData(selection)
    const conditionContext: SightyConditionContext<SceneKey> = {
      event: {
        name: event.name,
        ...(event.sourceSceneKey === undefined ? {} : { sourceSceneKey: event.sourceSceneKey }),
        ...(event.data === undefined ? {} : { data: event.data }),
      },
      sceneKey: selection.sceneKey,
      data: resolvedData.values,
      context: this.state.context,
      state: this.readState(selection),
    }
    return Boolean(await evaluator(conditionContext))
  }

  /** Resolves data visible from one active selection. */
  resolveData(selection: ActiveSelection<SceneKey, SlotName>): ResolvedViewData {
    return resolveViewData(selection, this.state.scenario.data, this.state.context)
  }

  /** Reads the current logical state exposed by one CodPlay instance snapshot. */
  readState(selection: ActiveSelection<SceneKey, SlotName>): Readonly<Record<string, unknown>> {
    const snapshot = this.state.instances.get(occurrenceKeyForSelection(selection))?.snapshot.get()
    if (snapshot === null || snapshot === undefined) return {}
    const state: Record<string, unknown> = {}
    for (const item of snapshot.states) Object.assign(state, item.state)
    return state
  }

  /** Applies one context patch and refreshes live data bindings. */
  async applyContextPatch(patch: Readonly<Record<string, unknown>>): Promise<void> {
    this.state.context = { ...this.state.context, ...patch }
    await this.deliverLiveData()
  }

  /** Sends initial or live data to one active scene binding. */
  private async deliverData(
    selection: ActiveSelection<SceneKey, SlotName>,
    mode: 'entry' | 'live',
  ): Promise<void> {
    const resolved = this.resolveData(selection)
    const previous = this.state.deliveredData.get(selection.slotAddress) ?? {}
    const valuesByEvent = new Map<string, Record<string, unknown>>()
    const keys = [...resolved.declaredKeys]
      .filter((key) => mode === 'entry' || resolved.liveKeys.has(key))

    for (const key of keys) {
      if (mode === 'live' && Object.is(previous[key], resolved.values[key])) continue
      const eventName = resolved.events.get(key) ?? 'data:update'
      const values = valuesByEvent.get(eventName) ?? {}
      values[key] = resolved.values[key]
      valuesByEvent.set(eventName, values)
    }

    for (const [eventName, values] of valuesByEvent) {
      await this.events.sendToBinding(selection, {
        name: eventName,
        visibility: 'scene',
        data: values as CodPlayPublicEvent['data'],
      })
    }

    const delivered: Record<string, unknown> = {}
    for (const key of resolved.declaredKeys) delivered[key] = resolved.values[key]
    this.state.deliveredData.set(selection.slotAddress, delivered)
  }

  /** Delivers entry values to every newly admitted selection. */
  async deliverEnteredData(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): Promise<void> {
    for (const selection of selections) await this.deliverData(selection, 'entry')
  }

  /** Re-evaluates only live data bindings after context changes. */
  async deliverLiveData(): Promise<void> {
    for (const selection of this.state.composition.selections.values()) {
      const resolved = this.resolveData(selection)
      if (resolved.liveKeys.size === 0) continue
      await this.deliverData(selection, 'live')
    }
  }

  /** Executes one catalogued action after its declared route is active. */
  async executeAction(
    reference: string,
    event: SightyRuntimeEvent<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
  ): Promise<void> {
    const handler = this.state.actionCatalog[reference]
    if (handler === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }

    const resolvedData = this.resolveData(selection)
    await handler({
      event,
      data: resolvedData.values,
      context: this.state.context,
      state: this.readState(selection),
      updateContext: (patch) => this.applyContextPatch(patch),
      send: (sceneKey, eventime, target) => this.events.sendToActiveScene(sceneKey, eventime, target),
    })
  }
}
