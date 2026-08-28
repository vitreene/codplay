import { resolveCorrectionState, type InputVisualState } from './input-visual-state'
import type { InputActionDoc, InputState, ResolvedInputState } from './input-types'

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

/** Resolves one compile-sanitized input state into its native and visual projection. */
export function resolveInputState(input: InputState, defaultControlId: string): ResolvedInputState {
  const selectedAnswerIds = input.selectedAnswerIds
  const correctAnswerIds = input.correctAnswerIds
  const disableAnswers = input.disableAnswers
  const showCorrection = input.showCorrection
  const selectionIcon = input.selectionIcon
  const correctionIcon = input.correctionIcon
  const inputType = input.inputType
  const id = input.id ?? defaultControlId
  const value = input.value
  const selected = value !== undefined
    && (selectedAnswerIds.includes(String(value)) || selectedAnswerIds.includes(id))
  const checked = input.checked ?? selected
  const isCorrect = correctAnswerIds.includes(String(value ?? id))
  const visualState = input.visualState ?? resolveDerivedVisualState(
    selected,
    isCorrect,
    disableAnswers,
    showCorrection,
  )

  return {
    inputType,
    id,
    name: input.name,
    value,
    label: input.label,
    hint: input.hint,
    checked,
    disabled: input.disabled ?? disableAnswers,
    placeholder: input.placeholder,
    min: input.min,
    max: input.max,
    step: input.step,
    form: input.form,
    required: input.required,
    readOnly: input.readOnly,
    selectedAnswerIds,
    correctAnswerIds,
    disableAnswers,
    showCorrection,
    selectionIcon,
    correctionIcon,
    visualState,
  }
}

/** Derives the visual state from quiz selection and correction flags. */
function resolveDerivedVisualState(
  selected: boolean,
  isCorrect: boolean,
  disableAnswers: boolean,
  showCorrection: boolean,
): InputVisualState {
  if (showCorrection) {
    if (selected && isCorrect) return 'revealed-correct'
    if (selected) return 'revealed-incorrect'
    if (isCorrect) return 'revealed-missed-correct'
    if (disableAnswers) return 'disabled'
    return 'idle'
  }
  if (selected) return 'selected'
  return disableAnswers ? 'disabled' : 'idle'
}

/** Resolves the correction label currently visible in one input. */
export function resolveCorrectionLabel(state: ResolvedInputState): string {
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

/** Reports whether one resolved input should present its selected visual state. */
export function isSelectedInput(state: ResolvedInputState): boolean {
  return state.checked || state.visualState === 'selected' || state.visualState.startsWith('revealed-')
}
