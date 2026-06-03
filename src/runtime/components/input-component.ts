import { BaseComponent } from './lib/base-component'
import { applyClassNamePatch, applyNodeId, applyTextContent, collectDataParts } from './lib/dom-component-adapter'
import { resolveCorrectionState, resolveInputControlStateClasses, resolveInputRootStateClasses, type InputVisualState } from './lib/input-visual-state'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type InputState = {
  id?: unknown
  inputType?: unknown
  name?: unknown
  value?: unknown
  label?: unknown
  hint?: unknown
  checked?: unknown
  disabled?: unknown
  placeholder?: unknown
  min?: unknown
  max?: unknown
  step?: unknown
  form?: unknown
  required?: unknown
  readOnly?: unknown
  visualState?: unknown
}

type ResolvedInputState = {
  inputType: string
  id: string
  name?: string
  value?: string | number
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  placeholder?: string
  min?: number | string
  max?: number | string
  step?: number | string
  form?: string
  required: boolean
  readOnly: boolean
  visualState: InputVisualState
}

const PART = {
  control: 'control',
  label: 'label',
  selectionIcon: 'selection-icon',
  correctionIcon: 'correction-icon',
  hint: 'hint'
} as const

const INPUT_TEMPLATE = `
  <input data-part="${PART.control}" />
  <span data-part="${PART.label}"></span>
  <span data-part="${PART.selectionIcon}" aria-hidden="true"></span>
  <span data-part="${PART.correctionIcon}" aria-hidden="true"></span>
  <span data-part="${PART.hint}"></span>
`

/**
 * Resolves one input visual state.
 */
function resolveVisualState(value: unknown): InputVisualState {
  if (
    value === 'selected' ||
    value === 'disabled' ||
    value === 'revealed-correct' ||
    value === 'revealed-incorrect' ||
    value === 'revealed-missed-correct'
  ) {
    return value
  }

  return 'idle'
}

/**
 * Resolves one raw authored state into one runtime-ready state.
 */
function resolveInputState(input: InputState, fallback?: ResolvedInputState, defaultControlId = ''): ResolvedInputState {
  const controlIdFallback = fallback?.id ?? defaultControlId

  return {
    inputType: typeof input.inputType === 'string' && input.inputType.length > 0 ? input.inputType : fallback?.inputType ?? 'text',
    id: typeof input.id === 'string' && input.id.length > 0 ? input.id : controlIdFallback,
    name: typeof input.name === 'string' ? input.name : fallback?.name,
    value:
      typeof input.value === 'string' || typeof input.value === 'number'
        ? input.value
        : fallback?.value,
    label:
      typeof input.label === 'string' || typeof input.label === 'number'
        ? String(input.label)
        : fallback?.label ?? '',
    hint:
      typeof input.hint === 'string' || typeof input.hint === 'number'
        ? String(input.hint)
        : fallback?.hint ?? '',
    checked: typeof input.checked === 'boolean' ? input.checked : fallback?.checked ?? false,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : fallback?.disabled ?? false,
    placeholder: typeof input.placeholder === 'string' ? input.placeholder : fallback?.placeholder,
    min: typeof input.min === 'number' || typeof input.min === 'string' ? input.min : fallback?.min,
    max: typeof input.max === 'number' || typeof input.max === 'string' ? input.max : fallback?.max,
    step: typeof input.step === 'number' || typeof input.step === 'string' ? input.step : fallback?.step,
    form: typeof input.form === 'string' ? input.form : fallback?.form,
    required: typeof input.required === 'boolean' ? input.required : fallback?.required ?? false,
    readOnly: typeof input.readOnly === 'boolean' ? input.readOnly : fallback?.readOnly ?? false,
    visualState: resolveVisualState(input.visualState ?? fallback?.visualState)
  }
}

/**
 * Implements one generic input component with feedback zones.
 */
export class InputComponent extends BaseComponent {
  private state: ResolvedInputState | null = null

  /**
   * Declares services used for root patches.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Applies the runtime state on the control element.
   */
  private applyControlState(controlNode: unknown, state: ResolvedInputState): void {
    if (typeof globalThis.HTMLInputElement === 'undefined' || !(controlNode instanceof globalThis.HTMLInputElement)) {
      return
    }

    controlNode.type = state.inputType
    controlNode.id = state.id
    controlNode.name = state.name ?? ''
    controlNode.value = state.value !== undefined && state.value !== null ? String(state.value) : ''
    controlNode.checked = state.checked
    controlNode.disabled = state.disabled
    controlNode.placeholder = state.placeholder ?? ''
    if (state.min !== undefined) controlNode.min = String(state.min)
    if (state.max !== undefined) controlNode.max = String(state.max)
    if (state.step !== undefined) controlNode.step = String(state.step)
    if (state.form !== undefined) controlNode.setAttribute('form', state.form)
    else controlNode.removeAttribute('form')
    controlNode.required = state.required
    controlNode.readOnly = state.readOnly
  }

  /**
   * Applies the current state to the rendered tree.
   */
  private applyState(rootNode: unknown, nextState: ResolvedInputState, previousState: ResolvedInputState | null): void {
    const controlNode = this.getPart(PART.control)
    const labelNode = this.getPart(PART.label)
    const selectionIconNode = this.getPart(PART.selectionIcon)
    const correctionIconNode = this.getPart(PART.correctionIcon)
    const hintNode = this.getPart(PART.hint)

    const previousRootClasses = previousState !== null ? resolveInputRootStateClasses(previousState) : []
    const nextRootClasses = resolveInputRootStateClasses(nextState)
    const previousControlClasses = previousState !== null ? resolveInputControlStateClasses(previousState) : []
    const nextControlClasses = resolveInputControlStateClasses(nextState)
    const correctionState = resolveCorrectionState(nextState.visualState)

    applyClassNamePatch(rootNode, {
      add: nextRootClasses.join(' '),
      remove: previousRootClasses.join(' ')
    })

    applyNodeId(rootNode, this.perso.id)

    if (controlNode !== null) {
      applyClassNamePatch(controlNode, {
        add: nextControlClasses.join(' '),
        remove: previousControlClasses.join(' ')
      })
    }

    if (labelNode !== null) {
      applyClassNamePatch(labelNode, { add: 'input__label' })
      applyTextContent(labelNode, nextState.label)
    }

    if (hintNode !== null) {
      applyClassNamePatch(hintNode, { add: 'input__hint' })
      applyTextContent(hintNode, nextState.hint)
    }

    if (selectionIconNode !== null) {
      applyClassNamePatch(selectionIconNode, { add: 'input__selection-icon' })
      const hadSelectionState = previousState !== null && (previousState.checked || previousState.visualState === 'selected' || previousState.visualState.startsWith('revealed-'))
      applyClassNamePatch(selectionIconNode, {
        add: nextState.checked || nextState.visualState === 'selected' || nextState.visualState.startsWith('revealed-') ? 'is-selected' : 'is-idle',
        remove: hadSelectionState ? 'is-selected' : undefined
      })
    }

    if (correctionIconNode !== null) {
      applyClassNamePatch(correctionIconNode, { add: 'input__correction-icon' })
      const nextCorrectionClass = correctionState === null ? 'is-idle' : `is-${correctionState}`
      const previousCorrectionClass = previousState === null ? undefined : `is-${resolveCorrectionState(previousState.visualState) ?? 'idle'}`
      applyClassNamePatch(correctionIconNode, {
        add: nextCorrectionClass,
        remove: previousCorrectionClass
      })
    }

    this.applyControlState(controlNode, nextState)
    if (controlNode !== null) {
      applyClassNamePatch(controlNode, { add: 'input__control' })
    }
  }

  /**
   * Applies one resolved runtime action on the input component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    const previousState = this.state
    const nextState = resolveInputState(input.action as InputState, previousState ?? undefined, `${this.perso.id}__control`)

    this.state = nextState
    this.services.apply(this.node, input.action)
    this.applyState(this.node, nextState, previousState)
  }

  /**
   * Creates the component root and internal helper zones.
   */
  render(): ComponentRenderResult {
    const initialState = resolveInputState(this.perso.initial as InputState, undefined, `${this.perso.id}__control`)
    this.state = initialState

    const rootNode = this.buildNode('label') as HTMLLabelElement
    rootNode.innerHTML = INPUT_TEMPLATE

    this.clearParts()

    const parts = new Map<string, unknown>()
    collectDataParts(rootNode, parts)
    for (const [partId, partNode] of parts) {
      this.setPart(partId, partNode)
    }

    this.services.apply(rootNode, this.perso.initial)
    this.applyState(rootNode, initialState, null)

    return rootNode as Node
  }
}
