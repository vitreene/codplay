import type { RuntimeEventSource } from '../core/events/types'
import type { RuntimeComponentClass, RuntimeRegistrySnapshot } from '../runtime/components'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type {
  ActionDoc,
  EmitDeclaration,
  ItemModuleConfig,
  ItemState,
  ListConfig
} from '../runtime/types'

export type PlayerStatus = 'idle' | 'preloading' | 'ready' | 'playing' | 'paused' | 'seeking' | 'rewinding' | 'error'

export type RebuildMode = 'state' | 'full'

export type PlayerRuntimePolicy = {
  allowedRebuildModes: RebuildMode[]
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
  type: string
  module?: ItemModuleConfig
  initial: ItemState
  emit?: EmitDeclaration[]
  children?: string[]
  list?: ListConfig
  actions: Record<string, ActionDoc | null>
}

export type SceneStoryDoc = {
  id: string
  children?: string[]
  entries: string[]
  initial: Record<string, unknown> | undefined
  persos: PersoDoc[]
  straps: string[] | undefined
  listen: ListenRule[]
  eventimes?: StoryEventimeDoc[]
  state?: Record<string, unknown> | undefined
}

export type PlayerSceneLifecycleOptions = {
  mount: (story: string | SceneStoryDoc) => void
  start: (story: string | SceneStoryDoc) => void
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
  tracks: Record<string, unknown>
}

export type SceneDoc = StrictSceneDoc

export type PlayerStateSnapshot = {
  status: PlayerStatus
  initialized: boolean
  sceneId?: string
  activeStoryId?: string
  timelineMs: number
  runtimeRevision: number
}

export type PlayerPublicEventInput = {
  id?: string
  name: string
  ms?: number
  payload?: Record<string, unknown>
  source?: RuntimeEventSource
  trackId?: string
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
  registerComponent: (persoType: string, componentClass: RuntimeComponentClass) => PlayerCommandResult
  overrideComponent: (persoType: string, componentClass: RuntimeComponentClass) => PlayerCommandResult
  getRuntimeRegistry: () => RuntimeRegistrySnapshot
  init: (scene: SceneDoc) => Promise<PlayerCommandResult>
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
