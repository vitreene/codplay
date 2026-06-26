import type { SceneDef } from '../builder/types'
import { PLAYER_STATUS } from './player-constants'
import type { RuntimeEventSource } from '../core/events/types'
import type { StrapCollection, TransformFn } from './strap-types'
import type { ComponentRegistryApi, ModuleRegistryApi, RuntimeRegistrySnapshot, ServiceRegistryApi } from '../runtime/components'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type {
  ActionDoc,
  EmitDeclaration,
  ItemModuleConfig,
  ItemType,
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

export type ListenRule = {
  on: string
  transform?: TransformFn[]
  emit?: ListenEmit[]
  straps?: string[]
}

export type StoryEventimeDoc = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: StoryEventimeDoc[]
}

export type PersoDoc<T extends ItemType = ItemType> = T extends ItemType ? {
  id: string
  name?: string
  type: T
  module?: ItemModuleConfig
  initial: ItemState<T>
  emit?: EmitDeclaration
  list?: ListConfig
  actions: Record<string, ActionDoc<T> | null>
} : never

export type SceneStoryDoc = {
  id: string
  name?: string
  trackId?: string
  tracks?: Record<string, unknown>
  entries: string[]
  initial: Record<string, unknown> | undefined
  persos: PersoDoc[]
  straps: StrapCollection | undefined
  listen: ListenRule[]
  eventimes?: StoryEventimeDoc[]
  state?: Record<string, unknown> | undefined
  init?: (input?: Record<string, unknown>) => Record<string, unknown> | undefined
}

export type PlayerSceneLifecycleOptions = {
  mount: (story: string | SceneStoryDoc) => void
  schedule: (story: string | SceneStoryDoc) => void
}

export type PlayerEmitInput = {
  name: string
  data?: Record<string, unknown>
  payload?: Record<string, unknown>
  ms?: number
  scopeStoryId?: string
  source?: RuntimeEventSource
  trackId?: string
  cascade?: boolean
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

export type PlayerEventInsertMode = 'apply-now' | 'persist-future' | 'persist-only'

export type PlayerPublicEventInput = {
  id?: string
  name: string
  ms?: number
  payload?: Record<string, unknown>
  scopeStoryId?: string
  source?: RuntimeEventSource
  trackId?: string
  cascade?: boolean
  mode?: PlayerEventInsertMode
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
  module: ModuleRegistryApi
  getRuntimeRegistry: () => RuntimeRegistrySnapshot
  init: (scene: PlayerSceneInput) => Promise<PlayerCommandResult>
  destroy: () => Promise<PlayerCommandResult>
  play: () => Promise<PlayerCommandResult>
  pause: () => Promise<PlayerCommandResult>
  emit: (event: PlayerEmitInput) => Promise<PlayerCommandResult>
  seek: (targetTimelineMs: number) => Promise<PlayerCommandResult>
  rewind: () => Promise<PlayerCommandResult>
  rebuild: (mode?: RebuildMode) => Promise<PlayerCommandResult>
  getState: () => PlayerStateSnapshot
  onTrace: (listener: PlayerTraceListener) => () => void
  onStateChange: (listener: PlayerStateListener) => () => void
}
