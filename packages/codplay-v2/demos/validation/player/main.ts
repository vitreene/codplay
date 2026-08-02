import { SceneBuilder } from '../../../src/scene/compiled'
import { ValidationCatalog } from '../../../src/scene/validation'
import { RuntimeEngine, RuntimeModuleServiceCatalog } from '../../../src/runtime/engine'
import {
  createLayoutModuleServiceDefinition,
  materializeComponentWithLayout,
  type LayoutModuleServiceInstance,
} from '../../../src/runtime/capabilities/layout'
import {
  BaseComponent,
  LayoutComponent,
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  TagComponent,
  materializeTemplateString,
} from '../../../src/runtime/components'
import type {
  ComponentInput,
  ComponentServices,
  LayoutInitial,
  TagState,
} from '../../../src/runtime/components'
import {
  diffSolvedScenes,
  executeListenPipeline,
  LayoutDomBackend,
  MemoryRenderSink,
  materializeScene,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
  resolveScene,
  RuntimePlayer,
  RuntimeTrackJournal,
  STRAP_SCOPE_STORY,
  solveScene,
  type MountTargetDeclaration,
  type SolvedScene,
  type StrapCollections,
} from '../../../src/runtime/player'
import type { CompiledRecord, CompiledScene } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

import './style.css'

/** Creates the temporary catalog used only by this visual validation vertical. */
function createCatalog(): ValidationCatalog {
  const catalog = new ValidationCatalog()
  catalog.registerComponent({
    type: 'tag',
    services: [],
    validateInitial: () => undefined,
    validateAction: () => undefined,
  })
  catalog.registerComponent({
    type: 'layout',
    services: ['layout', 'className', 'style', 'attr'],
    modules: ['layout'],
    validateInitial: () => undefined,
    validateAction: () => undefined,
  })
  return catalog
}

const DEMO_LAYOUT_MARKUP = `
  <section class="component-layout">
    <header class="component-layout__header">LayoutComponent / data-part</header>
    <main class="component-layout__content" data-part="demo-outlet"></main>
  </section>
`

/** Creates the small compiled flow presented by the temporary DOM view. */
function createScene(): SceneDoc {
  return {
    id: 'temporary-player-demo',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        straps: ['demo-color'],
        listen: [{ on: 'demo:show', straps: ['demo-color'] }],
        persos: [{
          id: 'demo-layout',
          type: 'layout',
          initial: { move: '@root', markup: DEMO_LAYOUT_MARKUP },
          actions: {},
        }, {
          id: 'root',
          type: 'tag',
          initial: { tag: 'article', move: { parentId: 'demo-outlet' }, className: 'is-idle', style: { opacity: 0, backgroundColor: '#f8fafc' } },
          actions: {
            'demo:show': {
              className: { add: 'is-active', remove: 'is-idle' },
              style: {
                opacity: { from: 0, to: 1, duration: 1000, ease: 'linear' },
                backgroundColor: { from: '#f8fafc', to: '#67e8f9', duration: 1000, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'accent',
          type: 'tag',
          initial: { tag: 'article', move: '@root', className: 'is-idle', style: { backgroundColor: '#fb7185' } },
          actions: {
            'demo:show': {
              className: { add: 'is-active', remove: 'is-idle' },
              style: { backgroundColor: { from: '#fb7185', to: '#a78bfa', duration: 1000, ease: 'linear' } },
            },
            'demo:accent': {
              style: { backgroundColor: { from: '#a78bfa', to: '#facc15', duration: 500, ease: 'linear' } },
            },
            'demo:move-outlet': { move: { parentId: 'demo-outlet', mode: 'first' } },
            'demo:move-off': { move: '@off' },
          },
        }],
        eventimes: [
          { name: 'demo:show', startAt: 500 },
          { name: 'demo:move-outlet', startAt: 1500 },
          { name: 'demo:move-off', startAt: 1800 },
        ],
      },
    },
  }
}

const stageRoot = document.querySelector<HTMLElement>('#temporary-root')!
const stageAccent = document.querySelector<HTMLElement>('#temporary-accent')!
const componentHost = document.querySelector<HTMLElement>('#component-host')!
const timeOutput = document.querySelector<HTMLOutputElement>('#time-output')!
const classOutput = document.querySelector<HTMLOutputElement>('#class-output')!
const opacityOutput = document.querySelector<HTMLOutputElement>('#opacity-output')!
const rootColorOutput = document.querySelector<HTMLOutputElement>('#root-color-output')!
const accentColorOutput = document.querySelector<HTMLOutputElement>('#accent-color-output')!
const phaseOutput = document.querySelector<HTMLOutputElement>('#phase-output')!
const flowOutput = document.querySelector<HTMLOutputElement>('#flow-output')!
const placementOutput = document.querySelector<HTMLOutputElement>('#placement-output')!
const deltaOutput = document.querySelector<HTMLOutputElement>('#delta-output')!
const seekInput = document.querySelector<HTMLInputElement>('#seek-input')!
const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!
const errorOutput = document.querySelector<HTMLElement>('#error-output')!

/** Reads one scalar/color state from the temporary snapshot. */
function readItemState(snapshot: CompiledRecord | undefined): { className: string; opacity: number; backgroundColor: string } {
  const rawStyle = snapshot?.style
  const style = typeof rawStyle === 'object' && rawStyle !== null && !Array.isArray(rawStyle)
    ? rawStyle as Record<string, unknown>
    : null
  const opacity = style !== null && typeof style.opacity === 'number'
    ? style.opacity
    : 1
  return {
    className: typeof snapshot?.className === 'string' ? snapshot.className : '',
    opacity,
    backgroundColor: colorToCss(style?.backgroundColor),
  }
}

/** Converts a normalized sRGB color into a DOM-compatible CSS color. */
function colorToCss(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'transparent'
  const candidate = value as { kind?: unknown; space?: unknown; coords?: unknown; alpha?: unknown }
  if (candidate.kind !== 'color' || candidate.space !== 'srgb' || !Array.isArray(candidate.coords)) return 'transparent'
  if (candidate.coords.length < 3 || !candidate.coords.every((coordinate) => typeof coordinate === 'number')) return 'transparent'
  if (typeof candidate.alpha !== 'number') return 'transparent'
  const [red, green, blue] = candidate.coords as number[]
  const alpha = candidate.alpha === 1 ? '1' : candidate.alpha.toFixed(3)
  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`
}

/** Applies one temporary logical item state to its isolated DOM frame. */
function presentItem(element: HTMLElement, state: ReturnType<typeof readItemState>): void {
  element.className = `temporary-item ${state.className}`
  element.style.opacity = String(state.opacity)
  element.style.backgroundColor = state.backgroundColor
}

type ComponentProjection = Readonly<{
  moduleCatalog: RuntimeModuleServiceCatalog
  componentRuntime: RuntimeComponentRuntime
  backend: LayoutDomBackend
  mountTargets: readonly MountTargetDeclaration[]
  persoNodes: ReadonlyMap<string, HTMLElement>
}>

/** Creates the runtime component catalog and its player projection boundary. */
function createComponentProjection(): ComponentProjection {
  const layoutDefinition = createLayoutModuleServiceDefinition()
  const moduleCatalog = new RuntimeModuleServiceCatalog()
  let layoutService: LayoutModuleServiceInstance | undefined
  moduleCatalog.register({
    id: 'layout',
    create: (context) => {
      layoutService = layoutDefinition.create(context) as LayoutModuleServiceInstance
      return layoutService
    },
  })

  const componentCatalog = new RuntimeComponentCatalog()
  componentCatalog.register({
    type: 'layout',
    create: (input) => new LayoutComponent(input as ComponentInput<LayoutInitial>) as unknown as BaseComponent<Record<string, unknown>>,
  })
  componentCatalog.register({
    type: 'tag',
    create: (input) => new TagComponent(input as ComponentInput<TagState>) as unknown as BaseComponent<Record<string, unknown>>,
  })

  const persoNodes = new Map<string, HTMLElement>()
  const targetNodes = new Map<string, unknown>([['temporary-root-host', componentHost]])
  const componentRuntime = new RuntimeComponentRuntime({
    catalog: componentCatalog,
    createServices: createDemoComponentServices,
    materialize: (component, identity) => {
      const materialization = materializeTemplateString(component.render())
      const rootNode = materialization.rootNode as HTMLElement
      persoNodes.set(identity.componentId, rootNode)
      if (identity.componentType === 'layout') {
        if (layoutService === undefined) throw new Error('Layout module was not created before component materialization.')
        const cleanup = materializeComponentWithLayout(layoutService, {
          component,
          identity,
          rootNode,
          parts: materialization.parts,
          publicParts: materialization.parts,
        })
        for (const part of materialization.parts) targetNodes.set(part.partId, part.nodeRef)
        return {
          destroy: () => {
            cleanup()
            persoNodes.delete(identity.componentId)
            for (const part of materialization.parts) targetNodes.delete(part.partId)
          },
        }
      }
      return {
        destroy: () => {
          persoNodes.delete(identity.componentId)
        },
      }
    },
  })
  const backend = new LayoutDomBackend({
    persoNodes,
    targetNodes,
  })

  return {
    moduleCatalog,
    componentRuntime,
    backend,
    mountTargets: [{ id: 'demo-outlet', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' }],
    persoNodes,
  }
}

/** Creates the small DOM service facade used by the validation demo components. */
function createDemoComponentServices(): ComponentServices {
  return {
    declare: () => undefined,
    apply: (node, patch) => {
      if (!(node instanceof HTMLElement)) return
      if (typeof patch.className === 'string') node.className = patch.className
      const style = patch.style
      if (typeof style === 'object' && style !== null && !Array.isArray(style)) {
        const values = style as Record<string, unknown>
        if (typeof values.opacity === 'number') node.style.opacity = String(values.opacity)
        if (values.backgroundColor !== undefined) node.style.backgroundColor = colorToCss(values.backgroundColor)
      }
    },
    content: {
      apply: (node, value) => {
        if (node instanceof HTMLElement) node.textContent = String(value)
      },
    },
  }
}

/** Presents the last temporary snapshot as a deliberately local DOM view. */
function present(
  sink: MemoryRenderSink,
  solved: SolvedScene,
  previous?: SolvedScene,
  projection?: ComponentProjection,
): void {
  const snapshot = sink.getSnapshots().at(-1)
  sink.clear()
  if (snapshot === undefined) return
  const rootState = readItemState(snapshot.persos['main:root'])
  const accentState = readItemState(snapshot.persos['main:accent'])
  presentItem(stageRoot, rootState)
  presentItem(stageAccent, accentState)
  const componentRoot = projection?.persoNodes.get('main:root')
  const componentAccent = projection?.persoNodes.get('main:accent')
  if (componentRoot !== undefined) presentItem(componentRoot, rootState)
  if (componentAccent !== undefined) presentItem(componentAccent, accentState)
  timeOutput.value = String(Math.round(snapshot.timeMs))
  classOutput.value = rootState.className
  opacityOutput.value = rootState.opacity.toFixed(2)
  rootColorOutput.value = rootState.backgroundColor
  accentColorOutput.value = accentState.backgroundColor
  const accentPlacement = solved.persos['main:accent']?.placement
  placementOutput.value = accentPlacement?.target?.id ?? accentPlacement?.kind ?? 'unknown'
  const delta = previous === undefined
    ? undefined
    : diffSolvedScenes(previous, solved).find((item) => item.persoKey === 'main:accent')
  deltaOutput.value = delta === undefined
    ? 'none'
    : `${delta.operation}: ${delta.fromTargetId ?? 'off'} -> ${delta.toTargetId ?? 'off'}`
  phaseOutput.value = snapshot.timeMs < 500
    ? 'before demo:show'
    : snapshot.timeMs < 1000
      ? 'demo:show / listen / strap'
      : snapshot.timeMs < 1500
        ? 'planned demo:accent / color tween'
        : snapshot.timeMs < 1800
          ? 'move accent -> demo-outlet'
          : 'move accent -> @off'
}

/** Boots the temporary visual flow and its externally advanced engine clock. */
async function start(): Promise<void> {
  const build = new SceneBuilder(createCatalog().snapshot(), { createdAt: new Date().toISOString() }).build(createScene())
  if (!build.ok) {
    errorOutput.hidden = false
    errorOutput.textContent = build.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  const projection = createComponentProjection()
  const compiledScene: CompiledScene = {
    ...build.compiledScene,
    requirements: { ...build.compiledScene.requirements, modules: ['layout'] },
  }
  const engine = new RuntimeEngine(
    { components: ['tag', 'layout'], services: [], modules: ['layout'], resources: [] },
    { moduleServiceCatalog: projection.moduleCatalog },
  )
  const sink = new MemoryRenderSink()
  const strapCollections: StrapCollections = {
    scene: {},
    stories: {
      main: {
        'demo-color': ({ context }) => context.planned.wait(500, { event: { name: 'demo:accent' } }),
      },
    },
  }
  const journal = new RuntimeTrackJournal(compiledScene)
  const showEvent = {
    eventId: 'demo:show',
    eventSeq: 0,
    name: 'demo:show',
    applyAtMs: 500,
    trackId: 'main',
    storyId: 'main',
  }
  const story = compiledScene.scene.stories.main
  const pipeline = await executeListenPipeline({
    rules: story?.listen ?? [],
    event: showEvent,
    functions: build.functions,
    straps: strapCollections.stories.main ?? {},
    state: {},
    meta: { storyId: 'main' },
    context: {},
  })
  const strapExecution = pipeline.straps[0]?.result
  if (strapExecution === undefined) {
    errorOutput.hidden = false
    errorOutput.textContent = pipeline.issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n')
    return
  }
  const append = journal.appendStrapOutput({
    scope: STRAP_SCOPE_STORY,
    storyId: 'main',
    strapName: 'demo-color',
    anchorMs: showEvent.applyAtMs,
    output: strapExecution,
  })
  if (!append.ok) {
    errorOutput.hidden = false
    errorOutput.textContent = `${append.code}: ${append.message}`
    return
  }
  flowOutput.value = 'LayoutComponent.render -> data-part -> layout -> solve -> DOM projection'

  const mountTargets: readonly MountTargetDeclaration[] = [
    { id: 'temporary-root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
  ]
  const solveTargets = [...mountTargets, ...projection.mountTargets]
  const player = new RuntimePlayer(
    'temporary-player',
    engine,
    compiledScene,
    sink,
    undefined,
    strapCollections,
    journal,
    mountTargets,
    projection.backend,
    projection.componentRuntime,
  )
  const init = player.init()
  if (!init.ok) {
    errorOutput.hidden = false
    errorOutput.textContent = init.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  engine.start()
  let playing = false
  playToggle.textContent = 'Play'
  let solved = solveScene(resolveScene(materializeScene(compiledScene, 0, journal)), { mountTargets: solveTargets })
  present(sink, solved, undefined, projection)

  seekInput.addEventListener('input', () => {
    playing = false
    if (player.getLifecycleState() === 'playing') player.pause()
    const previous = solved
    const targetTime = Number(seekInput.value)
    const result = player.seek(targetTime)
    if (!result.ok) {
      errorOutput.hidden = false
      errorOutput.textContent = result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    }
    solved = solveScene(resolveScene(materializeScene(compiledScene, targetTime, journal)), { mountTargets: solveTargets })
    playToggle.textContent = 'Play'
    present(sink, solved, previous, projection)
  })

  playToggle.addEventListener('click', () => {
    playing = !playing
    if (playing) player.play()
    else player.pause()
    playToggle.textContent = playing ? 'Pause' : 'Play'
  })

  const tick = (): void => {
    if (playing) {
      const current = player.getCurrentTimeMs()
      seekInput.value = String(Math.min(2000, current))
      const previous = solved
      solved = solveScene(resolveScene(materializeScene(compiledScene, current, journal)), { mountTargets: solveTargets })
      present(sink, solved, previous, projection)
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

void start()
