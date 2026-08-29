import type { PlayerLifecycleState } from '../config/player-lifecycle'

/** Result returned by one local transport command. */
export type RuntimeTelcoCommandResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: Readonly<{ code: string; message: string }> }>

/** Snapshot exposed to a telco consumer and its remote control. */
export type RuntimeTelcoState = Readonly<{
  status: PlayerLifecycleState
  timelineMs: number
  durationMs: number
  rate: number
  initialized: boolean
  sequenceEnded: boolean
  runtimeRevision: number
}>

/** Time-only progress exposed by the V2 telco without presentation values. */
export type RuntimeTelcoProgress = Readonly<{
  timelineMs: number
  durationMs: number
}>

/** Minimal transport target required by the V2 telco facade. */
export type RuntimeTransportTarget = Readonly<{
  getLifecycleState: () => PlayerLifecycleState
  getCurrentTimeMs: () => number
  /** Returns the currently discovered horizon for an open-ended sequence. */
  getDurationMs?: () => number | undefined
  getRate: () => number
  subscribe: (listener: () => void) => () => void
  play: () => void
  pause: () => void
  setRate: (rate: number) => void
  seek: (timeMs: number) => Readonly<{ ok: boolean }>
}>

/** Dependencies used to construct one local V2 telco. */
export type RuntimeTelcoOptions = Readonly<{
  target: RuntimeTransportTarget
  /** Fixed duration supplied by a media or an authoritatively bounded track. */
  durationMs?: number
}>

/** Local transport facade used by an authoring or validation remote. */
export type RuntimeTelco = Readonly<{
  getState: () => RuntimeTelcoState
  getProgress: () => RuntimeTelcoProgress
  readonly commandInFlight: boolean
  readonly rate: number
  setRate: (rate: number) => void
  play: () => Promise<RuntimeTelcoCommandResult>
  pause: () => Promise<RuntimeTelcoCommandResult>
  togglePlay: () => Promise<RuntimeTelcoCommandResult>
  seek: (targetMs: number) => Promise<RuntimeTelcoCommandResult>
  rewind: () => Promise<RuntimeTelcoCommandResult>
  onChange: (listener: (state: RuntimeTelcoState) => void) => () => void
  onProgress: (listener: (state: RuntimeTelcoState) => void) => () => void
  destroy: () => void
}>
