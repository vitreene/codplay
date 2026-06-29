import type { ApiWarning, SceneDef, StoryDef, ValidationError, ValidationReport } from './types'

export const AUTHOR_DUPLICATE_LISTEN_ON = 'AUTHOR_DUPLICATE_LISTEN_ON'
export const AUTHOR_IDENTITY_INVALID = 'AUTHOR_IDENTITY_INVALID'
export const AUTHOR_TRACKS_INVALID = 'AUTHOR_TRACKS_INVALID'
export const AUTHOR_STORY_DISABLED_REFERENCE = 'AUTHOR_STORY_DISABLED_REFERENCE'

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

    this.validateTracks(scene, errors)
    this.validateSceneListenUniqueness(scene, errors)
    this.validateStories(scene, errors)
    this.validateDisabledStoryReferences(scene, warnings)

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
   * Detects move.parentId references (story-level or perso-level) pointing at
   * a perso that belongs to a `disabled` story — non-blocking: the builder
   * still compiles, the author stays responsible for cleaning up. Only static
   * `initial.move` is checked; dynamic (action-level) moves are out of scope.
   */
  private validateDisabledStoryReferences(scene: SceneDef, warnings: ApiWarning[]): void {
    const disabledStoryIdByPersoId = new Map<string, string>()
    for (const story of Object.values(scene.stories)) {
      if (story.disabled !== true) continue
      for (const perso of story.persos) {
        disabledStoryIdByPersoId.set(perso.id, story.id)
      }
    }

    if (disabledStoryIdByPersoId.size === 0) {
      return
    }

    const resolveParentId = (rawMove: unknown): string | undefined => {
      if (typeof rawMove === 'string') return rawMove
      if (typeof rawMove !== 'object' || rawMove === null) return undefined
      const parentId = (rawMove as { parentId?: unknown }).parentId
      return typeof parentId === 'string' ? parentId : undefined
    }

    const checkParentId = (parentId: string | undefined, details: Record<string, unknown>): void => {
      if (parentId === undefined) return
      const disabledStoryId = disabledStoryIdByPersoId.get(parentId)
      if (disabledStoryId === undefined) return

      warnings.push({
        code: AUTHOR_STORY_DISABLED_REFERENCE,
        message: 'A move.parentId references a perso that belongs to a disabled story.',
        details: { ...details, parentId, disabledStoryId }
      })
    }

    for (const story of Object.values(scene.stories)) {
      if (story.disabled === true) continue

      checkParentId(resolveParentId((story.initial as Record<string, unknown> | undefined)?.move), {
        storyId: story.id
      })

      for (const perso of story.persos) {
        checkParentId(resolveParentId((perso.initial as Record<string, unknown> | undefined)?.move), {
          storyId: story.id,
          persoId: perso.id
        })
      }
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
