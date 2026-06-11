import type { ApiResult, ListenRule, Perso, SceneDef, StoryDef } from '../builder/types'
import { BuilderFacade } from '../builder/create-builder'
import { Player } from '../player'
import type { StoryEvent } from '../player'
import type { CreatePlayerOptions } from '../player/create-player'
import { createTelco } from '../telco/create-telco'
import type { TelcoApi } from '../telco/types'

function createRafTickSubscriber(callback: () => void): () => void {
  const frameId = globalThis.requestAnimationFrame(callback)
  return () => { globalThis.cancelAnimationFrame(frameId) }
}
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
  readonly player: Player
  readonly telco: TelcoApi

  private currentScene: CodPlaySceneState | null = null

  /**
   * Creates one CodPlay instance with one configurable public player facade.
   */
  constructor(options: CreatePlayerOptions = {}) {
    this.player = new Player(options)
    this.telco = createTelco(this.player, { subscribeOnTick: createRafTickSubscriber })
  }

  /**
   * Emits one scene event through the player.
   */
  emit(input: StoryEvent): Promise<ApiResult<void>> {
    return this.player.emit(input)
  }

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

  /**
   * Creates one empty story with one generated author name and runtime id.
   */
  createStory(input: { name?: string } = {}): ApiResult<{ storyId: string; storyName: string }> {
    return this.withScene((scene) => {
      const identity = this.createStoryIdentity(scene, input.name)
      scene.stories[identity.storyId] = {
        id: identity.storyId,
        name: identity.storyName,
        tracks: undefined,
        entries: [],
        initial: undefined,
        persos: [],
        straps: undefined,
        listen: [],
        eventimes: undefined,
        state: undefined,
        init: undefined
      }

      return {
        ok: true,
        data: identity
      }
    })
  }

  /**
   * Creates one empty perso in one story with one generated author name and runtime id.
   */
  createPerso(input: {
    storyId: string
    type: string
    name?: string
  }): ApiResult<{ persoId: string; persoName: string }> {
    return this.withScene((scene) => {
      const story = scene.stories[input.storyId]
      if (story === undefined) {
        return this.reject('CREATOR_STORY_NOT_FOUND', `Story '${input.storyId}' does not exist`)
      }

      const identity = this.createPersoIdentity(story, input.type, input.name)
      const nextStory = this.cloneStory(story)
      nextStory.persos = [
        ...nextStory.persos,
        {
          id: identity.persoId,
          name: identity.persoName,
          type: input.type,
          initial: undefined,
          actions: {
            [identity.persoId]: null
          }
        }
      ]
      nextStory.entries = [...nextStory.entries, identity.persoId]
      scene.stories[input.storyId] = nextStory

      return {
        ok: true,
        data: identity
      }
    })
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
      },
      upsert: (input: { trackId: string; track: Record<string, unknown> }): ApiResult<void> => {
        return this.withScene((scene) => {
          scene.tracks = {
            ...scene.tracks,
            [input.trackId]: this.cloneData(input.track)
          }
          return { ok: true, data: undefined }
        })
      },
      remove: (input: { trackId: string }): ApiResult<void> => {
        return this.withScene((scene) => {
          const nextTracks = this.cloneData(scene.tracks)
          delete nextTracks[input.trackId]
          scene.tracks = nextTracks
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
  private withScene<T>(action: (scene: CodPlaySceneState) => ApiResult<T>): ApiResult<T> {
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
   * Creates one stable story author name and runtime id pair.
   */
  private createStoryIdentity(
    scene: CodPlaySceneState,
    requestedName?: string
  ): { storyId: string; storyName: string } {
    const baseName = this.normalizeAuthorName(requestedName, 'story')
    const usedStoryNames = new Set(Object.values(scene.stories).map((story) => story.name ?? story.id))

    for (let index = 1; index < 10_000; index += 1) {
      const storyName = index === 1 ? baseName : `${baseName}-${index}`
      const storyId = `story-${this.slugify(storyName, 'story')}`
      if (usedStoryNames.has(storyName) || storyId in scene.stories) {
        continue
      }

      return { storyId, storyName }
    }

    throw new Error('Unable to allocate one unique story identity')
  }

  /**
   * Creates one stable perso author name and runtime id pair inside one story.
   */
  private createPersoIdentity(
    story: StoryDef,
    persoType: string,
    requestedName?: string
  ): { persoId: string; persoName: string } {
    const baseName = this.normalizeAuthorName(requestedName, this.slugify(persoType, 'perso'))
    const usedPersoNames = new Set(story.persos.map((perso) => perso.name ?? perso.id))
    const usedPersoIds = new Set(story.persos.map((perso) => perso.id))

    for (let index = 1; index < 10_000; index += 1) {
      const persoName = index === 1 ? baseName : `${baseName}-${index}`
      const persoId = `${story.id}__${this.slugify(persoName, 'perso')}`
      if (usedPersoNames.has(persoName) || usedPersoIds.has(persoId)) {
        continue
      }

      return { persoId, persoName }
    }

    throw new Error('Unable to allocate one unique perso identity')
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
      name: story.name ?? story.id,
      tracks: this.cloneData(story.tracks),
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
      name: perso.name ?? perso.id,
      type: perso.type,
      initial: this.cloneData(perso.initial),
      actions: this.cloneData(perso.actions),
      emit: this.cloneData(perso.emit)
    }
  }

  /**
   * Normalizes one optional author-visible name.
   */
  private normalizeAuthorName(value: string | undefined, fallback: string): string {
    const trimmedValue = value?.trim()
    return trimmedValue && trimmedValue.length > 0 ? trimmedValue : fallback
  }

  /**
   * Converts one free-form label into one stable runtime-safe slug.
   */
  private slugify(value: string, fallback: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return normalized.length > 0 ? normalized : fallback
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
