import { RuntimeEngine, type Ticker } from '../engine'
import { TimeTicker } from '../time'
import { RuntimeComponentRuntime } from '../components'
import { RuntimeCapabilityCatalog } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'
import {
  PLAYER_LIFECYCLE_PLAYING,
  RuntimePlayer,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type RuntimeEventDispatchResult,
  type RuntimeEventInput,
  type StrapCollections,
} from '../player'
import { HtmlPointerCaptureSourceAdapter } from '../capture'
import type { RuntimeCaptureState } from '../capture'
import { HtmlPersoEmitSourceAdapter } from './perso-emit-source-adapter'
import type { Diagnostic } from '../../diagnostics'
import { compileMotionSchedule, MotionMaterializer } from '../motion'
import type { LayoutSnapshot, MotionBoundary } from '../motion'
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
  resolveHtmlMotionActionTransition,
} from './motion-capture'
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

/** One instance-local root target mapped to the runner's supplied root element. */
type HtmlRootTarget = Readonly<{
  id: string
  storyId: string
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
  private motionSystem: HtmlMotionSystem | undefined = undefined
  private replayMotionBoundaries: readonly MotionBoundary[] = []
  private presentationMotionBoundaries: readonly MotionBoundary[] = []
  private readonly liveFirstLayouts = new Map<string, { timeMs: number; snapshot: LayoutSnapshot }>()
  private readonly captureSourceAdapter: HtmlPointerCaptureSourceAdapter
  private readonly emitSourceAdapter: HtmlPersoEmitSourceAdapter
  private readonly materializerContext: HtmlMaterializerRuntimeContext
  private readonly interactionLockEnabled: boolean
  private readonly interactionRoot: HTMLElement
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
      (timeMs) => this.presentMotion(timeMs),
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
        this.captureLiveFirstLayout(input.captureId, this.player.getCurrentTimeMs())
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

    const compiledIntents = compileMotionSchedule(options.compiledScene, undefined, {
      resolveActionTransition: resolveHtmlMotionActionTransition,
    })
    if (compiledIntents.length === 0) {
      this.motionSystem = undefined
      return
    }
    this.motionSystem = this.createMotionSystem()
  }

  /** Initializes the visible player and captures motion boundaries when required. */
  init(): PlayerInitResult {
    const visible = this.player.init()
    if (!visible.ok) return visible
    if (this.motionSystem === undefined) {
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      this.emitSourceAdapter.attach()
      return visible
    }
    try {
      this.motionSystem.prepareGeometryCapture()
      const intents = compileMotionSchedule(
        this.player.compiledScene,
        this.player.trackJournal,
        {
          includePersistOnly: this.player.includesPersistOnlyInCurrent(),
          resolveActionTransition: resolveHtmlMotionActionTransition,
        },
      )
      const boundaries = captureHtmlMotionBoundaries({
        player: this.player,
        root: this.interactionRoot,
        nodes: this.nodes.persoNodes,
        intents,
        includePersistOnly: this.player.includesPersistOnlyInCurrent(),
      })
      this.replayMotionBoundaries = boundaries
      this.presentationMotionBoundaries = boundaries
      this.motionSystem.setBoundaries(this.presentationMotionBoundaries)
      this.motionSystem.initialize()
      this.presentMotion(this.player.getCurrentTimeMs())
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      this.emitSourceAdapter.attach()
      return visible
    } catch (error) {
      this.motionSystem.destroy()
      this.player.destroy()
      return {
        ok: false,
        diagnostics: {
          all: [{ severity: 'error', code: 'RUNTIME_MOTION_INIT_FAILED', message: error instanceof Error ? error.message : 'Motion graph initialization failed.' }],
          warnings: [],
          errors: [{ severity: 'error', code: 'RUNTIME_MOTION_INIT_FAILED', message: error instanceof Error ? error.message : 'Motion graph initialization failed.' }],
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

  /** Presents one logical time through the exact same motion operation as Play. */
  seek(timeMs: number): PlayerSeekResult {
    // The live release handoff belongs only to the current capture close. A
    // seek must rebuild the replayable persist-only source-to-target motion.
    this.liveFirstLayouts.clear()
    this.motionSystem?.prepareSeek()
    try {
      if (this.motionSystem !== undefined) {
        this.presentationMotionBoundaries = this.replayMotionBoundaries
        this.motionSystem.setBoundaries(this.presentationMotionBoundaries)
      }
      const result = this.player.seek(timeMs)
      this.syncInteractionLock()
      return result
    } finally {
      this.motionSystem?.completeSeek()
    }
  }

  /** Emits one live event through the visible player's shared journal. */
  emit(input: Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }): Promise<RuntimeEventDispatchResult> {
    return this.player.emit(input)
  }

  /** Updates the HTML length scale and recaptures motion endpoints if needed. */
  resize(numericLengthScale?: number): void {
    if (numericLengthScale !== undefined) this.materializerContext.numericLengthScale = numericLengthScale
    this.materializationEpoch += 1
    if (this.motionSystem !== undefined && this.player.getSolvedScene() !== undefined) {
      this.motionSystem.prepareGeometryCapture()
      try {
        const replayIntents = compileMotionSchedule(
          this.player.compiledScene,
          this.player.trackJournal,
          {
            includePersistOnly: true,
            resolveActionTransition: resolveHtmlMotionActionTransition,
          },
        )
        this.replayMotionBoundaries = captureHtmlMotionBoundaries({
          player: this.player,
          root: this.interactionRoot,
          nodes: this.nodes.persoNodes,
          intents: replayIntents,
          includePersistOnly: true,
        })
        const presentationIntents = compileMotionSchedule(
          this.player.compiledScene,
          this.player.trackJournal,
          {
            includePersistOnly: this.player.includesPersistOnlyInCurrent(),
            resolveActionTransition: resolveHtmlMotionActionTransition,
          },
        )
        this.presentationMotionBoundaries = captureHtmlMotionBoundaries({
          player: this.player,
          root: this.interactionRoot,
          nodes: this.nodes.persoNodes,
          intents: presentationIntents,
          includePersistOnly: this.player.includesPersistOnlyInCurrent(),
        })
        this.motionSystem.setBoundaries(this.presentationMotionBoundaries)
      } finally {
        this.player.refresh()
      }
      return
    }
    if (this.player.getSolvedScene() !== undefined) this.player.refresh()
    else this.presentMotion(this.player.getCurrentTimeMs())
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
  private captureLiveFirstLayout(captureId: string, timeMs: number): void {
    // The persist-only event is deliberately outside the current playback
    // head. The solved scene is therefore the exact logical state from which
    // the live endEmit move starts, including a previous drop at the same
    // logical time. Reconstructing a generic "before boundary" here would
    // incorrectly include the earlier persist-only event and label the live
    // node with its destination instead of its source.
    const before = this.player.getSolvedScene() ?? this.player.resolveSceneBeforeBoundary(timeMs)
    const snapshot = captureCurrentHtmlMotionLayout(
      this.interactionRoot,
      this.nodes.persoNodes,
      before,
      new Set(Object.keys(before.persos)),
    )
    this.liveFirstLayouts.set(captureId, { timeMs, snapshot })
  }

  /** Completes the same graph boundary after the normal capture event circuit. */
  private completeLiveCaptureMotion(captureId: string, completed: boolean): void {
    const first = this.liveFirstLayouts.get(captureId)
    this.liveFirstLayouts.delete(captureId)
    if (!completed || first === undefined) return

    const replayIntents = compileMotionSchedule(
      this.player.compiledScene,
      this.player.trackJournal,
      {
        includePersistOnly: true,
        resolveActionTransition: resolveHtmlMotionActionTransition,
      },
    )
    const currentIntents = compileMotionSchedule(
      this.player.compiledScene,
      this.player.trackJournal,
      {
        includePersistOnly: false,
        resolveActionTransition: resolveHtmlMotionActionTransition,
      },
    )
    this.motionSystem?.prepareGeometryCapture()
    const knownIntentIds = new Set(this.replayMotionBoundaries
      .flatMap((boundary) => boundary.intents.map((intent) => intent.id)))
    const liveIntents = currentIntents.filter((intent) => (
      intent.startAt === first.timeMs && !knownIntentIds.has(intent.id)
    ))

    this.replayMotionBoundaries = captureHtmlMotionBoundaries({
      player: this.player,
      root: this.interactionRoot,
      nodes: this.nodes.persoNodes,
      intents: replayIntents,
      includePersistOnly: true,
    })
    let presentationBoundaries = captureHtmlMotionBoundaries({
      player: this.player,
      root: this.interactionRoot,
      nodes: this.nodes.persoNodes,
      intents: currentIntents,
      includePersistOnly: false,
    })
    if (liveIntents.length > 0) {
      const liveBoundaries = captureHtmlLiveMotionBoundary({
        player: this.player,
        root: this.interactionRoot,
        nodes: this.nodes.persoNodes,
        first: first.snapshot,
        intents: liveIntents,
      })
      const liveIntentIds = new Set(liveIntents.map((intent) => intent.id))
      presentationBoundaries = [
        ...presentationBoundaries.filter((boundary) => !boundary.intents.some((intent) => liveIntentIds.has(intent.id))),
        ...liveBoundaries,
      ]
    }
    this.presentationMotionBoundaries = Object.freeze(presentationBoundaries)
    const motionSystem = this.motionSystem ?? this.createMotionSystem()
    this.motionSystem = motionSystem
    motionSystem.setBoundaries(this.presentationMotionBoundaries)
    motionSystem.initialize()
    this.presentMotion(this.player.getCurrentTimeMs())
  }

  private presentMotion(timeMs: number): void {
    const motionSystem = this.motionSystem
    if (motionSystem === undefined) return
    motionSystem.present(timeMs)
  }

  /** Creates the one optional HTML motion presenter for this visible root. */
  private createMotionSystem(): HtmlMotionSystem {
    const motionHost = new HtmlMotionPresentationHost(
      this.interactionRoot,
      (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
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
    this.player.destroy()
    this.nodes.persoNodes.clear()
    this.nodes.persoParts.clear()
    this.nodes.targetNodes.clear()
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
