import type { ApiResult, ListenRule, Perso, SceneDef, StoryDef } from '../builder/types'
import type { StrapCollection } from '../player/strap-types'
import type { BuilderApi } from '../builder/types'
import type { Player } from '../player'
import type { StoryEvent } from '../player'
import type { TelcoApi } from '../telco/types'

export type CodPlayApi = {
  builder: BuilderApi
  player: Player
  telco: TelcoApi
  emit: (input: StoryEvent) => Promise<ApiResult<void>>
  create: (input: { id: string }) => ApiResult<void>
  createStory: (input?: { name?: string }) => ApiResult<{ storyId: string; storyName: string }>
  createPerso: (input: {
    storyId: string
    type: string
    name?: string
  }) => ApiResult<{ persoId: string; persoName: string }>
  scene: {
    initial: {
      set: (input: { value: Record<string, unknown> | undefined }) => ApiResult<void>
    }
    init: {
      set: (input: { value: ((input?: Record<string, unknown>) => Record<string, unknown> | undefined) | undefined }) => ApiResult<void>
    }
    listen: {
      set: (input: { value: ListenRule[] }) => ApiResult<void>
    }
    straps: {
      set: (input: { value: string[] | undefined }) => ApiResult<void>
    }
    tracks: {
      set: (input: { value: Record<string, unknown> }) => ApiResult<void>
      upsert: (input: { trackId: string; track: Record<string, unknown> }) => ApiResult<void>
      remove: (input: { trackId: string }) => ApiResult<void>
    }
    rootStories: {
      set: (input: { value: string[] }) => ApiResult<void>
    }
  }
  upsertStory: (input: { story: StoryDef }) => ApiResult<void>
  removeStory: (input: { storyId: string }) => ApiResult<void>
  upsertPerso: (input: { storyId: string; perso: Perso }) => ApiResult<void>
  removePerso: (input: { storyId: string; persoId: string }) => ApiResult<void>
  setStoryListen: (input: { storyId: string; listen: ListenRule[] }) => ApiResult<void>
  setStoryStraps: (input: { storyId: string; straps: StrapCollection | undefined }) => ApiResult<void>
  setStoryEntries: (input: { storyId: string; entries: string[] }) => ApiResult<void>
  exportSceneDoc: () => ApiResult<SceneDef>
}
