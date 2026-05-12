import type {
  ApiResult,
  ApiWarning,
  BuilderApi,
  BuilderCompileInput,
  BuilderCompileOutput,
  BuilderExportInput,
  CompiledScene,
  ResourceManifest,
  SceneDef,
  StoryDef,
  ValidationError,
  ValidationReport
} from './types'

const AUTHOR_DUPLICATE_LISTEN_ON = 'AUTHOR_DUPLICATE_LISTEN_ON'
const AUTHOR_ROOT_STORIES_INVALID = 'AUTHOR_ROOT_STORIES_INVALID'
const AUTHOR_STORY_ENTRIES_INVALID = 'AUTHOR_STORY_ENTRIES_INVALID'
const AUTHOR_MULTI_PARENT_STORY = 'AUTHOR_MULTI_PARENT_STORY'

const DEFAULT_SCHEMA_VERSION = 'v1'

type BuilderOptions = {
  schemaVersion?: string
}

/**
 * Creates one stable builder facade aligned with V1 contracts.
 */
export function createBuilder(options: BuilderOptions = {}): BuilderApi {
  const schemaVersion = options.schemaVersion ?? DEFAULT_SCHEMA_VERSION

  return {
    compile(input: BuilderCompileInput): ApiResult<BuilderCompileOutput> {
      const report = validateScene(input.scene)

      if (!report.ok) {
        const firstError = report.errors[0]
        return {
          ok: false,
          error: {
            code: firstError.code,
            message: firstError.message,
            details: firstError.details
          }
        }
      }

      const resourceManifest: ResourceManifest = { entries: [] }
      const compiledScene: CompiledScene = {
        schemaVersion,
        createdAt: new Date().toISOString(),
        scene: cloneSceneDef(input.scene),
        resources: cloneResourceManifest(resourceManifest)
      }

      return {
        ok: true,
        data: {
          compiledScene,
          resourceManifest,
          diagnostics: {
            warnings: [...report.warnings]
          }
        },
        warnings: report.warnings.length > 0 ? [...report.warnings] : undefined
      }
    },

    validate(input: { scene: SceneDef }): ValidationReport {
      return validateScene(input.scene)
    },

    export(input: BuilderExportInput): ApiResult<{ output: unknown; warnings?: ApiWarning[] }> {
      return {
        ok: true,
        data: {
          output: {
            exporterName: input.exporterName,
            compiledScene: cloneCompiledScene(input.compiledScene)
          },
          warnings: []
        }
      }
    }
  }
}

/**
 * Validates one authored scene against the minimal V1 blocking rules.
 */
function validateScene(scene: SceneDef): ValidationReport {
  const errors: ValidationError[] = []
  const warnings: ApiWarning[] = []

  validateRootStories(scene, errors)
  validateSceneListenUniqueness(scene, errors)
  validateStories(scene, errors)
  validateStoryParentCollisions(scene, warnings)

  return {
    ok: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates root stories presence and references against known stories.
 */
function validateRootStories(scene: SceneDef, errors: ValidationError[]): void {
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
function validateSceneListenUniqueness(scene: SceneDef, errors: ValidationError[]): void {
  const duplicatedKeys = findDuplicatedListenOn(scene.listen)
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
function validateStories(scene: SceneDef, errors: ValidationError[]): void {
  for (const story of Object.values(scene.stories)) {
    validateStoryEntries(story, errors)
    validateStoryListenUniqueness(story, errors)
  }
}

/**
 * Validates one story entries integrity and perso references.
 */
function validateStoryEntries(story: StoryDef, errors: ValidationError[]): void {
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
function validateStoryListenUniqueness(story: StoryDef, errors: ValidationError[]): void {
  const duplicatedKeys = findDuplicatedListenOn(story.listen)
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
 * Detects multi-parent story references and emits non-blocking warnings.
 */
function validateStoryParentCollisions(scene: SceneDef, warnings: ApiWarning[]): void {
  const parentByChildStoryId = new Map<string, string>()

  for (const story of Object.values(scene.stories)) {
    for (const childId of story.children ?? []) {
      const existingParentId = parentByChildStoryId.get(childId)
      if (existingParentId === undefined) {
        parentByChildStoryId.set(childId, story.id)
        continue
      }

      warnings.push({
        code: AUTHOR_MULTI_PARENT_STORY,
        message: 'A child story is referenced by multiple parents. First parent wins.',
        details: {
          childId,
          firstParentId: existingParentId,
          ignoredParentId: story.id
        }
      })
    }
  }
}

/**
 * Returns duplicate listen.on keys while preserving first-seen order.
 */
function findDuplicatedListenOn(listen: Array<{ on: string }>): string[] {
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

/**
 * Clones one compiled scene while preserving plain object structure.
 */
function cloneCompiledScene(compiledScene: CompiledScene): CompiledScene {
  return {
    schemaVersion: compiledScene.schemaVersion,
    createdAt: compiledScene.createdAt,
    scene: cloneSceneDef(compiledScene.scene),
    resources: cloneResourceManifest(compiledScene.resources)
  }
}

/**
 * Clones one resource manifest payload.
 */
function cloneResourceManifest(manifest: ResourceManifest): ResourceManifest {
  return {
    entries: manifest.entries.map((entry) => ({
      url: entry.url,
      type: entry.type,
      policy: {
        cache: entry.policy.cache,
        version: entry.policy.version,
        hash: entry.policy.hash,
        priority: entry.policy.priority
      }
    }))
  }
}

/**
 * Clones one scene definition with stable arrays for validation and compile outputs.
 */
function cloneSceneDef(scene: SceneDef): SceneDef {
  const clonedStories: Record<string, StoryDef> = {}

  for (const [storyId, story] of Object.entries(scene.stories)) {
    clonedStories[storyId] = {
      id: story.id,
      children: story.children === undefined ? undefined : [...story.children],
      entries: [...story.entries],
      initial: story.initial,
      persos: story.persos.map((perso) => ({
        id: perso.id,
        type: perso.type,
        initial: perso.initial,
        actions: { ...perso.actions },
        emit: perso.emit === undefined ? undefined : { ...perso.emit }
      })),
      straps: story.straps === undefined ? undefined : [...story.straps],
      listen: story.listen.map((rule) => ({
        on: rule.on,
        transform:
          rule.transform === undefined
            ? undefined
            : rule.transform.map((step) => ({
                name: step.name,
                options: step.options === undefined ? undefined : { ...step.options }
              })),
        emit:
          rule.emit === undefined
            ? undefined
            : rule.emit.map((nextEvent) => ({
                name: nextEvent.name,
                data: nextEvent.data === undefined ? undefined : { ...nextEvent.data },
                cascade: nextEvent.cascade
              })),
        straps: rule.straps === undefined ? undefined : [...rule.straps]
      })),
      eventimes: story.eventimes === undefined ? undefined : story.eventimes.map((eventime) => ({ ...eventime })),
      state: story.state,
      init: story.init
    }
  }

  return {
    id: scene.id,
    stories: clonedStories,
    rootStories: [...scene.rootStories],
    initial: scene.initial,
    straps: scene.straps === undefined ? undefined : [...scene.straps],
    listen: scene.listen.map((rule) => ({
      on: rule.on,
      transform:
        rule.transform === undefined
          ? undefined
          : rule.transform.map((step) => ({
              name: step.name,
              options: step.options === undefined ? undefined : { ...step.options }
            })),
      emit:
        rule.emit === undefined
          ? undefined
          : rule.emit.map((nextEvent) => ({
              name: nextEvent.name,
              data: nextEvent.data === undefined ? undefined : { ...nextEvent.data },
              cascade: nextEvent.cascade
            })),
      straps: rule.straps === undefined ? undefined : [...rule.straps]
    })),
    state: scene.state,
    init: scene.init,
    tracks: { ...scene.tracks }
  }
}
