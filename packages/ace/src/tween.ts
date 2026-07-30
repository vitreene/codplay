import { parseEase, type EasingFunction } from './easings'
import {
  prepareInterval,
  resolveInterval,
  type InterpolationValue,
  type Interval,
} from './interval'

/** Declaration temporelle d'un intervalle ACE. */
export type TweenInput = Readonly<{
  from: InterpolationValue
  to: InterpolationValue
  duration?: number
  delay?: number
  loop?: boolean | number
  loopDelay?: number
  reversed?: boolean
  alternate?: boolean
  ease?: string | EasingFunction
}>

/** Tween prepare, autonome et sans horloge. */
export type Tween = Readonly<{
  interval: Interval
  duration: number
  delay: number
  iterationCount: number
  loopDelay: number
  reversed: boolean
  alternate: boolean
  ease: EasingFunction
  totalDuration: number
}>

const DEFAULT_DURATION = 1000
const DEFAULT_EASE = 'out(2)'

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value

/**
 * Converts anime's loop option into the total number of iterations.
 */
const resolveIterationCount = (loop: boolean | number | undefined): number => {
  if (loop === true || loop === Infinity || (typeof loop === 'number' && loop < 0)) return Infinity
  return typeof loop === 'number' ? loop + 1 : 1
}

/**
 * Prepares an anime-compatible temporal interval without creating a clock or target.
 */
export const prepareTween = (input: TweenInput): Tween => {
  const duration = input.duration ?? DEFAULT_DURATION
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('ace: duration doit etre un nombre strictement positif')
  }

  const delay = input.delay ?? 0
  const loopDelay = input.loopDelay ?? 0
  const iterationCount = resolveIterationCount(input.loop)
  const totalDuration = iterationCount === Infinity
    ? Infinity
    : (duration + loopDelay) * iterationCount - loopDelay
  const ease = typeof input.ease === 'function' ? input.ease : parseEase(input.ease ?? DEFAULT_EASE)

  return {
    interval: prepareInterval(input.from, input.to),
    duration,
    delay,
    iterationCount,
    loopDelay,
    reversed: input.reversed ?? false,
    alternate: input.alternate ?? false,
    ease,
    totalDuration,
  }
}

/**
 * Resolves the eased progress at an instant measured from the tween's start.
 */
export const resolveTweenProgress = (tween: Tween, instant: number): number => {
  const elapsed = instant - tween.delay
  const clampedElapsed = clamp(elapsed, -tween.delay, tween.totalDuration)
  const isComplete = clampedElapsed >= tween.totalDuration
  let iteration = 0
  let iterationElapsed = clampedElapsed

  if (tween.iterationCount > 1) {
    const period = tween.duration + (isComplete ? 0 : tween.loopDelay)
    iteration = clamp(Math.floor(clampedElapsed / period), 0, tween.iterationCount)
    if (isComplete) iteration--
    iterationElapsed = clampedElapsed - iteration * period || 0
  }

  const reversed = tween.reversed !== (tween.alternate && iteration % 2 === 1)
  const iterationTime = isComplete
    ? reversed ? 0 : tween.duration
    : reversed ? tween.duration - iterationElapsed : iterationElapsed
  const rawProgress = clamp(iterationTime, 0, tween.duration) / tween.duration
  return tween.ease(rawProgress)
}

/**
 * Resolves a prepared tween at a bare instant.
 */
export const resolveTween = (tween: Tween, instant: number): InterpolationValue =>
  resolveInterval(tween.interval, resolveTweenProgress(tween, instant))
