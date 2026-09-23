import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type {
  AvatarGazeInitial,
  AvatarGazeLookAhead,
  AvatarGazeTarget,
  AvatarTarget,
  AvatarTimeline,
} from '../avatar-types'
import { TH_GAZE_DEFAULTS } from '../gaze/gaze-service'
import { sampleTalkingHeadEasing } from '../avatar-easing'

type GazeContribution = Readonly<{
  enabled: boolean
  contact: number
  headMove?: number
  target: AvatarGazeTarget
  lookAhead: boolean
}>

type GazeTransition = Readonly<{
  from: GazeContribution
  to: GazeContribution
  startAt: number
  endAt: number
}>

const GAZE_ENABLE_ACTION = 'avatar:gaze:on'
const GAZE_DISABLE_ACTION = 'avatar:gaze:off'
const GAZE_IDLE_ACTION = 'avatar:gaze:idle'
const GAZE_SPEAKING_ACTION = 'avatar:gaze:speaking'
const GAZE_LISTENING_ACTION = 'avatar:gaze:listening'
const GAZE_LOOK_AHEAD_ACTION = 'avatar:gaze:look-ahead'
const GAZE_CAMERA_ACTION = 'avatar:gaze:camera'

/** Applies a generic camera-contact selection to one Avatar target. */
export class AvatarGazeComponent extends AvatarFeatureComponent<AvatarGazeInitial> {
  static readonly declaredServices = [] as const

  /** Resolves the gaze history into one pure absolute-time transition. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarGazeInitial>): void {
    target.setGazeProfiles?.({
      idle: this.perso.initial.idleContact ?? TH_GAZE_DEFAULTS.idleContact,
      idleHeadMove: this.perso.initial.idleHeadMove ?? TH_GAZE_DEFAULTS.idleHeadMove,
      speaking: this.perso.initial.speakingContact ?? TH_GAZE_DEFAULTS.speakingContact,
      speakingHeadMove: this.perso.initial.speakingHeadMove ?? TH_GAZE_DEFAULTS.speakingHeadMove,
      listening: this.perso.initial.listeningContact ?? TH_GAZE_DEFAULTS.listeningContact,
      listeningHeadMove: this.perso.initial.listeningHeadMove ?? TH_GAZE_DEFAULTS.listeningHeadMove,
      ignoreCamera: this.perso.initial.ignoreCamera,
    })
    const occurrence = resolveLatestGazeOccurrence(input.activeActions)
    const previous = resolveLatestGazeOccurrence(input.activeActions, occurrence?.startAt)
    const mode = resolveGazeMode(occurrence?.name)
    if (mode !== undefined) target.setGazeMode?.(mode)
    const previousGaze = resolveOccurrenceContribution(previous, this.perso.initial)
    const action = occurrence?.action
    const enabled = resolveEnabled(
      occurrence?.name,
      input.state.enabled,
      this.perso.initial.enabled,
    )
    const contact = resolveContact(action?.contact, input.state.contact, this.perso.initial.contact)
    const headMove = resolveHeadMove(action?.headMove, input.state.headMove, this.perso.initial.headMove)
    const lookAhead = occurrence?.name === GAZE_LOOK_AHEAD_ACTION
    const durationMs = resolveDuration(
      action?.durationMs,
      input.state.durationMs,
      this.perso.initial.durationMs,
    )
    const transition = createTransition(
      previousGaze,
      resolveContribution(
        enabled,
        contact,
        headMove,
        resolveGazeTarget(occurrence?.name, this.perso.initial.ignoreCamera) ?? previousGaze.target,
        lookAhead,
      ),
      occurrence?.startAt ?? input.timeMs,
      durationMs,
    )
    const lookAheadDurationMs = lookAhead
      ? resolveLookAheadDuration(durationMs)
      : 0
    const lookAheadSeed = stableSeed(occurrence?.eventId ?? GAZE_LOOK_AHEAD_ACTION)
    target.setTimeline('gaze', createAnimation(
      transition,
      target,
      lookAheadDurationMs,
      lookAheadSeed,
    ))
  }
}

/** Selects the latest ordinary action that carries a gaze change. */
function resolveLatestGazeOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
  beforeStartAt = Number.POSITIVE_INFINITY,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!hasGazeValue(occurrence.name, occurrence.action)) continue
    if (occurrence.startAt >= beforeStartAt) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Identifies an action that changes the generic gaze contribution. */
function hasGazeValue(name: string, action: Record<string, unknown>): boolean {
  return name === GAZE_ENABLE_ACTION
    || name === GAZE_DISABLE_ACTION
    || name === GAZE_IDLE_ACTION
    || name === GAZE_SPEAKING_ACTION
    || name === GAZE_LISTENING_ACTION
    || name === GAZE_LOOK_AHEAD_ACTION
    || name === GAZE_CAMERA_ACTION
    || Object.prototype.hasOwnProperty.call(action, 'contact')
    || Object.prototype.hasOwnProperty.call(action, 'headMove')
}

/** Resolves the enabled flag without imposing a policy on missing model data. */
function resolveEnabled(
  actionName: string | undefined,
  stateValue: boolean | undefined,
  initialValue: boolean | undefined,
): boolean {
  if (actionName === GAZE_ENABLE_ACTION) return true
  if (actionName === GAZE_DISABLE_ACTION) return false
  if (typeof stateValue === 'boolean') return stateValue
  return initialValue ?? true
}

/** Resolves the native camera or look-ahead target selected by one action. */
function resolveGazeTarget(
  actionName: string | undefined,
  ignoreCamera: boolean | undefined,
): AvatarGazeTarget | undefined {
  if (actionName === GAZE_LOOK_AHEAD_ACTION) return 'ahead'
  if (actionName === GAZE_CAMERA_ACTION || actionName === GAZE_ENABLE_ACTION) return 'camera'
  if (actionName === undefined) return ignoreCamera === true ? 'ahead' : 'camera'
  return undefined
}

/** Resolves the optional TH interaction mode carried by a gaze action. */
function resolveGazeMode(name: string | undefined): 'idle' | 'speaking' | 'listening' | undefined {
  if (name === GAZE_IDLE_ACTION) return 'idle'
  if (name === GAZE_SPEAKING_ACTION) return 'speaking'
  if (name === GAZE_LISTENING_ACTION) return 'listening'
  return undefined
}

/** Resolves contact strength while leaving clamping to the native gaze service. */
function resolveContact(
  actionValue: unknown,
  stateValue: number | null | undefined,
  initialValue: number | null | undefined,
): number | null {
  if (actionValue === null) return null
  if (typeof actionValue === 'number' && Number.isFinite(actionValue)) return actionValue
  if (stateValue === null) return null
  if (typeof stateValue === 'number' && Number.isFinite(stateValue)) return stateValue
  return initialValue ?? null
}

/** Resolves optional head motion while leaving the native default available. */
function resolveHeadMove(
  actionValue: unknown,
  stateValue: number | null | undefined,
  initialValue: number | null | undefined,
): number | null | undefined {
  if (actionValue === null) return null
  if (typeof actionValue === 'number' && Number.isFinite(actionValue)) return actionValue
  if (stateValue === null) return null
  if (typeof stateValue === 'number' && Number.isFinite(stateValue)) return stateValue
  return initialValue
}

/** Converts the author state to the effective contact used during a transition. */
function resolveContribution(
  enabled: boolean | undefined,
  contact: number | null | undefined,
  headMove: number | null | undefined,
  target: AvatarGazeTarget,
  lookAhead: boolean,
): GazeContribution {
  return {
    enabled: enabled ?? false,
    contact: enabled === true ? normalizeContact(contact) : 0,
    ...(headMove === undefined ? {} : { headMove: enabled === true ? normalizeContact(headMove) : 0 }),
    target,
    lookAhead,
  }
}

/** Converts null contact to full contact while leaving range handling native. */
function normalizeContact(value: number | null | undefined): number {
  return value ?? 1
}

/** Resolves one optional transition duration without imposing a range. */
function resolveDuration(
  actionDuration: unknown,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number {
  if (typeof actionDuration === 'number' && Number.isFinite(actionDuration)) return Math.max(0, actionDuration)
  if (typeof stateDuration === 'number' && Number.isFinite(stateDuration)) return Math.max(0, stateDuration)
  if (typeof initialDuration === 'number' && Number.isFinite(initialDuration)) return Math.max(0, initialDuration)
  return 0
}

/** Resolves one historical gaze occurrence without reading mutable presentation state. */
function resolveOccurrenceContribution(
  occurrence: ComponentActionOccurrence | undefined,
  initial: AvatarGazeInitial,
): GazeContribution {
  return resolveContribution(
    resolveEnabled(occurrence?.name, undefined, initial.enabled),
    resolveContact(occurrence?.action.contact, undefined, initial.contact),
    resolveHeadMove(occurrence?.action.headMove, undefined, initial.headMove),
    resolveGazeTarget(occurrence?.name, initial.ignoreCamera)
      ?? (initial.ignoreCamera === true ? 'ahead' : 'camera'),
    occurrence?.name === GAZE_LOOK_AHEAD_ACTION,
  )
}

/** Creates one absolute-time transition from the authored gaze history. */
function createTransition(
  from: GazeContribution,
  to: GazeContribution,
  startAt: number,
  durationMs: number,
): GazeTransition {
  return {
    from: { ...from },
    to: { ...to },
    startAt,
    endAt: startAt + durationMs,
  }
}

/** Creates a gaze stream consumed by Avatar's central presentation. */
function createAnimation(
  transition: GazeTransition,
  target: AvatarTarget,
  lookAheadDurationMs: number,
  lookAheadSeed: number,
): AvatarTimeline {
  return {
    id: 'avatar-gaze',
    startAt: transition.startAt,
    endAt: transition.endAt,
    sample: (timeMs) => {
      const gaze = sampleTransition(transition, timeMs)
      return {
        value: gaze,
        apply: () => {
          target.setGazeTarget?.(gaze.target, {
            startAt: transition.startAt,
            durationMs: transition.endAt - transition.startAt,
          })
          if (gaze.headMove === undefined) target.setGaze(gaze.enabled, gaze.contact)
          else target.setGaze(gaze.enabled, gaze.contact, gaze.headMove)
          target.setGazeLookAhead?.(toLookAheadRequest(
            gaze,
            transition.startAt,
            lookAheadDurationMs,
            lookAheadSeed,
          ))
        },
      }
    },
  }
}

/** Samples an ease-out transition so gaze reaches its pose naturally. */
function sampleTransition(transition: GazeTransition, timeMs: number): GazeContribution {
  const durationMs = transition.endAt - transition.startAt
  if (durationMs === 0) return { ...transition.to }

  const progress = Math.max(0, Math.min(1, (timeMs - transition.startAt) / durationMs))
  const eased = sampleTalkingHeadEasing(progress)
  const enabled = timeMs < transition.startAt
    ? transition.from.enabled
    : timeMs >= transition.endAt
      ? transition.to.enabled
      : transition.from.enabled || transition.to.enabled
  return {
    enabled,
    contact: transition.from.contact + (transition.to.contact - transition.from.contact) * eased,
    target: timeMs < transition.startAt ? transition.from.target : transition.to.target,
    lookAhead: timeMs < transition.startAt ? transition.from.lookAhead : transition.to.lookAhead,
    ...(transition.from.headMove === undefined && transition.to.headMove === undefined
      ? {}
      : {
        headMove: (transition.from.headMove ?? 1)
          + ((transition.to.headMove ?? 1) - (transition.from.headMove ?? 1)) * eased,
      }),
  }
}

/** Resolves the finite native camera-pulse duration used by look-ahead. */
function resolveLookAheadDuration(durationMs: number): number {
  return durationMs > 0 ? durationMs : 500
}

/** Converts one sampled gaze contribution into an internal TH request. */
function toLookAheadRequest(
  gaze: GazeContribution,
  startAt: number,
  durationMs: number,
  seed: number,
): AvatarGazeLookAhead | null {
  if (!gaze.lookAhead) return null
  return { startAt, durationMs, seed }
}

/** Derives a repeatable random seed from one gaze event identity. */
function stableSeed(value: string): number {
  let hash = 2_166_261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}
