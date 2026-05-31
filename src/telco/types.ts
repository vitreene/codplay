import type { PlayerStateSnapshot } from '../player/types'

export type TelcoCommandResult =
  | { ok: true }
  | { ok: false; error: { code: string; message?: string } }

export type TelcoConfig = {
  onRewind?: () => Promise<void>
}

export type TelcoStateListener = (state: PlayerStateSnapshot) => void

export type TelcoApi = {
  configure: (config: TelcoConfig) => void

  getState: () => PlayerStateSnapshot
  readonly commandInFlight: boolean

  play: () => Promise<TelcoCommandResult>
  pause: () => Promise<TelcoCommandResult>
  togglePlay: () => Promise<TelcoCommandResult>
  seek: (targetMs: number) => Promise<TelcoCommandResult>
  rewind: () => Promise<TelcoCommandResult>

  onChange: (listener: TelcoStateListener) => () => void
  onProgress: (listener: TelcoStateListener) => () => void
}
