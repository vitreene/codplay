import { MOOD_BASELINES } from '@codplay/avatar-engine'
import type { MoodName } from '@codplay/avatar-engine'
import type { AvatarMorphs } from './avatar-types'

/** Every baseline key that can be changed by an Avatar mood. */
export const AVATAR_MOOD_MORPH_KEYS = Array.from(new Set(
  Object.values(MOOD_BASELINES).flatMap((baseline) => Object.keys(baseline)),
))

/** Expands one named mood into a complete baseline layer with explicit zeroes. */
export function createAvatarMoodMorphs(mood: MoodName): AvatarMorphs {
  const baseline = MOOD_BASELINES[mood]
  const morphs: Record<string, number> = {}
  for (const key of AVATAR_MOOD_MORPH_KEYS) morphs[key] = baseline[key] ?? 0
  return morphs
}

/** Returns true when a value belongs to the stable Avatar mood vocabulary. */
export function isAvatarMoodName(value: unknown): value is MoodName {
  return typeof value === 'string' && value in MOOD_BASELINES
}
