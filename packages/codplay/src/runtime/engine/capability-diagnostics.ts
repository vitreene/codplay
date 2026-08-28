import type { DiagnosticCollector } from '../../diagnostics'

const CAPABILITY_COMPONENT = 'component' as const
const CAPABILITY_SERVICE = 'service' as const
const CAPABILITY_MODULE = 'module' as const
const CAPABILITY_RESOURCE = 'resource' as const
type CapabilityKind =
  | typeof CAPABILITY_COMPONENT
  | typeof CAPABILITY_SERVICE
  | typeof CAPABILITY_MODULE
  | typeof CAPABILITY_RESOURCE

/** Reports every required capability absent from the shared engine. */
export function reportMissingCapabilities(
  kind: CapabilityKind,
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
