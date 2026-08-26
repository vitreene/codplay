import { createRuntimeTelco } from '../../../../../codplay-v2/src/runtime/telco'
import { createCoreRuntimeCatalog } from '../../../../../codplay-v2/src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../../../codplay-v2/src/runtime/runner-html'
import { SceneBuilder } from '../../../../../codplay-v2/src/scene/compiled'
import type { SceneDoc } from '../../../../../codplay-v2/src/scene/types'
import { createRemote } from '@codplay/remote'
import { COMPONENTS_DEMO_DURATION_MS, createComponentsScene } from './components-scene'

import './style.css'

/** Builds the component showcase page around its scene host. */
function renderPage(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="components-page">
      <header class="components-page__header">
        <p class="eyebrow">CodPlay V2 / core components</p>
        <h1>Image, input, polygon.</h1>
        <p class="lede">
          Une scène déclarative présente les trois composants V2. L’image entre en
          fondu, le polygone morph vers une forme SVG et la question révèle sa
          correction sur la même timeline.
        </p>
      </header>
      <section id="scene-stage" class="components-page__scene" aria-label="démo des composants V2"></section>
      <section class="components-page__controls" aria-label="télécommande CodPlay V2">
        <div id="telco-slot"></div>
        <p class="components-page__help">
          Utilisez <strong>Lire</strong> puis le seek pour comparer Play et la
          reconstruction absolue de la scène.
        </p>
      </section>
      <section class="components-page__readout" aria-label="état runtime">
        <dl>
          <div><dt>état</dt><dd><output id="status-output">—</output></dd></div>
          <div><dt>temps</dt><dd><output id="time-output">0 ms</output></dd></div>
          <div><dt>étape</dt><dd><output id="phase-output">—</output></dd></div>
        </dl>
        <p id="error-output" class="components-page__error" hidden></p>
      </section>
    </main>
  `
}

/** Displays one scene build, preload, or runtime error in the page readout. */
function showError(message: string): void {
  const output = document.querySelector<HTMLElement>('#error-output')
  if (output === null) return
  output.hidden = false
  output.textContent = message
}

/** Converts V2 diagnostics into a compact message suitable for the demo page. */
function diagnosticsMessage(report: Readonly<{ errors: readonly Readonly<{ code: string; message: string }>[] }>): string {
  return report.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
}

/** Adds the two visual outlets required by this demo without creating a second catalog. */
function createDemoCatalog(): ReturnType<typeof createCoreRuntimeCatalog> {
  const catalog = createCoreRuntimeCatalog()
  const layout = catalog.getComponent('layout')
  if (layout === undefined) throw new Error('Core layout component is not registered.')
  catalog.overrideComponent({
    ...layout,
    mountableParts: ['visual-outlet', 'quiz-outlet'],
  })
  return catalog
}

/** Returns the human-readable phase represented by the current absolute time. */
function resolvePhase(timeMs: number): string {
  if (timeMs < 800) return 'entrée de l’image'
  if (timeMs < 1700) return 'morph SVG'
  if (timeMs < 2700) return 'sélection input'
  return 'correction input'
}

/** Compiles and mounts the V2 component showcase through the real runner path. */
export async function startComponentsDemo(): Promise<void> {
  renderPage()
  const stage = document.querySelector<HTMLElement>('#scene-stage')
  const telcoSlot = document.querySelector<HTMLElement>('#telco-slot')
  const statusOutput = document.querySelector<HTMLOutputElement>('#status-output')
  const timeOutput = document.querySelector<HTMLOutputElement>('#time-output')
  const phaseOutput = document.querySelector<HTMLOutputElement>('#phase-output')
  if (stage === null || telcoSlot === null || statusOutput === null || timeOutput === null || phaseOutput === null) {
    throw new Error('Component demo host nodes are incomplete.')
  }

  const catalog = createDemoCatalog()
  const scene: SceneDoc = createComponentsScene()
  const build = new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: '2026-08-24T00:00:00.000Z',
  }).build(scene)
  if (!build.ok) {
    showError(diagnosticsMessage(build.diagnostics))
    return
  }

  const runner = new HtmlPlayerRunner({
    id: 'v2-core-components-demo',
    compiledScene: build.compiledScene,
    root: stage,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
    enableInteractionLock: true,
  })
  const telco = createRuntimeTelco({ target: runner, durationMs: COMPONENTS_DEMO_DURATION_MS })
  const remote = createRemote({
    telco,
    onError: showError,
  })
  telcoSlot.appendChild(remote.element)

  /** Refreshes the transport and component phase readout. */
  const present = (): void => {
    const state = telco.getState()
    statusOutput.value = state.status
    timeOutput.value = `${Math.round(state.timelineMs)} ms`
    phaseOutput.value = resolvePhase(state.timelineMs)
  }

  const stopOnChange = telco.onChange(present)
  const stopOnProgress = telco.onProgress(present)
  present()

  const init = runner.init()
  if (!init.ok) {
    showError(diagnosticsMessage(init.diagnostics))
    stopOnChange()
    stopOnProgress()
    remote.destroy()
    telco.destroy()
    runner.destroy()
    return
  }

  /** Releases all resources owned by this validation page. */
  const cleanup = (): void => {
    stopOnChange()
    stopOnProgress()
    remote.destroy()
    telco.destroy()
    runner.destroy()
  }

  present()
  remote.sync()
  globalThis.addEventListener('beforeunload', cleanup, { once: true })
}
