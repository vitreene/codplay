import type { ValidationFunction } from 'codplay'
import { isComponentRecord, reportInvalidComponentValue } from 'codplay/runtime/components/component-validation'
import { validateRiveAction, validateRiveInputValues } from '../core/rive-validation'
import { validateRiveStateMachineInitial } from '../state-machine/rive-state-machine-validation'

/** Validates the explicit native selection and optional initial property overrides. */
export const validateRiveViewModelInitial: ValidationFunction = (value, context) => {
  validateRiveStateMachineInitial(value, context)
  if (!isComponentRecord(value)) return
  const names = ['viewModel', 'instance'] as const
  names.forEach((name) => {
    if (typeof value[name] !== 'string' || value[name].length === 0) {
      reportInvalidComponentValue(context, 'AUTHOR_RIVE_VIEW_MODEL_SELECTION_INVALID', `${name} must be a non-empty string.`, name)
    }
  })
  validateRiveInputValues(value.values, context, 'values')
  if (
    value.blendSpeed !== undefined &&
    (typeof value.blendSpeed !== 'number' || !Number.isFinite(value.blendSpeed) || value.blendSpeed < 0)
  ) {
    reportInvalidComponentValue(context, 'AUTHOR_RIVE_BLEND_SPEED_INVALID', 'blendSpeed must be a finite number greater than or equal to 0.', 'blendSpeed')
  }
}

/** Validates property patches and the existing native transport protocol. */
export const validateRiveViewModelAction: ValidationFunction = (value, context) => {
  validateRiveAction(value, context)
  if (!isComponentRecord(value)) return
  validateRiveInputValues(value.values, context, 'values')
}
