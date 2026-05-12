import type { RuntimeEventSource } from '../core/events/types'
import type { AnimationAdapter } from '../animation/types'
import type { RuntimeTraceRow } from '../runtime/trace-store'
import type { CreateElementOptions } from '../runtime/create-element'
import type { ItemDoc, StoryDoc } from '../runtime/types'
import { PlayerFacade } from './create-player'
import type { SceneDoc } from './types'
import type { ApiResult, CompiledScene } from '../builder/types'

type PlayerV1Status = 'idle' | 'ready' | 'playing' | 'paused' | 'seeking' | 'error'

type PlayerV1StateSnapshot = {
  status: PlayerV1Status
  timelineMs: number
  clockSource: 'ticker' | 'master'
  activeMasterPersoId?: string
}

type PlayerV1StateListener = (state: PlayerV1StateSnapshot) => void

type PlayerV1TraceListener = (row: RuntimeTraceRow) => void

type PlayerV1InitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: unknown
  runtimePolicy?: {
    masterClock?: {
      unique?: boolean
      previousMasterAction?: 'pause' | 'stop'
      fallbackToTicker?: boolean
    }
  }
}

type PlayerV1EmitInput = {
  name: string
  data?: Record<string, unknown>
  source?: RuntimeEventSource
}

type PlayerV1SeekInput = {
  timelineMs: number
}

type PlayerV1ScheduleApi = {
  now: () => number
}

export type PlayerV1Api = {
  init: (input: PlayerV1InitInput) => Promise<ApiResult<void>>
  play: () => Promise<ApiResult<void>>
  pause: () => Promise<ApiResult<void>>
  resume: () => Promise<ApiResult<void>>
  stop: () => Promise<ApiResult<void>>
  destroy: () => Promise<ApiResult<void>>
  seek: (input: PlayerV1SeekInput) => Promise<ApiResult<void>>
  emit: (input: PlayerV1EmitInput) => Promise<ApiResult<void>>
  getState: () => PlayerV1StateSnapshot
  onChange: (listener: PlayerV1StateListener) => () => void
  onTrace: (listener: PlayerV1TraceListener) => () => void
  schedule: PlayerV1ScheduleApi
}

type CreatePlayerV1AdapterOptions = {
  createElementOptions?: CreateElementOptions
  animationAdapter?: AnimationAdapter
}

/**
 * Creates one Player V1 adapter on top of the current PlayerFacade implementation.
 */
export function createPlayerV1Adapter(options: CreatePlayerV1AdapterOptions = {}): PlayerV1Api {
  const player = new PlayerFacade({
    createElementOptions: options.createElementOptions,
    animationAdapter: options.animationAdapter
  })

  return {
    async init(input: PlayerV1InitInput): Promise<ApiResult<void>> {
      const runtimeScene = convertCompiledSceneToRuntimeScene(input.compiledScene)
      const result = await player.init(runtimeScene)

      if (!result.ok) {
        return {
          ok: false,
          error: {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details
          }
        }
      }

      return {
        ok: true,
        data: undefined,
        warnings: input.runtimePolicy === undefined ? undefined : [
          {
            code: 'PLAYER_RUNTIME_POLICY_IGNORED',
            message: 'runtimePolicy from init input is accepted but not yet applied by this adapter.'
          }
        ]
      }
    },

    async play(): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(await player.play())
    },

    async pause(): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(await player.pause())
    },

    async resume(): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(await player.play())
    },

    async stop(): Promise<ApiResult<void>> {
      const state = player.getState()
      if (!state.initialized) {
        return {
          ok: false,
          error: {
            code: 'PLAYER_NOT_INITIALIZED',
            message: 'init must be called before stop'
          }
        }
      }

      if (state.status === 'playing') {
        const pauseResult = await player.pause()
        if (!pauseResult.ok) {
          return mapPlayerCommandResult(pauseResult)
        }
      }

      return mapPlayerCommandResult(await player.seek(0))
    },

    async destroy(): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(await player.destroy())
    },

    async seek(input: PlayerV1SeekInput): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(await player.seek(input.timelineMs))
    },

    async emit(input: PlayerV1EmitInput): Promise<ApiResult<void>> {
      return mapPlayerCommandResult(
        await player.emit({
          name: input.name,
          payload: input.data,
          source: input.source
        })
      )
    },

    getState(): PlayerV1StateSnapshot {
      return mapPlayerStateToV1(player.getState())
    },

    onChange(listener: PlayerV1StateListener): () => void {
      return player.onStateChange((state) => {
        listener(mapPlayerStateToV1(state))
      })
    },

    onTrace(listener: PlayerV1TraceListener): () => void {
      return player.onTrace(listener)
    },

    schedule: {
      now(): number {
        if (typeof globalThis.performance !== 'undefined') {
          return globalThis.performance.now()
        }

        return Date.now()
      }
    }
  }
}

/**
 * Converts one compiled scene payload to the current runtime SceneDoc shape.
 */
function convertCompiledSceneToRuntimeScene(compiledScene: CompiledScene): SceneDoc {
  const runtimeStories: Record<string, StoryDoc> = {}

  for (const [storyId, story] of Object.entries(compiledScene.scene.stories)) {
    runtimeStories[storyId] = {
      id: story.id,
      items: convertPersosToItems(story.persos)
    }
  }

  const initialStoryId = compiledScene.scene.rootStories[0]

  return {
    id: compiledScene.scene.id,
    initialStoryId,
    stories: runtimeStories,
    tracks: { ...compiledScene.scene.tracks }
  }
}

/**
 * Converts one list of authored persos to legacy runtime items.
 */
function convertPersosToItems(persos: Array<{ id: string; type: string; initial: unknown; actions: unknown; emit?: unknown }>): Record<string, ItemDoc> {
  const items: Record<string, ItemDoc> = {}

  for (const perso of persos) {
    items[perso.id] = {
      id: perso.id,
      type: perso.type,
      initial: sanitizeItemInitialState(perso.initial),
      actions: sanitizeItemActions(perso.actions),
      emit: undefined,
      children: undefined,
      list: undefined,
      module: undefined
    }
  }

  return items
}

/**
 * Sanitizes one authored initial payload into runtime item initial shape.
 */
function sanitizeItemInitialState(value: unknown): ItemDoc['initial'] {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return value as ItemDoc['initial']
}

/**
 * Sanitizes one authored actions payload into runtime action map shape.
 */
function sanitizeItemActions(value: unknown): ItemDoc['actions'] {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return value as ItemDoc['actions']
}

/**
 * Maps the current player command result shape to Builder/Player V1 ApiResult.
 */
function mapPlayerCommandResult(result: { ok: true } | { ok: false; error: { code: string; message: string; details?: unknown } }): ApiResult<void> {
  if (!result.ok) {
    return {
      ok: false,
      error: {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details
      }
    }
  }

  return {
    ok: true,
    data: undefined
  }
}

/**
 * Maps internal player states to the V1 public state vocabulary.
 */
function mapPlayerStateToV1(state: {
  status: string
  timelineMs: number
}): PlayerV1StateSnapshot {
  const status = mapPlayerStatusToV1(state.status)
  return {
    status,
    timelineMs: state.timelineMs,
    clockSource: 'ticker',
    activeMasterPersoId: undefined
  }
}

/**
 * Maps one internal status value to the V1 status domain.
 */
function mapPlayerStatusToV1(status: string): PlayerV1Status {
  if (status === 'idle') {
    return 'idle'
  }

  if (status === 'ready') {
    return 'ready'
  }

  if (status === 'playing') {
    return 'playing'
  }

  if (status === 'paused') {
    return 'paused'
  }

  if (status === 'seeking' || status === 'rewinding' || status === 'preloading') {
    return 'seeking'
  }

  return 'error'
}
