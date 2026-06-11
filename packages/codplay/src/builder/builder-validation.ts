import type { ApiWarning, SceneDef, StoryDef, ValidationError, ValidationReport } from './types'

export const AUTHOR_DUPLICATE_LISTEN_ON = 'AUTHOR_DUPLICATE_LISTEN_ON'
export const AUTHOR_IDENTITY_INVALID = 'AUTHOR_IDENTITY_INVALID'
export const AUTHOR_ROOT_STORIES_INVALID = 'AUTHOR_ROOT_STORIES_INVALID'
export const AUTHOR_STORY_ENTRIES_INVALID = 'AUTHOR_STORY_ENTRIES_INVALID'
export const AUTHOR_TRACKS_INVALID = 'AUTHOR_TRACKS_INVALID'

/**
 * Validates one authored scene against the V1 builder rules.
 */
export class BuilderValidator {
  /**
   * Validates one authored scene against the minimal V1 blocking rules.
   */
  validate(scene: SceneDef): ValidationReport {
    const errors: ValidationError[] = []
    const warnings: ApiWarning[] = []

    this.validateRootStories(scene, errors)
    this.validateTracks(scene, errors)
    this.validateSceneListenUniqueness(scene, errors)
    this.validateStories(scene, errors)

    return {
      ok: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validates the scene track container shape.
   */
  private validateTracks(scene: SceneDef, errors: ValidationError[]): void {
    if (typeof scene.tracks !== 'object' || scene.tracks === null || Array.isArray(scene.tracks)) {
      errors.push({
        code: AUTHOR_TRACKS_INVALID,
        message: 'tracks must be a plain object.',
        details: {
          sceneId: scene.id
        }
      })
    }
  }

  /**
   * Validates root stories presence and references against known stories.
   */
  private validateRootStories(scene: SceneDef, errors: ValidationError[]): void {
    if (!Array.isArray(scene.rootStories) || scene.rootStories.length === 0) {
      errors.push({
        code: AUTHOR_ROOT_STORIES_INVALID,
        message: 'rootStories must be a non-empty string array.'
      })
      return
    }

    const allKnownStoryIds = new Set(Object.keys(scene.stories))
    const hasInvalidReference = scene.rootStories.some((storyId) => {
      return typeof storyId !== 'string' || storyId.trim().length === 0 || !allKnownStoryIds.has(storyId)
    })

    if (hasInvalidReference) {
      errors.push({
        code: AUTHOR_ROOT_STORIES_INVALID,
        message: 'rootStories contains unknown or invalid story ids.'
      })
    }
  }

  /**
   * Validates Scene.listen uniqueness on the event key.
   */
  private validateSceneListenUniqueness(scene: SceneDef, errors: ValidationError[]): void {
    const duplicatedKeys = this.findDuplicatedListenOn(scene.listen)
    if (duplicatedKeys.length === 0) {
      return
    }

    errors.push({
      code: AUTHOR_DUPLICATE_LISTEN_ON,
      message: 'Scene.listen contains duplicated on entries.',
      details: {
        sceneId: scene.id,
        on: duplicatedKeys
      }
    })
  }

  /**
   * Validates each story entries presence and listen uniqueness.
   */
  private validateStories(scene: SceneDef, errors: ValidationError[]): void {
    for (const story of Object.values(scene.stories)) {
      this.validateIdentity('story', story.id, story.name, errors)
      for (const perso of story.persos) {
        this.validateIdentity('perso', perso.id, perso.name, errors, {
          storyId: story.id
        })
      }

      this.validateStoryEntries(story, errors)
      this.validateStoryListenUniqueness(story, errors)
    }
  }

  /**
   * Validates one runtime identity pair.
   */
  private validateIdentity(
    kind: 'story' | 'perso',
    id: string,
    name: string | undefined,
    errors: ValidationError[],
    details?: Record<string, unknown>
  ): void {
    if (typeof id !== 'string' || id.trim().length === 0) {
      errors.push({
        code: AUTHOR_IDENTITY_INVALID,
        message: `${kind}.id must be a non-empty string.`,
        details
      })
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      errors.push({
        code: AUTHOR_IDENTITY_INVALID,
        message: `${kind}.name must be a non-empty string when provided.`,
        details: {
          ...details,
          id
        }
      })
    }
  }

  /**
   * Validates one story entries integrity and perso references.
   */
  private validateStoryEntries(story: StoryDef, errors: ValidationError[]): void {
    if (!Array.isArray(story.entries)) {
      errors.push({
        code: AUTHOR_STORY_ENTRIES_INVALID,
        message: 'Story.entries must be an array.',
        details: {
          storyId: story.id
        }
      })
      return
    }

    const knownPersoIds = new Set(story.persos.map((perso) => perso.id))
    const hasInvalidEntry = story.entries.some((entryId) => {
      return typeof entryId !== 'string' || entryId.trim().length === 0 || !knownPersoIds.has(entryId)
    })

    if (hasInvalidEntry) {
      errors.push({
        code: AUTHOR_STORY_ENTRIES_INVALID,
        message: 'Story.entries contains unknown or invalid perso ids.',
        details: {
          storyId: story.id
        }
      })
    }
  }

  /**
   * Validates Story.listen uniqueness on the event key.
   */
  private validateStoryListenUniqueness(story: StoryDef, errors: ValidationError[]): void {
    const duplicatedKeys = this.findDuplicatedListenOn(story.listen)
    if (duplicatedKeys.length === 0) {
      return
    }

    errors.push({
      code: AUTHOR_DUPLICATE_LISTEN_ON,
      message: 'Story.listen contains duplicated on entries.',
      details: {
        storyId: story.id,
        on: duplicatedKeys
      }
    })
  }

  /**
   * Returns duplicate listen.on keys while preserving first-seen order.
   */
  private findDuplicatedListenOn(listen: Array<{ on: string }>): string[] {
    const seen = new Set<string>()
    const duplicates: string[] = []

    for (const rule of listen) {
      if (!seen.has(rule.on)) {
        seen.add(rule.on)
        continue
      }

      if (!duplicates.includes(rule.on)) {
        duplicates.push(rule.on)
      }
    }

    return duplicates
  }
}
