import { createCoreRuntimeCatalog } from '../../../../codplay-v2/src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../../codplay-v2/src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../../codplay-v2/src/runtime/runner'
import { createRuntimeTelco } from '../../../../codplay-v2/src/runtime/telco'
import { SceneBuilder } from '../../../../codplay-v2/src/scene/compiled'
import type { SceneDoc } from '../../../../codplay-v2/src/scene/types'
import type { V2DemoDefinition } from '../registry'
import { createV2DemoTelco } from './telco'
import type { V2DemoLogLevel, V2DemoModule } from './types'

import './layout.css'

type V2DemoLayoutOptions = Readonly<{
  app: HTMLElement
  active: V2DemoDefinition
  demos: readonly V2DemoDefinition[]
}>

const V2_DEMO_LOG_OPEN_STORAGE_KEY = 'codplay-v2-demo-log-open'

/** Creates the shared V2 runtime catalog and publishes the scene's mountable parts. */
function createDemoRuntimeCatalog(mountableParts: readonly string[]): RuntimeCapabilityCatalog {
  const catalog = createCoreRuntimeCatalog()
  const layout = catalog.getComponent('layout')
  if (layout === undefined) throw new Error('Core layout component is not registered.')
  catalog.overrideComponent({ ...layout, mountableParts })
  return catalog
}

/** Compiles one scene through the same builder boundary as the V2 runtime. */
function buildDemoScene(
  scene: SceneDoc,
  catalog: RuntimeCapabilityCatalog,
): ReturnType<SceneBuilder['build']> {
  return new SceneBuilder(catalog.validationSnapshot(), {
    createdAt: '2026-08-18T00:00:00.000Z',
  }).build(scene)
}

/** Mounts the responsive V2 frame and owns every control shared by its demos. */
export function createV2DemoLayout(options: V2DemoLayoutOptions): {
  mount: (module: V2DemoModule) => void
  destroy: () => void
} {
  const layoutRoot = document.createElement('main')
  layoutRoot.className = 'v2-demo-layout'
  layoutRoot.innerHTML = `
    <header class="v2-demo-header">
      <div class="v2-demo-header__copy">
        <p class="v2-demo-eyebrow">CodPlay V2</p>
        <h1 class="v2-demo-title"></h1>
        <p class="v2-demo-description"></p>
      </div>
      <div class="v2-demo-header__tools">
        <label class="v2-demo-selector">
          <span>Démo</span>
          <select class="v2-demo-selector__input"></select>
        </label>
        <button class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-logs-toggle" type="button" aria-expanded="false" aria-label="Afficher les logs" title="Afficher les logs">
          <svg class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 3h9l3 3v15H6V3zm2 2v14h8V7h-2V5H8zm2 5h4v1h-4zm0 3h4v1h-4zm0 3h4v1h-4z"></path>
          </svg>
          <span class="v2-demo-button__label">Logs</span>
        </button>
      </div>
    </header>
    <section class="v2-demo-stage" data-v2-demo-stage>
      <div class="v2-demo-scene-slot" data-v2-demo-scene></div>
      <aside class="v2-demo-log-layer" aria-live="polite">
        <div class="v2-demo-log-panel" hidden>
          <div class="v2-demo-log-panel__header">
            <span>Journal</span>
            <div class="v2-demo-log-panel__actions">
              <button class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-log-copy" type="button" aria-label="Copier le journal" title="Copier le journal">
                <svg class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 7V4h11v13h-3v3H5V7h3zm2 0h4v8h2V6h-6v1zm4 11v-1H8V9H7v9h7z"></path>
                </svg>
                <span class="v2-demo-button__label">Copier</span>
              </button>
              <button class="v2-demo-button v2-demo-button--secondary v2-demo-button--icon v2-demo-log-close" type="button" aria-label="Fermer le journal" title="Fermer le journal">
                <svg class="v2-demo-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4z"></path>
                </svg>
                <span class="v2-demo-button__label">Fermer</span>
              </button>
            </div>
          </div>
          <pre class="v2-demo-log-output"></pre>
        </div>
      </aside>
    </section>
    <footer class="v2-demo-footer">
      <div class="v2-demo-telco" data-v2-demo-telco></div>
    </footer>
  `
  options.app.replaceChildren(layoutRoot)

  const title = layoutRoot.querySelector<HTMLElement>('.v2-demo-title')!
  const description = layoutRoot.querySelector<HTMLElement>('.v2-demo-description')!
  const selector = layoutRoot.querySelector<HTMLSelectElement>('.v2-demo-selector__input')!
  const sceneSlot = layoutRoot.querySelector<HTMLElement>('[data-v2-demo-scene]')!
  const telcoSlot = layoutRoot.querySelector<HTMLElement>('[data-v2-demo-telco]')!
  const logsToggle = layoutRoot.querySelector<HTMLButtonElement>('.v2-demo-logs-toggle')!
  const logPanel = layoutRoot.querySelector<HTMLElement>('.v2-demo-log-panel')!
  const logOutput = layoutRoot.querySelector<HTMLPreElement>('.v2-demo-log-output')!
  const logCopy = layoutRoot.querySelector<HTMLButtonElement>('.v2-demo-log-copy')!
  const logClose = layoutRoot.querySelector<HTMLButtonElement>('.v2-demo-log-close')!

  function readLogPanelOpen(): boolean {
    try {
      return globalThis.localStorage.getItem(V2_DEMO_LOG_OPEN_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  }

  function writeLogPanelOpen(open: boolean): void {
    try {
      globalThis.localStorage.setItem(V2_DEMO_LOG_OPEN_STORAGE_KEY, String(open))
    } catch {
      // Private browsing and restricted storage must not block the demo.
    }
  }

  function setLogPanelOpen(open: boolean): void {
    logPanel.hidden = !open
    logsToggle.setAttribute('aria-expanded', String(open))
    const label = open ? 'Masquer les logs' : 'Afficher les logs'
    logsToggle.setAttribute('aria-label', label)
    logsToggle.title = label
    writeLogPanelOpen(open)
  }

  title.textContent = options.active.title
  description.textContent = options.active.description
  for (const demo of options.demos) {
    const option = document.createElement('option')
    option.value = demo.path
    option.textContent = demo.label
    option.selected = demo.id === options.active.id
    selector.append(option)
  }
  selector.addEventListener('change', () => {
    const target = new URL(selector.value, globalThis.location.href)
    globalThis.location.assign(target.href)
  })

  const logLines: string[] = []
  let logFlushScheduled = false
  let telcoControls: ReturnType<typeof createV2DemoTelco> | undefined
  let sceneCleanup: (() => void) | undefined

  function flushLogs(): void {
    logFlushScheduled = false
    logOutput.textContent = logLines.join('\n')
    logOutput.scrollTop = logOutput.scrollHeight
  }

  function log(message: string, level: V2DemoLogLevel = 'info'): void {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false })
    logLines.push(`[${time}] ${level.toUpperCase()} ${message}`)
    if (logLines.length > 500) logLines.shift()
    if (!logFlushScheduled) {
      logFlushScheduled = true
      globalThis.requestAnimationFrame(flushLogs)
    }
  }

  /** Copies the current non-blocking journal without changing its contents. */
  async function copyLogs(): Promise<void> {
    const text = logLines.join('\n')
    try {
      if (globalThis.navigator.clipboard !== undefined) {
        await globalThis.navigator.clipboard.writeText(text)
        return
      }
    } catch {
      // Use the local fallback below when the async clipboard is unavailable.
    }

    const fallback = document.createElement('textarea')
    fallback.value = text
    fallback.setAttribute('readonly', '')
    fallback.style.position = 'fixed'
    fallback.style.opacity = '0'
    document.body.append(fallback)
    fallback.select()
    try {
      document.execCommand('copy')
    } catch {
      // Clipboard permissions are optional for this non-blocking demo action.
    } finally {
      fallback.remove()
    }
  }

  /** Installs the shared telco for the currently mounted runner. */
  function installTelco(runner: HtmlPlayerRunner) {
    const telco = createRuntimeTelco({
      durationMs: options.active.durationMs,
      target: runner,
    })
    telcoControls?.destroy()
    telcoControls = createV2DemoTelco(telco, { onLog: log })
    telcoSlot.replaceChildren(telcoControls.element)
    return telco
  }

  /** Releases the current runner, telco and scene-specific stage state. */
  function unmountScene(): void {
    sceneCleanup?.()
    sceneCleanup = undefined
    telcoControls?.destroy()
    telcoControls = undefined
    telcoSlot.replaceChildren()
    sceneSlot.className = 'v2-demo-scene-slot'
    sceneSlot.removeAttribute('aria-label')
    sceneSlot.replaceChildren()
  }

  setLogPanelOpen(readLogPanelOpen())
  logsToggle.addEventListener('click', () => setLogPanelOpen(logPanel.hidden))
  logClose.addEventListener('click', () => setLogPanelOpen(false))
  logCopy.addEventListener('click', () => { void copyLogs() })

  return {
    /** Mounts only the scene supplied by a lazily loaded demo module. */
    mount(module) {
      unmountScene()
      sceneSlot.className = `v2-demo-scene-slot ${options.active.stageClassName}`
      sceneSlot.setAttribute('aria-label', options.active.stageLabel)

      const scene = module.createScene()
      const catalog = createDemoRuntimeCatalog(options.active.mountableParts)
      const build = buildDemoScene(scene, catalog)
      if (!build.ok) {
        log(`SceneDoc build failed: ${build.diagnostics.errors.map((entry) => entry.message).join(' · ')}`, 'error')
        return
      }

      const runner = new HtmlPlayerRunner({
        id: scene.id,
        compiledScene: build.compiledScene,
        root: sceneSlot,
        rootTargets: [{ id: 'root-host', storyId: options.active.rootStoryId }],
        catalog,
      })
      const init = runner.init()
      if (!init.ok) {
        log(`Runner init failed: ${init.diagnostics.errors.map((entry) => entry.message).join(' · ')}`, 'error')
        runner.destroy()
        return
      }

      const telco = installTelco(runner)
      log(`${options.active.title} initialisée · durée=${options.active.durationMs}ms`)

      /** Rebuilds measured endpoints after the responsive scene root changes size. */
      function refreshAfterResize(): void {
        try {
          runner.resize()
        } catch (resizeError) {
          const message = resizeError instanceof Error ? resizeError.message : String(resizeError)
          log(message, 'error')
        }
      }

      const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(refreshAfterResize)
      if (resizeObserver !== undefined) resizeObserver.observe(sceneSlot)
      else globalThis.addEventListener('resize', refreshAfterResize)

      sceneCleanup = () => {
        resizeObserver?.disconnect()
        if (resizeObserver === undefined) globalThis.removeEventListener('resize', refreshAfterResize)
        telco.destroy()
        runner.destroy()
      }
    },
    destroy() {
      unmountScene()
      if (logFlushScheduled) logFlushScheduled = false
    },
  }
}
