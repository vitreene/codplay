import {
  diffSolvedScenes,
  prepareMoveFlipTransition,
  type MoveFlipCaptureBuilder,
  type MoveStateDelta,
  type MoveTransitionOccurrence,
  type SolvedScene,
} from '../player'
import type { FlipCapture, FlipCaptureMetadata, HtmlFlipRuntime } from '../flip'
import type { MoveFlipCaptureDescription } from '../player'
import type { RuntimeModuleLayoutProjectionState } from '../engine'
import type { HtmlPresentationTransaction } from './html-presentation-transaction'

/** Minimal player surface required by the compiled cold capture resolver. */
export type HtmlHistoricalPlayer = Readonly<{
  getActiveMoveTransitionOccurrences: (timeMs: number) => readonly MoveTransitionOccurrence[]
  getMoveTransitionOccurrencesStartingBetween?: (
    startExclusive: number,
    endInclusive: number,
  ) => readonly MoveTransitionOccurrence[]
  resolveSceneAt: (timeMs: number) => SolvedScene
  getSolvedScene: () => SolvedScene | undefined
  getHistoricalLayoutProjectionState?: (scene: SolvedScene) => RuntimeModuleLayoutProjectionState | undefined
}>

/** Dependencies required to realize one compiled move without browser history. */
export type HtmlCompiledMoveCaptureResolverOptions = Readonly<{
  player: HtmlHistoricalPlayer
  flipRuntime: Readonly<{
    recordMeasurementTree: HtmlFlipRuntime['recordMeasurementTree']
    prepareCapture?: HtmlFlipRuntime['prepareCapture']
  }>
  captureBuilder: MoveFlipCaptureBuilder
  presentHistoricalScene: (scene: SolvedScene) => void
  /** Captures immutable FIRST overlay subtrees while the source scene is installed. */
  captureFirstOverlayTemplates?: (description: MoveFlipCaptureDescription) => ReadonlyMap<string, unknown>
  presentationTransaction: Pick<HtmlPresentationTransaction, 'measure'>
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
  const realizedCaptureIds = new Set<string>()
  for (const occurrence of occurrences) {
    if (occurrence.startAt <= 0 || realizedCaptureIds.has(occurrence.captureId)) continue
    realizedCaptureIds.add(occurrence.captureId)
    const capture = realizeCompiledMoveCapture(options, occurrence, timeMs)
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
): FlipCapture | undefined {
  const sourceTimeMs = occurrence.sourceTimeMs ?? Math.max(0, occurrence.startAt - 0.0001)
  const destinationTimeMs = occurrence.destinationTimeMs ?? occurrence.startAt
  const lastTimeMs = occurrence.endAt

  const previousScene = options.player.resolveSceneAt(sourceTimeMs)
  const nextScene = options.player.resolveSceneAt(destinationTimeMs)
  const lastScene = options.player.resolveSceneAt(lastTimeMs)
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
  const historicalLayoutState = options.player.getHistoricalLayoutProjectionState?.(nextScene)
  const touchedItemIds = resolveHistoricalTouchedItemIds(historicalLayoutState, delta)
  const filteredTouchedItemIds = touchedItemIds === undefined
    ? undefined
    : filterConcurrentActiveItems(
      touchedItemIds,
      resolveConcurrentActiveItemIds(options.player, occurrence),
      occurrence.persoKey,
    )
  const description = options.captureBuilder({
    previousScene,
    nextScene,
    deltas: [delta],
    preparedTransitions: new Map([[occurrence.persoKey, preparedTransition]]),
    ...(filteredTouchedItemIds === undefined
      ? {}
      : { touchedItemIds: filteredTouchedItemIds }),
  })
  if (description === undefined) return undefined

  let overlayTemplates: ReadonlyMap<string, unknown> | undefined
  const tree = options.presentationTransaction.measure({
    description,
    logicalTimeMs: timeMs,
    prepareFirst: () => {
      options.presentHistoricalScene(previousScene)
      prepareActiveOverlays(options, description.hostContextId, description.projectionEpoch, description.startAt)
    },
    captureFirst: () => {
      overlayTemplates = options.captureFirstOverlayTemplates?.(description)
    },
    presentLast: () => {
      // LAST is the terminal phase of this capture. Active parents are
      // presented at that same absolute time, even when their own interval
      // has a different duration.
      options.presentHistoricalScene(lastScene)
      prepareActiveOverlays(options, description.hostContextId, description.projectionEpoch, lastTimeMs)
    },
    restoreAfter: true,
  })
  const metadata: FlipCaptureMetadata = {
    captureId: occurrence.captureId,
    startAt: occurrence.startAt,
    duration: occurrence.transition.duration ?? description.duration,
    ...(description.ease === undefined ? {} : { ease: description.ease }),
  }
  const captured = options.flipRuntime.recordMeasurementTree(tree, metadata, {
    ...(overlayTemplates === undefined ? {} : { overlayTemplates }),
  })
  if (!captured.ok) throw new Error(captured.diagnostics.errors.map((entry) => entry.message).join('\n'))
  return captured.value
}

/** Uses a list-owned touched set only when the occurrence targets that list. */
function resolveHistoricalTouchedItemIds(
  state: RuntimeModuleLayoutProjectionState | undefined,
  delta: MoveStateDelta,
): readonly string[] | undefined {
  const childrenByTarget = state?.childrenByTarget
  if (childrenByTarget === undefined) return undefined
  const targetIds = [delta.fromTargetId, delta.toTargetId]
  return targetIds.some((targetId) => targetId !== undefined
    && Object.prototype.hasOwnProperty.call(childrenByTarget, targetId))
    ? state?.touchedItemIds ?? []
    : undefined
}

/** Returns direct movers already owned by another capture at one overlap instant. */
function resolveConcurrentActiveItemIds(
  player: HtmlHistoricalPlayer,
  occurrence: MoveTransitionOccurrence,
): ReadonlySet<string> {
  const active = player.getActiveMoveTransitionOccurrences(occurrence.startAt)
  const future = player.getMoveTransitionOccurrencesStartingBetween?.(occurrence.startAt, occurrence.endAt) ?? []
  return new Set(
    [...active, ...future]
      .filter((candidate) => candidate.captureId !== occurrence.captureId)
      .map((candidate) => candidate.persoKey),
  )
}

/** Preserves an active item's existing capture while retaining the new direct mover. */
function filterConcurrentActiveItems(
  touchedItemIds: readonly string[],
  concurrentActiveItemIds: ReadonlySet<string>,
  directMoverId: string,
): readonly string[] {
  return [...new Set(touchedItemIds.filter((itemId) => itemId === directMoverId || !concurrentActiveItemIds.has(itemId)))]
}

/** Reprojects already-active world overlays around one historical read phase. */
function prepareActiveOverlays(
  options: HtmlCompiledMoveCaptureResolverOptions,
  hostContextId: string,
  projectionEpoch: number,
  timeMs: number,
): void {
  const prepared = options.flipRuntime.prepareCapture?.(hostContextId, projectionEpoch, timeMs)
  if (prepared !== undefined && !prepared.ok) {
    throw new Error(prepared.diagnostics.errors.map((entry) => entry.message).join('\n'))
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
