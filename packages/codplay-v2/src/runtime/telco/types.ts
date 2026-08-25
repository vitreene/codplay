import type { PlayerLifecycleState } from '../config/player-lifecycle'
import type { FrameScheduler } from '../time'

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

/** Minimal transport target required by the V2 telco facade. */
export type RuntimeTransportTarget = Readonly<{
  getLifecycleState: () => PlayerLifecycleState
  getCurrentTimeMs: () => number
  getRate: () => number
  play: () => void
  pause: () => void
  setRate: (rate: number) => void
  seek: (timeMs: number) => Readonly<{ ok: boolean }>
}>

/** Dependencies used to construct one local V2 telco. */
export type RuntimeTelcoOptions = Readonly<{
  target: RuntimeTransportTarget
  durationMs: number
  scheduler?: FrameScheduler
}>

/** Local transport facade used by an authoring or validation remote. */
export type RuntimeTelco = Readonly<{
  getState: () => RuntimeTelcoState
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
