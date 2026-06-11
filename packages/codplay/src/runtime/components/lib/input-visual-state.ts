export type InputVisualState =
  | 'idle'
  | 'selected'
  | 'disabled'
  | 'revealed-correct'
  | 'revealed-incorrect'
  | 'revealed-missed-correct'

/**
 * Resolves one correction state from one visual state.
 */
export function resolveCorrectionState(visualState: InputVisualState): 'correct' | 'incorrect' | 'missed-correct' | null {
  if (visualState === 'revealed-correct') return 'correct'
  if (visualState === 'revealed-incorrect') return 'incorrect'
  if (visualState === 'revealed-missed-correct') return 'missed-correct'
  return null
}

/**
 * Returns one list of root classes for the current input state.
 */
export function resolveInputRootStateClasses(state: { checked: boolean; disabled: boolean; visualState: InputVisualState }): string[] {
  const classes = [`input--${state.visualState}`]
  if (state.checked || state.visualState === 'selected' || state.visualState.startsWith('revealed-')) {
    classes.push('input--selected')
  }
  if (state.disabled) {
    classes.push('input--disabled')
  }
  return classes
}

/**
 * Returns one list of control classes for the current input state.
 */
export function resolveInputControlStateClasses(state: { checked: boolean; disabled: boolean; visualState: InputVisualState }): string[] {
  const classes = [`input__control--${state.visualState}`]
  if (state.checked || state.visualState === 'selected' || state.visualState.startsWith('revealed-')) {
    classes.push('is-selected')
  }
  if (state.disabled) {
    classes.push('is-disabled')
  }

  const correctionState = resolveCorrectionState(state.visualState)
  if (correctionState !== null) {
    classes.push(`is-${correctionState}`)
  }

  return classes
}

export const ALL_INPUT_ROOT_STATE_CLASSES = [
  'input--idle',
  'input--selected',
  'input--disabled',
  'input--revealed-correct',
  'input--revealed-incorrect',
  'input--revealed-missed-correct'
].join(' ')

export const ALL_INPUT_CONTROL_STATE_CLASSES = [
  'input__control--idle',
  'input__control--selected',
  'input__control--disabled',
  'input__control--revealed-correct',
  'input__control--revealed-incorrect',
  'input__control--revealed-missed-correct',
  'is-selected',
  'is-disabled',
  'is-correct',
  'is-incorrect',
  'is-missed-correct'
].join(' ')
