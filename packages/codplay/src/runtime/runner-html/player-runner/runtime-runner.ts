import type { Diagnostic } from '../../../diagnostics'
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
  type SolvedScene,
} from '../../player'
import type {
  HtmlSourceAdapter,
  HtmlSourceAdapterContext,
} from '../source-adapter'
import { isMeasurableHtmlElement } from '../element-guards'
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
  private readonly sourceAdapters: readonly HtmlSourceAdapter[]
  private sourceAdaptersAttached = false
  private seeking = false
  private lastSourcePlaybackState: PlayerLifecycleState | undefined
  private readonly reportSourceDiagnostic: (diagnostic: Diagnostic) => void
  private sourceAdaptersDestroyed = false

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
    this.reportSourceDiagnostic = options.onEmitDiagnostic ?? (() => undefined)
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
      (event) => this.forwardPublicEvent(event, options.onPublicEvent),
      options.idle,
      options.onTrace,
    )
    this.stopTerminalObservation = this.player.subscribeTransport(() => {
      if (this.ownsEngine && this.player.hasSequenceEnded()) {
        this.engine.pause()
      }
      this.syncInteractionLock()
      if (!this.seeking) {
        this.notifySourcePlaybackState()
        const scene = this.player.getSolvedScene()
        if (scene !== undefined) {
          this.notifySourceAdapters('scene-presented', (adapter) => adapter.onScenePresented?.(scene))
        }
      }
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
    this.sourceAdapters = (options.sourceAdapterFactories ?? []).map((factory) => (
      factory(this.createSourceAdapterContext(options))
    ))
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
      this.attachSourceAdapters()
      return visible
    } catch (error) {
      this.destroySourceAdapters()
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
    this.notifySourcePlaybackState()
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
    this.notifySourcePlaybackState()
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
      this.notifySourcePlaybackState()
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
    this.seeking = true
    this.notifySourceAdapters('before-seek', (adapter) => adapter.beforeSeek?.())
    let motionState: ReturnType<HtmlPlayerMotionController['prepareSeek']> | undefined
    let result: PlayerSeekResult | undefined
    let motionPrepared = false
    try {
      const preparedMotionState = this.motionController.prepareSeek(timeMs)
      motionState = preparedMotionState
      motionPrepared = true
      result = this.player.seek(timeMs)
      if (!result.ok) {
        this.motionController.restoreSeek(preparedMotionState)
      }
      this.syncInteractionLock()
      return result
    } catch (error) {
      if (motionPrepared) {
        this.motionController.restoreSeek(motionState!)
      }
      throw error
    } finally {
      if (motionPrepared) {
        this.motionController.completeSeek()
      }
      this.seeking = false
      const scene = this.player.getSolvedScene()
      this.notifySourceAfterSeek(scene, result)
      if (scene !== undefined) {
        this.notifySourceAdapters('scene-presented-after-seek', (adapter) => adapter.onScenePresented?.(scene))
      }
      this.notifySourcePlaybackState()
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
    this.destroySourceAdapters()
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

  /** Creates the restricted browser-source context without exposing runner-owned registries. */
  private createSourceAdapterContext(
    options: HtmlPlayerRunnerOptions,
  ): HtmlSourceAdapterContext {
    return {
      compiledScene: options.compiledScene,
      getSolvedScene: () => this.player.getSolvedScene(),
      getLifecycleState: () => this.player.getLifecycleState(),
      getCurrentTimeMs: () => this.player.getCurrentTimeMs(),
      resolvePersoElement: (persoKey) => resolveMaterializedElement(this.nodes.persoNodes.get(persoKey)),
      commands: {
        emit: (input) => this.player.emit(input),
        beginCompiledCapture: (input) => this.player.beginCompiledCapture(input),
        trackCapture: (captureId, sample) => this.player.trackCapture(captureId, sample),
        endCapture: (captureId, meta) => this.player.endCapture(captureId, meta),
        cancelCapture: (captureId) => this.player.cancelCapture(captureId),
        setLiveActions: (sourceId, actions) => this.player.setLiveActions(sourceId, actions),
      },
      reportDiagnostic: this.reportSourceDiagnostic,
    }
  }

  /** Attaches browser sources only after the initial logical scene is materialized. */
  private attachSourceAdapters(): void {
    if (this.sourceAdaptersDestroyed || this.sourceAdaptersAttached) {
      return
    }
    this.sourceAdaptersAttached = true
    this.lastSourcePlaybackState = undefined
    this.notifySourceAdapters('attach', (adapter) => adapter.attach())
    this.notifySourcePlaybackState()
  }

  /** Delivers one host-owned lifecycle notification to each active source. */
  private notifySourceAdapters(
    phase: string,
    notify: (adapter: HtmlSourceAdapter) => void,
  ): void {
    if (!this.sourceAdaptersAttached || this.sourceAdaptersDestroyed) {
      return
    }
    this.sourceAdapters.forEach((adapter, adapterIndex) => {
      try {
        notify(adapter)
      } catch (error) {
        this.reportSourceAdapterFailure(phase, adapterIndex, error)
      }
    })
  }

  /** Reports one adapter callback failure through the existing HTML diagnostic port. */
  private reportSourceAdapterFailure(phase: string, adapterIndex: number, error: unknown): void {
    this.reportSourceDiagnostic({
      severity: 'error',
      code: 'RUNTIME_HTML_SOURCE_ADAPTER_FAILED',
      message: error instanceof Error ? error.message : String(error),
      details: {
        refs: { sceneId: this.player.compiledScene.scene.id },
        context: { phase, adapterIndex },
      },
    })
  }

  /** Announces lifecycle changes while keeping playback state owned by the player. */
  private notifySourcePlaybackState(): void {
    if (!this.sourceAdaptersAttached || this.sourceAdaptersDestroyed) {
      return
    }
    const state = this.player.getLifecycleState()
    if (state === this.lastSourcePlaybackState) {
      return
    }
    this.lastSourcePlaybackState = state
    this.notifySourceAdapters('playback-state-change', (adapter) => (
      adapter.onPlaybackStateChange?.(state)
    ))
  }

  /** Lets sources cancel transient work before the player finalizes sequence:end. */
  private forwardPublicEvent(
    event: import('../../player/pipeline').RuntimeTrackEvent,
    onPublicEvent: HtmlPlayerRunnerOptions['onPublicEvent'],
  ): void {
    if (event.name === 'sequence:end') {
      this.notifySourceAdapters('sequence-end', (adapter) => adapter.onSequenceEnd?.(event))
    }
    onPublicEvent?.(event)
  }

  /** Suspends scroll and observer work around one transactional seek. */
  private notifySourceAfterSeek(
    scene: SolvedScene | undefined,
    result: PlayerSeekResult | undefined,
  ): void {
    this.notifySourceAdapters('after-seek', (adapter) => adapter.afterSeek?.(scene, result))
  }

  /** Destroys optional sources before built-in adapters and the player are torn down. */
  private destroySourceAdapters(): void {
    if (this.sourceAdaptersDestroyed) {
      return
    }
    this.sourceAdaptersDestroyed = true
    this.sourceAdaptersAttached = false
    this.sourceAdapters.forEach((adapter, adapterIndex) => {
      try {
        adapter.destroy()
      } catch (error) {
        this.reportSourceAdapterFailure('destroy', adapterIndex, error)
      }
    })
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

/** Resolves the first measurable HTML root without exposing the materialization registry. */
function resolveMaterializedElement(root: unknown): Element | undefined {
  return materializedRootNodes(root).find(isMeasurableHtmlElement)
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
