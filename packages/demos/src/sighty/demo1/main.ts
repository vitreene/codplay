import { SightyComposition } from './sighty-composition'

import '../../v2/layout/layout.css'
import './style.css'

const stageElement = document.querySelector<HTMLElement>('[data-sighty-stage]')
const controlsElement = document.querySelector<HTMLElement>('[data-sighty-controls]')
const statusElement = document.querySelector<HTMLElement>('[data-sighty-status]')
const logOutputElement = document.querySelector<HTMLPreElement>('[data-sighty-log]')

if (stageElement === null || controlsElement === null || statusElement === null || logOutputElement === null) {
  throw new Error('La page Sighty attend ses points de montage déclarés.')
}

const stage = stageElement
const controls = controlsElement
const status = statusElement
const logOutput = logOutputElement

const logLines: string[] = []

/** Writes one bounded line to the Sighty demonstration journal. */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const time = new Date().toLocaleTimeString('fr-FR', { hour12: false })
  logLines.push(`[${time}] ${level.toUpperCase()} ${message}`)
  if (logLines.length > 300) logLines.shift()
  logOutput.textContent = logLines.join('\n')
}

const composition = new SightyComposition({ stage, controls, onLog: log })

/** Mounts the composition and reflects initialization failures in the page. */
async function start(): Promise<void> {
  try {
    await composition.initialize()
    status.textContent = 'Composition active · layout, A et B sont indépendantes'
    status.dataset.state = 'ready'
  } catch (error) {
    status.textContent = 'Échec de la composition'
    status.dataset.state = 'error'
    log(error instanceof Error ? error.message : String(error), 'error')
    composition.destroy()
  }
}

globalThis.addEventListener('beforeunload', () => composition.destroy(), { once: true })
void start()
