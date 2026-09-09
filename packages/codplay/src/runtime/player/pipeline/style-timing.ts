import { prepareTween } from 'ace'
import { isPlainRecord } from '../../../shared'
import type { CompiledValue } from '../../../scene/compiled'

/** One normalized timing declaration used by the canonical style resolver. */
export type StyleTweenTiming = Readonly<{
  duration: number
  delay: number
  ease: string
  totalDuration: number
  loop?: boolean | number
  alternate?: boolean
}>

/**
 * Resolves the timing carried by one style tween through the same ACE defaults
 * and validation used when the player resolves its value.
 */
export function resolveStyleTweenTiming(value: CompiledValue | undefined): StyleTweenTiming | undefined {
  if (!isPlainRecord(value) || !('to' in value)) return undefined

  const loop = isLoopValue(value.loop) ? value.loop : undefined
  const alternate = value.alternate === true
  const tween = prepareTween({
    from: 0,
    to: 1,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    delay: typeof value.delay === 'number' ? value.delay : undefined,
    ...(loop === undefined ? {} : { loop }),
    alternate,
    ease: typeof value.ease === 'string' ? value.ease : undefined,
  })
  return Object.freeze({
    duration: tween.duration,
    delay: tween.delay,
    ease: typeof value.ease === 'string' ? value.ease : 'out(2)',
    totalDuration: tween.totalDuration,
    ...(loop === undefined ? {} : { loop }),
    ...(alternate ? { alternate: true } : {}),
  })
}

/** Accepts the finite or infinite loop forms supported by the ACE tween contract. */
function isLoopValue(value: unknown): value is boolean | number {
  return typeof value === 'boolean'
    || value === Infinity
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0)
}
