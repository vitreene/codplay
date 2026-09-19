import type { RuntimeExternalPresentationHandle } from '../../engine'
import type { RuntimeComponentRuntime } from '../../components'
import type { RuntimeMaterializer } from '../../materializer'
import type { RuntimePlayerRefreshOptions } from './player-types'
import type { SolvedScene } from '../pipeline'
import type { RuntimePlayerPresentation } from './presentation'
import type { RuntimePlayerState } from './player-state'

/** Dependencies for player-owned presentation commands. */
export type RuntimePlayerPresentationControllerContext = Readonly<{
  state: RuntimePlayerState
  componentRuntime: RuntimeComponentRuntime | undefined
  materializer: RuntimeMaterializer | undefined
  presentation: RuntimePlayerPresentation
  isReadyForPresentation: () => boolean
}> 

/** Owns refresh and host-facing presentation operations. */
export class RuntimePlayerPresentationController {
  private readonly context: RuntimePlayerPresentationControllerContext

  /** Creates the presentation-command boundary for one player. */
  constructor(context: RuntimePlayerPresentationControllerContext) {
    this.context = context
  }

  /** Presents one solved scene for runner-owned geometry capture. */
  presentSceneForGeometryCapture(scene: SolvedScene): void {
    if (!this.context.isReadyForPresentation()) {
      throw new Error('Geometry capture requires an initialized runtime player.')
    }
    this.context.presentation.presentForGeometryCapture(scene)
  }

  /** Prepares a module-owned presentation around an external host operation. */
  prepareExternalPresentation(
    componentId: string,
    kind: string,
    options?: unknown,
  ): RuntimeExternalPresentationHandle | undefined {
    if (!this.context.isReadyForPresentation()) {
      return undefined
    }
    return this.context.componentRuntime?.prepareExternalPresentation({
      componentId,
      kind,
      ...(options === undefined ? {} : { options }),
      timeMs: this.context.state.currentTimeMs,
    })
  }

  /** Reapplies the current scene after a materializer-context change. */
  refresh(options: RuntimePlayerRefreshOptions = {}): void {
    const scene = this.context.state.solvedScene
    if (scene === undefined) {
      throw new Error('Player has not been initialized.')
    }
    this.context.componentRuntime?.sync(scene, true)
    this.context.presentation.present(scene, {
      previousScene: scene,
      moveDeltas: [],
      ...(options.emitMotionOccurrences === true ? { forceMotionOccurrences: true } : {}),
    })
  }
}
