import type { DiagnosticCollector, DiagnosticRefs } from '../../diagnostics'
import { GUARD_PHASE_ORDER, type GuardPhase } from '../config/guard-phases'

export type { GuardPhase } from '../config/guard-phases'

/** Shared context passed to one pure guard rule. */
export type GuardContext = Readonly<{
  phase: GuardPhase
  path: string
  refs: DiagnosticRefs
  diagnostics: DiagnosticCollector
}>

/** One named pure rule that inspects a value without changing it. */
export type GuardRule<T> = Readonly<{
  id: string
  phase: GuardPhase
  run: (value: T, context: GuardContext) => void
}>

/**
 * Runs named guard rules in deterministic phase and registration order.
 */
export class GuardPipeline<T> {
  private readonly rules: GuardRule<T>[] = []

  /**
   * Adds one guard rule and rejects duplicate rule identifiers.
   */
  register(rule: GuardRule<T>): void {
    if (this.rules.some((registered) => registered.id === rule.id)) {
      throw new Error(`Guard rule already registered: ${rule.id}`)
    }
    this.rules.push(rule)
  }

  /**
   * Runs all registered rules against one value.
   */
  run(value: T, input: Omit<GuardContext, 'phase'>): void {
    for (const phase of GUARD_PHASE_ORDER) {
      for (const rule of this.rules) {
        if (rule.phase !== phase) continue
        rule.run(value, { ...input, phase })
      }
    }
  }
}
