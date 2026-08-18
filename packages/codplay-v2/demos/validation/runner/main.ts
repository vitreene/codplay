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
import { HtmlPlayerRunner, createDomComponentServiceCatalog } from '../../../src/runtime/runner'
import { SceneBuilder } from '../../../src/scene/compiled'
import { ValidationCatalog } from '../../../src/scene/validation'
import type { SceneDoc } from '../../../src/scene/types'

import './style.css'

const TIMELINE_END_MS = 3000
const MOVE_START_MS = 800
const MOVE_DURATION_MS = 1400

/** Returns one declarative scene with a list reorder and measured layout ancestors. */
function createScene(): SceneDoc {
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

/** Compiles the list FLIP scene through the normative SceneDoc boundary. */
function buildScene(): ReturnType<SceneBuilder['build']> {
  return new SceneBuilder(createValidationCatalog().snapshot(), {
    createdAt: '2026-08-18T00:00:00.000Z',
  }).build(createScene())
}

/** Creates the runtime catalog shared by the list FLIP host. */
function createComponentCatalog(): RuntimeComponentCatalog {
  const catalog = new RuntimeComponentCatalog()
  const definitions: readonly RuntimeComponentDefinition[] = [{
    type: 'layout',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
    create: (input) => new LayoutComponent(input as ComponentInput<LayoutInitial>) as unknown as BaseComponent<Record<string, unknown>>,
    mountableParts: ['source-outlet', 'target-outlet'],
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

/** Mounts the list FLIP browser vertical and its transport controls. */
function start(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="flip-shell">
      <header class="flip-header">
      <p class="flip-eyebrow">CodPlay V2 / list + runner + FLIP</p>
      <h1>One reorder, three captured items</h1>
      <p>Item A enters the target list at ${MOVE_START_MS}ms with mode <code>first</code>. The list owns the order and touched set, so the local FLIP capture includes A, B and C.</p>
      </header>
      <section class="flip-scene" id="flip-root" aria-label="list FLIP scene"></section>
      <section class="flip-panel" aria-label="list FLIP controls">
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
        <p class="flip-note">At ${MOVE_START_MS}ms the list changes from [B, C] to [A, B, C]. A cold seek has no cached capture yet: it reconstructs the move's before/after scenes, measures them temporarily, restores the current scene, then reuses the numeric capture.</p>
      </section>
      <pre id="error" class="flip-error" hidden></pre>
    </main>
  `

  const root = document.querySelector<HTMLElement>('#flip-root')!
  const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!
  const reset = document.querySelector<HTMLButtonElement>('#reset')!
  const seek = document.querySelector<HTMLInputElement>('#seek')!
  const time = document.querySelector<HTMLOutputElement>('#time')!
  const status = document.querySelector<HTMLElement>('#status')!
  const error = document.querySelector<HTMLElement>('#error')!
  const checkpoints = [...document.querySelectorAll<HTMLButtonElement>('[data-time]')]
  const build = buildScene()
  if (!build.ok) {
    error.hidden = false
    error.textContent = build.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  const runner = new HtmlPlayerRunner({
    id: 'html-runner-list-flip',
    compiledScene: build.compiledScene,
    root,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    componentCatalog: createComponentCatalog(),
    serviceCatalog: createDomComponentServiceCatalog(),
  })
  const init = runner.init()
  if (!init.ok) {
    error.hidden = false
    error.textContent = init.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  let playing = false

  /** Presents the current list order and local FLIP state in the controls. */
  function present(): void {
    const currentTime = runner.getCurrentTimeMs()
    const item = runner.getPersoNode('main:item-a')
    const element = item instanceof HTMLElement ? item : undefined
    const list = runner.getPersoNode('main:target-list')
    seek.value = String(Math.min(TIMELINE_END_MS, currentTime))
    time.value = `${Math.round(currentTime)} ms`
    const transform = element === undefined ? 'none' : getComputedStyle(element).transform
    status.textContent = `${runner.getLifecycleState()} / list: ${readListOrder(list)} / parent: ${element?.parentElement?.className ?? 'none'} / transform: ${transform} / touched: A+B+C / epoch: ${runner.getProjectionEpoch()}`
    if (playing && currentTime >= TIMELINE_END_MS) {
      runner.pause()
      playing = false
      playToggle.textContent = 'Play'
    }
    requestAnimationFrame(present)
  }

  /** Starts or pauses list FLIP playback. */
  function togglePlay(): void {
    if (playing) {
      runner.pause()
      playing = false
      playToggle.textContent = 'Play'
      return
    }
    if (runner.getCurrentTimeMs() >= TIMELINE_END_MS) runner.seek(0)
    runner.play()
    playing = true
    playToggle.textContent = 'Pause'
  }

  playToggle.addEventListener('click', togglePlay)
  reset.addEventListener('click', () => {
    if (playing) runner.pause()
    playing = false
    runner.seek(0)
    playToggle.textContent = 'Play'
  })
  seek.addEventListener('input', () => {
    if (playing) runner.pause()
    playing = false
    const result = runner.seek(Number(seek.value))
    if (!result.ok) {
      error.hidden = false
      error.textContent = result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    }
    playToggle.textContent = 'Play'
  })
  for (const checkpoint of checkpoints) {
    checkpoint.addEventListener('click', () => {
      if (playing) runner.pause()
      playing = false
      const targetTime = Number(checkpoint.dataset.time)
      seek.value = String(targetTime)
      const result = runner.seek(targetTime)
      if (!result.ok) {
        error.hidden = false
        error.textContent = result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
      } else {
        error.hidden = true
      }
      playToggle.textContent = 'Play'
    })
  }
  window.addEventListener('resize', () => runner.resize())
  window.addEventListener('beforeunload', () => runner.destroy(), { once: true })
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
