import type { CodPlayPublicEvent } from 'codplay'
import type { ActiveSelection } from '../navigation/types'
import type { SightyPublicEvent } from '../public-events'
import { occurrenceKeyForSelection, reportWarning } from './helpers'
import type { DispatchRequest, RuntimeBinding } from './types'
import type { SightyRuntimeState } from './state'

/** Owns active scene-event subscriptions and their generation validation. */
export class RuntimeBindingManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly enqueue: (request: DispatchRequest<SceneKey>) => Promise<boolean>

  /** Creates a binding manager over one runtime state and event queue. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    enqueue: (request: DispatchRequest<SceneKey>) => Promise<boolean>,
  ) {
    this.state = state
    this.enqueue = enqueue
  }

  /** Adapts one active CodPlay event, publishes it and queues it for routing. */
  receivePublicEvent(binding: RuntimeBinding<SceneKey>, event: CodPlayPublicEvent): void {
    if (!this.isCurrentBinding(binding)) return
    const publicEvent: SightyPublicEvent<SceneKey> = {
      name: event.name,
      sourceSceneKey: binding.sceneKey,
      data: event.data,
    }
    const task = this.enqueue({ event: publicEvent, binding })
    for (const error of this.state.publicEventChannel.publish(publicEvent)) {
      reportWarning(this.state, 'SIGHTY_EVENT_LISTENER_FAILED', error)
    }
    void task.catch((error: unknown) => {
      if (!this.state.destroyed) reportWarning(this.state, 'SIGHTY_NAVIGATION_FAILED', error)
    })
  }

  /** Rejects an event captured from a selection whose generation has ended. */
  isCurrentBinding(binding: RuntimeBinding<SceneKey>): boolean {
    if (this.state.destroyed || this.state.transitioning) return false
    const active = this.state.activeBindings.get(binding.slotAddress)
    if (
      active === undefined
      || active.occurrenceKey !== binding.occurrenceKey
      || active.sceneKey !== binding.sceneKey
      || active.generation !== binding.generation
    ) return false
    if (binding.slotAddress === (this.state.layoutEntry?.path ?? 'layout')) {
      return binding.occurrenceKey === (this.state.layoutEntry?.path ?? 'layout')
        && binding.sceneKey === this.state.layout.sceneKey
        && this.state.layoutGeneration === binding.generation
    }
    const selection = this.state.composition.selections.get(binding.slotAddress)
    return selection?.sceneKey === binding.sceneKey
      && selection.generation === binding.generation
      && occurrenceKeyForSelection(selection) === binding.occurrenceKey
  }

  /** Accepts an external source only when exactly one active binding owns it. */
  isAdmissibleExternalSource(sceneKey: SceneKey): boolean {
    const bindings = this.findActiveBindings(sceneKey)
    return bindings.length === 1 && this.isCurrentBinding(bindings[0])
  }

  /** Opens the permanent binding used by the authored layout scene. */
  openLayoutBinding(): void {
    this.openBinding({
      slotAddress: this.state.layoutEntry?.path ?? 'layout',
      occurrenceKey: this.state.layoutEntry?.path ?? 'layout',
      sceneKey: this.state.layout.sceneKey,
      generation: this.state.layoutGeneration,
    })
  }

  /** Opens event bindings for selections that entered the composition. */
  openBindings(selections: readonly ActiveSelection<SceneKey, SlotName>[]): void {
    for (const selection of selections) {
      this.openBinding({
        slotAddress: selection.slotAddress,
        occurrenceKey: occurrenceKeyForSelection(selection),
        sceneKey: selection.sceneKey,
        generation: selection.generation,
      })
    }
  }

  /** Subscribes one occurrence while its logical binding remains active. */
  openBinding(binding: RuntimeBinding<SceneKey>): void {
    const current = this.state.activeBindings.get(binding.slotAddress)
    if (
      current?.occurrenceKey === binding.occurrenceKey
      && current.sceneKey === binding.sceneKey
      && current.generation === binding.generation
    ) return
    if (current !== undefined) this.closeBinding(binding.slotAddress)
    const instance = this.state.instances.get(binding.occurrenceKey)
    if (instance === undefined) throw new Error(`L’instance Sighty ${binding.sceneKey} est absente.`)
    const cleanup = instance.events.onEvent((event) => this.receivePublicEvent(binding, event))
    this.state.activeBindings.set(binding.slotAddress, binding)
    this.state.bindingCleanups.set(binding.slotAddress, cleanup)
  }

  /** Closes bindings for selections that have exited the composition. */
  closeBindings(selections: readonly ActiveSelection<SceneKey, SlotName>[]): void {
    for (const selection of selections) this.closeBinding(selection.slotAddress)
  }

  /** Closes one active binding before its physical relation is detached. */
  closeBinding(slotAddress: string): void {
    this.state.bindingCleanups.get(slotAddress)?.()
    this.state.bindingCleanups.delete(slotAddress)
    this.state.activeBindings.delete(slotAddress)
    this.state.deliveredData.delete(slotAddress)
  }

  /** Closes every active event binding during restore, rollback or destruction. */
  closeAllBindings(): void {
    for (const slotAddress of [...this.state.activeBindings.keys()]) this.closeBinding(slotAddress)
  }

  /** Finds active bindings associated with one authored scene key. */
  findActiveBindings(sceneKey: SceneKey): readonly RuntimeBinding<SceneKey>[] {
    return [...this.state.activeBindings.values()].filter((binding) => binding.sceneKey === sceneKey)
  }
}
