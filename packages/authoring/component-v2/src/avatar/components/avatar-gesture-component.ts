import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type {
  AvatarGestureHistoryEvent,
  AvatarGestureInitial,
  AvatarTarget,
  AvatarTimeline,
} from '../avatar-types'
import { getAvatarActionMotion, getAvatarEmojiMotion } from '../gesture/motion-catalog'
import type { AvatarGestureFrame } from '../avatar-types'
import { hasGestureTemplate } from '../gesture/gesture-definitions'
import { sampleTalkingHeadEasing } from '../avatar-easing'

const GESTURE_ACTION_PREFIX = 'avatar:gesture:'
const RELEASE_ACTION = `${GESTURE_ACTION_PREFIX}release`
const HANDOFF_MS = 250

type GestureAction = Readonly<{
  startAt: number
  seed: number
  sample: (timeMs: number) => AvatarGestureFrame
  semanticEvents: readonly AvatarGestureHistoryEvent[]
}>

type GestureState = Pick<AvatarGestureInitial, 'gesture' | 'seed' | 'mirror' | 'durationMs'>

/** Contributes one gesture selection to the Avatar coordinator. */
export class AvatarGestureComponent extends AvatarFeatureComponent<AvatarGestureInitial> {
  static readonly declaredServices = [] as const

  /** Stores the selected gesture and derives a stable replay seed from its occurrence. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarGestureInitial>): void {
    const occurrences = (input.activeActions ?? [])
      .filter((occurrence) => occurrence.name.startsWith(GESTURE_ACTION_PREFIX))
      .sort((left, right) => left.startAt - right.startAt)
    const actions = [
      createGestureAction(
        undefined,
        occurrences.length === 0 ? input.state : this.perso.initial,
        this.perso.initial,
      ),
      ...occurrences.map((occurrence) => createGestureAction(
        occurrence, input.state, this.perso.initial,
      )),
    ]
    target.setGestureHistory?.(resolveGestureHistory(actions))
    target.setTimeline('gesture', createGestureTimeline(actions, target))
  }
}

/** Resolves one authored event into a deterministic gesture sampler. */
function createGestureAction(
  occurrence: ComponentActionOccurrence | undefined,
  state: GestureState,
  initial: AvatarGestureInitial,
): GestureAction {
  const gesture = resolveGestureName(occurrence?.name, state.gesture, initial.gesture)
  const seed = state.seed ?? stableSeed(occurrence?.eventId ?? gesture)
  const mirror = resolveMirror(occurrence?.action, state.mirror, initial.mirror)
  const startAt = occurrence?.startAt ?? 0
  if (gesture === null) {
    return {
      startAt,
      seed,
      sample: () => emptyGestureFrame(mirror, true),
      semanticEvents: [{ kind: 'gesture', name: null, startAt, seed, mirror }],
    }
  }
  const motion = resolveMotion(
    gesture,
    seed,
    resolveDuration(occurrence?.action.durationMs, state.durationMs, initial.durationMs),
  )
  if (motion !== undefined) {
    return {
      startAt,
      seed,
      sample: (timeMs) => motion.sample(timeMs - startAt),
      semanticEvents: motion.semanticEvents.map((event) => ({
        ...event,
        startAt: startAt + event.startAt,
        seed,
      })),
    }
  }
  const durationMs = hasGestureTemplate(gesture)
    ? resolveNativeDuration(occurrence?.action.durationMs, state.durationMs, initial.durationMs)
    : 0
  return {
    startAt,
    seed,
    semanticEvents: [
      { kind: 'gesture', name: gesture, startAt, seed, mirror },
      { kind: 'gesture', name: null, startAt: startAt + durationMs, seed, mirror },
    ],
    sample: (timeMs) => {
      const active = timeMs < startAt + durationMs
      return {
        ...emptyGestureFrame(mirror, !active),
        gesture: active ? gesture : null,
        gestureStartMs: active ? 0 : durationMs,
      }
    },
  }
}

/** Truncates superseded skeletal commands at the next authored action. */
function resolveGestureHistory(actions: readonly GestureAction[]): readonly AvatarGestureHistoryEvent[] {
  const events: AvatarGestureHistoryEvent[] = []
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index]!
    const nextStartAt = actions[index + 1]?.startAt ?? Number.POSITIVE_INFINITY
    if (index > 0) {
      events.push({
        kind: 'gesture', name: null, startAt: action.startAt,
        seed: action.seed, mirror: false,
      })
      events.push({
        kind: 'pose', name: null, startAt: action.startAt,
        seed: action.seed, mirror: false,
      })
    }
    for (const event of action.semanticEvents) {
      if (event.startAt >= nextStartAt) continue
      events.push(event)
    }
  }
  return events.sort((left, right) => left.startAt - right.startAt)
}

/** Samples each gesture from its authored history, including interrupted handoffs. */
function createGestureTimeline(actions: readonly GestureAction[], target: AvatarTarget): AvatarTimeline {
  const first = actions[0]!
  return {
    id: 'avatar-gesture-history',
    startAt: first.startAt,
    endAt: Number.POSITIVE_INFINITY,
    sample: (timeMs) => {
      let index = 0
      for (let next = 1; next < actions.length; next += 1) {
        if (actions[next]!.startAt > timeMs) break
        index = next
      }
      const action = actions[index]!
      const frame = sampleGestureHistory(actions, index, timeMs)
      return {
        value: frame,
        apply: () => target.applyGestureMotion(
          frame,
          action.seed,
          resolveGestureStartAt(frame, action.startAt),
          action.startAt,
        ),
      }
    },
  }
}

/** Keeps the previous absolute morph value while a new action takes ownership. */
function sampleGestureHistory(
  actions: readonly GestureAction[],
  index: number,
  timeMs: number,
): AvatarGestureFrame {
  const action = actions[index]!
  const frame = action.sample(timeMs)
  if (index === 0 || timeMs >= action.startAt + HANDOFF_MS) return frame
  const previous = sampleGestureHistory(actions, index - 1, action.startAt)
  if (previous.released && frame.released) return frame
  const progress = sampleTalkingHeadEasing((timeMs - action.startAt) / HANDOFF_MS)
  const previousMorphs = previous.released ? {} : previous.morphs
  const names = new Set([...Object.keys(previousMorphs), ...Object.keys(frame.morphs)])
  const morphs: Record<string, number> = {}
  const morphWeights: Record<string, number> = {}
  for (const name of names) {
    const from = previousMorphs[name] ?? 0
    const to = frame.morphs[name] ?? 0
    morphs[name] = from + (to - from) * progress
    const previousWeight = typeof previousMorphs[name] === 'number'
      ? previous.morphWeights?.[name] ?? previous.morphWeight ?? 1
      : 0
    const nextWeight = typeof frame.morphs[name] === 'number' && !frame.released
      ? frame.morphWeights?.[name] ?? frame.morphWeight ?? 1
      : 0
    morphWeights[name] = previousWeight + (nextWeight - previousWeight) * progress
  }
  return {
    ...frame,
    morphs,
    morphWeights,
    morphWeight: (previous.released ? 0 : previous.morphWeight ?? 1) * (1 - progress)
      + (frame.released ? 0 : frame.morphWeight ?? 1) * progress,
    released: frame.released && progress >= 1,
  }
}

/** Creates the neutral gesture contribution used by a release or timeout. */
function emptyGestureFrame(mirror: boolean, released: boolean): AvatarGestureFrame {
  return {
    morphs: {},
    gesture: null,
    gestureStartMs: 0,
    mirror,
    overlay: null,
    handTargets: [],
    released,
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

/** Starts a native gesture at the motion occurrence, except when releasing. */
function resolveGestureStartAt(frame: AvatarGestureFrame, actionStartAt: number): number {
  return frame.released ? actionStartAt + frame.gestureStartMs : actionStartAt
}

/** Derives a repeatable seed when a gesture is supplied as stable initial data. */
function stableSeed(gesture: string | null): number {
  if (gesture === null) return 0
  let hash = 2_166_136_261
  for (const character of gesture) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}
