import type { ApiResult, ListenRule, Perso, SceneDef, StoryDef } from '../builder/types'
import { BuilderFacade } from '../builder/create-builder'
import { Player } from '../player'
import type { CodPlayApi } from './types'

type CodPlaySceneState = {
  id: string
  initial: Record<string, unknown> | undefined
  init: ((input?: Record<string, unknown>) => Record<string, unknown> | undefined) | undefined
  listen: ListenRule[]
  straps: string[] | undefined
  tracks: Record<string, unknown>
  rootStories: string[]
  stories: Record<string, StoryDef>
}

/**
 * Implements the minimal creator API for strict V1 authoring.
 */
export class CodPlay implements CodPlayApi {
  readonly builder = new BuilderFacade()
  readonly player = new Player()

  private currentScene: CodPlaySceneState | null = null

  /**
   * Creates one empty scene root ready for authoring.
   */
  create(input: { id: string }): ApiResult<void> {
    if (this.currentScene !== null) {
      return this.reject('CREATOR_ALREADY_INITIALIZED', 'create can only be called once')
    }

    this.currentScene = {
      id: input.id,
      initial: undefined,
      init: undefined,
      listen: [],
      straps: undefined,
      tracks: {},
      rootStories: [],
      stories: {}
    }

    return { ok: true, data: undefined }
  }

  readonly scene = {
    initial: {
      set: (input: { value: Record<string, unknown> | undefined }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.initial = this.cloneData(input.value)
          return { ok: true, data: undefined }
        })
      }
    },
    init: {
      set: (input: { value: ((input?: Record<string, unknown>) => Record<string, unknown> | undefined) | undefined }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.init = input.value
          return { ok: true, data: undefined }
        })
      }
    },
    listen: {
      set: (input: { value: ListenRule[] }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.listen = this.cloneData(input.value)
          return { ok: true, data: undefined }
        })
      }
    },
    straps: {
      set: (input: { value: string[] | undefined }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.straps = this.cloneData(input.value)
          return { ok: true, data: undefined }
        })
      }
    },
    tracks: {
      set: (input: { value: Record<string, unknown> }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.tracks = this.cloneData(input.value)
          return { ok: true, data: undefined }
        })
      }
    },
    rootStories: {
      set: (input: { value: string[] }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.rootStories = this.cloneData(input.value)
          return { ok: true, data: undefined }
        })
      }
    }
  }

  /**
   * Inserts or replaces one story in the authoring scene.
   */
  upsertStory(input: { story: StoryDef }): ApiResult<void> {
    return this.withScene((scene) => {
      scene.stories[input.story.id] = this.cloneStory(input.story)
      return { ok: true, data: undefined }
    })
  }

  /**
   * Removes one story from the authoring scene.
   */
  removeStory(input: { storyId: string }): ApiResult<void> {
    return this.withScene((scene) => {
      delete scene.stories[input.storyId]
      scene.rootStories = scene.rootStories.filter((storyId) => storyId !== input.storyId)
      return { ok: true, data: undefined }
    })
  }

  /**
   * Inserts or replaces one perso in one story.
   */
  upsertPerso(input: { storyId: string; perso: Perso }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => {
      const nextStory = this.cloneStory(story)
      const nextPersos = nextStory.persos.filter((perso) => perso.id !== input.perso.id)
      nextPersos.push(this.clonePerso(input.perso))
      nextStory.persos = nextPersos
      if (!nextStory.entries.includes(input.perso.id)) {
        nextStory.entries = [...nextStory.entries, input.perso.id]
      }

      return nextStory
    })
  }

  /**
   * Removes one perso from one story.
   */
  removePerso(input: { storyId: string; persoId: string }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => {
      const nextStory = this.cloneStory(story)
      nextStory.persos = nextStory.persos.filter((perso) => perso.id !== input.persoId)
      nextStory.entries = nextStory.entries.filter((entryId) => entryId !== input.persoId)
      return nextStory
    })
  }

  /**
   * Replaces one story listen array.
   */
  setStoryListen(input: { storyId: string; listen: ListenRule[] }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      listen: this.cloneData(input.listen)
    }))
  }

  /**
   * Replaces one story straps list.
   */
  setStoryStraps(input: { storyId: string; straps: string[] | undefined }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      straps: this.cloneData(input.straps)
    }))
  }

  /**
   * Replaces one story child list.
   */
  setStoryChildren(input: { storyId: string; children: string[] }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      children: this.cloneData(input.children)
    }))
  }

  /**
   * Replaces one story entries list.
   */
  setStoryEntries(input: { storyId: string; entries: string[] }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      entries: this.cloneData(input.entries)
    }))
  }

  /**
   * Exports one strict scene document ready for the builder.
   */
  exportSceneDoc(): ApiResult<SceneDef> {
    if (this.currentScene === null) {
      return this.reject('CREATOR_NOT_INITIALIZED', 'create must be called before exportSceneDoc')
    }

    return {
      ok: true,
      data: this.cloneScene()
    }
  }

  /**
   * Runs one scene-aware operation and returns any creation error.
   */
  private withScene(action: (scene: CodPlaySceneState) => ApiResult<void>): ApiResult<void> {
    if (this.currentScene === null) {
      return this.reject('CREATOR_NOT_INITIALIZED', 'create must be called before authoring updates')
    }

    return action(this.currentScene)
  }

  /**
   * Runs one story-aware operation and returns any creation error.
   */
  private withStory(
    storyId: string,
    action: (story: StoryDef) => StoryDef
  ): ApiResult<void> {
    return this.withScene((scene) => {
      const story = scene.stories[storyId]
      if (story === undefined) {
        return this.reject('CREATOR_STORY_NOT_FOUND', `Story '${storyId}' does not exist`)
      }

      scene.stories[storyId] = action(story)
      return { ok: true, data: undefined }
    })
  }

  /**
   * Clones one current scene before export.
   */
  private cloneScene(): SceneDef {
    const scene = this.currentScene
    if (scene === null) {
      throw new Error('CodPlay scene is not initialized')
    }

    return {
      id: scene.id,
      rootStories: this.cloneData(scene.rootStories),
      initial: this.cloneData(scene.initial),
      straps: this.cloneData(scene.straps),
      listen: this.cloneData(scene.listen),
      stories: Object.fromEntries(
        Object.entries(scene.stories).map(([storyId, story]) => [storyId, this.cloneStory(story)])
      ),
      tracks: this.cloneData(scene.tracks),
      init: scene.init
    }
  }

  /**
   * Clones one story payload.
   */
  private cloneStory(story: StoryDef): StoryDef {
    return {
      id: story.id,
      children: this.cloneData(story.children),
      entries: this.cloneData(story.entries),
      initial: this.cloneData(story.initial),
      persos: story.persos.map((perso) => this.clonePerso(perso)),
      straps: this.cloneData(story.straps),
      listen: this.cloneData(story.listen),
      eventimes: this.cloneData(story.eventimes),
      state: this.cloneData(story.state),
      init: story.init
    }
  }

  /**
   * Clones one perso payload.
   */
  private clonePerso(perso: Perso): Perso {
    return {
      id: perso.id,
      type: perso.type,
      initial: this.cloneData(perso.initial),
      actions: this.cloneData(perso.actions),
      emit: this.cloneData(perso.emit)
    }
  }

  /**
   * Clones one data payload without mutating the caller-owned structure.
   */
  private cloneData<T>(value: T): T {
    if (value === undefined) {
      return value
    }

    if (typeof globalThis.structuredClone === 'function') {
      return globalThis.structuredClone(value)
    }

    return JSON.parse(JSON.stringify(value)) as T
  }

  /**
   * Builds one rejection result for authoring operations.
   */
  private reject<T>(code: string, message: string): ApiResult<T> {
    return {
      ok: false,
      error: {
        code,
        message
      }
    }
  }
}
