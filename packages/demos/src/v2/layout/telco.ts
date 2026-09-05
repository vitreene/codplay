import { createRemote } from '@codplay/remote'
import type { CodPlayTelco } from 'codplay'

type V2DemoTelcoOptions = Readonly<{
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
  onReload?: () => void | Promise<void>
}>

/** Creates the circular-arrow control used to remount the current V2 scene. */
function createReloadButton(): HTMLButtonElement {
  const button = globalThis.document.createElement('button')
  const icon = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const label = globalThis.document.createElement('span')

  button.type = 'button'
  button.className = 'telco-button telco-button--secondary telco-button--transport'
  button.setAttribute('data-v2-demo-telco-reload', '')
  button.setAttribute('aria-label', 'Recharger la scène')
  button.title = 'Recharger la scène'
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('focusable', 'false')
  icon.classList.add('telco-button__icon')
  path.setAttribute('d', 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z')
  label.className = 'telco-button__label'
  label.textContent = 'Recharger la scène'
  icon.appendChild(path)
  button.append(icon, label)
  return button
}

/** Adapts the official V2 remote to the common demo layout logger. */
export function createV2DemoTelco(telco: CodPlayTelco, options: V2DemoTelcoOptions): {
  element: HTMLElement
  sync: () => void
  destroy: () => void
} {
  const remote = createRemote({
    telco,
    onInfo: (message) => options.onLog(message),
    onError: (message) => options.onLog(message, 'error'),
  })
  const reloadSceneCallback = options.onReload
  if (reloadSceneCallback === undefined) return remote

  const transportRow = remote.element.querySelector<HTMLElement>('.telco-remote__transport')
  if (transportRow === null) return remote
  const reloadButton = createReloadButton()
  const seek = transportRow.querySelector<HTMLElement>('.telco-remote__seek')
  if (seek === null) transportRow.append(reloadButton)
  else transportRow.insertBefore(reloadButton, seek)

  let disposed = false
  let inFlight = false

  /** Invokes the host-owned scene remount callback when it is still available. */
  function invokeReload(): void | Promise<void> {
    const callback = reloadSceneCallback
    if (callback === undefined) return
    return callback()
  }

  /** Updates reload availability without competing with a telco command. */
  function syncReloadButton(): void {
    if (disposed) return
    reloadButton.disabled = disposed || inFlight || telco.commandInFlight || !telco.getState().initialized
  }

  /** Starts one scene remount and keeps the shared remote command serialized. */
  function reloadScene(): void {
    if (disposed || inFlight) return
    inFlight = true
    syncReloadButton()
    options.onLog('reload')
    void Promise.resolve()
      .then(invokeReload)
      .catch((error: unknown) => {
        options.onLog(`Rechargement de la scène impossible : ${error instanceof Error ? error.message : String(error)}`, 'error')
      })
      .finally(() => {
        inFlight = false
        syncReloadButton()
      })
  }

  reloadButton.addEventListener('click', reloadScene)
  const stopOnChange = telco.onChange(syncReloadButton)
  const stopOnProgress = telco.onProgress(syncReloadButton)
  syncReloadButton()

  return {
    element: remote.element,
    sync: () => {
      remote.sync()
      syncReloadButton()
    },
    destroy: () => {
      disposed = true
      stopOnChange()
      stopOnProgress()
      reloadButton.removeEventListener('click', reloadScene)
      reloadButton.remove()
      remote.destroy()
    },
  }
}
