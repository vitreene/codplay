import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from '../runtime/avatar-target'
import type { AvatarGestureInitial } from './avatar-types'
import { getAvatarActionMotion } from '../gesture/motion-catalog'
import type { AvatarGestureFrame } from '../gesture/motion-catalog'

const GESTURE_ACTION_PREFIX = 'avatar:gesture:'
const RELEASE_ACTION = `${GESTURE_ACTION_PREFIX}release`

/** Contributes one gesture selection to the Avatar coordinator. */
export class AvatarGestureComponent extends AvatarFeatureComponent<AvatarGestureInitial> {
  static readonly declaredServices = [] as const

  /** Stores the selected gesture and derives a stable replay seed from its occurrence. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarGestureInitial>): void {
    const occurrence = resolveLatestGestureOccurrence(input.activeActions)
    const gesture = resolveGestureName(occurrence?.name, input.state.gesture, this.perso.initial.gesture)
    const seed = input.state.seed ?? stableSeed(occurrence?.eventId ?? gesture)
    if (gesture === null) {
      target.setGesture(null)
      return
    }

    const motion = getAvatarActionMotion(
      gesture,
      seed,
      resolveDuration(occurrence?.action.durationMs, input.state.durationMs, this.perso.initial.durationMs),
    )
    if (motion === undefined) {
      target.setGesture(gesture, seed)
      return
    }

    const startAt = occurrence?.startAt ?? 0
    const animation = createMotionAnimation(motion.sample, startAt, motion.durationMs, target, seed)
    if (input.registerAnimation !== undefined) {
      input.registerAnimation(animation)
      return
    }
    animation.sample(input.timeMs)?.apply()
  }
}

/** Selects the latest declared gesture action without reading static data from its event. */
function resolveLatestGestureOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!occurrence.name.startsWith(GESTURE_ACTION_PREFIX)) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Converts one declared gesture action into a semantic or native gesture name. */
function resolveGestureName(
  actionName: string | undefined,
  stateGesture: string | null | undefined,
  initialGesture: string | null | undefined,
): string | null {
  if (actionName === RELEASE_ACTION) return null
  if (actionName?.startsWith(GESTURE_ACTION_PREFIX)) {
    return actionName.slice(GESTURE_ACTION_PREFIX.length) || null
  }
  return stateGesture ?? initialGesture ?? null
}

/** Resolves an optional motion duration without constraining its authored range. */
function resolveDuration(
  actionDuration: unknown,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number | undefined {
  if (typeof actionDuration === 'number' && Number.isFinite(actionDuration)) return Math.max(0, actionDuration)
  if (typeof stateDuration === 'number' && Number.isFinite(stateDuration)) return Math.max(0, stateDuration)
  if (typeof initialDuration === 'number' && Number.isFinite(initialDuration)) return Math.max(0, initialDuration)
  return undefined
}

/** Registers one component-owned semantic gesture stream on the CodPlay clock. */
function createMotionAnimation(
  sample: (timeMs: number) => AvatarGestureFrame,
  startAt: number,
  durationMs: number,
  target: AvatarTarget,
  seed: number,
): ComponentAnimation {
  return {
    id: 'avatar-gesture-motion',
    startAt,
    endAt: startAt + durationMs,
    sample: (timeMs) => {
      const frame = sample(timeMs - startAt)
      return {
        value: frame,
        apply: () => target.applyGestureMotion(frame, seed),
      }
    },
  }
}

/** Derives a repeatable seed when a gesture is supplied as stable initial data. */
function stableSeed(gesture: string | null): number {
  if (gesture === null) return 0
  let hash = 2_166_136_261
  for (const character of gesture) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}
