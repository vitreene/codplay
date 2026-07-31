import type { PersoValidationInput } from '../validation/validation-types'
import type { ValidationTarget } from '../../services/service-validation-types'

/** Structural paths used by perso validation rules. */
export const PERSO_VALIDATION_PATHS = {
  type: ['type'],
  initial: ['initial'],
  actions: ['actions'],
  services: ['services'],
} as const

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
  perso: Pick<PersoValidationInput, 'initial' | 'actions'>,
): readonly PersoValidationPayload[] {
  const payloads: PersoValidationPayload[] = [{
    target: 'initial',
    value: perso.initial,
    path: PERSO_VALIDATION_PATHS.initial,
  }]

  for (const [actionName, action] of Object.entries(perso.actions ?? {})) {
    payloads.push({
      target: 'action',
      value: action,
      path: [...PERSO_VALIDATION_PATHS.actions, actionName],
      actionName,
    })
  }

  return payloads
}
