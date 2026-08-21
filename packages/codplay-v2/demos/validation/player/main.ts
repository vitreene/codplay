import { createRuntimeTelco } from '../../../src/runtime/telco'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'
import { createTelcoRemote } from '../../shared/telco-remote'
import { createDragCaptureScene, dragStraps } from './drag-scene'

import './style.css'

const TIMELINE_END_MS = 6000

/** Creates the complete validation page around the single player demo entry. */
function renderPage(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="drag-shell">
      <header class="drag-header">
        <p class="eyebrow">CodPlay V2 / capture continue</p>
        <h1>Drag &amp; Capture</h1>
        <p class="lede">
          La démo reprend le scénario de drag classique de V1. La source HTML
          ouvre une capture pointer, applique l'action live du composant, puis
          remet la fin dans le circuit normal des événements.
        </p>
      </header>
      <section class="stage-panel" aria-label="scène interactive">
        <div id="scene-stage" class="drag-stage"></div>
      </section>
      <section class="panel" aria-label="télécommande CodPlay">
        <div id="telco-slot"></div>
        <p class="remote-help">Lire la séquence avant de déplacer le bouton, puis utiliser le seek pour vérifier la relecture de la fin de capture.</p>
      </section>
      <section class="readout-panel" aria-label="état runtime">
        <dl class="readout">
          <div><dt>état</dt><dd><output id="status-output">—</output></dd></div>
          <div><dt>temps</dt><dd><output id="time-output">0 ms</output></dd></div>
          <div><dt>position materialisée</dt><dd><output id="position-output">—</output></dd></div>
          <div><dt>nœud</dt><dd><output id="node-output">—</output></dd></div>
        </dl>
        <p id="error-output" class="error" hidden></p>
      </section>
    </main>
  `
}

/** Reads one required output node from the validation page. */
function output(id: string): HTMLOutputElement {
  const element = document.querySelector<HTMLOutputElement>(`#${id}`)
  if (element === null) throw new Error(`Missing demo output: ${id}`)
  return element
}

/** Converts one failed build or runtime result into the visible error panel. */
function showError(message: string): void {
  const error = document.querySelector<HTMLElement>('#error-output')
  if (error === null) return
  error.hidden = false
  error.textContent = message
}

/** Returns one human-readable diagnostic report. */
function diagnosticsMessage(report: Readonly<{ errors: readonly Readonly<{ code: string; message: string }>[] }>): string {
  return report.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
}

/** Starts the V2 drag capture scene through the shared catalog and runner. */
function start(): void {
  renderPage()

  const stage = document.querySelector<HTMLElement>('#scene-stage')
  const telcoSlot = document.querySelector<HTMLElement>('#telco-slot')
  if (stage === null || telcoSlot === null) throw new Error('Drag demo host nodes are incomplete.')

  const catalog = createCoreRuntimeCatalog()
  const scene: SceneDoc = createDragCaptureScene()
  const build = new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: new Date().toISOString(),
  }).build(scene)
  if (!build.ok) {
    showError(diagnosticsMessage(build.diagnostics))
    return
  }

  const runner = new HtmlPlayerRunner({
    id: 'drag-capture-demo',
    compiledScene: build.compiledScene,
    root: stage,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
    functions: build.functions,
    strapCollections: { scene: {}, stories: { main: dragStraps } },
    enableInteractionLock: true,
    onCaptureError: (error) => {
      const message = error instanceof Error ? error.message : 'Erreur de capture HTML.'
      showError(message)
    },
  })
  const init = runner.init()
  if (!init.ok) {
    showError(diagnosticsMessage(init.diagnostics))
    runner.destroy()
    return
  }

  const telco = createRuntimeTelco({ target: runner, durationMs: TIMELINE_END_MS })
  const remote = createTelcoRemote({ telco, durationMs: TIMELINE_END_MS, onError: showError })
  telcoSlot.appendChild(remote.element)

  const statusOutput = output('status-output')
  const timeOutput = output('time-output')
  const positionOutput = output('position-output')
  const nodeOutput = output('node-output')
  const draggableNode = runner.getPersoNode('main:draggable')
  if (!(draggableNode instanceof HTMLElement)) {
    showError('Le composant draggable n’a pas produit un nœud HTML.')
    remote.destroy()
    telco.destroy()
    runner.destroy()
    return
  }

  /** Refreshes the diagnostics readout from the same telco snapshot as the remote. */
  const present = (): void => {
    const state = telco.getState()
    statusOutput.value = state.status
    timeOutput.value = `${Math.round(state.timelineMs)} ms`
    positionOutput.value = draggableNode.style.transform || '—'
    nodeOutput.value = draggableNode.isConnected ? 'monté' : 'détaché'
  }

  const stopOnChange = telco.onChange(present)
  const stopOnProgress = telco.onProgress(present)
  present()

  /** Releases the validation-only observers and the persistent runtime resources. */
  const cleanup = (): void => {
    stopOnChange()
    stopOnProgress()
    remote.destroy()
    telco.destroy()
    runner.destroy()
  }
  globalThis.addEventListener('beforeunload', cleanup, { once: true })
}

void start()
