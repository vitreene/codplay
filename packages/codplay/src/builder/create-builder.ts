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
 * Derives root node IDs from the compiled scene's rootStories.
 * Root nodes are persos in root stories that have no move at all, or move: '@root'
 * (no parent — directly mounted at the page's mount target).
 */
function deriveRootNodeIds(scene: SceneDef): string[] {
  return scene.rootStories.flatMap((storyId) => {
    const story = scene.stories[storyId]
    if (story === undefined) return []
    return story.persos
      .filter((perso) => {
        const move = (perso.initial as Record<string, unknown> | undefined)?.move
        return move === undefined || isStoryHostMove(move)
      })
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

    const resourceManifest = extractResourceManifest(normalizedScene)
      const compiledScene: CompiledScene = {
        schemaVersion: this.schemaVersion,
        createdAt: new Date().toISOString(),
        scene: this.cloner.cloneSceneDef(normalizedScene),
        resources: this.cloner.cloneResourceManifest(resourceManifest),
        rootNodeIds: deriveRootNodeIds(normalizedScene)
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
