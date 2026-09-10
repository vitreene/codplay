import { RuntimeEngine, type Ticker } from '../engine'
import { TimeTicker } from '../time'
import { RuntimeComponentRuntime } from '../components'
import { RuntimeCapabilityCatalog } from '../catalog'
import type { RuntimeMaterializer, RuntimeMaterializerSceneContext, RuntimeMoveOccurrence } from '../materializer'
import {
  PLAYER_LIFECYCLE_PLAYING,
  RuntimePlayer,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type RuntimeEventDispatchResult,
  type RuntimeEventInput,
  type StrapCollections,
  type SolvedScene,
} from '../player'
import { HtmlPointerCaptureSourceAdapter } from '../capture'
import type { RuntimeCaptureState } from '../capture'
import { HtmlPersoEmitSourceAdapter } from './perso-emit-source-adapter'
import type { Diagnostic } from '../../diagnostics'
import {
  createScheduledMotionIntent,
  MotionMaterializer,
} from '../motion'
import type {
  LayoutSnapshot,
  MotionBoundary,
  PresentationFrame,
  ScheduledMotionIntent,
} from '../motion'
import type { CompiledFunctionCollection, CompiledScene } from '../../scene/compiled'
import type { RuntimeTrackEvent } from '../player/pipeline'
import {
  HtmlComponentMaterializer,
  type HtmlMaterializerRuntimeContext,
} from './component-materializer'
import { HtmlMotionPresentationHost } from './motion-presentation-host'
import { HtmlMotionSystem } from './motion-system'
import {
  captureCurrentHtmlMotionLayout,
  captureHtmlLiveMotionBoundary,
  captureHtmlMotionBoundaries,
  createMotionFirstSnapshotKey,
  mergeCurrentPresentationPoses,
  resolveHtmlMotionActionTransition,
} from './motion-capture'
import { HtmlMotionContainerResolver } from './motion-container'
import type {
  RuntimePreloadApi,
  RuntimePreloadManifestInput,
  RuntimePreloadMediaHandle,
  RuntimePreloadMetadata,
  RuntimePreloadMediaResources,
  RuntimePreloadOptions,
  RuntimePreloadFailure,
  RuntimePreloadSuccess,
} from '../preload'
import type { RuntimeIdleOptions } from '../idle'
import { compareNumberPaths } from '../../shared'

/** One instance-local root target mapped to the runner's supplied root element. */
type HtmlRootTarget = Readonly<{
  id: string
  storyId: string
}>

/** Selects the resolved occurrences whose groups need a geometry capture. */
type MotionBoundaryRebuildOptions = Readonly<{
  occurrences?: readonly RuntimeMoveOccurrence[]
  /** Visible FIRST snapshots for occurrences replacing stale story plans. */
  presentationFirstSnapshots?: ReadonlyMap<string, LayoutSnapshot>
}>

/** Options for the standalone diffusion sequence `preload -> init -> play`. */
export type HtmlPlayerRunOptions = Readonly<{
  preload: RuntimePreloadApi
  manifest?: RuntimePreloadManifestInput
  preloadOptions?: RuntimePreloadOptions
  ticker?: Ticker
}>

/** Result of one standalone diffusion run. */
export type HtmlPlayerRunResult =
  | Readonly<{ ok: true; phase: 'run'; preload: RuntimePreloadSuccess; init: Extract<PlayerInitResult, { ok: true }> }>
  | Readonly<{ ok: false; phase: 'preload'; preload: RuntimePreloadFailure }>
  | Readonly<{ ok: false; phase: 'init'; preload: RuntimePreloadSuccess; init: Extract<PlayerInitResult, { ok: false }> }>

/** Construction contract for the logical HTML player and motion graph. */
export type HtmlPlayerRunnerOptions = Readonly<{
  id: string
  compiledScene: CompiledScene
  root: HTMLElement
  catalog: RuntimeCapabilityCatalog
  /** Resources already made available to the visible engine. */
  resources?: readonly string[]
  /** Metadata already obtained from the external preload boundary. */
  resourceMetadata?: RuntimePreloadMetadata
  /** Native media handoffs already retained by the external preload boundary. */
  resourceMedia?: RuntimePreloadMediaResources
  engine?: RuntimeEngine
  ticker?: Ticker
  /** Optional inactivity policy overriding the shared engine default. */
  idle?: RuntimeIdleOptions
  /** Initial HTML projection scale; one cqw is the scene-root width divided by 100. */
  numericLengthScale?: number
  functions?: CompiledFunctionCollection
  /** Optional reusable straps selected by named declarations in the scene. */
  strapCollections?: StrapCollections
  /** Event target used by the classic HTML pointer capture source. */
  captureEventTarget?: EventTarget
  /** Mirrors the V1 authoring behavior: block scene input unless playing. */
  enableInteractionLock?: boolean
  /** Receives source-adapter failures instead of hiding them in native listeners. */
  onCaptureError?: (error: unknown) => void
  /** Receives structured diagnostics emitted by the generic DOM event source. */
  onEmitDiagnostic?: (diagnostic: Diagnostic) => void
  /** Observes one completed HTML capture sample for a materializer-specific preview. */
  onCaptureTrack?: (input: Readonly<{
    captureId: string
    persoKey: string
    sample: Readonly<Record<string, unknown>>
    captureState: RuntimeCaptureState
  }>) => void
  /** Resolves one materializer-dependent value once when a pointer capture ends. */
  resolveEndCaptureState?: (input: Readonly<{
    captureId: string
    persoKey: string
    captureState: RuntimeCaptureState
    event: Event
  }>) => RuntimeCaptureState | undefined
  /** Releases materializer-specific preview resources after one capture closes. */
  onCaptureClose?: (input: Readonly<{
    captureId: string
    persoKey: string
    completed: boolean
  }>) => void
  /** Forwards public eventimes to the enclosing facade without opening another journal. */
  onPublicEvent?: (event: RuntimeTrackEvent) => void
  /** Forwards every successfully journaled live event to the enclosing facade. */
  onTrace?: (event: RuntimeTrackEvent) => void
}>

/** Generic HTML host with one absolute-time presentation circuit. */
export class HtmlPlayerRunner {
  readonly player: RuntimePlayer
  readonly engine: RuntimeEngine
  private readonly ownsEngine: boolean
  private readonly defaultTicker: Ticker | undefined
  private readonly nodes = {
    persoNodes: new Map<string, unknown>(),
    persoParts: new Map<string, readonly import('../components').MaterializedPart[]>(),
    targetNodes: new Map<string, unknown>(),
  }
  private readonly motionStoryByItemId: ReadonlyMap<string, string>
  private motionSystem: HtmlMotionSystem | undefined = undefined
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
  private readonly captureSourceAdapter: HtmlPointerCaptureSourceAdapter
  private readonly emitSourceAdapter: HtmlPersoEmitSourceAdapter
  private readonly materializerContext: HtmlMaterializerRuntimeContext
  private readonly interactionLockEnabled: boolean
  private readonly interactionRoot: HTMLElement
  private readonly motionContainerResolver: HtmlMotionContainerResolver
  private readonly initialPointerEvents: string
  private readonly initialInert: boolean
  private materializationEpoch = 0
  private readonly resourceMetadata = new Map<string, RuntimePreloadMetadata[string]>()
  private readonly resourceMedia = new Map<string, RuntimePreloadMediaHandle>()
  private readonly stopTerminalObservation: () => void

  /** Creates one visible author host and one optional motion presentation host. */
  constructor(options: HtmlPlayerRunnerOptions) {
    this.defaultTicker = options.ticker
    this.interactionRoot = options.root
    this.motionStoryByItemId = createMotionStoryIndex(options.compiledScene)
    this.motionContainerResolver = new HtmlMotionContainerResolver(
      options.root,
      this.nodes.persoNodes,
    )
    this.interactionLockEnabled = options.enableInteractionLock === true
    this.initialPointerEvents = options.root.style.pointerEvents
    this.initialInert = options.root.hasAttribute('inert')
    this.materializerContext = {
      numericLengthScale: options.numericLengthScale ?? 1,
    }
    for (const [url, metadata] of Object.entries(options.resourceMetadata ?? {})) {
      this.resourceMetadata.set(url, metadata)
    }
    for (const [url, media] of Object.entries(options.resourceMedia ?? {})) {
      this.resourceMedia.set(url, media)
    }
    options.catalog.lock()
    this.engine = options.engine ?? new RuntimeEngine(options.catalog, {
      resources: options.resources,
      idle: options.idle,
    })
    this.ownsEngine = options.engine === undefined
    const rootTargets = resolveRootTargets(options.compiledScene)
    const rootDeclarations = rootTargets.map((target) => ({
      id: target.id,
      kind: 'root' as const,
      storyId: target.storyId,
    }))
    for (const target of rootTargets) this.nodes.targetNodes.set(target.id, options.root)

    const componentMaterializer = new HtmlComponentMaterializer(this.nodes, this.materializerContext)
    const materializer = new MotionMaterializer(
      componentMaterializer,
      (scene, context) => this.presentMotion(scene, context),
    )
    const componentRuntime = createComponentRuntime(
      options.catalog,
      materializer,
      this.resourceMetadata,
      this.resourceMedia,
    )
    this.player = new RuntimePlayer(
      options.id,
      this.engine,
      options.compiledScene,
      undefined,
      options.strapCollections,
      undefined,
      rootDeclarations,
      materializer,
      componentRuntime,
      options.functions,
      undefined,
      options.onPublicEvent,
      options.idle,
      options.onTrace,
    )
    this.stopTerminalObservation = this.player.subscribeTransport(() => {
      if (this.ownsEngine && this.player.hasSequenceEnded()) this.engine.pause()
      this.syncInteractionLock()
    })
    this.captureSourceAdapter = new HtmlPointerCaptureSourceAdapter({
      player: this.player,
      compiledScene: options.compiledScene,
      nodes: this.nodes,
      eventTarget: options.captureEventTarget ?? resolveCaptureEventTarget(options.root),
      onError: options.onCaptureError,
      onCaptureTrack: options.onCaptureTrack,
      resolveEndCaptureState: (input) => {
        const captureState = options.resolveEndCaptureState?.(input)
        this.captureLiveFirstLayout(input.captureId, input.persoKey, this.player.getCurrentTimeMs())
        return captureState
      },
      onCaptureClose: (input) => {
        this.completeLiveCaptureMotion(input.captureId, input.completed)
        options.onCaptureClose?.(input)
        // A materializer-specific capture preview may have moved author roots
        // after the last solved graph revision. Reconcile once at the next
        // scene boundary, without reopening structural work on every frame.
        materializer.invalidateStructure?.()
      },
    })
    this.emitSourceAdapter = new HtmlPersoEmitSourceAdapter({
      player: this.player,
      compiledScene: options.compiledScene,
      nodes: this.nodes,
      eventTarget: options.captureEventTarget ?? resolveCaptureEventTarget(options.root),
      onDiagnostic: options.onEmitDiagnostic,
    })

  }

  /** Initializes the visible player without preparing unseen motion groups. */
  init(): PlayerInitResult {
    const visible = this.player.init()
    if (!visible.ok) return visible
    try {
      this.motionSystem?.present(this.player.getCurrentTimeMs())
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      this.emitSourceAdapter.attach()
      return visible
    } catch (error) {
      this.motionSystem?.destroy()
      this.player.destroy()
      return {
        ok: false,
        diagnostics: {
          all: [{ severity: 'error', code: 'RUNTIME_MOTION_INIT_FAILED', message: error instanceof Error ? error.message : 'Motion runner initialization failed.' }],
          warnings: [],
          errors: [{ severity: 'error', code: 'RUNTIME_MOTION_INIT_FAILED', message: error instanceof Error ? error.message : 'Motion runner initialization failed.' }],
        },
      }
    }
  }

  /** Preloads the supplied manifest, initializes the runner, and starts playback. */
  async run(options: HtmlPlayerRunOptions): Promise<HtmlPlayerRunResult> {
    const manifest = options.manifest ?? this.player.compiledScene.resources
    const preload = await options.preload.load({
      manifest,
      options: options.preloadOptions,
    })
    if (!preload.ok) return { ok: false, phase: 'preload', preload }

    this.setResourceMetadata(preload.data.metadata)
    this.setResourceMedia(preload.data.media ?? {})

    const resourceUrls = [...new Set([...preload.data.loaded, ...preload.data.skipped])]
    this.engine.registerResources(resourceUrls)
    const init = this.init()
    if (!init.ok) return { ok: false, phase: 'init', preload, init }
    this.play(options.ticker)
    return { ok: true, phase: 'run', preload, init }
  }

  /** Starts playback and, for an owned engine, its frame ticker. */
  play(ticker: Ticker = this.defaultTicker ?? createDefaultTicker()): void {
    this.player.play()
    if (this.ownsEngine) this.engine.start(ticker)
    this.syncInteractionLock()
  }

  /** Sets preload metadata explicitly before or after player initialization. */
  setResourceMetadata(metadata: RuntimePreloadMetadata): void {
    this.resourceMetadata.clear()
    for (const [url, entry] of Object.entries(metadata)) this.resourceMetadata.set(url, entry)
    if (this.player.getSolvedScene() !== undefined) this.player.refresh()
  }

  /** Sets native media handoffs before initialization; existing nodes are never replaced. */
  setResourceMedia(media: RuntimePreloadMediaResources): void {
    this.resourceMedia.clear()
    for (const [url, handle] of Object.entries(media)) this.resourceMedia.set(url, handle)
    if (this.player.getSolvedScene() !== undefined) this.player.refresh()
  }

  /** Changes the logical player rate and forwards it to native media clocks. */
  setRate(rate: number): void {
    this.player.setRate(rate)
  }

  /** Returns the logical playback rate exposed by the runner's player. */
  getRate(): number {
    return this.player.getRate()
  }

  /** Pauses playback and suspends the runner-owned ticker. */
  pause(): void {
    this.player.pause()
    if (this.ownsEngine) this.engine.pause()
    this.syncInteractionLock()
  }

  /** Advances the shared engine at one deterministic external timestamp. */
  advance(nowMs: number, marginMs = 0): void {
    this.engine.advance(nowMs, marginMs)
  }

  /** Reconstructs and presents one complete logical target in one synchronous transaction. */
  seek(timeMs: number): PlayerSeekResult {
    // The live release handoff belongs only to the current capture close. A
    // seek must rebuild the replayable persist-only source-to-target motion.
    this.liveFirstLayouts.clear()
    this.liveCaptureOccurrences.clear()
    const previousReplayBoundaries = this.replayMotionBoundaries
    const previousPresentationBoundaries = this.presentationMotionBoundaries
    const previousTimeMs = this.player.getCurrentTimeMs()
    this.motionSystem?.prepareSeek()
    try {
      if (this.motionSystem !== undefined) {
        this.pruneMotionGroupsBeforeSeek(timeMs)
        this.presentationMotionBoundaries = this.replayMotionBoundaries
        this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
      }
      const result = this.player.seek(timeMs)
      if (!result.ok) {
        this.restoreSeekPresentation(
          previousReplayBoundaries,
          previousPresentationBoundaries,
          previousTimeMs,
        )
      }
      this.syncInteractionLock()
      return result
    } catch (error) {
      this.restoreSeekPresentation(
        previousReplayBoundaries,
        previousPresentationBoundaries,
        previousTimeMs,
      )
      throw error
    } finally {
      this.motionSystem?.completeSeek()
    }
  }

  /** Restores the last committed motion graph after a failed synchronous seek. */
  private restoreSeekPresentation(
    replayBoundaries: readonly MotionBoundary[],
    presentationBoundaries: readonly MotionBoundary[],
    timeMs: number,
  ): void {
    this.replayMotionBoundaries = replayBoundaries
    this.presentationMotionBoundaries = presentationBoundaries
    if (this.motionSystem === undefined) return
    this.motionSystem.clearTransientPresentation()
    this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
    this.motionSystem.present(timeMs)
  }

  /** Emits one live event through the visible player's shared journal. */
  emit(input: Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }): Promise<RuntimeEventDispatchResult> {
    return this.player.emit(input)
  }

  /** Updates the HTML length scale and recaptures motion endpoints if needed. */
  resize(numericLengthScale?: number): void {
    if (numericLengthScale !== undefined) this.materializerContext.numericLengthScale = numericLengthScale
    this.materializationEpoch += 1
    if (this.player.getSolvedScene() !== undefined) {
      const hadCapturedMotion = this.hasCapturedMotionBoundaries()
      if (hadCapturedMotion) this.invalidateMotionGeometry()
      // Re-emit only the active occurrence after invalidation. Historical and
      // future groups remain uncaptured until a Play or Seek actually needs
      // them, so resize never performs a global journal rebuild.
      this.player.refresh({ emitMotionOccurrences: hadCapturedMotion })
      return
    }
  }

  /** Returns the current host materialization epoch for diagnostics. */
  getMaterializationEpoch(): number {
    return this.materializationEpoch
  }

  /** Returns the current player lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.player.getLifecycleState()
  }

  /** Returns the current logical scene time. */
  getCurrentTimeMs(): number {
    return this.player.getCurrentTimeMs()
  }

  /** Returns the latest numeric presentation frame produced by the runtime motion circuit. */
  getPresentationFrame(): import('../motion').PresentationFrame | undefined {
    return this.motionSystem?.getFrame()
  }

  /** Subscribes transport observers to the player-owned update circuit. */
  subscribe(listener: () => void): () => void {
    return this.player.subscribeTransport(listener)
  }

  /** Resolves one materialized perso node for diagnostics and adapters. */
  getPersoNode(persoKey: string): unknown | undefined {
    return this.nodes.persoNodes.get(persoKey)
  }

  /** Resolves one runner target node by its opaque target ID. */
  getTargetNode(targetId: string): unknown | undefined {
    return this.nodes.targetNodes.get(targetId)
  }

  /** Captures the visible FIRST layout before one capture close is committed. */
  private captureLiveFirstLayout(captureId: string, persoKey: string, timeMs: number): void {
    // The persist-only event is deliberately outside the current playback
    // head. The solved scene is therefore the exact logical state from which
    // the live endEmit move starts, including a previous drop at the same
    // logical time. Reconstructing a generic "before boundary" here would
    // incorrectly include the earlier persist-only event and label the live
    // node with its destination instead of its source.
    const before = this.player.getSolvedScene() ?? this.player.resolveSceneBeforeBoundary(timeMs)
    // Refresh the numeric presentation before reading the author nodes. A
    // reparented item may be visible only in its overlay, so its source node
    // is not a trustworthy FIRST measurement while the capture is open.
    this.motionSystem?.present(timeMs)
    const presentationFrame = this.motionSystem?.getFrame()
    const storyId = before.persos[persoKey]?.storyId
    const motionContainer = this.motionContainerResolver.resolve({
      root: this.interactionRoot,
      scenes: [before],
      itemIds: [persoKey],
      ...(storyId === undefined ? {} : { storyIds: [storyId] }),
    })
    const snapshot = captureCurrentHtmlMotionLayout(
      motionContainer.element,
      this.nodes.persoNodes,
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

  /** Captures only requested motion groups while retaining historical seek data. */
  private rebuildMotionBoundaries(options: MotionBoundaryRebuildOptions = {}): void {
    if (this.rebuildingMotion) return

    const occurrences = options.occurrences ?? []
    if (occurrences.length === 0) return

    // A normal materialization already resolved the action and its event data.
    // Recompiling the complete scene and rescanning the journal here would
    // recreate the discovery circuit that the occurrence transport removed.
    const occurrenceIntents = createMotionIntentsFromOccurrences(occurrences)
    const knownReplayIntentIds = collectBoundaryIntentIds(this.replayMotionBoundaries)
    const knownPresentationIntentIds = collectBoundaryIntentIds(this.presentationMotionBoundaries)
    const replayCandidates = selectMotionIntentGroupsForOccurrences(
      occurrenceIntents,
      occurrences,
      this.motionStoryByItemId,
    )
    const presentationCandidates = selectMotionIntentGroupsForOccurrences(
      occurrenceIntents,
      occurrences,
      this.motionStoryByItemId,
    )
    const replayCaptureIntents = selectNewMotionIntentGroups(
      replayCandidates,
      knownReplayIntentIds,
      this.motionStoryByItemId,
    )
    const presentationCaptureIntents = selectNewMotionIntentGroups(
      presentationCandidates,
      knownPresentationIntentIds,
      this.motionStoryByItemId,
    )
    const replayNeedsCapture = replayCaptureIntents.length > 0
    const presentationNeedsCapture = presentationCaptureIntents.length > 0
    if (!replayNeedsCapture && !presentationNeedsCapture) return

    this.rebuildingMotion = true
    try {
      if (replayNeedsCapture || presentationNeedsCapture) this.motionSystem?.prepareGeometryCapture()
      const shareCapture = replayNeedsCapture
        && presentationNeedsCapture
        && options.presentationFirstSnapshots === undefined
        && this.player.includesPersistOnlyInCurrent()
        && sameMotionIntentSet(replayCaptureIntents, presentationCaptureIntents)
      const capture = (intents: readonly ScheduledMotionIntent[], includePersistOnly: boolean): readonly MotionBoundary[] => (
        captureHtmlMotionBoundaries({
          player: this.player,
          root: this.interactionRoot,
          nodes: this.nodes.persoNodes,
          intents,
          includePersistOnly,
          resolveActiveMotionEndAt: (itemId, startAt) => this.motionSystem?.resolveActiveMotionEndAt(itemId, startAt),
          resolveMotionContainer: (containerInput) => this.motionContainerResolver.resolve(containerInput),
        })
      )
      const sharedBoundaries = shareCapture
        ? capture(replayCaptureIntents, true)
        : undefined
      const replayBoundaries = replayNeedsCapture
        ? (sharedBoundaries ?? capture(replayCaptureIntents, true))
        : []
      const presentationBoundaries = presentationNeedsCapture
        ? (sharedBoundaries ?? captureHtmlMotionBoundaries({
            player: this.player,
            root: this.interactionRoot,
            nodes: this.nodes.persoNodes,
            intents: presentationCaptureIntents,
            includePersistOnly: this.player.includesPersistOnlyInCurrent(),
            firstSnapshots: options.presentationFirstSnapshots,
            resolveActiveMotionEndAt: (itemId, startAt) => this.motionSystem?.resolveActiveMotionEndAt(itemId, startAt),
            resolveMotionContainer: (containerInput) => this.motionContainerResolver.resolve(containerInput),
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

      const initialize = this.motionSystem === undefined
      const hasMotionData = this.replayMotionBoundaries.length > 0
        || this.presentationMotionBoundaries.length > 0
      const motionSystem = this.motionSystem
        ?? (hasMotionData ? this.createMotionSystem() : undefined)
      if (motionSystem === undefined) {
        return
      }
      this.motionSystem = motionSystem
      if (initialize || presentationNeedsCapture) motionSystem.commit(this.presentationMotionBoundaries, new Map())
      if (initialize) motionSystem.initialize()
    } finally {
      this.rebuildingMotion = false
    }
  }

  /** Completes the same graph boundary after the normal capture event circuit. */
  private completeLiveCaptureMotion(captureId: string, completed: boolean): void {
    const first = this.liveFirstLayouts.get(captureId)
    this.liveFirstLayouts.delete(captureId)
    if (!completed || first === undefined) {
      this.liveCaptureOccurrences.delete(captureId)
      return
    }

    const occurrences = this.liveCaptureOccurrences.get(captureId) ?? []
    this.liveCaptureOccurrences.delete(captureId)
    if (occurrences.length === 0) return

    // The normal materialization already transported the resolved occurrence.
    // Reuse that immutable payload here so endEmit only replaces the visible
    // FIRST side; closing a capture must not rediscover the journal schedule.
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
    const currentScene = this.player.getSolvedScene()
    if (currentScene !== undefined && liveIntents.length > 0) {
      const liveStoryId = currentScene.persos[liveIntents[0]!.itemId]?.storyId
      const liveContainer = this.motionContainerResolver.resolve({
        root: this.interactionRoot,
        scenes: [first.before, currentScene],
        itemIds: [...new Set(liveIntents.map((intent) => intent.itemId))],
        storyIds: [...new Set(liveIntents.flatMap((intent) => intent.storyIds ?? []))],
        ...(liveStoryId === undefined ? {} : { storyId: liveStoryId }),
      })
      this.player.presentSceneForGeometryCapture(first.before)
      firstSnapshot = captureCurrentHtmlMotionLayout(
        liveContainer.element,
        this.nodes.persoNodes,
        first.before,
        new Set(liveIntents.map((intent) => intent.itemId)),
        liveContainer.key,
      )
      // This is a transient handoff from the current presentation only. It is
      // not appended to the journal and is not used by the replay graph.
      firstSnapshot = mergeCurrentPresentationPoses(
        firstSnapshot,
        first.presentationFrame,
        new Set(liveIntents.map((intent) => intent.itemId)),
      )
    }

    const replayBoundaries = replayCaptureIntents.length === 0
      ? []
      : captureHtmlMotionBoundaries({
          player: this.player,
          root: this.interactionRoot,
          nodes: this.nodes.persoNodes,
          intents: replayCaptureIntents,
          includePersistOnly: true,
          resolveMotionContainer: (containerInput) => this.motionContainerResolver.resolve(containerInput),
        })
    let presentationBoundaries: readonly MotionBoundary[] = []
    if (liveIntents.length > 0) {
      // The FIRST handoff temporarily materializes the pre-event scene. Restore
      // the committed after-scene before reading LAST when no replay capture
      // below performs that restoration for us.
      if (currentScene !== undefined && replayBoundaries.length === 0) {
        this.player.presentSceneForGeometryCapture(currentScene)
      }
      const liveBoundaries = captureHtmlLiveMotionBoundary({
        player: this.player,
        root: this.interactionRoot,
        nodes: this.nodes.persoNodes,
        first: firstSnapshot,
        intents: liveIntents,
        resolveMotionContainer: (containerInput) => this.motionContainerResolver.resolve(containerInput),
      })
      const liveIntentIds = new Set(liveIntents.map((intent) => intent.id))
      presentationBoundaries = [
        ...presentationBoundaries.filter((boundary) => !boundary.intents.some((intent) => liveIntentIds.has(intent.id))),
        ...liveBoundaries,
      ]
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
    const initialize = this.motionSystem === undefined
    const motionSystem = this.motionSystem ?? this.createMotionSystem()
    this.motionSystem = motionSystem
    motionSystem.commit(this.presentationMotionBoundaries, new Map())
    if (initialize) motionSystem.initialize()
    motionSystem.present(this.player.getCurrentTimeMs())
  }

  /** Presents one materialized scene and prepares only moves resolved at its boundary. */
  private presentMotion(scene: SolvedScene, context: RuntimeMaterializerSceneContext): void {
    const motionOccurrences = context.motionOccurrences ?? []
    this.rememberLiveCaptureOccurrences(motionOccurrences)
    const resetStoryIds = context.resetStoryIds ?? []
    const isolationClosedStoryIds = context.isolationClosedStoryIds ?? []
    const staleStoryIds = [...new Set([...resetStoryIds, ...isolationClosedStoryIds])]
    // A live event is materialized at the current head while the previous
    // motion frame is still visible. Present that old graph at the exact
    // boundary before geometry capture; otherwise a direct replacement is
    // captured from the natural source pose and visibly jumps backwards.
    // Historical occurrences crossed by a coarse Play frame are deliberately
    // left to the logical capture path: their visible pose is not the pose at
    // their own start boundary.
    const presentationOccurrences = motionOccurrences.filter((occurrence) => (
      occurrence.startAt === scene.timeMs
      || context.previousScene?.timeMs === scene.timeMs
    ))
    if (presentationOccurrences.length > 0) this.motionSystem?.present(scene.timeMs)
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
    const motionSystem = this.motionSystem
    if (motionSystem === undefined) return
    motionSystem.present(scene.timeMs)
  }

  /** Captures visible FIRST poses before isolation removes stale motion groups. */
  private captureCurrentMotionFirstSnapshots(
    scene: SolvedScene,
    occurrences: readonly RuntimeMoveOccurrence[],
  ): ReadonlyMap<string, LayoutSnapshot> | undefined {
    const presentationFrame = this.motionSystem?.getFrame()
    if (presentationFrame === undefined || occurrences.length === 0) return undefined

    const visibleOccurrences = occurrences.filter((occurrence) => {
      const item = presentationFrame.items.get(occurrence.itemId)
      return item?.activeSegmentId !== undefined && item.progress < 1
    })
    if (visibleOccurrences.length === 0) return undefined

    const snapshots = new Map<string, LayoutSnapshot>()
    this.motionSystem?.prepareGeometryCapture()
    try {
      for (const occurrence of visibleOccurrences) {
        const key = createMotionFirstSnapshotKey(occurrence.itemId, occurrence.startAt)
        if (snapshots.has(key)) continue
        const beforeScene = this.player.resolveSceneBeforeBoundary(
          occurrence.startAt,
          this.player.includesPersistOnlyInCurrent(),
        )
        const storyIds = [...new Set([
          ...occurrence.beforeStoryIds,
          ...occurrence.afterStoryIds,
        ])]
        const motionContainer = this.motionContainerResolver.resolve({
          root: this.interactionRoot,
          scenes: [beforeScene, scene],
          itemIds: [occurrence.itemId],
          ...(storyIds.length === 0 ? {} : { storyIds }),
        })
        this.player.presentSceneForGeometryCapture(beforeScene)
        const snapshot = captureCurrentHtmlMotionLayout(
          motionContainer.element,
          this.nodes.persoNodes,
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
      this.player.presentSceneForGeometryCapture(scene)
    }
    return snapshots
  }

  /** Removes captured groups and their HTML resources when a story resets. */
  private removeMotionGroupsForStories(scene: SolvedScene, storyIds: readonly string[]): void {
    const selectedStories = new Set(storyIds)
    if (selectedStories.size === 0) return

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

    if (this.motionSystem === undefined) return
    this.motionSystem.clearTransientPresentation(removedItemIds)
    this.motionSystem.commit(this.presentationMotionBoundaries, new Map())
  }

  /** Drops stale geometry while preserving the persistent player and DOM nodes. */
  private invalidateMotionGeometry(): void {
    this.replayMotionBoundaries = []
    this.presentationMotionBoundaries = []
    if (this.motionSystem === undefined) return
    this.motionSystem.clearTransientPresentation()
    this.motionSystem.commit([], new Map())
  }

  /** Physically prunes pre-reset groups before a cold or hot seek target. */
  private pruneMotionGroupsBeforeSeek(timeMs: number): void {
    const removedItemIds = new Set<string>()
    const shouldRemove = (boundary: MotionBoundary): boolean => (
      resolveBoundaryStoryIds(boundary, this.motionStoryByItemId).some((storyId) => (
        this.isBoundaryInvalidatedByReset(boundary, storyId, timeMs)
      ))
    )
    const filter = (boundaries: readonly MotionBoundary[]): readonly MotionBoundary[] => (
      Object.freeze(boundaries.filter((boundary) => {
        if (!shouldRemove(boundary)) return true
        for (const itemId of boundary.before.items.keys()) removedItemIds.add(itemId)
        for (const itemId of boundary.after.items.keys()) removedItemIds.add(itemId)
        return false
      }))
    )
    this.replayMotionBoundaries = filter(this.replayMotionBoundaries)
    this.presentationMotionBoundaries = filter(this.presentationMotionBoundaries)
    if (this.motionSystem === undefined) return
    this.motionSystem.clearTransientPresentation(removedItemIds)
  }

  /** Tests one captured boundary against reset facts visible at a seek target. */
  private isBoundaryInvalidatedByReset(
    boundary: MotionBoundary,
    storyId: string,
    timeMs: number,
  ): boolean {
    const resetBoundaries = this.player.trackJournal.getStoryResetBoundaries(storyId, true)
    return resetBoundaries.some((reset) => {
      if (reset.applyAtMs > timeMs) return false
      if (boundary.timeMs < reset.applyAtMs) return true
      if (boundary.timeMs > reset.applyAtMs) return false
      return boundary.intents.some((intent) => (
        intent.eventSeq === undefined || intent.eventSeq <= reset.eventSeq
      ))
    })
  }

  /** Associates a resolved occurrence with the live capture that supplied its FIRST pose. */
  private rememberLiveCaptureOccurrences(occurrences: readonly RuntimeMoveOccurrence[]): void {
    if (occurrences.length === 0 || this.liveFirstLayouts.size === 0) return
    for (const [captureId, first] of this.liveFirstLayouts) {
      const matching = occurrences.filter((occurrence) => (
        occurrence.itemId === first.persoKey
        && occurrence.startAt === first.timeMs
      ))
      if (matching.length === 0) continue
      this.liveCaptureOccurrences.set(captureId, Object.freeze([...matching]))
    }
  }

  /** Reports whether this runner has captured any motion geometry yet. */
  private hasCapturedMotionBoundaries(): boolean {
    return this.replayMotionBoundaries.length > 0 || this.presentationMotionBoundaries.length > 0
  }

  /** Collects logical item identities belonging to the stories just reset. */
  private resolveMotionItemIds(scene: SolvedScene, storyIds: readonly string[]): ReadonlySet<string> {
    const selectedStories = new Set(storyIds)
    return new Set(Object.values(scene.persos)
      .filter((perso) => selectedStories.has(perso.storyId))
      .map((perso) => perso.key))
  }

  /** Creates the one optional HTML motion presenter for this visible root. */
  private createMotionSystem(): HtmlMotionSystem {
    const motionHost = new HtmlMotionPresentationHost(
      this.interactionRoot,
      (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
      (rootKey) => this.motionContainerResolver.resolveByKey(rootKey),
    )
    return new HtmlMotionSystem({
      host: motionHost,
      resolveSourceRevision: (itemId) => this.resolveMotionSourceRevision(itemId),
    })
  }

  /** Resolves one logical author revision used to reuse an overlay template. */
  private resolveMotionSourceRevision(itemId: string): string | undefined {
    const scene = this.player.getSolvedScene()
    const perso = scene?.persos[itemId]
    if (scene === undefined || perso === undefined) return undefined
    const stateRevision = this.player.componentRuntime?.getStateRevision(itemId) ?? 0
    return [
      scene.graph.revision,
      stateRevision,
      perso.placement.mounted ? 'mounted' : 'detached',
      perso.placement.targetId ?? '',
      perso.placement.parentKey ?? '',
    ].join(':')
  }

  /** Releases visual, component, and clock resources. */
  destroy(): void {
    if (this.ownsEngine) this.engine.stop()
    this.stopTerminalObservation()
    this.captureSourceAdapter.destroy()
    this.emitSourceAdapter.destroy()
    this.motionSystem?.destroy()
    this.liveFirstLayouts.clear()
    this.liveCaptureOccurrences.clear()
    this.player.destroy()
    this.nodes.persoNodes.clear()
    this.nodes.persoParts.clear()
    this.nodes.targetNodes.clear()
    this.motionContainerResolver.clear()
    this.restoreInteractionLock()
  }

  /** Applies the V1-compatible scene interaction gate at the runner boundary. */
  private syncInteractionLock(): void {
    if (!this.interactionLockEnabled) return
    const isPlaying = this.player.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING
    this.interactionRoot.style.pointerEvents = isPlaying ? this.initialPointerEvents : 'none'
    if (this.initialInert || !isPlaying) this.interactionRoot.setAttribute('inert', '')
    else this.interactionRoot.removeAttribute('inert')
  }

  /** Restores the host state that existed before the runner took ownership. */
  private restoreInteractionLock(): void {
    if (!this.interactionLockEnabled) return
    this.interactionRoot.style.pointerEvents = this.initialPointerEvents
    if (this.initialInert) this.interactionRoot.setAttribute('inert', '')
    else this.interactionRoot.removeAttribute('inert')
  }
}

/** Builds the logical story index used to keep motion discovery story-local. */
function createMotionStoryIndex(scene: CompiledScene): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) index.set(`${storyId}:${perso.id}`, storyId)
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
    if (intent === undefined) continue
    // One item has one effective action command at a boundary: the last
    // materialized occurrence wins, matching the compiled schedule contract.
    effective.set(`${occurrence.itemId}:${occurrence.startAt}`, intent)
  }
  return Object.freeze([...effective.values()]
    .sort((left, right) => left.startAt - right.startAt
      || compareNumberPaths(left.declarationPath, right.declarationPath)))
}

/** Collects the move identities already represented by captured boundaries. */
function collectBoundaryIntentIds(boundaries: readonly MotionBoundary[]): ReadonlySet<string> {
  return new Set(boundaries.flatMap((boundary) => boundary.intents.map((intent) => intent.id)))
}

/** Checks whether replay and presentation need the same captured intent set. */
function sameMotionIntentSet(
  left: readonly ScheduledMotionIntent[],
  right: readonly ScheduledMotionIntent[],
): boolean {
  if (left.length !== right.length) return false
  const rightIds = new Set(right.map((intent) => intent.id))
  return left.every((intent) => rightIds.has(intent.id))
}

/** Selects complete new boundary groups without recapturing historical groups. */
function selectNewMotionIntentGroups(
  intents: readonly ScheduledMotionIntent[],
  knownIntentIds: ReadonlySet<string>,
  storyByItemId: ReadonlyMap<string, string>,
): readonly ScheduledMotionIntent[] {
  const newGroupKeys = new Set<string>()
  for (const intent of intents) {
    if (knownIntentIds.has(intent.id)) continue
    newGroupKeys.add(scheduledMotionGroupKey(intent, storyByItemId))
  }
  return Object.freeze(intents.filter((intent) => newGroupKeys.has(scheduledMotionGroupKey(intent, storyByItemId))))
}

/** Selects complete schedule groups whose item and boundary were just resolved. */
function selectMotionIntentGroupsForOccurrences(
  intents: readonly ScheduledMotionIntent[],
  occurrences: readonly RuntimeMoveOccurrence[],
  storyByItemId: ReadonlyMap<string, string>,
): readonly ScheduledMotionIntent[] {
  if (occurrences.length === 0) return []
  const keys = new Set(occurrences.map((occurrence) => `${occurrence.itemId}:${occurrence.startAt}`))
  const groupKeys = new Set(
    intents
      .filter((intent) => keys.has(`${intent.itemId}:${intent.startAt}`))
      .map((intent) => scheduledMotionGroupKey(intent, storyByItemId)),
  )
  return Object.freeze(intents.filter((intent) => groupKeys.has(scheduledMotionGroupKey(intent, storyByItemId))))
}

/** Identifies one scheduled motion group in the same way as boundary capture. */
function scheduledMotionGroupKey(
  intent: ScheduledMotionIntent,
  storyByItemId: ReadonlyMap<string, string>,
): string {
  const storyIds = intent.storyIds === undefined || intent.storyIds.length === 0
    ? [storyByItemId.get(intent.itemId) ?? '<unknown>']
    : [...new Set(intent.storyIds)].sort()
  return `${storyIds.join(',')}:${intent.startAt}:${intent.endAt}:${intent.targetReflow ? 'structural' : 'pose'}`
}

/** Merges newly captured groups while replacing an older capture of that group. */
function mergeMotionBoundaries(
  existing: readonly MotionBoundary[],
  additions: readonly MotionBoundary[],
  storyByItemId: ReadonlyMap<string, string>,
): readonly MotionBoundary[] {
  const merged = new Map<string, MotionBoundary>()
  for (const boundary of existing) merged.set(motionBoundaryGroupKey(boundary, storyByItemId), boundary)
  for (const boundary of additions) merged.set(motionBoundaryGroupKey(boundary, storyByItemId), boundary)
  return Object.freeze([...merged.values()].sort((left, right) => (
    left.timeMs - right.timeMs || left.id.localeCompare(right.id)
  )))
}

/** Identifies one effective item group at one captured boundary. */
function motionBoundaryGroupKey(
  boundary: MotionBoundary,
  storyByItemId: ReadonlyMap<string, string>,
): string {
  const intent = boundary.intents[0]
  const storyIds = boundary.storyIds === undefined || boundary.storyIds.length === 0
    ? [intent === undefined ? '<unknown>' : storyByItemId.get(intent.itemId) ?? '<unknown>']
    : [...new Set(boundary.storyIds)].sort()
  const structural = intent?.targetReflow === true ? 'structural' : 'pose'
  // A later resolved move for the same item and boundary replaces the prior
  // effective move, even when its journal event received a new identity. The
  // journal identity remains available in replay history; it must not cause
  // overlapping presentation segments to accumulate in the active graph.
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

/** Creates one component runtime around the visible node registry. */
function createComponentRuntime(
  catalog: RuntimeCapabilityCatalog,
  materializer: RuntimeMaterializer,
  resourceMetadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>,
  resourceMedia: ReadonlyMap<string, RuntimePreloadMediaHandle>,
): RuntimeComponentRuntime {
  return new RuntimeComponentRuntime({
    catalog,
    materializer,
    resourceMetadata,
    resourceMedia,
  })
}

/** Creates the browser ticker lazily. */
function createDefaultTicker(): Ticker {
  return new TimeTicker()
}

/** Resolves one materialized HTML element without exposing component handles. */
function resolveHtmlHandle(node: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : undefined
}

/** Derives the instance-local root targets from the compiled scene manifest. */
function resolveRootTargets(scene: CompiledScene): readonly HtmlRootTarget[] {
  const rootNodeIds = new Set(scene.rootNodeIds)
  return Object.values(scene.scene.stories)
    .filter((story) => story.persos.some((perso) => rootNodeIds.has(perso.id)))
    .map((story) => ({
      id: `__codplay_root__${scene.scene.id}__${story.id}`,
      storyId: story.id,
    }))
}

/** Resolves the browser window that owns the visible HTML root. */
function resolveCaptureEventTarget(root: HTMLElement): EventTarget | undefined {
  const ownerDocument = (root as { ownerDocument?: { defaultView?: EventTarget | null } }).ownerDocument
  return ownerDocument?.defaultView
    ?? (typeof globalThis.window === 'undefined' ? undefined : globalThis.window)
}
