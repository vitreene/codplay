import { BuilderValidator } from './builder-validation'
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
  ValidationReport
} from './types'

const DEFAULT_SCHEMA_VERSION = 'v1'

export type BuilderOptions = {
  schemaVersion?: string
}

/**
 * Implements one stable builder facade aligned with V1 contracts.
 */
export class BuilderFacade implements BuilderApi {
  private readonly schemaVersion: string
  private readonly validator = new BuilderValidator()

  /**
   * Creates one builder instance from explicit options.
   */
  constructor(options: BuilderOptions = {}) {
    this.schemaVersion = options.schemaVersion ?? DEFAULT_SCHEMA_VERSION
  }

  /**
   * Compiles one authored scene into the canonical diffusion artifact.
   */
  compile(input: BuilderCompileInput): ApiResult<BuilderCompileOutput> {
    const report = this.validator.validate(input.scene)

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
      schemaVersion: this.schemaVersion,
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
  }

  /**
   * Validates one authored scene without mutating the caller payload.
   */
  validate(input: { scene: SceneDef }): ValidationReport {
    return this.validator.validate(input.scene)
  }

  /**
   * Exports one compiled scene through the current minimal passthrough contract.
   */
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
  return cloneData(manifest)
}

/**
 * Clones one scene definition with stable arrays for validation and compile outputs.
 */
function cloneSceneDef(scene: SceneDef): SceneDef {
  const clonedStories: Record<string, StoryDef> = {}

  for (const [storyId, story] of Object.entries(scene.stories)) {
    clonedStories[storyId] = {
      id: story.id,
      children: cloneData(story.children),
      entries: cloneData(story.entries),
      initial: cloneData(story.initial),
      persos: cloneData(story.persos),
      straps: cloneData(story.straps),
      listen: cloneData(story.listen),
      eventimes: cloneData(story.eventimes),
      state: cloneData(story.state),
      init: story.init
    }
  }

  return {
    id: scene.id,
    stories: clonedStories,
    rootStories: cloneData(scene.rootStories),
    initial: cloneData(scene.initial),
    straps: cloneData(scene.straps),
    listen: cloneData(scene.listen),
    state: cloneData(scene.state),
    init: scene.init,
    tracks: cloneData(scene.tracks)
  }
}

/**
 * Clones one data payload without mutating the caller-owned structure.
 */
function cloneData<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}
