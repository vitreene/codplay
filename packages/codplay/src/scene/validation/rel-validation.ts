import { isPlainRecord } from '../../shared'
import type { ValidationContext } from '../../services'
import { isRel } from '../rel'

/** Validates the immutable relation declared in one perso initial profile. */
export function validateRelInitial(value: unknown, context: ValidationContext): void {
  if (!isPlainRecord(value) || value.rel === undefined) return
  if (isRel(value.rel)) return

  context.diagnostics.warning(
    'AUTHOR_REL_INVALID',
    'initial.rel must contain a non-empty host id and an optional target id.',
    {
      refs: context.refs,
      context: { path: `${context.path}.rel` },
    },
  )
}

/** Warns when an action attempts to mutate the immutable relation declaration. */
export function validateRelAction(value: unknown, context: ValidationContext): void {
  if (isPlainRecord(value)) {
    warnActionRelation(value.rel, context, `${context.path}.rel`)
    return
  }
  if (!Array.isArray(value)) return

  value.forEach((step, index) => {
    if (!isPlainRecord(step) || !isPlainRecord(step.action)) return
    warnActionRelation(step.action.rel, context, `${context.path}[${index}].action.rel`)
  })
}

/** Emits one warning for a relation found in an action patch. */
function warnActionRelation(value: unknown, context: ValidationContext, path: string): void {
  if (value === undefined) return
  context.diagnostics.warning(
    'AUTHOR_REL_ACTION_IGNORED',
    'rel is immutable and cannot be changed by an action; the action value is ignored.',
    {
      refs: context.refs,
      context: { path },
    },
  )
}
