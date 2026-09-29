import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { MOOD_BASELINES } from '../mood/mood-baselines'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type {
  AvatarMoodInitial,
  AvatarMoodOccurrence,
  AvatarMorphs,
  AvatarTarget,
  AvatarTimeline,
  MoodName,
} from '../avatar-types'
import { sampleTalkingHeadEasing } from '../avatar-easing'
import { createAvatarBlinkSchedule } from '../idle/avatar-idle-schedule'

type MoodTransition = Readonly<{
  from: AvatarMorphs
  to: AvatarMorphs
  startAt: number
  endAt: number
}>

type MoodInstruction = Readonly<{
  eventId: string | undefined
  name: string
  startAt: number
  durationMs: number
}>

const MOOD_ACTION_PREFIX = 'avatar:mood:'

/** Converts mood eventimes into their complete TalkingHead presentation. */
export class AvatarMoodComponent extends AvatarFeatureComponent<AvatarMoodInitial> {
  static readonly declaredServices = [] as const
  private configuredTarget: AvatarTarget | undefined
  private activeTarget: AvatarTarget | undefined
  private initialMood: MoodName | undefined
  private transition: MoodTransition | undefined
  private instructions: readonly MoodInstruction[] = []
  private lastUpdateTimeMs: number | undefined

  /** Resolves the mood history and configures its spontaneous TH channels. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarMoodInitial>): void {
    this.configurePresentation(target)
    const authoredInitialMood = this.perso.initial.mood ?? 'neutral'
    const occurrences = resolveMoodOccurrences(input.activeActions, input.timeMs)
    const latest = occurrences.at(-1)
    const mood = resolveMood(latest?.name, input.state.mood, authoredInitialMood)
    const initialMood = occurrences.length === 0 ? mood : authoredInitialMood
    const moodBaselines = this.perso.initial.moods
    const instructions = occurrences.map((occurrence) => ({
      eventId: occurrence.eventId,
      name: occurrence.name,
      startAt: occurrence.startAt,
      durationMs: resolveDuration(
        occurrence.action.durationMs,
        occurrence === latest ? input.state.durationMs : undefined,
        this.perso.initial.durationMs,
      ),
    }))
    const moodHistory: AvatarMoodOccurrence[] = [
      createMoodOccurrence(initialMood, 0, moodBaselines),
      ...occurrences.map((occurrence) => createMoodOccurrence(
        resolveMood(occurrence.name, undefined, authoredInitialMood),
        occurrence.startAt,
        moodBaselines,
      )),
    ]
    const canContinue = this.activeTarget === target
      && this.initialMood === initialMood
      && this.lastUpdateTimeMs !== undefined
      && input.timeMs >= this.lastUpdateTimeMs
      && this.instructions.length <= instructions.length
      && this.instructions.every((instruction, index) => sameMoodInstruction(instruction, instructions[index]!))
    let transition = canContinue ? this.transition : undefined
    if (transition === undefined) {
      const baseline = resolveMoodBaseline(initialMood, moodBaselines)
      transition = createMoodTransition(baseline, baseline, 0, 0)
    }
    for (let index = canContinue ? this.instructions.length : 0; index < instructions.length; index += 1) {
      const instruction = instructions[index]!
      const nextMood = resolveMood(instruction.name, undefined, authoredInitialMood)
      transition = createMoodTransition(
        sampleTransition(transition, instruction.startAt),
        resolveMoodBaseline(nextMood, moodBaselines),
        instruction.startAt,
        instruction.durationMs,
      )
    }
    const transitionChanged = transition !== this.transition || target !== this.activeTarget
    this.transition = transition
    this.instructions = instructions
    this.initialMood = initialMood
    this.activeTarget = target
    this.lastUpdateTimeMs = input.timeMs
    if (target.setMoodHistory !== undefined) {
      target.setMoodHistory(moodHistory)
    } else {
      target.setMood?.(mood, latest?.startAt ?? 0)
    }
    if (transitionChanged) target.setTimeline('mood', createAnimation(transition, target))
  }

  /** Installs the authored mood presentation once for each selected Avatar. */
  private configurePresentation(target: AvatarTarget): void {
    if (this.configuredTarget === target) return
    const initial = this.perso.initial
    const seed = resolveSeed(initial.blinkSeed, this.perso.id)
    target.setBlinkSchedule(initial.blink === false ? null : createAvatarBlinkSchedule(seed))
    target.setIdleProfile({
      enabled: true,
      breathe: initial.breathe !== false,
      headMove: initial.headDrift !== false,
      seed,
      speakWithHands: initial.speakWithHands !== false,
      speakWithHandsProbability: initial.speakWithHandsProbability,
      poseChanges: initial.poseChanges !== false,
      pose: initial.pose ?? 'neutral',
    })
    this.configuredTarget = target
  }
}

/** Detects an unchanged received instruction without reading future actions. */
function sameMoodInstruction(left: MoodInstruction, right: MoodInstruction): boolean {
  return left.eventId === right.eventId
    && left.name === right.name
    && left.startAt === right.startAt
    && left.durationMs === right.durationMs
}

/** Resolves one persona expression while leaving the shared TH catalog intact. */
function resolveMoodBaseline(
  mood: MoodName,
  overrides: AvatarMoodInitial['moods'],
): AvatarMorphs {
  return { ...MOOD_BASELINES[mood], ...overrides?.[mood] }
}

/** Carries configured baseline values through mood history for Play and Seek. */
function createMoodOccurrence(
  mood: MoodName,
  startAt: number,
  overrides: AvatarMoodInitial['moods'],
): AvatarMoodOccurrence {
  return overrides?.[mood] === undefined
    ? { mood, startAt }
    : { mood, startAt, baseline: resolveMoodBaseline(mood, overrides) }
}

/** Uses an explicit seed or derives a repeatable one from the perso identity. */
function resolveSeed(value: number | undefined, persoId: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  let hash = 2_166_261
  for (const character of persoId) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return hash | 0
}

/** Orders due mood occurrences for deterministic reconstruction after seek. */
function resolveMoodOccurrences(
  actions: readonly ComponentActionOccurrence[] | undefined,
  timeMs: number,
): ComponentActionOccurrence[] {
  return (actions ?? [])
    .filter((occurrence) => isMoodAction(occurrence) && occurrence.startAt <= timeMs)
    .sort((left, right) => left.startAt - right.startAt)
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
  const eased = durationMs === 0
    ? 1
    : sampleTalkingHeadEasing((timeMs - transition.startAt) / durationMs)
  const morphs: Record<string, number> = {}
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)])
  for (const name of names) {
    const from = transition.from[name] ?? 0
    const to = transition.to[name] ?? 0
    morphs[name] = from + (to - from) * eased
  }
  return morphs
}
