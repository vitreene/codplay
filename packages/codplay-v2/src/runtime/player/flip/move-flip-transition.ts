import { isPreparedPath, type Path } from '../../../ace'
import type { MoveTransition } from '../../config/move'

/** Transition shape consumed by a FLIP capture builder after preparation. */
export type PreparedMoveFlipTransition = Readonly<{
  duration?: number
  ease?: string
  path?: Path
}>

/** Reads one compiler-prepared move transition before the FLIP capture builder runs. */
export function prepareMoveFlipTransition(transition: MoveTransition | undefined): PreparedMoveFlipTransition | undefined {
  if (transition === undefined) return undefined
  if (transition.path !== undefined && !isPreparedPath(transition.path)) {
    throw new Error('Move transition path must be prepared by the scene compiler.')
  }
  return {
    duration: transition.duration,
    ease: typeof transition.ease === 'string' ? transition.ease : undefined,
    path: transition.path as Path | undefined,
  }
}
