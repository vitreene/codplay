import {
  createMarkupModuleServiceDefinition,
  MARKUP_MODULE_SERVICE_ID,
} from '../capabilities/markup'
import {
  createListModuleServiceDefinition,
  LIST_MODULE_SERVICE_ID,
} from '../capabilities/list'
import {
  RuntimeEngine,
  RuntimeModuleServiceCatalog,
  type Ticker,
} from '../engine'
import { TimeTicker } from '../time'
import { captureHtmlPose, createHtmlDomProjection, HtmlFlipRuntime, type HtmlFlipProjection } from '../flip'
import {
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  RuntimeComponentServiceCatalog,
} from '../components'
import {
  LayoutDomBackend,
  MoveFlipLayoutProjection,
  createHtmlFlipOverlayContentState,
  RuntimePlayer,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type MountTargetDeclaration,
  type SolvedScene,
} from '../player'
import type { CompiledScene } from '../../scene/compiled'
import { HtmlComponentMaterializer } from './html-component-materializer'
import {
  createHtmlMoveCaptureBuilder,
  type HtmlAncestorRegimeResolver,
  type HtmlMoveCaptureBuilderOptions,
} from './html-move-capture-builder'
import type { FlipCapture } from '../flip'
import { resolveCompiledMoveCaptures } from './html-compiled-move-capture-resolver'
import { HtmlPresentationTransaction } from './html-presentation-transaction'

/** One HTML root target mapped to the runner's supplied root element. */
export type HtmlRootTarget = Readonly<{
  id: string
  storyId: string
}>

/** Construction contract for the logical HTML player tranche. */
export type HtmlPlayerRunnerOptions = Readonly<{
  id: string
  compiledScene: CompiledScene
  root: HTMLElement
  rootTargets: readonly HtmlRootTarget[]
  componentCatalog: RuntimeComponentCatalog
  serviceCatalog: RuntimeComponentServiceCatalog
  engine?: RuntimeEngine
  moduleServiceCatalog?: RuntimeModuleServiceCatalog
  ticker?: Ticker
  /** Optional host declaration for ancestor reflow/compositing regimes. */
  resolveFlipAncestorRegime?: HtmlAncestorRegimeResolver
}>

/** Generic HTML host for materialization, logical placement and player lifecycle. */
export class HtmlPlayerRunner {
  readonly player: RuntimePlayer
  readonly engine: RuntimeEngine
  private readonly ownsEngine: boolean
  private readonly defaultTicker: Ticker | undefined
  private readonly nodes = {
    persoNodes: new Map<string, unknown>(),
    targetNodes: new Map<string, unknown>(),
  }
  private readonly materializer: HtmlComponentMaterializer
  private readonly componentRuntime: RuntimeComponentRuntime
  private readonly backend: LayoutDomBackend
  private readonly captureBuilder: ReturnType<typeof createHtmlMoveCaptureBuilder>
  private readonly flipRuntime: HtmlFlipRuntime
  private readonly presentationTransaction: HtmlPresentationTransaction
  private readonly htmlProjection: HtmlFlipProjection
  private projectionEpoch = 0

  /** Creates one HTML runner and wires the generic component/layout boundaries. */
  constructor(options: HtmlPlayerRunnerOptions) {
    this.defaultTicker = options.ticker
    this.materializer = new HtmlComponentMaterializer(this.nodes)
    const moduleCatalog = options.moduleServiceCatalog ?? new RuntimeModuleServiceCatalog()
    if (options.engine === undefined) {
      registerMarkupModule(moduleCatalog)
      registerListModule(moduleCatalog)
    }
    this.engine = options.engine ?? new RuntimeEngine(
      {
        ...options.compiledScene.requirements,
        modules: [...new Set(options.compiledScene.requirements.modules)],
      },
      { moduleServiceCatalog: moduleCatalog },
    )
    this.ownsEngine = options.engine === undefined
    const mountTargets: readonly MountTargetDeclaration[] = options.rootTargets.map((target) => ({
      id: target.id,
      kind: 'root',
      storyId: target.storyId,
    }))
    for (const target of options.rootTargets) this.nodes.targetNodes.set(target.id, options.root)
    const componentRuntime = new RuntimeComponentRuntime({
      catalog: options.componentCatalog,
      serviceCatalog: options.serviceCatalog,
      materialize: (component, identity, initial, mountablePartIds, moduleServices) => this.materializer.materialize(
        component,
        identity,
        initial,
        mountablePartIds,
        moduleServices,
      ),
    })
    this.componentRuntime = componentRuntime
    const backend = new LayoutDomBackend(this.nodes)
    this.backend = backend
    let runtimePlayer: RuntimePlayer | undefined
    const htmlProjection = createHtmlDomProjection({
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
      root: options.root,
      resolveHandle: (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
      captureHistoricalPose: ({ ancestorId, timeMs }) => {
        if (runtimePlayer === undefined) throw new Error('HTML historical pose requested before the player exists.')
        const currentScene = runtimePlayer.getSolvedScene()
        if (currentScene === undefined) throw new Error('HTML historical pose requested before the player is initialized.')
        const historicalScene = runtimePlayer.resolveSceneAt(timeMs)
        try {
          if (historicalScene.persos[ancestorId]?.placement.mounted !== true) {
            throw new Error(`FLIP historical ancestor is not mounted: ${ancestorId}`)
          }
          this.presentHistoricalScene(historicalScene)
          const handle = resolveHtmlHandle(this.nodes.persoNodes.get(ancestorId))
          if (handle === undefined) throw new Error(`FLIP historical ancestor handle is missing: ${ancestorId}`)
          return captureHtmlPose(handle)
        } finally {
          this.restoreCurrentScene()
        }
      },
    })
    this.htmlProjection = htmlProjection
    const captureBuilderOptions: HtmlMoveCaptureBuilderOptions = {
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
      ...(options.resolveFlipAncestorRegime === undefined
        ? {}
        : { resolveAncestorRegime: options.resolveFlipAncestorRegime }),
    }
    this.captureBuilder = createHtmlMoveCaptureBuilder(captureBuilderOptions)
    const presentationTransaction = new HtmlPresentationTransaction({
      projection: htmlProjection,
      present: (scene) => this.presentHistoricalScene(scene),
      restore: () => this.restoreCurrentScene(),
    })
    this.presentationTransaction = presentationTransaction
    this.flipRuntime = new HtmlFlipRuntime(
      htmlProjection,
      undefined,
      ({ captures, timeMs }) => {
        if (runtimePlayer === undefined) return []
        const requestedIds = new Set(captures.map((capture) => capture.captureId))
        const occurrences = runtimePlayer.getActiveMoveTransitionOccurrences(timeMs)
          .filter((occurrence) => requestedIds.size === 0 || requestedIds.has(occurrence.captureId))
        return this.resolveColdCaptures(runtimePlayer, timeMs, occurrences)
      },
      {
        getActiveCaptureDescriptors: (timeMs) => runtimePlayer?.getActiveMoveTransitionOccurrences(timeMs) ?? [],
      },
    )
    const layoutProjection = new MoveFlipLayoutProjection({
      base: backend,
      flip: this.flipRuntime,
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
    })
    runtimePlayer = new RuntimePlayer(
      options.id,
      this.engine,
      options.compiledScene,
      undefined,
      undefined,
      undefined,
      undefined,
      mountTargets,
      layoutProjection,
      componentRuntime,
    )
    this.player = runtimePlayer
  }

  /** Initializes the player and materializes the scene's component instances. */
  init(): PlayerInitResult {
    return this.player.init()
  }

  /** Starts playback and, for an owned engine, its frame ticker. */
  play(ticker: Ticker = this.defaultTicker ?? createDefaultTicker()): void {
    this.player.play()
    if (this.ownsEngine) this.engine.start(ticker)
  }

  /** Pauses playback and stops the runner-owned ticker. */
  pause(): void {
    this.player.pause()
    if (this.ownsEngine) {
      this.engine.stop()
    }
  }

  /** Advances the shared engine at one deterministic external timestamp. */
  advance(nowMs: number, marginMs = 0): void {
    this.engine.advance(nowMs, marginMs)
  }

  /** Reconstructs and presents one logical time without replaying events. */
  seek(timeMs: number): PlayerSeekResult {
    return this.player.seek(timeMs)
  }

  /** Invalidates the host layout epoch after a viewport or scroll change. */
  resize(): void {
    this.projectionEpoch += 1
    const result = this.flipRuntime.invalidateHost(this.player.id, this.projectionEpoch)
    if (!result.ok) throw new Error(result.diagnostics.errors.map((entry) => entry.message).join('\n'))
  }

  /** Returns the current host projection epoch for future visual projections. */
  getProjectionEpoch(): number {
    return this.projectionEpoch
  }

  /** Returns the current player lifecycle state. */
  getLifecycleState(): PlayerLifecycleState {
    return this.player.getLifecycleState()
  }

  /** Returns the current logical scene time. */
  getCurrentTimeMs(): number {
    return this.player.getCurrentTimeMs()
  }

  /** Resolves one materialized perso node for host diagnostics and adapters. */
  getPersoNode(persoKey: string): unknown | undefined {
    return this.nodes.persoNodes.get(persoKey)
  }

  /** Resolves one runner target node by its opaque target ID. */
  getTargetNode(targetId: string): unknown | undefined {
    return this.nodes.targetNodes.get(targetId)
  }

  /** Releases player, component and runner-owned clock resources. */
  destroy(): void {
    if (this.ownsEngine) this.engine.stop()
    this.player.destroy()
    this.nodes.persoNodes.clear()
    this.nodes.targetNodes.clear()
  }

  /** Realizes all active compiled move occurrences through a temporary historical DOM. */
  private resolveColdCaptures(
    player: RuntimePlayer,
    timeMs: number,
    occurrences: readonly import('../player').MoveTransitionOccurrence[],
  ): readonly FlipCapture[] {
    return resolveCompiledMoveCaptures({
      player,
      flipRuntime: this.flipRuntime,
      captureBuilder: this.captureBuilder,
      presentHistoricalScene: (scene) => this.presentHistoricalScene(scene),
      captureFirstOverlayTemplates: (description) => {
        const templates = new Map<string, unknown>()
        const overlayItemIds = description.entries
          .filter((entry) => entry.mode === 'overlay-world')
          .map((entry) => entry.itemId)
        for (const entry of description.entries) {
          if (entry.mode !== 'overlay-world') continue
          const handle = this.htmlProjection.resolveHandle(entry.itemId)
          const descendantItemIds = entry.overlayTargetByPerso === undefined
            ? overlayItemIds.filter((itemId) => itemId !== entry.itemId)
            : Object.keys(entry.overlayTargetByPerso)
          const template = handle === undefined || handle === null
            ? undefined
            : this.htmlProjection.captureOverlayTemplate?.(
              handle,
              descendantItemIds,
            )
          if (template !== undefined) templates.set(entry.itemId, template)
        }
        return templates
      },
      presentationTransaction: this.presentationTransaction,
    }, timeMs, occurrences)
  }

  /** Presents one historical scene without emitting logical module deltas. */
  private presentHistoricalScene(scene: SolvedScene): void {
    this.flipRuntime.setOverlayContentState(createHtmlFlipOverlayContentState(scene))
    this.backend.project(scene, {
      moveDeltas: [],
      layoutState: this.player.getHistoricalLayoutProjectionState(scene),
      authoredSync: (authoredScene) => this.componentRuntime.sync(authoredScene),
    })
  }

  /** Restores the current solved scene after a historical presentation transaction. */
  private restoreCurrentScene(): void {
    const current = this.player.getSolvedScene()
    if (current !== undefined) this.presentHistoricalScene(current)
  }
}

/** Registers the built-in markup module exactly once in one mutable catalog. */
function registerMarkupModule(catalog: RuntimeModuleServiceCatalog): void {
  if (catalog.has(MARKUP_MODULE_SERVICE_ID)) return
  const definition = createMarkupModuleServiceDefinition()
  catalog.register(definition)
}

/** Registers the built-in list module when the runner owns its engine. */
function registerListModule(catalog: RuntimeModuleServiceCatalog): void {
  if (catalog.has(LIST_MODULE_SERVICE_ID)) return
  catalog.register(createListModuleServiceDefinition())
}

/** Creates the browser ticker lazily so construction remains deterministic in tests. */
function createDefaultTicker(): Ticker {
  return new TimeTicker()
}

/** Resolves a materialized HTML element without exposing non-DOM component handles to FLIP. */
function resolveHtmlHandle(node: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : undefined
}
