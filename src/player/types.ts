import type { RuntimeTraceRow } from '../runtime/trace-store'
import type { StoryDoc } from '../runtime/types'

export type PlayerStatus = 'idle' | 'preloading' | 'ready' | 'playing' | 'paused' | 'seeking' | 'rewinding' | 'error'

export type RebuildMode = 'state' | 'full'

export type PlayerRuntimePolicy = {
  allowedRebuildModes: RebuildMode[]
}

export type SceneDoc = {
  id: string
  stories: Record<string, StoryDoc>
  initialStoryId?: string
  scenario?: Record<string, unknown>
  tracks?: Record<string, unknown>
}

export type PlayerStateSnapshot = {
  status: PlayerStatus
  initialized: boolean
  sceneId?: string
  activeStoryId?: string
  timelineMs: number
  runtimeRevision: number
}

export type PlayerCommandError = {
  code: string
  message: string
  details?: unknown
}

export type PlayerCommandResult =
  | { ok: true }
  | {
      ok: false
      error: PlayerCommandError
    }

export type PlayerTraceListener = (row: RuntimeTraceRow) => void

export type PlayerStateListener = (state: PlayerStateSnapshot) => void

export type PlayerApi = {
  init: (scene: SceneDoc) => Promise<PlayerCommandResult>
  destroy: () => Promise<PlayerCommandResult>
  play: () => Promise<PlayerCommandResult>
  pause: () => Promise<PlayerCommandResult>
  seek: (targetTimelineMs: number) => Promise<PlayerCommandResult>
  rewind: () => Promise<PlayerCommandResult>
  rebuild: (mode?: RebuildMode) => Promise<PlayerCommandResult>
  getState: () => PlayerStateSnapshot
  onTrace: (listener: PlayerTraceListener) => () => void
  onStateChange: (listener: PlayerStateListener) => () => void
}
