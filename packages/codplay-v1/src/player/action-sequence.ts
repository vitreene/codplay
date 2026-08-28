import { isTweenAction } from '../tween/tween-runner'

/**
 * Declares one heterogeneous step of an `ActionSequence`. Each step carries
 * its own action payload (static, or a `TweenAction`) and its own duration
 * for chaining — distinct from `context.planned.repeat`/`stagger`, which
 * repeat one template at a uniform spacing.
 */
export type ActionSequenceStep = {
  action: Record<string, unknown>
  durationMs?: number
  startAt?: number
}

export type ActionSequence = ActionSequenceStep[]

/**
 * Returns true when one value is a valid `ActionSequenceStep` wrapper —
 * distinct from a bare action payload, so an `ActionSequence` is never
 * confused with any other array-shaped value.
 */
export function isActionSequenceStep(value: unknown): value is ActionSequenceStep {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const action = (value as Record<string, unknown>).action
  return typeof action === 'object' && action !== null && !Array.isArray(action)
}

/**
 * Returns true when one value is an `ActionSequence` — a non-empty array of
 * `ActionSequenceStep` wrappers.
 */
export function isActionSequence(value: unknown): value is ActionSequence {
  return Array.isArray(value) && value.length > 0 && value.every(isActionSequenceStep)
}

/**
 * Declares one heterogeneous, chainable step generically — the shared shape
 * behind both author-facing forms of the chaining primitive (`ActionSequence`
 * at perso level, the `sequence` strap helper at strap level). `content` is
 * opaque to this primitive: it only computes *when* each step is due, never
 * what it means once delivered.
 */
export type GenericSequenceStep<TContent> = {
  content: TContent
  durationMs?: number
  startAt?: number
}

/**
 * Decomposes one heterogeneous step list into a flat list of positioned
 * triggers. `startAt`, when present, overrides the automatic chain position
 * for that step; otherwise a step starts where the previous one ends.
 * `resolveImplicitDurationMs` lets each author-facing form decide its own
 * fallback when `durationMs` is not explicit (e.g. a `TweenAction` step's
 * own `duration`, at perso level); steps with no resolvable implicit
 * duration default to 0 (no implicit wait, the next step starts at the
 * same instant).
 */
export function planGenericSequenceSteps<TContent>(
  steps: Array<GenericSequenceStep<TContent>>,
  resolveImplicitDurationMs: (content: TContent) => number = () => 0
): Array<{ offsetMs: number; content: TContent }> {
  const result: Array<{ offsetMs: number; content: TContent }> = []
  let chainMs = 0

  for (const step of steps) {
    const offsetMs = step.startAt !== undefined ? step.startAt : chainMs
    result.push({ offsetMs, content: step.content })
    chainMs = offsetMs + (step.durationMs !== undefined ? step.durationMs : resolveImplicitDurationMs(step.content))
  }

  return result
}

/**
 * Decomposes one `ActionSequence` into a flat list of positioned triggers —
 * the perso-level form of the shared chaining primitive (see
 * `planGenericSequenceSteps`). A `TweenAction` step's own `duration`
 * contributes the implicit chain duration when `durationMs` is not explicit.
 */
export function planActionSequenceSteps(
  steps: ActionSequence
): Array<{ offsetMs: number; action: Record<string, unknown> }> {
  return planGenericSequenceSteps(
    steps.map((step) => ({ content: step.action, durationMs: step.durationMs, startAt: step.startAt })),
    (action) => (isTweenAction(action) ? action.duration : 0)
  ).map(({ offsetMs, content }) => ({ offsetMs, action: content }))
}

/**
 * Builds the reserved, per-(perso, actionKey) auto-reference event name used
 * to deliver the continuation steps (index 1+) of one perso-level
 * `ActionSequence` to this exact perso, without any per-perso targeting
 * capability in the dispatch system itself (none exists — see
 * `v1-action-sequence-spec.md`). Unique by construction: only this perso
 * declares this exact key, so no other listener in the same story scope can
 * ever match it.
 */
export function buildActionSequenceContinuationEventName(persoId: string, actionKey: string): string {
  return `${persoId}::${actionKey}::seq`
}

/**
 * Recovers the original `(persoId, actionKey)` pair from one continuation
 * event name built by `buildActionSequenceContinuationEventName`, if it
 * matches that exact convention. Used to retire a tween left active by the
 * sequence's first step (registered under the original actionKey) when a
 * later continuation step of the same chain applies.
 */
export function parseActionSequenceContinuationEventName(
  eventName: string,
  persoId: string
): { actionKey: string } | null {
  const prefix = `${persoId}::`
  const suffix = '::seq'
  if (!eventName.startsWith(prefix) || !eventName.endsWith(suffix)) {
    return null
  }

  return { actionKey: eventName.slice(prefix.length, eventName.length - suffix.length) }
}

/**
 * Reserved key carrying the id of the event that triggered one
 * ActionSequence, embedded in every one of its scheduled continuation steps.
 * Lets the player recognize and silently drop a continuation step whose
 * sequence was superseded by a later trigger on the same actionKey (Cas 1 —
 * interruption + remplacement) before it was due.
 */
export const ACTION_SEQUENCE_TOKEN_KEY = '__actionSequenceToken'

/**
 * Reads the ActionSequence continuation token from one resolved action, if
 * present.
 */
export function readActionSequenceToken(action: unknown): string | undefined {
  if (typeof action !== 'object' || action === null) {
    return undefined
  }

  const token = (action as Record<string, unknown>)[ACTION_SEQUENCE_TOKEN_KEY]
  return typeof token === 'string' ? token : undefined
}
