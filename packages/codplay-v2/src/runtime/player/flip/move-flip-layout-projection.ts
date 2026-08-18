import type { MoveStateDelta } from '../../move'
import type { FlipCapture, FlipCaptureRequest, FlipOperationResult, HtmlFlipRuntime } from '../../flip'
import type { LayoutProjection, LayoutProjectionContext } from '../layout-projection'
import type { SolvedScene } from '../pipeline'
import { prepareMoveFlipTransition, type PreparedMoveFlipTransition } from './move-flip-transition'

/** Capture description built from one solved move transaction. */
export type MoveFlipCaptureDescription = Omit<FlipCaptureRequest, 'mutate'>

/** Builds the FLIP capture boundary for one move projection. */
export type MoveFlipCaptureBuilder = (input: Readonly<{
  previousScene: SolvedScene
  nextScene: SolvedScene
  deltas: readonly MoveStateDelta[]
  preparedTransitions: ReadonlyMap<string, PreparedMoveFlipTransition>
  touchedItemIds?: readonly string[]
}>) => MoveFlipCaptureDescription | undefined

/** Presents the LAST scene and returns a capture measured by one host transaction. */
export type MoveFlipCapturePresenter = (input: Readonly<{
  description: MoveFlipCaptureDescription
  scene: SolvedScene
  context: LayoutProjectionContext
  presentNext: () => void
}>) => FlipOperationResult<FlipCapture>

/** Options for composing a move-aware FLIP projection around a base projection. */
export type MoveFlipLayoutProjectionOptions = Readonly<{
  base: LayoutProjection
  flip: HtmlFlipRuntime
  hostContextId: string
  getProjectionEpoch: () => number
  buildCapture: MoveFlipCaptureBuilder
  presentCapture?: MoveFlipCapturePresenter
}>

/**
 * Wraps one layout projection so move deltas are captured before parentage is
 * projected and advanced through the same runtime on later frames.
 */
export class MoveFlipLayoutProjection implements LayoutProjection {
  private readonly base: LayoutProjection
  private readonly flip: HtmlFlipRuntime
  private readonly hostContextId: string
  private readonly getProjectionEpoch: () => number
  private readonly buildCapture: MoveFlipCaptureBuilder
  private readonly presentCapture: MoveFlipCapturePresenter | undefined
  private activeUntil: number | undefined
  private lastPresentedTimeMs: number | undefined

  /** Creates one move/FLIP boundary around an existing layout projection. */
  constructor(options: MoveFlipLayoutProjectionOptions) {
    this.base = options.base
    this.flip = options.flip
    this.hostContextId = options.hostContextId
    this.getProjectionEpoch = options.getProjectionEpoch
    this.buildCapture = options.buildCapture
    this.presentCapture = options.presentCapture
  }

  /** Captures a frame move before delegating the actual parentage mutation. */
  project(scene: SolvedScene, context: LayoutProjectionContext = { phase: 'frame', moveDeltas: [] }): void {
    if (context.phase === 'seek') {
      this.projectSeek(scene, context)
      return
    }

    if (context.previousScene === undefined || context.moveDeltas.length === 0) {
      this.base.project(scene, context)
      return
    }

    const description = this.prepareCapture(scene, context)
    if (description === undefined) {
      this.activeUntil = undefined
      this.flip.cancel()
      this.base.project(scene, context)
      return
    }

    let delegated = false
    const presentNext = () => {
      delegated = true
      this.base.project(scene, context)
    }
    let result: FlipOperationResult<FlipCapture>
    try {
      result = this.presentCapture === undefined
        ? this.flip.capture({ ...description, mutate: presentNext })
        : this.presentCapture({ description, scene, context, presentNext })
    } catch {
      if (!delegated) this.base.project(scene, context)
      this.activeUntil = undefined
      return
    }
    if (!result.ok && !delegated) this.base.project(scene, context)
    if (!result.ok) {
      this.activeUntil = undefined
      return
    }
    const presented = this.flip.seek(result.value, scene.timeMs)
    if (!presented.ok) {
      this.activeUntil = undefined
      return
    }
    this.activeUntil = result.value.endAt
    this.lastPresentedTimeMs = scene.timeMs
  }

  /** Advances the active FLIP capture without creating a second clock. */
  advance(timeMs: number): void {
    if (this.activeUntil === undefined) return
    if (this.lastPresentedTimeMs === timeMs) return
    if (timeMs > this.activeUntil) {
      this.flip.cancel()
      this.activeUntil = undefined
      this.lastPresentedTimeMs = timeMs
      return
    }
    const result: FlipOperationResult<void> = this.flip.seekCached(
      this.hostContextId,
      this.getProjectionEpoch(),
      timeMs,
    )
    if (!result.ok) this.activeUntil = undefined
    else this.lastPresentedTimeMs = timeMs
  }

  /** Releases the wrapped projection and any active FLIP ownership. */
  destroy(): void {
    this.activeUntil = undefined
    this.lastPresentedTimeMs = undefined
    this.flip.cancel()
    this.base.destroy?.()
  }

  /** Reconstructs one seek state and presents only a persisted FLIP capture. */
  private projectSeek(scene: SolvedScene, context: LayoutProjectionContext): void {
    this.activeUntil = undefined
    this.lastPresentedTimeMs = undefined
    this.flip.cancel()
    this.base.project(scene, context)
    this.presentCached(scene.timeMs)
  }

  /** Prepares a capture description from one projection context. */
  private prepareCapture(scene: SolvedScene, context: LayoutProjectionContext): MoveFlipCaptureDescription | undefined {
    if (context.previousScene === undefined || context.moveDeltas.length === 0) return undefined
    const preparedTransitions = new Map<string, PreparedMoveFlipTransition>()
    for (const delta of context.moveDeltas) {
      const transition = prepareMoveFlipTransition(delta.transition)
      if (transition !== undefined) preparedTransitions.set(delta.persoKey, transition)
    }
    return this.buildCapture({
      previousScene: context.previousScene,
      nextScene: scene,
      deltas: context.moveDeltas,
      preparedTransitions,
      touchedItemIds: context.layoutState?.touchedItemIds,
    })
  }

  /** Presents a cached capture at a seek time when its interval is active. */
  private presentCached(timeMs: number): void {
    const result = this.flip.seekCached(this.hostContextId, this.getProjectionEpoch(), timeMs)
    if (!result.ok) {
      this.activeUntil = undefined
      return
    }
    this.activeUntil = this.flip.getActiveEndAt(this.hostContextId, this.getProjectionEpoch(), timeMs)
    this.lastPresentedTimeMs = timeMs
  }
}
