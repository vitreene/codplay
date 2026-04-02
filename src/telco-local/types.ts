import type { PlayerApi, PlayerCommandError, PlayerCommandResult, PlayerStateSnapshot, RebuildMode } from '../player/types'

export type LocalTelcoCommand =
  | { name: 'play' }
  | { name: 'pause' }
  | { name: 'seek'; payload: { targetTimelineMs: number } }
  | { name: 'rewind' }
  | { name: 'rebuild'; payload?: { mode?: RebuildMode } }
  | { name: 'destroy' }

export type LocalTelcoCommandResult = {
  requestId: string
  commandName: LocalTelcoCommand['name']
  ok: boolean
  error?: PlayerCommandError
  playerState: PlayerStateSnapshot
}

export type LocalTelcoResultListener = (result: LocalTelcoCommandResult) => void

export type LocalTelcoStateListener = (state: PlayerStateSnapshot) => void

export type LocalTelcoApi = {
  dispatch: (command: LocalTelcoCommand) => Promise<LocalTelcoCommandResult>
  getState: () => PlayerStateSnapshot
  onCommandResult: (listener: LocalTelcoResultListener) => () => void
  onStateChange: (listener: LocalTelcoStateListener) => () => void
}

export type CreateLocalTelcoOptions = {
  requestIdFactory?: () => string
}

export type CreateLocalTelcoInput = {
  player: PlayerApi
  options?: CreateLocalTelcoOptions
}

export type LocalTelcoCommandExecutor = (command: LocalTelcoCommand, player: PlayerApi) => Promise<PlayerCommandResult>
