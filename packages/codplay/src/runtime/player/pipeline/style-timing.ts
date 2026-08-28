import { prepareTween } from 'ace'
import { isPlainRecord } from '../../../shared'
import type { CompiledValue } from '../../../scene/compiled'

/** One normalized timing declaration used by the canonical style resolver. */
export type StyleTweenTiming = Readonly<{
  duration: number
  delay: number
  ease: string
}>

/**
 * Resolves the timing carried by one style tween through the same ACE defaults
 * and validation used when the player resolves its value.
 */
export function resolveStyleTweenTiming(value: CompiledValue | undefined): StyleTweenTiming | undefined {
  if (!isPlainRecord(value) || !('to' in value)) return undefined

  const tween = prepareTween({
    from: 0,
    to: 1,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    delay: typeof value.delay === 'number' ? value.delay : undefined,
    ease: typeof value.ease === 'string' ? value.ease : undefined,
  })
  return Object.freeze({
    duration: tween.duration,
    delay: tween.delay,
    ease: typeof value.ease === 'string' ? value.ease : 'out(2)',
  })
}
