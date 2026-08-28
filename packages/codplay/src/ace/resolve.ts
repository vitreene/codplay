import { resolveKeyframes, type Keyframes } from './keyframes'
import type { InterpolationValue } from './interval'
import { resolvePolarTween, type PolarTween } from './polar'
import { resolveTween, type Tween } from './tween'

/** An animation prepared by ACE's current temporal primitives. */
export type PreparedAnimation = Tween | Keyframes | PolarTween

const isKeyframes = (animation: PreparedAnimation): animation is Keyframes => 'frames' in animation
const isPolarTween = (animation: PreparedAnimation): animation is PolarTween => 'angle' in animation

/**
 * Resolves a prepared batch in declaration order without assigning it to any property or target.
 */
export const resolve = (
  animations: readonly PreparedAnimation[],
  instant: number,
): InterpolationValue[] =>
  animations.map((animation) =>
    isPolarTween(animation)
      ? resolvePolarTween(animation, instant)
      : isKeyframes(animation)
      ? resolveKeyframes(animation, instant)
      : resolveTween(animation, instant),
  )
