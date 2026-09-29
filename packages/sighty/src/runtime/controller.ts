import { resolveInitialAnchor } from '../navigation/composition'
import type { CodPlayInstance } from 'codplay'
import type { SightyRuntimeEvent, SightyScenarioApi, SightyScenarioStateApi } from '../types'
import { validateScenarioActions, validateScenarioGuards } from './scenario-validation'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimeCompositionManager } from './composition-manager'
import { RuntimeCouplingManager } from './coupling-manager'
import { RuntimeMutationManager } from './mutation-manager'
import { RuntimeNavigationManager } from './navigation-manager'
import { RuntimeNavigationStateMachine } from './navigation-state-machine'
import { RuntimeOperationCoordinator } from './operation-coordinator'
import { RuntimePresentationManager } from './presentation-manager'
import { RuntimeSceneEventGateway } from './scene-event-gateway'
import { RuntimeSceneManager } from './scene-manager'
import { SightyScenarioState } from './scenario-state'
import { RuntimeTransitionManager } from './transition-manager'
import { createRuntimeState, getLayoutSceneKey, type SightyRuntimeState } from './state'
import type {
  DispatchRequest,
  SightyRuntimeApi,
  SightyRuntimeConfiguration,
  SightyRuntimeOptions,
  SightyRuntimeSlotChangeListener,
} from './types'
import { diagnosticDetails, reportWarning, uniqueSlotNames } from './helpers'

/** Orchestrates the focused runtime services behind the public Sighty API. */
class SightyRuntimeController<SceneKey extends string, SlotName extends string>
  implements SightyRuntimeApi<SceneKey, SlotName> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly operations = new RuntimeOperationCoordinator()
  private readonly navigationState = new RuntimeNavigationStateMachine()
  private readonly scenes: RuntimeSceneManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly presentation: RuntimePresentationManager<SceneKey, SlotName>
  private readonly composition: RuntimeCompositionManager<SceneKey, SlotName>
  private readonly transitions: RuntimeTransitionManager<SceneKey, SlotName>
  private readonly couplings: RuntimeCouplingManager<SceneKey, SlotName>
  private readonly navigation: RuntimeNavigationManager<SceneKey, SlotName>
  private readonly mutations: RuntimeMutationManager<SceneKey, SlotName>
  private readonly scenarioStateApi: SightyScenarioStateApi<SceneKey, SlotName>

  /** Creates one runtime and wires its focused services together. */
  constructor(options: SightyRuntimeOptions<SceneKey, SlotName>) {
    this.state = createRuntimeState(options)
    this.scenes = new RuntimeSceneManager(this.state)
    this.bindings = new RuntimeBindingManager(this.state, (request) => this.enqueue(request))
    this.presentation = new RuntimePresentationManager(this.state)
    const events = new RuntimeSceneEventGateway(this.state, this.bindings)
    this.composition = new RuntimeCompositionManager(
      this.state,
      this.scenes,
      this.bindings,
      this.presentation,
      (slotName, sceneKey) => this.notifySlotChange(slotName, sceneKey),
    )
    this.transitions = new RuntimeTransitionManager(this.state, this.scenes, this.composition)
    this.couplings = new RuntimeCouplingManager(
      this.state,
      (binding) => this.bindings.isCurrentBinding(binding),
    )
    this.navigation = new RuntimeNavigationManager(
      this.state,
      this.composition,
      this.bindings,
      this.couplings,
      this.transitions,
      events,
    )
    this.scenarioStateApi = new SightyScenarioState({
      active: () => this.navigation.active,
      current: () => [...this.state.composition.selections.values()].map((selection) => ({
        slotName: selection.slotName,
        view: { path: selection.entry.path },
        sceneKey: selection.sceneKey,
      })),
      context: () => this.state.context,
      canAccess: (reference, event) => this.navigation.canAccessView(reference, event),
      canExit: (reference, event) => this.navigation.canExitView(reference, event),
    })
    this.navigation.setScenarioState(this.scenarioStateApi)
    this.mutations = new RuntimeMutationManager(
      this.state,
      this.scenes,
      this.composition,
      this.bindings,
      this.navigation,
      this.transitions,
      () => this.ensureInstanceIds(),
      () => this.validateScenarioDefinitions(),
    )
  }

  /** Exposes the host-facing event observation surface. */
  get events() {
    return this.state.publicEventChannel.api
  }

  /** Exposes the active scenario state and its navigation guard decisions. */
  get scenarioState(): SightyScenarioStateApi<SceneKey, SlotName> {
    return this.scenarioStateApi
  }

  /** Returns scene keys referenced by the normalized author graph. */
  get sceneKeys(): readonly SceneKey[] {
    return this.state.authoredSceneKeys
  }

  /** Returns distinct slot names declared by the author graph. */
  get slotNames(): readonly SlotName[] {
    return uniqueSlotNames(this.state.viewIndex.slots)
  }

  /** Returns one live CodPlay instance by its authored scene key. */
  getInstance(sceneKey: SceneKey) {
    const active = this.scenes.findActiveInstances(sceneKey)
    if (active.length === 1) return active[0]
    return undefined
  }

  /** Returns the live CodPlay instance attached to one exact slot address. */
  getInstanceAt(slotAddress: string) {
    return this.scenes.getInstanceAt(slotAddress)
  }

  /** Validates, prepares and mounts the initial authored composition. */
  async initialize(): Promise<void> {
    if (this.state.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (this.state.initialized) return

    try {
      const diagnostics = this.state.scenario.validate()
      if (diagnostics.length > 0) {
        throw new Error(`Le fichier auteur Sighty est invalide. ${diagnosticDetails(diagnostics)}`)
      }
      this.validateScenarioDefinitions()
      this.state.layoutEntry = this.composition.requireLayoutEntry()
      this.state.initialAnchor = resolveInitialAnchor(this.state.viewIndex, this.state.layoutEntry)
      this.ensureInstanceIds()

      const builds = this.scenes.compileDirectScenes()
      for (const [sceneKey, build] of builds) this.state.compiledBuilds.set(sceneKey, build)
      await this.scenes.preloadScenes(builds)
      this.scenes.installStyles()

      const resolved = await this.navigation.resolveAccessibleComposition(undefined, {
        name: 'runtime:initialize',
      })
      if (resolved === undefined) throw new Error('La composition initiale Sighty est refusée.')
      this.state.layoutGeneration = 1
      this.state.initialized = true
      await this.transitions.execute(resolved.selections, {
        entryBehavior: 'none',
        notify: true,
        onPrepared: () => this.bindings.openLayoutBinding(),
        deliverEnteredEvents: (selections) => this.navigation.deliverEnteredEvents(selections),
      })
      this.navigation.setActiveSelection(resolved.target, resolved.selections)
    } catch (error: unknown) {
      this.mutations.rollbackInitialization()
      throw error
    }
  }

  /** Queues one host event behind the single navigation coordinator. */
  dispatch(event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    if (this.state.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.state.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueue({ event })
  }

  /** Serializes one navigation request and preserves rejection boundaries. */
  private enqueue(request: DispatchRequest<SceneKey>): Promise<boolean> {
    const transitionIntent = this.navigation.isTransitionRequest(request)
    const lease = transitionIntent
      ? this.navigationState.acquireTransition()
      : undefined
    if (transitionIntent && lease === undefined) return Promise.resolve(false)

    return this.operations.enqueue(async () => {
      try {
        return await this.navigation.dispatchNow(request)
      } finally {
        if (lease !== undefined) this.navigationState.releaseTransition(lease)
      }
    })
  }

  /** Serializes one non-navigation runtime operation. */
  private enqueueOperation<Result>(operation: () => Promise<Result> | Result): Promise<Result> {
    return this.operations.enqueue(operation)
  }

  /** Applies a host context patch for later guard and action evaluation. */
  updateContext(patch: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.state.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.state.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.navigation.applyContextPatch(patch))
  }

  /** Recreates current occurrences from the initial runtime state. */
  reset(): Promise<void> {
    if (this.state.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.state.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.mutations.resetNow())
  }

  /** Applies one validated scenario mutation using the selected policy. */
  mutate(
    mutation: import('../types').SightyScenarioMutation<SceneKey, SlotName>,
    policy: import('../types').SightyMutationReloadPolicy = 'preserve',
  ): Promise<boolean> {
    if (this.state.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.state.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.mutations.mutateNow(mutation, policy))
  }

  /** Returns the scene selected in one public slot. */
  getMountedSceneKey(slotName: SlotName): SceneKey | undefined {
    return this.composition.getMountedSceneKey(slotName)
  }

  /** Subscribes to selection changes in one public slot name. */
  onSlotChange(slotName: SlotName, listener: SightyRuntimeSlotChangeListener<SceneKey>): () => void {
    const listeners = this.state.slotChangeListeners.get(slotName) ?? new Set()
    listeners.add(listener)
    this.state.slotChangeListeners.set(slotName, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.state.slotChangeListeners.delete(slotName)
    }
  }

  /** Starts an active scene occurrence and all active scenes nested beneath it. */
  play(sceneKey: SceneKey): Promise<void> {
    return this.enqueueOperation(() => this.playNow(sceneKey))
  }

  /** Starts selected scene occurrences in authored order. */
  playAll(sceneKeys: readonly SceneKey[] = this.state.authoredSceneKeys): Promise<void> {
    return this.enqueueOperation(async () => {
      this.requireInitialized()
      for (const sceneKey of sceneKeys) await this.playOneNow(sceneKey)
    })
  }

  /** Starts an active scene occurrence and the active scenes nested beneath its view. */
  private async playNow(sceneKey: SceneKey): Promise<void> {
    this.requireInitialized()

    let instance: CodPlayInstance | undefined
    let viewPath: string | undefined
    if (sceneKey === getLayoutSceneKey(this.state)) {
      const layoutEntry = this.state.layoutEntry
      if (layoutEntry === undefined) throw new Error('La vue layout Sighty est absente.')
      instance = this.scenes.getInstanceAt(layoutEntry.path)
      viewPath = layoutEntry.path
    } else {
      const selections = [...this.state.composition.selections.values()]
        .filter((selection) => selection.sceneKey === sceneKey)
      const selection = selections.length === 1 ? selections[0] : undefined
      instance = selection === undefined ? undefined : this.scenes.getInstanceForSelection(selection)
      viewPath = selection?.sceneEntry.path
    }

    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    if (viewPath === undefined) {
      await instance.telco.play()
      return
    }
    const descendants = [...this.state.composition.selections.values()]
      .filter((selection) => selection.sceneEntry.parentViews.some((parent) => parent.path === viewPath))
      .sort((first, second) => first.sceneEntry.parentViews.length - second.sceneEntry.parentViews.length)
    const childInstances = descendants.map((selection) => {
      const child = this.scenes.getInstanceForSelection(selection)
      if (child === undefined) throw new Error(`L’instance Sighty ${selection.sceneKey} est absente.`)
      return child
    })
    await instance.telco.play()
    for (const child of childInstances) await child.telco.play()
  }

  /** Starts one active occurrence without traversing its nested selections. */
  private async playOneNow(sceneKey: SceneKey): Promise<void> {
    const instance = this.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.play()
  }

  /** Releases mounts, subscriptions, occurrences, resources and the owner. */
  destroy(): void {
    if (this.state.destroyed) return
    this.state.destroyed = true
    this.state.transitioning = true
    this.bindings.closeAllBindings()
    for (const cleanup of this.state.cleanups.splice(0)) cleanup()
    this.state.publicEventChannel.clear()
    this.composition.detachAllMounts()
    this.state.composition = {
      revision: this.state.composition.revision + 1,
      layoutPath: this.state.composition.layoutPath,
      selections: new Map(),
    }
    this.scenes.destroyInstances()
    this.state.owner.preload.release(this.state.resourceUrls)
    this.state.owner.destroy()
    this.state.instances.clear()
    this.state.instanceSceneKeys.clear()
    this.state.slotChangeListeners.clear()
    this.state.initialized = false
  }

  /** Ensures one operation runs only on a live initialized runtime. */
  private requireInitialized(): void {
    if (this.state.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (!this.state.initialized) throw new Error('Le runtime Sighty n’est pas initialisé.')
  }

  /** Validates the scenario's named actions and guards against its view graph. */
  private validateScenarioDefinitions(): void {
    validateScenarioActions(this.state)
    validateScenarioGuards(this.state)
  }

  /** Ensures every referenced scene has one stable CodPlay instance identity. */
  private ensureInstanceIds(): void {
    for (const sceneKey of this.state.authoredSceneKeys) {
      const instanceId = this.state.instanceIds[sceneKey]
      if (typeof instanceId !== 'string' || instanceId.length === 0) {
        throw new Error(`L’identifiant d’instance Sighty de la scène ${sceneKey} est absent.`)
      }
    }
  }

  /** Notifies slot listeners while isolating listener failures. */
  private notifySlotChange(slotName: SlotName, sceneKey: SceneKey | undefined): void {
    for (const listener of [...(this.state.slotChangeListeners.get(slotName) ?? [])]) {
      try {
        listener(sceneKey)
      } catch (error: unknown) {
        reportWarning('SIGHTY_SLOT_LISTENER_FAILED', error)
      }
    }
  }
}

/** Creates the runtime sub-surface owned by one Sighty facade. */
export function createSightyRuntime<SceneKey extends string = string, SlotName extends string = string>(
  scenario: SightyScenarioApi<SceneKey, SlotName>,
  options: SightyRuntimeConfiguration<SceneKey>,
): SightyRuntimeApi<SceneKey, SlotName> {
  return new SightyRuntimeController({ scenario, ...options })
}
