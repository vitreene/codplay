import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import type { MoodName } from '@codplay/avatar-engine'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from './avatar-coordinator'
import type { AvatarMoodInitial } from './avatar-types'
import type { AvatarMorphs } from './avatar-types'
import { createAvatarMoodMorphs, isAvatarMoodName } from './avatar-mood-profile'

type MoodTransition = Readonly<{
  from: AvatarMorphs
  to: AvatarMorphs
  startAt: number
  endAt: number
}>

/** Converts ordinary mood eventimes into timeline-driven baseline transitions. */
export class AvatarMoodComponent extends AvatarFeatureComponent<AvatarMoodInitial> {
  static readonly declaredServices = [] as const

  private appliedMood: AvatarMorphs
  private lastTimeMs: number | undefined

  /** Starts one component with the authored initial mood as its baseline. */
  constructor(input: ConstructorParameters<typeof AvatarFeatureComponent<AvatarMoodInitial>>[0]) {
    super(input)
    this.appliedMood = createAvatarMoodMorphs(this.perso.initial.mood ?? 'neutral')
  }

  /** Resolves the latest mood event and registers its local baseline transition. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarMoodInitial>): void {
    if (this.lastTimeMs !== undefined && input.timeMs < this.lastTimeMs) {
      this.appliedMood = createAvatarMoodMorphs(this.perso.initial.mood ?? 'neutral')
    }
    this.lastTimeMs = input.timeMs

    const occurrence = resolveLatestMoodOccurrence(input.activeActions)
    const mood = resolveMood(occurrence?.action, input.state.mood, this.perso.initial.mood)
    const transition = createMoodTransition(
      this.appliedMood,
      createAvatarMoodMorphs(mood),
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
    if (!Object.prototype.hasOwnProperty.call(occurrence.action, 'mood')) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Resolves the supported mood carried by an ordinary event or state update. */
function resolveMood(
  action: Record<string, unknown> | undefined,
  stateMood: MoodName | undefined,
  initialMood: MoodName | undefined,
): MoodName {
  if (action !== undefined && isAvatarMoodName(action.mood)) return action.mood
  if (isAvatarMoodName(stateMood)) return stateMood
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
  for (const name of Object.keys(transition.to)) {
    const from = transition.from[name] ?? 0
    const to = transition.to[name] ?? 0
    morphs[name] = from + (to - from) * eased
  }
  return morphs
}
