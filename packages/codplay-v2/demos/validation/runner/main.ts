import {
  BaseComponent,
  LayoutComponent,
  RuntimeComponentCatalog,
  TagComponent,
} from '../../../src/runtime/components'
import type {
  ComponentInput,
  LayoutInitial,
  RuntimeComponentDefinition,
  TagState,
} from '../../../src/runtime/components'
import {
  HtmlPlayerRunner,
  createDomComponentServiceCatalog,
  type HtmlPlayerRunnerOptions,
} from '../../../src/runtime/runner'
import { SceneBuilder } from '../../../src/scene/compiled'
import { ValidationCatalog } from '../../../src/scene/validation'
import type { SceneDoc } from '../../../src/scene/types'

import './style.css'

const TIMELINE_END_MS = 3000
const MOVE_START_MS = 800
const MOVE_DURATION_MS = 1400
type ScenarioId = 'list' | 'nested-overlay'

type DemoScenario = Readonly<{
  id: ScenarioId
  label: string
  runnerId: string
  title: string
  description: string
  note: string
  touched: string
  modes: string
  scene: SceneDoc
  resolveFlipAncestorRegime?: HtmlPlayerRunnerOptions['resolveFlipAncestorRegime']
  listPersoId: string
  inspectedPersoIds: readonly string[]
}>

/** Returns one declarative scene with a list reorder and measured layout ancestors. */
function createListScene(): SceneDoc {
  return {
    id: 'html-runner-list-flip',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'source-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--source"><span class="flip-box__tag">PARENT A</span><h2>FIRST / SOURCE</h2><div class="flip-box__outlet flip-box__outlet--source" data-part="source-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'target-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--target"><span class="flip-box__tag">PARENT B</span><h2>LAST / TARGET</h2><div class="flip-box__outlet" data-part="target-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'target-list',
          type: 'list',
          initial: {
            tag: 'section',
            move: { target: 'target-outlet' },
            className: 'flip-list',
          },
          actions: {},
        }, {
          id: 'item-a',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'source-outlet' },
            className: 'flip-item flip-item--a',
            content: 'A / mover',
          },
          actions: {
            transfer: {
              move: {
                target: 'target-list',
                mode: 'first',
                flipMode: 'local',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'item-b',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'target-list' },
            className: 'flip-item flip-item--b',
            content: 'B / sibling',
          },
          actions: {},
        }, {
          id: 'item-c',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'target-list' },
            className: 'flip-item flip-item--c',
            content: 'C / sibling',
          },
          actions: {},
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: MOVE_START_MS }],
      },
    },
  }
}

/** Returns one declarative scene with a parent and child world overlay. */
function createNestedOverlayScene(): SceneDoc {
  return {
    id: 'html-runner-nested-overlay-flip',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'overlay-source-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--source overlay-stage"><span class="flip-box__tag">OVERLAY SOURCE</span><h2>PARENT / FIRST</h2><div class="flip-box__outlet overlay-stage__outlet" data-part="source-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'overlay-target-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="flip-box flip-box--target overlay-stage"><span class="flip-box__tag">LAYOUT CUT</span><h2>HOST / LAST</h2><div class="flip-box__outlet" data-part="target-outlet"></div></section>',
          },
          actions: {},
        }, {
          id: 'overlay-target-list',
          type: 'list',
          initial: {
            tag: 'section',
            move: { target: 'target-outlet' },
            className: 'flip-list flip-list--overlay',
          },
          actions: {},
        }, {
          id: 'overlay-parent',
          type: 'layout',
          initial: {
            move: { target: 'source-outlet' },
            markup: '<article class="nested-overlay-parent"><span class="nested-overlay-parent__label">P / parent ghost</span><div class="nested-overlay-parent__outlet" data-part="parent-outlet-a"></div><div class="nested-overlay-parent__outlet nested-overlay-parent__outlet--last" data-part="parent-outlet-b"></div></article>',
          },
          actions: {
            transfer: {
              move: {
                target: 'overlay-target-list',
                mode: 'first',
                flipMode: 'overlay-world',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'overlay-child',
          type: 'tag',
          initial: {
            tag: 'div',
            move: { target: 'parent-outlet-a' },
            className: 'nested-overlay-child',
            content: 'Q / child ghost',
          },
          actions: {
            transfer: {
              move: {
                target: 'parent-outlet-b',
                flipMode: 'overlay-world',
                transition: { duration: MOVE_DURATION_MS, ease: 'linear' },
              },
            },
          },
        }, {
          id: 'overlay-b',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'overlay-target-list' },
            className: 'flip-item flip-item--b',
            content: 'B / local sibling',
          },
          actions: {},
        }, {
          id: 'overlay-c',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'overlay-target-list' },
            className: 'flip-item flip-item--c',
            content: 'C / local sibling',
          },
          actions: {},
        }],
        listen: [],
        eventimes: [{ name: 'transfer', startAt: MOVE_START_MS }],
      },
    },
  }
}

/** Creates the author validation catalog for the list FLIP scene. */
function createValidationCatalog(): ValidationCatalog {
  const catalog = new ValidationCatalog()
  catalog.registerComponent({
    type: 'layout',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
    validateInitial: () => undefined,
    validateAction: () => undefined,
  })
  catalog.registerComponent({
    type: 'tag',
    services: ['className', 'style', 'attr', 'content'],
    modules: [],
    validateInitial: () => undefined,
    validateAction: () => undefined,
  })
  catalog.registerComponent({
    type: 'list',
    services: ['className', 'style', 'attr'],
    modules: ['list'],
    validateInitial: () => undefined,
    validateAction: () => undefined,
  })
  return catalog
}

/** Compiles one demo scene through the normative SceneDoc boundary. */
function buildScene(scene: SceneDoc): ReturnType<SceneBuilder['build']> {
  return new SceneBuilder(createValidationCatalog().snapshot(), {
    createdAt: '2026-08-18T00:00:00.000Z',
  }).build(scene)
}

/** Creates the runtime catalog shared by the list FLIP host. */
function createComponentCatalog(): RuntimeComponentCatalog {
  const catalog = new RuntimeComponentCatalog()
  const definitions: readonly RuntimeComponentDefinition[] = [{
    type: 'layout',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
    create: (input) => new LayoutComponent(input as ComponentInput<LayoutInitial>) as unknown as BaseComponent<Record<string, unknown>>,
    mountableParts: ['source-outlet', 'target-outlet', 'parent-outlet-a', 'parent-outlet-b'],
  }, {
    type: 'tag',
    services: ['className', 'style', 'attr', 'content'],
    modules: [],
    create: (input) => new TagComponent(input as ComponentInput<TagState>) as unknown as BaseComponent<Record<string, unknown>>,
  }, {
    type: 'list',
    services: ['className', 'style', 'attr'],
    modules: ['list'],
    create: (input) => new TagComponent(input as ComponentInput<TagState>) as unknown as BaseComponent<Record<string, unknown>>,
  }]
  for (const definition of definitions) catalog.register(definition)
  return catalog
}

/** Declares the host-owned historical layout cut for the overlay scenario. */
const resolveNestedOverlayAncestorRegime: NonNullable<HtmlPlayerRunnerOptions['resolveFlipAncestorRegime']> = ({ ancestorId }) => (
  ancestorId === 'main:overlay-target-layout' ? 'layout' : 'stable'
)

/** Describes the browser scenarios exposed by this validation vertical. */
const demoScenarios: Readonly<Record<ScenarioId, DemoScenario>> = {
  list: {
    id: 'list',
    label: 'List / local FLIP',
    runnerId: 'html-runner-list-flip',
    title: 'One reorder, three captured items',
    description: `Item A enters the target list at ${MOVE_START_MS}ms with mode <code>first</code>. The list owns the order and touched set, so the local FLIP capture includes A, B and C.`,
    note: `At ${MOVE_START_MS}ms the list changes from [B, C] to [A, B, C]. A cold seek reconstructs the move's before/after scenes, measures them temporarily, restores the current scene, then reuses the numeric capture.`,
    touched: 'A+B+C',
    modes: 'local',
    scene: createListScene(),
    listPersoId: 'main:target-list',
    inspectedPersoIds: ['main:item-a'],
  },
  'nested-overlay': {
    id: 'nested-overlay',
    label: 'Nested overlays / layout cut',
    runnerId: 'html-runner-nested-overlay-flip',
    title: 'Parent and child ghosts share one capture',
    description: `At ${MOVE_START_MS}ms P moves into the target list and Q changes outlet inside P. Both use <code>overlay-world</code>; B and C remain local siblings below the declared <code>layout</code> cut.`,
    note: `At the middle checkpoint the parent ghost contains a hidden Q clone while Q owns its independent ghost. At LAST the source nodes are visible again and the overlay layer is empty.`,
    touched: 'P+Q+B+C',
    modes: 'P/Q overlay-world · B/C local',
    scene: createNestedOverlayScene(),
    resolveFlipAncestorRegime: resolveNestedOverlayAncestorRegime,
    listPersoId: 'main:overlay-target-list',
    inspectedPersoIds: ['main:overlay-parent', 'main:overlay-child'],
  },
}

/** Mounts the browser vertical and its transport controls. */
function start(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="flip-shell">
      <header class="flip-header">
      <p class="flip-eyebrow">CodPlay V2 / declarative runner + FLIP</p>
      <label class="flip-scenario" for="scenario-select">
        <span>Validation scenario</span>
        <select id="scenario-select">
          <option value="list">${demoScenarios.list.label}</option>
          <option value="nested-overlay">${demoScenarios['nested-overlay'].label}</option>
        </select>
      </label>
      <h1 id="scenario-title">One reorder, three captured items</h1>
      <p id="scenario-description"></p>
      </header>
      <section class="flip-scene" id="flip-root" aria-label="FLIP validation scene"></section>
      <section class="flip-panel" aria-label="FLIP validation controls">
        <div class="flip-controls">
          <button id="play-toggle" type="button">Play</button>
          <button id="reset" type="button">Reset</button>
          <label for="seek">Seek</label>
          <input id="seek" type="range" min="0" max="${TIMELINE_END_MS}" value="0" step="1" />
          <output id="time">0 ms</output>
        </div>
        <div class="flip-checkpoints" aria-label="timeline checkpoints">
          <button type="button" data-time="0">FIRST</button>
          <button type="button" data-time="${MOVE_START_MS + Math.round(MOVE_DURATION_MS / 2)}">REORDER</button>
          <button type="button" data-time="${MOVE_START_MS + MOVE_DURATION_MS}">LAST</button>
        </div>
        <p id="status" class="flip-status">ready</p>
        <p id="scenario-note" class="flip-note"></p>
      </section>
      <pre id="error" class="flip-error" hidden></pre>
    </main>
  `

  const root = document.querySelector<HTMLElement>('#flip-root')!
  const scenarioSelect = document.querySelector<HTMLSelectElement>('#scenario-select')!
  const scenarioTitle = document.querySelector<HTMLElement>('#scenario-title')!
  const scenarioDescription = document.querySelector<HTMLElement>('#scenario-description')!
  const scenarioNote = document.querySelector<HTMLElement>('#scenario-note')!
  const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!
  const reset = document.querySelector<HTMLButtonElement>('#reset')!
  const seek = document.querySelector<HTMLInputElement>('#seek')!
  const time = document.querySelector<HTMLOutputElement>('#time')!
  const status = document.querySelector<HTMLElement>('#status')!
  const error = document.querySelector<HTMLElement>('#error')!
  const checkpoints = [...document.querySelectorAll<HTMLButtonElement>('[data-time]')]
  let currentScenario = demoScenarios.list
  let runner: HtmlPlayerRunner | undefined
  let playing = false

  /** Displays a runner diagnostic error in the validation panel. */
  function showError(diagnostics: readonly { code: string; message: string }[]): void {
    error.hidden = diagnostics.length === 0
    error.textContent = diagnostics.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
  }

  /** Mounts one declarative scenario and resets its transport state. */
  function mountScenario(scenarioId: ScenarioId): void {
    if (playing) runner?.pause()
    playing = false
    playToggle.textContent = 'Play'
    runner?.destroy()
    runner = undefined
    root.replaceChildren()

    currentScenario = demoScenarios[scenarioId]
    scenarioSelect.value = currentScenario.id
    scenarioTitle.textContent = currentScenario.title
    scenarioDescription.innerHTML = currentScenario.description
    scenarioNote.textContent = currentScenario.note
    seek.value = '0'
    time.value = '0 ms'
    status.textContent = 'loading'
    showError([])

    const build = buildScene(currentScenario.scene)
    if (!build.ok) {
      status.textContent = 'build failed'
      showError(build.diagnostics.errors)
      return
    }

    runner = new HtmlPlayerRunner({
      id: currentScenario.runnerId,
      compiledScene: build.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      componentCatalog: createComponentCatalog(),
      serviceCatalog: createDomComponentServiceCatalog(),
      ...(currentScenario.resolveFlipAncestorRegime === undefined
        ? {}
        : { resolveFlipAncestorRegime: currentScenario.resolveFlipAncestorRegime }),
    })
    const init = runner.init()
    if (!init.ok) {
      status.textContent = 'init failed'
      showError(init.diagnostics.errors)
      runner.destroy()
      runner = undefined
      return
    }
  }

  /** Presents the current scene order and FLIP state in the controls. */
  function present(): void {
    const activeRunner = runner
    if (activeRunner !== undefined) {
      const currentTime = activeRunner.getCurrentTimeMs()
      const list = activeRunner.getPersoNode(currentScenario.listPersoId)
      const inspectedNodes = currentScenario.inspectedPersoIds.map((persoId) => activeRunner.getPersoNode(persoId))
      const overlay = readOverlayDiagnostics(root)
      seek.value = String(Math.min(TIMELINE_END_MS, currentTime))
      time.value = `${Math.round(currentTime)} ms`
      status.textContent = `${activeRunner.getLifecycleState()} / list: ${readListOrder(list)} / inspected: ${readScenarioNodes(inspectedNodes)} / modes: ${currentScenario.modes} / touched: ${currentScenario.touched} / overlay: ${overlay.ghosts} ghosts, ${overlay.hidden} hidden clones / epoch: ${activeRunner.getProjectionEpoch()}`
      if (playing && currentTime >= TIMELINE_END_MS) {
        activeRunner.pause()
        playing = false
        playToggle.textContent = 'Play'
      }
    }
    requestAnimationFrame(present)
  }

  /** Starts or pauses the active scenario playback. */
  function togglePlay(): void {
    const activeRunner = runner
    if (activeRunner === undefined) return
    if (playing) {
      activeRunner.pause()
      playing = false
      playToggle.textContent = 'Play'
      return
    }
    if (activeRunner.getCurrentTimeMs() >= TIMELINE_END_MS) activeRunner.seek(0)
    activeRunner.play()
    playing = true
    playToggle.textContent = 'Pause'
  }

  scenarioSelect.addEventListener('change', () => {
    mountScenario(scenarioSelect.value as ScenarioId)
  })
  playToggle.addEventListener('click', togglePlay)
  reset.addEventListener('click', () => {
    const activeRunner = runner
    if (activeRunner === undefined) return
    if (playing) activeRunner.pause()
    playing = false
    activeRunner.seek(0)
    playToggle.textContent = 'Play'
  })
  seek.addEventListener('input', () => {
    const activeRunner = runner
    if (activeRunner === undefined) return
    if (playing) activeRunner.pause()
    playing = false
    const result = activeRunner.seek(Number(seek.value))
    if (!result.ok) {
      showError(result.diagnostics.errors)
    } else {
      showError([])
    }
    playToggle.textContent = 'Play'
  })
  for (const checkpoint of checkpoints) {
    checkpoint.addEventListener('click', () => {
      const activeRunner = runner
      if (activeRunner === undefined) return
      if (playing) activeRunner.pause()
      playing = false
      const targetTime = Number(checkpoint.dataset.time)
      seek.value = String(targetTime)
      const result = activeRunner.seek(targetTime)
      if (!result.ok) {
        showError(result.diagnostics.errors)
      } else {
        showError([])
      }
      playToggle.textContent = 'Play'
    })
  }
  window.addEventListener('resize', () => runner?.resize())
  window.addEventListener('beforeunload', () => runner?.destroy(), { once: true })
  mountScenario('list')
  requestAnimationFrame(present)
}

start()

/** Reads the currently projected item order from the list root for diagnostics. */
function readListOrder(node: unknown): string {
  if (!(node instanceof HTMLElement)) return 'none'
  return [...node.children]
    .map((child) => child instanceof HTMLElement ? child.dataset.itemId ?? child.textContent?.trim() ?? '?' : child.textContent?.trim() ?? '?')
    .join(' -> ')
}

/** Reads the temporary overlay layer and its hidden clone markers. */
function readOverlayDiagnostics(root: HTMLElement): { ghosts: number; hidden: number } {
  const layer = root.querySelector<HTMLElement>('[data-selection-frame-overlay]')
  if (layer === null) return { ghosts: 0, hidden: 0 }
  return {
    ghosts: layer.children.length,
    hidden: layer.querySelectorAll('[data-codplay-flip-hidden]').length,
  }
}

/** Formats the inspected persona nodes for the browser-facing diagnostic line. */
function readScenarioNodes(nodes: readonly unknown[]): string {
  return nodes.map((node) => {
    if (!(node instanceof HTMLElement)) return 'none'
    const hidden = node.hasAttribute('data-codplay-flip-hidden') ? ':hidden' : ''
    return `${node.dataset.itemId ?? '?'}@${node.parentElement?.className ?? 'none'}${hidden}:${getComputedStyle(node).transform}`
  }).join(' | ')
}
