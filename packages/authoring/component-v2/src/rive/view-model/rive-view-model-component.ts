import type { ComponentActionOccurrence, ComponentUpdateInput } from 'codplay'

import type {
  RiveArtboard,
  RiveDocumentTarget,
  RiveViewModelInstance,
} from '../rive-context'
import { RiveStateMachineComponent } from '../rive-state-machine-component'
import type { RiveInputValues, RiveViewModelInitial } from '../rive-types'
import { resolveRiveViewModelTransition } from './rive-view-model-transition'

type PropertyBinding =
  | { type: 'number'; property: { value: number }; defaultValue: number }
  | { type: 'boolean'; property: { value: boolean }; defaultValue: boolean }

/** Projects CodPlay values onto one exported ViewModel and its native machine. */
export class RiveViewModelComponent extends RiveStateMachineComponent<RiveViewModelInitial> {
  private viewModelInstance: RiveViewModelInstance | undefined
  private readonly bindings = new Map<string, PropertyBinding>()
  private values: RiveInputValues = {}
  private viewModelActions: readonly ComponentActionOccurrence[] = []
  private presentationRevision = 0

  /** Releases the native binding and the retained time history. */
  public override destroy(): void {
    super.destroy()
    this.viewModelActions = []
  }

  /** Keeps the resolved logical values for presentation and host reconstruction. */
  public override update(input: ComponentUpdateInput): void {
    this.values = (input.state.values as RiveInputValues | undefined) ?? {}
    this.viewModelActions = input.activeActions ?? []
    this.presentationRevision += 1
    const target = input.target as RiveDocumentTarget | undefined
    target?.prepareArtboard(input.timeMs)
    super.update(input)
  }

  /** Creates and binds the two native instances from the host's prepared file. */
  protected override createStateMachine(target: RiveDocumentTarget, artboard: RiveArtboard) {
    const model = target.getFile().viewModelByName(this.initial.viewModel)
    if (!model) throw new Error(`Rive ViewModel "${this.initial.viewModel}" was not found.`)
    const instance = model.instanceByName(this.initial.instance)
    if (!instance) {
      throw new Error(`Rive ViewModel instance "${this.initial.viewModel}/${this.initial.instance}" was not found.`)
    }
    this.viewModelInstance = instance
    instance.getProperties().forEach(({ name, type }) => {
      if (type === 'number') {
        const property = instance.number(name)!
        this.bindings.set(name, { type, property, defaultValue: property.value })
      }
      if (type === 'boolean') {
        const property = instance.boolean(name)!
        this.bindings.set(name, { type, property, defaultValue: property.value })
      }
    })
    const machine = super.createStateMachine(target, artboard)
    machine.bindViewModelInstance(instance)
    return machine
  }

  /** Restores exported defaults before applying the logical frame due at this time. */
  protected override applyResolvedValues(timeMs: number): boolean {
    this.bindings.forEach((binding) => {
      binding.property.value = binding.defaultValue
    })
    const resolvedValues = this.playback === 'stopped'
      ? this.initial.values
      : { ...this.initial.values, ...this.values }
    const defaults: Record<string, number | boolean> = {}
    this.bindings.forEach((binding, name) => {
      defaults[name] = binding.defaultValue
    })
    const values = this.playback === 'stopped'
      ? resolvedValues
      : resolveRiveViewModelTransition(
        defaults,
        this.initial.values,
        resolvedValues ?? {},
        this.viewModelActions,
        timeMs,
        this.initial.blendSpeed ?? 0,
      )
    Object.entries(values ?? {}).forEach(([name, value]) => {
      const binding = this.bindings.get(name)
      if (!binding) {
        throw new Error(`Rive ViewModel "${this.initial.viewModel}" has no supported property "${name}".`)
      }
      if (binding.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
        binding.property.value = value
        return
      }
      if (binding.type === 'boolean' && typeof value === 'boolean') {
        binding.property.value = value
        return
      }
      throw new Error(`Rive ViewModel property "${this.initial.viewModel}/${name}" requires ${binding.type}.`)
    })
    this.target?.invalidate()
    return true
  }

  /** Makes same-time logical changes visible to the existing presentation stream. */
  protected override getPresentationRevision(): number {
    return this.presentationRevision
  }

  /** Leaves authored values to the resolved-state projection, outside legacy inputs. */
  protected override getInitialValues(): undefined {
    return undefined
  }

  /** Uses the logical frame instead of replaying individual patches into native state. */
  protected override resolveActionInputs(): undefined {
    return undefined
  }

  /** Releases bindings and their instance whenever the shared machine is reset. */
  protected override deleteStateMachine(): void {
    super.deleteStateMachine()
    this.bindings.clear()
    this.viewModelInstance?.delete()
    this.viewModelInstance = undefined
  }
}
