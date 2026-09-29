import {
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type CodPlayResourceRegistration,
} from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type { ActiveSelection } from '../navigation/types'
import { diagnosticDetails, occurrenceKeyForSelection } from './helpers'
import type { SightyRuntimeBuilds } from './types'
import { getLayoutSceneKey, type SightyRuntimeState } from './state'
import type { SightySceneCatalog } from '../types'

/** Owns scene compilation, preparation and CodPlay occurrence lifecycle. */
export class RuntimeSceneManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly installedSceneStyleSheets = new Set<SceneKey>()

  /** Creates a scene manager over one shared runtime state. */
  constructor(state: SightyRuntimeState<SceneKey, SlotName>) {
    this.state = state
  }

  /** Compiles every synchronously supplied scene without invoking deferred sources. */
  compileDirectScenes(): SightyRuntimeBuilds<SceneKey> {
    const builds = new Map<SceneKey, CodPlayCompileSuccess>()
    for (const sceneKey of this.state.authoredSceneKeys) {
      const source = this.state.scenario.getScene(sceneKey)
      if (source === undefined) continue
      const { sceneDoc, styleSheet } = resolveSceneSource(source)
      this.state.sceneDocuments.set(sceneKey, sceneDoc)
      const result = this.state.owner.build({ scene: sceneDoc })
      if (!result.ok) {
        throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
      }
      if (styleSheet.trim() !== '') this.state.sceneStyleSheets.set(sceneKey, styleSheet)
      builds.set(sceneKey, result)
    }
    return builds
  }

  /** Compiles and preloads one scene without creating an occurrence. */
  async ensureScene(sceneKey: SceneKey): Promise<CodPlayCompileSuccess> {
    const existingBuild = this.state.compiledBuilds.get(sceneKey)
    if (existingBuild !== undefined) return existingBuild

    const source = await this.state.scenario.resolveScene(sceneKey)
    if (source === undefined) throw new Error(`La ressource de scène Sighty ${sceneKey} est absente.`)
    const { sceneDoc, styleSheet } = resolveSceneSource(source)
    this.state.sceneDocuments.set(sceneKey, sceneDoc)
    const result = this.state.owner.build({ scene: sceneDoc })
    if (!result.ok) {
      throw new Error(`La scène Sighty ${sceneKey} est invalide. ${diagnosticDetails(result.diagnostics.errors)}`)
    }
    await this.preloadScenes(new Map([[sceneKey, result]]))
    this.installSceneStyleSheet(sceneKey, styleSheet)
    this.state.compiledBuilds.set(sceneKey, result)
    return result
  }

  /** Ensures the layout and every scene used by one target composition exist. */
  async ensureScenesForComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): Promise<void> {
    const layoutSceneKey = getLayoutSceneKey(this.state)
    const layoutBuild = await this.ensureScene(layoutSceneKey)
    this.createInstance(this.layoutOccurrenceKey(), layoutSceneKey, layoutBuild)
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
    const activeSceneKeys = new Set(this.state.sceneStyleSheets.keys())
    for (const sceneKey of this.installedSceneStyleSheets) {
      if (activeSceneKeys.has(sceneKey)) continue
      this.state.owner.preload.css.clear(sceneStyleSlot(sceneKey))
      this.installedSceneStyleSheets.delete(sceneKey)
    }
    for (const [sceneKey, styleSheet] of this.state.sceneStyleSheets) {
      this.installSceneStyleSheet(sceneKey, styleSheet)
    }
  }

  /** Installs one scene stylesheet in a stable preload slot scoped to the Sighty root. */
  private installSceneStyleSheet(sceneKey: SceneKey, styleSheet: string): void {
    if (styleSheet.trim() === '') return
    this.state.sceneStyleSheets.set(sceneKey, styleSheet)
    this.state.owner.preload.css.set({
      slot: sceneStyleSlot(sceneKey),
      cssText: styleSheet,
      container: this.state.root,
    })
    this.installedSceneStyleSheets.add(sceneKey)
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
    if (getLayoutSceneKey(this.state) === sceneKey) {
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
      this.state.sceneStyleSheets.delete(sceneKey)
      this.state.owner.preload.css.clear(sceneStyleSlot(sceneKey))
      this.installedSceneStyleSheets.delete(sceneKey)
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

/** Separates the CodPlay document from the stylesheet emitted beside it by a builder. */
function resolveSceneSource(source: SightySceneCatalog[string]): Readonly<{
  sceneDoc: SceneDoc<string>
  styleSheet: string
}> {
  if ('sceneDoc' in source) return source
  return { sceneDoc: source, styleSheet: '' }
}

/** Returns the stable CSS slot used for one scene's stylesheet. */
function sceneStyleSlot(sceneKey: string): string {
  return `sighty-scene:${sceneKey}`
}
