import type { BlinkScheduleFn } from '../avatar-types.js'

/** Deterministic idle schedules shared by Avatar components and the coordinator. */

import { sampleLoopedAlternatives } from './th-animation-template.js'
import { TH_MOOD_BASELINES, TH_MOOD_TEMPLATES } from './th-mood-data.js'

/** Creates a deterministic random blink schedule compatible with the Avatar clock. */
export function createAvatarBlinkSchedule(seed = 0): BlinkScheduleFn {
  return ({ elapsed, mood = 'neutral' }) => {
    if (!Number.isFinite(elapsed) || elapsed < 0) return { eyesClosed: 0 }
    const nativeMood = mood === 'sleeping' ? 'sleep' : mood
    if (!(nativeMood in TH_MOOD_TEMPLATES)) return { eyesClosed: 0 }
    if (nativeMood === 'sleep') return { eyesClosed: 1 }
    const key = nativeMood as keyof typeof TH_MOOD_TEMPLATES
    const values = sampleLoopedAlternatives(
      TH_MOOD_TEMPLATES[key].blink,
      elapsed,
      seed,
      TH_MOOD_BASELINES[key],
    )
    return { eyesClosed: values.eyeBlinkLeft ?? 0 }
  }
}
