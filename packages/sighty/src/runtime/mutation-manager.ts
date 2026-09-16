import { createViewIndex } from '../navigation/graph-index'
import { createSelection, resolveInitialAnchor, resolveSceneEntry } from '../navigation/composition'
import type { ActiveSelection } from '../navigation/types'
import type {
  SightyMutationReloadPolicy,
  SightyScenarioMutation,
} from '../types'
import type { SightyScenarioMutationResult } from '../scenario'
import { collectSceneKeys, reportWarning } from './helpers'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimeCompositionManager } from './composition-manager'
import { RuntimeNavigationManager } from './navigation-manager'
import { RuntimeSceneManager } from './scene-manager'
import { RuntimeTransitionManager } from './transition-manager'
import type { SightyRuntimeState } from './state'
import type { MountedState, RuntimeMutationSnapshot } from './types'

/** Owns versioned scenario mutations, reset and physical rollback. */
export class RuntimeMutationManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly scenes: RuntimeSceneManager<SceneKey, SlotName>
  private readonly composition: RuntimeCompositionManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly navigation: RuntimeNavigationManager<SceneKey, SlotName>
  private readonly transitions: RuntimeTransitionManager<SceneKey, SlotName>
  private readonly ensureInstanceIds: () => void
  private readonly validateCatalogs: () => void

  /** Creates a mutation manager over all runtime coordination boundaries. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    scenes: RuntimeSceneManager<SceneKey, SlotName>,
    composition: RuntimeCompositionManager<SceneKey, SlotName>,
    bindings: RuntimeBindingManager<SceneKey, SlotName>,
    navigation: RuntimeNavigationManager<SceneKey, SlotName>,
    transitions: RuntimeTransitionManager<SceneKey, SlotName>,
    ensureInstanceIds: () => void,
    validateCatalogs: () => void,
  ) {
    this.state = state
    this.scenes = scenes
    this.composition = composition
    this.bindings = bindings
    this.navigation = navigation
    this.transitions = transitions
    this.ensureInstanceIds = ensureInstanceIds
    this.validateCatalogs = validateCatalogs
  }

  /** Restores the pristine runtime state after an incomplete initialization. */
  rollbackInitialization(): void {
    this.bindings.closeAllBindings()
    for (const cleanup of this.state.cleanups.splice(0)) cleanup()
    this.composition.detachAllMounts()
    this.scenes.destroyInstances()
    this.state.owner.preload.cancel()
    this.state.owner.preload.release(this.state.resourceUrls)
    this.state.owner.preload.css.clear()
    this.state.resourceUrls = []
    this.state.resourceUrlsByScene.clear()
    this.state.compiledBuilds.clear()
    this.state.sceneDocuments.clear()
    this.state.deliveredData.clear()
    this.state.context = { ...this.state.initialContext }
    this.state.composition = {
      revision: this.state.composition.revision + 1,
      layoutPath: this.state.layoutEntry?.path ?? '',
      selections: new Map(),
    }
    this.state.layoutGeneration = 0
    this.state.initialAnchor = undefined
    this.state.generationCounters.clear()
    this.state.initialized = false
    this.state.transitioning = false
  }

  /** Resets initialized occurrences in place while retaining prepared resources. */
  async resetNow(): Promise<void> {
    this.state.transitioning = true
    this.bindings.closeAllBindings()
    this.composition.detachAllMounts()
    await this.scenes.resetInstances()
    this.state.deliveredData.clear()
    this.state.generationCounters.clear()
    this.state.context = { ...this.state.initialContext }
    this.state.composition = {
      revision: this.state.composition.revision + 1,
      layoutPath: this.state.layoutEntry?.path ?? '',
      selections: new Map(),
    }
    this.state.layoutGeneration = 0

    try {
      const desired = await this.navigation.resolveAccessibleComposition(undefined, {
        name: 'runtime:reset',
      })
      if (desired === undefined) throw new Error('La composition initiale Sighty est refusée après reset.')
      this.state.layoutGeneration = 1
      this.state.initialized = true
      await this.transitions.execute(desired, {
        entryBehavior: 'none',
        notify: true,
        onPrepared: () => this.bindings.openLayoutBinding(),
        deliverEnteredData: (selections) => this.navigation.deliverEnteredData(selections),
      })
    } catch (error: unknown) {
      this.rollbackInitialization()
      throw error
    }
  }

  /** Applies a scenario mutation and keeps its public operation atomic. */
  async mutateNow(
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
    policy: SightyMutationReloadPolicy,
  ): Promise<boolean> {
    const snapshot = this.captureMutationSnapshot()
    const result: SightyScenarioMutationResult<SceneKey, SlotName> = this.state.mutableScenario.applyMutation(mutation)

    try {
      const nextIndex = createViewIndex(result.viewGraph)
      const nextLayoutEntry = nextIndex.entriesByScene.get(this.state.layout.sceneKey)?.[0]
      if (nextLayoutEntry === undefined) throw new Error('La mutation Sighty supprime la vue layout configurée.')
      this.state.viewIndex = nextIndex
      this.state.authoredSceneKeys = collectSceneKeys(nextIndex)
      this.state.layoutEntry = nextLayoutEntry
      this.state.initialAnchor = resolveInitialAnchor(nextIndex, nextLayoutEntry)
      this.ensureInstanceIds()
      this.validateCatalogs()

      if (policy === 'reset' || policy === 'reload') {
        if (policy === 'reload') await this.reloadResources()
        await this.resetNow()
        this.scenes.pruneUnusedScenes()
        return true
      }

      const target = this.resolvePreservedTarget()
      const desired = await this.navigation.resolveAccessibleComposition(target, {
        name: 'runtime:mutation',
      })
      if (desired === undefined) throw new Error('La composition Sighty est refusée après mutation.')
      if (!await this.navigation.allowsExit(this.state.composition, desired, { name: 'runtime:mutation' })) {
        this.restoreMutationAuthoringState(result, snapshot)
        return false
      }
      await this.transitions.execute(desired, {
        entryBehavior: policy === 'rewind' ? 'rewind' : 'none',
        notify: true,
        deliverEnteredData: (selections) => this.navigation.deliverEnteredData(selections),
      })
      this.scenes.pruneUnusedScenes()
      return true
    } catch (error: unknown) {
      this.restoreMutationAuthoringState(result, snapshot)
      try {
        await this.restoreMutationPhysicalState(snapshot)
      } catch (restoreError: unknown) {
        this.state.initialized = false
        this.state.transitioning = false
        reportWarning(this.state, 'SIGHTY_MUTATION_RESTORE_FAILED', restoreError)
      }
      throw error
    }
  }

  /** Resolves the deepest still-declared selection for preserve mode. */
  private resolvePreservedTarget(): ActiveSelection<SceneKey, SlotName> | undefined {
    const previousSelections = [...this.state.composition.selections.values()]
      .sort((left, right) => right.entry.path.length - left.entry.path.length)
    for (const previous of previousSelections) {
      const entry = this.state.viewIndex.entriesByPath.get(previous.entry.path)
      const slot = this.state.viewIndex.slotsByAddress.get(previous.slotAddress)
      if (entry === undefined || slot === undefined || entry.view.hidden === true) continue
      const sceneEntry = resolveSceneEntry(this.state.viewIndex, entry)
      if (sceneEntry?.view.view.scene !== previous.sceneKey) continue
      return createSelection(this.state.viewIndex, slot, entry, previous.generation)
    }
    return undefined
  }

  /** Captures logical, physical and resource ownership before a mutation. */
  captureMutationSnapshot(): RuntimeMutationSnapshot<SceneKey, SlotName> {
    return {
      viewIndex: this.state.viewIndex,
      authoredSceneKeys: this.state.authoredSceneKeys,
      layoutEntry: this.state.layoutEntry,
      initialAnchor: this.state.initialAnchor,
      composition: this.state.composition,
      context: this.state.context,
      layoutGeneration: this.state.layoutGeneration,
      generationCounters: new Map(this.state.generationCounters),
      compiledBuilds: new Map(this.state.compiledBuilds),
      sceneDocuments: new Map(this.state.sceneDocuments),
      resourceUrlsByScene: new Map(this.state.resourceUrlsByScene),
      resourceUrls: [...this.state.resourceUrls],
      deliveredData: new Map(this.state.deliveredData),
      instances: new Map(this.state.instances),
      instanceSceneKeys: new Map(this.state.instanceSceneKeys),
      playback: this.capturePlaybackStates(this.state.instances),
    }
  }

  /** Captures the playback position and active state of every occurrence. */
  private capturePlaybackStates(
    instances: ReadonlyMap<string, import('codplay').CodPlayInstance>,
  ): ReadonlyMap<string, MountedState> {
    const states = new Map<string, MountedState>()
    for (const [occurrenceKey, instance] of instances) {
      const state = instance.telco.getState()
      states.set(occurrenceKey, {
        timelineMs: state.timelineMs,
        rate: state.rate,
        wasPlaying: state.status === 'playing' && !state.sequenceEnded,
      })
    }
    return states
  }

  /** Restores the scenario and index before rebuilding a failed mutation. */
  private restoreMutationAuthoringState(
    result: SightyScenarioMutationResult<SceneKey, SlotName>,
    snapshot: RuntimeMutationSnapshot<SceneKey, SlotName>,
  ): void {
    this.state.mutableScenario.restoreMutation(result)
    this.state.viewIndex = snapshot.viewIndex
    this.state.authoredSceneKeys = snapshot.authoredSceneKeys
    this.state.layoutEntry = snapshot.layoutEntry
    this.state.initialAnchor = snapshot.initialAnchor
    this.state.composition = snapshot.composition
    this.state.context = snapshot.context
    this.state.layoutGeneration = snapshot.layoutGeneration
    this.restoreMap(this.state.generationCounters, snapshot.generationCounters)
  }

  /** Restores instances, mounts, bindings, resources and playback state. */
  private async restoreMutationPhysicalState(
    snapshot: RuntimeMutationSnapshot<SceneKey, SlotName>,
  ): Promise<void> {
    const canReuseInstances = [...snapshot.instances].every(([occurrenceKey, instance]) =>
      this.state.instances.get(occurrenceKey) === instance,
    )
    const currentResourceUrls = [...this.state.resourceUrls]

    this.state.transitioning = true
    this.bindings.closeAllBindings()
    this.composition.detachAllMounts()

    if (canReuseInstances) {
      for (const [occurrenceKey, instance] of [...this.state.instances]) {
        if (snapshot.instances.get(occurrenceKey) === instance) continue
        this.state.owner.instances.destroy(instance.instanceId)
        this.state.instances.delete(occurrenceKey)
        this.state.instanceSceneKeys.delete(occurrenceKey)
      }
      for (const cleanup of this.state.cleanups.splice(0)) cleanup()
      const previousUrls = new Set(snapshot.resourceUrls)
      const introducedUrls = currentResourceUrls.filter((url) => !previousUrls.has(url))
      this.state.owner.preload.cancel()
      if (introducedUrls.length > 0) this.state.owner.preload.release(introducedUrls)
      this.restoreMap(this.state.compiledBuilds, snapshot.compiledBuilds)
      this.restoreMap(this.state.sceneDocuments, snapshot.sceneDocuments)
      this.restoreMap(this.state.resourceUrlsByScene, snapshot.resourceUrlsByScene)
      this.state.resourceUrls = [...snapshot.resourceUrls]
      this.restoreMap(this.state.instanceSceneKeys, snapshot.instanceSceneKeys)
      for (const [occurrenceKey, instance] of snapshot.instances) {
        const sceneKey = snapshot.instanceSceneKeys.get(occurrenceKey)
        if (sceneKey !== undefined) this.scenes.observeInstance(instance, sceneKey)
      }
    } else {
      for (const cleanup of this.state.cleanups.splice(0)) cleanup()
      this.scenes.destroyInstances()
      this.state.owner.preload.cancel()
      if (currentResourceUrls.length > 0) this.state.owner.preload.release(currentResourceUrls)
      this.state.compiledBuilds.clear()
      this.state.sceneDocuments.clear()
      this.state.resourceUrlsByScene.clear()
      this.state.resourceUrls = []
      for (const [sceneKey, build] of snapshot.compiledBuilds) this.state.compiledBuilds.set(sceneKey, build)
      for (const [sceneKey, scene] of snapshot.sceneDocuments) this.state.sceneDocuments.set(sceneKey, scene)
      await this.scenes.preloadScenes(snapshot.compiledBuilds)
      this.state.resourceUrls = [...snapshot.resourceUrls]
      this.createSnapshotInstances(snapshot)
    }

    this.scenes.installStyles()
    this.state.composition = {
      revision: snapshot.composition.revision,
      layoutPath: snapshot.composition.layoutPath,
      selections: new Map(),
    }
    for (const selection of snapshot.composition.selections.values()) this.composition.mountSelection(selection)
    this.state.composition = snapshot.composition
    this.bindings.openLayoutBinding()
    this.bindings.openBindings([...snapshot.composition.selections.values()])
    this.restoreMap(this.state.deliveredData, snapshot.deliveredData)
    this.state.initialized = true
    await this.restorePlaybackStates(snapshot.playback)
    this.state.transitioning = false
  }

  /** Recreates exactly the occurrences that existed before a destructive reload. */
  private createSnapshotInstances(
    snapshot: RuntimeMutationSnapshot<SceneKey, SlotName>,
  ): void {
    for (const occurrenceKey of snapshot.instances.keys()) {
      const sceneKey = snapshot.instanceSceneKeys.get(occurrenceKey)
      if (sceneKey === undefined) throw new Error(`La scène de l’occurrence Sighty ${occurrenceKey} manque pendant la restauration.`)
      const build = snapshot.compiledBuilds.get(sceneKey)
      if (build === undefined) throw new Error(`Le build Sighty ${sceneKey} manque pendant la restauration.`)
      this.scenes.createInstance(occurrenceKey, sceneKey, build)
    }
  }

  /** Restores one mutable map from an immutable transaction snapshot. */
  private restoreMap<Key, Value>(target: Map<Key, Value>, source: ReadonlyMap<Key, Value>): void {
    target.clear()
    for (const [key, value] of source) target.set(key, value)
  }

  /** Restores every occurrence position, rate and active playback state. */
  private async restorePlaybackStates(states: ReadonlyMap<string, MountedState>): Promise<void> {
    for (const [occurrenceKey, playback] of states) {
      const instance = this.state.instances.get(occurrenceKey)
      if (instance === undefined) continue
      if (instance.telco.rate !== playback.rate) instance.telco.setRate(playback.rate)
      await instance.telco.seek(playback.timelineMs)
      if (playback.wasPlaying) await instance.telco.play()
    }
  }

  /** Reacquires known scene resources before a reload reset. */
  private async reloadResources(): Promise<void> {
    this.bindings.closeAllBindings()
    this.composition.detachAllMounts()
    this.scenes.destroyInstances()
    for (const cleanup of this.state.cleanups.splice(0)) cleanup()
    this.scenes.releasePreparedResources()
    const builds = this.scenes.compileDirectScenes()
    for (const [sceneKey, build] of builds) this.state.compiledBuilds.set(sceneKey, build)
    await this.scenes.preloadScenes(builds)
    this.state.deliveredData.clear()
  }
}
