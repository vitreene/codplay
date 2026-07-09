import type { ApiResult, ListenRule, Perso, SceneDef, StoryDef } from 'codplay/builder/types'
import type { StrapCollection } from 'codplay/player/strap-types'

type SceneState = {
  id: string
  initial: Record<string, unknown> | undefined
  init: ((input?: Record<string, unknown>) => Record<string, unknown> | undefined) | undefined
  onStart: ((...args: any[]) => void) | undefined
  onSequenceEnd: ((...args: any[]) => void) | undefined
  listen: ListenRule[]
  straps: string[] | undefined
  tracks: Record<string, unknown>
  stories: Record<string, StoryDef>
}

/**
 * Helper de construction programmatique d'un SceneDef.
 * Destiné aux outils d'édition — pas à l'auteur en mode lecture.
 */
export class SceneDocEditor {
  private currentScene: SceneState | null = null

  create(input: { id: string }): ApiResult<void> {
    if (this.currentScene !== null) {
      return this.reject('CREATOR_ALREADY_INITIALIZED', 'create can only be called once')
    }

    this.currentScene = {
      id: input.id,
      initial: undefined,
      init: undefined,
      onStart: undefined,
      onSequenceEnd: undefined,
      listen: [],
      straps: undefined,
      tracks: {},
      stories: {}
    }

    return { ok: true, data: undefined }
  }

  createStory(input: { id?: string; name?: string } = {}): ApiResult<{ storyId: string; storyName: string }> {
    return this.withScene((scene) => {
      const identityResult = this.resolveStoryIdentity(scene, input.id, input.name)
      if (!identityResult.ok) return identityResult
      const identity = identityResult.data

      scene.stories[identity.storyId] = {
        id: identity.storyId,
        name: identity.storyName,
        tracks: undefined,
        initial: { move: '@root' },
        persos: [],
        straps: undefined,
        listen: [],
        eventimes: undefined,
        state: undefined,
        init: undefined
      }
      return { ok: true, data: identity }
    })
  }

  createPerso(input: {
    storyId: string
    type: string
    id?: string
    name?: string
  }): ApiResult<{ persoId: string; persoName: string }> {
    return this.withScene((scene) => {
      const story = scene.stories[input.storyId]
      if (story === undefined) {
        return this.reject('CREATOR_STORY_NOT_FOUND', `Story '${input.storyId}' does not exist`)
      }

      const identityResult = this.resolvePersoIdentity(story, input.id, input.type, input.name)
      if (!identityResult.ok) return identityResult
      const identity = identityResult.data

      const nextStory = this.cloneStory(story)
      nextStory.persos = [
        ...nextStory.persos,
        {
          id: identity.persoId,
          name: identity.persoName,
          type: input.type,
          initial: { move: '@root' },
          actions: { [identity.persoId]: null }
        }
      ]
      scene.stories[input.storyId] = nextStory

      return { ok: true, data: identity }
    })
  }

  readonly scene = {
    initial: {
      set: (input: { value: Record<string, unknown> | undefined }): ApiResult<void> =>
        this.withScene((scene) => { scene.initial = this.cloneData(input.value); return { ok: true, data: undefined } })
    },
    init: {
      set: (input: { value: ((input?: Record<string, unknown>) => Record<string, unknown> | undefined) | undefined }): ApiResult<void> =>
        this.withScene((scene) => { scene.init = input.value; return { ok: true, data: undefined } })
    },
    onStart: {
      set: (input: { value: ((...args: any[]) => void) | undefined }): ApiResult<void> =>
        this.withScene((scene) => { scene.onStart = input.value; return { ok: true, data: undefined } })
    },
    onSequenceEnd: {
      set: (input: { value: ((...args: any[]) => void) | undefined }): ApiResult<void> =>
        this.withScene((scene) => { scene.onSequenceEnd = input.value; return { ok: true, data: undefined } })
    },
    listen: {
      set: (input: { value: ListenRule[] }): ApiResult<void> =>
        this.withScene((scene) => { scene.listen = this.cloneData(input.value); return { ok: true, data: undefined } })
    },
    straps: {
      set: (input: { value: string[] | undefined }): ApiResult<void> =>
        this.withScene((scene) => { scene.straps = this.cloneData(input.value); return { ok: true, data: undefined } })
    },
    tracks: {
      set: (input: { value: Record<string, unknown> }): ApiResult<void> =>
        this.withScene((scene) => { scene.tracks = this.cloneData(input.value); return { ok: true, data: undefined } }),
      upsert: (input: { trackId: string; track: Record<string, unknown> }): ApiResult<void> =>
        this.withScene((scene) => {
          scene.tracks = { ...scene.tracks, [input.trackId]: this.cloneData(input.track) }
          return { ok: true, data: undefined }
        }),
      remove: (input: { trackId: string }): ApiResult<void> =>
        this.withScene((scene) => {
          const nextTracks = this.cloneData(scene.tracks)
          delete nextTracks[input.trackId]
          scene.tracks = nextTracks
          return { ok: true, data: undefined }
        })
    }
  }

  upsertStory(input: { story: StoryDef }): ApiResult<void> {
    return this.withScene((scene) => {
      scene.stories[input.story.id] = this.cloneStory(input.story)
      return { ok: true, data: undefined }
    })
  }

  removeStory(input: { storyId: string }): ApiResult<void> {
    return this.withScene((scene) => {
      delete scene.stories[input.storyId]
      return { ok: true, data: undefined }
    })
  }

  setStoryDisabled(input: { storyId: string; disabled: boolean }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      disabled: input.disabled
    }))
  }

  upsertPerso(input: { storyId: string; perso: Perso }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => {
      const nextStory = this.cloneStory(story)
      const nextPersos = nextStory.persos.filter((p) => p.id !== input.perso.id)
      const clonedPerso = this.clonePerso(input.perso)
      const hasMove = (clonedPerso.initial as Record<string, unknown> | undefined)?.move !== undefined
      if (!hasMove) {
        clonedPerso.initial = { ...(clonedPerso.initial as Record<string, unknown> | undefined), move: '@root' }
      }
      nextPersos.push(clonedPerso)
      nextStory.persos = nextPersos
      return nextStory
    })
  }

  removePerso(input: { storyId: string; persoId: string }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => {
      const nextStory = this.cloneStory(story)
      nextStory.persos = nextStory.persos.filter((p) => p.id !== input.persoId)
      return nextStory
    })
  }

  setStoryListen(input: { storyId: string; listen: ListenRule[] }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      listen: this.cloneData(input.listen)
    }))
  }

  setStoryStraps(input: { storyId: string; straps: StrapCollection | undefined }): ApiResult<void> {
    return this.withStory(input.storyId, (story) => ({
      ...this.cloneStory(story),
      straps: input.straps
    }))
  }

  exportSceneDoc(): ApiResult<SceneDef> {
    if (this.currentScene === null) {
      return this.reject('CREATOR_NOT_INITIALIZED', 'create must be called before exportSceneDoc')
    }
    return { ok: true, data: this.cloneScene() }
  }

  private withScene<T>(action: (scene: SceneState) => ApiResult<T>): ApiResult<T> {
    if (this.currentScene === null) {
      return this.reject('CREATOR_NOT_INITIALIZED', 'create must be called before authoring updates')
    }
    return action(this.currentScene)
  }

  private withStory(storyId: string, action: (story: StoryDef) => StoryDef): ApiResult<void> {
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
   * Resolve a story identity from an explicit `id` when given (rejecting a collision rather
   * than silently overwriting), falling back to slug-based generation otherwise.
   */
  private resolveStoryIdentity(
    scene: SceneState,
    explicitId: string | undefined,
    requestedName?: string
  ): ApiResult<{ storyId: string; storyName: string }> {
    if (explicitId !== undefined) {
      if (explicitId in scene.stories) {
        return this.reject('CREATOR_STORY_ID_COLLISION', `Story id '${explicitId}' already exists`)
      }
      return { ok: true, data: { storyId: explicitId, storyName: this.normalizeAuthorName(requestedName, explicitId) } }
    }
    return { ok: true, data: this.createStoryIdentity(scene, requestedName) }
  }

  /**
   * Resolve a perso identity from an explicit `id` when given (rejecting a collision rather
   * than silently overwriting), falling back to slug-based generation otherwise.
   */
  private resolvePersoIdentity(
    story: StoryDef,
    explicitId: string | undefined,
    persoType: string,
    requestedName?: string
  ): ApiResult<{ persoId: string; persoName: string }> {
    if (explicitId !== undefined) {
      if (story.persos.some((p) => p.id === explicitId)) {
        return this.reject('CREATOR_PERSO_ID_COLLISION', `Perso id '${explicitId}' already exists in story '${story.id}'`)
      }
      const persoName = this.normalizeAuthorName(requestedName, this.slugify(persoType, 'perso'))
      return { ok: true, data: { persoId: explicitId, persoName } }
    }
    return { ok: true, data: this.createPersoIdentity(story, persoType, requestedName) }
  }

  private createStoryIdentity(scene: SceneState, requestedName?: string): { storyId: string; storyName: string } {
    const baseName = this.normalizeAuthorName(requestedName, 'story')
    const usedNames = new Set(Object.values(scene.stories).map((s) => s.name ?? s.id))

    for (let i = 1; i < 10_000; i += 1) {
      const storyName = i === 1 ? baseName : `${baseName}-${i}`
      const storyId = `story-${this.slugify(storyName, 'story')}`
      if (!usedNames.has(storyName) && !(storyId in scene.stories)) {
        return { storyId, storyName }
      }
    }
    throw new Error('Unable to allocate one unique story identity')
  }

  private createPersoIdentity(story: StoryDef, persoType: string, requestedName?: string): { persoId: string; persoName: string } {
    const baseName = this.normalizeAuthorName(requestedName, this.slugify(persoType, 'perso'))
    const usedNames = new Set(story.persos.map((p) => p.name ?? p.id))
    const usedIds = new Set(story.persos.map((p) => p.id))

    for (let i = 1; i < 10_000; i += 1) {
      const persoName = i === 1 ? baseName : `${baseName}-${i}`
      const persoId = `${story.id}__${this.slugify(persoName, 'perso')}`
      if (!usedNames.has(persoName) && !usedIds.has(persoId)) {
        return { persoId, persoName }
      }
    }
    throw new Error('Unable to allocate one unique perso identity')
  }

  private cloneScene(): SceneDef {
    const scene = this.currentScene!
    return {
      id: scene.id,
      initial: this.cloneData(scene.initial),
      straps: this.cloneData(scene.straps),
      listen: this.cloneData(scene.listen),
      stories: Object.fromEntries(
        Object.entries(scene.stories).map(([id, story]) => [id, this.cloneStory(story)])
      ),
      tracks: this.cloneData(scene.tracks),
      init: scene.init,
      onStart: scene.onStart,
      onSequenceEnd: scene.onSequenceEnd
    }
  }

  private cloneStory(story: StoryDef): StoryDef {
    return {
      id: story.id,
      name: story.name ?? story.id,
      trackId: story.trackId,
      tracks: this.cloneData(story.tracks),
      initial: this.cloneData(story.initial),
      persos: story.persos.map((p) => this.clonePerso(p)),
      straps: story.straps,
      listen: this.cloneData(story.listen),
      eventimes: this.cloneData(story.eventimes),
      state: this.cloneData(story.state),
      init: story.init,
      disabled: story.disabled
    }
  }

  private clonePerso(perso: Perso): Perso {
    return {
      id: perso.id,
      name: perso.name ?? perso.id,
      type: perso.type,
      initial: this.cloneData(perso.initial),
      list: this.cloneData(perso.list),
      actions: this.cloneData(perso.actions),
      emit: this.cloneData(perso.emit)
    }
  }

  private normalizeAuthorName(value: string | undefined, fallback: string): string {
    const trimmed = value?.trim()
    return trimmed && trimmed.length > 0 ? trimmed : fallback
  }

  private slugify(value: string, fallback: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return normalized.length > 0 ? normalized : fallback
  }

  private cloneData<T>(value: T): T {
    if (value === undefined) return value
    if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value)
    return JSON.parse(JSON.stringify(value)) as T
  }

  private reject<T>(code: string, message: string): ApiResult<T> {
    return { ok: false, error: { code, message } }
  }
}
