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
}

export type ListFlipSession = {
  commit: () => TransitionRequest[]
}

export type ListFlipModule = {
  prepareMove: (input: PrepareListFlipMoveInput) => ListFlipSession | null
  cleanup: () => void
}
