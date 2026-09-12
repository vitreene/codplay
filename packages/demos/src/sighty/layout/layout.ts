import { createSightyRemote } from './remote'
import type {
  SightyDemoControls,
  SightyDemoDefinition,
  SightyDemoLogger,
  SightyDemoSession,
  SightyDemoLogLevel,
} from './types'

import './layout.css'

type SightyLayoutOptions = Readonly<{
  app: HTMLElement
  demos: readonly SightyDemoDefinition[]
  active: SightyDemoDefinition
}>

type MountedSightyDemo = {
  session: SightyDemoSession
  remote?: ReturnType<typeof createSightyRemote>
  controls?: SightyDemoControls
}

const LOG_OPEN_STORAGE_KEY = 'sighty-demo-log-open'

/** Mounts the shared responsive frame and routes all selected Sighty demos through it. */
export function createSightyLayout(options: SightyLayoutOptions): {
  mount: (demo: SightyDemoDefinition) => Promise<void>
  destroy: () => void
} {
  const layoutRoot = requireElement<HTMLElement>(options.app, '[data-sighty-layout]')
  const title = requireElement<HTMLElement>(layoutRoot, '[data-sighty-title]')
  const selector = requireElement<HTMLSelectElement>(layoutRoot, '[data-sighty-selector]')
  const stage = requireElement<HTMLElement>(layoutRoot, '[data-sighty-stage]')
  const remoteSlot = requireElement<HTMLElement>(layoutRoot, '[data-sighty-remote]')
  const remotePanel = requireElement<HTMLElement>(layoutRoot, '.sighty-layout__remote')
  const optionalZone = requireElement<HTMLElement>(layoutRoot, '[data-sighty-optional-zone]')
  const optionalControls = requireElement<HTMLElement>(layoutRoot, '[data-sighty-demo-controls]')
  const status = requireElement<HTMLElement>(layoutRoot, '[data-sighty-status]')
  const logsToggle = requireElement<HTMLButtonElement>(layoutRoot, '[data-sighty-log-toggle]')
  const logPanel = requireElement<HTMLElement>(layoutRoot, '[data-sighty-log-panel]')
  const logOutput = requireElement<HTMLPreElement>(layoutRoot, '[data-sighty-log-output]')
  const logCopy = requireElement<HTMLButtonElement>(layoutRoot, '[data-sighty-log-copy]')
  const logClose = requireElement<HTMLButtonElement>(layoutRoot, '[data-sighty-log-close]')

  const logLines: string[] = []
  let mounted: MountedSightyDemo | undefined
  let mountRevision = 0
  let destroyed = false

  /** Reads the persisted open state without making storage a page dependency. */
  function readLogPanelOpen(): boolean {
    try {
      return globalThis.localStorage.getItem(LOG_OPEN_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  }

  /** Persists the log panel state when browser storage is available. */
  function writeLogPanelOpen(open: boolean): void {
    try {
      globalThis.localStorage.setItem(LOG_OPEN_STORAGE_KEY, String(open))
    } catch {
      // Private browsing and restricted storage must not block the demo.
    }
  }

  /** Shows or hides the shared log panel and keeps its controls accessible. */
  function setLogPanelOpen(open: boolean): void {
    logPanel.hidden = !open
    logsToggle.setAttribute('aria-expanded', String(open))
    const label = open ? 'Masquer les logs' : 'Afficher les logs'
    logsToggle.setAttribute('aria-label', label)
    logsToggle.title = label
    writeLogPanelOpen(open)
  }

  /** Renders one bounded line in the shared log panel. */
  const log: SightyDemoLogger = (message: string, level: SightyDemoLogLevel = 'info'): void => {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false })
    logLines.push(`[${time}] ${level.toUpperCase()} ${message}`)
    if (logLines.length > 500) logLines.shift()
    logOutput.textContent = logLines.join('\n')
    logOutput.scrollTop = logOutput.scrollHeight
  }

  /** Clears the journal when the selected scenario changes. */
  function clearLogs(): void {
    logLines.length = 0
    logOutput.textContent = ''
  }

  /** Copies the current journal when the browser grants clipboard access. */
  async function copyLogs(): Promise<void> {
    const clipboard = globalThis.navigator.clipboard
    if (clipboard === undefined) {
      log('Copie des logs indisponible dans ce contexte.', 'warn')
      return
    }
    try {
      await clipboard.writeText(logLines.join('\n'))
    } catch {
      log('Copie des logs indisponible dans ce contexte.', 'warn')
    }
  }

  /** Removes the current scenario and every page control it supplied. */
  function unmount(): void {
    const current = mounted
    mounted = undefined
    current?.controls?.destroy()
    current?.remote?.destroy()
    current?.session.destroy()
    optionalControls.replaceChildren()
    optionalZone.hidden = true
    remoteSlot.replaceChildren()
    remotePanel.hidden = true
    stage.replaceChildren()
  }

  /** Updates the URL without creating a second HTML entry for the selected demo. */
  function rememberSelection(demo: SightyDemoDefinition): void {
    const url = new URL(globalThis.location.href)
    url.searchParams.set('demo', demo.id)
    globalThis.history.replaceState({}, '', url)
  }

  /** Builds one selected scenario, then activates its shared remote and controls. */
  async function mount(demo: SightyDemoDefinition): Promise<void> {
    if (destroyed) return
    const revision = ++mountRevision
    unmount()
    clearLogs()
    rememberSelection(demo)
    title.textContent = demo.title
    status.textContent = 'Chargement'
    status.dataset.state = 'loading'
    selector.value = demo.id
    selector.disabled = true

    const session = demo.create({ stage, onLog: log })
    const remote = session.showRemote === false
      ? undefined
      : createSightyRemote(session.transport, { onLog: log, enabled: false })
    if (remote !== undefined) remoteSlot.replaceChildren(remote.element)
    remotePanel.hidden = remote === undefined
    mounted = { session, remote }

    try {
      await session.initialize()
      if (destroyed || revision !== mountRevision || mounted?.session !== session) {
        remote?.destroy()
        session.destroy()
        return
      }

      if (session.createOptionalControls !== undefined) {
        const controls = session.createOptionalControls(optionalControls)
        mounted.controls = controls
        optionalZone.hidden = false
      }
      remote?.setEnabled(true)
      status.textContent = 'Prête'
      status.dataset.state = 'ready'
      log(`${demo.title} prête`)
    } catch (error) {
      if (destroyed || revision !== mountRevision) {
        remote?.destroy()
        session.destroy()
        return
      }
      status.textContent = 'Erreur'
      status.dataset.state = 'error'
      log(error instanceof Error ? error.message : String(error), 'error')
      setLogPanelOpen(true)
      mounted?.controls?.destroy()
      optionalControls.replaceChildren()
      optionalZone.hidden = true
      remote?.setEnabled(false)
      session.destroy()
      stage.replaceChildren()
    } finally {
      if (!destroyed && revision === mountRevision) selector.disabled = false
    }
  }

  /** Redirects selector changes to the corresponding in-page scenario mount. */
  function onSelectionChange(): void {
    const demo = options.demos.find((candidate) => candidate.id === selector.value)
    if (demo !== undefined) void mount(demo)
  }

  /** Opens or closes the log panel from the header control. */
  function onLogToggle(): void {
    setLogPanelOpen(logPanel.hidden === true)
  }

  /** Closes the log panel from its local close control. */
  function onLogClose(): void {
    setLogPanelOpen(false)
  }

  /** Copies the current log panel content without blocking the page. */
  function onLogCopy(): void {
    void copyLogs()
  }

  for (const demo of options.demos) {
    const option = document.createElement('option')
    option.value = demo.id
    option.textContent = demo.title
    selector.append(option)
  }
  selector.addEventListener('change', onSelectionChange)
  logsToggle.addEventListener('click', onLogToggle)
  logClose.addEventListener('click', onLogClose)
  logCopy.addEventListener('click', onLogCopy)
  setLogPanelOpen(readLogPanelOpen())
  void mount(options.active)

  return {
    mount,
    destroy() {
      if (destroyed) return
      destroyed = true
      mountRevision += 1
      selector.removeEventListener('change', onSelectionChange)
      logsToggle.removeEventListener('click', onLogToggle)
      logClose.removeEventListener('click', onLogClose)
      logCopy.removeEventListener('click', onLogCopy)
      unmount()
      clearLogs()
    },
  }
}

/** Reads one required page mount point and produces a useful authoring error. */
function requireElement<ElementType extends Element>(root: ParentNode, selector: string): ElementType {
  const element = root.querySelector<ElementType>(selector)
  if (element === null) throw new Error(`Le layout Sighty attend ${selector}.`)
  return element
}
