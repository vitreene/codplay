import type { DiagnosticCollector } from '../../diagnostics'

/** Reports every required capability absent from the shared engine. */
export function reportMissingCapabilities(
  kind: 'component' | 'service' | 'module' | 'resource',
  required: readonly string[],
  available: ReadonlySet<string>,
  diagnostics: DiagnosticCollector,
): void {
  for (const name of required) {
    if (available.has(name)) continue
    diagnostics.error(
      `RUNTIME_${kind.toUpperCase()}_UNAVAILABLE`,
      `Runtime ${kind} "${name}" is not available in the engine.`,
      { context: { capability: name, kind } },
    )
  }
}
