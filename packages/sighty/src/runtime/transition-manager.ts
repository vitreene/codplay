import { planCompositionTransition } from '../navigation/transition'
import { resolveShowMode } from '../navigation/show-mode'
import type { ActiveSelection } from '../navigation/types'
import type { CodPlayInstance } from 'codplay'
import { occurrenceKeyForSelection } from './helpers'
import type { SightyRuntimeState } from './state'
import { RuntimeCompositionManager } from './composition-manager'
import { RuntimeSceneManager } from './scene-manager'
import type { MountedState, SynchronizationResult } from './types'
import type { SightyShowMode } from '../types'

/** Selects the lifecycle treatment used by one coordinated composition change. */
export type RuntimeEntryBehavior = 'none' | 'show' | 'rewind'

/** Describes the effects that the transition coordinator must finish atomically. */
export type RuntimeTransitionOptions<SceneKey extends string, SlotName extends string> = Readonly<{
  entryBehavior: RuntimeEntryBehavior
  notify: boolean
  deliverEnteredData: (
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ) => Promise<void>
  onPrepared?: () => void
}>

/** Runs the one Sighty path from a desired composition to mounted playback. */
export class RuntimeTransitionManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly scenes: RuntimeSceneManager<SceneKey, SlotName>
  private readonly composition: RuntimeCompositionManager<SceneKey, SlotName>

  /** Creates a transition coordinator over the shared logical and physical services. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    scenes: RuntimeSceneManager<SceneKey, SlotName>,
    composition: RuntimeCompositionManager<SceneKey, SlotName>,
  ) {
    this.state = state
    this.scenes = scenes
    this.composition = composition
  }

  /** Completes one admitted transition, including data and entry playback policy. */
  async execute(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
    options: RuntimeTransitionOptions<SceneKey, SlotName>,
  ): Promise<SynchronizationResult<SceneKey, SlotName>> {
    const previous = this.state.composition
    const transition = planCompositionTransition(previous.selections, desired)
    if (transition.entered.length === 0 && transition.exited.length === 0) {
      return this.composition.synchronizeComposition(desired, false)
    }

    const entryStates = this.captureEntryStates(transition.entered)
    const exitedStates = this.composition.captureExitedStates(transition.exited)
    this.state.transitioning = true

    try {
      await this.composition.pauseExitedScenes(transition.exited)
      const showModes = options.entryBehavior === 'show'
        ? this.resolveEntryModes(transition.entered)
        : new Map<string, SightyShowMode>()
      if (options.entryBehavior === 'show') this.resetEntries(transition.entered, showModes)
      await this.scenes.ensureScenesForComposition(desired)
      options.onPrepared?.()
      const synchronization = this.composition.synchronizeComposition(desired, false, { exitedStates })
      await options.deliverEnteredData(synchronization.entered)
      if (options.entryBehavior === 'show') {
        await this.applyShowModes(synchronization.entered, showModes, entryStates)
      } else if (options.entryBehavior === 'rewind') {
        await this.rewindComposition(desired)
      }
      if (options.notify) this.composition.notifyCompositionChanges(synchronization.previous, synchronization.next)
      return synchronization
    } catch (error: unknown) {
      this.state.transitioning = false
      throw error
    }
  }

  /** Captures an existing occurrence before a reset or physical replacement. */
  private captureEntryStates(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): ReadonlyMap<string, MountedState | undefined> {
    const states = new Map<string, MountedState | undefined>()
    for (const selection of selections) {
      const occurrenceKey = occurrenceKeyForSelection(selection)
      const instance = this.state.instances.get(occurrenceKey)
      if (instance === undefined) {
        states.set(occurrenceKey, undefined)
        continue
      }
      const state = instance.telco.getState()
      states.set(occurrenceKey, {
        timelineMs: state.timelineMs,
        rate: state.rate,
        wasPlaying: state.status === 'playing' && !state.sequenceEnded,
      })
    }
    return states
  }

  /** Resolves the effective policy for every newly admitted selection. */
  private resolveEntryModes(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
  ): ReadonlyMap<string, SightyShowMode> {
    const modes = new Map<string, SightyShowMode>()
    for (const selection of selections) {
      modes.set(
        occurrenceKeyForSelection(selection),
        resolveShowMode(
          selection,
          this.state.showMode,
          this.state.scenario.file.showMode,
        ),
      )
    }
    return modes
  }

  /** Discards only occurrences whose effective policy explicitly requests reset. */
  private resetEntries(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
    modes: ReadonlyMap<string, SightyShowMode>,
  ): void {
    for (const selection of selections) {
      if (modes.get(occurrenceKeyForSelection(selection)) !== 'reset') continue
      this.scenes.resetSelectionInstance(selection)
    }
  }

  /** Applies reset, maintain and rewind without creating a second entry circuit. */
  private async applyShowModes(
    selections: readonly ActiveSelection<SceneKey, SlotName>[],
    modes: ReadonlyMap<string, SightyShowMode>,
    previousStates: ReadonlyMap<string, MountedState | undefined>,
  ): Promise<void> {
    for (const selection of selections) {
      const occurrenceKey = occurrenceKeyForSelection(selection)
      const instance = this.scenes.getInstanceForSelection(selection)
      if (instance === undefined) throw new Error(`L’instance entrante ${selection.sceneKey} est absente.`)
      const mode = modes.get(occurrenceKey)
      if (mode === 'rewind') {
        await this.rewindAndPlay(instance)
        continue
      }
      const previous = previousStates.get(occurrenceKey)
      if (mode === 'maintain' && previous !== undefined) {
        if (instance.telco.rate !== previous.rate) instance.telco.setRate(previous.rate)
        if (!instance.telco.getState().sequenceEnded) await instance.telco.seek(previous.timelineMs)
        if (previous.wasPlaying) await instance.telco.play()
        continue
      }
      await instance.telco.play()
    }
  }

  /** Rewinds an active sequence through CodPlay's public telco and resumes it. */
  private async rewindAndPlay(instance: CodPlayInstance): Promise<void> {
    if (instance.telco.getState().sequenceEnded) {
      await instance.telco.play()
      return
    }
    await instance.telco.rewind()
    await instance.telco.play()
  }

  /** Applies mutation rewind semantics to every occurrence in the resulting composition. */
  private async rewindComposition(
    desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  ): Promise<void> {
    for (const selection of desired.values()) {
      const instance = this.scenes.getInstanceForSelection(selection)
      if (instance === undefined) continue
      if (instance.telco.getState().sequenceEnded) {
        await instance.telco.play()
      } else {
        await instance.telco.rewind()
      }
    }
  }
}
