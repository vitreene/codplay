import { BuilderValidator } from './builder-validation'
import { BuilderArtifactCloner } from './builder-artifact-cloner'
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
      scene: this.cloner.cloneSceneDef(input.scene),
      resources: this.cloner.cloneResourceManifest(resourceManifest)
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
            compiledScene: this.cloner.cloneCompiledScene(input.compiledScene)
          },
          warnings: []
        }
      }
    }
}
