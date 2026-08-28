import type { TransitionRequest } from '../../../animation/types'
import type { RuntimeListComponent } from '../../components/types'
import type { MoveCommand } from '../../types'

export type ListFlipModuleContext = {
  warnOnce: (
    eventSeq: number,
    code: string,
    details: Record<string, unknown>,
    persoId?: string
  ) => void
  getNodeById: (persoId: string) => unknown | null
  getListById: (persoId: string) => RuntimeListComponent | null
  getParentListId: (persoId: string) => string | null
  isMounted: (persoId: string) => boolean
}

export type PrepareListFlipMoveInput = {
  persoId: string
  move: MoveCommand
  eventId: string
  eventName: string
  eventSeq: number
  isSeekReplay?: boolean
  /**
   * Excludes `persoId` itself from the FLIP entries touched by this move —
   * only its neighbors are captured/animated. `false`/absent preserves the
   * existing behavior (the moved item is always included) for every
   * existing caller. Used by a live reorder preview (drag-and-drop ghost),
   * where the dragged item already has its own free-following position and
   * must never be FLIP-animated itself.
   */
  excludeSelfFromFlip?: boolean
}

export type ListFlipSession = {
  commit: () => TransitionRequest[]
}

export type ListFlipModule = {
  prepareMove: (input: PrepareListFlipMoveInput) => ListFlipSession | null
  cleanup: () => void
}
