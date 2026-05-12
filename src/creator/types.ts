import type { ApiResult, ListenRule, Perso, SceneDef, StoryDef } from '../builder/types'
import type { BuilderApi } from '../builder/types'
import type { Player } from '../player'

export type CodPlayApi = {
  builder: BuilderApi
  player: Player
  create: (input: { id: string }) => ApiResult<void>
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
  setStoryStraps: (input: { storyId: string; straps: string[] | undefined }) => ApiResult<void>
  setStoryChildren: (input: { storyId: string; children: string[] }) => ApiResult<void>
  setStoryEntries: (input: { storyId: string; entries: string[] }) => ApiResult<void>
  exportSceneDoc: () => ApiResult<SceneDef>
}
