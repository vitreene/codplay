import type {
  CodPlayEventime,
  CodPlayEventimeTarget,
  CodPlayInstance,
} from 'codplay'
import type { ActiveSelection } from '../navigation/types'
import { occurrenceKeyForSelection } from './helpers'
import type { SightyRuntimeState } from './state'
import type { RuntimeBindingManager } from './binding-manager'

/** Owns the single outbound event path from Sighty to CodPlay scenes. */
export class RuntimeSceneEventGateway<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly bindings: RuntimeBindingManager<SceneKey, SlotName>

  /** Creates an event gateway over active bindings and CodPlay instances. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    bindings: RuntimeBindingManager<SceneKey, SlotName>,
  ) {
    this.state = state
    this.bindings = bindings
  }

  /** Sends one data or control event to a currently bound selection. */
  async sendToBinding(
    selection: ActiveSelection<SceneKey, SlotName>,
    eventime: CodPlayEventime,
  ): Promise<void> {
    const binding = this.state.activeBindings.get(selection.slotAddress)
    if (binding === undefined || !this.bindings.isCurrentBinding(binding)) return
    const instance = this.state.instances.get(occurrenceKeyForSelection(selection))
    if (instance === undefined) return
    await this.emit(instance, eventime, { scope: 'scene' }, true)
  }

  /** Sends one action event to the unique active occurrence of a scene key. */
  async sendToActiveScene(
    sceneKey: SceneKey,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
  ): Promise<void> {
    const activeBindings = this.bindings.findActiveBindings(sceneKey)
    const binding = activeBindings.length === 1 ? activeBindings[0] : undefined
    if (binding === undefined || !this.bindings.isCurrentBinding(binding)) {
      if (activeBindings.length > 1) {
        throw new Error(`La scène Sighty ${sceneKey} est ambiguë dans la composition active.`)
      }
      throw new Error(`La scène Sighty ${sceneKey} n'est pas active dans la composition.`)
    }
    const instance = this.state.instances.get(binding.occurrenceKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${sceneKey} est absente.`)
    await this.emit(instance, eventime, target, false)
  }

  /** Emits one event and optionally restores its CodPlay transport state. */
  private async emit(
    instance: CodPlayInstance,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
    preserveTransport: boolean,
  ): Promise<void> {
    const currentTimeMs = preserveTransport ? instance.telco.getProgress().timelineMs : undefined
    const wasPlaying = preserveTransport && instance.telco.getState().status === 'playing'
    await instance.events.emit(eventime, target)
    if (currentTimeMs === undefined) return
    await instance.telco.seek(currentTimeMs)
    if (wasPlaying && !instance.telco.getState().sequenceEnded) await instance.telco.play()
  }
}
