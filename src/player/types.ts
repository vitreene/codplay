import type { SceneDef } from '../builder/types'
import { PLAYER_STATUS } from './player-constants'
import type { RuntimeEventSource } from '../core/events/types'
import type { ComponentRegistryApi, RuntimeRegistrySnapshot, ServiceRegistryApi } from '../runtime/components'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type {
  ActionDoc,
  EmitDeclaration,
  ItemModuleConfig,
  ItemState,
  ListConfig
} from '../runtime/types'

export type PlayerStatus = typeof PLAYER_STATUS[keyof typeof PLAYER_STATUS]

export type RebuildMode = 'state' | 'full'

export type SeekPolicy = 'disabled' | 'played-only' | 'master-projected' | 'author-unrestricted'

export type HorizonSnapshot = {
  playedEndMs: number
  projectedMasterEndMs: number
  authorEndMs: number
  progressEndMs: number
  seekEndMs: number
  segment?: {
    startMs: number
    endMs: number
  }
}

export type PlayerRuntimePolicy = {
  allowedRebuildModes: RebuildMode[]
  seekPolicy: SeekPolicy
}

export type ListenEmit = {
  name: string
  data?: Record<string, unknown>
  cascade?: boolean
}

export type ListenTransform = {
  name: string
  options?: Record<string, unknown>
}

export type ListenRule = {
  on: string
  transform?: ListenTransform[]
  emit?: ListenEmit[]
  straps?: string[]
}

export type StoryEventimeDoc = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: StoryEventimeDoc[]
}

export type PersoDoc = {
  id: string
  name?: string
  type: string
  module?: ItemModuleConfig
  initial: ItemState
  emit?: EmitDeclaration
  list?: ListConfig
  actions: Record<string, ActionDoc | null>
}

export type SceneStoryDoc = {
  id: string
  name?: string
  trackId?: string
  tracks?: Record<string, unknown>
  entries: string[]
  initial: Record<string, unknown> | undefined
  persos: PersoDoc[]
  straps: string[] | undefined
  listen: ListenRule[]
  eventimes?: StoryEventimeDoc[]
  state?: Record<string, unknown> | undefined
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
}

export type PlayerSceneLifecycleOptions = {
  mount: (story: string | SceneStoryDoc) => void
  schedule: (story: string | SceneStoryDoc) => void
}

export type StrictSceneDoc = {
  id: string
  stories: Record<string, SceneStoryDoc>
  rootStories: string[]
  initial: Record<string, unknown> | undefined
  straps: string[] | undefined
  listen: ListenRule[]
  state?: Record<string, unknown> | undefined
  init?: (scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) => void
  onStart?: (scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) => void
  onSequenceEnd?: (scene: StrictSceneDoc, options: PlayerSceneLifecycleOptions) => void
  tracks: Record<string, unknown>
}

export type SceneDoc = StrictSceneDoc

export type PlayerSceneInput = StrictSceneDoc | SceneDef

export type PlayerStateSnapshot = {
  status: PlayerStatus
  initialized: boolean
  sequenceEnded: boolean
  sceneId?: string
  timelineMs: number
  horizon: HorizonSnapshot
  runtimeRevision: number
}

export type PlayerPublicEventInput = {
  id?: string
  name: string
  ms?: number
  payload?: Record<string, unknown>
  scopeStoryId?: string
  source?: RuntimeEventSource
  trackId?: string
  cascade?: boolean
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
  component: ComponentRegistryApi
  service: ServiceRegistryApi
  getRuntimeRegistry: () => RuntimeRegistrySnapshot
  init: (scene: PlayerSceneInput) => Promise<PlayerCommandResult>
  destroy: () => Promise<PlayerCommandResult>
  play: () => Promise<PlayerCommandResult>
  pause: () => Promise<PlayerCommandResult>
  emit: (event: PlayerPublicEventInput) => Promise<PlayerCommandResult>
  seek: (targetTimelineMs: number) => Promise<PlayerCommandResult>
  rewind: () => Promise<PlayerCommandResult>
  rebuild: (mode?: RebuildMode) => Promise<PlayerCommandResult>
  getState: () => PlayerStateSnapshot
  onTrace: (listener: PlayerTraceListener) => () => void
  onStateChange: (listener: PlayerStateListener) => () => void
}
