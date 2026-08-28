import type { BaseComponentVisualData } from '../base-component'
import type { ClassNameValue, AttrValue, StyleValue } from '../../../services'
import type { InputVisualState } from './input-visual-state'

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

/** Initial author profile accepted by the V2 input component. */
export type InputInitial = BaseComponentVisualData & Readonly<{
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
}>

/** Action patch accepted by one input perso. */
export type InputAction = Partial<InputInitial>

/** Documentation shape for standard input action overrides. */
export type InputActionDoc = InputAction & Readonly<{
  disableAnswers?: boolean
  showCorrection?: boolean
}>

/** Compiled state after initial defaults and nested part profiles are explicit. */
export type InputState = BaseComponentVisualData & Readonly<{
  inputType: string
  id?: string
  name?: string
  value?: string | number
  label: string
  hint: string
  checked?: boolean
  disabled?: boolean
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
  visualState?: InputVisualState
}>

/** Full state projected onto native input and its visual parts. */
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
