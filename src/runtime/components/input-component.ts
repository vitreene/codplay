import { BaseComponent } from './lib/base-component'
import { applyAttrPatch, applyClassNamePatch, applyNodeId, applyStylePatch, applyTextContent, collectDataParts } from './lib/dom-component-adapter'
import { resolveCorrectionState, resolveInputControlStateClasses, resolveInputRootStateClasses, type InputVisualState } from './lib/input-visual-state'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput, RuntimeLayoutOutletSnapshot } from './types'
import type { ActionDoc, InputCorrectionIconDefinition, InputPartDefinition } from '../types'

export const INPUT_STANDARD_ACTIONS: Record<string, Pick<ActionDoc, 'disableAnswers' | 'showCorrection'>> = {
  'quiz:question:selection:available': {
    disableAnswers: false,
    showCorrection: false
  },
  'quiz:question:selection:empty': {
    disableAnswers: false,
    showCorrection: false
  },
  'quiz:question:resolved': {
    disableAnswers: true,
    showCorrection: true
  }
}

/**
 * Merges the standard input actions with one authored action map.
 */
export function resolveInputStandardActions(authoredActions: Record<string, ActionDoc> = {}): Record<string, ActionDoc> {
  return {
    ...INPUT_STANDARD_ACTIONS,
    ...authoredActions
  }
}

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
  selectedAnswerIds?: unknown
  correctAnswerIds?: unknown
  disableAnswers?: unknown
  showCorrection?: unknown
  selectionIcon?: unknown
  correctionIcon?: unknown
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
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  disableAnswers: boolean
  showCorrection: boolean
  selectionIcon: InputPartDefinition
  correctionIcon: InputCorrectionIconDefinition
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
 * Resolves one stable string list from one runtime payload.
 */
function resolveStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

/**
 * Resolves one boolean-like value from one payload field.
 */
function resolveBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  return fallback
}

/**
 * Resolves one input part definition from one raw payload.
 */
function resolveInputPartDefinition(
  input: unknown,
  fallback: InputPartDefinition = {}
): InputPartDefinition {
  if (typeof input !== 'object' || input === null) {
    return { ...fallback }
  }

  const payload = input as Record<string, unknown>

  return {
    className: typeof payload.className === 'string' ? payload.className : fallback.className,
    style:
      typeof payload.style === 'object' && payload.style !== null
        ? (payload.style as Record<string, unknown>)
        : fallback.style,
    attr:
      typeof payload.attr === 'object' && payload.attr !== null
        ? (payload.attr as Record<string, unknown>)
        : fallback.attr,
    content:
      typeof payload.content === 'string' || typeof payload.content === 'number'
        ? String(payload.content)
        : fallback.content
  }
}

/**
 * Resolves one correction icon definition from one raw payload.
 */
function resolveCorrectionIconDefinition(
  input: unknown,
  fallback: InputCorrectionIconDefinition = {}
): InputCorrectionIconDefinition {
  const base = resolveInputPartDefinition(input, fallback)

  if (typeof input !== 'object' || input === null) {
    return { ...base, ...fallback }
  }

  const payload = input as Record<string, unknown>

  return {
    ...base,
    correctContent:
      typeof payload.correctContent === 'string' || typeof payload.correctContent === 'number'
        ? String(payload.correctContent)
        : fallback.correctContent,
    incorrectContent:
      typeof payload.incorrectContent === 'string' || typeof payload.incorrectContent === 'number'
        ? String(payload.incorrectContent)
        : fallback.incorrectContent,
    missedCorrectContent:
      typeof payload.missedCorrectContent === 'string' || typeof payload.missedCorrectContent === 'number'
        ? String(payload.missedCorrectContent)
        : fallback.missedCorrectContent
  }
}

/**
 * Resolves the currently selected state for one answer item.
 */
function resolveSelectedState(state: ResolvedInputState): boolean {
  if (state.value === undefined || state.value === null) {
    return state.checked
  }

  return state.selectedAnswerIds.includes(String(state.value)) || state.selectedAnswerIds.includes(state.id)
}

/**
 * Resolves the correction label shown on one answer item.
 */
function resolveCorrectionLabel(state: ResolvedInputState): string {
  if (!state.showCorrection) {
    return ''
  }

  const correctionState = resolveCorrectionState(state.visualState)
  const config = state.correctionIcon

  if (correctionState === 'correct') {
    return config.correctContent ?? config.content ?? '+'
  }

  if (correctionState === 'incorrect') {
    return config.incorrectContent ?? config.content ?? '-'
  }

  if (correctionState === 'missed-correct') {
    return config.missedCorrectContent ?? config.correctContent ?? config.content ?? '+'
  }

  return ''
}

/**
 * Resolves one raw authored state into one runtime-ready state.
 */
function resolveInputState(input: InputState, fallback?: ResolvedInputState, defaultControlId = ''): ResolvedInputState {
  const controlIdFallback = fallback?.id ?? defaultControlId
  const selectedAnswerIds = resolveStringList(input.selectedAnswerIds, fallback?.selectedAnswerIds ?? [])
  const correctAnswerIds = resolveStringList(input.correctAnswerIds, fallback?.correctAnswerIds ?? [])
  const disableAnswers = resolveBoolean(input.disableAnswers, fallback?.disableAnswers ?? false)
  const showCorrection = resolveBoolean(input.showCorrection, fallback?.showCorrection ?? false)
  const selectionIcon = resolveInputPartDefinition(input.selectionIcon, fallback?.selectionIcon ?? {})
  const correctionIcon = resolveCorrectionIconDefinition(input.correctionIcon, fallback?.correctionIcon ?? {})

  const resolvedBase: ResolvedInputState = {
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
    selectedAnswerIds,
    correctAnswerIds,
    disableAnswers,
    showCorrection,
    selectionIcon,
    correctionIcon,
    visualState: resolveVisualState(input.visualState ?? fallback?.visualState)
  }

  const isSelected = resolveSelectedState(resolvedBase)
  const isCorrect = resolvedBase.correctAnswerIds.includes(String(resolvedBase.value ?? resolvedBase.id))

  return {
    ...resolvedBase,
    checked: typeof input.checked === 'boolean' ? input.checked : isSelected,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : resolvedBase.disableAnswers,
    visualState:
      typeof input.visualState === 'string'
        ? resolvedBase.visualState
        : resolvedBase.showCorrection
          ? isSelected && isCorrect
            ? 'revealed-correct'
            : isSelected
              ? 'revealed-incorrect'
              : isCorrect
                ? 'revealed-missed-correct'
                : resolvedBase.disableAnswers
                  ? 'disabled'
                  : 'idle'
          : isSelected
            ? 'selected'
            : resolvedBase.disableAnswers
              ? 'disabled'
              : 'idle'
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
   * Exposes the internal icon slots so child persos can mount into them.
   */
  getOutletsSnapshot(): RuntimeLayoutOutletSnapshot[] {
    return [
      {
        outletId: `${this.perso.id}__selection-icon-slot`,
        nodeRef: this.getPart(PART.selectionIcon)
      },
      {
        outletId: `${this.perso.id}__correction-icon-slot`,
        nodeRef: this.getPart(PART.correctionIcon)
      }
    ]
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
      const previousSelectionIconClasses =
        previousState !== null
          ? [
              'input__selection-icon',
              previousState.selectionIcon.className,
              resolveSelectedState(previousState) ? 'is-selected' : 'is-idle'
            ]
              .filter((token) => typeof token === 'string' && token.length > 0)
              .join(' ')
          : undefined
      const nextSelectionIconClasses = [
        'input__selection-icon',
        nextState.selectionIcon.className,
        resolveSelectedState(nextState) ? 'is-selected' : 'is-idle'
      ]
        .filter((token) => typeof token === 'string' && token.length > 0)
        .join(' ')

      applyClassNamePatch(selectionIconNode, {
        add: nextSelectionIconClasses,
        remove: previousSelectionIconClasses
      })
      applyStylePatch(selectionIconNode, nextState.selectionIcon.style)
      applyAttrPatch(selectionIconNode, nextState.selectionIcon.attr)
      const selectionChildCount = (selectionIconNode as { childNodes?: { length?: number } }).childNodes?.length ?? 0
      if (selectionChildCount === 0) {
        applyTextContent(selectionIconNode, resolveSelectedState(nextState) ? nextState.selectionIcon.content ?? '' : '')
      }
    }

    if (correctionIconNode !== null) {
      const previousCorrectionState = previousState === null ? 'idle' : resolveCorrectionState(previousState.visualState) ?? 'idle'
      const nextCorrectionState = correctionState === null ? 'idle' : correctionState
      const previousCorrectionIconClasses =
        previousState !== null
          ? [
              'input__correction-icon',
              previousState.correctionIcon.className,
              `is-${previousCorrectionState}`
            ]
              .filter((token) => typeof token === 'string' && token.length > 0)
              .join(' ')
          : undefined
      const nextCorrectionIconClasses = [
        'input__correction-icon',
        nextState.correctionIcon.className,
        `is-${nextCorrectionState}`
      ]
        .filter((token) => typeof token === 'string' && token.length > 0)
        .join(' ')

      applyClassNamePatch(correctionIconNode, {
        add: nextCorrectionIconClasses,
        remove: previousCorrectionIconClasses
      })
      applyStylePatch(correctionIconNode, nextState.correctionIcon.style)
      applyAttrPatch(correctionIconNode, nextState.correctionIcon.attr)
      const correctionChildCount = (correctionIconNode as { childNodes?: { length?: number } }).childNodes?.length ?? 0
      if (correctionChildCount === 0) {
        applyTextContent(correctionIconNode, resolveCorrectionLabel(nextState))
      }
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
