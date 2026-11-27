import type {
  ScrollObservationBatch,
  ScrollObservationPhase,
  ScrollObservationRule,
  ScrollObservationUpdate,
} from './scroll-source-types'

/** Selects declared enter/leave events and ratio actions from DOM-free phase updates. */
export class ScrollObservationPhases {
  private readonly rules: readonly ScrollObservationRule[]
  private readonly ruleIds: ReadonlySet<string>
  private readonly phases = new Map<string, ScrollObservationPhase>()
  private attached = false

  /** Keeps the rules in compiled declaration order; ids must be unique. */
  constructor(rules: readonly ScrollObservationRule[]) {
    const ruleIds = new Set<string>()
    for (const rule of rules) {
      if (ruleIds.has(rule.id)) throw new Error(`Duplicate scroll observation rule id: ${rule.id}`)
      ruleIds.add(rule.id)
    }
    this.rules = [...rules]
    this.ruleIds = ruleIds
  }

  /** Starts accepting observer batches. */
  attach(): void {
    this.attached = true
  }

  /** Stops accepting batches and forgets the phases, so the next callback synchronizes again. */
  detach(): void {
    this.attached = false
    this.phases.clear()
  }

  /** Applies one callback batch and selects ratio actions plus phase events. */
  update(updates: readonly ScrollObservationUpdate[]): ScrollObservationBatch {
    if (!this.attached) return { emissions: [], liveActions: [] }
    const latestByRule = new Map<string, ScrollObservationUpdate>()
    for (const update of updates) {
      if (this.ruleIds.has(update.ruleId)) latestByRule.set(update.ruleId, update)
    }

    const emissions: ScrollObservationBatch['emissions'][number][] = []
    const liveActions: ScrollObservationBatch['liveActions'][number][] = []
    for (const rule of this.rules) {
      const update = latestByRule.get(rule.id)
      if (update === undefined) continue
      if (rule.declaration.liveAction !== undefined) {
        liveActions.push({
          ruleId: rule.id,
          persoId: rule.persoId,
          storyId: rule.storyId,
          actionName: rule.declaration.liveAction,
          ratio: update.ratio,
        })
      }
      const previousPhase = this.phases.get(rule.id)
      this.phases.set(rule.id, update.phase)
      if (previousPhase === undefined) {
        const initialPhase = rule.declaration.initial === 'enter'
          ? 'inside'
          : rule.declaration.initial === 'leave'
            ? 'outside'
            : undefined
        if (initialPhase === undefined || initialPhase !== update.phase) continue
      } else if (previousPhase === update.phase) continue
      const events = update.phase === 'inside' ? rule.declaration.enter : rule.declaration.leave
      for (const event of events ?? []) {
        emissions.push({
          ruleId: rule.id,
          persoId: rule.persoId,
          storyId: rule.storyId,
          phase: update.phase,
          initial: previousPhase === undefined,
          event,
        })
      }
    }
    return { emissions, liveActions }
  }
}
