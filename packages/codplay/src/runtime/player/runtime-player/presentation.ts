import type { PlayerLifecycleState } from '../../config/player-lifecycle'
import type { RuntimeModuleServiceInstance } from '../../engine'
import type { RuntimeComponentRuntime } from '../../components'
import type { RuntimeMaterializer, RuntimeMaterializerSceneContext } from '../../materializer'
import type { RuntimeSnapshotContribution, SolvedScene } from '../pipeline'
import { notifyModuleScenePresented } from '../modules'
import type { RuntimePlayerSceneState } from './scene-state'
import { collectMoveOccurrences } from './motion-occurrences'

/** Adds player-local controls to one materializer presentation. */
export type RuntimePlayerMaterializationContext = RuntimeMaterializerSceneContext & Readonly<{
  forceMotionOccurrences?: boolean
  /** Controls whether component module presentation hooks may start effects. */
  componentPhase?: 'normal' | 'seek' | 'geometry-capture'
}>

/** Dependencies used to present solved scenes without owning player state. */
export type RuntimePlayerPresentationContext = Readonly<{
  componentRuntime: RuntimeComponentRuntime | undefined
  materializer: RuntimeMaterializer | undefined
  moduleServiceInstances: ReadonlyMap<string, RuntimeModuleServiceInstance>
  sceneState: RuntimePlayerSceneState
  getLifecycleState: () => PlayerLifecycleState
  getIncludePersistOnly: () => boolean
  getSnapshotContribution: () => RuntimeSnapshotContribution | undefined
  applyLiveCaptureActions: (scene: SolvedScene) => void
}>

/** Owns component, module and materializer presentation of one solved scene. */
export class RuntimePlayerPresentation {
  private readonly context: RuntimePlayerPresentationContext

  /** Creates the presentation boundary around one player instance. */
  constructor(context: RuntimePlayerPresentationContext) {
    this.context = context
  }

  /** Presents one solved scene through the component and materializer boundaries. */
  present(scene: SolvedScene, materialization: RuntimePlayerMaterializationContext): void {
    const { componentRuntime, materializer } = this.context
    componentRuntime?.sync(scene, false, {
      phase: materialization.componentPhase
        ?? (materialization.phase === 'geometry-capture' ? 'geometry-capture' : 'normal'),
    })
    notifyModuleScenePresented(
      this.context.moduleServiceInstances,
      scene,
      this.context.getLifecycleState() === 'playing' ? 'playing' : 'paused',
    )
    this.context.applyLiveCaptureActions(scene)
    componentRuntime?.presentAt?.(scene.timeMs)
    const motionOccurrences = materialization.phase === 'geometry-capture'
      ? []
      : collectMoveOccurrences(
        materialization.previousScene,
        scene,
        materialization.forceMotionOccurrences === true
          ? {
            forceActive: true,
            resolveBeforeScene: (timeMs) => this.context.sceneState.reconstructBeforeBoundary(
              timeMs,
              this.context.getIncludePersistOnly(),
            ),
          }
          : undefined,
      )
    materializer?.materializeScene(
      scene,
      motionOccurrences.length === 0
        ? materialization
        : { ...materialization, motionOccurrences },
    )
  }

  /** Presents one scene for geometry capture without playback side effects. */
  presentForGeometryCapture(scene: SolvedScene): void {
    this.context.componentRuntime?.sync(scene, false, { phase: 'geometry-capture' })
    this.context.componentRuntime?.presentAt?.(scene.timeMs)
    this.context.materializer?.materializeScene(scene, {
      moveDeltas: [],
      phase: 'geometry-capture',
    })
  }

  /** Replays component presentation boundaries required before a seek commit. */
  replayForSeek(targetScene: SolvedScene): void {
    const { componentRuntime, materializer } = this.context
    if (componentRuntime === undefined) return

    const initialScene = this.context.sceneState.reconstructBeforeBoundary(
      0,
      this.context.getIncludePersistOnly(),
    )
    componentRuntime.sync(initialScene, false, { phase: 'geometry-capture' })
    materializer?.materializeScene(initialScene, {
      moveDeltas: [],
      phase: 'geometry-capture',
    })

    for (const timeMs of this.context.sceneState.getLogicalEvaluationBoundaries()) {
      if (timeMs <= 0 || timeMs >= targetScene.timeMs) continue
      const scene = this.context.sceneState.reconstruct(
        timeMs,
        this.context.getIncludePersistOnly(),
        this.context.getSnapshotContribution(),
      )
      componentRuntime.presentAt?.(timeMs)
      componentRuntime.sync(scene, false, { phase: 'seek' })
      materializer?.materializeScene(scene, {
        moveDeltas: [],
        phase: 'geometry-capture',
      })
      componentRuntime.presentAt?.(timeMs)
    }
  }
}
