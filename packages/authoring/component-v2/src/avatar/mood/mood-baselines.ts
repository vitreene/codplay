/**
 * Avatar mood baselines.
 *
 * The coordinator owns when these values are applied. This module only
 * combines the native TalkingHead values with the external motion catalogue.
 */
import {
  AVATAR_MOOD_MOTION_NAMES,
  getAvatarMoodBaseline,
} from '../gesture/motion-catalog.js'
import { TH_MOOD_BASELINES } from '../idle/th-mood-data.js'
import type { MoodBaseline, MoodName } from '../avatar-types.js'

/** Merges external semantic mood baselines with the native Avatar values. */
function createMoodBaselines(): Record<MoodName, MoodBaseline> {
  const external = Object.fromEntries(
    AVATAR_MOOD_MOTION_NAMES.map((name) => [name, getAvatarMoodBaseline(name) ?? {}]),
  ) as Record<string, MoodBaseline>
  return {
    ...external,
    ...TH_MOOD_BASELINES,
  } as Record<MoodName, MoodBaseline>
}

/** Baselines available to the avatar-mood component and coordinator. */
export const MOOD_BASELINES: Record<MoodName, MoodBaseline> = createMoodBaselines()
