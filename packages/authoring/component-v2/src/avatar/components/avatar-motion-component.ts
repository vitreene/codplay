import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarMotionAction, AvatarMotionInitial, AvatarTarget } from '../avatar-types'

const MOTION_ACTION_PREFIX = 'avatar:motion:'
const RELEASE_ACTION = `${MOTION_ACTION_PREFIX}release`

/** Plays one named animation or pose resource associated with an Avatar. */
export class AvatarMotionComponent extends AvatarFeatureComponent<AvatarMotionInitial> {
  static readonly declaredServices = [] as const

  /** Converts the latest motion actions into one Avatar motion selection. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarMotionInitial>): void {
    const occurrence = resolveLatestMotionOccurrence(input.activeActions)
    if (occurrence?.name === RELEASE_ACTION) {
      const previous = resolveLatestMotionOccurrence(input.activeActions, occurrence.startAt, false)
      if (previous === undefined) {
        target.releaseAnimation()
        return
      }
      target.setAnimation(createMotionSelection(previous, input.state, this.perso.initial, occurrence))
      return
    }

    const name = resolveMotionName(occurrence?.name, input.state.motion, this.perso.initial.motion)
    if (name === null) {
      target.releaseAnimation()
      return
    }

    target.setAnimation(createMotionSelection(occurrence, input.state, this.perso.initial, undefined, name))
  }
}

/** Builds one normal or released motion selection for the Avatar coordinator. */
function createMotionSelection(
  occurrence: ComponentActionOccurrence | undefined,
  state: AvatarMotionInitial,
  initial: AvatarMotionInitial,
  releaseOccurrence?: ComponentActionOccurrence,
  resolvedName?: string,
): {
  name: string
  startAt: number
  speed: number
  loop?: boolean
  durationMs?: number
  releaseAt?: number
  transitionMs?: number
} {
  const name = resolvedName ?? resolveMotionName(
    occurrence?.name,
    state.motion,
    initial.motion,
  )
  if (name === null) {
    throw new Error('Avatar motion selection requires a named animation.')
  }

  const action = occurrence?.action as AvatarMotionAction | undefined
  const speed = resolveSpeed(action?.speed, state.speed, initial.speed)
  const loopOverride = resolveLoopOverride(
    action?.loop,
    state.loop,
    initial.loop,
  )
  const startAt = occurrence?.startAt ?? 0
  const releaseAction = releaseOccurrence?.action as AvatarMotionAction | undefined
  const releaseAt = releaseOccurrence?.startAt
  const durationMs = releaseAt === undefined
    ? resolveActiveDuration(action?.durationMs, state.durationMs, initial.durationMs)
    : undefined
  const transitionMs = releaseAt === undefined
    ? undefined
    : resolveTransitionDuration(releaseAction?.durationMs)

  return {
    name,
    startAt,
    speed,
    loop: loopOverride,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(releaseAt === undefined ? {} : { releaseAt, transitionMs }),
  }
}

/** Selects the latest motion occurrence by its stable action name. */
function resolveLatestMotionOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
  beforeStartAt = Number.POSITIVE_INFINITY,
  includeRelease = true,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!occurrence.name.startsWith(MOTION_ACTION_PREFIX)) continue
    if ((!includeRelease && occurrence.name === RELEASE_ACTION)
      || occurrence.startAt >= beforeStartAt) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Resolves the named motion or the explicit release action. */
function resolveMotionName(
  actionName: string | undefined,
  stateMotion: string | null | undefined,
  initialMotion: string | null | undefined,
): string | null {
  if (actionName === RELEASE_ACTION) return null
  if (actionName?.startsWith(MOTION_ACTION_PREFIX)) {
    return actionName.slice(MOTION_ACTION_PREFIX.length) || null
  }
  return stateMotion ?? initialMotion ?? null
}

/** Resolves one non-negative playback speed without constraining its scale. */
function resolveSpeed(
  actionSpeed: number | undefined,
  stateSpeed: number | undefined,
  initialSpeed: number | undefined,
): number {
  if (typeof actionSpeed === 'number' && Number.isFinite(actionSpeed)) return Math.max(0, actionSpeed)
  if (typeof stateSpeed === 'number' && Number.isFinite(stateSpeed)) return Math.max(0, stateSpeed)
  if (typeof initialSpeed === 'number' && Number.isFinite(initialSpeed)) return Math.max(0, initialSpeed)
  return 1
}

/** Resolves the optional release hand-off duration without constraining it. */
function resolveTransitionDuration(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 400
  return Math.max(0, value)
}

/** Resolves the optional active duration without imposing an artificial range. */
function resolveActiveDuration(
  actionDuration: number | undefined,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number | undefined {
  for (const value of [actionDuration, stateDuration, initialDuration]) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value)
  }
  return undefined
}

/** Resolves loop behavior, falling back to the resource's declared mode. */
function resolveLoopOverride(
  actionLoop: boolean | undefined,
  stateLoop: boolean | undefined,
  initialLoop: boolean | undefined,
): boolean | undefined {
  if (typeof actionLoop === 'boolean') return actionLoop
  if (typeof stateLoop === 'boolean') return stateLoop
  if (typeof initialLoop === 'boolean') return initialLoop
  return undefined
}
