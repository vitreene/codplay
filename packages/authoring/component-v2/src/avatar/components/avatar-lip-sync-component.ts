import type {
  ComponentActionOccurrence,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type {
  AvatarLipSyncInitial,
  AvatarMorphs,
  AvatarTarget,
  AvatarTimeline,
} from '../avatar-types'
import { sampleTalkingHeadEasing } from '../avatar-easing.js'

/** Stable native morph and intensity correspondence for canonical visemes. */
export const AVATAR_VISEME_PROFILES: Readonly<Record<string, Readonly<{
  morph: string
  intensity: number
}>>> = {
  PP: { morph: 'viseme_PP', intensity: 0.9 },
  FF: { morph: 'viseme_FF', intensity: 0.9 },
  TH: { morph: 'viseme_TH', intensity: 0.6 },
  DD: { morph: 'viseme_DD', intensity: 0.6 },
  kk: { morph: 'viseme_kk', intensity: 0.6 },
  CH: { morph: 'viseme_CH', intensity: 0.6 },
  SS: { morph: 'viseme_SS', intensity: 0.6 },
  nn: { morph: 'viseme_nn', intensity: 0.6 },
  RR: { morph: 'viseme_RR', intensity: 0.6 },
  aa: { morph: 'viseme_aa', intensity: 0.6 },
  E: { morph: 'viseme_E', intensity: 0.6 },
  I: { morph: 'viseme_I', intensity: 0.6 },
  O: { morph: 'viseme_O', intensity: 0.6 },
  U: { morph: 'viseme_U', intensity: 0.6 },
  sil: { morph: 'viseme_sil', intensity: 0.6 },
}

/** Fallback cue duration used when an author sends only a punctual viseme. */
export const DEFAULT_VISEME_DURATION_MS = 150

/** Shortest visible attack and release for an event that cannot be anticipated. */
const MIN_VISEME_RAMP_MS = 60

type VisemeCue = Readonly<{
  morph: string
  value: number
  attackAt: number
  peakAt: number
  endAt: number
}>

/** Converts ordinary viseme events into an absolute-time morph stream. */
export class AvatarLipSyncComponent extends AvatarFeatureComponent<AvatarLipSyncInitial> {
  static readonly declaredServices = [] as const

  /** Projects all due viseme events onto the current Avatar morph frame. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarLipSyncInitial>): void {
    const cues = resolveVisemeCues(
      input.activeActions,
      input.state.durationMs ?? this.perso.initial.durationMs,
      input.state.weight ?? this.perso.initial.weight,
    )
    const latest = resolveLatestVisemeOccurrence(input.activeActions)
    const fallbackViseme = latest === undefined
      ? resolveViseme(undefined, input.state.viseme ?? this.perso.initial.viseme)
      : null
    const fallbackMorphs = resolveVisemeMorphs(
      fallbackViseme,
      resolveNumber(input.state.weight, this.perso.initial.weight, 1),
    )
    target.setTimeline('lip-sync', createAnimation(cues, fallbackMorphs, target))
  }
}

/** Selects the latest viseme to avoid restoring an initial cue after an action. */
function resolveLatestVisemeOccurrence(
  actions: readonly ComponentActionOccurrence[] | undefined,
): ComponentActionOccurrence | undefined {
  let latest: ComponentActionOccurrence | undefined
  for (const occurrence of actions ?? []) {
    if (!Object.prototype.hasOwnProperty.call(occurrence.action, 'viseme')) continue
    if (latest === undefined || occurrence.startAt >= latest.startAt) latest = occurrence
  }
  return latest
}

/** Resolves every punctual viseme event into its independent TH envelope. */
function resolveVisemeCues(
  actions: readonly ComponentActionOccurrence[] | undefined,
  defaultDuration: number | undefined,
  defaultWeight: number | undefined,
): readonly VisemeCue[] {
  const cues: VisemeCue[] = []
  for (const occurrence of actions ?? []) {
    if (!Object.prototype.hasOwnProperty.call(occurrence.action, 'viseme')) continue
    const viseme = resolveViseme(occurrence.action, null)
    const profile = viseme === null ? undefined : AVATAR_VISEME_PROFILES[viseme]
    if (profile === undefined) continue

    const duration = resolveDuration(
      occurrence.action.durationMs,
      undefined,
      defaultDuration,
    )
    const startAt = occurrence.startAt
    const rampMs = Math.max(MIN_VISEME_RAMP_MS, duration / 2)
    const peakAt = startAt + rampMs
    cues.push({
      morph: profile.morph,
      value: profile.intensity * resolveNumber(occurrence.action.weight, defaultWeight, 1),
      attackAt: startAt,
      peakAt,
      endAt: Math.max(startAt + duration, peakAt) + rampMs,
    })
  }
  return cues
}

/** Resolves the canonical viseme carried by one ordinary event or state. */
function resolveViseme(
  action: Record<string, unknown> | undefined,
  stateViseme: string | null | undefined,
): string | null {
  if (action !== undefined && Object.prototype.hasOwnProperty.call(action, 'viseme')) {
    return typeof action.viseme === 'string' ? action.viseme : null
  }
  return typeof stateViseme === 'string' ? stateViseme : null
}

/** Resolves one optional duration without imposing a policy on its scale. */
function resolveDuration(
  actionDuration: unknown,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number {
  return Math.max(0, resolveNumber(
    actionDuration,
    stateDuration,
    initialDuration ?? DEFAULT_VISEME_DURATION_MS,
  ))
}

/** Resolves one finite author number without imposing an artificial range. */
function resolveNumber(value: unknown, fallback: number | undefined, defaultValue: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return defaultValue
}

/** Converts one canonical viseme and its intensity into a complete morph pose. */
function resolveVisemeMorphs(viseme: string | null, weight: number): AvatarMorphs {
  const morphs = createEmptyMorphs()
  if (viseme === null) return morphs

  const profile = AVATAR_VISEME_PROFILES[viseme]
  if (profile === undefined) return morphs
  morphs[profile.morph] = profile.intensity * weight
  return morphs
}

/** Keeps jaw openings closed while the lip-sync track owns mouth articulation. */
function createEmptyMorphs(): Record<string, number> {
  const morphs: Record<string, number> = { jawOpen: 0, mouthOpen: 0 }
  for (const profile of Object.values(AVATAR_VISEME_PROFILES)) {
    morphs[profile.morph] = 0
  }
  return morphs
}

/** Creates one seekable stream consumed by Avatar's central presentation. */
function createAnimation(
  cues: readonly VisemeCue[],
  fallbackMorphs: AvatarMorphs,
  target: AvatarTarget,
): AvatarTimeline {
  return {
    id: 'avatar-lip-sync',
    startAt: 0,
    endAt: Number.POSITIVE_INFINITY,
    sample: (timeMs) => {
      const morphs = sampleVisemeCues(cues, fallbackMorphs, timeMs)
      return {
        value: morphs,
        apply: () => target.applyMorphs(morphs),
      }
    },
  }
}

/** Samples overlapping cue envelopes without cutting off an earlier release. */
function sampleVisemeCues(
  cues: readonly VisemeCue[],
  fallbackMorphs: AvatarMorphs,
  timeMs: number,
): AvatarMorphs {
  const morphs: Record<string, number> = { ...fallbackMorphs }
  for (const cue of cues) {
    if (timeMs < cue.attackAt || timeMs > cue.endAt) continue
    morphs[cue.morph] = Math.max(morphs[cue.morph] ?? 0, sampleVisemeCue(cue, timeMs))
  }
  return morphs
}

/** Samples the easing of one event from its observable start to its release. */
function sampleVisemeCue(cue: VisemeCue, timeMs: number): number {
  if (timeMs <= cue.attackAt) return 0
  if (timeMs <= cue.peakAt) {
    const progress = sampleTalkingHeadEasing(
      (timeMs - cue.attackAt) / (cue.peakAt - cue.attackAt),
    )
    return cue.value * progress
  }
  if (timeMs <= cue.endAt) {
    const progress = sampleTalkingHeadEasing(
      (timeMs - cue.peakAt) / (cue.endAt - cue.peakAt),
    )
    return cue.value * (1 - progress)
  }
  return 0
}
