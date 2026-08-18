import {
  MOVE_OPERATION_MOUNT,
  MOVE_OPERATION_MOVE,
  MOVE_OPERATION_UNMOUNT,
  type MoveOperation,
} from '../config/move'
import type { MoveTransition } from '../config/move'
import type { MoveFlipMode } from '../config/move'
import type { SolvedPlacement, SolvedScene } from '../player/pipeline/types'

/** Generic structural change between two solved scene snapshots. */
export type MoveStateDelta = Readonly<{
  operation: MoveOperation
  persoKey: string
  fromTargetId?: string
  toTargetId?: string
  mountedBefore: boolean
  mountedAfter: boolean
  fromPlacement?: SolvedPlacement
  toPlacement?: SolvedPlacement
  transition?: MoveTransition
  transitionStartAt?: number
  /** Stable compiled occurrence identity used by persisted FLIP captures. */
  transitionOccurrenceId?: string
  flipMode?: MoveFlipMode
}>

/** Compares two solved snapshots without applying any list or renderer policy. */
export function diffSolvedScenes(before: SolvedScene, after: SolvedScene): readonly MoveStateDelta[] {
  const keys = new Set([...Object.keys(before.persos), ...Object.keys(after.persos)])
  const deltas: MoveStateDelta[] = []

  for (const persoKey of keys) {
    const beforePlacement = before.persos[persoKey]?.placement
    const afterPlacement = after.persos[persoKey]?.placement
    const mountedBefore = beforePlacement?.mounted === true
    const mountedAfter = afterPlacement?.mounted === true
    const fromTargetId = beforePlacement?.targetId
    const toTargetId = afterPlacement?.targetId

    if (!mountedBefore && !mountedAfter) continue
    if (mountedBefore === mountedAfter
      && fromTargetId === toTargetId
      && beforePlacement?.kind === afterPlacement?.kind
      && beforePlacement?.mode === afterPlacement?.mode
      && beforePlacement?.flipMode === afterPlacement?.flipMode
      && beforePlacement?.reorder === afterPlacement?.reorder
      && beforePlacement?.source === afterPlacement?.source) continue

    deltas.push({
      operation: !mountedBefore
        ? MOVE_OPERATION_MOUNT
        : !mountedAfter
          ? MOVE_OPERATION_UNMOUNT
          : MOVE_OPERATION_MOVE,
      persoKey,
      fromTargetId,
      toTargetId,
      mountedBefore,
      mountedAfter,
      fromPlacement: beforePlacement,
      toPlacement: afterPlacement,
      transition: afterPlacement?.transition,
      transitionStartAt: afterPlacement?.transitionStartAt,
      flipMode: afterPlacement?.flipMode,
    })
  }

  return deltas
}
