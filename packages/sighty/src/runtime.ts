import {
  CodPlay,
  resolveSlotManifestEntry,
  slotManifest,
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type CodPlayInstanceHostTarget,
  type CodPlayInstanceMountHandle,
  type CodPlayOptions,
  type CodPlayResourceRegistration,
  type CodPlayTraceEvent,
  type RuntimePreloadMode,
} from 'codplay'
import type { SightyScenarioApi, SightyView } from './types'

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

/** Configures the generic CodPlay execution grouped under one Sighty facade. */
export type SightyRuntimeConfiguration<
  SceneKey extends string = string,
> = Readonly<{
  root: HTMLElement
  instanceIds: Readonly<Record<SceneKey, string>>
  layout: SightyRuntimeLayout<SceneKey>
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
  mountSlot: (slotName: SlotName) => void
  detachSlot: (slotName: SlotName) => void
  isSlotMounted: (slotName: SlotName) => boolean
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
  private readonly preloadMode: RuntimePreloadMode
  private readonly styles: readonly SightyRuntimeStyle[]
  private readonly onTrace: SightyRuntimeOptions<SceneKey, SlotName>['onTrace']
  private readonly onPreloadWarning: SightyRuntimeOptions<SceneKey, SlotName>['onPreloadWarning']
  private readonly authoredSceneKeys: readonly SceneKey[]
  private readonly owner: CodPlay
  private readonly instances = new Map<SceneKey, CodPlayInstance>()
  private readonly mounts = new Map<SlotName, CodPlayInstanceMountHandle>()
  private readonly cleanups: Array<() => void> = []
  private resourceUrls: readonly string[] = []
  private initialized = false
  private destroyed = false

  /** Creates one runtime bound to a scenario and one visible root. */
  constructor(options: SightyRuntimeOptions<SceneKey, SlotName>) {
    this.scenario = options.scenario
    this.root = options.root
    this.instanceIds = options.instanceIds
    this.layout = options.layout
    this.preloadMode = options.preloadMode ?? 'author'
    this.styles = options.styles ?? []
    this.onTrace = options.onTrace
    this.onPreloadWarning = options.onPreloadWarning
    this.authoredSceneKeys = this.scenario.sceneKeys
    this.owner = new CodPlay(options.codplay)
  }

  /** Returns the scene keys selected from the authored file. */
  get sceneKeys(): readonly SceneKey[] {
    return this.authoredSceneKeys
  }

  /** Returns the slot names selected from the configured authored view. */
  get slotNames(): readonly SlotName[] {
    return this.scenario.getSlotNames(this.layout.sceneKey)
  }

  /** Returns one live CodPlay instance by its authored scene key. */
  getInstance(sceneKey: SceneKey): CodPlayInstance | undefined {
    return this.instances.get(sceneKey)
  }

  /** Compiles, preloads, materializes and mounts the authored view once. */
  async initialize(): Promise<void> {
    if (this.destroyed) throw new Error('Le runtime Sighty est déjà détruit.')
    if (this.initialized) return

    const diagnostics = this.scenario.validate()
    if (diagnostics.length > 0) {
      throw new Error(`Le fichier auteur Sighty est invalide. ${diagnosticDetails(diagnostics)}`)
    }

    const builds = this.compileScenes()
    await this.preloadScenes(builds)
    this.installStyles()
    this.createInstances(builds)
    this.mountDeclaredChildren()
    this.initialized = true
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

  /** Forwards runtime traces only when the application requested observation. */
  private observeInstance(instance: CodPlayInstance, sceneKey: SceneKey): void {
    const onTrace = this.onTrace
    if (onTrace === undefined) return
    this.cleanups.push(instance.diagnostic.onTrace((event) => onTrace(sceneKey, event)))
  }

  /** Mounts the first declared child of every slot in the selected view. */
  private mountDeclaredChildren(): void {
    const view = this.requireView()
    for (const slotName of this.slotNames) {
      const placement = view.view.slots[slotName][0]
      if (placement === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
      this.mountChild(slotName, placement.view.scene, this.slotReferencePath(slotName))
    }
  }

  /** Returns the authored view rooted at the configured layout scene. */
  private requireView(): SightyView<SceneKey, SlotName> {
    const view = this.scenario.getView(this.layout.sceneKey)
    if (view === undefined) throw new Error('Le fichier Sighty ne contient aucune vue.')
    return view
  }

  /** Describes one slot reference without depending on the view array order. */
  private slotReferencePath(slotName: SlotName): string {
    return `views.${this.layout.sceneKey}.view.slots.${slotName}`
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
    this.mounts.set(slotName, this.owner.instances.mount({
      host,
      childInstanceId: child.instanceId,
    }))
  }

  /** Mounts the first child declared for one slot when it is detached. */
  mountSlot(slotName: SlotName): void {
    if (this.mounts.has(slotName)) return
    const placement = this.requireView().view.slots[slotName][0]
    if (placement === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
    this.mountChild(slotName, placement.view.scene, this.slotReferencePath(slotName))
  }

  /** Detaches one mounted slot child without destroying its CodPlay instance. */
  detachSlot(slotName: SlotName): void {
    const mount = this.mounts.get(slotName)
    if (mount === undefined) return
    mount.detach()
    this.mounts.delete(slotName)
  }

  /** Reports whether one authored slot currently has a mount handle. */
  isSlotMounted(slotName: SlotName): boolean {
    return this.mounts.has(slotName)
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
