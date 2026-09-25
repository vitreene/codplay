import { AbstractLiveSourceProvider } from './abstract-live-source-provider'
import type {
  ScrollObservationEmission,
  ScrollObservationPhase,
  ScrollObservationPhaseUpdate,
  ScrollObservationUpdate,
  ScrollObservationBatch,
  ScrollObservationRule,
} from './scroll-source-types'

/** Selects declared enter/leave events from DOM-free phase changes. */
export class IntersectionObservationProvider extends AbstractLiveSourceProvider {
  private readonly rules: readonly ScrollObservationRule[]
  private readonly rulesById: ReadonlyMap<string, ScrollObservationRule>
  private readonly phases = new Map<string, ScrollObservationPhase>()

  /** Creates a deterministic provider whose rules stay in compiled order. */
  constructor(rules: readonly ScrollObservationRule[]) {
    super()
    const rulesById = new Map<string, ScrollObservationRule>()
    for (const rule of rules) {
      if (rulesById.has(rule.id)) {
        throw new Error(`Duplicate scroll observation rule id: ${rule.id}`)
      }
      rulesById.set(rule.id, rule)
    }
    this.rules = [...rules]
    this.rulesById = rulesById
  }

  /** Applies one callback batch and selects ratio actions plus phase events. */
  update(updates: readonly ScrollObservationUpdate[]): ScrollObservationBatch {
    if (!this.isAttached()) return { emissions: [], liveActions: [] }
    const latestByRule = new Map<string, ScrollObservationUpdate>()
    for (const update of updates) {
      if (this.rulesById.has(update.ruleId)) latestByRule.set(update.ruleId, update)
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
      if (previousPhase === undefined || previousPhase === update.phase) continue
      const events = update.phase === 'inside'
        ? rule.declaration.enter
        : rule.declaration.leave
      for (const event of events ?? []) {
        emissions.push({
          ruleId: rule.id,
          persoId: rule.persoId,
          storyId: rule.storyId,
          phase: update.phase,
          event,
        })
      }
    }
    return { emissions, liveActions }
  }

  /** Keeps the phase-only provider surface for callers that do not use ratios. */
  updatePhases(updates: readonly ScrollObservationPhaseUpdate[]): readonly ScrollObservationEmission[] {
    return this.update(updates.map((update) => ({ ...update, ratio: 0 }))).emissions
  }

  /** Resets phases whenever the source is detached from its current roots. */
  protected override onDetach(): void {
    this.phases.clear()
  }
}
