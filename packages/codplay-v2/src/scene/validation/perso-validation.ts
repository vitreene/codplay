import type { ValidationTarget } from '../../services/service-validation-types'
import { PERSO_VALIDATION_PATHS } from '../config/perso-validation'
import type { PersoValidationInput } from './validation-types'

/** One perso payload passed through component and service validators. */
export type PersoValidationPayload = Readonly<{
  target: ValidationTarget
  value: unknown
  path: readonly string[]
  actionName?: string
}>

/** Joins configured perso validation path segments without embedding paths in callers. */
export function joinPersoValidationPath(segments: readonly string[]): string {
  return segments.join('.')
}

/** Lists the initial and action payloads exposed by one perso to validation rules. */
export function createPersoValidationPayloads(
  perso: Pick<PersoValidationInput, 'id' | 'initial' | 'actions'>,
): readonly PersoValidationPayload[] {
  const payloads: PersoValidationPayload[] = [{
    target: 'initial',
    value: perso.initial,
    path: PERSO_VALIDATION_PATHS.initial,
  }]

  for (const [actionName, action] of Object.entries(perso.actions ?? {})) {
    if (actionName === perso.id && action === null) {
      continue
    }
    payloads.push({
      target: 'action',
      value: action,
      path: [...PERSO_VALIDATION_PATHS.actions, actionName],
      actionName,
    })
  }

  return payloads
}
