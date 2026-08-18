import {
  diffSolvedScenes,
  prepareMoveFlipTransition,
  type MoveFlipCaptureBuilder,
  type MoveStateDelta,
  type MoveTransitionOccurrence,
  type SolvedScene,
} from '../player'
import type { HtmlFlipRuntime, FlipCapture } from '../flip'

/** Minimal player surface required by the compiled cold capture resolver. */
export type HtmlHistoricalPlayer = Readonly<{
  getActiveMoveTransitionOccurrences: (timeMs: number) => readonly MoveTransitionOccurrence[]
  resolveSceneAt: (timeMs: number) => SolvedScene
  getSolvedScene: () => SolvedScene | undefined
}>

/** Dependencies required to realize one compiled move without browser history. */
export type HtmlCompiledMoveCaptureResolverOptions = Readonly<{
  player: HtmlHistoricalPlayer
  flipRuntime: Pick<HtmlFlipRuntime, 'capture'>
  captureBuilder: MoveFlipCaptureBuilder
  presentHistoricalScene: (scene: SolvedScene) => void
}>

/** Realizes one active compiled move from historical logical scenes. */
export function resolveCompiledMoveCapture(
  options: HtmlCompiledMoveCaptureResolverOptions,
  timeMs: number,
): FlipCapture | undefined {
  const occurrence = options.player.getActiveMoveTransitionOccurrences(timeMs)
    .filter((candidate) => candidate.startAt > 0)
    .at(-1)
  if (occurrence === undefined) return undefined

  const previousScene = options.player.resolveSceneAt(Math.max(0, occurrence.startAt - 0.0001))
  const nextScene = options.player.resolveSceneAt(occurrence.startAt)
  const delta = createHistoricalMoveDelta(
    previousScene,
    nextScene,
    occurrence.persoKey,
    occurrence.transition,
    occurrence.startAt,
    occurrence.flipMode,
  )
  if (delta === undefined) return undefined
  const preparedTransition = prepareMoveFlipTransition(occurrence.transition)
  if (preparedTransition === undefined) return undefined
  const description = options.captureBuilder({
    previousScene,
    nextScene,
    deltas: [delta],
    preparedTransitions: new Map([[occurrence.persoKey, preparedTransition]]),
  })
  if (description === undefined) return undefined

  const currentScene = options.player.getSolvedScene()
  if (currentScene === undefined) return undefined
  options.presentHistoricalScene(previousScene)
  try {
    const captured = options.flipRuntime.capture({
      ...description,
      captureId: occurrence.captureId,
      mutate: () => options.presentHistoricalScene(nextScene),
    })
    if (!captured.ok) throw new Error(captured.diagnostics.errors.map((entry) => entry.message).join('\n'))
    return captured.value
  } finally {
    options.presentHistoricalScene(currentScene)
  }
}

/** Builds one historical move delta even when endpoint placement is unchanged. */
function createHistoricalMoveDelta(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  persoKey: string,
  transition: MoveStateDelta['transition'],
  transitionStartAt: number,
  flipMode: MoveStateDelta['flipMode'],
): MoveStateDelta | undefined {
  const existing = diffSolvedScenes(previousScene, nextScene).find((delta) => delta.persoKey === persoKey)
  if (existing !== undefined) return { ...existing, transition, transitionStartAt, flipMode }
  const beforePlacement = previousScene.persos[persoKey]?.placement
  const afterPlacement = nextScene.persos[persoKey]?.placement
  if (beforePlacement?.mounted !== true || afterPlacement?.mounted !== true) return undefined
  return {
    operation: 'move',
    persoKey,
    fromTargetId: beforePlacement.targetId,
    toTargetId: afterPlacement.targetId,
    mountedBefore: true,
    mountedAfter: true,
    fromPlacement: beforePlacement,
    toPlacement: afterPlacement,
    transition,
    transitionStartAt,
    flipMode,
  }
}
