import {
  DiagnosticCollector,
  type DiagnosticReport,
} from '../../diagnostics'
import { RuntimeEngine } from '../../runtime/engine'
import type { RuntimeCapabilityCatalog } from '../../runtime/catalog'
import { SceneBuilder } from '../../scene/compiled'
import type { CompiledScene } from '../../scene/compiled'
import type {
  CodPlayCompileInput,
  CodPlayCompileOptions,
  CodPlayCompileResult,
} from '../facade-types'
import { DiagnosticChannel, publishFacadeError, withDiagnosticRefs } from '../diagnostic-channel'

/** Compiles scenes and prepares their declared libraries for the shared engine. */
export class EngineSceneController {
  private readonly catalog: RuntimeCapabilityCatalog
  private readonly runtimeEngine: RuntimeEngine
  private readonly diagnostics: DiagnosticChannel
  private readonly lockCatalog: () => void
  private readonly isDestroyed: () => boolean

  constructor(
    catalog: RuntimeCapabilityCatalog,
    runtimeEngine: RuntimeEngine,
    diagnostics: DiagnosticChannel,
    lockCatalog: () => void,
    isDestroyed: () => boolean,
  ) {
    this.catalog = catalog
    this.runtimeEngine = runtimeEngine
    this.diagnostics = diagnostics
    this.lockCatalog = lockCatalog
    this.isDestroyed = isDestroyed
  }

  /** Builds one authored scene against the configured capability catalog. */
  build(
    input: CodPlayCompileInput,
    options: CodPlayCompileOptions = {},
  ): CodPlayCompileResult {
    try {
      this.lockCatalog()
      const result = new SceneBuilder(this.catalog.validationSnapshot(), {
        ...options,
        diagnosticOutput: (diagnostic) => this.diagnostics.publish(withDiagnosticRefs(diagnostic, {
          sceneId: input.scene.id,
        })),
      }).build(input.scene)
      return {
        ...result,
        diagnostics: withDiagnosticReportRefs(result.diagnostics, { sceneId: input.scene.id }),
      }
    } catch (error) {
      const collector = new DiagnosticCollector({ output: () => undefined })
      collector.error(
        'CODPLAY_SCENE_COMPILE_FAILED',
        error instanceof Error ? error.message : String(error),
        { refs: { sceneId: input.scene.id } },
      )
      const diagnostics = collector.report()
      this.diagnostics.publishReport(diagnostics)
      return { ok: false, diagnostics }
    }
  }

  /** Prepares every library required by one compiled scene before mounting. */
  async prepare(scene: CompiledScene): Promise<void> {
    if (this.isDestroyed()) {
      const error = new Error('CodPlay engine has been destroyed.')
      publishFacadeError(this.diagnostics, 'CODPLAY_ENGINE_PREPARE_SCENE_FAILED', error, {
        sceneId: scene.scene.id,
      })
      throw error
    }
    try {
      this.lockCatalog()
      await this.runtimeEngine.prepareScene(scene)
    } catch (error) {
      publishFacadeError(this.diagnostics, 'CODPLAY_ENGINE_PREPARE_SCENE_FAILED', error, {
        sceneId: scene.scene.id,
      })
      throw error instanceof Error ? error : new Error(String(error))
    }
  }
}

/** Reattaches one scene identity to every diagnostic returned by the builder. */
function withDiagnosticReportRefs(
  report: DiagnosticReport,
  refs: Readonly<{ sceneId: string }>,
): DiagnosticReport {
  const all = report.all.map((diagnostic) => withDiagnosticRefs(diagnostic, refs))
  return {
    all,
    warnings: all.filter((diagnostic) => diagnostic.severity === 'warning'),
    errors: all.filter((diagnostic) => diagnostic.severity === 'error'),
  }
}
