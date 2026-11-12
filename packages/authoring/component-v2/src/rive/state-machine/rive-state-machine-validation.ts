import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'

import { validateRiveAction, validateRiveInputValues } from '../core/rive-validation'

type ValidationContext = Parameters<ValidationFunction>[1]

/** Validates the state machine name and optional initial named inputs. */
export function validateRiveStateMachineInitial(value: unknown, context: ValidationContext): void {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_STATE_MACHINE_INITIAL_INVALID', 'Rive state-machine initial state must be a plain object.')
    return
  }
  if (typeof value.stateMachine !== 'string' || value.stateMachine.length === 0) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_STATE_MACHINE_NAME_INVALID', 'stateMachine must be a non-empty string.', 'stateMachine')
  }
  validateRiveInputValues(value.inputs, context, 'inputs')
}

/** Validates one named-input patch projected onto the selected state machine. */
export function validateRiveStateMachineAction(value: unknown, context: ValidationContext): void {
  validateRiveAction(value, context)
  if (!isComponentRecord(value)) return
  validateRiveInputValues(value.inputs, context, 'inputs')
}
