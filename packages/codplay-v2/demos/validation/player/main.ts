import { createRuntimeTelco } from '../../../src/runtime/telco'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import {
  HtmlListDndPreview,
  HtmlPlayerRunner,
} from '../../../src/runtime/runner'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'
import { createTelcoRemote } from '../../shared/telco-remote'
import {
  createDragCaptureScene,
  s6Straps,
} from './drag-scene'

import './style.css'

const TIMELINE_END_MS = 24000

/** Creates the complete S6 validation page around the single player entry. */
function renderPage(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="drag-shell">
      <header class="drag-header">
        <p class="eyebrow">CodPlay V2 / capture continue + list</p>
        <h1>Drag &amp; Drop listes</h1>
        <p class="lede">
          La scène S6 utilise une capture pointer ordinaire, la preview HTML est
          transitoire et le drop produit un
          <code>move</code> normal consommé par la capacité <code>list</code>.
        </p>
      </header>
      <section class="stage-panel" aria-label="scène interactive">
        <div id="scene-stage" class="drag-stage"></div>
      </section>
      <section class="panel" aria-label="télécommande CodPlay">
        <div id="telco-slot"></div>
        <p class="remote-help">
          Lire la séquence avant de déplacer un item. Le seek vérifie la
          reconstruction de l'ordre et des compteurs après le drop.
        </p>
      </section>
      <section class="readout-panel" aria-label="état runtime">
        <dl class="readout">
          <div><dt>état</dt><dd><output id="status-output">—</output></dd></div>
          <div><dt>temps</dt><dd><output id="time-output">0 ms</output></dd></div>
          <div><dt>liste A</dt><dd><output id="list-a-output">—</output></dd></div>
          <div><dt>liste B</dt><dd><output id="list-b-output">—</output></dd></div>
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

/** Reads the persistent author order from one materialized list root. */
function readListOrder(node: unknown, fallback: readonly string[]): string {
  if (!(node instanceof HTMLElement)) return fallback.join(' · ')
  const values = Array.from(node.children)
    .filter((child) => !child.hasAttribute('data-codplay-dnd-ghost'))
    .map((child) => child.getAttribute('data-item-id'))
    .filter((value): value is string => value !== null)
    .map((value) => value.slice(value.indexOf(':') + 1))
  return values.length === 0 ? 'vide' : values.join(' · ')
}

/** Starts the V2 S6 list capture scene through the shared catalog and runner. */
function start(): void {
  renderPage()

  const stage = document.querySelector<HTMLElement>('#scene-stage')
  const telcoSlot = document.querySelector<HTMLElement>('#telco-slot')
  if (stage === null || telcoSlot === null) throw new Error('S6 demo host nodes are incomplete.')

  const catalog = createCoreRuntimeCatalog()
  const scene: SceneDoc = createDragCaptureScene()
  const build = new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: '2026-08-21T00:00:00.000Z',
  }).build(scene)
  if (!build.ok) {
    showError(diagnosticsMessage(build.diagnostics))
    return
  }

  let preview: HtmlListDndPreview | undefined
  const runner = new HtmlPlayerRunner({
    id: 's6-dnd-list-demo',
    compiledScene: build.compiledScene,
    root: stage,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
    functions: build.functions,
    strapCollections: { scene: {}, stories: { main: s6Straps } },
    enableInteractionLock: true,
    onCaptureTrack: (input) => preview?.track(input),
    resolveEndCaptureState: ({ captureId, persoKey, captureState, event }) => preview?.resolveEndState(persoKey, captureState, event, captureId),
    onCaptureClose: ({ captureId, persoKey, completed }) => preview?.close(persoKey, captureId, completed),
    onCaptureError: (error) => {
      const message = error instanceof Error ? error.message : 'Erreur de capture HTML.'
      showError(message)
    },
  })
  preview = new HtmlListDndPreview({
    resolveNode: (persoKey) => runner.getPersoNode(persoKey),
    resolveListNode: (storyId, listId) => runner.getPersoNode(`${storyId}:${listId}`),
    resolveListItemNodes: (storyId, listId) => {
      const targetId = `${storyId}:${listId}`
      const childKeys = runner.player.getSolvedScene()?.graph.childrenByTarget[targetId]
      return childKeys?.map((persoKey) => runner.getPersoNode(persoKey))
    },
  })

  const init = runner.init()
  if (!init.ok) {
    showError(diagnosticsMessage(init.diagnostics))
    preview.destroy()
    runner.destroy()
    return
  }

  const telco = createRuntimeTelco({ target: runner, durationMs: TIMELINE_END_MS })
  const remote = createTelcoRemote({ telco, durationMs: TIMELINE_END_MS, onError: showError })
  telcoSlot.appendChild(remote.element)

  const statusOutput = output('status-output')
  const timeOutput = output('time-output')
  const listAOutput = output('list-a-output')
  const listBOutput = output('list-b-output')
  const listANode = runner.getPersoNode('main:list-a')
  const listBNode = runner.getPersoNode('main:list-b')

  /** Refreshes the readout from the materialized order and the telco snapshot. */
  const present = (): void => {
    const state = telco.getState()
    statusOutput.value = state.status
    timeOutput.value = `${Math.round(state.timelineMs)} ms`
    listAOutput.value = readListOrder(listANode, ['main:item-1', 'main:item-2', 'main:item-3'])
    listBOutput.value = readListOrder(listBNode, [])
  }

  const stopOnChange = telco.onChange(present)
  const stopOnProgress = telco.onProgress(present)
  present()

  /** Releases the validation observers and all persistent runtime resources. */
  const cleanup = (): void => {
    stopOnChange()
    stopOnProgress()
    remote.destroy()
    telco.destroy()
    preview?.destroy()
    runner.destroy()
  }
  globalThis.addEventListener('beforeunload', cleanup, { once: true })
}

void start()
