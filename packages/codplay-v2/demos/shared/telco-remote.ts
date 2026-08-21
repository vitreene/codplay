import type { RuntimeTelco, RuntimeTelcoState } from '../../src/runtime/telco'

/** Configuration of the validation remote attached to one local telco. */
export type TelcoRemoteOptions = Readonly<{
  telco: RuntimeTelco
  durationMs: number
  onError?: (message: string) => void
}>

/** Remote control returned by the validation demo. */
export type TelcoRemote = Readonly<{
  element: HTMLElement
  sync: () => void
  destroy: () => void
}>

/** [temp: validation] Creates the V2 adaptation of the existing CodPlay transport remote. */
export function createTelcoRemote(options: TelcoRemoteOptions): TelcoRemote {
  const { telco, durationMs, onError } = options
  const seekThrottleMs = 90
  let pendingSeekTargetMs: number | null = null
  let activeSeekTargetMs: number | null = null
  let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let lastSeekDispatchMs = 0
  let seekInteractionActive = false
  let seekScaleLockMaxMs: number | null = null

  /** Creates one typed element for the remote without injecting markup strings. */
  function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
  ): HTMLElementTagNameMap[K] {
    const element = globalThis.document.createElement(tag)
    if (className !== undefined) element.className = className
    return element
  }

  /** Creates one remote button with an explicit non-submit type. */
  function createButton(label: string, className: string): HTMLButtonElement {
    const button = createElement('button', className)
    button.type = 'button'
    button.textContent = label
    return button
  }

  const root = createElement('div', 'telco-remote')
  const transportRow = createElement('div', 'telco-remote__transport')
  const playButton = createButton('', 'telco-button')
  const playButtonLabel = createElement('span')
  const rewindButton = createButton('Revenir au début', 'telco-button telco-button--secondary')
  const seekWrapper = createElement('label', 'telco-remote__seek')
  const seekTitle = createElement('span')
  const seekRange = createElement('input')
  const seekValue = createElement('output')
  const stateOutput = createElement('output', 'telco-remote__state')

  playButtonLabel.textContent = 'Lire'
  playButton.appendChild(playButtonLabel)
  seekTitle.textContent = 'Temps'
  seekRange.type = 'range'
  seekRange.min = '0'
  seekRange.max = String(durationMs)
  seekRange.step = '10'
  seekRange.value = '0'
  seekValue.textContent = '0 ms'
  seekWrapper.append(seekTitle, seekRange, seekValue)
  transportRow.append(playButton, rewindButton, seekWrapper)
  root.append(transportRow, stateOutput)

  /** Converts one timeline value into the displayed percentage. */
  function formatProgress(timeMs: number, maxMs: number): string {
    if (maxMs <= 0) return '0%'
    return `${Math.max(0, Math.min(100, Math.round(timeMs / maxMs * 100)))}%`
  }

  /** Reads the current range value as a clamped timeline position. */
  function readSeekTarget(): number {
    const value = Number(seekRange.value)
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  }

  /** Writes one property only when its value actually changed. */
  function setIfChanged<T extends string | boolean>(
    current: T,
    next: T,
    apply: (value: T) => void,
  ): void {
    if (current !== next) apply(next)
  }

  /** Resolves the range value displayed during an active seek interaction. */
  function resolveDisplayedMs(state: RuntimeTelcoState): { displayMs: number; maxMs: number } {
    const maxMs = seekScaleLockMaxMs ?? Math.round(state.durationMs)
    const currentMs = Math.min(Math.max(0, Math.round(state.timelineMs)), maxMs)
    const interactionMs = Math.min(readSeekTarget(), maxMs)
    const targetMs = activeSeekTargetMs ?? pendingSeekTargetMs
    const pendingMs = targetMs === null ? null : Math.min(targetMs, maxMs)
    const displayMs = seekInteractionActive ? interactionMs : (pendingMs ?? currentMs)
    return { displayMs, maxMs }
  }

  /** Refreshes progress without changing the transport state. */
  function syncProgress(state: RuntimeTelcoState = telco.getState()): void {
    const { displayMs, maxMs } = resolveDisplayedMs(state)
    setIfChanged(seekRange.value, String(displayMs), (value) => { seekRange.value = value })
    seekValue.textContent = `${displayMs} ms · ${formatProgress(displayMs, maxMs)}`
    stateOutput.textContent = `état=${state.status} · temps=${Math.round(state.timelineMs)} ms · révision=${state.runtimeRevision}`
  }

  /** Refreshes command availability using the same state model as the V1 remote. */
  function syncState(state: RuntimeTelcoState = telco.getState()): void {
    const inFlight = telco.commandInFlight
    const { status, sequenceEnded, initialized } = state
    const canPlay = initialized && (sequenceEnded || status === 'ready' || status === 'paused')
    const canPause = status === 'playing'
    const canRewind = initialized && (status === 'ready' || status === 'paused' || status === 'playing')
    const canSeek = initialized
      && !sequenceEnded
      && (status === 'paused' || status === 'playing')
    const { displayMs, maxMs } = resolveDisplayedMs(state)

    setIfChanged(playButton.disabled, inFlight || (!canPlay && !canPause), (value) => { playButton.disabled = value })
    setIfChanged(playButtonLabel.textContent, canPause ? 'Pause' : 'Lire', (value) => { playButtonLabel.textContent = value })
    setIfChanged(rewindButton.disabled, inFlight || !canRewind, (value) => { rewindButton.disabled = value })
    // Keep the range enabled while pause/seek is being serialized. Disabling
    // it during pointerdown aborts the native drag before its final input.
    setIfChanged(seekRange.disabled, !canSeek, (value) => { seekRange.disabled = value })
    setIfChanged(seekRange.max, String(maxMs), (value) => { seekRange.max = value })
    setIfChanged(seekRange.value, String(displayMs), (value) => { seekRange.value = value })
    seekValue.textContent = `${displayMs} ms · ${formatProgress(displayMs, maxMs)}`
    stateOutput.textContent = `état=${status} · temps=${Math.round(state.timelineMs)} ms · révision=${state.runtimeRevision}`

    if (pendingSeekTargetMs !== null && !inFlight) scheduleSeek()
  }

  /** Reads a monotonic browser time for seek throttling. */
  function nowMs(): number {
    return typeof globalThis.performance === 'undefined' ? Date.now() : globalThis.performance.now()
  }

  /** Reports a rejected command without creating a second control circuit. */
  function reportCommandError(result: Readonly<{ ok: boolean; error?: Readonly<{ message: string }> }>): void {
    if (result.ok) return
    onError?.(result.error?.message ?? 'La commande telco a été refusée.')
  }

  /** Pauses before seeking, as required by the established remote interaction. */
  async function runSeekFlow(targetMs: number): Promise<void> {
    if (telco.getState().status === 'playing') {
      syncState()
      const paused = await telco.pause()
      reportCommandError(paused)
      if (!paused.ok) return
    }
    syncState()
    const seekResult = await telco.seek(targetMs)
    reportCommandError(seekResult)
  }

  /** Dispatches the last requested range position when no command is running. */
  function flushPendingSeek(): void {
    if (pendingSeekTargetMs === null) return
    if (telco.commandInFlight) {
      if (seekThrottleTimer === null) {
        seekThrottleTimer = globalThis.setTimeout(() => {
          seekThrottleTimer = null
          flushPendingSeek()
        }, 16)
      }
      return
    }

    const targetMs = pendingSeekTargetMs
    pendingSeekTargetMs = null
    activeSeekTargetMs = targetMs
    lastSeekDispatchMs = nowMs()

    void runSeekFlow(targetMs).finally(() => {
      activeSeekTargetMs = null
      syncState()
      if (pendingSeekTargetMs !== null) scheduleSeek()
    })
  }

  /** Schedules one throttled seek command during range interaction. */
  function scheduleSeek(): void {
    if (pendingSeekTargetMs === null || seekThrottleTimer !== null) return
    const wait = Math.max(0, seekThrottleMs - (nowMs() - lastSeekDispatchMs))
    seekThrottleTimer = globalThis.setTimeout(() => {
      seekThrottleTimer = null
      flushPendingSeek()
    }, wait)
  }

  /** Ends range interaction and sends its final position immediately. */
  function clearSeekInteraction(): void {
    pendingSeekTargetMs = readSeekTarget()
    seekInteractionActive = false
    seekScaleLockMaxMs = null
    if (seekThrottleTimer !== null) {
      globalThis.clearTimeout(seekThrottleTimer)
      seekThrottleTimer = null
    }
    flushPendingSeek()
  }

  playButton.addEventListener('click', () => {
    const stateBefore = telco.getState()
    const commandName = stateBefore.status === 'playing' ? 'pause' : 'play'
    const command = commandName === 'pause' ? telco.pause() : telco.play()
    void command.then(reportCommandError).finally(() => syncState())
    syncState()
  })

  rewindButton.addEventListener('click', () => {
    void telco.rewind().then(reportCommandError).finally(() => syncState())
    syncState()
  })

  seekRange.addEventListener('pointerdown', () => {
    seekInteractionActive = true
    if (telco.getState().status === 'playing' && !telco.commandInFlight) {
      seekScaleLockMaxMs = Number(seekRange.max)
      void telco.pause().then(reportCommandError).finally(() => syncState())
      syncState()
    }
  })

  seekRange.addEventListener('input', () => {
    seekInteractionActive = true
    pendingSeekTargetMs = readSeekTarget()
    const maxMs = Number(seekRange.max)
    seekValue.textContent = `${pendingSeekTargetMs} ms · ${formatProgress(pendingSeekTargetMs, Number.isFinite(maxMs) ? maxMs : durationMs)}`
    scheduleSeek()
  })

  seekRange.addEventListener('change', () => {
    clearSeekInteraction()
  })
  seekRange.addEventListener('pointerup', clearSeekInteraction)
  seekRange.addEventListener('pointercancel', clearSeekInteraction)
  seekRange.addEventListener('lostpointercapture', clearSeekInteraction)
  seekRange.addEventListener('blur', clearSeekInteraction)

  const stopOnChange = telco.onChange((state) => syncState(state))
  const stopOnProgress = telco.onProgress((state) => syncProgress(state))
  syncState()

  return {
    element: root,
    sync: () => syncState(),
    destroy: () => {
      stopOnChange()
      stopOnProgress()
      if (seekThrottleTimer !== null) globalThis.clearTimeout(seekThrottleTimer)
    },
  }
}
