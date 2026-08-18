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
import { createHtmlDomProjection, HtmlFlipRuntime } from '../flip'
import {
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  RuntimeComponentServiceCatalog,
} from '../components'
import {
  LayoutDomBackend,
  MoveFlipLayoutProjection,
  RuntimePlayer,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type MountTargetDeclaration,
  type SolvedScene,
} from '../player'
import type { CompiledScene } from '../../scene/compiled'
import { HtmlComponentMaterializer } from './html-component-materializer'
import { createHtmlMoveCaptureBuilder, type HtmlMoveCaptureBuilderOptions } from './html-move-capture-builder'
import type { FlipCapture } from '../flip'
import { resolveCompiledMoveCapture } from './html-compiled-move-capture-resolver'

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
    const htmlProjection = createHtmlDomProjection({
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
      root: options.root,
      resolveHandle: (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
    })
    const captureBuilderOptions: HtmlMoveCaptureBuilderOptions = {
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
    }
    this.captureBuilder = createHtmlMoveCaptureBuilder(captureBuilderOptions)
    let runtimePlayer: RuntimePlayer | undefined
    this.flipRuntime = new HtmlFlipRuntime(htmlProjection, undefined, ({ timeMs }) => {
      if (runtimePlayer === undefined) return undefined
      return this.resolveColdCapture(runtimePlayer, timeMs)
    })
    const layoutProjection = new MoveFlipLayoutProjection({
      base: backend,
      flip: this.flipRuntime,
      hostContextId: options.id,
      getProjectionEpoch: () => this.projectionEpoch,
      buildCapture: this.captureBuilder,
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

  /** Realizes one compiled move occurrence through a temporary historical DOM. */
  private resolveColdCapture(player: RuntimePlayer, timeMs: number): FlipCapture | undefined {
    return resolveCompiledMoveCapture({
      player,
      flipRuntime: this.flipRuntime,
      captureBuilder: this.captureBuilder,
      presentHistoricalScene: (scene) => this.presentHistoricalScene(scene),
    }, timeMs)
  }

  /** Presents one historical scene without emitting logical module deltas. */
  private presentHistoricalScene(scene: SolvedScene): void {
    this.backend.project(scene, {
      phase: 'historical',
      moveDeltas: [],
      layoutState: this.player.getHistoricalLayoutProjectionState(scene),
      authoredSync: (authoredScene) => this.componentRuntime.sync(authoredScene),
    })
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
