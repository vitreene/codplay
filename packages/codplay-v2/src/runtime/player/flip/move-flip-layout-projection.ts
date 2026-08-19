import type { MoveStateDelta } from '../../move'
import type { FlipCaptureRequest, HtmlFlipOverlayContentState, HtmlFlipRuntime } from '../../flip'
import type { LayoutProjection, LayoutProjectionContext } from '../layout-projection'
import type { SolvedScene } from '../pipeline'
import type { PreparedMoveFlipTransition } from './move-flip-transition'

/** Capture description built from one solved move transaction. */
export type MoveFlipCaptureDescription = Omit<FlipCaptureRequest, 'mutate'> & Readonly<{
  /** Stable compiled occurrence identities covered by one grouped capture. */
  sourceCaptureIds?: readonly string[]
}>

/** Builds the FLIP capture boundary for one solved move interval. */
export type MoveFlipCaptureBuilder = (input: Readonly<{
  previousScene: SolvedScene
  nextScene: SolvedScene
  deltas: readonly MoveStateDelta[]
  preparedTransitions: ReadonlyMap<string, PreparedMoveFlipTransition>
  touchedItemIds?: readonly string[]
}>) => MoveFlipCaptureDescription | undefined

/** Options for the single state-to-presentation projection boundary. */
export type MoveFlipLayoutProjectionOptions = Readonly<{
  base: LayoutProjection
  flip: HtmlFlipRuntime
  hostContextId: string
  getProjectionEpoch: () => number
}>

/**
 * Presents solved snapshots and delegates every capture to HtmlFlipRuntime's
 * one historical resolver. Play and seek consequently use the same commit.
 */
export class MoveFlipLayoutProjection implements LayoutProjection {
  private readonly base: LayoutProjection
  private readonly flip: HtmlFlipRuntime
  private readonly hostContextId: string
  private readonly getProjectionEpoch: () => number

  /** Creates one move-aware projection around an existing structural backend. */
  constructor(options: MoveFlipLayoutProjectionOptions) {
    this.base = options.base
    this.flip = options.flip
    this.hostContextId = options.hostContextId
    this.getProjectionEpoch = options.getProjectionEpoch
  }

  /** Commits one solved presentation and resolves active captures uniformly. */
  project(scene: SolvedScene, context: LayoutProjectionContext = { moveDeltas: [] }): void {
    this.base.project(scene, context)
    this.flip.setOverlayContentState(createHtmlFlipOverlayContentState(scene))
    this.presentAt(scene.timeMs)
  }

  /** Releases the wrapped projection and all FLIP-owned transient resources. */
  destroy(): void {
    this.flip.destroy()
    this.base.destroy?.()
  }

  /** Resolves cached or historical captures at one absolute logical time. */
  private presentAt(timeMs: number): void {
    this.flip.seekCached(this.hostContextId, this.getProjectionEpoch(), timeMs)
  }
}

/** Builds one logical descendant snapshot for every mounted overlay-capable perso. */
export function createHtmlFlipOverlayContentState(scene: SolvedScene): HtmlFlipOverlayContentState {
  const descendantsByOverlay: Record<string, readonly string[]> = {}
  const targetByItem: Record<string, string> = {}

  for (const perso of Object.values(scene.persos)) {
    if (!perso.placement.mounted) continue
    const targetId = scene.graph.targetByPerso[perso.key]
    if (targetId !== undefined) targetByItem[perso.key] = targetId
  }

  for (const perso of Object.values(scene.persos)) {
    if (!perso.placement.mounted) continue
    const descendants: string[] = []
    const pending = [...(scene.graph.childrenByParent[perso.key] ?? [])]
    const visited = new Set<string>()
    while (pending.length > 0) {
      const itemId = pending.shift()!
      if (visited.has(itemId)) continue
      visited.add(itemId)
      if (scene.persos[itemId]?.placement.mounted === true) descendants.push(itemId)
      pending.push(...(scene.graph.childrenByParent[itemId] ?? []))
    }
    if (descendants.length > 0) descendantsByOverlay[perso.key] = descendants
  }

  return { descendantsByOverlay, targetByItem }
}
