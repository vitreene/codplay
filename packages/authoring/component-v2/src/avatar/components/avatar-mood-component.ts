import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import { MOOD_BASELINES, type MoodName } from '../mood/expression-engine'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarMorphs, AvatarTarget } from '../runtime/avatar-target'
import type { AvatarMoodInitial } from './avatar-types'

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

  private appliedMood: AvatarMorphs
  private lastTimeMs: number | undefined

  /** Starts one component with the authored initial mood as its baseline. */
  constructor(input: ConstructorParameters<typeof AvatarFeatureComponent<AvatarMoodInitial>>[0]) {
    super(input)
    this.appliedMood = { ...MOOD_BASELINES[this.perso.initial.mood ?? 'neutral'] }
  }

  /** Resolves the latest mood event and registers its local baseline transition. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarMoodInitial>): void {
    if (this.lastTimeMs !== undefined && input.timeMs < this.lastTimeMs) {
      this.appliedMood = { ...MOOD_BASELINES[this.perso.initial.mood ?? 'neutral'] }
    }
    this.lastTimeMs = input.timeMs

    const occurrence = resolveLatestMoodOccurrence(input.activeActions)
    const mood = resolveMood(
      occurrence?.name,
      input.state.mood,
      this.perso.initial.mood,
    )
    const transition = createMoodTransition(
      this.appliedMood,
      { ...MOOD_BASELINES[mood] },
      occurrence?.startAt ?? input.timeMs,
      resolveDuration(occurrence?.action?.durationMs, input.state.durationMs, this.perso.initial.durationMs),
    )
    const animation = createAnimation(transition, target, (morphs) => {
      this.appliedMood = morphs
    })
    if (input.registerAnimation !== undefined) {
      input.registerAnimation(animation)
      return
    }

    animation.sample(input.timeMs)?.apply()
  }
}

/** Selects the latest ordinary mood occurrence without creating a cue store. */
function resolveLatestMoodOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!isMoodAction(occurrence)) continue
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

/** Registers a component-owned mood stream and forwards each sample to Three. */
function createAnimation(
  transition: MoodTransition,
  target: AvatarTarget,
  remember: (morphs: AvatarMorphs) => void,
): ComponentAnimation {
  return {
    id: 'avatar-mood',
    startAt: transition.startAt,
    endAt: transition.endAt,
    sample: (timeMs) => {
      const morphs = sampleTransition(transition, timeMs)
      return {
        value: morphs,
        apply: () => {
          remember(morphs)
          target.applyMood(morphs)
        },
      }
    },
  }
}

/** Samples a smoothstep mood transition at one absolute CodPlay time. */
function sampleTransition(transition: MoodTransition, timeMs: number): AvatarMorphs {
  const durationMs = transition.endAt - transition.startAt
  if (durationMs === 0) return { ...transition.to }

  const progress = Math.max(0, Math.min(1, (timeMs - transition.startAt) / durationMs))
  const eased = progress * progress * (3 - 2 * progress)
  const morphs: Record<string, number> = {}
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)])
  for (const name of names) {
    const from = transition.from[name] ?? 0
    const to = transition.to[name] ?? 0
    morphs[name] = from + (to - from) * eased
  }
  return morphs
}
