import {
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type CodPlayResourceRegistration,
} from 'codplay'
import type { ActiveSelection } from '../navigation/types'
import { diagnosticDetails, occurrenceKeyForSelection } from './helpers'
import type { SightyRuntimeBuilds } from './types'
import type { SightyRuntimeState } from './state'

/** Owns scene compilation, preparation and CodPlay occurrence lifecycle. */
export class RuntimeSceneManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>

  /** Creates a scene manager over one shared runtime state. */
  constructor(state: SightyRuntimeState<SceneKey, SlotName>) {
    this.state = state
  }

  /** Compiles every synchronously supplied scene without invoking deferred sources. */
  compileDirectScenes(): SightyRuntimeBuilds<SceneKey> {
    const builds = new Map<SceneKey, CodPlayCompileSuccess>()
    for (const sceneKey of this.state.authoredSceneKeys) {
      const scene = this.state.scenario.getScene(sceneKey)
      if (scene === undefined) continue
      this.state.sceneDocuments.set(sceneKey, scene)
      const result = this.state.owner.build({ scene })
      if (!result.ok) {
        throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
      }
      builds.set(sceneKey, result)
    }
    return builds
  }

  /** Compiles and preloads one scene without creating an occurrence. */
  async ensureScene(sceneKey: SceneKey): Promise<CodPlayCompileSuccess> {
    const existingBuild = this.state.compiledBuilds.get(sceneKey)
    if (existingBuild !== undefined) return existingBuild

    const scene = await this.state.scenario.resolveScene(sceneKey)
    if (scene === undefined) throw new Error(`La ressource de scène Sighty ${sceneKey} est absente.`)
    this.state.sceneDocuments.set(sceneKey, scene)
    const result = this.state.owner.build({ scene })
    if (!result.ok) {
      throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
    }
    this.state.compiledBuilds.set(sceneKey, result)
    await this.preloadScenes(new Map([[sceneKey, result]]))
    return result
  }

  /** Ensures the layout and every scene used by one target composition exist. */
  async ensureScenesForComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): Promise<void> {
    const layoutBuild = await this.ensureScene(this.state.layout.sceneKey)
    this.createInstance(this.layoutOccurrenceKey(), this.state.layout.sceneKey, layoutBuild)
    for (const selection of desired.values()) {
      await this.ensureScene(selection.sceneKey)
      this.createSelectionInstance(selection)
    }
  }

  /** Preloads compiled resources and registers their ownership with CodPlay. */
  async preloadScenes(builds: SightyRuntimeBuilds<SceneKey>): Promise<void> {
    const entries = [...builds.entries()]
    const manifests = entries.map(([, build]) => build.compiledScene.resources)
    const urls = [...new Set(manifests.flatMap((manifest) => manifest.entries.map((entry) => entry.url)))]
    for (const [sceneKey, build] of entries) {
      const sceneUrls = build.compiledScene.resources.entries.map((entry) => entry.url)
      this.state.resourceUrlsByScene.set(sceneKey, [...new Set(sceneUrls)])
    }
    this.state.resourceUrls = [...new Set([...this.state.resourceUrls, ...urls])]
    if (urls.length === 0) return

    const result = await this.state.owner.preload.load({
      manifest: manifests,
      options: { mode: this.state.preloadMode, container: this.state.root },
    })
    if (!result.ok) throw new Error(`Le préchargement Sighty a échoué : ${result.error.message}`)

    const registration: CodPlayResourceRegistration = {
      loaded: result.data.loaded,
      skipped: result.data.skipped,
      metadata: result.data.metadata,
      ...(result.data.media === undefined ? {} : { media: result.data.media }),
    }
    this.state.owner.resources.register(registration)
    for (const warning of result.data.warnings ?? []) this.state.onPreloadWarning?.(warning)
  }

  /** Installs configured styles through CodPlay's scoped CSS channel. */
  installStyles(): void {
    for (const style of this.state.styles) {
      this.state.owner.preload.css.set({
        slot: style.slot,
        cssText: style.cssText,
        container: this.state.root,
      })
    }
  }

  /** Creates one scene occurrence once its compiled definition is available. */
  createInstance(occurrenceKey: string, sceneKey: SceneKey, build: CodPlayCompileSuccess): void {
    if (this.state.instances.has(occurrenceKey)) return
    const baseInstanceId = this.state.instanceIds[sceneKey]
    if (typeof baseInstanceId !== 'string' || baseInstanceId.length === 0) {
      throw new Error(`L’identifiant d’instance Sighty de la scène ${sceneKey} est absent.`)
    }
    const isLayout = occurrenceKey === this.layoutOccurrenceKey()
    const instanceId = isLayout
      ? baseInstanceId
      : `${baseInstanceId}::${encodeURIComponent(occurrenceKey)}`
    const instance = this.state.owner.instances.create({
      instanceId,
      compiledScene: build.compiledScene,
      functions: build.functions,
      ...(occurrenceKey === this.layoutOccurrenceKey() ? { root: this.state.root } : {}),
    })
    this.state.instances.set(occurrenceKey, instance)
    this.state.instanceSceneKeys.set(occurrenceKey, sceneKey)
    this.observeInstance(instance, sceneKey)
  }

  /** Creates one active occurrence from a build already prepared by the runtime. */
  createSelectionInstance(selection: ActiveSelection<SceneKey, SlotName>): void {
    const occurrenceKey = occurrenceKeyForSelection(selection)
    if (this.state.instances.has(occurrenceKey)) return
    const build = this.state.compiledBuilds.get(selection.sceneKey)
    if (build === undefined) {
      throw new Error(`Le build Sighty de la scène ${selection.sceneKey} est absent.`)
    }
    this.createInstance(occurrenceKey, selection.sceneKey, build)
  }

  /** Resets every retained CodPlay occurrence without changing its identity. */
  async resetInstances(): Promise<void> {
    for (const instance of this.state.instances.values()) await instance.telco.reset()
  }

  /** Returns the internal key reserved for the mounted layout occurrence. */
  layoutOccurrenceKey(): string {
    return this.state.layoutEntry?.path ?? 'layout'
  }

  /** Returns the CodPlay occurrence attached to one active logical selection. */
  getInstanceForSelection(selection: ActiveSelection<SceneKey, SlotName>): CodPlayInstance | undefined {
    return this.state.instances.get(occurrenceKeyForSelection(selection))
  }

  /** Returns the active occurrence addressed by a public slot path. */
  getInstanceAt(slotAddress: string): CodPlayInstance | undefined {
    if (slotAddress === this.layoutOccurrenceKey()) return this.state.instances.get(slotAddress)
    const selection = this.state.composition.selections.get(slotAddress)
    return selection === undefined ? undefined : this.getInstanceForSelection(selection)
  }

  /** Returns every active occurrence carrying one authored scene key. */
  findActiveInstances(sceneKey: SceneKey): readonly CodPlayInstance[] {
    const instances: CodPlayInstance[] = []
    if (this.state.layout.sceneKey === sceneKey) {
      const layout = this.state.instances.get(this.layoutOccurrenceKey())
      if (layout !== undefined) instances.push(layout)
    }
    for (const selection of this.state.composition.selections.values()) {
      if (selection.sceneKey !== sceneKey) continue
      const instance = this.getInstanceForSelection(selection)
      if (instance !== undefined) instances.push(instance)
    }
    return instances
  }

  /** Connects CodPlay diagnostics to the host trace callback. */
  observeInstance(instance: CodPlayInstance, sceneKey: SceneKey): void {
    const onTrace = this.state.onTrace
    if (onTrace !== undefined) {
      this.state.cleanups.push(instance.diagnostic.onTrace((event) => onTrace(sceneKey, event)))
    }
  }

  /** Destroys all current scene occurrences while keeping the CodPlay owner alive. */
  destroyInstances(): void {
    for (const instance of [...this.state.instances.values()].reverse()) {
      this.state.owner.instances.destroy(instance.instanceId)
    }
    this.state.instances.clear()
    this.state.instanceSceneKeys.clear()
  }

  /** Releases all currently prepared resources and compiled scene metadata. */
  releasePreparedResources(): void {
    this.state.owner.preload.cancel()
    this.state.owner.preload.release(this.state.resourceUrls)
    this.state.resourceUrls = []
    this.state.resourceUrlsByScene.clear()
    this.state.compiledBuilds.clear()
    this.state.sceneDocuments.clear()
  }

  /** Releases occurrences and resources that no longer belong to the scenario. */
  pruneUnusedScenes(): void {
    const used = new Set(this.state.authoredSceneKeys)
    for (const [occurrenceKey, instance] of [...this.state.instances]) {
      const sceneKey = this.state.instanceSceneKeys.get(occurrenceKey)
      if (sceneKey !== undefined && used.has(sceneKey)) continue
      this.state.owner.instances.destroy(instance.instanceId)
      this.state.instances.delete(occurrenceKey)
      this.state.instanceSceneKeys.delete(occurrenceKey)
    }

    const releaseCandidates: string[] = []
    for (const sceneKey of [...this.state.compiledBuilds.keys()]) {
      if (used.has(sceneKey)) continue
      releaseCandidates.push(...(this.state.resourceUrlsByScene.get(sceneKey) ?? []))
      this.state.compiledBuilds.delete(sceneKey)
      this.state.sceneDocuments.delete(sceneKey)
      this.state.resourceUrlsByScene.delete(sceneKey)
    }
    const retainedUrls = new Set<string>()
    for (const urls of this.state.resourceUrlsByScene.values()) {
      for (const url of urls) retainedUrls.add(url)
    }
    const releasable = [...new Set(releaseCandidates)].filter((url) => !retainedUrls.has(url))
    if (releasable.length > 0) this.state.owner.preload.release(releasable)
    this.state.resourceUrls = this.state.resourceUrls.filter((url) => retainedUrls.has(url))
  }
}
