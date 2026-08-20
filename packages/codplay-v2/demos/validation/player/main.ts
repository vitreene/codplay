import { SceneBuilder } from '../../../src/scene/compiled'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner'
import type { StrapCollections } from '../../../src/runtime/player'
import type { CompiledRecord } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

import './style.css'

/** Creates the CodPlay runtime catalog and configures this demo's declared outlet. */
function createRuntimeCatalog(): RuntimeCapabilityCatalog {
  const catalog = createCoreRuntimeCatalog()
  const layout = catalog.getComponent('layout')
  if (layout === undefined) throw new Error('Core layout component is not registered.')
  catalog.overrideComponent({ ...layout, mountableParts: ['demo-outlet'] })
  return catalog
}

const DEMO_LAYOUT_MARKUP = `
  <section class="component-layout">
    <header class="component-layout__header">LayoutComponent / data-part</header>
    <main class="component-layout__content" data-part="demo-outlet"></main>
  </section>
`

/** Creates the small compiled flow presented by the HTML materializer. */
function createScene(): SceneDoc {
  return {
    id: 'validation-player-demo',
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

/** Reads one scalar/color state from the solved component state. */
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

type DisplayedValidationState = Readonly<{
  timeMs: number
  rootState: ReturnType<typeof readItemState>
  accentState: ReturnType<typeof readItemState>
  placement?: Readonly<{
    kind: string
    mounted: boolean
    targetId?: string
  }>
}>

/** Reads the current solved state after the HTML materializer has committed it. */
function present(
  runner: HtmlPlayerRunner,
  previous: DisplayedValidationState | undefined,
): DisplayedValidationState | undefined {
  const solved = runner.player.getSolvedScene()
  if (solved === undefined) return previous
  const rootState = readItemState(solved.persos['main:root']?.state)
  const accentState = readItemState(solved.persos['main:accent']?.state)
  const accentPlacement = solved.persos['main:accent']?.placement
  const placement = accentPlacement === undefined
    ? undefined
    : {
      kind: accentPlacement.kind,
      mounted: accentPlacement.mounted,
      ...(accentPlacement.targetId === undefined ? {} : { targetId: accentPlacement.targetId }),
    }
  timeOutput.value = String(Math.round(solved.timeMs))
  classOutput.value = rootState.className
  opacityOutput.value = rootState.opacity.toFixed(2)
  rootColorOutput.value = rootState.backgroundColor
  accentColorOutput.value = accentState.backgroundColor
  placementOutput.value = placement?.targetId ?? placement?.kind ?? 'unknown'
  const previousPlacement = previous?.placement
  const delta = previousPlacement === undefined || placement === undefined
    ? undefined
    : previousPlacement.mounted !== placement.mounted
      ? previousPlacement.mounted ? 'unmount' : 'mount'
      : previousPlacement.targetId !== placement.targetId
        ? 'move'
        : undefined
  deltaOutput.value = delta === undefined
    ? 'none'
    : `${delta}: ${previousPlacement?.targetId ?? 'off'} -> ${accentPlacement?.targetId ?? 'off'}`
  phaseOutput.value = solved.timeMs < 500
    ? 'before demo:show'
    : solved.timeMs < 1000
      ? 'demo:show / listen / strap'
      : solved.timeMs < 1500
        ? 'planned demo:accent / color tween'
        : solved.timeMs < 1800
          ? 'move accent -> demo-outlet'
          : 'move accent -> @off'
  return { timeMs: solved.timeMs, rootState, accentState, placement }
}

/** Boots the validation flow through the HTML player runner. */
function start(): void {
  const catalog = createRuntimeCatalog()
  const build = new SceneBuilder(catalog.validationSnapshot(), { createdAt: new Date().toISOString() }).build(createScene())
  if (!build.ok) {
    errorOutput.hidden = false
    errorOutput.textContent = build.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  const strapCollections: StrapCollections = {
    scene: {},
    stories: {
      main: {
        'demo-color': ({ context }) => context.planned.wait(500, { event: { name: 'demo:accent' } }),
      },
    },
  }
  const runner = new HtmlPlayerRunner({
    id: 'validation-player',
    compiledScene: build.compiledScene,
    root: componentHost,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
    strapCollections,
    functions: build.functions,
  })
  flowOutput.value = 'LayoutComponent.render -> data-part -> HtmlComponentMaterializer -> DOM'

  const init = runner.init()
  if (!init.ok) {
    errorOutput.hidden = false
    errorOutput.textContent = init.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    runner.destroy()
    return
  }

  let playing = false
  playToggle.textContent = 'Play'
  let displayedSnapshot = present(runner, undefined)

  seekInput.addEventListener('input', () => {
    playing = false
    if (runner.getLifecycleState() === 'playing') runner.pause()
    const result = runner.seek(Number(seekInput.value))
    if (!result.ok) {
      errorOutput.hidden = false
      errorOutput.textContent = result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    }
    playToggle.textContent = 'Play'
    displayedSnapshot = present(runner, displayedSnapshot) ?? displayedSnapshot
  })

  playToggle.addEventListener('click', () => {
    playing = !playing
    if (playing) runner.play()
    else runner.pause()
    playToggle.textContent = playing ? 'Pause' : 'Play'
  })

  const tick = (): void => {
    if (playing) {
      const nextSnapshot = present(runner, displayedSnapshot)
      if (nextSnapshot !== undefined) {
        seekInput.value = String(Math.min(2000, nextSnapshot.timeMs))
        displayedSnapshot = nextSnapshot
      }
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

void start()
