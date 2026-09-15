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
  type CodPlayOptions,
  type CodPlayPublicEvent,
  type CodPlayResourceRegistration,
  type CodPlayTraceEvent,
  type RuntimePreloadMode,
} from 'codplay'
import { createSightyPublicEventChannel, type SightyPublicEvent, type SightyPublicEvents } from './public-events'
import {
  createViewIndex,
  getStartEntry,
  isPathPrefix,
} from './navigation/graph-index'
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
  SightyRouteTarget,
  SightyScenarioApi,
  SightyViewAction,
} from './types'

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

/** Executes one authored Sighty graph through one CodPlay owner. */
class SightyRuntimeController<
  SceneKey extends string = string,
  SlotName extends string = string,
> implements SightyRuntimeApi<SceneKey, SlotName> {
  private readonly scenario: SightyScenarioApi<SceneKey, SlotName>
  private readonly root: HTMLElement
  private readonly instanceIds: Readonly<Record<SceneKey, string>>
  private readonly layout: SightyRuntimeLayout<SceneKey>
  private readonly actionCatalog: SightyActionCatalog<SceneKey>
  private readonly preloadMode: RuntimePreloadMode
  private readonly styles: readonly SightyRuntimeStyle[]
  private readonly onTrace: SightyRuntimeOptions<SceneKey, SlotName>['onTrace']
  private readonly onPreloadWarning: SightyRuntimeOptions<SceneKey, SlotName>['onPreloadWarning']
  private readonly viewIndex: ViewIndex<SceneKey, SlotName>
  private readonly authoredSceneKeys: readonly SceneKey[]
  private readonly owner: CodPlay
  private readonly publicEventChannel = createSightyPublicEventChannel<SceneKey>()
  private readonly instances = new Map<SceneKey, CodPlayInstance>()
  private readonly mounts = new Map<string, CodPlayInstanceMountHandle>()
  private readonly slotChangeListeners = new Map<SlotName, Set<SightyRuntimeSlotChangeListener<SceneKey>>>()
  private readonly cleanups: Array<() => void> = []
  private readonly generationCounters = new Map<string, number>()
  private readonly navigationChain: { current: Promise<unknown> } = { current: Promise.resolve() }
  private layoutEntry: IndexedEntry<SceneKey, SlotName> | undefined
  private initialAnchor: IndexedEntry<SceneKey, SlotName> | undefined
  private composition: ActiveComposition<SceneKey, SlotName>
  private resourceUrls: readonly string[] = []
  private layoutGeneration = 0
  private initialized = false
  private transitioning = false
  private destroyed = false

  /** Creates one runtime bound to one scenario and one visible root. */
  constructor(options: SightyRuntimeOptions<SceneKey, SlotName>) {
    this.scenario = options.scenario
    this.root = options.root
    this.instanceIds = options.instanceIds
    this.layout = options.layout
    this.actionCatalog = options.actionCatalog ?? {}
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

    const diagnostics = this.scenario.validate()
    if (diagnostics.length > 0) {
      throw new Error(`Le fichier auteur Sighty est invalide. ${diagnosticDetails(diagnostics)}`)
    }
    this.validateActionCatalog()
    this.layoutEntry = this.requireLayoutEntry()
    this.initialAnchor = resolveInitialAnchor(this.viewIndex, this.layoutEntry)
    this.ensureInstanceIds()

    const builds = this.compileScenes()
    await this.preloadScenes(builds)
    this.installStyles()
    this.createInstances(builds)
    this.layoutGeneration = 1
    this.initialized = true

    const desired = this.buildDesiredComposition()
    const synchronization = this.synchronizeComposition(desired, true)
    if (synchronization.changed) this.initialized = true
  }

  /** Compiles every scene referenced by the author graph. */
  private compileScenes(): SightyRuntimeBuilds<SceneKey> {
    const builds = new Map<SceneKey, CodPlayCompileSuccess>()
    for (const sceneKey of this.authoredSceneKeys) {
      const scene = this.scenario.getScene(sceneKey)
      if (scene === undefined) throw new Error(`La ressource de scène Sighty ${sceneKey} est absente.`)
      const result = this.owner.build({ scene })
      if (!result.ok) {
        throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
      }
      builds.set(sceneKey, result)
    }
    return builds
  }

  /** Preloads the compiled resources once and transfers them to CodPlay. */
  private async preloadScenes(builds: SightyRuntimeBuilds<SceneKey>): Promise<void> {
    const manifests = this.authoredSceneKeys.map((sceneKey) => {
      const build = builds.get(sceneKey)
      if (build === undefined) throw new Error(`Build manquant pour la scène Sighty ${sceneKey}.`)
      return build.compiledScene.resources
    })
    const urls = [...new Set(manifests.flatMap((manifest) => manifest.entries.map((entry) => entry.url)))]
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
    this.resourceUrls = urls
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
    for (const sceneKey of this.authoredSceneKeys) {
      const build = builds.get(sceneKey)
      if (build === undefined) throw new Error(`Build manquant pour la scène Sighty ${sceneKey}.`)
      const instance = this.owner.instances.create({
        instanceId: this.instanceIds[sceneKey],
        compiledScene: build.compiledScene,
        functions: build.functions,
        ...(sceneKey === this.layout.sceneKey ? { root: this.root } : {}),
      })
      this.instances.set(sceneKey, instance)
      this.observeInstance(instance, sceneKey)
    }
  }

  /** Connects CodPlay diagnostics and public scene events to Sighty. */
  private observeInstance(instance: CodPlayInstance, sceneKey: SceneKey): void {
    const onTrace = this.onTrace
    if (onTrace !== undefined) {
      this.cleanups.push(instance.diagnostic.onTrace((event) => onTrace(sceneKey, event)))
    }
    this.cleanups.push(instance.events.onEvent((event) => this.receivePublicEvent(sceneKey, event)))
  }

  /** Adapts one active CodPlay event, publishes it and queues it for routing. */
  private receivePublicEvent(sceneKey: SceneKey, event: CodPlayPublicEvent): void {
    const binding = this.findCurrentBinding(sceneKey)
    if (binding === undefined) return

    const publicEvent: SightyPublicEvent<SceneKey> = {
      name: event.name,
      sourceSceneKey: sceneKey,
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

  /** Resolves one admitted event and executes its first valid authored action. */
  private async dispatchNow(request: DispatchRequest<SceneKey>): Promise<boolean> {
    if (request.binding !== undefined && !this.isCurrentBinding(request.binding)) return false

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
        const desired = this.buildDesiredComposition(target)
        const synchronization = this.synchronizeComposition(desired, false)
        await this.startEntered(synchronization)
        this.notifyCompositionChanges(synchronization.previous, synchronization.next)
      }

      if (action.action !== undefined) await this.executeAction(action.action, request.event)
      return action.go !== undefined || action.action !== undefined
    }
    return false
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

  /** Executes one catalogued action after its declared route is active. */
  private async executeAction(reference: string, event: SightyRuntimeEvent<SceneKey>): Promise<void> {
    const handler = this.actionCatalog[reference]
    if (handler === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }

    await handler({
      event,
      send: async (sceneKey, eventime, target) => {
        const instance = this.instances.get(sceneKey)
        if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
        await instance.events.emit(eventime, target)
      },
    })
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
    this.transitioning = true
    this.composition = {
      revision: previous.revision + 1,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }

    try {
      this.pauseExitedScenes(transition.exited, desiredSceneKeys)
      for (const selection of transition.exited) this.detachMount(selection.slotAddress)
      for (const selection of transition.entered) this.mountSelection(selection)
      this.composition = {
        revision: previous.revision + 1,
        layoutPath: previous.layoutPath,
        selections: desiredMap,
      }
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

  /** Starts only occurrences that entered from an inactive scene key. */
  private async startEntered(
    synchronization: SynchronizationResult<SceneKey, SlotName>,
  ): Promise<void> {
    for (const selection of synchronization.entered) {
      if (synchronization.previousSceneKeys.has(selection.sceneKey)) continue
      const instance = this.instances.get(selection.sceneKey)
      if (instance === undefined) throw new Error(`L’instance Sighty ${selection.sceneKey} est absente.`)
      await instance.telco.rewind()
      await instance.telco.play()
    }
  }

  /** Restores the previous physical and logical composition after a mount failure. */
  private restoreComposition(
    previous: ActiveComposition<SceneKey, SlotName>,
    previousStates: ReadonlyMap<string, MountedState>,
  ): void {
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.composition = {
      revision: previous.revision,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }
    try {
      for (const selection of previous.selections.values()) this.mountSelection(selection)
      this.composition = previous
      this.transitioning = false
      for (const [slotAddress, state] of previousStates) {
        if (!state.wasPlaying) continue
        const selection = previous.selections.get(slotAddress)
        const instance = selection === undefined ? undefined : this.instances.get(selection.sceneKey)
        if (instance !== undefined) void instance.telco.play()
      }
    } catch (restoreError: unknown) {
      this.transitioning = false
      this.reportWarning('SIGHTY_COMPOSITION_RESTORE_FAILED', restoreError)
    }
  }

  /** Mounts one logical selection through CodPlay's public instance relation. */
  private mountSelection(selection: ActiveSelection<SceneKey, SlotName>): void {
    const slot = this.viewIndex.slotsByAddress.get(selection.slotAddress)
    if (slot === undefined) throw new Error(`Le slot Sighty ${selection.slotName} est absent de l’index.`)
    const layoutInstance = this.instances.get(this.layout.sceneKey)
    if (layoutInstance === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutScene = this.scenario.getScene(this.layout.sceneKey)
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
    const host: CodPlayInstanceHostTarget = {
      instanceId: layoutInstance.instanceId,
      storyId: resolution.entry.storyId,
      persoId: resolution.entry.persoId,
    }
    this.mounts.set(slot.address, this.owner.instances.mount({
      host,
      childInstanceId: child.instanceId,
      ...(resolution.entry.replace === undefined ? {} : { replace: resolution.entry.replace }),
    }))
  }

  /** Detaches one physical relation without destroying the child occurrence. */
  private detachMount(slotAddress: string): void {
    this.mounts.get(slotAddress)?.detach()
    this.mounts.delete(slotAddress)
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

  /** Returns one active binding for a scene that emitted a public event. */
  private findCurrentBinding(sceneKey: SceneKey): RuntimeBinding<SceneKey> | undefined {
    if (this.destroyed || this.transitioning || !this.initialized) return undefined
    if (sceneKey === this.layout.sceneKey && this.layoutGeneration > 0) {
      return {
        slotAddress: this.layoutEntry?.path ?? 'layout',
        sceneKey,
        generation: this.layoutGeneration,
      }
    }
    for (const selection of this.composition.selections.values()) {
      if (selection.sceneKey === sceneKey) {
        return {
          slotAddress: selection.slotAddress,
          sceneKey,
          generation: selection.generation,
        }
      }
    }
    return undefined
  }

  /** Rejects an event captured from a selection whose generation has ended. */
  private isCurrentBinding(binding: RuntimeBinding<SceneKey>): boolean {
    if (this.destroyed || this.transitioning) return false
    if (binding.sceneKey === this.layout.sceneKey
      && binding.slotAddress === (this.layoutEntry?.path ?? 'layout')) {
      return this.layoutGeneration === binding.generation
    }
    const selection = this.composition.selections.get(binding.slotAddress)
    return selection?.sceneKey === binding.sceneKey && selection.generation === binding.generation
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
    for (const listener of this.slotChangeListeners.get(slotName) ?? []) listener(sceneKey)
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
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    this.publicEventChannel.clear()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
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
