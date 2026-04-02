import type { RebuildMode } from '../player/types'
import type { LocalTelcoApi, LocalTelcoCommandResult } from './types'

export type CreateLocalTelcoPanelInput = {
  telco: LocalTelcoApi
  mountTarget: HTMLElement
  title?: string
}

export type LocalTelcoPanelHandle = {
  destroy: () => void
}

/**
 * Creates one button element used by the telco panel.
 */
function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = globalThis.document.createElement('button')
  button.type = 'button'
  button.className = 'telco-btn'
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

/**
 * Formats one command result line for telco logs.
 */
function formatCommandResult(result: LocalTelcoCommandResult): string {
  if (result.ok) {
    return `${result.requestId} ${result.commandName} ok state=${result.playerState.status} t=${result.playerState.timelineMs}`
  }

  return `${result.requestId} ${result.commandName} error=${result.error?.code ?? 'UNKNOWN'} state=${result.playerState.status}`
}

/**
 * Creates one local telco control panel mounted on current page.
 */
export function createLocalTelcoPanel(input: CreateLocalTelcoPanelInput): LocalTelcoPanelHandle {
  const root = globalThis.document.createElement('section')
  root.className = 'telco-panel'

  const heading = globalThis.document.createElement('h2')
  heading.className = 'telco-title'
  heading.textContent = input.title ?? 'Local Telco'

  const stateRow = globalThis.document.createElement('p')
  stateRow.className = 'telco-state'

  const controls = globalThis.document.createElement('div')
  controls.className = 'telco-controls'

  const seekInput = globalThis.document.createElement('input')
  seekInput.type = 'number'
  seekInput.className = 'telco-input'
  seekInput.value = '1200'
  seekInput.min = '0'
  seekInput.step = '10'

  const rebuildModeSelect = globalThis.document.createElement('select')
  rebuildModeSelect.className = 'telco-select'
  for (const mode of ['state', 'full'] as RebuildMode[]) {
    const option = globalThis.document.createElement('option')
    option.value = mode
    option.textContent = mode
    rebuildModeSelect.append(option)
  }

  const resultLog = globalThis.document.createElement('pre')
  resultLog.className = 'telco-log'

  const history: string[] = []

  /**
   * Refreshes state summary and command history in panel UI.
   */
  function render(): void {
    const snapshot = input.telco.getState()
    stateRow.textContent = `status=${snapshot.status} timelineMs=${snapshot.timelineMs} revision=${snapshot.runtimeRevision}`
    resultLog.textContent = history.join('\n')
  }

  /**
   * Dispatches one telco command and records its outcome.
   */
  async function runCommand(commandPromise: Promise<LocalTelcoCommandResult>): Promise<void> {
    const result = await commandPromise
    history.unshift(formatCommandResult(result))
    if (history.length > 10) {
      history.length = 10
    }

    render()
  }

  controls.append(
    createButton('Play', () => {
      void runCommand(input.telco.dispatch({ name: 'play' }))
    }),
    createButton('Pause', () => {
      void runCommand(input.telco.dispatch({ name: 'pause' }))
    }),
    createButton('Rewind', () => {
      void runCommand(input.telco.dispatch({ name: 'rewind' }))
    }),
    createButton('Seek', () => {
      const targetTimelineMs = Number(seekInput.value)
      void runCommand(
        input.telco.dispatch({
          name: 'seek',
          payload: {
            targetTimelineMs
          }
        })
      )
    }),
    seekInput,
    createButton('Rebuild', () => {
      const mode = rebuildModeSelect.value as RebuildMode
      void runCommand(
        input.telco.dispatch({
          name: 'rebuild',
          payload: {
            mode
          }
        })
      )
    }),
    rebuildModeSelect,
    createButton('Destroy', () => {
      void runCommand(input.telco.dispatch({ name: 'destroy' }))
    })
  )

  root.append(heading, stateRow, controls, resultLog)
  input.mountTarget.append(root)

  const unsubscribeState = input.telco.onStateChange(() => {
    render()
  })

  render()

  return {
    destroy: () => {
      unsubscribeState()
      root.remove()
    }
  }
}
