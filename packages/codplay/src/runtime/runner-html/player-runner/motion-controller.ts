import { compareNumberPaths } from '../../../shared'
import type { CompiledScene } from '../../../scene/compiled'
import type { RuntimeMaterializerSceneContext, RuntimeMoveOccurrence } from '../../materializer'
import type { SolvedScene } from '../../player'
import type {
  LayoutSnapshot,
  MotionBoundary,
  PresentationFrame,
  ScheduledMotionIntent,
} from '../../motion'
import { createScheduledMotionIntent } from '../../motion'
import { HtmlMotionPresentationHost } from '../motion-presentation-host'
import {
  captureCurrentHtmlMotionLayout,
  captureHtmlLiveMotionBoundary,
  captureHtmlMotionBoundaries,
  createMotionFirstSnapshotKey,
  mergeCurrentPresentationPoses,
  resolveHtmlMotionActionTransition,
} from '../motion-capture'
import { HtmlMotionSystem } from '../motion-system'
import type {
  HtmlPlayerMotionContext,
  MotionBoundaryRebuildOptions,
} from './runner-types'

/** Reversible state retained while the player enters a seek capture window. */
export type HtmlPlayerMotionSeekState = Readonly<{
  replayBoundaries: readonly MotionBoundary[]
  presentationBoundaries: readonly MotionBoundary[]
  timeMs: number
}>

/** Owns occurrence-driven HTML geometry capture and motion presentation. */
export class HtmlPlayerMotionController {
  private readonly context: HtmlPlayerMotionContext
  private readonly motionStoryByItemId: ReadonlyMap<string, string>
  private motionSystem: HtmlMotionSystem | undefined
  private replayMotionBoundaries: readonly MotionBoundary[] = []
  private presentationMotionBoundaries: readonly MotionBoundary[] = []
  private rebuildingMotion = false
  private readonly liveFirstLayouts = new Map<string, {
    persoKey: string
    timeMs: number
    snapshot: LayoutSnapshot
    before: SolvedScene
    presentationFrame: PresentationFrame | undefined
  }>()
  private readonly liveCaptureOccurrences = new Map<string, readonly RuntimeMoveOccurrence[]>()

  /** Creates the motion boundary for one visible HTML player. */
  constructor(context: HtmlPlayerMotionContext) {
    this.context = context
    this.motionStoryByItemId = createMotionStoryIndex(context.compiledScene)
  }

  /** Presents the current numeric frame after player initialization. */
  init(): void {
    this.motionSystem?.present(this.context.getCurrentTimeMs())
  }

  /** Returns the latest numeric presentation frame. */
  getPresentationFrame(): PresentationFrame | undefined {
    return this.motionSystem?.getFrame()
  }

  /** Exposes the internal presenter to existing motion regression probes. */
  getMotionSystem(): HtmlMotionSystem | undefined {
    return this.motionSystem
  }

  /** Exposes captured boundaries to existing motion regression probes. */
  getPresentationMotionBoundaries(): readonly MotionBoundary[] {
    return this.presentationMotionBoundaries
  }

  /** Reports whether any motion geometry has been captured. */
  hasCapturedMotionBoundaries(): boolean {
    return this.replayMotionBoundaries.length > 0
      || this.presentationMotionBoundaries.length > 0
  }

  /** Prepares authored nodes before a geometry capture. */
  prepareGeometryCapture(): void {
    this.motionSystem?.prepareGeometryCapture()
  }

  /** Starts the runner-side part of one player seek transaction. */
  prepareSeek(timeMs: number): HtmlPlayerMotionSeekState {
    this.clearLiveCaptureState()
    const previous = {
      replayBoundaries: this.replayMotionBoundaries,
      presentationBoundaries: this.presentationMotionBoundaries,
      timeMs: this.context.getCurrentTimeMs(),
    }
    this.motionSystem?.prepareSeek()
    if (this.motionSystem !== undefined) {
      this.pruneMotionGroupsBeforeSeek(timeMs)
      this.presentationMotionBoundaries = this.replayMotionBoundaries
      this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
    }
    return Object.freeze(previous)
  }

  /** Restores the last committed motion graph after a failed seek. */
  restoreSeek(state: HtmlPlayerMotionSeekState): void {
    this.replayMotionBoundaries = state.replayBoundaries
    this.presentationMotionBoundaries = state.presentationBoundaries
    if (this.motionSystem === undefined) {
      return
    }
    this.motionSystem.clearTransientPresentation()
    this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
    this.motionSystem.present(state.timeMs)
  }

  /** Completes the runner-side seek transaction. */
  completeSeek(): void {
    this.motionSystem?.completeSeek()
  }

  /** Clears transient capture data while retaining the persistent player. */
  clearLiveCaptureState(): void {
    this.liveFirstLayouts.clear()
    this.liveCaptureOccurrences.clear()
  }

  /** Suspends authored transitions while the player resets in place. */
  beginReset(): void {
    this.clearLiveCaptureState()
    this.motionSystem?.prepareSeek()
  }

  /** Restores authored transitions after a player reset. */
  endReset(): void {
    this.motionSystem?.completeSeek()
  }

  /** Invalidates captured geometry after a host resize. */
  resize(): void {
    if (!this.hasCapturedMotionBoundaries()) {
      return
    }
    this.invalidateMotionGeometry()
  }

  /** Captures the visible FIRST layout before a live capture is committed. */
  captureLiveFirstLayout(captureId: string, persoKey: string, timeMs: number): void {
    const player = this.context.getPlayer()
    // The persist-only event is outside the current playback head. The solved
    // scene is the exact state from which the live endEmit move starts.
    const before = player.getSolvedScene() ?? player.resolveSceneBeforeBoundary(timeMs)
    this.motionSystem?.present(timeMs)
    const presentationFrame = this.motionSystem?.getFrame()
    const storyId = before.persos[persoKey]?.storyId
    const motionContainer = this.context.motionContainerResolver.resolve({
      root: this.context.root,
      scenes: [before],
      itemIds: [persoKey],
      ...(storyId === undefined ? {} : { storyIds: [storyId] }),
    })
    const snapshot = captureCurrentHtmlMotionLayout(
      motionContainer.element,
      this.context.nodes.persoNodes,
      before,
      new Set([persoKey]),
      motionContainer.key,
    )
    this.liveFirstLayouts.set(captureId, {
      persoKey,
      timeMs,
      snapshot,
      before,
      presentationFrame,
    })
  }

  /** Completes the motion graph boundary after a live capture closes. */
  completeLiveCaptureMotion(captureId: string, completed: boolean): void {
    const first = this.liveFirstLayouts.get(captureId)
    this.liveFirstLayouts.delete(captureId)
    if (!completed || first === undefined) {
      this.liveCaptureOccurrences.delete(captureId)
      return
    }

    const occurrences = this.liveCaptureOccurrences.get(captureId) ?? []
    this.liveCaptureOccurrences.delete(captureId)
    if (occurrences.length === 0) {
      return
    }

    const occurrenceIntents = createMotionIntentsFromOccurrences(occurrences)
    const knownIntentIds = new Set(this.replayMotionBoundaries
      .flatMap((boundary) => boundary.intents.map((intent) => intent.id)))
    const replayCaptureIntents = selectNewMotionIntentGroups(
      occurrenceIntents,
      knownIntentIds,
      this.motionStoryByItemId,
    )
    const liveIntents = occurrenceIntents.filter((intent) => (
      intent.itemId === first.persoKey && intent.startAt === first.timeMs
    ))
    if (replayCaptureIntents.length > 0 || liveIntents.length > 0) {
      this.motionSystem?.prepareGeometryCapture()
    }

    let firstSnapshot = first.snapshot
    const player = this.context.getPlayer()
    const currentScene = player.getSolvedScene()
    if (currentScene !== undefined && liveIntents.length > 0) {
      const liveStoryId = currentScene.persos[liveIntents[0]!.itemId]?.storyId
      const liveContainer = this.context.motionContainerResolver.resolve({
        root: this.context.root,
        scenes: [first.before, currentScene],
        itemIds: [...new Set(liveIntents.map((intent) => intent.itemId))],
        storyIds: [...new Set(liveIntents.flatMap((intent) => intent.storyIds ?? []))],
        ...(liveStoryId === undefined ? {} : { storyId: liveStoryId }),
      })
      this.context.presentSceneForGeometryCapture(first.before)
      firstSnapshot = captureCurrentHtmlMotionLayout(
        liveContainer.element,
        this.context.nodes.persoNodes,
        first.before,
        new Set(liveIntents.map((intent) => intent.itemId)),
        liveContainer.key,
      )
      firstSnapshot = mergeCurrentPresentationPoses(
        firstSnapshot,
        first.presentationFrame,
        new Set(liveIntents.map((intent) => intent.itemId)),
      )
    }

    const replayBoundaries = replayCaptureIntents.length === 0
      ? []
      : captureHtmlMotionBoundaries({
          player,
          root: this.context.root,
          nodes: this.context.nodes.persoNodes,
          intents: replayCaptureIntents,
          includePersistOnly: true,
          resolveMotionContainer: (input) => this.context.motionContainerResolver.resolve(input),
        })
    let presentationBoundaries: readonly MotionBoundary[] = []
    if (liveIntents.length > 0) {
      if (currentScene !== undefined && replayBoundaries.length === 0) {
        this.context.presentSceneForGeometryCapture(currentScene)
      }
      const liveBoundaries = captureHtmlLiveMotionBoundary({
        player,
        root: this.context.root,
        nodes: this.context.nodes.persoNodes,
        first: firstSnapshot,
        intents: liveIntents,
        resolveMotionContainer: (input) => this.context.motionContainerResolver.resolve(input),
      })
      const liveIntentIds = new Set(liveIntents.map((intent) => intent.id))
      presentationBoundaries = liveBoundaries.filter((boundary) => (
        !boundary.intents.some((intent) => liveIntentIds.has(intent.id))
      ))
      presentationBoundaries = [...presentationBoundaries, ...liveBoundaries]
    }

    this.replayMotionBoundaries = mergeMotionBoundaries(
      this.replayMotionBoundaries,
      replayBoundaries,
      this.motionStoryByItemId,
    )
    this.presentationMotionBoundaries = mergeMotionBoundaries(
      this.presentationMotionBoundaries,
      presentationBoundaries,
      this.motionStoryByItemId,
    )
    this.commitMotion()
    this.motionSystem?.present(player.getCurrentTimeMs())
  }

  /** Presents one materialized scene and prepares only its resolved occurrences. */
  presentMotion(scene: SolvedScene, materialization: RuntimeMaterializerSceneContext): void {
    const motionOccurrences = materialization.motionOccurrences ?? []
    this.rememberLiveCaptureOccurrences(motionOccurrences)
    const resetStoryIds = materialization.resetStoryIds ?? []
    const isolationClosedStoryIds = materialization.isolationClosedStoryIds ?? []
    const staleStoryIds = [...new Set([...resetStoryIds, ...isolationClosedStoryIds])]
    const presentationOccurrences = motionOccurrences.filter((occurrence) => (
      occurrence.startAt === scene.timeMs
      || materialization.previousScene?.timeMs === scene.timeMs
    ))
    if (presentationOccurrences.length > 0) {
      this.motionSystem?.present(scene.timeMs)
    }
    const presentationFirstSnapshots = presentationOccurrences.length > 0
      ? this.captureCurrentMotionFirstSnapshots(scene, presentationOccurrences)
      : undefined
    if (staleStoryIds.length > 0) {
      this.removeMotionGroupsForStories(scene, staleStoryIds)
    }
    if (motionOccurrences.length > 0) {
      this.rebuildMotionBoundaries({
        occurrences: motionOccurrences,
        presentationFirstSnapshots,
      })
    }
    this.motionSystem?.present(scene.timeMs)
  }

  /** Captures visible FIRST poses before reset isolation removes stale groups. */
  private captureCurrentMotionFirstSnapshots(
    scene: SolvedScene,
    occurrences: readonly RuntimeMoveOccurrence[],
  ): ReadonlyMap<string, LayoutSnapshot> | undefined {
    const presentationFrame = this.motionSystem?.getFrame()
    if (presentationFrame === undefined || occurrences.length === 0) {
      return undefined
    }
    const visibleOccurrences = occurrences.filter((occurrence) => {
      const item = presentationFrame.items.get(occurrence.itemId)
      return item?.activeSegmentId !== undefined && item.progress < 1
    })
    if (visibleOccurrences.length === 0) {
      return undefined
    }

    const player = this.context.getPlayer()
    const snapshots = new Map<string, LayoutSnapshot>()
    this.motionSystem?.prepareGeometryCapture()
    try {
      for (const occurrence of visibleOccurrences) {
        const key = createMotionFirstSnapshotKey(occurrence.itemId, occurrence.startAt)
        if (snapshots.has(key)) {
          continue
        }
        const beforeScene = player.resolveSceneBeforeBoundary(
          occurrence.startAt,
          this.context.getPersistOnlyMode(),
        )
        const storyIds = [...new Set([
          ...occurrence.beforeStoryIds,
          ...occurrence.afterStoryIds,
        ])]
        const motionContainer = this.context.motionContainerResolver.resolve({
          root: this.context.root,
          scenes: [beforeScene, scene],
          itemIds: [occurrence.itemId],
          ...(storyIds.length === 0 ? {} : { storyIds }),
        })
        this.context.presentSceneForGeometryCapture(beforeScene)
        const snapshot = captureCurrentHtmlMotionLayout(
          motionContainer.element,
          this.context.nodes.persoNodes,
          beforeScene,
          new Set([occurrence.itemId]),
          motionContainer.key,
        )
        snapshots.set(key, mergeCurrentPresentationPoses(
          snapshot,
          presentationFrame,
          new Set([occurrence.itemId]),
        ))
      }
    } finally {
      this.context.presentSceneForGeometryCapture(scene)
    }
    return snapshots
  }

  /** Captures only requested motion groups while retaining historical seek data. */
  private rebuildMotionBoundaries(options: MotionBoundaryRebuildOptions = {}): void {
    if (this.rebuildingMotion) {
      return
    }
    const occurrences = options.occurrences ?? []
    if (occurrences.length === 0) {
      return
    }

    const occurrenceIntents = createMotionIntentsFromOccurrences(occurrences)
    const knownReplayIntentIds = collectBoundaryIntentIds(this.replayMotionBoundaries)
    const knownPresentationIntentIds = collectBoundaryIntentIds(this.presentationMotionBoundaries)
    const replayCaptureIntents = selectNewMotionIntentGroups(
      selectMotionIntentGroupsForOccurrences(
        occurrenceIntents,
        occurrences,
        this.motionStoryByItemId,
      ),
      knownReplayIntentIds,
      this.motionStoryByItemId,
    )
    const presentationCaptureIntents = selectNewMotionIntentGroups(
      selectMotionIntentGroupsForOccurrences(
        occurrenceIntents,
        occurrences,
        this.motionStoryByItemId,
      ),
      knownPresentationIntentIds,
      this.motionStoryByItemId,
    )
    const replayNeedsCapture = replayCaptureIntents.length > 0
    const presentationNeedsCapture = presentationCaptureIntents.length > 0
    if (!replayNeedsCapture && !presentationNeedsCapture) {
      return
    }

    this.rebuildingMotion = true
    try {
      this.motionSystem?.prepareGeometryCapture()
      const shareCapture = replayNeedsCapture
        && presentationNeedsCapture
        && options.presentationFirstSnapshots === undefined
        && this.context.getPersistOnlyMode()
        && sameMotionIntentSet(replayCaptureIntents, presentationCaptureIntents)
      const capture = (
        intents: readonly ScheduledMotionIntent[],
        includePersistOnly: boolean,
      ): readonly MotionBoundary[] => captureHtmlMotionBoundaries({
        player: this.context.getPlayer(),
        root: this.context.root,
        nodes: this.context.nodes.persoNodes,
        intents,
        includePersistOnly,
        resolveActiveMotionEndAt: (itemId, startAt, _requestedEndAt) => (
          this.motionSystem?.resolveActiveMotionEndAt(itemId, startAt)
        ),
        resolveMotionContainer: (input) => this.context.motionContainerResolver.resolve(input),
      })
      const sharedBoundaries = shareCapture
        ? capture(replayCaptureIntents, true)
        : undefined
      const replayBoundaries = replayNeedsCapture
        ? (sharedBoundaries ?? capture(replayCaptureIntents, true))
        : []
      const presentationBoundaries = presentationNeedsCapture
        ? (sharedBoundaries ?? captureHtmlMotionBoundaries({
            player: this.context.getPlayer(),
            root: this.context.root,
            nodes: this.context.nodes.persoNodes,
            intents: presentationCaptureIntents,
            includePersistOnly: this.context.getPersistOnlyMode(),
            firstSnapshots: options.presentationFirstSnapshots,
            resolveActiveMotionEndAt: (itemId, startAt, _requestedEndAt) => (
              this.motionSystem?.resolveActiveMotionEndAt(itemId, startAt)
            ),
            resolveMotionContainer: (input) => this.context.motionContainerResolver.resolve(input),
          }))
        : []

      if (replayNeedsCapture) {
        this.replayMotionBoundaries = mergeMotionBoundaries(
          this.replayMotionBoundaries,
          replayBoundaries,
          this.motionStoryByItemId,
        )
      }
      if (presentationNeedsCapture) {
        this.presentationMotionBoundaries = mergeMotionBoundaries(
          this.presentationMotionBoundaries,
          presentationBoundaries,
          this.motionStoryByItemId,
        )
      }
      this.commitMotion(presentationNeedsCapture)
    } finally {
      this.rebuildingMotion = false
    }
  }

  /** Commits the current boundaries and creates the presenter on first use. */
  private commitMotion(updatePresentation = true): void {
    const hasMotionData = this.replayMotionBoundaries.length > 0
      || this.presentationMotionBoundaries.length > 0
    const initialize = this.motionSystem === undefined
    const motionSystem = this.motionSystem
      ?? (hasMotionData ? this.createMotionSystem() : undefined)
    if (motionSystem === undefined) {
      return
    }
    this.motionSystem = motionSystem
    if (initialize || updatePresentation) {
      motionSystem.commit(this.presentationMotionBoundaries, new Map())
    }
    if (initialize) {
      motionSystem.initialize()
    }
  }

  /** Removes captured groups and their HTML resources for reset stories. */
  private removeMotionGroupsForStories(scene: SolvedScene, storyIds: readonly string[]): void {
    const selectedStories = new Set(storyIds)
    if (selectedStories.size === 0) {
      return
    }
    const removedItemIds = new Set(this.resolveMotionItemIds(scene, storyIds))
    const retainedReplay: MotionBoundary[] = []
    const retainedPresentation: MotionBoundary[] = []
    const collectRetained = (
      boundaries: readonly MotionBoundary[],
      retained: MotionBoundary[],
    ): void => {
      for (const boundary of boundaries) {
        if (resolveBoundaryStoryIds(boundary, this.motionStoryByItemId)
          .some((storyId) => selectedStories.has(storyId))) {
          for (const intent of boundary.intents) removedItemIds.add(intent.itemId)
          for (const itemId of boundary.before.items.keys()) removedItemIds.add(itemId)
          for (const itemId of boundary.after.items.keys()) removedItemIds.add(itemId)
          continue
        }
        retained.push(boundary)
      }
    }
    collectRetained(this.replayMotionBoundaries, retainedReplay)
    collectRetained(this.presentationMotionBoundaries, retainedPresentation)
    this.replayMotionBoundaries = Object.freeze(retainedReplay)
    this.presentationMotionBoundaries = Object.freeze(retainedPresentation)
    if (this.motionSystem === undefined) {
      return
    }
    this.motionSystem.clearTransientPresentation(removedItemIds)
    this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
  }

  /** Drops stale geometry while preserving the player and author nodes. */
  private invalidateMotionGeometry(): void {
    this.replayMotionBoundaries = []
    this.presentationMotionBoundaries = []
    if (this.motionSystem === undefined) {
      return
    }
    this.motionSystem.clearTransientPresentation()
    this.motionSystem.commit([], new Map())
  }

  /** Collects logical item identities belonging to stories just reset. */
  private resolveMotionItemIds(
    scene: SolvedScene,
    storyIds: readonly string[],
  ): ReadonlySet<string> {
    const selectedStories = new Set(storyIds)
    return new Set(Object.values(scene.persos)
      .filter((perso) => selectedStories.has(perso.storyId))
      .map((perso) => perso.key))
  }

  /** Physically prunes pre-reset groups before a seek target. */
  private pruneMotionGroupsBeforeSeek(timeMs: number): void {
    const removedItemIds = new Set<string>()
    const shouldRemove = (boundary: MotionBoundary): boolean => (
      resolveBoundaryStoryIds(boundary, this.motionStoryByItemId).some((storyId) => (
        this.isBoundaryInvalidatedByReset(boundary, storyId, timeMs)
      ))
    )
    const filter = (boundaries: readonly MotionBoundary[]): readonly MotionBoundary[] => (
      Object.freeze(boundaries.filter((boundary) => {
        if (!shouldRemove(boundary)) {
          return true
        }
        for (const itemId of boundary.before.items.keys()) removedItemIds.add(itemId)
        for (const itemId of boundary.after.items.keys()) removedItemIds.add(itemId)
        return false
      }))
    )
    this.replayMotionBoundaries = filter(this.replayMotionBoundaries)
    this.presentationMotionBoundaries = filter(this.presentationMotionBoundaries)
    if (this.motionSystem !== undefined) {
      this.motionSystem.clearTransientPresentation(removedItemIds)
    }
  }

  /** Tests one captured boundary against reset facts visible at a seek target. */
  private isBoundaryInvalidatedByReset(
    boundary: MotionBoundary,
    storyId: string,
    timeMs: number,
  ): boolean {
    const resetBoundaries = this.context.getPlayer().trackJournal.getStoryResetBoundaries(storyId, true)
    return resetBoundaries.some((reset) => {
      if (reset.applyAtMs > timeMs) {
        return false
      }
      if (boundary.timeMs > reset.applyAtMs) {
        return false
      }
      if (boundary.timeMs < reset.applyAtMs) {
        return true
      }
      return boundary.intents.some((intent) => (
        intent.eventSeq === undefined || intent.eventSeq <= reset.eventSeq
      ))
    })
  }

  /** Associates resolved occurrences with the live capture that supplied FIRST. */
  private rememberLiveCaptureOccurrences(occurrences: readonly RuntimeMoveOccurrence[]): void {
    if (occurrences.length === 0 || this.liveFirstLayouts.size === 0) {
      return
    }
    for (const [captureId, first] of this.liveFirstLayouts) {
      const matching = occurrences.filter((occurrence) => (
        occurrence.itemId === first.persoKey
        && occurrence.startAt === first.timeMs
      ))
      if (matching.length > 0) {
        this.liveCaptureOccurrences.set(captureId, Object.freeze([...matching]))
      }
    }
  }

  /** Creates the HTML motion presenter for this visible root. */
  private createMotionSystem(): HtmlMotionSystem {
    const motionHost = new HtmlMotionPresentationHost(
      this.context.root,
      (itemId) => this.context.nodes.persoNodes.get(itemId) as HTMLElement | undefined,
      (rootKey) => this.context.motionContainerResolver.resolveByKey(rootKey),
    )
    return new HtmlMotionSystem({
      host: motionHost,
      resolveSourceRevision: (itemId) => this.resolveMotionSourceRevision(itemId),
    })
  }

  /** Resolves the author revision used to reuse an overlay template. */
  private resolveMotionSourceRevision(itemId: string): string | undefined {
    const player = this.context.getPlayer()
    const scene = player.getSolvedScene()
    const perso = scene?.persos[itemId]
    if (scene === undefined || perso === undefined) {
      return undefined
    }
    const stateRevision = this.context.getComponentStateRevision(itemId)
    return [
      scene.graph.revision,
      stateRevision,
      perso.placement.mounted ? 'mounted' : 'detached',
      perso.placement.targetId ?? '',
      perso.placement.parentKey ?? '',
    ].join(':')
  }

  /** Destroys the motion presenter and all transient capture data. */
  destroy(): void {
    this.clearLiveCaptureState()
    this.motionSystem?.destroy()
    this.motionSystem = undefined
  }
}

/** Builds the logical story index used to keep motion discovery story-local. */
function createMotionStoryIndex(scene: CompiledScene): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      index.set(`${storyId}:${perso.id}`, storyId)
    }
  }
  return index
}

/** Normalizes materialized move occurrences without rediscovering their action. */
function createMotionIntentsFromOccurrences(
  occurrences: readonly RuntimeMoveOccurrence[],
): readonly ScheduledMotionIntent[] {
  const effective = new Map<string, ScheduledMotionIntent>()
  for (const occurrence of occurrences) {
    const action = occurrence.action
    const eventId = occurrence.eventId
      ?? `${occurrence.itemId}:${action.name}:${occurrence.declarationPath.join('.')}`
    const intent = createScheduledMotionIntent({
      id: occurrence.eventId === undefined
        ? `motion:${eventId}:${occurrence.startAt}`
        : `motion:${eventId}`,
      eventId,
      itemId: occurrence.itemId,
      declarationPath: occurrence.declarationPath,
      startAt: occurrence.startAt,
      eventSeq: occurrence.eventSeq,
      storyIds: [...new Set([...occurrence.beforeStoryIds, ...occurrence.afterStoryIds])],
      action: action.action,
      resolveActionTransition: resolveHtmlMotionActionTransition,
    })
    if (intent !== undefined) {
      effective.set(`${occurrence.itemId}:${occurrence.startAt}`, intent)
    }
  }
  return Object.freeze([...effective.values()]
    .sort((left, right) => left.startAt - right.startAt
      || compareNumberPaths(left.declarationPath, right.declarationPath)))
}

/** Collects motion identities already represented by captured boundaries. */
function collectBoundaryIntentIds(boundaries: readonly MotionBoundary[]): ReadonlySet<string> {
  return new Set(boundaries.flatMap((boundary) => boundary.intents.map((intent) => intent.id)))
}

/** Checks whether replay and presentation need the same intent set. */
function sameMotionIntentSet(
  left: readonly ScheduledMotionIntent[],
  right: readonly ScheduledMotionIntent[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  const rightIds = new Set(right.map((intent) => intent.id))
  return left.every((intent) => rightIds.has(intent.id))
}

/** Selects complete new boundary groups without recapturing old groups. */
function selectNewMotionIntentGroups(
  intents: readonly ScheduledMotionIntent[],
  knownIntentIds: ReadonlySet<string>,
  storyByItemId: ReadonlyMap<string, string>,
): readonly ScheduledMotionIntent[] {
  const newGroupKeys = new Set<string>()
  for (const intent of intents) {
    if (!knownIntentIds.has(intent.id)) {
      newGroupKeys.add(scheduledMotionGroupKey(intent, storyByItemId))
    }
  }
  return Object.freeze(intents.filter((intent) => (
    newGroupKeys.has(scheduledMotionGroupKey(intent, storyByItemId))
  )))
}

/** Selects complete schedule groups touched by the resolved occurrences. */
function selectMotionIntentGroupsForOccurrences(
  intents: readonly ScheduledMotionIntent[],
  occurrences: readonly RuntimeMoveOccurrence[],
  storyByItemId: ReadonlyMap<string, string>,
): readonly ScheduledMotionIntent[] {
  if (occurrences.length === 0) {
    return []
  }
  const keys = new Set(occurrences.map((occurrence) => `${occurrence.itemId}:${occurrence.startAt}`))
  const groupKeys = new Set(
    intents
      .filter((intent) => keys.has(`${intent.itemId}:${intent.startAt}`))
      .map((intent) => scheduledMotionGroupKey(intent, storyByItemId)),
  )
  return Object.freeze(intents.filter((intent) => (
    groupKeys.has(scheduledMotionGroupKey(intent, storyByItemId))
  )))
}

/** Identifies one scheduled motion group. */
function scheduledMotionGroupKey(
  intent: ScheduledMotionIntent,
  storyByItemId: ReadonlyMap<string, string>,
): string {
  const storyIds = intent.storyIds === undefined || intent.storyIds.length === 0
    ? [storyByItemId.get(intent.itemId) ?? '<unknown>']
    : [...new Set(intent.storyIds)].sort()
  return `${storyIds.join(',')}:${intent.startAt}:${intent.endAt}:${intent.targetReflow ? 'structural' : 'pose'}`
}

/** Merges newly captured groups while replacing the old group capture. */
function mergeMotionBoundaries(
  existing: readonly MotionBoundary[],
  additions: readonly MotionBoundary[],
  storyByItemId: ReadonlyMap<string, string>,
): readonly MotionBoundary[] {
  const merged = new Map<string, MotionBoundary>()
  for (const boundary of existing) {
    merged.set(motionBoundaryGroupKey(boundary, storyByItemId), boundary)
  }
  for (const boundary of additions) {
    merged.set(motionBoundaryGroupKey(boundary, storyByItemId), boundary)
  }
  return Object.freeze([...merged.values()].sort((left, right) => (
    left.timeMs - right.timeMs || left.id.localeCompare(right.id)
  )))
}

/** Identifies one effective item group at a captured boundary. */
function motionBoundaryGroupKey(
  boundary: MotionBoundary,
  storyByItemId: ReadonlyMap<string, string>,
): string {
  const intent = boundary.intents[0]
  const storyIds = boundary.storyIds === undefined || boundary.storyIds.length === 0
    ? [intent === undefined ? '<unknown>' : storyByItemId.get(intent.itemId) ?? '<unknown>']
    : [...new Set(boundary.storyIds)].sort()
  const structural = intent?.targetReflow === true ? 'structural' : 'pose'
  const itemIds = boundary.intents.map(({ itemId }) => itemId).sort().join(',')
  return `${storyIds.join(',')}:${boundary.timeMs}:${structural}:${itemIds}`
}

/** Resolves a captured boundary's logical scope for reset partitioning. */
function resolveBoundaryStoryIds(
  boundary: MotionBoundary,
  storyByItemId: ReadonlyMap<string, string>,
): readonly string[] {
  if (boundary.storyIds !== undefined && boundary.storyIds.length > 0) {
    return boundary.storyIds
  }
  return [...new Set(boundary.intents
    .map((intent) => storyByItemId.get(intent.itemId))
    .filter((storyId): storyId is string => storyId !== undefined))]
}
