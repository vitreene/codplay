import {
  resolveSlotManifestEntry,
  slotManifest,
  type CodPlayInstanceHostTarget,
} from 'codplay'
import { getStartEntry, isPathPrefix } from '../navigation/graph-index'
import { buildComposition, createSelection, resolveInitialAnchor, resolveSceneEntry } from '../navigation/composition'
import { sameSelection, type CompositionTransition } from '../navigation/transition'
import type {
  ActiveComposition,
  ActiveSelection,
  IndexedEntry,
  IndexedSlot,
} from '../navigation/types'
import {
  occurrenceKeyForSelection,
  reportWarning,
  sameMountHost,
} from './helpers'
import type { MountedState, ResolvedMount, SynchronizationResult } from './types'
import type { SightyRuntimeState } from './state'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimeSceneManager } from './scene-manager'

/** Owns logical composition calculation and physical CodPlay mounting. */
export class RuntimeCompositionManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly scenes: RuntimeSceneManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly notifySlotChange: (slotName: SlotName, sceneKey: SceneKey | undefined) => void

  /** Creates a composition manager with the binding and warning boundaries. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    scenes: RuntimeSceneManager<SceneKey, SlotName>,
    bindings: RuntimeBindingManager<SceneKey, SlotName>,
    notifySlotChange: (slotName: SlotName, sceneKey: SceneKey | undefined) => void,
  ) {
    this.state = state
    this.scenes = scenes
    this.bindings = bindings
    this.notifySlotChange = notifySlotChange
  }

  /** Returns the required authored layout entry for physical mounting. */
  requireLayoutEntry(): IndexedEntry<SceneKey, SlotName> {
    const entry = this.state.layoutEntry
    if (entry === undefined) throw new Error('Le fichier Sighty ne contient aucune vue layout.')
    return entry
  }

  /** Builds the desired composition from the current branch and optional target. */
  buildDesiredComposition(
    target?: ActiveSelection<SceneKey, SlotName>,
  ): ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> {
    const layoutEntry = this.requireLayoutEntry()
    const initialAnchor = this.state.initialAnchor ?? resolveInitialAnchor(this.state.viewIndex, layoutEntry)
    const generations = new Map<string, number>()
    for (const slot of this.state.viewIndex.slots) {
      const current = this.state.composition.selections.get(slot.address)
      generations.set(slot.address, current?.generation ?? this.nextGenerationNumber(slot.address))
    }
    return buildComposition(
      this.state.viewIndex,
      layoutEntry.path,
      initialAnchor,
      target,
      generations,
    )
  }

  /** Assigns the current generation to a route target before transition. */
  withCurrentGeneration(
    target: ActiveSelection<SceneKey, SlotName>,
  ): ActiveSelection<SceneKey, SlotName> {
    const current = this.state.composition.selections.get(target.slotAddress)
    const generation = current !== undefined && sameSelection(current, target)
      ? current.generation
      : this.nextGenerationNumber(target.slotAddress)
    return { ...target, generation }
  }

  /** Returns the next monotone generation without mutating the counter. */
  nextGenerationNumber(slotAddress: string): number {
    const current = this.state.composition.selections.get(slotAddress)?.generation ?? 0
    return Math.max(current, this.state.generationCounters.get(slotAddress) ?? 0) + 1
  }

  /** Synchronizes physical mounts and commits one logical composition. */
  synchronizeComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    transition: CompositionTransition<SceneKey, SlotName>,
    notify: boolean,
    options: Readonly<{ exitedStates?: ReadonlyMap<string, MountedState> }> = {},
  ): SynchronizationResult<SceneKey, SlotName> {
    const previous = this.state.composition
    if (transition.entered.length === 0 && transition.exited.length === 0) {
      return {
        entered: [],
        previous,
        next: previous,
      }
    }

    const desiredMap = new Map(desired)
    const previousStates = options.exitedStates ?? this.captureExitedStates(transition.exited)
    const enteredMounts = transition.entered.map((selection) => {
      this.scenes.createSelectionInstance(selection)
      return { selection, mount: this.resolveMount(selection) }
    })
    this.state.transitioning = true
    this.state.composition = {
      revision: previous.revision + 1,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }

    try {
      this.bindings.closeBindings(transition.exited)
      for (const { selection, mount } of enteredMounts) {
        if (mount.replace === undefined) this.detachMountForHost(mount.host)
        this.mountSelection(selection, mount)
      }
      const enteredAddresses = new Set(transition.entered.map((selection) => selection.slotAddress))
      for (const selection of transition.exited) {
        if (!enteredAddresses.has(selection.slotAddress)) this.detachMount(selection.slotAddress)
      }
      this.state.composition = {
        revision: previous.revision + 1,
        layoutPath: previous.layoutPath,
        selections: desiredMap,
      }
      this.bindings.openBindings(transition.entered)
      this.recordGenerations(desiredMap)
      this.state.transitioning = false
      const next = this.state.composition
      if (notify) this.notifyCompositionChanges(previous, next)
      return { entered: transition.entered, previous, next }
    } catch (error: unknown) {
      this.restoreComposition(previous, previousStates)
      throw error
    }
  }

  /** Detaches all physical mounts without destroying scene occurrences. */
  detachAllMounts(): void {
    for (const mount of this.state.mounts.values()) mount.detach()
    this.state.mounts.clear()
    this.state.mountTargets.clear()
  }

  /** Captures playback states needed when an outgoing transition is reverted. */
  captureExitedStates(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): ReadonlyMap<string, MountedState> {
    const states = new Map<string, MountedState>()
    for (const selection of selections) {
      const instance = this.state.instances.get(occurrenceKeyForSelection(selection))
      if (instance === undefined) continue
      const state = instance.telco.getState()
      states.set(selection.slotAddress, {
        timelineMs: state.timelineMs,
        rate: state.rate,
        wasPlaying: state.status === 'playing' && !state.sequenceEnded,
      })
    }
    return states
  }

  /** Pauses every outgoing occurrence before its binding and mount are replaced. */
  async pauseExitedScenes(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): Promise<void> {
    for (const selection of selections) {
      const instance = this.state.instances.get(occurrenceKeyForSelection(selection))
      if (instance === undefined) continue
      const state = instance.telco.getState()
      if (state.status !== 'playing' || state.sequenceEnded) continue
      try {
        await instance.telco.pause()
      } catch (error: unknown) {
        reportWarning(this.state, 'SIGHTY_PAUSE_FAILED', error)
      }
    }
  }

  /** Restores the previous physical and logical composition after a mount failure. */
  private restoreComposition(
    previous: ActiveComposition<SceneKey, SlotName>,
    previousStates: ReadonlyMap<string, MountedState>,
  ): void {
    this.bindings.closeAllBindings()
    this.detachAllMounts()
    this.state.composition = {
      revision: previous.revision,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }
    try {
      for (const selection of previous.selections.values()) this.mountSelection(selection)
      this.state.composition = previous
      this.bindings.openLayoutBinding()
      this.bindings.openBindings([...previous.selections.values()])
      this.state.transitioning = false
      for (const [slotAddress, state] of previousStates) {
        if (!state.wasPlaying) continue
        const selection = previous.selections.get(slotAddress)
        const instance = selection === undefined
          ? undefined
          : this.state.instances.get(occurrenceKeyForSelection(selection))
        if (instance !== undefined) void instance.telco.play()
      }
    } catch (restoreError: unknown) {
      this.bindings.closeAllBindings()
      this.state.transitioning = false
      reportWarning(this.state, 'SIGHTY_COMPOSITION_RESTORE_FAILED', restoreError)
    }
  }

  /** Resolves one logical selection to a validated CodPlay mount request. */
  resolveMount(selection: ActiveSelection<SceneKey, SlotName>): ResolvedMount {
    const slot = this.state.viewIndex.slotsByAddress.get(selection.slotAddress)
    if (slot === undefined) throw new Error(`Le slot Sighty ${selection.slotName} est absent de l’index.`)
    const layoutOccurrenceKey = this.state.layoutEntry?.path ?? 'layout'
    const layoutInstance = this.state.instances.get(layoutOccurrenceKey)
    if (layoutInstance === undefined) throw new Error('L’instance layout Sighty est absente.')
    const layoutScene = this.state.sceneDocuments.get(this.state.layout.sceneKey)
    if (layoutScene === undefined) throw new Error('La ressource layout Sighty est absente.')

    const resolution = resolveSlotManifestEntry(
      slotManifest(layoutScene, { storyId: this.state.layout.storyId }),
      slot.slotName,
      {
        sceneId: layoutScene.id,
        storyId: this.state.layout.storyId,
        referencePath: `views.${slot.ownerPath}.view.slots.${slot.slotName}`,
      },
    )
    if (!resolution.ok) throw new Error(resolution.diagnostic.message)

    const child = this.state.instances.get(occurrenceKeyForSelection(selection))
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
  mountSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    mount: ResolvedMount = this.resolveMount(selection),
  ): void {
    const handle = this.state.owner.instances.mount(mount)
    for (const [slotAddress, target] of this.state.mountTargets) {
      if (slotAddress === selection.slotAddress || !sameMountHost(target, mount.host)) continue
      this.state.mounts.delete(slotAddress)
      this.state.mountTargets.delete(slotAddress)
    }
    this.state.mounts.set(selection.slotAddress, handle)
    this.state.mountTargets.set(selection.slotAddress, mount.host)
  }

  /** Detaches one physical relation without destroying its child occurrence. */
  detachMount(slotAddress: string): void {
    this.state.mounts.get(slotAddress)?.detach()
    this.state.mounts.delete(slotAddress)
    this.state.mountTargets.delete(slotAddress)
  }

  /** Detaches any logical mount occupying one physical host target. */
  detachMountForHost(host: CodPlayInstanceHostTarget): void {
    for (const [slotAddress, target] of this.state.mountTargets) {
      if (sameMountHost(target, host)) this.detachMount(slotAddress)
    }
  }

  /** Reports each changed public slot after a composition commit. */
  notifyCompositionChanges(
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

  /** Records the latest generation used by every active selection. */
  recordGenerations(selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>): void {
    for (const [slotAddress, selection] of selections) {
      const current = this.state.generationCounters.get(slotAddress) ?? 0
      if (selection.generation > current) this.state.generationCounters.set(slotAddress, selection.generation)
    }
  }

  /** Builds the desired composition for one explicit public slot selection. */
  buildMountedComposition(
    slotName: SlotName,
    childSceneKey?: SceneKey,
  ): ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> {
    const slot = this.resolvePublicSlot(slotName)
    const entry = childSceneKey === undefined
      ? getStartEntry<SceneKey, SlotName>(this.state.viewIndex, slot.graphPath)
      : this.findSceneEntry(slot, childSceneKey)
    if (entry === undefined) {
      if (childSceneKey === undefined) throw new Error(`Le slot Sighty ${slotName} est vide.`)
      throw new Error(`La scène Sighty ${childSceneKey} n'est pas déclarée dans le slot ${slotName}.`)
    }
    const target = createSelection<SceneKey, SlotName>(
      this.state.viewIndex,
      slot,
      entry,
      this.nextGenerationNumber(slot.address),
    )
    return this.buildDesiredComposition(this.withCurrentGeneration(target))
  }

  /** Builds the desired composition after detaching one public slot branch. */
  buildDetachedComposition(slotName: SlotName): ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> {
    const slot = this.resolvePublicSlot(slotName)
    const addresses = [...this.state.composition.selections.keys()]
      .filter((address) => address === slot.address || isPathPrefix(slot.address, address))
    if (addresses.length === 0) return new Map(this.state.composition.selections)

    const desired = new Map(this.state.composition.selections)
    for (const address of addresses) desired.delete(address)
    return desired
  }

  /** Reports whether one public slot currently has a physical mount. */
  isSlotMounted(slotName: SlotName): boolean {
    return this.findActiveSlots(slotName).some((slot) => this.state.mounts.has(slot.address))
  }

  /** Returns the scene currently selected in one public slot. */
  getMountedSceneKey(slotName: SlotName): SceneKey | undefined {
    return this.findActiveSelections(slotName)[0]?.sceneKey
  }

  /** Resolves one public slot name against active or declared branches. */
  resolvePublicSlot(slotName: SlotName): IndexedSlot<SceneKey, SlotName> {
    const active = this.findActiveSlots(slotName)
    if (active.length === 1) return active[0]
    if (active.length > 1) throw new Error(`Le slot Sighty ${slotName} est ambigu dans la composition active.`)
    const declared = this.state.viewIndex.slots.filter((candidateSlot) => candidateSlot.slotName === slotName)
    if (declared.length === 1) return declared[0]
    if (declared.length === 0) throw new Error(`Le slot Sighty ${slotName} n'est pas déclaré dans le layout.`)
    throw new Error(`Le slot Sighty ${slotName} est ambigu dans le fichier auteur.`)
  }

  /** Finds all indexed slots with one public name in the active composition. */
  findActiveSlots(slotName: SlotName): readonly IndexedSlot<SceneKey, SlotName>[] {
    return this.state.viewIndex.slots.filter((candidateSlot) =>
      candidateSlot.slotName === slotName && this.state.composition.selections.has(candidateSlot.address))
  }

  /** Finds all active selections with one public slot name. */
  findActiveSelections(slotName: SlotName): readonly ActiveSelection<SceneKey, SlotName>[] {
    return [...this.state.composition.selections.values()].filter((selection) => selection.slotName === slotName)
  }

  /** Finds one declared descendant entry that resolves to a requested scene. */
  findSceneEntry(
    slot: IndexedSlot<SceneKey, SlotName>,
    sceneKey: SceneKey,
  ): IndexedEntry<SceneKey, SlotName> | undefined {
    return this.state.viewIndex.entries.find((candidateEntry) => {
      if (!isPathPrefix(slot.graphPath, candidateEntry.path)) return false
      const sceneEntry = resolveSceneEntry<SceneKey, SlotName>(this.state.viewIndex, candidateEntry)
      return sceneEntry?.view.view.scene === sceneKey
    })
  }
}
