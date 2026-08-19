import type { LayoutProjection, LayoutProjectionContext } from '../player/layout-projection'
import type { SolvedScene } from '../player/pipeline'

/** Projects logical structure first, then one absolute-time motion frame. */
export class MotionLayoutProjection implements LayoutProjection {
  private readonly base: LayoutProjection
  private readonly presentMotion: (timeMs: number) => void

  /** Creates the single presentation boundary shared by Play and Seek. */
  constructor(base: LayoutProjection, presentMotion: (timeMs: number) => void) {
    this.base = base
    this.presentMotion = presentMotion
  }

  /** Commits authored structure and resolves motion at the same absolute time. */
  project(scene: SolvedScene, context: LayoutProjectionContext = { moveDeltas: [] }): void {
    this.base.project(scene, context)
    this.presentMotion(scene.timeMs)
  }

  /** Releases the structural projection. */
  destroy(): void {
    this.base.destroy?.()
  }
}
