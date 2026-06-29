import { BuilderValidator } from './builder-validation'
import { BuilderArtifactCloner } from './builder-artifact-cloner'
import { normalizeSceneDef } from './scene-normalization'
import { extractResourceManifest } from './extract-resource-manifest'
import { RUNTIME_CONFIG } from '../runtime/config'
import type {
  ApiResult,
  ApiWarning,
  BuilderApi,
  BuilderCompileInput,
  BuilderCompileOutput,
  BuilderExportInput,
  CompiledScene,
  SceneDef,
  ValidationReport
} from './types'

const DEFAULT_SCHEMA_VERSION = 'v1'

/**
 * Checks whether one raw move payload targets the story host alias (`@root`).
 * Duplicated from runtime/modules/move's isStoryHostMove to avoid a builder -> runtime
 * dependency for one predicate; both must stay aligned with RUNTIME_CONFIG.move.rootToken.
 */
function isStoryHostMove(rawMove: unknown): boolean {
  if (rawMove === RUNTIME_CONFIG.move.rootToken) return true
  if (typeof rawMove !== 'object' || rawMove === null) return false
  return (rawMove as { parentId?: unknown }).parentId === RUNTIME_CONFIG.move.rootToken
}

/**
 * Strips `disabled` stories entirely from the scene before compilation —
 * an author-level, temporary exclusion (equivalent to commenting the story
 * out), unrelated to `move`/`@root` placement. The story stays in the
 * authored SceneDef; it never reaches the CompiledScene.
 */
function removeDisabledStories(scene: SceneDef): SceneDef {
  const hasDisabledStory = Object.values(scene.stories).some((story) => story.disabled === true)
  if (!hasDisabledStory) {
    return scene
  }

  const stories: SceneDef['stories'] = {}
  for (const [storyId, story] of Object.entries(scene.stories)) {
    if (story.disabled === true) continue
    stories[storyId] = story
  }

  return { ...scene, stories }
}

/**
 * Derives root node IDs: persos whose own move resolves to '@root', inside a
 * story whose own `initial.move` also resolves to '@root' (the only case
 * where a story's content lands directly under the page's mount target —
 * both levels must agree, see 2026-06-29-story-root-move-installation-plan.md 1.3bis).
 */
function deriveRootNodeIds(scene: SceneDef): string[] {
  return Object.values(scene.stories).flatMap((story) => {
    const storyMove = (story.initial as Record<string, unknown> | undefined)?.move
    if (!isStoryHostMove(storyMove)) return []

    return story.persos
      .filter((perso) => isStoryHostMove((perso.initial as Record<string, unknown> | undefined)?.move))
      .map((perso) => perso.id)
  })
}

export type BuilderOptions = {
  schemaVersion?: string
}

/**
 * Implements one stable builder facade aligned with V1 contracts.
 */
export class BuilderFacade implements BuilderApi {
  private readonly schemaVersion: string
  private readonly validator = new BuilderValidator()
  private readonly cloner = new BuilderArtifactCloner()

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
    const normalizedScene = normalizeSceneDef(input.scene)
    const report = this.validator.validate(normalizedScene)

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

    const compiledSceneDef = removeDisabledStories(normalizedScene)
    const resourceManifest = extractResourceManifest(compiledSceneDef)
      const compiledScene: CompiledScene = {
        schemaVersion: this.schemaVersion,
        createdAt: new Date().toISOString(),
        scene: this.cloner.cloneSceneDef(compiledSceneDef),
        resources: this.cloner.cloneResourceManifest(resourceManifest),
        rootNodeIds: deriveRootNodeIds(compiledSceneDef)
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
    return this.validator.validate(input.scene as Parameters<BuilderValidator['validate']>[0])
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
            compiledScene: this.cloner.cloneCompiledScene(input.compiledScene)
          },
          warnings: []
        }
      }
    }
}
