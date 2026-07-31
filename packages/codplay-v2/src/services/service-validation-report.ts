import type { DiagnosticCollector, DiagnosticRefs } from '../diagnostics'

/** Reports one invalid service value with its namespace path and references. */
export function reportInvalidServiceValue(
  diagnostics: DiagnosticCollector,
  code: string,
  message: string,
  context: { path: string; refs: DiagnosticRefs },
): void {
  diagnostics.error(code, message, {
    refs: context.refs,
    context: { path: context.path },
  })
}
