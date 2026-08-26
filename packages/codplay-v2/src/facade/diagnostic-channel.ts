import type {
  Diagnostic,
  DiagnosticDetails,
  DiagnosticOutput,
  DiagnosticRefs,
  DiagnosticReport,
} from '../diagnostics'

/** Routes structured diagnostics from one instance to its local and engine observers. */
export class DiagnosticChannel {
  private readonly listeners = new Set<(diagnostic: Diagnostic) => void>()
  private readonly output: DiagnosticOutput | undefined
  private readonly parent: DiagnosticChannel | undefined

  /** Creates one channel with an optional output and parent engine channel. */
  constructor(
    output?: DiagnosticOutput,
    parent?: DiagnosticChannel,
  ) {
    this.output = output
    this.parent = parent
  }

  /** Subscribes to diagnostics and returns the matching unsubscribe operation. */
  onDiagnostic(listener: (diagnostic: Diagnostic) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Publishes one diagnostic through this channel and its parent. */
  publish(diagnostic: Diagnostic): void {
    for (const listener of this.listeners) listener(diagnostic)
    this.output?.(diagnostic)
    this.parent?.publish(diagnostic)
  }

  /** Publishes every entry in one report while attaching stable references. */
  publishReport(report: DiagnosticReport, refs?: DiagnosticRefs): void {
    for (const diagnostic of report.all) this.publish(withDiagnosticRefs(diagnostic, refs))
  }
}

/** Attaches operation references without mutating the collected diagnostic. */
export function withDiagnosticRefs(diagnostic: Diagnostic, refs?: DiagnosticRefs): Diagnostic {
  if (refs === undefined) return diagnostic
  const details: DiagnosticDetails = diagnostic.details === undefined
    ? { refs }
    : {
        ...diagnostic.details,
        refs: { ...(diagnostic.details.refs ?? {}), ...refs },
      }
  return { ...diagnostic, details }
}

/** Publishes one blocking facade failure through the established diagnostic format. */
export function publishFacadeError(
  channel: DiagnosticChannel,
  code: string,
  error: unknown,
  refs?: DiagnosticRefs,
): void {
  channel.publish({
    severity: 'error',
    code,
    message: error instanceof Error ? error.message : String(error),
    details: refs === undefined ? undefined : { refs },
  })
}
