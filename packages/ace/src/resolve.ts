import { resolveKeyframes, type Keyframes } from './keyframes'
import type { InterpolationValue } from './interval'
import { resolveTween, type Tween } from './tween'

/** An animation prepared by ACE's current temporal primitives. */
export type PreparedAnimation = Tween | Keyframes

const isKeyframes = (animation: PreparedAnimation): animation is Keyframes => 'frames' in animation

/**
 * Resolves a prepared batch in declaration order without assigning it to any property or target.
 */
export const resolve = (
  animations: readonly PreparedAnimation[],
  instant: number,
): InterpolationValue[] =>
  animations.map((animation) =>
    isKeyframes(animation)
      ? resolveKeyframes(animation, instant)
      : resolveTween(animation, instant),
  )
