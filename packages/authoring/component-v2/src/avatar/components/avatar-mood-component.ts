import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { MOOD_BASELINES } from '../mood/mood-baselines'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type {
  AvatarMoodInitial,
  AvatarMorphs,
  AvatarTarget,
  AvatarTimeline,
  MoodName,
} from '../avatar-types'
import { sampleTalkingHeadEasing } from '../avatar-easing'

type MoodTransition = Readonly<{
  from: AvatarMorphs
  to: AvatarMorphs
  startAt: number
  endAt: number
}>

const MOOD_ACTION_PREFIX = 'avatar:mood:'

/** Converts ordinary mood eventimes into timeline-driven baseline transitions. */
export class AvatarMoodComponent extends AvatarFeatureComponent<AvatarMoodInitial> {
  static readonly declaredServices = [] as const

  /** Resolves the mood history into one pure absolute-time transition. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarMoodInitial>): void {
    const occurrence = resolveLatestMoodOccurrence(input.activeActions)
    const previous = resolveLatestMoodOccurrence(input.activeActions, occurrence?.startAt)
    const mood = resolveMood(
      occurrence?.name,
      input.state.mood,
      this.perso.initial.mood,
    )
    const previousMood = resolveMood(
      previous?.name,
      undefined,
      this.perso.initial.mood,
    )
    target.setMood?.(mood)
    const transition = createMoodTransition(
      { ...MOOD_BASELINES[previousMood] },
      { ...MOOD_BASELINES[mood] },
      occurrence?.startAt ?? input.timeMs,
      resolveDuration(occurrence?.action?.durationMs, input.state.durationMs, this.perso.initial.durationMs),
    )
    target.setTimeline('mood', createAnimation(transition, target))
  }
}

/** Selects the latest ordinary mood occurrence without creating a cue store. */
function resolveLatestMoodOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
  beforeStartAt = Number.POSITIVE_INFINITY,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!isMoodAction(occurrence)) continue
    if (occurrence.startAt >= beforeStartAt) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Identifies a declared mood action by its stable action name. */
function isMoodAction(occurrence: ComponentActionOccurrence): boolean {
  return occurrence.name.startsWith(MOOD_ACTION_PREFIX)
}

/** Resolves the supported mood carried by the action name or component state. */
function resolveMood(
  actionName: string | undefined,
  stateMood: MoodName | undefined,
  initialMood: MoodName | undefined,
): MoodName {
  if (actionName?.startsWith(MOOD_ACTION_PREFIX)) {
    const mood = actionName.slice(MOOD_ACTION_PREFIX.length)
    if (mood in MOOD_BASELINES) return mood as MoodName
  }
  if (stateMood !== undefined && stateMood in MOOD_BASELINES) return stateMood
  return initialMood ?? 'neutral'
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

/** Creates one absolute-time mood transition from the present baseline. */
function createMoodTransition(
  from: AvatarMorphs,
  to: AvatarMorphs,
  startAt: number,
  durationMs: number,
): MoodTransition {
  return {
    from: { ...from },
    to: { ...to },
    startAt,
    endAt: startAt + durationMs,
  }
}

/** Creates a mood stream consumed by Avatar's central presentation. */
function createAnimation(
  transition: MoodTransition,
  target: AvatarTarget,
): AvatarTimeline {
  return {
    id: 'avatar-mood',
    startAt: transition.startAt,
    endAt: transition.endAt,
    sample: (timeMs) => {
      const morphs = sampleTransition(transition, timeMs)
      return {
        value: morphs,
        apply: () => {
          target.applyMood(morphs)
        },
      }
    },
  }
}

/** Samples a TalkingHead-eased mood transition at one absolute CodPlay time. */
function sampleTransition(transition: MoodTransition, timeMs: number): AvatarMorphs {
  const durationMs = transition.endAt - transition.startAt
  if (durationMs === 0) return { ...transition.to }

  const progress = Math.max(0, Math.min(1, (timeMs - transition.startAt) / durationMs))
  const eased = sampleTalkingHeadEasing(progress)
  const morphs: Record<string, number> = {}
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)])
  for (const name of names) {
    const from = transition.from[name] ?? 0
    const to = transition.to[name] ?? 0
    morphs[name] = from + (to - from) * eased
  }
  return morphs
}
