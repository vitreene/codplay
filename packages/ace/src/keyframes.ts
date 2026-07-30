import type { EasingFunction } from './easings'
import type { InterpolationValue } from './interval'
import { prepareTween, resolveTween, type Tween } from './tween'

/** Une frame explicite d'une sequence temporelle. */
export type KeyframeInput = Readonly<{
  from: InterpolationValue
  to: InterpolationValue
  duration: number
  delay?: number
  ease?: string | EasingFunction
}>

/** Une frame preparee, placee sur l'axe temporel de sa sequence. */
export type Keyframe = Readonly<{
  tween: Tween
  start: number
  end: number
}>

/** Une sequence de frames precompilee et ordonnee. */
export type Keyframes = Readonly<{
  frames: readonly Keyframe[]
  totalDuration: number
}>

/**
 * Prepares explicit keyframes without accepting anime's shorthand array syntax.
 */
export const prepareKeyframes = (inputs: readonly KeyframeInput[]): Keyframes => {
  if (inputs.length === 0) throw new Error('ace: une sequence de keyframes doit contenir au moins une frame')

  let cursor = 0
  const frames = inputs.map((input) => {
    cursor += input.delay ?? 0
    const tween = prepareTween({
      from: input.from,
      to: input.to,
      duration: input.duration,
      ease: input.ease,
    })
    const frame = { tween, start: cursor, end: cursor + tween.totalDuration }
    cursor = frame.end
    return frame
  })
  return { frames, totalDuration: cursor }
}

/**
 * Resolves the active frame, holding the previous endpoint during frame delays.
 */
export const resolveKeyframes = (keyframes: Keyframes, instant: number): InterpolationValue => {
  const [first] = keyframes.frames
  if (instant <= first.start) return resolveTween(first.tween, 0)

  let previous = first
  for (const frame of keyframes.frames) {
    if (instant < frame.start) return resolveTween(previous.tween, previous.tween.totalDuration)
    if (instant <= frame.end) return resolveTween(frame.tween, instant - frame.start)
    previous = frame
  }
  return resolveTween(previous.tween, previous.tween.totalDuration)
}
