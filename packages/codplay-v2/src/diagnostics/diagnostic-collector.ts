/** Severity levels emitted by the V2 diagnostic pipeline. */
export type DiagnosticSeverity = 'warning' | 'error'

/** Stable references that help consumers locate one diagnostic. */
export type DiagnosticRefs = Readonly<{
  sceneId?: string
  storyId?: string
  persoId?: string
  trackId?: string
  eventId?: string
  eventSeq?: number
  commitSeq?: number
}>

/** Structured context attached to one diagnostic. */
export type DiagnosticDetails = Readonly<{
  refs?: DiagnosticRefs
  context?: Readonly<Record<string, unknown>>
}>

/** Input accepted by the diagnostic collector. */
export type DiagnosticInput = Readonly<{
  severity: DiagnosticSeverity
  code: string
  message: string
  details?: DiagnosticDetails
  dedupeKey?: string
}>

/** One diagnostic exposed to output adapters and API consumers. */
export type Diagnostic = Readonly<{
  severity: DiagnosticSeverity
  code: string
  message: string
  details?: DiagnosticDetails
}>

/** Grouped diagnostic report for guards, builders, and future output adapters. */
export type DiagnosticReport = Readonly<{
  all: readonly Diagnostic[]
  warnings: readonly Diagnostic[]
  errors: readonly Diagnostic[]
}>

/** Output adapter receiving one accepted diagnostic. */
export type DiagnosticOutput = (diagnostic: Diagnostic) => void

export type DiagnosticCollectorOptions = Readonly<{
  deduplicate?: boolean
  output?: DiagnosticOutput
}>

/**
 * Collects structured diagnostics without deciding where they are displayed.
 */
export class DiagnosticCollector {
  private readonly entries: Diagnostic[] = []
  private readonly seenKeys = new Set<string>()
  private readonly deduplicate: boolean
  private readonly output: DiagnosticOutput

  /**
   * Creates one collector with optional duplicate suppression.
   */
  constructor(options: DiagnosticCollectorOptions = {}) {
    this.deduplicate = options.deduplicate ?? true
    this.output = options.output ?? defaultDiagnosticOutput
  }

  /**
   * Adds one diagnostic and returns it when it was accepted.
   */
  add(input: DiagnosticInput): Diagnostic | null {
    const entry: Diagnostic = {
      severity: input.severity,
      code: input.code,
      message: input.message,
      details: input.details,
    }
    const key = input.dedupeKey ?? createDiagnosticKey(entry)

    if (this.deduplicate && this.seenKeys.has(key)) {
      return null
    }

    this.seenKeys.add(key)
    this.entries.push(entry)
    this.output(entry)
    return entry
  }

  /**
   * Adds one warning to the report.
   */
  warning(code: string, message: string, details?: DiagnosticDetails, dedupeKey?: string): Diagnostic | null {
    return this.add({ severity: 'warning', code, message, details, dedupeKey })
  }

  /**
   * Adds one error to the report.
   */
  error(code: string, message: string, details?: DiagnosticDetails, dedupeKey?: string): Diagnostic | null {
    return this.add({ severity: 'error', code, message, details, dedupeKey })
  }

  /**
   * Returns a detached report grouped by severity for output consumers.
   */
  report(): DiagnosticReport {
    const all = this.entries.map(cloneDiagnostic)
    return {
      all,
      warnings: all.filter((entry) => entry.severity === 'warning'),
      errors: all.filter((entry) => entry.severity === 'error'),
    }
  }

  /**
   * Indicates whether at least one blocking diagnostic was collected.
   */
  hasErrors(): boolean {
    return this.entries.some((entry) => entry.severity === 'error')
  }

  /**
   * Removes all collected diagnostics and duplicate keys.
   */
  clear(): void {
    this.entries.length = 0
    this.seenKeys.clear()
  }
}

/**
 * Writes one diagnostic through the default console.log output.
 */
function defaultDiagnosticOutput(entry: Diagnostic): void {
  const details = entry.details === undefined ? '' : ` ${JSON.stringify(entry.details)}`
  console.log(`[${entry.severity}] ${entry.code}: ${entry.message}${details}`)
}

/**
 * Builds the default duplicate key from severity, code, and stable references.
 */
function createDiagnosticKey(entry: Diagnostic): string {
  return JSON.stringify({
    severity: entry.severity,
    code: entry.code,
    refs: entry.details?.refs ?? null,
  })
}

/**
 * Clones one diagnostic boundary so callers cannot mutate collector state.
 */
function cloneDiagnostic(entry: Diagnostic): Diagnostic {
  return {
    severity: entry.severity,
    code: entry.code,
    message: entry.message,
    details: entry.details === undefined
      ? undefined
      : {
          refs: entry.details.refs === undefined ? undefined : { ...entry.details.refs },
          context: entry.details.context === undefined ? undefined : { ...entry.details.context },
        },
  }
}
