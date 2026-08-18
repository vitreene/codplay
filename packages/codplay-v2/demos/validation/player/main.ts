import { SceneBuilder } from '../../../src/scene/compiled'
import { ValidationCatalog } from '../../../src/scene/validation'
import { RuntimeEngine, RuntimeModuleServiceCatalog } from '../../../src/runtime/engine'
import {
  createMarkupModuleServiceDefinition,
  materializeComponentWithMarkup,
  type MarkupModuleServiceInstance,
} from '../../../src/runtime/capabilities/markup'
import {
  BaseComponent,
  LayoutComponent,
  RuntimeComponentCatalog,
  RuntimeComponentRuntime,
  RuntimeComponentServiceCatalog,
  TagComponent,
  materializeTemplateString,
} from '../../../src/runtime/components'
import type {
  ComponentInput,
  LayoutInitial,
  RuntimeComponentDefinition,
  TagState,
} from '../../../src/runtime/components'
import {
  executeListenPipeline,
  LayoutDomBackend,
  MemoryRenderSink,
  MOUNT_TARGET_KIND_ROOT,
  RuntimePlayer,
  RuntimeTrackJournal,
  STRAP_SCOPE_STORY,
  type MountTargetDeclaration,
  type StrapCollections,
  type TemporaryRenderSnapshot,
} from '../../../src/runtime/player'
import type { CompiledRecord, CompiledScene } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

import './style.css'

/** Creates the component definitions shared by validation and runtime catalogs. */
function createComponentDefinitions(): readonly RuntimeComponentDefinition[] {
  return [{
    type: 'tag',
    services: ['className', 'style', 'attr', 'content'],
    modules: [],
    validateInitial: () => undefined,
    validateAction: () => undefined,
    create: (input) => new TagComponent(input as ComponentInput<TagState>) as unknown as BaseComponent<Record<string, unknown>>,
  }, {
    type: 'layout',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
    validateInitial: () => undefined,
    validateAction: () => undefined,
    create: (input) => new LayoutComponent(input as ComponentInput<LayoutInitial>) as unknown as BaseComponent<Record<string, unknown>>,
    mountableParts: ['demo-outlet'],
  }]
}

/** Creates the temporary validation catalog used by this visual vertical. */
function createCatalog(): ValidationCatalog {
  const catalog = new ValidationCatalog()
  for (const definition of createComponentDefinitions()) catalog.registerComponent(definition)
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
          initial: { tag: 'article', move: { target: 'demo-outlet' }, className: 'is-idle', style: { opacity: 0, backgroundColor: '#f8fafc' } },
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
            'demo:move-outlet': { move: { target: 'demo-outlet', mode: 'first' } },
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
  persoNodes: ReadonlyMap<string, HTMLElement>
}>

/** Creates the runtime component catalog and its player projection boundary. */
function createComponentProjection(): ComponentProjection {
  const markupDefinition = createMarkupModuleServiceDefinition()
  const moduleCatalog = new RuntimeModuleServiceCatalog()
  moduleCatalog.register({
    id: 'markup',
    create: (context) => {
      return markupDefinition.create(context) as MarkupModuleServiceInstance
    },
  })

  const componentCatalog = new RuntimeComponentCatalog()
  const serviceCatalog = createDemoComponentServiceCatalog()
  for (const definition of createComponentDefinitions()) componentCatalog.register(definition)

  const persoNodes = new Map<string, HTMLElement>()
  const targetNodes = new Map<string, unknown>([['temporary-root-host', componentHost]])
  const componentRuntime = new RuntimeComponentRuntime({
    catalog: componentCatalog,
    serviceCatalog,
    materialize: (component, identity, initial, mountablePartIds, moduleServices) => {
      const materialization = identity.componentType === 'layout'
        ? materializeTemplateString(component.render())
        : { rootNode: document.createElement(String(initial.tag)), parts: [] }
      const rootNode = materialization.rootNode as HTMLElement
      persoNodes.set(identity.componentId, rootNode)
      if (identity.componentType === 'layout') {
        const markupService = moduleServices.get('markup') as MarkupModuleServiceInstance | undefined
        if (markupService === undefined) throw new Error('Markup module was not bound before component materialization.')
        const publicParts = materialization.parts.filter((part) => mountablePartIds.includes(part.partId))
        const cleanup = materializeComponentWithMarkup(markupService, {
          component,
          identity,
          rootNode,
          parts: materialization.parts,
          publicParts,
        })
        for (const part of publicParts) targetNodes.set(part.partId, part.nodeRef)
        return {
          destroy: () => {
            cleanup()
            persoNodes.delete(identity.componentId)
            for (const part of publicParts) targetNodes.delete(part.partId)
          },
        }
      }
      component._materialize(rootNode, [])
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
    persoNodes,
  }
}

/** Creates the DOM-backed service catalog used by the validation demo components. */
function createDemoComponentServiceCatalog(): RuntimeComponentServiceCatalog {
  const catalog = new RuntimeComponentServiceCatalog()
  catalog.register({
    id: 'className',
    create: () => ({
      apply: (node, value) => {
        if (node instanceof HTMLElement && typeof value === 'string') node.className = value
      },
    }),
  })
  catalog.register({
    id: 'style',
    create: () => ({
      apply: (node, value) => {
        if (!(node instanceof HTMLElement) || typeof value !== 'object' || value === null || Array.isArray(value)) return
        for (const [name, rawValue] of Object.entries(value)) {
          const cssValue: string = name === 'backgroundColor' ? colorToCss(rawValue) : String(rawValue);
          (node.style as unknown as Record<string, string>)[name] = cssValue
        }
      },
    }),
  })
  catalog.register({
    id: 'attr',
    create: () => ({
      apply: (node, value) => {
        if (!(node instanceof HTMLElement) || typeof value !== 'object' || value === null || Array.isArray(value)) return
        for (const [name, rawValue] of Object.entries(value)) {
          if (rawValue === false || rawValue === undefined || rawValue === null) node.removeAttribute(name)
          else node.setAttribute(name, rawValue === true ? '' : String(rawValue))
        }
      },
    }),
  })
  catalog.register({
    id: 'content',
    create: () => ({
      apply: (node, value) => {
        if (node instanceof HTMLElement) node.textContent = String(value)
      },
    }),
  })
  return catalog
}

/** Presents the last temporary snapshot as a deliberately local DOM view. */
function present(
  sink: MemoryRenderSink,
  previous: TemporaryRenderSnapshot | undefined,
  projection?: ComponentProjection,
): TemporaryRenderSnapshot | undefined {
  const snapshot = sink.getSnapshots().at(-1)
  sink.clear()
  if (snapshot === undefined) return undefined
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
  const accentPlacement = snapshot.placements?.['main:accent']
  placementOutput.value = accentPlacement?.targetId ?? accentPlacement?.kind ?? 'unknown'
  const previousPlacement = previous?.placements?.['main:accent']
  const delta = previousPlacement === undefined || accentPlacement === undefined
    ? undefined
    : previousPlacement.mounted !== accentPlacement.mounted
      ? previousPlacement.mounted ? 'unmount' : 'mount'
      : previousPlacement.targetId !== accentPlacement.targetId
        ? 'move'
        : undefined
  deltaOutput.value = delta === undefined
    ? 'none'
    : `${delta}: ${previousPlacement?.targetId ?? 'off'} -> ${accentPlacement?.targetId ?? 'off'}`
  phaseOutput.value = snapshot.timeMs < 500
    ? 'before demo:show'
    : snapshot.timeMs < 1000
      ? 'demo:show / listen / strap'
      : snapshot.timeMs < 1500
        ? 'planned demo:accent / color tween'
        : snapshot.timeMs < 1800
          ? 'move accent -> demo-outlet'
          : 'move accent -> @off'
  return snapshot
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
    requirements: { ...build.compiledScene.requirements, modules: ['markup'] },
  }
  const engine = new RuntimeEngine(
    { components: ['tag', 'layout'], services: ['className', 'style', 'attr', 'content'], modules: ['markup'], resources: [] },
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
  let displayedSnapshot = present(sink, undefined, projection)

  seekInput.addEventListener('input', () => {
    playing = false
    if (player.getLifecycleState() === 'playing') player.pause()
    const result = player.seek(Number(seekInput.value))
    if (!result.ok) {
      errorOutput.hidden = false
      errorOutput.textContent = result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    }
    playToggle.textContent = 'Play'
    displayedSnapshot = present(sink, displayedSnapshot, projection) ?? displayedSnapshot
  })

  playToggle.addEventListener('click', () => {
    playing = !playing
    if (playing) player.play()
    else player.pause()
    playToggle.textContent = playing ? 'Pause' : 'Play'
  })

  const tick = (): void => {
    if (playing) {
      const nextSnapshot = sink.getSnapshots().at(-1)
      if (nextSnapshot !== undefined) {
        seekInput.value = String(Math.min(2000, nextSnapshot.timeMs))
        displayedSnapshot = present(sink, displayedSnapshot, projection) ?? displayedSnapshot
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

void start()
