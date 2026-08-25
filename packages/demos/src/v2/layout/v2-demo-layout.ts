import type { RuntimeTelco } from '../../../../codplay-v2/src/runtime/telco'
import { createV2DemoTelco } from './v2-demo-telco'
import type { V2DemoDefinition } from '../registry'
import type { V2DemoLogLevel, V2DemoMountContext } from './types'

import './v2-demo-layout.css'

type V2DemoLayoutOptions = Readonly<{
  app: HTMLElement
  active: V2DemoDefinition
  demos: readonly V2DemoDefinition[]
}>

/** Mounts the responsive V2 demo frame and returns its demo-facing context. */
export function createV2DemoLayout(options: V2DemoLayoutOptions): {
  context: V2DemoMountContext
  destroy: () => void
} {
  const shell = document.createElement('main')
  shell.className = 'v2-demo-shell'
  shell.innerHTML = `
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
      <aside class="v2-demo-log-layer" aria-live="polite">
        <div class="v2-demo-log-panel" hidden>
          <div class="v2-demo-log-panel__header">
            <span>Journal</span>
            <button class="v2-demo-button v2-demo-button--secondary v2-demo-log-clear" type="button">Effacer</button>
          </div>
          <pre class="v2-demo-log-output"></pre>
        </div>
      </aside>
    </section>
    <footer class="v2-demo-footer">
      <div class="v2-demo-telco" data-v2-demo-telco></div>
    </footer>
  `
  options.app.replaceChildren(shell)

  const title = shell.querySelector<HTMLElement>('.v2-demo-title')!
  const description = shell.querySelector<HTMLElement>('.v2-demo-description')!
  const selector = shell.querySelector<HTMLSelectElement>('.v2-demo-selector__input')!
  const stage = shell.querySelector<HTMLElement>('[data-v2-demo-stage]')!
  const telcoSlot = shell.querySelector<HTMLElement>('[data-v2-demo-telco]')!
  const logsToggle = shell.querySelector<HTMLButtonElement>('.v2-demo-logs-toggle')!
  const logPanel = shell.querySelector<HTMLElement>('.v2-demo-log-panel')!
  const logOutput = shell.querySelector<HTMLPreElement>('.v2-demo-log-output')!
  const logClear = shell.querySelector<HTMLButtonElement>('.v2-demo-log-clear')!

  title.textContent = options.active.title
  description.textContent = options.active.description
  for (const demo of options.demos) {
    const option = document.createElement('option')
    option.value = demo.id
    option.textContent = demo.label
    option.selected = demo.id === options.active.id
    selector.append(option)
  }
  selector.addEventListener('change', () => {
    globalThis.location.assign(`?demo=${encodeURIComponent(selector.value)}`)
  })

  const logLines: string[] = []
  let logFlushScheduled = false
  let telcoControls: ReturnType<typeof createV2DemoTelco> | undefined

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

  logsToggle.addEventListener('click', () => {
    const open = logPanel.hidden
    logPanel.hidden = !open
    logsToggle.setAttribute('aria-expanded', String(open))
    const label = open ? 'Masquer les logs' : 'Afficher les logs'
    logsToggle.setAttribute('aria-label', label)
    logsToggle.title = label
  })
  logClear.addEventListener('click', () => {
    logLines.length = 0
    flushLogs()
  })

  return {
    context: {
      stage,
      setTelco: (telco: RuntimeTelco) => {
        telcoControls?.destroy()
        telcoControls = createV2DemoTelco(telco, { onLog: log })
        telcoSlot.replaceChildren(telcoControls.element)
      },
      log,
    },
    destroy: () => {
      telcoControls?.destroy()
      if (logFlushScheduled) logFlushScheduled = false
    },
  }
}
