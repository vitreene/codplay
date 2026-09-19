import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
} from 'codplay'
import { AvatarFeatureComponent } from './avatar-feature-component'
import type { AvatarTarget } from './avatar-coordinator'
import type { AvatarMorphs } from './avatar-types'
import type { AvatarLipSyncInitial } from './avatar-types'

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

type MorphTransition = Readonly<{
  from: AvatarMorphs
  to: AvatarMorphs
  startAt: number
  endAt: number
}>

/** Converts each ordinary viseme event into a component-owned morph transition. */
export class AvatarLipSyncComponent extends AvatarFeatureComponent<AvatarLipSyncInitial> {
  static readonly declaredServices = [] as const

  private appliedMorphs: AvatarMorphs = createEmptyMorphs()

  /** Reads the latest event and registers its transition on the CodPlay clock. */
  protected contribute(target: AvatarTarget, input: ComponentUpdateInput<AvatarLipSyncInitial>): void {
    const occurrence = resolveLatestVisemeOccurrence(input.activeActions)
    const action = occurrence?.action
    const viseme = resolveViseme(action, input.state.viseme)
    const weight = resolveNumber(action?.weight, input.state.weight, 1)
    const durationMs = resolveDuration(
      action?.durationMs,
      input.state.durationMs,
      this.perso.initial.durationMs,
    )
    const transition = createMorphTransition(
      this.appliedMorphs,
      resolveVisemeMorphs(viseme, weight),
      occurrence?.startAt ?? input.timeMs,
      durationMs,
    )

    const animation = createAnimation(transition, target, (morphs) => {
      this.appliedMorphs = morphs
    })
    if (input.registerAnimation !== undefined) {
      input.registerAnimation(animation)
      return
    }

    const frame = animation.sample(input.timeMs)
    frame?.apply()
  }
}

/** Selects the latest ordinary viseme occurrence without replaying a cue list. */
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

/** Resolves the canonical viseme carried by one ordinary event. */
function resolveViseme(
  action: Record<string, unknown> | undefined,
  stateViseme: string | null | undefined,
): string | null {
  if (action !== undefined && Object.prototype.hasOwnProperty.call(action, 'viseme')) {
    return typeof action.viseme === 'string' ? action.viseme : null
  }
  return typeof stateViseme === 'string' ? stateViseme : null
}

/** Resolves the transition duration from event data, component state or initial data. */
function resolveDuration(
  actionDuration: unknown,
  stateDuration: number | undefined,
  initialDuration: number | undefined,
): number {
  return resolveNumber(actionDuration, stateDuration, initialDuration ?? 0)
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

/** Creates the zero-valued morph layer used as the transition baseline. */
function createEmptyMorphs(): Record<string, number> {
  const morphs: Record<string, number> = {}
  for (const profile of Object.values(AVATAR_VISEME_PROFILES)) {
    morphs[profile.morph] = 0
  }
  return morphs
}

/** Creates one absolute-time transition from the currently applied morphs. */
function createMorphTransition(
  from: AvatarMorphs,
  to: AvatarMorphs,
  startAt: number,
  durationMs: number,
): MorphTransition {
  return {
    from: { ...from },
    to: { ...to },
    startAt,
    endAt: startAt + Math.max(0, durationMs),
  }
}

/** Registers the component-owned transition and forwards each sample to Avatar Three. */
function createAnimation(
  transition: MorphTransition,
  target: AvatarTarget,
  remember: (morphs: AvatarMorphs) => void,
): ComponentAnimation {
  return {
    id: 'avatar-lip-sync',
    startAt: transition.startAt,
    endAt: transition.endAt,
    sample: (timeMs) => {
      const morphs = sampleTransition(transition, timeMs)
      return {
        value: morphs,
        apply: () => {
          remember(morphs)
          target.applyMorphs(morphs)
        },
      }
    },
  }
}

/** Samples a linear transition from the previous morph state to the new state. */
function sampleTransition(transition: MorphTransition, timeMs: number): AvatarMorphs {
  const durationMs = transition.endAt - transition.startAt
  if (durationMs === 0) return { ...transition.to }

  const progress = Math.max(0, Math.min(1, (timeMs - transition.startAt) / durationMs))
  const morphs: Record<string, number> = {}
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)])
  for (const name of names) {
    const from = transition.from[name] ?? 0
    const to = transition.to[name] ?? 0
    morphs[name] = from + (to - from) * progress
  }
  return morphs
}
