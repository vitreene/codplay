import type { ActiveSelection, IndexedEntry } from '../navigation/types'
import type {
  SightyCouplingDescriptor,
  SightyTelcoCommand,
} from '../types'
import { occurrenceKeyForSelection } from './helpers'
import type { SightyRuntimeState } from './state'
import type { DispatchRequest, RuntimeBinding } from './types'

type CouplingMatch<SceneKey extends string, SlotName extends string> = Readonly<{
  descriptor: SightyCouplingDescriptor<SlotName>
  selection: ActiveSelection<SceneKey, SlotName>
  command: SightyTelcoCommand | readonly SightyTelcoCommand[]
}>

/** Mediates declared controller events to the telco of an active target slot. */
export class RuntimeCouplingManager<SceneKey extends string, SlotName extends string> {
  private readonly state: SightyRuntimeState<SceneKey, SlotName>
  private readonly isCurrentBinding: (binding: RuntimeBinding<SceneKey>) => boolean

  /** Creates a coupling manager over one runtime state. */
  constructor(
    state: SightyRuntimeState<SceneKey, SlotName>,
    isCurrentBinding: (binding: RuntimeBinding<SceneKey>) => boolean,
  ) {
    this.state = state
    this.isCurrentBinding = isCurrentBinding
  }

  /** Executes a declared telco command when the request matches one coupling. */
  async dispatch(request: DispatchRequest<SceneKey>): Promise<boolean> {
    if (request.binding === undefined) return false
    if (!this.isCurrentBinding(request.binding)) return false
    const match = this.findMatch(request.binding.slotAddress, request.event.name)
    if (match === undefined) return false
    const instance = this.state.instances.get(occurrenceKeyForSelection(match.selection))
    if (instance === undefined) return false

    const commands = Array.isArray(match.command) ? match.command : [match.command]
    for (const command of commands) {
      if (!this.isCurrentMatch(request.binding, match)) return true
      await this.executeCommand(command, instance.telco, request.event.data)
      if (!this.isCurrentMatch(request.binding, match)) return true
    }
    return true
  }

  /** Keeps a coupling command sequence attached to its source and target generation. */
  private isCurrentMatch(
    sourceBinding: RuntimeBinding<SceneKey>,
    match: CouplingMatch<SceneKey, SlotName>,
  ): boolean {
    if (!this.isCurrentBinding(sourceBinding)) return false
    const current = this.state.composition.selections.get(match.selection.slotAddress)
    return current !== undefined
      && current.sceneKey === match.selection.sceneKey
      && current.generation === match.selection.generation
      && occurrenceKeyForSelection(current) === occurrenceKeyForSelection(match.selection)
  }

  /** Finds the unique view coupling that owns one active controller binding. */
  private findMatch(
    sourceSlotAddress: string,
    eventName: string,
  ): CouplingMatch<SceneKey, SlotName> | undefined {
    const matches: CouplingMatch<SceneKey, SlotName>[] = []
    for (const entry of this.state.viewIndex.entries) {
      const descriptor = entry.view.coupling
      if (descriptor === undefined) continue
      if (!this.isControllerSlot(entry, descriptor, sourceSlotAddress)) continue
      const command = descriptor.commands[eventName]
      if (command === undefined) continue
      const targetAddress = `${entry.path}/${descriptor.controlledSlot}`
      const selection = this.state.composition.selections.get(targetAddress)
      if (selection === undefined) continue
      matches.push({ descriptor, selection, command })
    }
    if (matches.length > 1) {
      throw new Error(`Le couplage telco est ambigu pour l’événement ${eventName}.`)
    }
    return matches[0]
  }

  /** Checks whether one active source binding belongs to the declared view. */
  private isControllerSlot(
    entry: IndexedEntry<SceneKey, SlotName>,
    descriptor: SightyCouplingDescriptor<SlotName>,
    sourceSlotAddress: string,
  ): boolean {
    const slots = Object.keys(entry.view.view.slots ?? {}) as SlotName[]
    const sourceSlots = descriptor.controllerSlot === undefined
      ? slots.filter((slotName) => slotName !== descriptor.controlledSlot)
      : [descriptor.controllerSlot]
    return sourceSlots.some((slotName) => `${entry.path}/${slotName}` === sourceSlotAddress)
  }

  /** Executes one CodPlay telco command with its declared event payload. */
  private async executeCommand(
    command: SightyTelcoCommand,
    telco: import('codplay').CodPlayTelco,
    data: DispatchRequest<SceneKey>['event']['data'],
  ): Promise<void> {
    if (command === 'play') {
      await telco.play()
      return
    }
    if (command === 'pause') {
      await telco.pause()
      return
    }
    if (command === 'togglePlay') {
      await telco.togglePlay()
      return
    }
    if (command === 'rewind') {
      await telco.rewind()
      return
    }
    if (command === 'reset') {
      await telco.reset()
      return
    }
    if (command === 'setRate') {
      telco.setRate(this.readNumericData(data, 'rate'))
      return
    }
    if (command === 'seek') {
      await telco.seek(this.readNumericData(data, 'timeMs'))
      return
    }
    throw new Error(`La commande telco Sighty « ${String(command)} » est inconnue.`)
  }

  /** Reads one finite numeric argument from a declared controller payload. */
  private readNumericData(
    data: DispatchRequest<SceneKey>['event']['data'],
    key: 'rate' | 'timeMs',
  ): number {
    const rawValue = data?.[key] ?? (key === 'timeMs' ? data?.value : undefined)
    const value = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' ? Number(rawValue) : Number.NaN
    if (!Number.isFinite(value)) {
      throw new Error(`La commande telco Sighty attend une donnée numérique « ${key} ».`)
    }
    return value
  }
}
