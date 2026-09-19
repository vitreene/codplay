import type { DiagnosticOutput } from '../../../diagnostics'
import { DiagnosticCollector } from '../../../diagnostics'
import type {
  CompiledFunctionCollection,
  CompiledScene,
} from '../../../scene/compiled'
import type { SceneDoc, SceneLifecycleOptions } from '../../../scene/types'
import type { RuntimeModuleServiceInstance, RuntimeEngine } from '../../engine'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
  PLAYER_LIFECYCLE_READY,
  type PlayerLifecycleState,
} from '../../config/player-lifecycle'
import type { RuntimeIdleMonitor } from '../../idle'
import { diffSolvedScenes } from '../../move'
import {
  initializeModuleServices,
  notifyModuleMoveDeltas,
  notifyModulePlaybackState,
  notifyModuleRateChange,
} from '../modules'
import {
  collectSolvedMoveDiagnostics,
} from '../diagnostics'
import {
  validateStrapCollections,
  type MountTargetDeclaration,
  type RuntimeStateStore,
  type RuntimeTrackJournal,
  type StrapCollections,
} from '../pipeline'
import type { RenderSync } from '../render-sync'
import type { RuntimeComponentRuntime } from '../../components'
import type { RuntimeMaterializer } from '../../materializer'
import type { RuntimePlayerCaptureController } from './capture-controller'
import type { RuntimePlayerEventController } from './event-controller'
import type { RuntimePlayerPresentation } from './presentation'
import type { RuntimePlayerSeekController } from './seek-controller'
import type { RuntimePlayerSceneState } from './scene-state'
import type { RuntimePlayerState } from './player-state'
import type { PlayerInitResult, PlayerSeekResult } from './player-types'

/** Dependencies for lifecycle, transport and engine registration commands. */
export type RuntimePlayerLifecycleControllerContext = Readonly<{
  id: string
  state: RuntimePlayerState
  engine: RuntimeEngine
  compiledScene: CompiledScene
  strapCollections: StrapCollections | undefined
  trackJournal: RuntimeTrackJournal
  functions: CompiledFunctionCollection
  mountTargets: readonly MountTargetDeclaration[]
  materializer: RuntimeMaterializer | undefined
  componentRuntime: RuntimeComponentRuntime | undefined
  stateStore: RuntimeStateStore
  sceneState: RuntimePlayerSceneState
  presentation: RuntimePlayerPresentation
  captureController: RuntimePlayerCaptureController
  seekController: RuntimePlayerSeekController
  eventController: RuntimePlayerEventController
  moduleServiceInstances: Map<string, RuntimeModuleServiceInstance>
  renderSync: RenderSync
  idleMonitor: RuntimeIdleMonitor
  diagnosticOutput: DiagnosticOutput | undefined
  notifyTransportObservers: () => void
  onEngineFrame: (frame: Parameters<RuntimePlayerEventController['onEngineFrame']>[0]) => void
}>

/** Owns lifecycle transitions, transport commands and engine registration. */
export class RuntimePlayerLifecycleController {
  private readonly context: RuntimePlayerLifecycleControllerContext

  /** Creates the lifecycle boundary for one player instance. */
  constructor(context: RuntimePlayerLifecycleControllerContext) {
    this.context = context
  }

  /** Validates capabilities and attaches the player to the shared engine. */
  init(): PlayerInitResult {
    const { context } = this
    const diagnostics = new DiagnosticCollector({ output: context.diagnosticOutput })
    if (context.state.lifecycle !== PLAYER_LIFECYCLE_IDLE) {
      diagnostics.error(
        'RUNTIME_PLAYER_STATE_INVALID',
        'Player can only be initialized from idle state.',
        { context: { state: context.state.lifecycle } },
      )
      return { ok: false, diagnostics: diagnostics.report() }
    }
    for (const issue of validateStrapCollections(
      context.compiledScene,
      context.strapCollections,
      context.functions,
    )) {
      diagnostics.warning(issue.code, issue.message, {
        context: {
          scope: issue.scope,
          storyId: issue.storyId,
          strapName: issue.strapName,
        },
      })
    }
    context.engine.validateRequirements(
      context.compiledScene.requirements,
      diagnostics,
    )
    if (diagnostics.hasErrors()) {
      return { ok: false, diagnostics: diagnostics.report() }
    }

    try {
      const moduleServiceInstances = context.engine.createModuleServiceInstances(
        context.id,
        context.compiledScene,
        context.compiledScene.requirements.modules,
        {
          componentSurfaces: context.componentRuntime?.getComponentSurfaces(),
        },
      )
      context.moduleServiceInstances.clear()
      for (const [id, instance] of moduleServiceInstances) {
        context.moduleServiceInstances.set(id, instance)
      }
    } catch (error) {
      diagnostics.error(
        'RUNTIME_MODULE_INIT_FAILED',
        error instanceof Error
          ? error.message
          : 'Runtime module initialization failed.',
      )
      return { ok: false, diagnostics: diagnostics.report() }
    }

    context.componentRuntime?.setModuleServices(context.moduleServiceInstances)
    if (!this.invokeSceneLifecycleHook('init', diagnostics)) {
      return { ok: false, diagnostics: diagnostics.report() }
    }
    const initialSolvedScene = context.sceneState.reconstructBase(0)
    context.componentRuntime?.sync(initialSolvedScene)
    initializeModuleServices(context.moduleServiceInstances, initialSolvedScene)
    notifyModuleRateChange(context.moduleServiceInstances, context.state.rate)
    context.state.solvedScene = context.sceneState.reconstruct(0)
    context.sceneState.synchronizeFromScene(context.state.solvedScene)
    context.presentation.present(context.state.solvedScene, { moveDeltas: [] })
    collectSolvedMoveDiagnostics(context.state.solvedScene, diagnostics)
    context.engine.registerInstance(context.id, context.onEngineFrame, {
      validateSeek: (timeMs) => context.seekController.validate(timeMs),
      getSeekDiagnostics: () => context.seekController.getDiagnostics(),
      abortSeek: () => context.seekController.abort(),
      prepareSeek: () => context.renderSync.prepareSeek(),
      commitSeek: (timeMs) => context.seekController.commit(timeMs),
      presentSeek: () => context.seekController.present(),
      rollbackSeek: () => context.seekController.rollback(),
    })
    context.state.lifecycle = PLAYER_LIFECYCLE_READY
    return { ok: true, diagnostics: diagnostics.report() }
  }

  /** Starts logical playback without creating a clock or rendering loop. */
  play(): void {
    const { context } = this
    if (context.state.sequenceEnded) {
      this.resetToInitialState()
    }
    this.requireState(PLAYER_LIFECYCLE_READY, PLAYER_LIFECYCLE_PAUSED)
    const wasReady = context.state.lifecycle === PLAYER_LIFECYCLE_READY
    if (wasReady && !this.invokeSceneLifecycleHook('onStart')) {
      throw new Error('RUNTIME_SCENE_LIFECYCLE_FAILED: scene onStart hook failed.')
    }
    context.idleMonitor.reset()
    if (context.state.lifecycle === PLAYER_LIFECYCLE_PAUSED) {
      context.state.skipNextDelta = true
      context.renderSync.resume()
    }
    context.state.lifecycle = PLAYER_LIFECYCLE_PLAYING
    notifyModulePlaybackState(
      context.moduleServiceInstances,
      'playing',
      context.state.currentTimeMs,
    )
    const sequenceEnd = context.eventController.findSequenceEndAt(
      context.state.currentTimeMs,
    )
    if (sequenceEnd === undefined) {
      return
    }
    context.state.currentTimeMs = sequenceEnd.applyAtMs
    context.state.discoveredDurationMs = Math.max(
      context.state.discoveredDurationMs,
      context.state.currentTimeMs,
    )
    void context.eventController
      .dispatchReachedSequenceEnd(sequenceEnd)
      .catch((error) => context.eventController.reportAutomaticSequenceEndFailure(error))
  }

  /** Pauses logical playback at the current engine-provided time. */
  pause(): void {
    const { context } = this
    this.requireSequenceActive('pause')
    this.requireState(PLAYER_LIFECYCLE_PLAYING)
    context.renderSync.pause()
    context.state.lifecycle = PLAYER_LIFECYCLE_PAUSED
    notifyModulePlaybackState(
      context.moduleServiceInstances,
      'paused',
      context.state.currentTimeMs,
    )
  }

  /** Resets the initialized occurrence to its initial logical state. */
  reset(): void {
    const { context } = this
    this.requireState(
      PLAYER_LIFECYCLE_READY,
      PLAYER_LIFECYCLE_PAUSED,
      PLAYER_LIFECYCLE_PLAYING,
    )
    if (context.state.lifecycle === PLAYER_LIFECYCLE_PLAYING) {
      context.renderSync.pause()
      context.state.lifecycle = PLAYER_LIFECYCLE_PAUSED
      notifyModulePlaybackState(
        context.moduleServiceInstances,
        'paused',
        context.state.currentTimeMs,
      )
    }
    this.resetToInitialState()
  }

  /** Changes the player rate without changing its absolute timeline position. */
  setRate(rate: number): void {
    const { context } = this
    this.requireState(
      PLAYER_LIFECYCLE_READY,
      PLAYER_LIFECYCLE_PAUSED,
      PLAYER_LIFECYCLE_PLAYING,
    )
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Player rate must be a finite positive number.')
    }
    context.state.rate = rate
    context.renderSync.rateChange(rate)
    notifyModuleRateChange(context.moduleServiceInstances, rate)
  }

  /** Returns the currently configured player rate. */
  getRate(): number {
    return this.context.state.rate
  }

  /** Positions logical time without replaying events or effects. */
  seek(timeMs: number): PlayerSeekResult {
    const diagnostics = new DiagnosticCollector({ output: () => undefined })
    try {
      const engineResult = this.context.engine.seek([
        { instanceId: this.context.id, timeMs },
      ])
      this.context.idleMonitor.reset()
      return {
        ok: true,
        timeMs,
        diagnostics: engineResult.diagnostics[this.context.id] ?? diagnostics.report(),
      }
    } catch (error) {
      diagnostics.error(
        'RUNTIME_SEEK_FAILED',
        error instanceof Error ? error.message : 'Runtime seek failed.',
      )
      return { ok: false, timeMs, diagnostics: diagnostics.report() }
    }
  }

  /** Detaches the player from the engine and closes its lifecycle. */
  destroy(): void {
    const { context } = this
    if (context.state.lifecycle === PLAYER_LIFECYCLE_DESTROYED) {
      return
    }
    context.captureController.cancelAll()
    context.seekController.abort()
    for (const instance of context.moduleServiceInstances.values()) {
      instance.destroy?.()
    }
    context.moduleServiceInstances.clear()
    context.engine.unregisterInstance(context.id)
    context.renderSync.stop()
    context.materializer?.destroy?.()
    context.componentRuntime?.destroy()
    context.state.lifecycle = PLAYER_LIFECYCLE_DESTROYED
  }

  /** Enforces one valid lifecycle transition. */
  requireState(...allowed: PlayerLifecycleState[]): void {
    if (!allowed.includes(this.context.state.lifecycle)) {
      throw new Error(
        `Player cannot perform this operation from ${this.context.state.lifecycle} state.`,
      )
    }
  }

  /** Rejects commands after the terminal sequence boundary. */
  requireSequenceActive(operation: string): void {
    if (this.context.state.sequenceEnded) {
      throw new Error(`PLAYER_SEQUENCE_ENDED: ${operation} is not allowed after sequence:end.`)
    }
  }

  /** Runs one scene lifecycle callback with the compiled scene contract. */
  invokeSceneLifecycleHook(
    hookName: 'init' | 'onStart' | 'onSequenceEnd',
    diagnostics = new DiagnosticCollector({ output: this.context.diagnosticOutput }),
  ): boolean {
    const reference = this.context.compiledScene.scene[hookName]
    if (reference === undefined) {
      return true
    }
    const hook = this.context.functions[reference.ref]
    if (hook === undefined) {
      diagnostics.error(
        'RUNTIME_SCENE_LIFECYCLE_UNAVAILABLE',
        `Scene lifecycle function is unavailable: ${hookName}.`,
        {
          context: {
            sceneId: this.context.compiledScene.scene.id,
            hookName,
            functionRef: reference.ref,
          },
        },
      )
      return false
    }
    try {
      const scene = this.context.compiledScene.scene as unknown as SceneDoc
      const options: SceneLifecycleOptions = { schedule: () => undefined }
      hook(scene, options)
      return true
    } catch (error) {
      diagnostics.error(
        'RUNTIME_SCENE_LIFECYCLE_FAILED',
        error instanceof Error
          ? error.message
          : `Scene lifecycle function failed: ${hookName}.`,
        {
          context: {
            sceneId: this.context.compiledScene.scene.id,
            hookName,
            functionRef: reference.ref,
          },
        },
      )
      return false
    }
  }

  /** Reconstructs the initial scene before a reset or terminal replay. */
  private resetToInitialState(): void {
    const { context } = this
    const previousSolvedScene = context.state.solvedScene
    context.captureController.cancelAll()
    context.state.sequenceEnded = false
    context.state.sequenceEndPending = false
    context.idleMonitor.reset()
    context.state.currentTimeMs = 0
    context.state.discoveredDurationMs = 0
    context.trackJournal.reset()
    context.trackJournal.reconcileStoryIsolationAt(0)
    context.state.includePersistOnlyInCurrent = true
    context.state.snapshotContribution = undefined
    context.state.skipNextDelta = true
    context.eventController.resetForReplay()
    if (!this.invokeSceneLifecycleHook('init')) {
      throw new Error('RUNTIME_SCENE_LIFECYCLE_FAILED: scene init hook failed during replay.')
    }

    const nextSolvedScene = context.sceneState.reconstruct(0)
    context.sceneState.synchronizeFromScene(nextSolvedScene)
    const moveDeltas = previousSolvedScene === undefined
      ? []
      : diffSolvedScenes(previousSolvedScene, nextSolvedScene)
    notifyModuleMoveDeltas(
      context.moduleServiceInstances,
      previousSolvedScene,
      nextSolvedScene,
      new Set(),
      moveDeltas,
    )
    context.state.solvedScene = nextSolvedScene
    context.presentation.present(nextSolvedScene, {
      previousScene: previousSolvedScene,
      moveDeltas,
      componentPhase: 'seek',
    })
    context.renderSync.seek(
      context.engine.getCurrentNowMs(),
      context.state.currentTimeMs,
    )
    context.state.lifecycle = PLAYER_LIFECYCLE_READY
    context.notifyTransportObservers()
  }
}
