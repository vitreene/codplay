import { createRuntimePreload } from '../../../../../codplay-v2/src/runtime/preload'
import { createRuntimeTelco } from '../../../../../codplay-v2/src/runtime/telco'
import { createCoreRuntimeCatalog } from '../../../../../codplay-v2/src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../../../codplay-v2/src/runtime/runner-html'
import { SceneBuilder } from '../../../../../codplay-v2/src/scene/compiled'
import type { CompiledResourceManifest } from '../../../../../codplay-v2/src/scene/compiled'
import type { SceneDoc } from '../../../../../codplay-v2/src/scene/types'
import { createRemote } from '@codplay/remote'
import {
  createPreloadMediaScene,
  PRELOAD_MEDIA_IMAGE_URLS,
  PRELOAD_MEDIA_SCENE_END_MS,
} from './preload-media-scene'
import preloadMediaCssUrl from './preload-media.css?url'

import './style.css'

const PRELOAD_MEDIA_CSS_URL = import.meta.env.DEV
  ? `${preloadMediaCssUrl}?direct`
  : preloadMediaCssUrl

/** Builds the validation page around the single V2 preload-media entry. */
function renderPage(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (app === null) throw new Error('Expected #app root element.')
  app.innerHTML = `
    <main class="media-page">
      <header class="media-page__header">
        <p class="eyebrow">CodPlay V2 / media-sync</p>
        <h1>Preload media</h1>
        <p class="lede">
          Le preload est externe. La lecture, le seek et le master passent par le
          même <code>RuntimePlayer</code>.
        </p>
      </header>
      <section id="scene-stage" class="media-stage" aria-label="scène media"></section>
      <section class="media-panel" aria-label="télécommande CodPlay">
        <div id="telco-slot"></div>
        <p class="media-help">La scène démarre après le preload. Utilisez le seek pour vérifier la reconstruction.</p>
      </section>
      <section class="media-readout" aria-label="état runtime">
        <dl>
          <div><dt>état</dt><dd><output id="status-output">—</output></dd></div>
          <div><dt>temps CodPlay</dt><dd><output id="time-output">0 ms</output></dd></div>
          <div><dt>temps média master</dt><dd><output id="master-output">—</output></dd></div>
        </dl>
        <p id="error-output" class="error" hidden></p>
      </section>
    </main>
  `
}

/** Displays one build, preload or runtime error in the validation page. */
function showError(message: string): void {
  const output = document.querySelector<HTMLElement>('#error-output')
  if (output === null) return
  output.hidden = false
  output.textContent = message
}

/** Converts structured diagnostics into one readable validation message. */
function diagnosticsMessage(report: Readonly<{ errors: readonly Readonly<{ code: string; message: string }>[] }>): string {
  return report.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
}

/** Returns the explicit media and CSS manifest used by the external preload. */
function createPreloadManifest(compiled: Readonly<{ resources: CompiledResourceManifest }>): CompiledResourceManifest {
  return {
    entries: [
      ...compiled.resources.entries,
      ...PRELOAD_MEDIA_IMAGE_URLS.map((url) => ({
        url,
        type: 'image',
        policy: { cache: 'default' as const, priority: 'normal' as const },
      })),
      {
        url: PRELOAD_MEDIA_CSS_URL,
        type: 'css',
        policy: { cache: 'default', priority: 'high' },
      },
    ],
  }
}

/** Preloads the V2 scene, then exposes init/play through the shared telco. */
async function start(): Promise<void> {
  renderPage()
  const stage = document.querySelector<HTMLElement>('#scene-stage')
  const telcoSlot = document.querySelector<HTMLElement>('#telco-slot')
  if (stage === null || telcoSlot === null) throw new Error('Media demo host nodes are incomplete.')

  const catalog = createCoreRuntimeCatalog()
  const scene: SceneDoc = createPreloadMediaScene()
  const build = new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: '2026-08-22T00:00:00.000Z',
  }).build(scene)
  if (!build.ok) {
    showError(diagnosticsMessage(build.diagnostics))
    return
  }

  const runner = new HtmlPlayerRunner({
    id: 'v2-preload-media-demo',
    compiledScene: build.compiledScene,
    root: stage,
    rootTargets: [{ id: 'root-host', storyId: 'main' }],
    catalog,
    resources: build.compiledScene.requirements.resources,
    enableInteractionLock: true,
  })
  const preload = createRuntimePreload()
  const telco = createRuntimeTelco({ target: runner, durationMs: PRELOAD_MEDIA_SCENE_END_MS })
  const remote = createRemote({
    telco,
    onError: (error) => showError(error),
  })
  telcoSlot.appendChild(remote.element)

  const statusOutput = document.querySelector<HTMLOutputElement>('#status-output')
  const timeOutput = document.querySelector<HTMLOutputElement>('#time-output')
  const masterOutput = document.querySelector<HTMLOutputElement>('#master-output')
  if (statusOutput === null || timeOutput === null || masterOutput === null) throw new Error('Media demo outputs are incomplete.')

  /** Refreshes the transport and native master-clock readout. */
  const present = (): void => {
    const state = telco.getState()
    statusOutput.value = state.status
    timeOutput.value = `${Math.round(state.timelineMs)} ms`
    const node = runner.getPersoNode('main:media-audio')
    const media = node instanceof HTMLElement ? node.querySelector<HTMLMediaElement>('video, audio') : null
    masterOutput.value = media === null ? '—' : `${Math.round(media.currentTime * 1000)} ms`
  }

  const stopOnChange = telco.onChange(present)
  const stopOnProgress = telco.onProgress(present)
  present()

  const preloadManifest = createPreloadManifest(build.compiledScene)
  /** Releases all demo-owned subscriptions and runtime resources. */
  const cleanup = (): void => {
    stopOnChange()
    stopOnProgress()
    remote.destroy()
    telco.destroy()
    preload.release(preloadManifest.entries.map((entry) => entry.url))
    runner.destroy()
  }
  const preloadResult = await preload.load({
    manifest: preloadManifest,
    options: { mode: 'broadcast', container: stage },
  })
  if (!preloadResult.ok) {
    showError(preloadResult.error.message)
    cleanup()
    return
  }

  runner.setResourceMetadata(preloadResult.data.metadata)

  const init = runner.init()
  if (!init.ok) {
    showError(diagnosticsMessage(init.diagnostics))
    cleanup()
    return
  }
  present()
  remote.sync()

  globalThis.addEventListener('beforeunload', cleanup, { once: true })
}

void start().catch((error) => {
  showError(error instanceof Error ? error.message : 'Erreur inattendue de la démo media.')
})
