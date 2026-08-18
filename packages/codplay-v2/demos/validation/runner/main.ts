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

const TIMELINE_END_MS = 3200
const ANIMATION_START_MS = 500
const ANIMATION_END_MS = 1900
const RETURN_START_MS = 2300
const RETURN_END_MS = 3000

/** Returns the declarative scene shown by the browser validation vertical. */
function createScene(): SceneDoc {
  return {
    id: 'html-runner-browser',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'stage-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="runner-stage"><div class="runner-stage__copy"><h2>Continuous state</h2><p>The character keeps this parent for the whole timeline.</p><div class="runner-stage__outlet" data-part="character-outlet"></div></div></section>',
          },
          actions: {},
        }, {
          id: 'legend-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<aside class="runner-legend"><h2>What is tested</h2><p><strong>backgroundColor</strong>, <strong>opacity</strong>, <strong>x</strong> and <strong>y</strong>.</p><p>No action changes <strong>move</strong>.</p></aside>',
          },
          actions: {},
        }, {
          id: 'character',
          type: 'tag',
          initial: {
            tag: 'article',
            move: { target: 'character-outlet' },
            className: 'runner-character',
            style: {
              x: '0px',
              y: '0px',
              opacity: 0.35,
              backgroundColor: '#f9c74f',
            },
            content: 'Character',
          },
          actions: {
            animate: {
              style: {
                x: { from: '0px', to: '240px', duration: 1400, ease: 'linear' },
                y: { from: '0px', to: '70px', duration: 1400, ease: 'linear' },
                opacity: { from: 0.35, to: 1, duration: 1400, ease: 'linear' },
                backgroundColor: { from: '#f9c74f', to: '#ef476f', duration: 1400, ease: 'linear' },
              },
            },
            return: {
              style: {
                x: { from: '240px', to: '80px', duration: 700, ease: 'linear' },
                y: { from: '70px', to: '0px', duration: 700, ease: 'linear' },
                opacity: { from: 1, to: 0.6, duration: 700, ease: 'linear' },
                backgroundColor: { from: '#ef476f', to: '#4cc9f0', duration: 700, ease: 'linear' },
              },
            },
          },
        }],
        listen: [],
        eventimes: [
          { name: 'animate', startAt: ANIMATION_START_MS },
          { name: 'return', startAt: RETURN_START_MS },
        ],
      },
    },
  }
}

/** Creates the author validation catalog for the declared scene. */
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
  return catalog
}

/** Compiles the browser scene through the normative SceneDoc boundary. */
function buildScene(): ReturnType<SceneBuilder['build']> {
  return new SceneBuilder(createValidationCatalog().snapshot(), {
    createdAt: '2026-08-18T00:00:00.000Z',
  }).build(createScene())
}

/** Creates the runtime component catalog consumed by HtmlPlayerRunner. */
function createComponentCatalog(): RuntimeComponentCatalog {
  const catalog = new RuntimeComponentCatalog()
  const definitions: readonly RuntimeComponentDefinition[] = [{
    type: 'layout',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
    create: (input) => new LayoutComponent(input as ComponentInput<LayoutInitial>) as unknown as BaseComponent<Record<string, unknown>>,
    mountableParts: ['character-outlet'],
  }, {
    type: 'tag',
    services: ['className', 'style', 'attr', 'content'],
    modules: [],
    create: (input) => new TagComponent(input as ComponentInput<TagState>) as unknown as BaseComponent<Record<string, unknown>>,
  }]
  for (const definition of definitions) catalog.register(definition)
  return catalog
}

/** Mounts the browser runner vertical and wires its transport controls. */
function start(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="runner-shell">
      <header class="runner-header">
        <p class="runner-eyebrow">CodPlay V2 / HtmlPlayerRunner</p>
        <h1>Continuous HTML state</h1>
        <p>The character keeps one parent. Its color, opacity and CSS translation are resolved from the declarative timeline.</p>
      </header>
      <section id="runner-root" class="runner-root" aria-label="runner root"></section>
      <section class="runner-panel" aria-label="HTML runner controls">
        <div class="runner-controls">
          <button id="play-toggle" type="button">Play</button>
          <button id="reset" type="button">Reset</button>
          <label for="seek">Seek</label>
          <input id="seek" type="range" min="0" max="${TIMELINE_END_MS}" value="0" step="1" />
          <output id="time">0 ms</output>
        </div>
        <p id="status" class="runner-status">ready</p>
        <p class="runner-checkpoints">Checkpoints: <code>0ms</code> initial, <code>1200ms</code> middle of first tween, <code>${ANIMATION_END_MS}ms</code> first end, <code>${(RETURN_START_MS + RETURN_END_MS) / 2}ms</code> middle of return.</p>
      </section>
      <pre id="error" class="runner-error" hidden></pre>
    </main>
  `

  const root = document.querySelector<HTMLElement>('#runner-root')!
  const playToggle = document.querySelector<HTMLButtonElement>('#play-toggle')!
  const reset = document.querySelector<HTMLButtonElement>('#reset')!
  const seek = document.querySelector<HTMLInputElement>('#seek')!
  const time = document.querySelector<HTMLOutputElement>('#time')!
  const status = document.querySelector<HTMLElement>('#status')!
  const error = document.querySelector<HTMLElement>('#error')!
  const build = buildScene()
  if (!build.ok) {
    error.hidden = false
    error.textContent = build.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
    return
  }

  const runner = new HtmlPlayerRunner({
    id: 'html-runner-browser',
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

  /** Presents the resolved continuous state in the browser controls. */
  function present(): void {
    const currentTime = runner.getCurrentTimeMs()
    const character = runner.getPersoNode('main:character')
    const element = character instanceof HTMLElement ? character : undefined
    seek.value = String(Math.min(TIMELINE_END_MS, currentTime))
    time.value = `${Math.round(currentTime)} ms`
    status.textContent = `${runner.getLifecycleState()} / parent: character-outlet / transform: ${element?.style.transform ?? 'none'} / color: ${element?.style.backgroundColor ?? 'none'} / opacity: ${element?.style.opacity ?? 'none'} / epoch: ${runner.getProjectionEpoch()}`
    if (playing && currentTime >= TIMELINE_END_MS) {
      runner.pause()
      playing = false
      playToggle.textContent = 'Play'
    }
    requestAnimationFrame(present)
  }

  /** Starts or pauses runner playback from the transport button. */
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
    runner.seek(Number(seek.value))
    playToggle.textContent = 'Play'
  })
  window.addEventListener('resize', () => runner.resize())
  window.addEventListener('beforeunload', () => runner.destroy(), { once: true })
  requestAnimationFrame(present)
}

start()
