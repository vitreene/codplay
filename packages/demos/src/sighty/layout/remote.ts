import type { SightyDemoLogger, SightyDemoTransport } from './types'

type SightyRemoteOptions = Readonly<{
  onLog: SightyDemoLogger
  enabled?: boolean
  onReset?: () => void | Promise<void>
}>

type RemoteCommand = 'play' | 'pause' | 'relaunch'

const REMOTE_ICON_PATHS: Readonly<Record<RemoteCommand, string>> = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  relaunch: 'M12 5a7 7 0 1 0 6.7 9h-2.1a5 5 0 1 1-1.1-5.4L13 10h7V3l-3.4 3.4A8.9 8.9 0 0 0 12 5z',
}

/** Creates the bottom page-level play/pause toggle shared by every Sighty demonstration. */
export function createSightyRemote(
  transport: SightyDemoTransport,
  options: SightyRemoteOptions,
): {
  element: HTMLElement
  setEnabled: (enabled: boolean) => void
  destroy: () => void
} {
  const element = document.createElement('div')
  element.className = 'sighty-remote'

  const button = createRemoteButton('pause', 'Pause')
  const resetButton = createRemoteButton('relaunch', 'Remise à zéro')
  element.append(button, resetButton)

  let enabled = options.enabled ?? true
  let inFlight = false
  let destroyed = false
  let playing = true

  /** Applies the current play/pause state and serialized-command state to the toggle. */
  function sync(): void {
    const command: RemoteCommand = playing ? 'pause' : 'play'
    const label = command === 'pause' ? 'Pause' : 'Lire'
    button.className = `sighty-remote__button sighty-remote__button--${command}`
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(playing))
    button.title = label
    button.querySelector('path')?.setAttribute('d', REMOTE_ICON_PATHS[command])
    button.disabled = destroyed || !enabled || inFlight
    resetButton.disabled = destroyed || !enabled || inFlight
  }

  /** Runs one page transport command and reports its result to the shared journal. */
  async function runCommand(command: RemoteCommand, label: string): Promise<void> {
    if (destroyed || !enabled || inFlight) return
    inFlight = true
    sync()
    options.onLog(label)
    try {
      if (command === 'relaunch' && options.onReset !== undefined) {
        await options.onReset()
      } else {
        await transport[command]()
      }
      playing = command === 'relaunch' || command === 'play'
    } catch (error) {
      if (destroyed) return
      options.onLog(
        `${label} impossible : ${error instanceof Error ? error.message : String(error)}`,
        'error',
      )
    } finally {
      inFlight = false
      sync()
    }
  }

  const toggleListener = (): void => {
    const command: RemoteCommand = playing ? 'pause' : 'play'
    void runCommand(command, command === 'pause' ? 'Pause' : 'Lire')
  }
  const resetListener = (): void => {
    void runCommand('relaunch', 'Remise à zéro')
  }
  button.addEventListener('click', toggleListener)
  resetButton.addEventListener('click', resetListener)
  sync()

  return {
    element,
    setEnabled(nextEnabled) {
      enabled = nextEnabled
      sync()
    },
    destroy() {
      destroyed = true
      sync()
      button.removeEventListener('click', toggleListener)
      resetButton.removeEventListener('click', resetListener)
      element.replaceChildren()
    },
  }
}

/** Creates one accessible icon button for the shared remote toggle. */
function createRemoteButton(
  command: RemoteCommand,
  label: string,
): HTMLButtonElement {
  const button = document.createElement('button')
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  button.type = 'button'
  button.className = `sighty-remote__button sighty-remote__button--${command}`
  button.setAttribute('aria-label', label)
  button.title = label
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('focusable', 'false')
  icon.classList.add('sighty-remote__icon')
  path.setAttribute('d', REMOTE_ICON_PATHS[command])
  icon.append(path)
  button.append(icon)
  return button
}
