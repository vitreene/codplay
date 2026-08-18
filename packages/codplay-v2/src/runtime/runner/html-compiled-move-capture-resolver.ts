import {
  diffSolvedScenes,
  prepareMoveFlipTransition,
  type MoveFlipCaptureBuilder,
  type MoveStateDelta,
  type MoveTransitionOccurrence,
  type SolvedScene,
} from '../player'
import type { FlipCapture, FlipCaptureMetadata, HtmlFlipRuntime } from '../flip'
import type { HtmlPresentationTransaction } from './html-presentation-transaction'

/** Minimal player surface required by the compiled cold capture resolver. */
export type HtmlHistoricalPlayer = Readonly<{
  getActiveMoveTransitionOccurrences: (timeMs: number) => readonly MoveTransitionOccurrence[]
  resolveSceneAt: (timeMs: number) => SolvedScene
  getSolvedScene: () => SolvedScene | undefined
}>

/** Dependencies required to realize one compiled move without browser history. */
export type HtmlCompiledMoveCaptureResolverOptions = Readonly<{
  player: HtmlHistoricalPlayer
  flipRuntime: Readonly<{
    capture?: HtmlFlipRuntime['capture']
    recordMeasurementTree?: HtmlFlipRuntime['recordMeasurementTree']
  }>
  captureBuilder: MoveFlipCaptureBuilder
  presentHistoricalScene: (scene: SolvedScene) => void
  presentationTransaction?: Pick<HtmlPresentationTransaction, 'measure'>
}>

/** Realizes every active compiled move from historical logical scenes. */
export function resolveCompiledMoveCaptures(
  options: HtmlCompiledMoveCaptureResolverOptions,
  timeMs: number,
  occurrences = options.player.getActiveMoveTransitionOccurrences(timeMs),
): readonly FlipCapture[] {
  const currentScene = options.player.getSolvedScene()
  if (currentScene === undefined) return []
  const captures: FlipCapture[] = []
  for (const occurrence of occurrences.filter((candidate) => candidate.startAt > 0)) {
    const capture = realizeCompiledMoveCapture(options, occurrence, timeMs, currentScene)
    if (capture !== undefined) captures.push(capture)
  }
  return captures
}

/** Realizes one active compiled move from historical logical scenes. */
export function resolveCompiledMoveCapture(
  options: HtmlCompiledMoveCaptureResolverOptions,
  timeMs: number,
): FlipCapture | undefined {
  return resolveCompiledMoveCaptures(options, timeMs).at(-1)
}

/** Measures and persists one occurrence through the shared HTML transaction. */
function realizeCompiledMoveCapture(
  options: HtmlCompiledMoveCaptureResolverOptions,
  occurrence: MoveTransitionOccurrence,
  timeMs: number,
  currentScene: SolvedScene,
): FlipCapture | undefined {
  const sourceTimeMs = occurrence.sourceTimeMs ?? Math.max(0, occurrence.startAt - 0.0001)
  const destinationTimeMs = occurrence.destinationTimeMs ?? occurrence.startAt

  const previousScene = options.player.resolveSceneAt(sourceTimeMs)
  const nextScene = options.player.resolveSceneAt(destinationTimeMs)
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

  if (options.presentationTransaction !== undefined && options.flipRuntime.recordMeasurementTree !== undefined) {
    const tree = options.presentationTransaction.measure({
      description,
      logicalTimeMs: timeMs,
      prepareFirst: () => options.presentHistoricalScene(previousScene),
      presentLast: () => options.presentHistoricalScene(nextScene),
      restoreAfter: true,
    })
    const metadata: FlipCaptureMetadata = {
      captureId: occurrence.captureId,
      startAt: occurrence.startAt,
      duration: occurrence.transition.duration ?? description.duration,
      ...(description.ease === undefined ? {} : { ease: description.ease }),
    }
    const captured = options.flipRuntime.recordMeasurementTree(tree, metadata)
    if (!captured.ok) throw new Error(captured.diagnostics.errors.map((entry) => entry.message).join('\n'))
    return captured.value
  }

  if (options.flipRuntime.capture === undefined) return undefined
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
