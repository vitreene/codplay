import { createSightyRemote } from '../src/sighty/layout/remote'
import { createSightyTransport } from '../src/sighty/layout/transport'
import { COURSE_EVENTS } from '../src/sighty/demo5/messages'
import type { CodPlayOptions } from 'codplay'
import '../src/sighty/layout/layout.css'
import './style.css'

type SightyLibrary = typeof import('@codplay/sighty')
type SightyOwner = InstanceType<SightyLibrary['Sighty']>
type SightyDistributionLoader = Readonly<{
  loadSightyPackage: (options: Readonly<{ root: HTMLElement; codplay?: CodPlayOptions }>) => Promise<SightyOwner>
}>

/** Loads the standalone Demo 5 distribution through its packaged entry point. */
async function mountSightyExportDemo(): Promise<void> {
  const root = requireElement<HTMLElement>('#sighty-export-root')
  const status = requireElement<HTMLElement>('#sighty-export-status')
  const log = requireElement<HTMLElement>('#sighty-export-log')
  const initializeButton = requireElement<HTMLButtonElement>('#sighty-export-initialize')
  const remoteSlot = requireElement<HTMLElement>('#sighty-export-remote')
  const loaderUrl = new URL('/exports/sighty-demo5/loader.mjs', globalThis.location.href).href
  let owner: SightyOwner | undefined
  let remote: ReturnType<typeof createSightyRemote> | undefined

  /** Shows one visible state of package preparation or scenario initialization. */
  function setStatus(message: string, state: 'loading' | 'ready' | 'error'): void {
    status.dataset.state = state
    status.textContent = message
  }

  /** Keeps runtime and remote messages visible beside the exported course. */
  function onLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    log.dataset.level = level
    log.textContent = message
  }

  try {
    const { loadSightyPackage } = await import(/* @vite-ignore */ loaderUrl) as SightyDistributionLoader
    owner = await loadSightyPackage({
      root,
      codplay: {
        engine: {
          idle: false,
          diagnosticOutput: (diagnostic) => onLog(
            diagnostic.message,
            diagnostic.severity === 'warning' ? 'warn' : 'error',
          ),
        },
      },
    })
    const sceneCount = owner.runtime.sceneKeys.length
    if (owner.runtime.getInstance('scene-layout') !== undefined) {
      throw new Error('Le chargement du paquet a créé une occurrence avant runtime.initialize().')
    }

    setStatus(`Paquet prêt · ${sceneCount} scènes préparées · aucune occurrence créée.`, 'ready')
    initializeButton.disabled = false
    remote = createSightyRemote(createSightyTransport(owner.runtime), {
      onLog,
      enabled: false,
      onReset: () => globalThis.location.reload(),
    })
    remoteSlot.replaceChildren(remote.element)

    initializeButton.addEventListener('click', () => {
      void initializeCourse()
    })

    /** Creates the scenario occurrences only after the user starts initialization. */
    async function initializeCourse(): Promise<void> {
      if (owner === undefined || initializeButton.disabled) return
      initializeButton.disabled = true
      setStatus('Initialisation du scénario…', 'loading')
      try {
        await owner.runtime.initialize()
        await owner.runtime.play('scene-layout')
        const refreshed = await owner.runtime.dispatch({ name: COURSE_EVENTS.refreshPresentation })
        if (!refreshed) onLog('La présentation initiale a été refusée.', 'warn')
        remote?.setEnabled(true)
        setStatus(`Cours initialisé depuis le paquet · ${sceneCount} scènes disponibles.`, 'ready')
      } catch (error) {
        console.error('[sighty-export] runtime initialization failed', error)
        setStatus(error instanceof Error ? error.message : String(error), 'error')
        onLog('L’initialisation du cours a échoué.', 'error')
        initializeButton.disabled = false
      }
    }

    globalThis.addEventListener('beforeunload', () => {
      remote?.destroy()
      owner?.destroy()
    }, { once: true })
  } catch (error) {
    owner?.destroy()
    setStatus(error instanceof Error ? error.message : String(error), 'error')
    onLog('Le paquet Sighty Demo 5 n’a pas pu être préparé.', 'error')
  }
}

/** Resolves a required host element and includes its selector in setup failures. */
function requireElement<ElementType extends HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (element === null) throw new Error(`Required Sighty export demo element is missing: ${selector}`)
  return element
}

void mountSightyExportDemo()
