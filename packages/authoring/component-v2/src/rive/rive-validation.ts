import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'

import type {
  RiveActionPayload,
  RiveInitial,
  RiveStateMachineActionPayload,
  RiveStateMachineInitial,
} from './rive-types'

type ValidationContext = Parameters<ValidationFunction>[1]

/** Keeps author validation limited to the data shape owned by this module. */
export function validateRiveInitial(value: unknown, context: ValidationContext): void {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_INITIAL_INVALID', 'Rive initial state must be a plain object.')
    return
  }
  if (typeof value.src !== 'string' || value.src.length === 0) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_SRC_INVALID', 'src must be a non-empty string.', 'src')
  }
  if (value.artboard !== undefined && typeof value.artboard !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_ARTBOARD_INVALID', 'artboard must be a string.', 'artboard')
  }
  if (
    value.animations !== undefined &&
    typeof value.animations !== 'string' &&
    (!Array.isArray(value.animations) || value.animations.some((animation) => typeof animation !== 'string'))
  ) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_ANIMATIONS_INVALID', 'animations must be a string or an array of strings.', 'animations')
  }
}

/** Validates only the START/PAUSE/STOP protocol consumed by the Rive host. */
export function validateRiveAction(value: unknown, context: ValidationContext): void {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_ACTION_INVALID', 'Rive action must be a plain object.')
    return
  }
  const broadcast = value.broadcast
  if (
    broadcast !== undefined &&
    (!isComponentRecord(broadcast) || !['START', 'PAUSE', 'STOP'].includes(String(broadcast.type)))
  ) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_BROADCAST_INVALID', 'broadcast.type must be START, PAUSE, or STOP.', 'broadcast.type')
  }
}

/** Validates the stable configuration owned by the state-machine component. */
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

/** Validates one generic named-input patch projected onto a Rive state machine. */
export function validateRiveStateMachineAction(value: unknown, context: ValidationContext): void {
  validateRiveAction(value, context)
  if (!isComponentRecord(value)) return
  validateRiveInputValues(value.inputs, context, 'inputs')
}

/** Validates optional named input values without inspecting native Rive data. */
function validateRiveInputValues(
  value: unknown,
  context: ValidationContext,
  property: string,
): void {
  if (value === undefined) return
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_INPUTS_INVALID', `${property} must be a plain object.`, property)
    return
  }
  for (const [name, inputValue] of Object.entries(value)) {
    if ((typeof inputValue !== 'number' || !Number.isFinite(inputValue)) && typeof inputValue !== 'boolean') {
      reportInvalidComponentValue(context, 'AUTHOR_RIVE_INPUT_VALUE_INVALID', `${property}.${name} must be a finite number or boolean.`, `${property}.${name}`)
    }
  }
}

export type {
  RiveActionPayload,
  RiveInitial,
  RiveStateMachineActionPayload,
  RiveStateMachineInitial,
}
