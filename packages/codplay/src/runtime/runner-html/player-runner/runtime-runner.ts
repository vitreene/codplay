import type { CompiledScene } from '../../../scene/compiled'
import type { RuntimeMaterializer } from '../../materializer'
import {
  RuntimeEngine,
  type RuntimeExternalPresentationHandle,
  type Ticker,
} from '../../engine'
import { TimeTicker } from '../../time'
import { RuntimeComponentRuntime } from '../../components'
import type {
  ForeignContentSurface,
  InputComponentSurface,
  MaterializedPart,
  MediaComponentSurface,
} from '../../components'
import { RuntimeCapabilityCatalog } from '../../catalog'
import {
  HtmlPointerCaptureSourceAdapter,
} from '../../capture'
import {
  PLAYER_LIFECYCLE_PLAYING,
  RuntimePlayer,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type RuntimeEventDispatchResult,
} from '../../player'
import {
  HtmlComponentMaterializer,
  type HtmlMaterializerRuntimeContext,
} from '../component-materializer'
import { HtmlPersoEmitSourceAdapter } from '../perso-emit-source-adapter'
import { HtmlMotionContainerResolver } from '../motion-container'
import { MotionMaterializer } from '../../motion'
import type {
  RuntimePreloadMediaHandle,
  RuntimePreloadMediaResources,
  RuntimePreloadMetadata,
} from '../../preload'
import {
  HtmlPlayerMotionController,
} from './motion-controller'
import type {
  HtmlComponentSurface,
  HtmlPlayerEventInput,
  HtmlPlayerRunOptions,
  HtmlPlayerRunResult,
  HtmlPlayerRunnerNodes,
  HtmlPlayerRunnerOptions,
} from './runner-types'

/** Generic HTML host with one absolute-time presentation circuit. */
export class HtmlPlayerRunner {
  readonly player: RuntimePlayer
  readonly engine: RuntimeEngine
  private readonly ownsEngine: boolean
  private readonly defaultTicker: Ticker | undefined
  private readonly nodes: HtmlPlayerRunnerNodes = {
    persoNodes: new Map<string, unknown>(),
    persoParts: new Map<string, readonly MaterializedPart[]>(),
    targetNodes: new Map<string, unknown>(),
  }
  private readonly motionController: HtmlPlayerMotionController
  private readonly captureSourceAdapter: HtmlPointerCaptureSourceAdapter
  private readonly emitSourceAdapter: HtmlPersoEmitSourceAdapter
  private readonly materializerContext: HtmlMaterializerRuntimeContext
  private readonly materializer: RuntimeMaterializer & { invalidateStructure?: () => void }
  private readonly interactionLockEnabled: boolean
  private readonly interactionRoot: HTMLElement
  private readonly rootTargetIds: readonly string[]
  private mountContainer: HTMLElement
  private readonly motionContainerResolver: HtmlMotionContainerResolver
  private readonly initialPointerEvents: string
  private readonly initialInert: boolean
  private materializationEpoch = 0
  private readonly resourceMetadata = new Map<string, RuntimePreloadMetadata[string]>()
  private readonly resourceMedia = new Map<string, RuntimePreloadMediaHandle>()
  private readonly stopTerminalObservation: () => void

  /** Keeps the established internal motion probe path during decomposition. */
  get motionSystem(): ReturnType<HtmlPlayerMotionController['getMotionSystem']> {
    return this.motionController.getMotionSystem()
  }

  /** Keeps the established internal boundary probe path during decomposition. */
  get presentationMotionBoundaries(): ReturnType<HtmlPlayerMotionController['getPresentationMotionBoundaries']> {
    return this.motionController.getPresentationMotionBoundaries()
  }

  /** Creates one visible author host and one optional motion presentation host. */
  constructor(options: HtmlPlayerRunnerOptions) {
    this.defaultTicker = options.ticker
    this.interactionRoot = options.root
    this.mountContainer = options.root
    this.motionContainerResolver = new HtmlMotionContainerResolver(
      options.root,
      this.nodes.persoNodes,
    )
    this.interactionLockEnabled = options.enableInteractionLock === true
    this.initialPointerEvents = options.root.style.pointerEvents
    this.initialInert = options.root.hasAttribute('inert')
    this.materializerContext = {
      numericLengthScale: options.numericLengthScale ?? 1,
      partMarkerPrefix: options.partMarkerPrefix,
    }
    this.fillResourceMetadata(options.resourceMetadata)
    this.fillResourceMedia(options.resourceMedia)

    options.catalog.lock()
    this.engine = options.engine ?? new RuntimeEngine(options.catalog, {
      resources: options.resources,
      idle: options.idle,
    })
    this.ownsEngine = options.engine === undefined
    const rootTargets = resolveRootTargets(options.compiledScene)
    this.rootTargetIds = rootTargets.map((target) => target.id)
    const rootDeclarations = rootTargets.map((target) => ({
      id: target.id,
      kind: 'root' as const,
      storyId: target.storyId,
    }))
    for (const target of rootTargets) {
      this.nodes.targetNodes.set(target.id, options.root)
    }

    this.motionController = new HtmlPlayerMotionController({
      compiledScene: options.compiledScene,
      root: options.root,
      nodes: this.nodes,
      motionContainerResolver: this.motionContainerResolver,
      getPlayer: () => this.player,
      getComponentStateRevision: (itemId) => this.player.componentRuntime?.getStateRevision(itemId) ?? 0,
      presentSceneForGeometryCapture: (scene) => this.player.presentSceneForGeometryCapture(scene),
      getCurrentTimeMs: () => this.player.getCurrentTimeMs(),
      getPersistOnlyMode: () => this.player.includesPersistOnlyInCurrent(),
    })

    const componentMaterializer = new HtmlComponentMaterializer(
      this.nodes,
      this.materializerContext,
    )
    const materializer = new MotionMaterializer(
      componentMaterializer,
      (scene, context) => this.motionController.presentMotion(scene, context),
    )
    this.materializer = materializer
    const componentRuntime = createComponentRuntime(
      options.catalog,
      materializer,
      this.resourceMetadata,
      this.resourceMedia,
      this.engine,
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
      if (this.ownsEngine && this.player.hasSequenceEnded()) {
        this.engine.pause()
      }
      this.syncInteractionLock()
    })
    const eventTarget = options.captureEventTarget ?? resolveCaptureEventTarget(options.root)
    this.captureSourceAdapter = new HtmlPointerCaptureSourceAdapter({
      player: this.player,
      compiledScene: options.compiledScene,
      nodes: this.nodes,
      eventTarget,
      onError: options.onCaptureError,
      onCaptureTrack: options.onCaptureTrack,
      resolveEndCaptureState: (input) => {
        const captureState = options.resolveEndCaptureState?.(input)
        this.motionController.captureLiveFirstLayout(
          input.captureId,
          input.persoKey,
          this.player.getCurrentTimeMs(),
        )
        return captureState
      },
      onCaptureClose: (input) => {
        this.motionController.completeLiveCaptureMotion(input.captureId, input.completed)
        options.onCaptureClose?.(input)
        materializer.invalidateStructure?.()
      },
    })
    this.emitSourceAdapter = new HtmlPersoEmitSourceAdapter({
      player: this.player,
      compiledScene: options.compiledScene,
      nodes: this.nodes,
      eventTarget,
      onDiagnostic: options.onEmitDiagnostic,
    })
  }

  /** Initializes the visible player without preparing unseen motion groups. */
  init(): PlayerInitResult {
    const visible = this.player.init()
    if (!visible.ok) {
      return visible
    }
    try {
      this.motionController.init()
      this.syncInteractionLock()
      this.captureSourceAdapter.attach()
      this.emitSourceAdapter.attach()
      return visible
    } catch (error) {
      this.motionController.destroy()
      this.player.destroy()
      return {
        ok: false,
        diagnostics: createMotionInitializationDiagnostics(error),
      }
    }
  }

  /** Preloads the supplied manifest, initializes the runner and starts playback. */
  async run(options: HtmlPlayerRunOptions): Promise<HtmlPlayerRunResult> {
    try {
      await this.engine.prepareScene(this.player.compiledScene)
    } catch (error) {
      return {
        ok: false,
        phase: 'library',
        error: error instanceof Error ? error.message : String(error),
      }
    }
    const manifest = options.manifest ?? this.player.compiledScene.resources
    const preload = await options.preload.load({
      manifest,
      options: options.preloadOptions,
    })
    if (!preload.ok) {
      return { ok: false, phase: 'preload', preload }
    }
    this.setResourceMetadata(preload.data.metadata)
    this.setResourceMedia(preload.data.media ?? {})
    const resourceUrls = [...new Set([...preload.data.loaded, ...preload.data.skipped])]
    this.engine.registerResources(resourceUrls)
    const init = this.init()
    if (!init.ok) {
      return { ok: false, phase: 'init', preload, init }
    }
    this.play(options.ticker)
    return { ok: true, phase: 'run', preload, init }
  }

  /** Starts playback and, for an owned engine, its frame ticker. */
  play(ticker: Ticker = this.defaultTicker ?? new TimeTicker()): void {
    this.player.play()
    if (this.ownsEngine) {
      this.engine.start(ticker)
    }
    this.syncInteractionLock()
  }

  /** Sets preload metadata explicitly before or after player initialization. */
  setResourceMetadata(metadata: RuntimePreloadMetadata): void {
    this.resourceMetadata.clear()
    this.fillResourceMetadata(metadata)
    if (this.player.getSolvedScene() !== undefined) {
      this.player.refresh()
    }
  }

  /** Sets native media handoffs before initialization; existing nodes persist. */
  setResourceMedia(media: RuntimePreloadMediaResources): void {
    this.resourceMedia.clear()
    this.fillResourceMedia(media)
    if (this.player.getSolvedScene() !== undefined) {
      this.player.refresh()
    }
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
    if (this.ownsEngine) {
      this.engine.pause()
    }
    this.syncInteractionLock()
  }

  /** Resets the logical occurrence in place and suspends the runner ticker. */
  reset(): void {
    this.motionController.beginReset()
    try {
      this.player.reset()
      if (this.ownsEngine) {
        this.engine.pause()
      }
      this.syncInteractionLock()
    } finally {
      this.motionController.endReset()
    }
  }

  /** Advances the shared engine at one deterministic external timestamp. */
  advance(nowMs: number, marginMs = 0): void {
    this.engine.advance(nowMs, marginMs)
  }

  /** Reconstructs and presents one complete logical target transactionally. */
  seek(timeMs: number): PlayerSeekResult {
    const motionState = this.motionController.prepareSeek(timeMs)
    try {
      const result = this.player.seek(timeMs)
      if (!result.ok) {
        this.motionController.restoreSeek(motionState)
      }
      this.syncInteractionLock()
      return result
    } catch (error) {
      this.motionController.restoreSeek(motionState)
      throw error
    } finally {
      this.motionController.completeSeek()
    }
  }

  /** Emits one live event through the visible player's shared journal. */
  emit(input: HtmlPlayerEventInput): Promise<RuntimeEventDispatchResult> {
    return this.player.emit(input)
  }

  /** Updates the HTML length scale and recaptures active motion geometry. */
  resize(numericLengthScale?: number): void {
    if (numericLengthScale !== undefined) {
      this.materializerContext.numericLengthScale = numericLengthScale
    }
    this.materializationEpoch += 1
    if (this.player.getSolvedScene() === undefined) {
      return
    }
    const hadCapturedMotion = this.motionController.hasCapturedMotionBoundaries()
    if (hadCapturedMotion) {
      this.motionController.resize()
    }
    this.player.refresh({ emitMotionOccurrences: hadCapturedMotion })
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

  /** Returns the latest numeric presentation frame. */
  getPresentationFrame(): import('../../motion').PresentationFrame | undefined {
    return this.motionController.getPresentationFrame()
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

  /** Returns the currently mounted scene roots without an envelope node. */
  getMaterializedRoots(): readonly unknown[] {
    const scene = this.player.getSolvedScene()
    if (scene === undefined) {
      return []
    }
    return scene.graph.rootPersoKeys.flatMap((persoKey) => (
      materializedRootNodes(this.nodes.persoNodes.get(persoKey))
    ))
  }

  /** Rebinds root targets and reconciles the current scene in a mount container. */
  setMountContainer(container: HTMLElement): void {
    if (this.mountContainer === container) {
      return
    }
    this.mountContainer = container
    for (const targetId of this.rootTargetIds) {
      this.nodes.targetNodes.set(targetId, container)
    }
    this.materializer.invalidateStructure?.()
    if (this.player.getSolvedScene() !== undefined) {
      this.player.refresh()
    }
  }

  /** Resolves one typed component surface for a runner-owned adapter. */
  getComponentSurface(componentId: string, surfaceId: 'media'): MediaComponentSurface | undefined
  getComponentSurface(componentId: string, surfaceId: 'input'): InputComponentSurface | undefined
  getComponentSurface(componentId: string, surfaceId: 'foreignContent'): ForeignContentSurface | undefined
  getComponentSurface(componentId: string, surfaceId: 'media' | 'input' | 'foreignContent'): HtmlComponentSurface {
    const surfaces = this.player.componentRuntime?.getComponentSurfaces()
    if (surfaceId === 'foreignContent') {
      return surfaces?.getForeignContentSurface?.(componentId)
    }
    if (surfaceId === 'input') {
      return surfaces?.getInputSurface?.(componentId)
    }
    return surfaces?.getSurface(componentId, surfaceId)
  }

  /** Prepares a module-owned presentation around one runner-level operation. */
  prepareExternalPresentation(
    componentId: string,
    kind: string,
    options?: unknown,
  ): RuntimeExternalPresentationHandle | undefined {
    return this.player.prepareExternalPresentation(componentId, kind, options)
  }

  /** Releases visual, component and clock resources. */
  destroy(): void {
    if (this.ownsEngine) {
      this.engine.stop()
    }
    this.stopTerminalObservation()
    this.captureSourceAdapter.destroy()
    this.emitSourceAdapter.destroy()
    this.motionController.destroy()
    this.player.destroy()
    this.nodes.persoNodes.clear()
    this.nodes.persoParts.clear()
    this.nodes.targetNodes.clear()
    this.motionContainerResolver.clear()
    this.restoreInteractionLock()
  }

  /** Stores preload metadata in the runner-owned resource boundary. */
  private fillResourceMetadata(metadata: RuntimePreloadMetadata | undefined): void {
    for (const [url, entry] of Object.entries(metadata ?? {})) {
      this.resourceMetadata.set(url, entry)
    }
  }

  /** Stores native media handoffs in the runner-owned resource boundary. */
  private fillResourceMedia(media: RuntimePreloadMediaResources | undefined): void {
    for (const [url, handle] of Object.entries(media ?? {})) {
      this.resourceMedia.set(url, handle)
    }
  }

  /** Applies the scene interaction gate at the runner boundary. */
  private syncInteractionLock(): void {
    if (!this.interactionLockEnabled) {
      return
    }
    const isPlaying = this.player.getLifecycleState() === PLAYER_LIFECYCLE_PLAYING
    this.interactionRoot.style.pointerEvents = isPlaying
      ? this.initialPointerEvents
      : 'none'
    if (this.initialInert || !isPlaying) {
      this.interactionRoot.setAttribute('inert', '')
    } else {
      this.interactionRoot.removeAttribute('inert')
    }
  }

  /** Restores the host state that existed before runner ownership. */
  private restoreInteractionLock(): void {
    if (!this.interactionLockEnabled) {
      return
    }
    this.interactionRoot.style.pointerEvents = this.initialPointerEvents
    if (this.initialInert) {
      this.interactionRoot.setAttribute('inert', '')
    } else {
      this.interactionRoot.removeAttribute('inert')
    }
  }
}

/** Creates a component runtime around the visible node registry. */
function createComponentRuntime(
  catalog: RuntimeCapabilityCatalog,
  materializer: RuntimeMaterializer,
  resourceMetadata: ReadonlyMap<string, RuntimePreloadMetadata[string]>,
  resourceMedia: ReadonlyMap<string, RuntimePreloadMediaHandle>,
  engine: RuntimeEngine,
): RuntimeComponentRuntime {
  return new RuntimeComponentRuntime({
    catalog,
    materializer,
    runtime: engine.getComponentRuntimeContext(),
    resourceMetadata,
    resourceMedia,
  })
}

/** Creates the diagnostic report used when motion initialization fails. */
function createMotionInitializationDiagnostics(error: unknown): {
  all: readonly [{ severity: 'error'; code: string; message: string }]
  warnings: readonly []
  errors: readonly [{ severity: 'error'; code: string; message: string }]
} {
  const message = error instanceof Error
    ? error.message
    : 'Motion runner initialization failed.'
  const issue = {
    severity: 'error' as const,
    code: 'RUNTIME_MOTION_INIT_FAILED',
    message,
  }
  return { all: [issue], warnings: [], errors: [issue] }
}

/** Expands one materialized component root or ordered fragment of roots. */
function materializedRootNodes(root: unknown): readonly unknown[] {
  if (root === undefined || root === null) {
    return []
  }
  return Array.isArray(root) ? root : [root]
}

/** Derives instance-local root targets from the compiled scene manifest. */
function resolveRootTargets(scene: CompiledScene): readonly {
  id: string
  storyId: string
}[] {
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
  const ownerDocument = (root as {
    ownerDocument?: { defaultView?: EventTarget | null }
  }).ownerDocument
  return ownerDocument?.defaultView
    ?? (typeof globalThis.window === 'undefined' ? undefined : globalThis.window)
}
