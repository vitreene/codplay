import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarGestureInitial, AvatarTarget, AvatarTimeline } from '../avatar-types'
import { getAvatarActionMotion, getAvatarEmojiMotion } from '../gesture/motion-catalog'
import type { AvatarGestureFrame } from '../avatar-types'
import { hasGestureTemplate } from '../gesture/gesture-definitions'

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
    const mirror = resolveMirror(occurrence?.action, input.state.mirror, this.perso.initial.mirror)
    if (gesture === null) {
      target.setTimeline('gesture', createNativeGestureAnimation(
        null,
        seed,
        mirror,
        occurrence?.startAt ?? input.timeMs,
        0,
        target,
      ))
      return
    }

    const motion = resolveMotion(
      gesture,
      seed,
      resolveDuration(occurrence?.action.durationMs, input.state.durationMs, this.perso.initial.durationMs),
    )
    if (motion === undefined) {
      if (hasGestureTemplate(gesture)) {
        const startAt = occurrence?.startAt ?? 0
        const durationMs = resolveNativeDuration(
          occurrence?.action.durationMs,
          input.state.durationMs,
          this.perso.initial.durationMs,
        )
        const animation = createNativeGestureAnimation(
          gesture,
          seed,
          mirror,
          startAt,
          durationMs,
          target,
        )
        target.setTimeline('gesture', animation)
        return
      }
      target.setTimeline('gesture', createNativeGestureAnimation(
        gesture,
        seed,
        mirror,
        occurrence?.startAt ?? input.timeMs,
        0,
        target,
      ))
      return
    }

    const startAt = occurrence?.startAt ?? 0
    const animation = createMotionAnimation(motion.sample, startAt, motion.durationMs, target, seed)
    target.setTimeline('gesture', animation)
  }
}

/** Resolves a normal semantic gesture or one of TalkingHead's emoji aliases. */
function resolveMotion(
  name: string,
  seed: number,
  duration: number | undefined,
) {
  if (name.startsWith('emoji:')) {
    return getAvatarEmojiMotion(name.slice('emoji:'.length), seed, duration)
  }
  return getAvatarEmojiMotion(name, seed, duration) ?? getAvatarActionMotion(name, seed, duration)
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

/** Resolves the native TH hand-gesture hold, defaulting to three seconds. */
function resolveNativeDuration(
  actionDuration: unknown,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number {
  return resolveDuration(actionDuration, stateDuration, initialDuration) ?? 3_000
}

/** Resolves the optional mirror flag without changing the gesture identity. */
function resolveMirror(
  action: Record<string, unknown> | undefined,
  stateMirror: boolean | undefined,
  initialMirror: boolean | undefined,
): boolean {
  if (typeof action?.mirror === 'boolean') return action.mirror
  if (typeof stateMirror === 'boolean') return stateMirror
  return initialMirror === true
}

/** Sends one native gesture selection through the common sampled-frame path. */
function applyNativeGestureFrame(
  target: AvatarTarget,
  name: string | null,
  seed: number,
  startAt: number,
  timeMs: number,
  mirror: boolean,
): void {
  target.applyGestureMotion({
    morphs: {},
    gesture: name,
    gestureStartMs: 0,
    mirror,
    overlay: null,
    handTargets: [],
    released: name === null,
  }, seed, name === null ? timeMs : startAt, startAt)
}

/** Creates one semantic gesture stream for Avatar's central presentation. */
function createMotionAnimation(
  sample: (timeMs: number) => AvatarGestureFrame,
  startAt: number,
  durationMs: number,
  target: AvatarTarget,
  seed: number,
): AvatarTimeline {
  return {
    id: 'avatar-gesture-motion',
    startAt,
    endAt: startAt + durationMs,
    sample: (timeMs) => {
      const frame = sample(timeMs - startAt)
      return {
        value: frame,
        apply: () => target.applyGestureMotion(frame, seed, resolveGestureStartAt(frame, startAt), startAt),
      }
    },
  }
}

/** Starts a native gesture at the motion occurrence, except when releasing. */
function resolveGestureStartAt(frame: AvatarGestureFrame, actionStartAt: number): number {
  return frame.released ? actionStartAt + frame.gestureStartMs : actionStartAt
}

/** Holds a native TH hand gesture, then returns control to the active pose. */
function createNativeGestureAnimation(
  name: string | null,
  seed: number,
  mirror: boolean,
  startAt: number,
  durationMs: number,
  target: AvatarTarget,
): AvatarTimeline {
  const endAt = startAt + durationMs
  return {
    id: 'avatar-native-gesture',
    startAt,
    endAt: endAt + 1_000,
    sample: (timeMs) => {
      const active = timeMs < endAt
      return {
        value: { name: active ? name : null, startAt, mirror },
        apply: () => applyNativeGestureFrame(
          target,
          active ? name : null,
          seed,
          startAt,
          timeMs,
          mirror,
        ),
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
