import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from '../runtime/avatar-target'
import type { AvatarGazeInitial } from './avatar-types'

type GazeContribution = Readonly<{
  enabled: boolean
  contact: number
}>

type GazeTransition = Readonly<{
  from: GazeContribution
  to: GazeContribution
  startAt: number
  endAt: number
}>

const GAZE_ENABLE_ACTION = 'avatar:gaze:on'
const GAZE_DISABLE_ACTION = 'avatar:gaze:off'

/** Applies a generic camera-contact selection to one Avatar target. */
export class AvatarGazeComponent extends AvatarFeatureComponent<AvatarGazeInitial> {
  static readonly declaredServices = [] as const

  private appliedGaze: GazeContribution
  private lastTimeMs: number | undefined

  /** Starts from the authored gaze state without imposing a transition. */
  constructor(input: ConstructorParameters<typeof AvatarFeatureComponent<AvatarGazeInitial>>[0]) {
    super(input)
    this.appliedGaze = resolveContribution(
      this.perso.initial.enabled,
      this.perso.initial.contact,
    )
  }

  /** Resolves the latest gaze event and registers its optional transition. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarGazeInitial>): void {
    if (this.lastTimeMs !== undefined && input.timeMs < this.lastTimeMs) {
      this.appliedGaze = resolveContribution(
        this.perso.initial.enabled,
        this.perso.initial.contact,
      )
    }
    this.lastTimeMs = input.timeMs

    const occurrence = resolveLatestGazeOccurrence(input.activeActions)
    const action = occurrence?.action
    const enabled = resolveEnabled(
      occurrence?.name,
      input.state.enabled,
      this.perso.initial.enabled,
    )
    const contact = resolveContact(action?.contact, input.state.contact, this.perso.initial.contact)
    const transition = createTransition(
      this.appliedGaze,
      resolveContribution(enabled, contact),
      occurrence?.startAt ?? input.timeMs,
      resolveDuration(action?.durationMs, input.state.durationMs, this.perso.initial.durationMs),
    )
    const animation = createAnimation(transition, target, (gaze) => {
      this.appliedGaze = gaze
    })
    if (input.registerAnimation !== undefined) {
      input.registerAnimation(animation)
      return
    }

    animation.sample(input.timeMs)?.apply()
  }
}

/** Selects the latest ordinary action that carries a gaze change. */
function resolveLatestGazeOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!hasGazeValue(occurrence.name, occurrence.action)) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Identifies an action that changes the generic gaze contribution. */
function hasGazeValue(name: string, action: Record<string, unknown>): boolean {
  return name === GAZE_ENABLE_ACTION
    || name === GAZE_DISABLE_ACTION
    || Object.prototype.hasOwnProperty.call(action, 'contact')
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
  return initialValue ?? false
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

/** Converts the author state to the effective contact used during a transition. */
function resolveContribution(enabled: boolean | undefined, contact: number | null | undefined): GazeContribution {
  return {
    enabled: enabled ?? false,
    contact: enabled === true ? normalizeContact(contact) : 0,
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

/** Creates one absolute-time transition from the currently applied contact. */
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

/** Registers the component-owned gaze transition on the CodPlay clock. */
function createAnimation(
  transition: GazeTransition,
  target: AvatarTarget,
  remember: (gaze: GazeContribution) => void,
): ComponentAnimation {
  return {
    id: 'avatar-gaze',
    startAt: transition.startAt,
    endAt: transition.endAt,
    sample: (timeMs) => {
      const gaze = sampleTransition(transition, timeMs)
      return {
        value: gaze,
        apply: () => {
          remember(gaze)
          target.setGaze(gaze.enabled, gaze.contact)
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
  const eased = easeOutCubic(progress)
  const enabled = timeMs < transition.startAt
    ? transition.from.enabled
    : timeMs >= transition.endAt
      ? transition.to.enabled
      : transition.from.enabled || transition.to.enabled
  return {
    enabled,
    contact: transition.from.contact + (transition.to.contact - transition.from.contact) * eased,
  }
}

/** Moves quickly at the start and settles slowly on the final gaze pose. */
function easeOutCubic(progress: number): number {
  const remaining = 1 - progress
  return 1 - remaining * remaining * remaining
}
