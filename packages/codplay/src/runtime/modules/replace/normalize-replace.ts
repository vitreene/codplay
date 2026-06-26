import type { ReplaceTransitionDef } from '../../config/transitions'
import { REPLACE_TRANSITIONS } from '../../config/transitions'

export type ReplaceDirection =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom'
  | 'center' | 'edges'

export type ReplaceSplit = 'letter' | 'word' | 'line' | 'cells'

export type ReplaceCommand = {
  transition: ReplaceTransitionDef
  duration: number
  split?: ReplaceSplit
  stagger?: number
  direction?: ReplaceDirection
  cellX?: number
  cellY?: number
  /** Slot uniquement : ne pas animer un glyphe identique à la même position (défaut true). */
  skipUnchanged?: boolean
}

/**
 * Resolves one replace transition definition from the catalogue.
 * Returns null if the name is not found.
 */
function resolveTransition(name: string): ReplaceTransitionDef | null {
  return REPLACE_TRANSITIONS[name] ?? null
}

/**
 * Checks whether one value is a valid split scope.
 */
function isSplit(value: unknown): value is ReplaceSplit {
  return value === 'letter' || value === 'word' || value === 'line' || value === 'cells'
}

/**
 * Checks whether one value is a valid direction.
 */
function isDirection(value: unknown): value is ReplaceDirection {
  return (
    value === 'left' || value === 'right' || value === 'top' || value === 'bottom' ||
    value === 'left-top' || value === 'right-top' || value === 'left-bottom' || value === 'right-bottom' ||
    value === 'center' || value === 'edges'
  )
}

/**
 * Parses a raw replace action value into a normalized ReplaceCommand.
 * Returns null if the value is absent, invalid, or references an unknown transition.
 */
export function normalizeReplaceCommand(rawReplace: unknown): ReplaceCommand | null {
  if (rawReplace === undefined || rawReplace === null) {
    return null
  }

  if (typeof rawReplace === 'string') {
    const transition = resolveTransition(rawReplace)
    if (transition === null) return null
    return { transition, duration: transition.durationMs }
  }

  if (typeof rawReplace !== 'object') {
    return null
  }

  const raw = rawReplace as Record<string, unknown>
  const transitionName = typeof raw.transition === 'string' ? raw.transition : null
  if (transitionName === null) return null

  const transition = resolveTransition(transitionName)
  if (transition === null) return null

  const duration = typeof raw.duration === 'number' ? raw.duration : transition.durationMs

  return {
    transition,
    duration,
    split: isSplit(raw.split) ? raw.split : undefined,
    stagger: typeof raw.stagger === 'number' ? raw.stagger : undefined,
    direction: isDirection(raw.direction) ? raw.direction : undefined,
    cellX: typeof raw.cellX === 'number' ? raw.cellX : undefined,
    cellY: typeof raw.cellY === 'number' ? raw.cellY : undefined,
    skipUnchanged: typeof raw.skipUnchanged === 'boolean' ? raw.skipUnchanged : undefined,
  }
}

/**
 * Checks whether an action payload has a replace-eligible content change.
 */
export function hasReplaceTarget(action: Record<string, unknown>): boolean {
  return action.content !== undefined || action.src !== undefined
}
