import { buildComposition, resolveInitialAnchor } from '../navigation/composition'
import { sameSelection, type CompositionTransition } from '../navigation/transition'
import type {
  ActiveComposition,
  ActiveSelection,
  IndexedEntry,
} from '../navigation/types'
import {
  occurrenceKeyForSelection,
  reportWarning,
} from './helpers'
import type {
  MountedState,
  PresentationRelation,
  ResolvedMount,
  SynchronizationResult,
} from './types'
import type { SightyRuntimeState } from './state'
import { RuntimeBindingManager } from './binding-manager'
import { RuntimePresentationManager } from './presentation-manager'
import { RuntimeSceneManager } from './scene-manager'

/** Owns logical composition calculation and delegates physical presentation. */
export class RuntimeCompositionManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly scenes: RuntimeSceneManager<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>
  private readonly presentation: RuntimePresentationManager<SceneKey, SlotName>
  private readonly notifySlotChange: (slotName: SlotName, sceneKey: SceneKey | undefined) => void

  /** Creates a composition manager with the binding and warning boundaries. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    scenes: RuntimeSceneManager<SceneKey, SlotName>,
    bindings: RuntimeBindingManager<SceneKey, SlotName>,
    presentation: RuntimePresentationManager<SceneKey, SlotName>,
    notifySlotChange: (slotName: SlotName, sceneKey: SceneKey | undefined) => void,
  ) {
    this.state = state
    this.scenes = scenes
    this.bindings = bindings
    this.presentation = presentation
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
    const previousPresentation = this.presentation.capture()
    const enteredMounts = transition.entered.map((selection) => {
      this.scenes.createSelectionInstance(selection)
      return { selection, mount: this.presentation.resolveMount(selection) }
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
        if (mount.replace === undefined) this.presentation.detachForHost(mount.host)
        this.mountSelection(selection, mount)
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
      this.restoreComposition(previous, previousStates, previousPresentation)
      throw error
    }
  }

  /** Detaches all physical mounts without destroying scene occurrences. */
  detachAllMounts(): void {
    this.presentation.detachAll()
  }

  /** Removes physical relations whose occurrences are no longer retained. */
  detachUnavailableMounts(): void {
    this.presentation.detachUnavailable()
  }

  /** Captures the complete internal presentation for an operation snapshot. */
  capturePresentation(): readonly PresentationRelation<SceneKey, SlotName>[] {
    return this.presentation.capture()
  }

  /** Restores the complete internal presentation from an operation snapshot. */
  restorePresentation(
    relations: readonly PresentationRelation<SceneKey, SlotName>[],
  ): void {
    this.presentation.restore(relations)
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
    previousPresentation: readonly PresentationRelation<SceneKey, SlotName>[],
  ): void {
    this.bindings.closeAllBindings()
    this.presentation.restore(previousPresentation)
    this.state.composition = {
      revision: previous.revision,
      layoutPath: previous.layoutPath,
      selections: new Map(),
    }
    try {
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

  /** Mounts one logical selection through CodPlay’s public instance relation. */
  mountSelection(
    selection: ActiveSelection<SceneKey, SlotName>,
    mount?: ResolvedMount,
  ): void {
    this.presentation.mountSelection(selection, mount)
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

  /** Returns the scene currently selected in one public slot. */
  getMountedSceneKey(slotName: SlotName): SceneKey | undefined {
    return [...this.state.composition.selections.values()]
      .find((selection) => selection.slotName === slotName)?.sceneKey
  }
}
