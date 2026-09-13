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
import {
  findGraphContext,
  getGraphActionReferences,
  findGraphViewByPath,
  findGraphViewByScene,
  getDirectGraphEntries,
  getGraphEntries,
  getGraphSlots,
  getGraphStartEntry,
  type SightyGraphEntry,
  type SightyGraphSlot,
} from './view-graph'
import type {
  SightyRouteTarget,
  SightyScenarioApi,
  SightyViewAction,
  SightyViewGraph,
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

/** Defines one executable action kept outside the serializable scenario file. */
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
export type SightyRuntimeConfiguration<
  SceneKey extends string = string,
> = Readonly<{
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

type SightySlotSelection<
  SceneKey extends string,
  SlotName extends string,
> = Readonly<{
  slotName: SlotName
  graph: SightyViewGraph<SceneKey, SlotName>
  graphPath: string
  ownerPath: string
  entry: SightyGraphEntry<SceneKey, SlotName>
  sceneEntry: SightyGraphEntry<SceneKey, SlotName>
  sceneKey: SceneKey
}>

type SightyActionCandidate<
  SceneKey extends string,
  SlotName extends string,
> = Readonly<{
  action: SightyViewAction
  selection: SightySlotSelection<SceneKey, SlotName>
  depth: number
  sourceMatch: boolean
  order: number
}>

/** Joins diagnostic messages into one error detail without adding policy. */
function diagnosticDetails(diagnostics: readonly { message: string }[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join(' ')
}

/** Executes one Sighty scenario through the public CodPlay facade. */
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
  private readonly authoredSceneKeys: readonly SceneKey[]
  private readonly viewGraph: SightyViewGraph<SceneKey, SlotName>
  private readonly owner: CodPlay
  private readonly instances = new Map<SceneKey, CodPlayInstance>()
  private readonly mounts = new Map<SlotName, CodPlayInstanceMountHandle>()
  private readonly mountedChildren = new Map<SlotName, SceneKey>()
  private readonly selections = new Map<SlotName, SightySlotSelection<SceneKey, SlotName>>()
  private readonly slotChangeListeners = new Map<
    SlotName,
    Set<SightyRuntimeSlotChangeListener<SceneKey>>
  >()
  private readonly cleanups: Array<() => void> = []
  private readonly navigationChain: { current: Promise<unknown> } = { current: Promise.resolve() }
  private layoutEntry: SightyGraphEntry<SceneKey, SlotName> | undefined
  private resourceUrls: readonly string[] = []
  private initialized = false
  private destroyed = false

  /** Creates one runtime bound to a scenario and one visible root. */
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
    this.viewGraph = this.scenario.getViewGraph()
    this.authoredSceneKeys = collectReferencedSceneKeys(this.viewGraph)
    this.layoutEntry = findGraphViewByScene(this.viewGraph, this.layout.sceneKey)
    this.owner = new CodPlay(options.codplay)
  }

  /** Returns the scene keys selected from the authored file. */
  get sceneKeys(): readonly SceneKey[] {
    return this.authoredSceneKeys
  }

  /** Returns the slot names selected from the configured authored view. */
  get slotNames(): readonly SlotName[] {
    return [...new Set(getGraphSlots(this.viewGraph).map((slot) => slot.slotName))] as SlotName[]
  }

  /** Returns one live CodPlay instance by its authored scene key. */
  getInstance(sceneKey: SceneKey): CodPlayInstance | undefined {
    return this.instances.get(sceneKey)
  }

  /** Compiles, preloads, materializes and mounts the authored graph once. */
  async initialize(): Promise<void> {
    if (this.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (this.initialized) return

    const diagnostics = this.scenario.validate()
    if (diagnostics.length > 0) {
      throw new Error(`Le fichier auteur Sighty est invalide. ${diagnosticDetails(diagnostics)}`)
    }
    this.validateActionCatalog()

    this.layoutEntry = this.requireLayoutEntry()
    const builds = this.compileScenes()
    await this.preloadScenes(builds)
    this.installStyles()
    this.createInstances(builds)
    this.mountDeclaredChildren()
    this.initialized = true
    for (const [slotName, selection] of this.selections) this.notifySlotChange(slotName, selection.sceneKey)
  }

  /** Compiles every scene named by the authored file. */
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

  /** Forwards traces and public scene events into the Sighty router. */
  private observeInstance(instance: CodPlayInstance, sceneKey: SceneKey): void {
    const onTrace = this.onTrace
    if (onTrace !== undefined) {
      this.cleanups.push(instance.diagnostic.onTrace((event) => onTrace(sceneKey, event)))
    }
    this.cleanups.push(instance.events.onEvent((event) => this.receivePublicEvent(sceneKey, event)))
  }

  /** Queues one public CodPlay event for declarative scenario routing. */
  private receivePublicEvent(sceneKey: SceneKey, event: CodPlayPublicEvent): void {
    void this.dispatch({
      name: event.name,
      sourceSceneKey: sceneKey,
      data: event.data,
    }).catch((error: unknown) => {
      if (this.destroyed) return
      this.onPreloadWarning?.({
        code: 'SIGHTY_NAVIGATION_FAILED',
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }

  /** Mounts the declared start nodes of the initial composition branch. */
  private mountDeclaredChildren(): void {
    const initialView = this.resolveInitialView(this.requireLayoutEntry())
    for (const slot of this.compositionSlots(initialView.path)) {
      const entry = getGraphStartEntry(slot.graph, slot.graphPath)
      if (entry === undefined) throw new Error(`Le slot Sighty ${slot.slotName} est vide.`)
      const selection = this.createSelection(slot.slotName, slot.graph, slot.graphPath, slot.ownerPath, entry)
      this.mountSelection(selection, false)
    }
  }

  /** Returns the authored layout node selected by the runtime configuration. */
  private requireLayoutEntry(): SightyGraphEntry<SceneKey, SlotName> {
    const entry = this.layoutEntry ?? findGraphViewByScene(this.viewGraph, this.layout.sceneKey)
    if (entry === undefined) throw new Error('Le fichier Sighty ne contient aucune vue layout.')
    return entry
  }

  /** Resolves the first structural view on the configured layout branch. */
  private resolveInitialView(entry: SightyGraphEntry<SceneKey, SlotName>): SightyGraphEntry<SceneKey, SlotName> {
    const childViews = entry.view.view.views
    if (childViews === undefined) return entry
    const child = getGraphStartEntry(childViews, entry.path)
    return child === undefined ? entry : this.resolveInitialView(child)
  }

  /** Returns all graph slots whose owner belongs to one active composition branch. */
  private compositionSlots(
    ownerPath: string,
    selectedEntryPath?: string,
  ): readonly SightyGraphSlot<SceneKey, SlotName>[] {
    const layoutPath = this.requireLayoutEntry().path
    return getGraphSlots(this.viewGraph).filter((slot) => {
      if (!isPathPrefix(layoutPath, slot.ownerPath)) return false
      if (isPathPrefix(slot.ownerPath, ownerPath)) return true
      if (slot.ownerPath === ownerPath) return true
      return selectedEntryPath !== undefined && isPathPrefix(selectedEntryPath, slot.ownerPath)
    })
  }

  /** Finds the graph slot that contains one authored entry path. */
  private findContainingSlot(path: string): SightyGraphSlot<SceneKey, SlotName> | undefined {
    return getGraphSlots(this.viewGraph)
      .filter((slot) => isPathPrefix(slot.graphPath, path))
      .sort((left, right) => right.graphPath.length - left.graphPath.length)[0]
  }

  /** Describes one slot reference for CodPlay's authored manifest resolver. */
  private slotReferencePath(slotName: SlotName): string {
    return `views.${this.requireLayoutEntry().path}.view.slots.${slotName}`
  }

  /** Resolves one slot graph and an optional scene selection. */
  private resolveSlotSelection(
    slotName: SlotName,
    childSceneKey?: SceneKey,
  ): SightySlotSelection<SceneKey, SlotName> {
    const activeSlot = this.selections.get(slotName)
    const slot = activeSlot === undefined
      ? getGraphSlots(this.viewGraph).find((candidate) => candidate.slotName === slotName)
      : getGraphSlots(this.viewGraph).find((candidate) => candidate.graphPath === activeSlot.graphPath)
    if (slot === undefined) throw new Error(`Le slot Sighty ${slotName} n'est pas déclaré dans le layout.`)
    const { graph, graphPath } = slot
    const entries = getGraphEntries(graph, graphPath)
    const entry = childSceneKey === undefined
      ? getGraphStartEntry(graph, graphPath)
      : entries.find((candidate) => candidate.view.view.scene === childSceneKey)
    if (entry === undefined) {
      if (childSceneKey === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
      throw new Error(`La scène Sighty ${childSceneKey} n'est pas déclarée dans le slot ${slotName}.`)
    }
    return this.createSelection(slotName, graph, graphPath, slot.ownerPath, entry)
  }

  /** Resolves one graph entry to the scene that must be mounted for it. */
  private resolveSceneEntry(
    entry: SightyGraphEntry<SceneKey, SlotName>,
  ): SightyGraphEntry<SceneKey, SlotName> | undefined {
    if (entry.view.view.scene !== undefined) return entry
    const nestedGraph = entry.view.view.views ?? entry.view.view.graph
    if (nestedGraph === undefined) return undefined
    const nestedPath = entry.view.view.views === undefined ? `${entry.path}/graph` : entry.path
    const nestedStart = getGraphStartEntry(nestedGraph, nestedPath)
    return nestedStart === undefined ? undefined : this.resolveSceneEntry(nestedStart)
  }

  /** Creates one active slot selection and resolves its materialized scene. */
  private createSelection(
    slotName: SlotName,
    graph: SightyViewGraph<SceneKey, SlotName>,
    graphPath: string,
    ownerPath: string,
    entry: SightyGraphEntry<SceneKey, SlotName>,
  ): SightySlotSelection<SceneKey, SlotName> {
    const sceneEntry = this.resolveSceneEntry(entry)
    if (sceneEntry === undefined || sceneEntry.view.view.scene === undefined) {
      throw new Error(`La vue Sighty « ${entry.path} » ne désigne aucune scène montable.`)
    }
    return {
      slotName,
      graph,
      graphPath,
      ownerPath,
      entry,
      sceneEntry,
      sceneKey: sceneEntry.view.view.scene,
    }
  }

  /** Mounts one selected authored scene in its layout slot. */
  private mountSelection(selection: SightySlotSelection<SceneKey, SlotName>, notify: boolean): void {
    this.mountChild(selection.slotName, selection.sceneKey, this.slotReferencePath(selection.slotName))
    this.selections.set(selection.slotName, selection)
    if (notify) this.notifySlotChange(selection.slotName, selection.sceneKey)
  }

  /** Mounts one authored child in the slot exposed by the configured layout. */
  private mountChild(slotName: SlotName, childSceneKey: SceneKey, referencePath: string): void {
    const layoutInstance = this.instances.get(this.layout.sceneKey)
    if (layoutInstance === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutScene = this.scenario.getScene(this.layout.sceneKey)
    if (layoutScene === undefined) throw new Error('La ressource layout Sighty est absente.')
    const resolution = resolveSlotManifestEntry(slotManifest(layoutScene, { storyId: this.layout.storyId }), slotName, {
      sceneId: layoutScene.id,
      storyId: this.layout.storyId,
      referencePath,
    })
    if (!resolution.ok) throw new Error(resolution.diagnostic.message)

    const child = this.instances.get(childSceneKey)
    if (child === undefined) throw new Error(`L’instance enfant ${childSceneKey} est absente.`)
    const host: CodPlayInstanceHostTarget = {
      instanceId: layoutInstance.instanceId,
      storyId: resolution.entry.storyId,
      persoId: resolution.entry.persoId,
    }
    const replace = resolution.entry.replace
    if (this.mounts.has(slotName) && replace === undefined) this.detachSlotInternal(slotName, false)
    this.mounts.set(slotName, this.owner.instances.mount({
      host,
      childInstanceId: child.instanceId,
      ...(replace === undefined ? {} : { replace }),
    }))
    this.mountedChildren.set(slotName, childSceneKey)
  }

  /** Routes one external or public event through the active declarative scopes. */
  dispatch(event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    if (this.destroyed) return Promise.reject(new Error('Le runtime Sighty est déjà détruit.'))
    if (!this.initialized) return Promise.reject(new Error('Le runtime Sighty n’est pas initialisé.'))
    const task = this.navigationChain.current.then(() => this.dispatchNow(event))
    this.navigationChain.current = task.then(() => undefined, () => undefined)
    return task
  }

  /** Resolves one event action and activates the declared destination. */
  private async dispatchNow(event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    for (const candidate of this.resolveActionCandidates(event)) {
      const { action } = candidate
      if (action.go !== undefined) {
        const selection = this.resolveRouteTarget(action.go, candidate.selection)
        if (selection === undefined) {
          if (isDirectionalTarget(action.go)) continue
          return false
        }
        await this.activateSelection(selection)
      }

      if (action.action !== undefined) await this.executeAction(action.action, event)
      return action.go !== undefined || action.action !== undefined
    }
    return false
  }

  /** Rejects authored action references that have no application-owned handler. */
  private validateActionCatalog(): void {
    for (const reference of getGraphActionReferences(this.viewGraph)) {
      if (this.actionCatalog[reference] === undefined) {
        throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
      }
    }
  }

  /** Executes one catalogued action after its declared route is active. */
  private async executeAction(
    reference: string,
    event: SightyRuntimeEvent<SceneKey>,
  ): Promise<void> {
    const handler = this.actionCatalog[reference]
    if (handler === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }

    await handler({
      event,
      send: async (sceneKey, eventime, target) => {
        const instance = this.instances.get(sceneKey)
        if (instance === undefined) {
          throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
        }
        await instance.events.emit(eventime, target)
      },
    })
  }

  /** Searches active view scopes and keeps parent actions available as fallbacks. */
  private resolveActionCandidates(event: SightyRuntimeEvent<SceneKey>): readonly SightyActionCandidate<SceneKey, SlotName>[] {
    const candidates: SightyActionCandidate<SceneKey, SlotName>[] = []
    let order = 0
    for (const selection of this.selections.values()) {
      const context = findGraphContext(this.viewGraph, selection.entry.path)
      if (context === undefined) continue
      const entryDepth = graphPathDepth(selection.entry.path)
      const scopedViews = [
        { scope: context.entry.view, depth: entryDepth },
        ...context.graphScopes.slice().reverse().map((scope, index) => ({
          scope,
          depth: Math.max(0, entryDepth - index - 1),
        })),
        ...context.parentViews.slice().reverse().map((parent) => ({
          scope: parent.view,
          depth: graphPathDepth(parent.path),
        })),
      ]
      for (const { scope, depth } of scopedViews) {
        const action = scope.actions?.[event.name]
        if (action === undefined) continue
        if (candidates.some((candidate) => candidate.action === action && candidate.selection === selection)) continue
        candidates.push({
          action,
          selection,
          depth,
          sourceMatch: selection.sceneKey === event.sourceSceneKey,
          order: order++,
        })
      }
    }
    return candidates.sort((left, right) => {
      if (left.depth !== right.depth) return right.depth - left.depth
      if (left.sourceMatch !== right.sourceMatch) return left.sourceMatch ? -1 : 1
      return left.order - right.order
    })
  }

  /** Resolves a declarative path, label or direction into one active slot target. */
  private resolveRouteTarget(
    target: SightyRouteTarget,
    preferredSelection?: SightySlotSelection<SceneKey, SlotName>,
  ): SightySlotSelection<SceneKey, SlotName> | undefined {
    if ('direction' in target) return this.resolveDirectionalSelection(target.direction, preferredSelection)

    const entry = 'path' in target
      ? findGraphViewByPath(this.viewGraph, target.path)
      : getGraphEntries(this.viewGraph).find((candidate) => candidate.key === target.label)
    return entry === undefined ? undefined : this.resolveEntrySelection(entry.path)
  }

  /** Resolves a graph path to the physical slot that contains it. */
  private resolveEntrySelection(path: string): SightySlotSelection<SceneKey, SlotName> | undefined {
    const slot = this.findContainingSlot(path)
    if (slot === undefined) return undefined
    const entry = getGraphEntries(slot.graph, slot.graphPath).find((candidate) => candidate.path === path)
    return entry === undefined
      ? undefined
      : this.createSelection(slot.slotName, slot.graph, slot.graphPath, slot.ownerPath, entry)
  }

  /** Resolves next, previous, up and down against the active graph hierarchy. */
  private resolveDirectionalSelection(
    direction: 'next' | 'previous' | 'up' | 'down',
    preferredSelection?: SightySlotSelection<SceneKey, SlotName>,
  ): SightySlotSelection<SceneKey, SlotName> | undefined {
    const selections = preferredSelection === undefined
      ? [...this.selections.values()]
      : [preferredSelection]
    for (const selection of selections) {
      if (direction === 'next' || direction === 'previous') {
        const entries = getDirectGraphEntries(selection.graph, selection.graphPath)
        const currentIndex = entries.findIndex((entry) => entry.path === selection.entry.path)
        if (currentIndex < 0) continue
        const offset = direction === 'next' ? 1 : -1
        const target = entries[currentIndex + offset]
        if (target !== undefined) return this.createSelection(
          selection.slotName,
          selection.graph,
          selection.graphPath,
          selection.ownerPath,
          target,
        )
        continue
      }

      if (direction === 'down') {
        const nestedGraph = selection.entry.view.view.views ?? selection.entry.view.view.graph
        if (nestedGraph === undefined) continue
        const nestedPath = selection.entry.view.view.views === undefined
          ? `${selection.entry.path}/graph`
          : selection.entry.path
        const target = getGraphStartEntry(nestedGraph, nestedPath)
        if (target !== undefined) return this.createSelection(
          selection.slotName,
          selection.graph,
          selection.graphPath,
          selection.ownerPath,
          target,
        )
        continue
      }

      const context = findGraphContext(this.viewGraph, selection.entry.path)
      if (context === undefined) continue
      for (const parent of context.parentViews.slice().reverse()) {
        if (!parent.path.startsWith(`${selection.graphPath}/`)) continue
        if (parent.view.view.scene === undefined) continue
        return this.createSelection(
          selection.slotName,
          selection.graph,
          selection.graphPath,
          selection.ownerPath,
          parent,
        )
      }
    }
    return undefined
  }

  /** Pauses the current mounted scene when it can still receive commands. */
  private async pauseSelection(selection: SightySlotSelection<SceneKey, SlotName> | undefined): Promise<void> {
    if (selection === undefined) return
    const instance = this.instances.get(selection.sceneKey)
    if (instance === undefined) return
    const state = instance.telco.getState()
    if (state.status === 'playing' && !state.sequenceEnded) await instance.telco.pause()
  }

  /** Builds the selections required by one target composition branch. */
  private desiredComposition(
    target: SightySlotSelection<SceneKey, SlotName>,
  ): ReadonlyMap<SlotName, SightySlotSelection<SceneKey, SlotName>> {
    const desired = new Map<SlotName, SightySlotSelection<SceneKey, SlotName>>()
    for (const slot of this.compositionSlots(target.ownerPath, target.entry.path)) {
      if (desired.has(slot.slotName)) {
        throw new Error(`Le slot Sighty ${slot.slotName} est déclaré plusieurs fois dans la branche active.`)
      }

      const current = this.selections.get(slot.slotName)
      if (slot.slotName === target.slotName && slot.graphPath === target.graphPath) {
        desired.set(slot.slotName, target)
        continue
      }
      if (current?.graphPath === slot.graphPath && this.mounts.has(slot.slotName)) {
        desired.set(slot.slotName, current)
        continue
      }

      const entry = getGraphStartEntry(slot.graph, slot.graphPath)
      if (entry === undefined) throw new Error(`Le slot Sighty ${slot.slotName} est vide.`)
      desired.set(
        slot.slotName,
        this.createSelection(slot.slotName, slot.graph, slot.graphPath, slot.ownerPath, entry),
      )
    }
    return desired
  }

  /** Aligns the physical slots and returns the occurrences newly activated by the branch. */
  private async synchronizeComposition(
    target: SightySlotSelection<SceneKey, SlotName>,
  ): Promise<readonly SightySlotSelection<SceneKey, SlotName>[]> {
    const desired = this.desiredComposition(target)
    const newlyMounted: SightySlotSelection<SceneKey, SlotName>[] = []

    for (const [slotName, current] of this.selections) {
      const next = desired.get(slotName)
      if (next === undefined || next.entry.path !== current.entry.path) await this.pauseSelection(current)
    }

    for (const [slotName] of this.selections) {
      if (!desired.has(slotName)) this.detachSlotInternal(slotName, false)
    }

    for (const selection of desired.values()) {
      const current = this.selections.get(selection.slotName)
      if (current?.entry.path === selection.entry.path && this.mounts.has(selection.slotName)) continue
      this.mountSelection(selection, false)
      newlyMounted.push(selection)
    }
    return newlyMounted
  }

  /** Replaces one selected branch and starts every newly mounted occurrence from its beginning. */
  private async activateSelection(selection: SightySlotSelection<SceneKey, SlotName>): Promise<void> {
    const current = this.selections.get(selection.slotName)
    if (current?.entry.path === selection.entry.path && this.mounts.has(selection.slotName)) return
    const newlyMounted = await this.synchronizeComposition(selection)
    for (const activated of newlyMounted) {
      const instance = this.instances.get(activated.sceneKey)
      if (instance === undefined) throw new Error(`L’instance Sighty ${activated.sceneKey} est absente.`)
      await instance.telco.rewind()
      await instance.telco.play()
    }
    this.notifySlotChange(selection.slotName, selection.sceneKey)
  }

  /** Mounts the requested declared child and replaces the current slot child when needed. */
  mountSlot(slotName: SlotName, childSceneKey?: SceneKey): void {
    const selection = this.resolveSlotSelection(slotName, childSceneKey)
    const current = this.selections.get(slotName)
    if (current?.entry.path === selection.entry.path && this.mounts.has(slotName)) return
    this.mountSelection(selection, true)
  }

  /** Detaches one mounted slot child without destroying its CodPlay instance. */
  detachSlot(slotName: SlotName): void {
    this.detachSlotInternal(slotName, true)
  }

  /** Detaches one slot and optionally reports the empty selection to observers. */
  private detachSlotInternal(slotName: SlotName, notify: boolean): void {
    const mount = this.mounts.get(slotName)
    if (mount !== undefined) mount.detach()
    this.mounts.delete(slotName)
    this.mountedChildren.delete(slotName)
    this.selections.delete(slotName)
    if (notify) this.notifySlotChange(slotName, undefined)
  }

  /** Reports whether one authored slot currently has a mount handle. */
  isSlotMounted(slotName: SlotName): boolean {
    return this.mounts.has(slotName)
  }

  /** Returns the scene currently selected by one authored slot. */
  getMountedSceneKey(slotName: SlotName): SceneKey | undefined {
    return this.mountedChildren.get(slotName)
  }

  /** Subscribes to selection changes in one authored slot. */
  onSlotChange(slotName: SlotName, listener: SightyRuntimeSlotChangeListener<SceneKey>): () => void {
    const listeners = this.slotChangeListeners.get(slotName) ?? new Set()
    listeners.add(listener)
    this.slotChangeListeners.set(slotName, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.slotChangeListeners.delete(slotName)
    }
  }

  /** Notifies the observers of one slot selection without changing the DOM. */
  private notifySlotChange(slotName: SlotName, sceneKey: SceneKey | undefined): void {
    for (const listener of this.slotChangeListeners.get(slotName) ?? []) listener(sceneKey)
  }

  /** Starts one initialized scene occurrence. */
  async play(sceneKey: SceneKey): Promise<void> {
    const instance = this.instances.get(sceneKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await instance.telco.play()
  }

  /** Starts the selected scene occurrences in declaration order. */
  async playAll(sceneKeys: readonly SceneKey[] = this.authoredSceneKeys): Promise<void> {
    for (const sceneKey of sceneKeys) await this.play(sceneKey)
  }

  /** Releases mounts, instances, resources and the CodPlay owner once. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    for (const cleanup of this.cleanups.splice(0)) cleanup()
    for (const mount of this.mounts.values()) mount.detach()
    this.mounts.clear()
    this.mountedChildren.clear()
    this.selections.clear()
    this.slotChangeListeners.clear()
    for (const sceneKey of [...this.instances.keys()].reverse()) {
      this.owner.instances.destroy(this.instanceIds[sceneKey])
    }
    this.owner.preload.release(this.resourceUrls)
    this.owner.destroy()
    this.instances.clear()
    this.initialized = false
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

/** Tests a normalized graph path prefix without confusing sibling identifiers. */
function isPathPrefix(prefix: string, path: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Returns the hierarchy depth of one normalized graph path. */
function graphPathDepth(path: string): number {
  return path.length === 0 ? 0 : path.split('/').length
}

/** Identifies route targets eligible for inherited boundary resolution. */
function isDirectionalTarget(target: SightyRouteTarget): target is { direction: 'next' | 'previous' | 'up' | 'down' } {
  return 'direction' in target
}

/** Returns each scene referenced by the scenario graph in first-seen order. */
function collectReferencedSceneKeys<
  SceneKey extends string,
  SlotName extends string,
>(graph: SightyViewGraph<SceneKey, SlotName>): readonly SceneKey[] {
  const keys: SceneKey[] = []
  for (const entry of getGraphEntries(graph)) {
    const sceneKey = entry.view.view.scene
    if (sceneKey !== undefined && !keys.includes(sceneKey)) keys.push(sceneKey)
  }
  return keys
}
