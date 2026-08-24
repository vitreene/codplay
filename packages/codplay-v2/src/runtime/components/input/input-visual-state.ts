/** Visual states supported by the quiz input component. */
export type InputVisualState =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'

/** Resolves a correction semantic from one visual state. */
export function resolveCorrectionState(
  visualState: InputVisualState,
): 'correct' | 'incorrect' | 'missed-correct' | null {
  if (visualState === 'revealed-correct') return 'correct'
  if (visualState === 'revealed-incorrect') return 'incorrect'
  if (visualState === 'revealed-missed-correct') return 'missed-correct'
  return null
}

/** Resolves the state classes applied to one input root. */
export function resolveInputRootStateClasses(
  state: Pick<ResolvedInputVisualState, 'checked' | 'disabled' | 'visualState'>,
): readonly string[] {
  const classes = [`input--${state.visualState}`]
  if (isSelectedVisualState(state)) classes.push('input--selected')
  if (state.disabled) classes.push('input--disabled')
  return classes
}

/** Resolves the state classes applied to the native control. */
export function resolveInputControlStateClasses(
  state: Pick<ResolvedInputVisualState, 'checked' | 'disabled' | 'visualState'>,
): readonly string[] {
  const classes = [`input__control--${state.visualState}`]
  if (isSelectedVisualState(state)) classes.push('is-selected')
  if (state.disabled) classes.push('is-disabled')
  const correctionState = resolveCorrectionState(state.visualState)
  if (correctionState !== null) classes.push(`is-${correctionState}`)
  return classes
}

/** Minimal state shape needed by the visual class helpers. */
type ResolvedInputVisualState = {
  checked: boolean
  disabled: boolean
  visualState: InputVisualState
}

/** Reports whether a state should receive the selected visual classes. */
function isSelectedVisualState(state: ResolvedInputVisualState): boolean {
  return state.checked || state.visualState === 'selected' || state.visualState.startsWith('revealed-')
}
