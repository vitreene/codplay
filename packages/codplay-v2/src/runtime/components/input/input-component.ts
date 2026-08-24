import { isPlainRecord } from '../../../shared'
import type { AttrValue, ClassNameValue, StyleValue, ValidationFunction } from '../../../services'
import { reportInvalidComponentValue, isComponentRecord } from '../component-validation'
import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import {
  resolveCorrectionState,
  resolveInputControlStateClasses,
  resolveInputRootStateClasses,
  type InputVisualState,
} from './input-visual-state'

/** Definition of one internal input part. */
export type InputPartDefinition = Readonly<{
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
  content?: string
}>

/** Definition of the correction icon with state-specific fallback content. */
export type InputCorrectionIconDefinition = InputPartDefinition & Readonly<{
  correctContent?: string
  incorrectContent?: string
  missedCorrectContent?: string
}>

/** Initial author state accepted by the V2 input component. */
export type InputInitial = Readonly<{
  inputType?: string
  id?: string
  name?: string
  value?: string | number
  label?: string | number
  hint?: string | number
  checked?: boolean
  disabled?: boolean
  placeholder?: string
  min?: number | string
  max?: number | string
  step?: number | string
  form?: string
  required?: boolean
  readOnly?: boolean
  selectedAnswerIds?: readonly string[]
  correctAnswerIds?: readonly string[]
  disableAnswers?: boolean
  showCorrection?: boolean
  selectionIcon?: InputPartDefinition
  correctionIcon?: InputCorrectionIconDefinition
  visualState?: InputVisualState
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved state applied by one input update. */
export type InputState = Readonly<InputInitial>

/** Action payload accepted by one input perso. */
export type InputAction = InputState

/** Documentation shape for standard input action overrides. */
export type InputActionDoc = InputAction & Readonly<{
  disableAnswers?: boolean
  showCorrection?: boolean
}>

/** V1-compatible standard quiz actions for consumers building a scene catalog. */
export const INPUT_STANDARD_ACTIONS: Readonly<Record<string, Readonly<{
  disableAnswers: boolean
  showCorrection: boolean
}>>> = {
  'quiz:question:selection:available': { disableAnswers: false, showCorrection: false },
  'quiz:question:selection:empty': { disableAnswers: false, showCorrection: false },
  'quiz:question:resolved': { disableAnswers: true, showCorrection: true },
}

/** Merges standard quiz actions with an authored action map. */
export function resolveInputStandardActions(
  authoredActions: Readonly<Record<string, InputActionDoc>> = {},
): Record<string, InputActionDoc> {
  return { ...INPUT_STANDARD_ACTIONS, ...authoredActions }
}

/** Validates the initial input payload and its V1-compatible state fields. */
export const validateInputInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_INITIAL_INVALID', 'input initial state must be a plain object.')
    return
  }
  validateInputFields(value, context)
}

/** Validates one input action payload. */
export const validateInputAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validateInputFields(value, context)
}

/** Full state produced by the pure input-state resolver. */
export type ResolvedInputState = Readonly<{
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
  selectedAnswerIds: readonly string[]
  correctAnswerIds: readonly string[]
  disableAnswers: boolean
  showCorrection: boolean
  selectionIcon: InputPartDefinition
  correctionIcon: InputCorrectionIconDefinition
  visualState: InputVisualState
}>

const PART = {
  control: 'control',
  label: 'label',
  hint: 'hint',
} as const

/** V2 quiz input whose public child targets are selected by the runtime catalog. */
export class InputComponent extends BaseHTMLComponent<InputInitial> {
  /** Creates one input component with its catalog-bound services. */
  constructor(input: HTMLComponentInput<InputInitial>) {
    super(input)
  }

  /** Returns the complete five-part input template. */
  render(): string {
    return createInputTemplate(this.perso.storyId, this.perso.id)
  }

  /** Applies one complete resolved state to the root and its private parts. */
  update(input: ComponentUpdateInput<InputState>): void {
    if (this.node === null) throw new Error(`Input component is not materialized: ${this.perso.id}`)
    const nextState = resolveInputState(input.state, `${this.perso.id}__control`)
    const previousState = this.lastState
    this.lastState = nextState

    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: { ...(isPlainRecord(input.state.attr) ? input.state.attr : {}), id: this.perso.id },
    })
    this.applyState(nextState, previousState)
  }

  /** Last projected visual state, used only to remove prior generated classes. */
  private lastState: ResolvedInputState | null = null

  /** Applies all private input parts through the bound HTML/SVG service facade. */
  private applyState(nextState: ResolvedInputState, previousState: ResolvedInputState | null): void {
    const root = this.node
    const control = this.getPart(PART.control)
    const label = this.getPart(PART.label)
    const selectionIcon = this.getPart(selectionIconPartId(this.perso.storyId, this.perso.id))
    const correctionIcon = this.getPart(correctionIconPartId(this.perso.storyId, this.perso.id))
    const hint = this.getPart(PART.hint)

    this.services.apply(root, {
      className: {
        add: resolveInputRootStateClasses(nextState).join(' '),
        remove: previousState === null ? undefined : resolveInputRootStateClasses(previousState).join(' '),
      },
    })
    this.applyControl(control, nextState, previousState)
    this.services.apply(label, { className: 'input__label', content: nextState.label })
    this.services.apply(hint, { className: 'input__hint', content: nextState.hint })
    this.applySelectionIcon(selectionIcon, nextState, previousState)
    this.applyCorrectionIcon(correctionIcon, nextState, previousState)
  }

  /** Projects native properties and generated classes onto the input control. */
  private applyControl(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    this.services.apply(node, {
      className: {
        add: ['input__control', ...resolveInputControlStateClasses(nextState)].join(' '),
        remove: previousState === null
          ? undefined
          : resolveInputControlStateClasses(previousState).join(' '),
      },
    })
    if (!isInputElementLike(node)) return
    node.type = nextState.inputType
    node.id = nextState.id
    node.name = nextState.name ?? ''
    node.value = nextState.value === undefined ? '' : String(nextState.value)
    node.checked = nextState.checked
    node.disabled = nextState.disabled
    node.placeholder = nextState.placeholder ?? ''
    node.min = nextState.min === undefined ? '' : String(nextState.min)
    node.max = nextState.max === undefined ? '' : String(nextState.max)
    node.step = nextState.step === undefined ? '' : String(nextState.step)
    node.required = nextState.required
    node.readOnly = nextState.readOnly
    if (nextState.form === undefined) node.removeAttribute?.('form')
    else node.setAttribute?.('form', nextState.form)
  }

  /** Projects the selection icon while preserving a mounted child node. */
  private applySelectionIcon(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    if (node === undefined) return
    this.services.apply(node, {
      className: {
        add: ['input__selection-icon', nextState.selectionIcon.className, isSelected(nextState) ? 'is-selected' : 'is-idle']
          .filter(Boolean).join(' '),
        remove: previousState === null ? undefined : [
          previousState.selectionIcon.className,
          isSelected(previousState) ? 'is-selected' : 'is-idle',
        ].filter(Boolean).join(' '),
      },
      style: nextState.selectionIcon.style,
      attr: nextState.selectionIcon.attr,
    })
    if (hasChildNodes(node)) return
    this.services.apply(node, {
      content: isSelected(nextState) ? (nextState.selectionIcon.content ?? '') : '',
    })
  }

  /** Projects the correction icon while preserving a mounted child node. */
  private applyCorrectionIcon(
    node: unknown,
    nextState: ResolvedInputState,
    previousState: ResolvedInputState | null,
  ): void {
    if (node === undefined) return
    const previousCorrection = previousState === null ? 'idle' : resolveCorrectionState(previousState.visualState) ?? 'idle'
    const nextCorrection = resolveCorrectionState(nextState.visualState) ?? 'idle'
    this.services.apply(node, {
      className: {
        add: ['input__correction-icon', nextState.correctionIcon.className, `is-${nextCorrection}`]
          .filter(Boolean).join(' '),
        remove: previousState === null ? undefined : [
          previousState.correctionIcon.className,
          `is-${previousCorrection}`,
        ].filter(Boolean).join(' '),
      },
      style: nextState.correctionIcon.style,
      attr: nextState.correctionIcon.attr,
    })
    if (hasChildNodes(node)) return
    this.services.apply(node, { content: resolveCorrectionLabel(nextState) })
  }
}

/** Resolves one complete input state from a V2 state payload. */
export function resolveInputState(input: InputState, defaultControlId: string): ResolvedInputState {
  const selectedAnswerIds = resolveStringList(input.selectedAnswerIds)
  const correctAnswerIds = resolveStringList(input.correctAnswerIds)
  const disableAnswers = resolveBoolean(input.disableAnswers, false)
  const showCorrection = resolveBoolean(input.showCorrection, false)
  const selectionIcon = resolveInputPartDefinition(input.selectionIcon)
  const correctionIcon = resolveCorrectionIconDefinition(input.correctionIcon)
  const inputType = typeof input.inputType === 'string' && input.inputType.length > 0 ? input.inputType : 'text'
  const id = typeof input.id === 'string' && input.id.length > 0 ? input.id : defaultControlId
  const value = isStringOrNumber(input.value) ? input.value : undefined
  const selected = value !== undefined
    && (selectedAnswerIds.includes(String(value)) || selectedAnswerIds.includes(id))
  const checked = typeof input.checked === 'boolean' ? input.checked : selected
  const isCorrect = correctAnswerIds.includes(String(value ?? id))
  const visualState = typeof input.visualState === 'string' && isVisualState(input.visualState)
    ? input.visualState
    : showCorrection
      ? selected && isCorrect ? 'revealed-correct'
        : selected ? 'revealed-incorrect'
          : isCorrect ? 'revealed-missed-correct'
            : disableAnswers ? 'disabled' : 'idle'
      : selected ? 'selected' : disableAnswers ? 'disabled' : 'idle'

  return {
    inputType,
    id,
    name: typeof input.name === 'string' ? input.name : undefined,
    value,
    label: isStringOrNumber(input.label) ? String(input.label) : '',
    hint: isStringOrNumber(input.hint) ? String(input.hint) : '',
    checked,
    disabled: typeof input.disabled === 'boolean' ? input.disabled : disableAnswers,
    placeholder: typeof input.placeholder === 'string' ? input.placeholder : undefined,
    min: isStringOrNumber(input.min) ? input.min : undefined,
    max: isStringOrNumber(input.max) ? input.max : undefined,
    step: isStringOrNumber(input.step) ? input.step : undefined,
    form: typeof input.form === 'string' ? input.form : undefined,
    required: input.required === true,
    readOnly: input.readOnly === true,
    selectedAnswerIds,
    correctAnswerIds,
    disableAnswers,
    showCorrection,
    selectionIcon,
    correctionIcon,
    visualState,
  }
}

/** Resolves one input part definition while preserving its service payloads. */
function resolveInputPartDefinition(value: unknown): InputPartDefinition {
  if (!isPlainRecord(value)) return {}
  return {
    className: isClassNameValue(value.className) ? value.className : undefined,
    style: isPlainRecord(value.style) ? value.style : undefined,
    attr: isPlainRecord(value.attr) ? value.attr : undefined,
    content: isStringOrNumber(value.content) ? String(value.content) : undefined,
  }
}

/** Resolves the correction-specific part fields. */
function resolveCorrectionIconDefinition(value: unknown): InputCorrectionIconDefinition {
  const base = resolveInputPartDefinition(value)
  if (!isPlainRecord(value)) return base
  return {
    ...base,
    correctContent: isStringOrNumber(value.correctContent) ? String(value.correctContent) : undefined,
    incorrectContent: isStringOrNumber(value.incorrectContent) ? String(value.incorrectContent) : undefined,
    missedCorrectContent: isStringOrNumber(value.missedCorrectContent) ? String(value.missedCorrectContent) : undefined,
  }
}

/** Resolves the correction label currently visible in one input. */
function resolveCorrectionLabel(state: ResolvedInputState): string {
  if (!state.showCorrection) return ''
  const correction = resolveCorrectionState(state.visualState)
  if (correction === 'correct') return state.correctionIcon.correctContent ?? state.correctionIcon.content ?? '+'
  if (correction === 'incorrect') return state.correctionIcon.incorrectContent ?? state.correctionIcon.content ?? '-'
  if (correction === 'missed-correct') return state.correctionIcon.missedCorrectContent
    ?? state.correctionIcon.correctContent
    ?? state.correctionIcon.content
    ?? '+'
  return ''
}

/** Reports whether one state is visually selected. */
function isSelected(state: ResolvedInputState): boolean {
  return state.checked || state.visualState === 'selected' || state.visualState.startsWith('revealed-')
}

/** Validates input-specific fields without duplicating shared service validation. */
function validateInputFields(value: Record<string, unknown>, context: Parameters<ValidationFunction>[1]): void {
  for (const field of ['inputType', 'id', 'name', 'placeholder', 'form']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a string.`, field)
    }
  }
  for (const field of ['value', 'label', 'hint', 'min', 'max', 'step']) {
    if (value[field] !== undefined && !isStringOrNumber(value[field])) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a string or number.`, field)
    }
  }
  for (const field of ['checked', 'disabled', 'required', 'readOnly', 'disableAnswers', 'showCorrection']) {
    if (value[field] !== undefined && typeof value[field] !== 'boolean') {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_FIELD_INVALID', `input.${field} must be a boolean.`, field)
    }
  }
  for (const field of ['selectedAnswerIds', 'correctAnswerIds']) {
    const list = value[field]
    if (list !== undefined && (!Array.isArray(list) || !list.every((entry) => typeof entry === 'string'))) {
      reportInvalidComponentValue(context, 'AUTHOR_INPUT_ANSWER_IDS_INVALID', `input.${field} must be a string array.`, field)
    }
  }
  if (value.visualState !== undefined && !isVisualState(value.visualState)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_VISUAL_STATE_INVALID', 'input.visualState is not supported.', 'visualState')
  }
  if (value.selectionIcon !== undefined && !isPlainRecord(value.selectionIcon)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', 'input.selectionIcon must be a plain object.', 'selectionIcon')
  }
  if (value.correctionIcon !== undefined && !isPlainRecord(value.correctionIcon)) {
    reportInvalidComponentValue(context, 'AUTHOR_INPUT_PART_INVALID', 'input.correctionIcon must be a plain object.', 'correctionIcon')
  }
}

/** Resolves one safe boolean with a default. */
function resolveBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Resolves only non-empty string identifiers from one list. */
function resolveStringList(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : []
}

/** Checks whether one value is a scalar accepted by native input properties. */
function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** Checks the supported visual-state vocabulary. */
function isVisualState(value: unknown): value is InputVisualState {
  return value === 'idle'
    || value === 'selected'
    || value === 'disabled'
    || value === 'revealed-correct'
    || value === 'revealed-incorrect'
    || value === 'revealed-missed-correct'
}

/** Checks the shared class value accepted by the className service. */
function isClassNameValue(value: unknown): value is ClassNameValue {
  if (typeof value === 'string') return true
  return isPlainRecord(value)
    && (value.add === undefined || typeof value.add === 'string')
    && (value.remove === undefined || typeof value.remove === 'string')
}

/** Checks the minimal native input property surface used by this component. */
function isInputElementLike(value: unknown): value is {
  type: string
  id: string
  name: string
  value: string
  checked: boolean
  disabled: boolean
  placeholder: string
  min: string
  max: string
  step: string
  required: boolean
  readOnly: boolean
  setAttribute?: (name: string, value: string) => void
  removeAttribute?: (name: string) => void
} {
  return typeof value === 'object' && value !== null && 'type' in value && 'value' in value
}

/** Reports whether one private part currently contains a mounted child. */
function hasChildNodes(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('childNodes' in value)) return false
  const childNodes = (value as { childNodes?: { length?: unknown } }).childNodes
  return typeof childNodes?.length === 'number' && childNodes.length > 0
}

/** Builds one input template with globally unique public icon target IDs. */
function createInputTemplate(storyId: string, persoId: string): string {
  return `
    <label>
      <input data-part="${PART.control}" />
      <span data-part="${PART.label}"></span>
      <span data-part="${selectionIconPartId(storyId, persoId)}" aria-hidden="true"></span>
      <span data-part="${correctionIconPartId(storyId, persoId)}" aria-hidden="true"></span>
      <span data-part="${PART.hint}"></span>
    </label>
  `
}

/** Returns the unique public selection-icon target ID for one component instance. */
export function selectionIconPartId(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}__selection-icon-slot`
}

/** Returns the unique public correction-icon target ID for one component instance. */
export function correctionIconPartId(storyId: string, persoId: string): string {
  return `${storyId}:${persoId}__correction-icon-slot`
}
