import { RuntimeEngine, type Ticker } from '../engine'
import { TimeTicker } from '../time'
import { RuntimeComponentRuntime } from '../components'
import { RuntimeCapabilityCatalog } from '../catalog'
import type { RuntimeMaterializer } from '../materializer'
import {
  PLAYER_LIFECYCLE_PLAYING,
  RuntimePlayer,
  type MountTargetDeclaration,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type RuntimeEventDispatchResult,
  type RuntimeEventInput,
  type StrapCollections,
} from '../player'
import { HtmlPointerCaptureSourceAdapter } from '../capture'
import type { RuntimeCaptureState } from '../capture'
import { compileMotionSchedule, MotionMaterializer } from '../motion'
import type { CompiledFunctionCollection, CompiledScene } from '../../scene/compiled'
import {
  HtmlComponentMaterializer,
  type HtmlMaterializerRuntimeContext,
} from './html-component-materializer'
import { HtmlMotionPresentationHost } from './html-motion-presentation-host'
import { HtmlMotionSystem } from './html-motion-system'
import { captureHtmlLayoutSnapshot } from './html-layout-snapshot'
import type {
  RuntimePreloadApi,
  RuntimePreloadManifestInput,
  RuntimePreloadOptions,
  RuntimePreloadFailure,
  RuntimePreloadSuccess,
} from '../preload'
import { mergeRuntimePreloadManifests } from '../preload'

/** One HTML root target mapped to the runner's supplied root element. */
export type HtmlRootTarget = Readonly<{
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
  rootTargets: readonly HtmlRootTarget[]
  catalog: RuntimeCapabilityCatalog
  /** Resources already made available to both visible and measurement engines. */
  resources?: readonly string[]
  engine?: RuntimeEngine
  ticker?: Ticker
  functions?: CompiledFunctionCollection
  strapCollections?: StrapCollections
  /** Event target used by the classic HTML pointer capture source. */
  captureEventTarget?: EventTarget
  /** Mirrors the V1 authoring behavior: block scene input unless playing. */
  enableInteractionLock?: boolean
  /** Receives source-adapter failures instead of hiding them in native listeners. */
  onCaptureError?: (error: unknown) => void
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
}>

/** Generic HTML host with one absolute-time presentation circuit. */
export class HtmlPlayerRunner {
  readonly player: RuntimePlayer
  readonly engine: RuntimeEngine
  private readonly ownsEngine: boolean
  private readonly defaultTicker: Ticker | undefined
  private readonly nodes = {
    persoNodes: new Map<string, unknown>(),
    targetNodes: new Map<string, unknown>(),
  }
  private readonly measurementPlayer: RuntimePlayer | undefined
  private readonly measurementEngine: RuntimeEngine | undefined
  private readonly measurementRoot: HTMLElement | undefined
  private readonly measurementNodes: {
    persoNodes: Map<string, unknown>
    targetNodes: Map<string, unknown>
  } | undefined
  private readonly motionSystem: HtmlMotionSystem | undefined
  private readonly captureSourceAdapter: HtmlPointerCaptureSourceAdapter
  private readonly materializerContext: HtmlMaterializerRuntimeContext
  private readonly interactionLockEnabled: boolean
  private readonly interactionRoot: HTMLElement
  private readonly initialPointerEvents: string
  private readonly initialInert: boolean
  private materializationEpoch = 0

  /** Creates visible and isolated-measurement hosts from the same compiled scene. */
  constructor(options: HtmlPlayerRunnerOptions) {
    this.defaultTicker = options.ticker
    this.interactionRoot = options.root
    this.interactionLockEnabled = options.enableInteractionLock === true
    this.initialPointerEvents = options.root.style.pointerEvents
    this.initialInert = options.root.hasAttribute('inert')
    this.materializerContext = { numericLengthScale: 1 }
    options.catalog.lock()
    this.engine = options.engine ?? new RuntimeEngine(options.catalog, { resources: options.resources })
    this.ownsEngine = options.engine === undefined
    const mountTargets: readonly MountTargetDeclaration[] = options.rootTargets.map((target) => ({
      id: target.id,
      kind: 'root',
      storyId: target.storyId,
    }))
    for (const target of options.rootTargets) this.nodes.targetNodes.set(target.id, options.root)

    const componentMaterializer = new HtmlComponentMaterializer(this.nodes, this.materializerContext)
    const materializer = new MotionMaterializer(
      componentMaterializer,
      (timeMs) => this.motionSystem?.present(timeMs),
    )
    const componentRuntime = createComponentRuntime(options.catalog, materializer)
    this.player = new RuntimePlayer(
      options.id,
      this.engine,
      options.compiledScene,
      undefined,
      options.strapCollections,
      undefined,
      mountTargets,
      materializer,
      componentRuntime,
      options.functions,
    )
    this.captureSourceAdapter = new HtmlPointerCaptureSourceAdapter({
      player: this.player,
      compiledScene: options.compiledScene,
      nodes: this.nodes,
      eventTarget: options.captureEventTarget ?? resolveCaptureEventTarget(options.root),
      onError: options.onCaptureError,
      onCaptureTrack: options.onCaptureTrack,
      resolveEndCaptureState: (input) => {
        const captureState = options.resolveEndCaptureState?.(input)
        this.captureLiveFirstLayout(this.player.getCurrentTimeMs())
        return captureState
      },
      onCaptureClose: options.onCaptureClose,
    })

    const measurementRoot = createMeasurementRoot(options.root)
    this.measurementRoot = measurementRoot
    if (measurementRoot === undefined) {
      this.measurementNodes = undefined
      this.measurementPlayer = undefined
      this.measurementEngine = undefined
      this.motionSystem = undefined
      return
    }

    const measurementNodes = {
      persoNodes: new Map<string, unknown>(),
      targetNodes: new Map<string, unknown>(),
    }
    this.measurementNodes = measurementNodes
    for (const target of options.rootTargets) measurementNodes.targetNodes.set(target.id, measurementRoot)
    const measurementMaterializer = new HtmlComponentMaterializer(
      measurementNodes,
      this.materializerContext,
    )
    const measurementRuntime = createComponentRuntime(options.catalog, measurementMaterializer)
    const measurementEngine = new RuntimeEngine(options.catalog, { resources: options.resources })
    this.measurementEngine = measurementEngine
    const measurementPlayer = new RuntimePlayer(
      `${options.id}:measurement`,
      measurementEngine,
      options.compiledScene,
      undefined,
      options.strapCollections,
      this.player.trackJournal,
      mountTargets,
      measurementMaterializer,
      measurementRuntime,
      options.functions,
    )
    this.measurementPlayer = measurementPlayer
    const motionHost = new HtmlMotionPresentationHost(
      options.root,
      (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
    )
    /** Materializes and captures one pure solved state in the isolated measurement host. */
    const measure = (scene: ReturnType<RuntimePlayer['resolveSceneAt']>) => {
      syncMeasurementRoot(options.root, measurementRoot)
      measurementRuntime.sync(scene)
      measurementMaterializer.materializeScene(scene, {
        moveDeltas: [],
      })
      return captureHtmlLayoutSnapshot(measurementRoot, measurementNodes.persoNodes, scene)
    }
    this.motionSystem = new HtmlMotionSystem({
      host: motionHost,
      getIntents: () => compileMotionSchedule(
        options.compiledScene,
        this.player.trackJournal,
        { includePersistOnly: this.player.includesPersistOnlyInCurrent() },
      ),
      getScheduleRevision: () => this.player.trackJournal.getRevision(),
      includePersistOnly: () => this.player.includesPersistOnlyInCurrent(),
      measureAt: (timeMs) => measure(
        measurementPlayer.resolveSceneAt(timeMs, this.player.includesPersistOnlyInCurrent()),
      ),
      measureBefore: (timeMs) => measure(
        measurementPlayer.resolveSceneBeforeBoundary(timeMs, this.player.includesPersistOnlyInCurrent()),
      ),
    })
  }

  /** Initializes the visible player, isolated measurer, and immutable motion graph. */
  init(): PlayerInitResult {
    const visible = this.player.init()
    if (!visible.ok) return visible
    if (this.measurementPlayer === undefined || this.motionSystem === undefined) {
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      return visible
    }
    const measurement = this.measurementPlayer.init()
    if (!measurement.ok) {
      this.player.destroy()
      return measurement
    }
    try {
      this.motionSystem.initialize()
      this.motionSystem.present(this.player.getCurrentTimeMs())
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      return visible
    } catch (error) {
      this.motionSystem.destroy()
      this.measurementPlayer.destroy()
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

    const resourceUrls = mergeRuntimePreloadManifests(manifest).entries.map((entry) => entry.url)
    this.engine.registerResources(resourceUrls)
    this.measurementEngine?.registerResources(resourceUrls)
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

  /** Pauses playback and stops the runner-owned ticker. */
  pause(): void {
    this.player.pause()
    if (this.ownsEngine) this.engine.stop()
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
    this.motionSystem?.clearLiveFirstLayouts()
    const result = this.player.seek(timeMs)
    this.syncInteractionLock()
    return result
  }

  /** Emits one live event through the runner's shared visible/measurement journal. */
  emit(input: Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }): Promise<RuntimeEventDispatchResult> {
    return this.player.emit(input)
  }

  /** Updates the HTML length scale and invalidates measured layout endpoints. */
  resize(numericLengthScale?: number): void {
    if (numericLengthScale !== undefined) this.materializerContext.numericLengthScale = numericLengthScale
    this.materializationEpoch += 1
    this.motionSystem?.invalidate()
    if (this.player.getSolvedScene() !== undefined) this.player.refresh()
    else this.motionSystem?.present(this.player.getCurrentTimeMs())
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

  /** Resolves one materialized perso node for diagnostics and adapters. */
  getPersoNode(persoKey: string): unknown | undefined {
    return this.nodes.persoNodes.get(persoKey)
  }

  /** Resolves one runner target node by its opaque target ID. */
  getTargetNode(targetId: string): unknown | undefined {
    return this.nodes.targetNodes.get(targetId)
  }

  /** Captures the visible FIRST layout before a materializer-specific end commit. */
  private captureLiveFirstLayout(timeMs: number): void {
    if (this.motionSystem === undefined) return
    // The persist-only event is deliberately outside the current playback
    // head. The solved scene is therefore the exact logical state from which
    // the live endEmit move starts, including a previous drop at the same
    // logical time. Reconstructing a generic "before boundary" here would
    // incorrectly include the earlier persist-only event and label the live
    // node with its destination instead of its source.
    const before = this.player.getSolvedScene() ?? this.player.resolveSceneBeforeBoundary(timeMs)
    this.motionSystem.setLiveFirstLayout(captureHtmlLayoutSnapshot(this.interactionRoot, this.nodes.persoNodes, before))
  }

  /** Releases visual, measurement, component, and clock resources. */
  destroy(): void {
    if (this.ownsEngine) this.engine.stop()
    this.captureSourceAdapter.destroy()
    this.motionSystem?.destroy()
    this.measurementPlayer?.destroy()
    this.player.destroy()
    removeMeasurementRoot(this.measurementRoot)
    this.measurementNodes?.persoNodes.clear()
    this.measurementNodes?.targetNodes.clear()
    this.nodes.persoNodes.clear()
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

/** Creates one component runtime around an isolated node registry. */
function createComponentRuntime(
  catalog: RuntimeCapabilityCatalog,
  materializer: RuntimeMaterializer,
): RuntimeComponentRuntime {
  return new RuntimeComponentRuntime({
    catalog,
    materializer,
  })
}

/** Creates an offscreen root with the visible host's layout constraints. */
function createMeasurementRoot(root: HTMLElement): HTMLElement | undefined {
  if (typeof HTMLElement === 'undefined' || !(root instanceof HTMLElement)) return undefined
  const document = root.ownerDocument
  const parent = document.body ?? document.documentElement
  if (parent === null) return undefined
  const measurementRoot = root.cloneNode(false) as HTMLElement
  measurementRoot.setAttribute('data-codplay-measurement-root', '')
  measurementRoot.setAttribute('aria-hidden', 'true')
  measurementRoot.style.position = 'fixed'
  measurementRoot.style.left = '-200vw'
  measurementRoot.style.top = '0'
  measurementRoot.style.visibility = 'hidden'
  measurementRoot.style.pointerEvents = 'none'
  parent.appendChild(measurementRoot)
  syncMeasurementRoot(root, measurementRoot)
  return measurementRoot
}

/** Synchronizes only host constraints; scene content is owned by the measurement player. */
function syncMeasurementRoot(visibleRoot: HTMLElement, measurementRoot: HTMLElement): void {
  const rect = visibleRoot.getBoundingClientRect()
  if (rect.width > 0) measurementRoot.style.width = `${rect.width}px`
  if (rect.height > 0) measurementRoot.style.height = `${rect.height}px`
}

/** Removes the isolated measurement tree. */
function removeMeasurementRoot(root: HTMLElement | undefined): void {
  if (root === undefined) return
  if (typeof root.remove === 'function') root.remove()
  else root.parentElement?.removeChild(root)
}

/** Creates the browser ticker lazily. */
function createDefaultTicker(): Ticker {
  return new TimeTicker()
}

/** Resolves one materialized HTML element without exposing component handles. */
function resolveHtmlHandle(node: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : undefined
}

/** Resolves the browser window that owns the visible HTML root. */
function resolveCaptureEventTarget(root: HTMLElement): EventTarget | undefined {
  const ownerDocument = (root as { ownerDocument?: { defaultView?: EventTarget | null } }).ownerDocument
  return ownerDocument?.defaultView
    ?? (typeof globalThis.window === 'undefined' ? undefined : globalThis.window)
}
