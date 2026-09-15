import {
  CodPlay,
  resolveSlotManifestEntry,
  slotManifest,
  type CodPlayCompileSuccess,
  type CodPlayEventime,
  type CodPlayEventimeTarget,
  type CodPlayInstance,
  type CodPlayInstanceHostTarget,
  type CodPlayInstanceMountHandle,
  type CodPlayInstanceMountReplace,
  type CodPlayOptions,
  type CodPlayPublicEvent,
  type CodPlayResourceRegistration,
  type CodPlayTraceEvent,
  type RuntimePreloadMode,
} from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { createSightyPublicEventChannel, type SightyPublicEvent, type SightyPublicEvents } from './public-events'
import {
  createViewIndex,
  getStartEntry,
  isPathPrefix,
} from './navigation/graph-index'
import { resolveAccessCondition, resolveExitCondition } from './navigation/conditions'
import { resolveViewData, type ResolvedViewData } from './navigation/data'
import {
  buildComposition,
  createSelection,
  resolveInitialAnchor,
  resolveRouteTarget,
} from './navigation/composition'
import { resolveActionCandidates } from './navigation/resolver'
import { planCompositionTransition } from './navigation/transition'
import type {
  ActiveComposition,
  ActiveSelection,
  IndexedEntry,
  IndexedSlot,
  ViewIndex,
} from './navigation/types'
import type {
  SightyCondition,
  SightyConditionContext,
  SightyConditionFunction,
  SightyMutationReloadPolicy,
  SightyRouteTarget,
  SightyScenarioMutation,
  SightyScenarioApi,
  SightyViewAction,
} from './types'
import type { SightyMutableScenarioApi, SightyScenarioMutationResult } from './scenario'

/** Identifies the authored layout used as the host of one runtime composition. */
export type SightyRuntimeLayout<SceneKey extends string = string> = Readonly<{
  sceneKey: SceneKey
  storyId: string
}>

/** Describes one stylesheet that the runtime must install before materialization. */
export type SightyRuntimeStyle = Readonly<{
  slot: string
  cssText: string
}>

/** Describes a non-fatal preload notification exposed to the application. */
export type SightyRuntimeWarning = Readonly<{
  code: string
  message: string
}>

/** Describes an event received by the Sighty scenario router. */
export type SightyRuntimeEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
  data?: CodPlayPublicEvent['data']
}>

/** Provides the event and the scene-message port to one external action. */
export type SightyActionContext<SceneKey extends string = string> = Readonly<{
  event: SightyRuntimeEvent<SceneKey>
  data: Readonly<Record<string, unknown>>
  context: Readonly<Record<string, unknown>>
  state: Readonly<Record<string, unknown>>
  updateContext: (patch: Readonly<Record<string, unknown>>) => Promise<void>
  send: (
    sceneKey: SceneKey,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
  ) => Promise<void>
}>

/** Defines one executable action kept outside the declarative route graph. */
export type SightyActionHandler<SceneKey extends string = string> = (
  context: SightyActionContext<SceneKey>,
) => void | Promise<void>

/** Associates an authored action reference with its application-owned handler. */
export type SightyActionCatalog<SceneKey extends string = string> = Readonly<
  Record<string, SightyActionHandler<SceneKey>>
>

/** Associates an author condition reference with an application-owned function. */
export type SightyConditionCatalog<SceneKey extends string = string> = Readonly<
  Record<string, SightyConditionFunction<SceneKey>>
>

/** Receives the scene key selected in one authored layout slot. */
export type SightyRuntimeSlotChangeListener<SceneKey extends string = string> = (
  sceneKey: SceneKey | undefined,
) => void

/** Configures the generic CodPlay execution grouped under one Sighty facade. */
export type SightyRuntimeConfiguration<SceneKey extends string = string> = Readonly<{
  root: HTMLElement
  instanceIds: Readonly<Record<SceneKey, string>>
  layout: SightyRuntimeLayout<SceneKey>
  actionCatalog?: SightyActionCatalog<SceneKey>
  conditionCatalog?: SightyConditionCatalog<SceneKey>
  context?: Readonly<Record<string, unknown>>
  preloadMode?: RuntimePreloadMode
  styles?: readonly SightyRuntimeStyle[]
  codplay?: CodPlayOptions
  onTrace?: (sceneKey: SceneKey, event: CodPlayTraceEvent) => void
  onPreloadWarning?: (warning: SightyRuntimeWarning) => void
}>

/** Exposes runtime operations through the Sighty facade. */
export type SightyRuntimeApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  sceneKeys: readonly SceneKey[]
  slotNames: readonly SlotName[]
  events: SightyPublicEvents<SceneKey>
  getInstance: (sceneKey: SceneKey) => CodPlayInstance | undefined
  initialize: () => Promise<void>
  dispatch: (event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
  updateContext: (patch: Readonly<Record<string, unknown>>) => Promise<void>
  reset: () => Promise<void>
  mutate: (
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
    policy?: SightyMutationReloadPolicy,
  ) => Promise<boolean>
  mountSlot: (slotName: SlotName, childSceneKey?: SceneKey) => void
  detachSlot: (slotName: SlotName) => void
  isSlotMounted: (slotName: SlotName) => boolean
  getMountedSceneKey: (slotName: SlotName) => SceneKey | undefined
  onSlotChange: (
    slotName: SlotName,
    listener: SightyRuntimeSlotChangeListener<SceneKey>,
  ) => () => void
  play: (sceneKey: SceneKey) => Promise<void>
  playAll: (sceneKeys?: readonly SceneKey[]) => Promise<void>
  destroy: () => void
}>

type SightyRuntimeOptions<
  SceneKey extends string,
  SlotName extends string,
> = SightyRuntimeConfiguration<SceneKey> & Readonly<{
  scenario: SightyScenarioApi<SceneKey, SlotName>
}>

type SightyRuntimeBuilds<SceneKey extends string> = ReadonlyMap<SceneKey, CodPlayCompileSuccess>

type RuntimeBinding<SceneKey extends string> = Readonly<{
  slotAddress: string
  sceneKey: SceneKey
  generation: number
}>

type DispatchRequest<SceneKey extends string> = Readonly<{
  event: SightyRuntimeEvent<SceneKey>
  binding?: RuntimeBinding<SceneKey>
}>

type SynchronizationResult<SceneKey extends string, SlotName extends string> = Readonly<{
  entered: readonly ActiveSelection<SceneKey, SlotName>[]
  previousSceneKeys: ReadonlySet<SceneKey>
  changed: boolean
  previous: ActiveComposition<SceneKey, SlotName>
  next: ActiveComposition<SceneKey, SlotName>
}>

type MountedState = Readonly<{
  wasPlaying: boolean
}>

type ResolvedMount = Readonly<{
  host: CodPlayInstanceHostTarget
  childInstanceId: string
  replace?: CodPlayInstanceMountReplace
}>

/** Executes one authored Sighty graph through one CodPlay owner. */
class SightyRuntimeController<
  SceneKey extends string = string,
  SlotName extends string = string,
> implements SightyRuntimeApi<SceneKey, SlotName> {
  private readonly scenario: SightyScenarioApi<SceneKey, SlotName>
  private readonly mutableScenario: SightyMutableScenarioApi<SceneKey, SlotName>
  private readonly root: HTMLElement
  private readonly instanceIds: Readonly<Record<SceneKey, string>>
  private readonly layout: SightyRuntimeLayout<SceneKey>
  private readonly actionCatalog: SightyActionCatalog<SceneKey>
  private readonly conditionCatalog: SightyConditionCatalog<SceneKey>
  private readonly initialContext: Readonly<Record<string, unknown>>
  private readonly preloadMode: RuntimePreloadMode
  private readonly styles: readonly SightyRuntimeStyle[]
  private readonly onTrace: SightyRuntimeOptions<SceneKey, SlotName>['onTrace']
  private readonly onPreloadWarning: SightyRuntimeOptions<SceneKey, SlotName>['onPreloadWarning']
  private viewIndex: ViewIndex<SceneKey, SlotName>
  private authoredSceneKeys: readonly SceneKey[]
  private readonly owner: CodPlay
  private readonly publicEventChannel = createSightyPublicEventChannel<SceneKey>()
  private readonly instances = new Map<SceneKey, CodPlayInstance>()
  private readonly mounts = new Map<string, CodPlayInstanceMountHandle>()
  private readonly mountTargets = new Map<string, CodPlayInstanceHostTarget>()
  private readonly activeBindings = new Map<string, RuntimeBinding<SceneKey>>()
  private readonly bindingCleanups = new Map<string, () => void>()
  private readonly slotChangeListeners = new Map<SlotName, Set<SightyRuntimeSlotChangeListener<SceneKey>>>()
  private readonly cleanups: Array<() => void> = []
  private readonly generationCounters = new Map<string, number>()
  private readonly compiledBuilds = new Map<SceneKey, CodPlayCompileSuccess>()
  private readonly sceneDocuments = new Map<SceneKey, SceneDoc<string>>()
  private readonly resourceUrlsByScene = new Map<SceneKey, readonly string[]>()
  private readonly deliveredData = new Map<string, Readonly<Record<string, unknown>>>()
  private readonly navigationChain: { current: Promise<unknown> } = { current: Promise.resolve() }
  private layoutEntry: IndexedEntry<SceneKey, SlotName> | undefined
  private initialAnchor: IndexedEntry<SceneKey, SlotName> | undefined
  private composition: ActiveComposition<SceneKey, SlotName>
  private context: Readonly<Record<string, unknown>>
  private resourceUrls: readonly string[] = []
  private layoutGeneration = 0
  private initialized = false
  private transitioning = false
  private destroyed = false

  /** Creates one runtime bound to one scenario and one visible root. */
  constructor(options: SightyRuntimeOptions<SceneKey, SlotName>) {
    this.scenario = options.scenario
    this.mutableScenario = options.scenario as SightyMutableScenarioApi<SceneKey, SlotName>
    this.root = options.root
    this.instanceIds = options.instanceIds
    this.layout = options.layout
    this.actionCatalog = options.actionCatalog ?? {}
    this.conditionCatalog = options.conditionCatalog ?? {}
    this.initialContext = { ...(options.context ?? {}) }
    this.context = { ...this.initialContext }
    this.preloadMode = options.preloadMode ?? 'author'
    this.styles = options.styles ?? []
    this.onTrace = options.onTrace
    this.onPreloadWarning = options.onPreloadWarning
    this.viewIndex = createViewIndex(this.scenario.getViewGraph())
    this.layoutEntry = this.viewIndex.entriesByScene.get(this.layout.sceneKey)?.[0]
    this.authoredSceneKeys = collectSceneKeys(this.viewIndex)
    this.owner = new CodPlay(options.codplay)
    this.composition = {
      revision: 0,
      layoutPath: this.layoutEntry?.path ?? '',
      selections: new Map(),
    }
  }

  /** Exposes the host-facing event observation surface. */
  get events(): SightyPublicEvents<SceneKey> {
    return this.publicEventChannel.api
  }

  /** Returns the scene keys referenced by the normalized author graph. */
  get sceneKeys(): readonly SceneKey[] {
    return this.authoredSceneKeys
  }

  /** Returns the distinct slot names declared by the author graph. */
  get slotNames(): readonly SlotName[] {
    return uniqueSlotNames(this.viewIndex.slots)
  }

  /** Returns one live CodPlay instance by its authored scene key. */
  getInstance(sceneKey: SceneKey): CodPlayInstance | undefined {
    return this.instances.get(sceneKey)
  }

  /** Compiles, prepares, creates and mounts the initial authored composition. */
  async initialize(): Promise<void> {
    if (this.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (this.initialized) return

    try {
      const diagnostics = this.scenario.validate()
      if (diagnostics.length > 0) {
        throw new Error(`Le fichier auteur Sighty est invalide. ${diagnosticDetails(diagnostics)}`)
      }
      this.validateActionCatalog()
      this.validateConditionCatalog()
      this.layoutEntry = this.requireLayoutEntry()
      this.initialAnchor = resolveInitialAnchor(this.viewIndex, this.layoutEntry)
      this.ensureInstanceIds()

      const builds = this.compileDirectScenes()
      for (const [sceneKey, build] of builds) this.compiledBuilds.set(sceneKey, build)
      await this.preloadScenes(builds)
      this.installStyles()
      this.createInstances(builds)

      const desired = await this.resolveAccessibleComposition(undefined, {
        name: 'runtime:initialize',
      })
      if (desired === undefined) {
        throw new Error('La composition initiale Sighty est refusée.')
      }
      await this.ensureScenesForComposition(desired)
      this.layoutGeneration = 1
      this.initialized = true
      this.openLayoutBinding()

      const synchronization = this.synchronizeComposition(desired, true)
      await this.deliverEnteredData(synchronization.entered)
      if (synchronization.changed) this.initialized = true
    } catch (error: unknown) {
      this.rollbackInitialization()
      throw error
    }
  }

  /** Restores the pristine runtime state after an incomplete initialization. */
  private rollbackInitialization(): void {
    this.closeAllBindings()
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountTargets.clear()
    for (const sceneKey of [...this.instances.keys()].reverse()) {
      this.owner.instances.destroy(this.instanceIds[sceneKey])
    }
    this.instances.clear()
    this.owner.preload.cancel()
    this.owner.preload.release(this.resourceUrls)
    this.owner.preload.css.clear()
    this.resourceUrls = []
    this.resourceUrlsByScene.clear()
    this.compiledBuilds.clear()
    this.sceneDocuments.clear()
    this.deliveredData.clear()
    this.context = { ...this.initialContext }
    this.composition = {
      revision: this.composition.revision + 1,
      layoutPath: this.layoutEntry?.path ?? '',
      selections: new Map(),
    }
    this.layoutGeneration = 0
    this.initialAnchor = undefined
    this.generationCounters.clear()
    this.initialized = false
    this.transitioning = false
  }

  /** Compiles every synchronously supplied scene without invoking deferred sources. */
  private compileDirectScenes(): SightyRuntimeBuilds<SceneKey> {
    const builds = new Map<SceneKey, CodPlayCompileSuccess>()
    for (const sceneKey of this.authoredSceneKeys) {
      const scene = this.scenario.getScene(sceneKey)
      if (scene === undefined) continue
      this.sceneDocuments.set(sceneKey, scene)
      const result = this.owner.build({ scene })
      if (!result.ok) {
        throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
      }
      builds.set(sceneKey, result)
    }
    return builds
  }

  /** Compiles, preloads and creates one deferred scene at the moment it is selected. */
  private async ensureScene(sceneKey: SceneKey): Promise<void> {
    const existingBuild = this.compiledBuilds.get(sceneKey)
    if (existingBuild !== undefined) {
      if (!this.instances.has(sceneKey)) this.createInstance(sceneKey, existingBuild)
      return
    }

    const scene = await this.scenario.resolveScene(sceneKey)
    if (scene === undefined) throw new Error(`La ressource de scène Sighty ${sceneKey} est absente.`)
    this.sceneDocuments.set(sceneKey, scene)
    const result = this.owner.build({ scene })
    if (!result.ok) {
      throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
    }
    this.compiledBuilds.set(sceneKey, result)
    await this.preloadScenes(new Map([[sceneKey, result]]))
    this.createInstance(sceneKey, result)
  }

  /** Ensures all scenes needed by a target composition, including the layout. */
  private async ensureScenesForComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): Promise<void> {
    const sceneKeys = new Set<SceneKey>([this.layout.sceneKey])
    for (const selection of desired.values()) sceneKeys.add(selection.sceneKey)
    for (const sceneKey of sceneKeys) await this.ensureScene(sceneKey)
  }

  /** Preloads the compiled resources in one set and transfers them to CodPlay. */
  private async preloadScenes(builds: SightyRuntimeBuilds<SceneKey>): Promise<void> {
    const entries = [...builds.entries()]
    const manifests = entries.map(([, build]) => build.compiledScene.resources)
    const urls = [...new Set(manifests.flatMap((manifest) => manifest.entries.map((entry) => entry.url)))]
    for (const [sceneKey, build] of entries) {
      const sceneUrls = build.compiledScene.resources.entries.map((entry) => entry.url)
      this.resourceUrlsByScene.set(sceneKey, [...new Set(sceneUrls)])
    }
    this.resourceUrls = [...new Set([...this.resourceUrls, ...urls])]
    if (urls.length === 0) return

    const result = await this.owner.preload.load({
      manifest: manifests,
      options: { mode: this.preloadMode, container: this.root },
    })
    if (!result.ok) throw new Error(`Le préchargement Sighty a échoué : ${result.error.message}`)

    const registration: CodPlayResourceRegistration = {
      loaded: result.data.loaded,
      skipped: result.data.skipped,
      metadata: result.data.metadata,
      ...(result.data.media === undefined ? {} : { media: result.data.media }),
    }
    this.owner.resources.register(registration)
    for (const warning of result.data.warnings ?? []) this.onPreloadWarning?.(warning)
  }

  /** Installs configured styles through CodPlay's scoped CSS channel. */
  private installStyles(): void {
    for (const style of this.styles) {
      this.owner.preload.css.set({
        slot: style.slot,
        cssText: style.cssText,
        container: this.root,
      })
    }
  }

  /** Creates one CodPlay instance for every authored scene. */
  private createInstances(builds: SightyRuntimeBuilds<SceneKey>): void {
    for (const [sceneKey, build] of builds) this.createInstance(sceneKey, build)
  }

  /** Creates one scene occurrence once its compiled definition is available. */
  private createInstance(sceneKey: SceneKey, build: CodPlayCompileSuccess): void {
    if (this.instances.has(sceneKey)) return
    const instanceId = this.instanceIds[sceneKey]
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      throw new Error(`L’identifiant d’instance Sighty de la scène ${sceneKey} est absent.`)
    }
    const instance = this.owner.instances.create({
      instanceId,
      compiledScene: build.compiledScene,
      functions: build.functions,
      ...(sceneKey === this.layout.sceneKey ? { root: this.root } : {}),
    })
    this.instances.set(sceneKey, instance)
    this.observeInstance(instance, sceneKey)
  }

  /** Connects CodPlay diagnostics and public scene events to Sighty. */
  private observeInstance(instance: CodPlayInstance, sceneKey: SceneKey): void {
    const onTrace = this.onTrace
    if (onTrace !== undefined) {
      this.cleanups.push(instance.diagnostic.onTrace((event) => onTrace(sceneKey, event)))
    }
  }

  /** Adapts one active CodPlay event, publishes it and queues it for routing. */
  private receivePublicEvent(binding: RuntimeBinding<SceneKey>, event: CodPlayPublicEvent): void {
    if (!this.isCurrentBinding(binding)) return
    const publicEvent: SightyPublicEvent<SceneKey> = {
      name: event.name,
      sourceSceneKey: binding.sceneKey,
      data: event.data,
    }
    const task = this.enqueue({ event: publicEvent, binding })
    for (const error of this.publicEventChannel.publish(publicEvent)) {
      this.reportWarning('SIGHTY_EVENT_LISTENER_FAILED', error)
    }
    void task.catch((error: unknown) => {
      if (!this.destroyed) this.reportWarning('SIGHTY_NAVIGATION_FAILED', error)
    })
  }

  /** Queues one external event behind the single navigation coordinator. */
  dispatch(event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    if (this.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueue({ event })
  }

  /** Serializes one request and preserves the previous request's rejection boundary. */
  private enqueue(request: DispatchRequest<SceneKey>): Promise<boolean> {
    const task = this.navigationChain.current.then(() => this.dispatchNow(request))
    this.navigationChain.current = task.then(() => undefined, () => undefined)
    return task
  }

  /** Serializes one non-navigation runtime operation behind active transitions. */
  private enqueueOperation<Result>(operation: () => Promise<Result> | Result): Promise<Result> {
    const task = this.navigationChain.current.then(operation)
    this.navigationChain.current = task.then(() => undefined, () => undefined)
    return task
  }

  /** Applies a host context patch and refreshes all active live data bindings. */
  updateContext(patch: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.applyContextPatch(patch))
  }

  /** Recreates the initialized occurrences while retaining the scenario resources. */
  reset(): Promise<void> {
    if (this.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.resetNow())
  }

  /** Applies one validated scenario mutation and reconciles its active composition. */
  mutate(
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
    policy: SightyMutationReloadPolicy = 'preserve',
  ): Promise<boolean> {
    if (this.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    return this.enqueueOperation(() => this.mutateNow(mutation, policy))
  }

  /** Resolves one admitted event and executes its first valid authored action. */
  private async dispatchNow(request: DispatchRequest<SceneKey>): Promise<boolean> {
    if (request.binding !== undefined && !this.isCurrentBinding(request.binding)) return false
    if (request.binding === undefined
      && request.event.sourceSceneKey !== undefined
      && !this.isAdmissibleExternalSource(request.event.sourceSceneKey)) return false

    const candidates = resolveActionCandidates(this.composition, request.event)
    for (const candidate of candidates) {
      const { action } = candidate
      if (action.go !== undefined) {
        const rawTarget = resolveRouteTarget(this.viewIndex, action.go, candidate.selection, 0)
        if (rawTarget === undefined) {
          if (isDirectionalTarget(action.go)) continue
          return false
        }
        const target = this.withCurrentGeneration(rawTarget)
        const desired = await this.resolveAccessibleComposition(target, request.event)
        if (desired === undefined) return false
        if (!await this.allowsExit(this.composition, desired, request.event)) return false
        await this.ensureScenesForComposition(desired)
        const synchronization = this.synchronizeComposition(desired, false)
        await this.deliverEnteredData(synchronization.entered)
        this.notifyCompositionChanges(synchronization.previous, synchronization.next)
      }

      if (action.action !== undefined) {
        const activeSelection = this.composition.selections.get(candidate.selection.slotAddress) ?? candidate.selection
        await this.executeAction(action.action, request.event, activeSelection)
      }
      return action.go !== undefined || action.action !== undefined
    }
    return false
  }

  /** Accepts an external source only when exactly one active binding owns it. */
  private isAdmissibleExternalSource(sceneKey: SceneKey): boolean {
    const bindings = this.findActiveBindings(sceneKey)
    return bindings.length === 1 && this.isCurrentBinding(bindings[0])
  }

  /** Resolves a target and redirects denied entries through their declared escape. */
  private async resolveAccessibleComposition(
    target: ActiveSelection<SceneKey, SlotName> | undefined,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> | undefined> {
    let candidateTarget = target
    const visited = new Set<string>()

    for (;;) {
      const desired = this.buildDesiredComposition(candidateTarget)
      const denied = await this.findDeniedSelection(desired, event)
      if (denied === undefined) return desired

      const access = resolveAccessCondition(denied)
      if (access === undefined) return desired
      const fallback = access.onDenied === undefined
        ? resolveRouteTarget(this.viewIndex, { direction: 'next' }, denied, 0)
        : resolveRouteTarget(this.viewIndex, access.onDenied, denied, 0)
      if (fallback === undefined) {
        this.reportWarning(
          'SIGHTY_ACCESS_DENIED',
          `La vue Sighty « ${denied.entry.path} » est refusée et ne possède aucune échappatoire résolue.`,
        )
        return undefined
      }
      const visitKey = `${denied.slotAddress}:${fallback.entry.path}`
      if (visited.has(visitKey)) {
        this.reportWarning(
          'SIGHTY_ACCESS_REDIRECT_LOOP',
          `Les échappatoires d'accès Sighty forment une boucle autour de « ${denied.entry.path} ».`,
        )
        return undefined
      }
      visited.add(visitKey)
      candidateTarget = this.withCurrentGeneration(fallback)
    }
  }

  /** Finds the first newly admitted selection whose access condition refuses it. */
  private async findDeniedSelection(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<ActiveSelection<SceneKey, SlotName> | undefined> {
    for (const selection of desired.values()) {
      const current = this.composition.selections.get(selection.slotAddress)
      if (current !== undefined && sameSelection(current, selection)) continue
      const access = resolveAccessCondition(selection)
      if (access === undefined) continue
      if (!await this.evaluateCondition(access.condition, selection, event)) return selection
    }
    return undefined
  }

  /** Blocks a transition when one outgoing view's exit condition is false. */
  private async allowsExit(
    previous: ActiveComposition<SceneKey, SlotName>,
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const currentPaths = activeScopePaths(previous)
    const nextPaths = activeScopePaths(desired, this.layoutEntry?.path)
    const checked = new Set<string>()

    for (const selection of previous.selections.values()) {
      const exit = resolveExitCondition(selection)
      if (exit === undefined || nextPaths.has(exit.path)) continue
      const checkKey = `${selection.slotAddress}:${exit.path}`
      if (checked.has(checkKey)) continue
      checked.add(checkKey)
      if (!currentPaths.has(exit.path)) continue
      if (!await this.evaluateCondition(exit.condition, selection, event)) {
        this.reportWarning(
          'SIGHTY_EXIT_BLOCKED',
          `La sortie de la vue Sighty « ${exit.path} » est bloquée par sa condition.`,
        )
        return false
      }
    }
    return true
  }

  /** Evaluates one direct author function or one integration catalog reference. */
  private async evaluateCondition(
    condition: SightyCondition<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<boolean> {
    const evaluator = typeof condition === 'function' ? condition : this.conditionCatalog[condition]
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
      context: this.context,
      state: this.readState(selection.sceneKey),
    }
    return Boolean(await evaluator(conditionContext))
  }

  /** Resolves the data visible from one active selection. */
  private resolveData(selection: ActiveSelection<SceneKey, SlotName>): ResolvedViewData {
    return resolveViewData(this.viewIndex, selection, this.scenario.data, this.context)
  }

  /** Reads the current logical state exposed by one CodPlay instance snapshot. */
  private readState(sceneKey: SceneKey): Readonly<Record<string, unknown>> {
    const snapshot = this.instances.get(sceneKey)?.snapshot.get()
    if (snapshot === null || snapshot === undefined) return {}
    const state: Record<string, unknown> = {}
    for (const item of snapshot.states) Object.assign(state, item.state)
    return state
  }

  /** Applies one context patch and refreshes live bindings in the same operation. */
  private async applyContextPatch(patch: Readonly<Record<string, unknown>>): Promise<void> {
    this.context = { ...this.context, ...patch }
    await this.deliverLiveData()
  }

  /** Rebuilds the live occurrences without releasing the already prepared resources. */
  private async resetNow(): Promise<void> {
    this.transitioning = true
    this.closeAllBindings()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountTargets.clear()
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.destroyInstances()
    this.deliveredData.clear()
    this.generationCounters.clear()
    this.context = { ...this.initialContext }
    this.composition = {
      revision: this.composition.revision + 1,
      layoutPath: this.layoutEntry?.path ?? '',
      selections: new Map(),
    }
    this.layoutGeneration = 0

    try {
      this.createInstances(this.directCompiledBuilds())
      const desired = await this.resolveAccessibleComposition(undefined, {
        name: 'runtime:reset',
      })
      if (desired === undefined) throw new Error('La composition initiale Sighty est refusée après reset.')
      await this.ensureScenesForComposition(desired)
      this.layoutGeneration = 1
      this.initialized = true
      this.openLayoutBinding()
      const synchronization = this.synchronizeComposition(desired, true)
      await this.deliverEnteredData(synchronization.entered)
    } catch (error: unknown) {
      this.rollbackInitialization()
      throw error
    }
  }

  /** Applies a scenario mutation and keeps the runtime commit atomic at its public boundary. */
  private async mutateNow(
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
    policy: SightyMutationReloadPolicy,
  ): Promise<boolean> {
    const previousIndex = this.viewIndex
    const previousSceneKeys = this.authoredSceneKeys
    const previousLayoutEntry = this.layoutEntry
    const previousInitialAnchor = this.initialAnchor
    const result: SightyScenarioMutationResult<SceneKey, SlotName> = this.mutableScenario.applyMutation(mutation)

    try {
      const nextIndex = createViewIndex(result.viewGraph)
      const nextLayoutEntry = nextIndex.entriesByScene.get(this.layout.sceneKey)?.[0]
      if (nextLayoutEntry === undefined) throw new Error('La mutation Sighty supprime la vue layout configurée.')
      this.viewIndex = nextIndex
      this.authoredSceneKeys = collectSceneKeys(nextIndex)
      this.layoutEntry = nextLayoutEntry
      this.initialAnchor = resolveInitialAnchor(nextIndex, nextLayoutEntry)
      this.ensureInstanceIds()
      this.validateActionCatalog()
      this.validateConditionCatalog()

      if (policy === 'reset' || policy === 'reload') {
        if (policy === 'reload') await this.reloadResources()
        await this.resetNow()
        this.pruneUnusedScenes()
        return true
      }

      const target = this.resolvePreservedTarget()
      const desired = await this.resolveAccessibleComposition(target, {
        name: 'runtime:mutation',
      })
      if (desired === undefined) throw new Error('La composition Sighty est refusée après mutation.')
      if (!await this.allowsExit(this.composition, desired, { name: 'runtime:mutation' })) {
        this.restoreMutationState(result, previousIndex, previousSceneKeys, previousLayoutEntry, previousInitialAnchor)
        return false
      }
      await this.ensureScenesForComposition(desired)
      const synchronization = this.synchronizeComposition(desired, false)
      if (policy === 'rewind') {
        for (const sceneKey of new Set([...desired.values()].map((selection) => selection.sceneKey))) {
          const instance = this.instances.get(sceneKey)
          if (instance !== undefined) await instance.telco.rewind()
        }
      }
      await this.deliverEnteredData(synchronization.entered)
      this.notifyCompositionChanges(synchronization.previous, synchronization.next)
      this.pruneUnusedScenes()
      return true
    } catch (error: unknown) {
      this.restoreMutationState(result, previousIndex, previousSceneKeys, previousLayoutEntry, previousInitialAnchor)
      throw error
    }
  }

  /** Resolves the deepest still-declared selection for the preserve policy. */
  private resolvePreservedTarget(): ActiveSelection<SceneKey, SlotName> | undefined {
    const previousSelections = [...this.composition.selections.values()]
      .sort((left, right) => right.entry.path.length - left.entry.path.length)
    for (const previous of previousSelections) {
      const entry = this.viewIndex.entriesByPath.get(previous.entry.path)
      const slot = this.viewIndex.slotsByAddress.get(previous.slotAddress)
      if (entry === undefined || slot === undefined || entry.view.hidden === true) continue
      const sceneEntry = resolveEntryScene(this.viewIndex, entry)
      if (sceneEntry?.view.view.scene !== previous.sceneKey) continue
      return createSelection(this.viewIndex, slot, entry, previous.generation)
    }
    return undefined
  }

  /** Restores the scenario and index when a mutation cannot be committed. */
  private restoreMutationState(
    result: SightyScenarioMutationResult<SceneKey, SlotName>,
    previousIndex: ViewIndex<SceneKey, SlotName>,
    previousSceneKeys: readonly SceneKey[],
    previousLayoutEntry: IndexedEntry<SceneKey, SlotName> | undefined,
    previousInitialAnchor: IndexedEntry<SceneKey, SlotName> | undefined,
  ): void {
    this.mutableScenario.restoreMutation(result)
    this.viewIndex = previousIndex
    this.authoredSceneKeys = previousSceneKeys
    this.layoutEntry = previousLayoutEntry
    this.initialAnchor = previousInitialAnchor
  }

  /** Reloads currently known scene resources before the new composition is rebuilt. */
  private async reloadResources(): Promise<void> {
    this.closeAllBindings()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountTargets.clear()
    this.destroyInstances()
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.owner.preload.cancel()
    this.owner.preload.release(this.resourceUrls)
    this.resourceUrls = []
    this.resourceUrlsByScene.clear()
    this.compiledBuilds.clear()
    this.sceneDocuments.clear()
    const builds = this.compileDirectScenes()
    for (const [sceneKey, build] of builds) this.compiledBuilds.set(sceneKey, build)
    await this.preloadScenes(builds)
    this.deliveredData.clear()
  }

  /** Selects synchronously supplied builds so deferred scenes remain lazy after reset. */
  private directCompiledBuilds(): SightyRuntimeBuilds<SceneKey> {
    return new Map(
      [...this.compiledBuilds.entries()]
        .filter(([sceneKey]) => this.scenario.getScene(sceneKey) !== undefined),
    )
  }

  /** Destroys all currently created scene occurrences while keeping the CodPlay owner alive. */
  private destroyInstances(): void {
    for (const sceneKey of [...this.instances.keys()].reverse()) {
      this.owner.instances.destroy(this.instanceIds[sceneKey])
    }
    this.instances.clear()
  }

  /** Releases compiled occurrences and resources that are no longer referenced by the file. */
  private pruneUnusedScenes(): void {
    const used = new Set(this.authoredSceneKeys)
    for (const sceneKey of [...this.instances.keys()]) {
      if (used.has(sceneKey)) continue
      this.owner.instances.destroy(this.instanceIds[sceneKey])
      this.instances.delete(sceneKey)
    }

    const releaseCandidates: string[] = []
    for (const sceneKey of [...this.compiledBuilds.keys()]) {
      if (used.has(sceneKey)) continue
      releaseCandidates.push(...(this.resourceUrlsByScene.get(sceneKey) ?? []))
      this.compiledBuilds.delete(sceneKey)
      this.sceneDocuments.delete(sceneKey)
      this.resourceUrlsByScene.delete(sceneKey)
    }
    const retainedUrls = new Set<string>()
    for (const urls of this.resourceUrlsByScene.values()) for (const url of urls) retainedUrls.add(url)
    const releasable = [...new Set(releaseCandidates)].filter((url) => !retainedUrls.has(url))
    if (releasable.length > 0) this.owner.preload.release(releasable)
    this.resourceUrls = this.resourceUrls.filter((url) => retainedUrls.has(url))
  }

  /** Sends initial or live data to one active scene binding. */
  private async deliverData(
    selection: ActiveSelection<SceneKey, SlotName>,
    mode: 'entry' | 'live',
  ): Promise<void> {
    const resolved = this.resolveData(selection)
    const previous = this.deliveredData.get(selection.slotAddress) ?? {}
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
      await this.sendToBinding(selection, {
        name: eventName,
        visibility: 'scene',
        data: toCompiledData(values),
      })
    }

    const delivered: Record<string, unknown> = {}
    for (const key of resolved.declaredKeys) delivered[key] = resolved.values[key]
    this.deliveredData.set(selection.slotAddress, delivered)
  }

  /** Delivers entry values to every newly admitted selection. */
  private async deliverEnteredData(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): Promise<void> {
    for (const selection of selections) await this.deliverData(selection, 'entry')
  }

  /** Re-evaluates only live data bindings after the context has changed. */
  private async deliverLiveData(): Promise<void> {
    for (const selection of this.composition.selections.values()) {
      const resolved = this.resolveData(selection)
      if (resolved.liveKeys.size === 0) continue
      await this.deliverData(selection, 'live')
    }
  }

  /** Sends one event to the binding addressed by a logical slot occurrence. */
  private async sendToBinding(
    selection: ActiveSelection<SceneKey, SlotName>,
    eventime: CodPlayEventime,
  ): Promise<void> {
    const binding = this.activeBindings.get(selection.slotAddress)
    if (binding === undefined || !this.isCurrentBinding(binding)) return
    const instance = this.instances.get(selection.sceneKey)
    if (instance === undefined) return
    const currentTimeMs = instance.telco.getProgress().timelineMs
    await instance.events.emit(eventime, { scope: 'scene' })
    await instance.telco.seek(currentTimeMs)
  }

  /** Rejects authored action references that have no application-owned handler. */
  private validateActionCatalog(): void {
    const references = new Set<string>()
    for (const entry of this.viewIndex.entries) addActionReferences(entry.view.actions, references)
    for (const graph of this.viewIndex.graphs.values()) addActionReferences(graph.scope.actions, references)
    for (const reference of references) {
      if (this.actionCatalog[reference] === undefined) {
        throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
      }
    }
  }

  /** Rejects condition references that have no application-owned implementation. */
  private validateConditionCatalog(): void {
    const references = new Set<string>()
    for (const entry of this.viewIndex.entries) {
      addConditionReference(entry.view.accessBy, references)
      addConditionReference(entry.view.exitBy, references)
    }
    for (const graph of this.viewIndex.graphs.values()) {
      addConditionReference(graph.scope.accessBy, references)
      addConditionReference(graph.scope.exitBy, references)
    }
    for (const reference of references) {
      if (this.conditionCatalog[reference] === undefined) {
        throw new Error(`La condition Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
      }
    }
  }

  /** Executes one catalogued action after its declared route is active. */
  private async executeAction(
    reference: string,
    event: SightyRuntimeEvent<SceneKey>,
    selection: ActiveSelection<SceneKey, SlotName>,
  ): Promise<void> {
    const handler = this.actionCatalog[reference]
    if (handler === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }

    const resolvedData = this.resolveData(selection)
    await handler({
      event,
      data: resolvedData.values,
      context: this.context,
      state: this.readState(selection.sceneKey),
      updateContext: (patch) => this.applyContextPatch(patch),
      send: (sceneKey, eventime, target) => this.sendToActiveScene(sceneKey, eventime, target),
    })
  }

  /** Sends one action event only through an occurrence that is still active. */
  private async sendToActiveScene(
    sceneKey: SceneKey,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
  ): Promise<void> {
    const bindings = this.findActiveBindings(sceneKey)
    const binding = bindings.length === 1 ? bindings[0] : undefined
    if (binding === undefined || !this.isCurrentBinding(binding)) {
      if (bindings.length > 1) {
        throw new Error(`La scène Sighty ${sceneKey} est ambiguë dans la composition active.`)
      }
      throw new Error(`La scène Sighty ${sceneKey} n'est pas active dans la composition.`)
    }
    const instance = this.instances.get(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.events.emit(eventime, target)
  }

  /** Returns the authored layout entry required for physical mounting. */
  private requireLayoutEntry(): IndexedEntry<SceneKey, SlotName> {
    const entry = this.layoutEntry
    if (entry === undefined) throw new Error('Le fichier Sighty ne contient aucune vue layout.')
    return entry
  }

  /** Ensures every referenced scene has one stable CodPlay instance identity. */
  private ensureInstanceIds(): void {
    for (const sceneKey of this.authoredSceneKeys) {
      const instanceId = this.instanceIds[sceneKey]
      if (typeof instanceId !== 'string' || instanceId.length === 0) {
        throw new Error(`L’identifiant d’instance Sighty de la scène ${sceneKey} est absent.`)
      }
    }
  }

  /** Builds the desired composition from the current layout branch and target. */
  private buildDesiredComposition(
    target?: ActiveSelection<SceneKey, SlotName>,
  ): ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> {
    const layoutEntry = this.requireLayoutEntry()
    const initialAnchor = this.initialAnchor ?? resolveInitialAnchor(this.viewIndex, layoutEntry)
    const generations = new Map<string, number>()
    for (const slot of this.viewIndex.slots) {
      const current = this.composition.selections.get(slot.address)
      generations.set(slot.address, current?.generation ?? this.nextGenerationNumber(slot.address))
    }
    return buildComposition(
      this.viewIndex,
      layoutEntry.path,
      initialAnchor,
      target,
      generations,
    )
  }

  /** Assigns the next generation to a route target before its transition. */
  private withCurrentGeneration(
    target: ActiveSelection<SceneKey, SlotName>,
  ): ActiveSelection<SceneKey, SlotName> {
    const current = this.composition.selections.get(target.slotAddress)
    const generation = current !== undefined && sameSelection(current, target)
      ? current.generation
      : this.nextGenerationNumber(target.slotAddress)
    return { ...target, generation }
  }

  /** Returns the next monotone generation without mutating the counter. */
  private nextGenerationNumber(slotAddress: string): number {
    const current = this.composition.selections.get(slotAddress)?.generation ?? 0
    return Math.max(current, this.generationCounters.get(slotAddress) ?? 0) + 1
  }

  /** Synchronizes physical mounts and commits one new logical composition. */
  private synchronizeComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    notify: boolean,
  ): SynchronizationResult<SceneKey, SlotName> {
    const previous = this.composition
    const transition = planCompositionTransition(previous.selections, desired)
    const previousSceneKeys = new Set([...previous.selections.values()].map((selection) => selection.sceneKey))
    if (transition.entered.length === 0 && transition.exited.length === 0) {
      return {
        entered: [],
        previousSceneKeys,
        changed: false,
        previous,
        next: previous,
      }
    }

    const desiredMap = new Map(desired)
    const desiredSceneKeys = new Set([...desiredMap.values()].map((selection) => selection.sceneKey))
    const previousStates = this.captureExitedStates(transition.exited, desiredSceneKeys)
    const enteredMounts = transition.entered.map((selection) => ({
      selection,
      mount: this.resolveMount(selection),
    }))
    this.transitioning = true
    this.composition = {
      revision: previous.revision + 1,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }

    try {
      this.closeBindings(transition.exited)
      this.pauseExitedScenes(transition.exited, desiredSceneKeys)
      for (const { selection, mount } of enteredMounts) {
        if (mount.replace === undefined) this.detachMountForHost(mount.host)
        this.mountSelection(selection, mount)
      }
      const enteredAddresses = new Set(transition.entered.map((selection) => selection.slotAddress))
      for (const selection of transition.exited) {
        if (!enteredAddresses.has(selection.slotAddress)) this.detachMount(selection.slotAddress)
      }
      this.composition = {
        revision: previous.revision + 1,
        layoutPath: previous.layoutPath,
        selections: desiredMap,
      }
      this.openBindings(transition.entered)
      this.recordGenerations(desiredMap)
      this.transitioning = false
      const next = this.composition
      if (notify) this.notifyCompositionChanges(previous, next)
      return { entered: transition.entered, previousSceneKeys, changed: true, previous, next }
    } catch (error: unknown) {
      this.restoreComposition(previous, previousStates)
      throw error
    }
  }

  /** Captures the playback state needed to restore a failed transition. */
  private captureExitedStates(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
    desiredSceneKeys: ReadonlySet<SceneKey>,
  ): ReadonlyMap<string, MountedState> {
    const states = new Map<string, MountedState>()
    for (const selection of selections) {
      if (desiredSceneKeys.has(selection.sceneKey)) continue
      const instance = this.instances.get(selection.sceneKey)
      if (instance === undefined) continue
      const state = instance.telco.getState()
      states.set(selection.slotAddress, {
        wasPlaying: state.status === 'playing' && !state.sequenceEnded,
      })
    }
    return states
  }

  /** Pauses occurrences that are no longer present in the desired branch. */
  private pauseExitedScenes(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
    desiredSceneKeys: ReadonlySet<SceneKey>,
  ): void {
    for (const selection of selections) {
      if (desiredSceneKeys.has(selection.sceneKey)) continue
      const instance = this.instances.get(selection.sceneKey)
      if (instance === undefined) continue
      const state = instance.telco.getState()
      if (state.status !== 'playing' || state.sequenceEnded) continue
      void instance.telco.pause().catch((error: unknown) => this.reportWarning('SIGHTY_PAUSE_FAILED', error))
    }
  }

  /** Restores the previous physical and logical composition after a mount failure. */
  private restoreComposition(
    previous: ActiveComposition<SceneKey, SlotName>,
    previousStates: ReadonlyMap<string, MountedState>,
  ): void {
    this.closeAllBindings()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountTargets.clear()
    this.composition = {
      revision: previous.revision,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }
    try {
      for (const selection of previous.selections.values()) this.mountSelection(selection)
      this.composition = previous
      this.openLayoutBinding()
      this.openBindings([...previous.selections.values()])
      this.transitioning = false
      for (const [slotAddress, state] of previousStates) {
        if (!state.wasPlaying) continue
        const selection = previous.selections.get(slotAddress)
        const instance = selection === undefined ? undefined : this.instances.get(selection.sceneKey)
        if (instance !== undefined) void instance.telco.play()
      }
    } catch (restoreError: unknown) {
      this.closeAllBindings()
      this.transitioning = false
      this.reportWarning('SIGHTY_COMPOSITION_RESTORE_FAILED', restoreError)
    }
  }

  /** Resolves one logical selection to a validated CodPlay mount request. */
  private resolveMount(selection: ActiveSelection<SceneKey, SlotName>): ResolvedMount {
    const slot = this.viewIndex.slotsByAddress.get(selection.slotAddress)
    if (slot === undefined) throw new Error(`Le slot Sighty ${selection.slotName} est absent de l’index.`)
    const layoutInstance = this.instances.get(this.layout.sceneKey)
    if (layoutInstance === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutScene = this.sceneDocuments.get(this.layout.sceneKey)
    if (layoutScene === undefined) throw new Error('La ressource layout Sighty est absente.')

    const resolution = resolveSlotManifestEntry(
      slotManifest(layoutScene, { storyId: this.layout.storyId }),
      slot.slotName,
      {
        sceneId: layoutScene.id,
        storyId: this.layout.storyId,
        referencePath: slotReferencePath(slot),
      },
    )
    if (!resolution.ok) throw new Error(resolution.diagnostic.message)

    const child = this.instances.get(selection.sceneKey)
    if (child === undefined) throw new Error(`L’instance enfant ${selection.sceneKey} est absente.`)
    return {
      host: {
        instanceId: layoutInstance.instanceId,
        storyId: resolution.entry.storyId,
        persoId: resolution.entry.persoId,
      },
      childInstanceId: child.instanceId,
      ...(resolution.entry.replace === undefined ? {} : { replace: resolution.entry.replace }),
    }
  }

  /** Mounts one logical selection through CodPlay's public instance relation. */
  private mountSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    mount: ResolvedMount = this.resolveMount(selection),
  ): void {
    const handle = this.owner.instances.mount(mount)
    for (const [slotAddress, target] of this.mountTargets) {
      if (slotAddress === selection.slotAddress || !sameMountHost(target, mount.host)) continue
      this.mounts.delete(slotAddress)
      this.mountTargets.delete(slotAddress)
    }
    this.mounts.set(selection.slotAddress, handle)
    this.mountTargets.set(selection.slotAddress, mount.host)
  }

  /** Detaches one physical relation without destroying the child occurrence. */
  private detachMount(slotAddress: string): void {
    this.mounts.get(slotAddress)?.detach()
    this.mounts.delete(slotAddress)
    this.mountTargets.delete(slotAddress)
  }

  /** Detaches any logical mount currently occupying one physical host target. */
  private detachMountForHost(host: CodPlayInstanceHostTarget): void {
    for (const [slotAddress, target] of this.mountTargets) {
      if (sameMountHost(target, host)) this.detachMount(slotAddress)
    }
  }

  /** Reports every changed public slot after one composition commit. */
  private notifyCompositionChanges(
    previous: ActiveComposition<SceneKey, SlotName>,
    next: ActiveComposition<SceneKey, SlotName>,
  ): void {
    const addresses = new Set([...previous.selections.keys(), ...next.selections.keys()])
    for (const address of addresses) {
      const before = previous.selections.get(address)
      const after = next.selections.get(address)
      if (before !== undefined && after !== undefined && sameSelection(before, after)) continue
      const slotName = after?.slotName ?? before?.slotName
      if (slotName === undefined) continue
      this.notifySlotChange(slotName, after?.sceneKey)
    }
  }

  /** Rejects an event captured from a selection whose generation has ended. */
  private isCurrentBinding(binding: RuntimeBinding<SceneKey>): boolean {
    if (this.destroyed || this.transitioning) return false
    const active = this.activeBindings.get(binding.slotAddress)
    if (active?.sceneKey !== binding.sceneKey || active.generation !== binding.generation) return false
    if (binding.slotAddress === (this.layoutEntry?.path ?? 'layout')) {
      return binding.sceneKey === this.layout.sceneKey && this.layoutGeneration === binding.generation
    }
    const selection = this.composition.selections.get(binding.slotAddress)
    return selection?.sceneKey === binding.sceneKey && selection.generation === binding.generation
  }

  /** Opens the permanent binding used by the authored layout scene. */
  private openLayoutBinding(): void {
    this.openBinding({
      slotAddress: this.layoutEntry?.path ?? 'layout',
      sceneKey: this.layout.sceneKey,
      generation: this.layoutGeneration,
    })
  }

  /** Opens event bindings for selections that have entered the composition. */
  private openBindings(selections: readonly ActiveSelection<SceneKey, SlotName>[]): void {
    for (const selection of selections) {
      this.openBinding({
        slotAddress: selection.slotAddress,
        sceneKey: selection.sceneKey,
        generation: selection.generation,
      })
    }
  }

  /** Subscribes one occurrence to Sighty only while its binding is active. */
  private openBinding(binding: RuntimeBinding<SceneKey>): void {
    const current = this.activeBindings.get(binding.slotAddress)
    if (current?.sceneKey === binding.sceneKey && current.generation === binding.generation) return
    if (current !== undefined) this.closeBinding(binding.slotAddress)
    const instance = this.instances.get(binding.sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${binding.sceneKey} est absente.`)
    const cleanup = instance.events.onEvent((event) => this.receivePublicEvent(binding, event))
    this.activeBindings.set(binding.slotAddress, binding)
    this.bindingCleanups.set(binding.slotAddress, cleanup)
  }

  /** Closes event bindings for selections that have exited the composition. */
  private closeBindings(selections: readonly ActiveSelection<SceneKey, SlotName>[]): void {
    for (const selection of selections) this.closeBinding(selection.slotAddress)
  }

  /** Closes one active binding before its physical relation is detached. */
  private closeBinding(slotAddress: string): void {
    this.bindingCleanups.get(slotAddress)?.()
    this.bindingCleanups.delete(slotAddress)
    this.activeBindings.delete(slotAddress)
    this.deliveredData.delete(slotAddress)
  }

  /** Closes every active event binding during restore, rollback or destruction. */
  private closeAllBindings(): void {
    for (const slotAddress of [...this.activeBindings.keys()]) this.closeBinding(slotAddress)
  }

  /** Finds the active bindings associated with one authored scene key. */
  private findActiveBindings(sceneKey: SceneKey): readonly RuntimeBinding<SceneKey>[] {
    return [...this.activeBindings.values()].filter((binding) => binding.sceneKey === sceneKey)
  }

  /** Records the latest generation used by each active binding. */
  private recordGenerations(selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>): void {
    for (const [slotAddress, selection] of selections) {
      const current = this.generationCounters.get(slotAddress) ?? 0
      if (selection.generation > current) this.generationCounters.set(slotAddress, selection.generation)
    }
  }

  /** Mounts one declared child or the start entry in a public slot. */
  mountSlot(slotName: SlotName, childSceneKey?: SceneKey): void {
    this.requireInitialized()
    const slot = this.resolvePublicSlot(slotName)
    const entry = childSceneKey === undefined
      ? getStartEntry(this.viewIndex, slot.graphPath)
      : this.findSceneEntry(slot, childSceneKey)
    if (entry === undefined) {
      if (childSceneKey === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
      throw new Error(`La scène Sighty ${childSceneKey} n'est pas déclarée dans le slot ${slotName}.`)
    }
    const target = createSelection(this.viewIndex, slot, entry, this.nextGenerationNumber(slot.address))
    const desired = this.buildDesiredComposition(this.withCurrentGeneration(target))
    this.synchronizeComposition(desired, true)
  }

  /** Detaches one active slot and every nested slot below it. */
  detachSlot(slotName: SlotName): void {
    this.requireInitialized()
    const slot = this.resolvePublicSlot(slotName)
    const addresses = [...this.composition.selections.keys()]
      .filter((address) => address === slot.address || isPathPrefix(slot.address, address))
    if (addresses.length === 0) return

    const previous = this.composition
    const nextSelections = new Map(previous.selections)
    this.transitioning = true
    this.composition = {
      revision: previous.revision + 1,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }
    for (const address of addresses) {
      this.closeBinding(address)
      this.detachMount(address)
      nextSelections.delete(address)
    }
    this.composition = {
      revision: previous.revision + 1,
      layoutPath: previous.layoutPath,
      selections: nextSelections,
    }
    this.transitioning = false
    for (const address of addresses) {
      const selection = previous.selections.get(address)
      if (selection !== undefined) this.notifySlotChange(selection.slotName, undefined)
    }
  }

  /** Reports whether one public slot currently has a physical mount. */
  isSlotMounted(slotName: SlotName): boolean {
    return this.findActiveSlots(slotName).some((slot) => this.mounts.has(slot.address))
  }

  /** Returns the scene currently selected in one public slot. */
  getMountedSceneKey(slotName: SlotName): SceneKey | undefined {
    return this.findActiveSelections(slotName)[0]?.sceneKey
  }

  /** Subscribes to selection changes in one public slot name. */
  onSlotChange(slotName: SlotName, listener: SightyRuntimeSlotChangeListener<SceneKey>): () => void {
    const listeners = this.slotChangeListeners.get(slotName) ?? new Set()
    listeners.add(listener)
    this.slotChangeListeners.set(slotName, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.slotChangeListeners.delete(slotName)
    }
  }

  /** Notifies all listeners registered for one slot name. */
  private notifySlotChange(slotName: SlotName, sceneKey: SceneKey | undefined): void {
    for (const listener of [...(this.slotChangeListeners.get(slotName) ?? [])]) {
      try {
        listener(sceneKey)
      } catch (error: unknown) {
        this.reportWarning('SIGHTY_SLOT_LISTENER_FAILED', error)
      }
    }
  }

  /** Starts one initialized scene occurrence. */
  async play(sceneKey: SceneKey): Promise<void> {
    this.requireInitialized()
    const instance = this.instances.get(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.play()
  }

  /** Starts selected scene occurrences in authored order. */
  async playAll(sceneKeys: readonly SceneKey[] = this.authoredSceneKeys): Promise<void> {
    for (const sceneKey of sceneKeys) await this.play(sceneKey)
  }

  /** Releases mounts, subscriptions, instances, resources and the CodPlay owner. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.transitioning = true
    this.closeAllBindings()
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.publicEventChannel.clear()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountTargets.clear()
    this.composition = {
      revision: this.composition.revision + 1,
      layoutPath: this.composition.layoutPath,
      selections: new Map(),
    }
    for (const sceneKey of [...this.instances.keys()].reverse()) {
      this.owner.instances.destroy(this.instanceIds[sceneKey])
    }
    this.owner.preload.release(this.resourceUrls)
    this.owner.destroy()
    this.instances.clear()
    this.slotChangeListeners.clear()
    this.initialized = false
  }

  /** Requires a live initialized runtime for explicit operations. */
  private requireInitialized(): void {
    if (this.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (!this.initialized) throw new Error('Le runtime Sighty n’est pas initialisé.')
  }

  /** Resolves one public slot name against the active branch or author index. */
  private resolvePublicSlot(slotName: SlotName): IndexedSlot<SceneKey, SlotName> {
    const active = this.findActiveSlots(slotName)
    if (active.length === 1) return active[0]
    if (active.length > 1) throw new Error(`Le slot Sighty ${slotName} est ambigu dans la composition active.`)
    const declared = this.viewIndex.slots.filter((slot) => slot.slotName === slotName)
    if (declared.length === 1) return declared[0]
    if (declared.length === 0) throw new Error(`Le slot Sighty ${slotName} n'est pas déclaré dans le layout.`)
    throw new Error(`Le slot Sighty ${slotName} est ambigu dans le fichier auteur.`)
  }

  /** Finds all indexed slots with one public name in the active composition. */
  private findActiveSlots(slotName: SlotName): readonly IndexedSlot<SceneKey, SlotName>[] {
    return this.viewIndex.slots.filter((slot) =>
      slot.slotName === slotName && this.composition.selections.has(slot.address))
  }

  /** Finds all active selections with one public slot name. */
  private findActiveSelections(slotName: SlotName): readonly ActiveSelection<SceneKey, SlotName>[] {
    return [...this.composition.selections.values()].filter((selection) => selection.slotName === slotName)
  }

  /** Finds one declared descendant entry that resolves to a requested scene. */
  private findSceneEntry(
    slot: IndexedSlot<SceneKey, SlotName>,
    sceneKey: SceneKey,
  ): IndexedEntry<SceneKey, SlotName> | undefined {
    return this.viewIndex.entries.find((entry) => {
      if (!isPathPrefix(slot.graphPath, entry.path)) return false
      const sceneEntry = resolveEntryScene(this.viewIndex, entry)
      return sceneEntry?.view.view.scene === sceneKey
    })
  }

  /** Reports a non-fatal runtime problem through the configured warning channel. */
  private reportWarning(code: string, error: unknown): void {
    this.onPreloadWarning?.({
      code,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Creates the runtime sub-surface owned by one Sighty facade. */
export function createSightyRuntime<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  scenario: SightyScenarioApi<SceneKey, SlotName>,
  options: SightyRuntimeConfiguration<SceneKey>,
): SightyRuntimeApi<SceneKey, SlotName> {
  return new SightyRuntimeController({ scenario, ...options })
}

/** Joins diagnostic messages into one readable error detail. */
function diagnosticDetails(diagnostics: readonly { message: string }[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join(' ')
}

/** Adds all action references from one optional scope to a set. */
function addActionReferences(
  actions: Readonly<Record<string, SightyViewAction>> | undefined,
  references: Set<string>,
): void {
  for (const action of Object.values(actions ?? {})) {
    if (action.action !== undefined) references.add(action.action)
  }
}

/** Adds one catalogued condition reference when a declaration uses a string. */
function addConditionReference<SceneKey extends string>(
  condition: SightyCondition<SceneKey> | undefined,
  references: Set<string>,
): void {
  if (typeof condition === 'string') references.add(condition)
}

/** Returns all view and graph scope paths active in one logical composition. */
function activeScopePaths<SceneKey extends string, SlotName extends string>(
  composition: ActiveComposition<SceneKey, SlotName> | ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  layoutPath?: string,
): ReadonlySet<string> {
  const selections = 'selections' in composition
    ? composition.selections.values()
    : composition.values()
  const paths = new Set<string>()
  if (layoutPath !== undefined) paths.add(layoutPath)
  for (const selection of selections) {
    paths.add(selection.entry.path)
    for (const parent of selection.entry.parentViews) paths.add(parent.path)
    for (const graph of selection.entry.graphScopes) paths.add(graph.path)
  }
  return paths
}

/** Converts Sighty data values to the CodPlay event payload shape. */
function toCompiledData(values: Readonly<Record<string, unknown>>): CodPlayPublicEvent['data'] {
  return values as CodPlayPublicEvent['data']
}

/** Collects scene keys in the first-seen order of the immutable index. */
function collectSceneKeys<
  SceneKey extends string,
  SlotName extends string,
>(index: ViewIndex<SceneKey, SlotName>): readonly SceneKey[] {
  const sceneKeys: SceneKey[] = []
  for (const entry of index.entries) {
    const sceneKey = entry.view.view.scene
    if (sceneKey !== undefined && !sceneKeys.includes(sceneKey)) sceneKeys.push(sceneKey)
  }
  return sceneKeys
}

/** Returns each distinct slot name in authored declaration order. */
function uniqueSlotNames<
  SceneKey extends string,
  SlotName extends string,
>(slots: readonly IndexedSlot<SceneKey, SlotName>[]): readonly SlotName[] {
  const names: SlotName[] = []
  for (const slot of slots) if (!names.includes(slot.slotName)) names.push(slot.slotName)
  return names
}

/** Finds the scene resolved by one entry, including its nested start graph. */
function resolveEntryScene<
  SceneKey extends string,
  SlotName extends string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  entry: IndexedEntry<SceneKey, SlotName>,
): IndexedEntry<SceneKey, SlotName> | undefined {
  if (entry.view.view.scene !== undefined) return entry
  const nestedPath = entry.view.view.views !== undefined
    ? entry.path
    : entry.view.view.graph === undefined ? undefined : `${entry.path}/graph`
  if (nestedPath === undefined) return undefined
  const nestedStart = getStartEntry(index, nestedPath)
  return nestedStart === undefined ? undefined : resolveEntryScene(index, nestedStart)
}

/** Returns the author path used when resolving one physical slot manifest entry. */
function slotReferencePath<SceneKey extends string, SlotName extends string>(
  slot: IndexedSlot<SceneKey, SlotName>,
): string {
  return `views.${slot.ownerPath}.view.slots.${slot.slotName}`
}

/** Identifies route targets that can fall through to an inherited action. */
function isDirectionalTarget(target: SightyRouteTarget): target is { direction: 'next' | 'previous' | 'up' | 'down' } {
  return 'direction' in target
}

/** Determines whether two logical selections retain their physical occurrence. */
function sameSelection<SceneKey extends string, SlotName extends string>(
  left: ActiveSelection<SceneKey, SlotName>,
  right: ActiveSelection<SceneKey, SlotName>,
): boolean {
  return left.entry.path === right.entry.path && left.sceneKey === right.sceneKey
}

/** Compares two physical CodPlay host targets without exposing their identity. */
function sameMountHost(
  left: CodPlayInstanceHostTarget,
  right: CodPlayInstanceHostTarget,
): boolean {
  return left.instanceId === right.instanceId
    && left.storyId === right.storyId
    && left.persoId === right.persoId
}
