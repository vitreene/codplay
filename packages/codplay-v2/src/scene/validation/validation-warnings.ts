import type { DiagnosticCollector, DiagnosticRefs } from '../../diagnostics'

/** Describes the validation capability that is missing from one declaration. */
export type MissingValidatorInput = Readonly<{
  kind: 'component' | 'service'
  name: string
  refs: DiagnosticRefs
  path: string
  diagnostics: DiagnosticCollector
}>

/** Reports one detailed author warning when a declared capability has no validator. */
export function reportMissingValidator(input: MissingValidatorInput): void {
  const code = input.kind === 'component'
    ? 'AUTHOR_COMPONENT_VALIDATOR_MISSING'
    : 'AUTHOR_SERVICE_VALIDATOR_MISSING'

  input.diagnostics.warning(
    code,
    `No ${input.kind} validator is registered for "${input.name}".`,
    {
      refs: input.refs,
      context: {
        capability: input.name,
        path: input.path,
      },
    },
    `${code}:${input.name}:${input.refs.persoId ?? ''}:${input.path}`,
  )
}
