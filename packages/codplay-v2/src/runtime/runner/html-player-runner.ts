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
import {
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  RuntimeComponentServiceCatalog,
} from '../components'
import {
  LayoutDomBackend,
  RuntimePlayer,
  type MountTargetDeclaration,
  type PlayerInitResult,
  type PlayerLifecycleState,
  type PlayerSeekResult,
  type RuntimeEventDispatchResult,
  type RuntimeEventInput,
  type StrapCollections,
} from '../player'
import { compileMotionSchedule, MotionLayoutProjection } from '../motion'
import type { CompiledFunctionCollection, CompiledScene } from '../../scene/compiled'
import { HtmlComponentMaterializer } from './html-component-materializer'
import { HtmlMotionPresentationHost } from './html-motion-presentation-host'
import { HtmlMotionSystem } from './html-motion-system'
import { captureHtmlLayoutSnapshot } from './html-layout-snapshot'

/** One HTML root target mapped to the runner's supplied root element. */
export type HtmlRootTarget = Readonly<{
  id: string
  storyId: string
}>

/** Construction contract for the logical HTML player and motion graph. */
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
  functions?: CompiledFunctionCollection
  strapCollections?: StrapCollections
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
  private readonly measurementRoot: HTMLElement | undefined
  private readonly measurementNodes: {
    persoNodes: Map<string, unknown>
    targetNodes: Map<string, unknown>
  } | undefined
  private readonly motionSystem: HtmlMotionSystem | undefined
  private projectionEpoch = 0

  /** Creates visible and isolated-measurement hosts from the same compiled scene. */
  constructor(options: HtmlPlayerRunnerOptions) {
    this.defaultTicker = options.ticker
    const moduleCatalog = options.moduleServiceCatalog ?? new RuntimeModuleServiceCatalog()
    registerMarkupModule(moduleCatalog)
    registerListModule(moduleCatalog)
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

    const componentRuntime = createComponentRuntime(
      options.componentCatalog,
      options.serviceCatalog,
      this.nodes,
    )
    const backend = new LayoutDomBackend(this.nodes)
    const layoutProjection = new MotionLayoutProjection(
      backend,
      (timeMs) => this.motionSystem?.present(timeMs),
    )
    this.player = new RuntimePlayer(
      options.id,
      this.engine,
      options.compiledScene,
      undefined,
      undefined,
      options.strapCollections,
      undefined,
      mountTargets,
      layoutProjection,
      componentRuntime,
      options.functions,
    )

    const measurementRoot = createMeasurementRoot(options.root)
    this.measurementRoot = measurementRoot
    if (measurementRoot === undefined) {
      this.measurementNodes = undefined
      this.measurementPlayer = undefined
      this.motionSystem = undefined
      return
    }

    const measurementNodes = {
      persoNodes: new Map<string, unknown>(),
      targetNodes: new Map<string, unknown>(),
    }
    this.measurementNodes = measurementNodes
    for (const target of options.rootTargets) measurementNodes.targetNodes.set(target.id, measurementRoot)
    const measurementRuntime = createComponentRuntime(
      options.componentCatalog,
      options.serviceCatalog,
      measurementNodes,
    )
    const measurementBackend = new LayoutDomBackend(measurementNodes)
    const measurementEngine = new RuntimeEngine(
      {
        ...options.compiledScene.requirements,
        modules: [...new Set(options.compiledScene.requirements.modules)],
      },
      { moduleServiceCatalog: moduleCatalog },
    )
    const measurementPlayer = new RuntimePlayer(
      `${options.id}:measurement`,
      measurementEngine,
      options.compiledScene,
      undefined,
      undefined,
      options.strapCollections,
      this.player.trackJournal,
      mountTargets,
      measurementBackend,
      measurementRuntime,
      options.functions,
    )
    this.measurementPlayer = measurementPlayer
    const motionHost = new HtmlMotionPresentationHost(
      options.root,
      (itemId) => resolveHtmlHandle(this.nodes.persoNodes.get(itemId)),
    )
    /** Projects and captures one pure solved state in the isolated measurement host. */
    const measure = (scene: ReturnType<RuntimePlayer['resolveSceneAt']>) => {
      syncMeasurementRoot(options.root, measurementRoot)
      measurementBackend.project(scene, {
        moveDeltas: [],
        authoredSync: (authoredScene) => measurementRuntime.sync(authoredScene),
      })
      return captureHtmlLayoutSnapshot(measurementRoot, measurementNodes.persoNodes, scene)
    }
    this.motionSystem = new HtmlMotionSystem({
      host: motionHost,
      intents: compileMotionSchedule(options.compiledScene),
      measureAt: (timeMs) => measure(measurementPlayer.resolveSceneAt(timeMs)),
      measureBefore: (timeMs) => measure(measurementPlayer.resolveSceneBeforeBoundary(timeMs)),
    })
  }

  /** Initializes the visible player, isolated measurer, and immutable motion graph. */
  init(): PlayerInitResult {
    const visible = this.player.init()
    if (!visible.ok) return visible
    if (this.measurementPlayer === undefined || this.motionSystem === undefined) return visible
    const measurement = this.measurementPlayer.init()
    if (!measurement.ok) {
      this.player.destroy()
      return measurement
    }
    try {
      this.motionSystem.initialize()
      this.motionSystem.present(this.player.getCurrentTimeMs())
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

  /** Starts playback and, for an owned engine, its frame ticker. */
  play(ticker: Ticker = this.defaultTicker ?? createDefaultTicker()): void {
    this.player.play()
    if (this.ownsEngine) this.engine.start(ticker)
  }

  /** Pauses playback and stops the runner-owned ticker. */
  pause(): void {
    this.player.pause()
    if (this.ownsEngine) this.engine.stop()
  }

  /** Advances the shared engine at one deterministic external timestamp. */
  advance(nowMs: number, marginMs = 0): void {
    this.engine.advance(nowMs, marginMs)
  }

  /** Presents one logical time through the exact same motion operation as Play. */
  seek(timeMs: number): PlayerSeekResult {
    return this.player.seek(timeMs)
  }

  /** Emits one live event through the runner's shared visible/measurement journal. */
  emit(input: Omit<RuntimeEventInput, 'applyAtMs'> & { applyAtMs?: number }): Promise<RuntimeEventDispatchResult> {
    return this.player.emit(input)
  }

  /** Invalidates measured layout endpoints after a host geometry change. */
  resize(): void {
    this.projectionEpoch += 1
    this.motionSystem?.invalidate()
    this.motionSystem?.present(this.player.getCurrentTimeMs())
  }

  /** Returns the current host projection epoch for diagnostics. */
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

  /** Resolves one materialized perso node for diagnostics and adapters. */
  getPersoNode(persoKey: string): unknown | undefined {
    return this.nodes.persoNodes.get(persoKey)
  }

  /** Resolves one runner target node by its opaque target ID. */
  getTargetNode(targetId: string): unknown | undefined {
    return this.nodes.targetNodes.get(targetId)
  }

  /** Releases visual, measurement, component, and clock resources. */
  destroy(): void {
    if (this.ownsEngine) this.engine.stop()
    this.motionSystem?.destroy()
    this.measurementPlayer?.destroy()
    this.player.destroy()
    removeMeasurementRoot(this.measurementRoot)
    this.measurementNodes?.persoNodes.clear()
    this.measurementNodes?.targetNodes.clear()
    this.nodes.persoNodes.clear()
    this.nodes.targetNodes.clear()
  }
}

/** Creates one component runtime around an isolated node registry. */
function createComponentRuntime(
  componentCatalog: RuntimeComponentCatalog,
  serviceCatalog: RuntimeComponentServiceCatalog,
  nodes: { persoNodes: Map<string, unknown>; targetNodes: Map<string, unknown> },
): RuntimeComponentRuntime {
  const materializer = new HtmlComponentMaterializer(nodes)
  return new RuntimeComponentRuntime({
    catalog: componentCatalog,
    serviceCatalog,
    materialize: (component, identity, initial, mountablePartIds, moduleServices) => materializer.materialize(
      component,
      identity,
      initial,
      mountablePartIds,
      moduleServices,
    ),
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

/** Registers the built-in markup module exactly once. */
function registerMarkupModule(catalog: RuntimeModuleServiceCatalog): void {
  if (!catalog.has(MARKUP_MODULE_SERVICE_ID)) catalog.register(createMarkupModuleServiceDefinition())
}

/** Registers the built-in list capability marker exactly once. */
function registerListModule(catalog: RuntimeModuleServiceCatalog): void {
  if (!catalog.has(LIST_MODULE_SERVICE_ID)) catalog.register(createListModuleServiceDefinition())
}

/** Creates the browser ticker lazily. */
function createDefaultTicker(): Ticker {
  return new TimeTicker()
}

/** Resolves one materialized HTML element without exposing component handles. */
function resolveHtmlHandle(node: unknown): HTMLElement | undefined {
  return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : undefined
}
