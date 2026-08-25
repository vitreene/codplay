import type { RuntimeTelco, RuntimeTelcoState } from '../../src/runtime/telco'

/** Configuration of the validation remote attached to one local telco. */
export type TelcoRemoteOptions = Readonly<{
  telco: RuntimeTelco
  durationMs: number
  onInfo?: (message: string) => void
  onError?: (message: string) => void
}>

/** Remote control returned by the validation demo. */
export type TelcoRemote = Readonly<{
  element: HTMLElement
  sync: () => void
  destroy: () => void
}>

type TelcoIconName = 'play' | 'pause' | 'rewind'

const TELCO_ICON_PATHS: Readonly<Record<TelcoIconName, string>> = {
  play: 'M8 5v14l11-7L8 5z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  rewind: 'M11 5 3 12l8 7V5zm10 0-8 7 8 7V5z',
}

/** Creates the single V2 validation remote around the RuntimeTelco facade. */
export function createTelcoRemote(options: TelcoRemoteOptions): TelcoRemote {
  const { telco, durationMs, onInfo, onError } = options
  const seekThrottleMs = 90
  let pendingSeekTargetMs: number | null = null
  let activeSeekTargetMs: number | null = null
  let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let lastSeekDispatchMs = 0
  let seekInteractionActive = false
  let seekReleaseHandled = false
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

  /** Creates one accessible SVG icon without adding a second control path. */
  function createIcon(name: TelcoIconName): SVGSVGElement {
    const icon = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'path')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('aria-hidden', 'true')
    icon.setAttribute('focusable', 'false')
    icon.classList.add('telco-button__icon')
    icon.setAttribute('data-icon', name)
    path.setAttribute('d', TELCO_ICON_PATHS[name])
    icon.appendChild(path)
    return icon
  }

  /** Creates an icon button with a visually hidden, accessible text label. */
  function createIconButton(
    name: TelcoIconName,
    label: string,
    className: string,
  ): { button: HTMLButtonElement; icon: SVGSVGElement; label: HTMLSpanElement } {
    const button = createButton('', className)
    const icon = createIcon(name)
    const labelNode = createElement('span', 'telco-button__label')
    labelNode.textContent = label
    button.setAttribute('aria-label', label)
    button.title = label
    button.append(icon, labelNode)
    return { button, icon, label: labelNode }
  }

  const root = createElement('div', 'telco-remote')
  const transportRow = createElement('div', 'telco-remote__transport')
  const playControl = createIconButton('play', 'Lire', 'telco-button telco-button--transport')
  const playButton = playControl.button
  const playButtonIcon = playControl.icon
  const playButtonLabel = playControl.label
  const rewindControl = createIconButton(
    'rewind',
    'Revenir au début',
    'telco-button telco-button--secondary telco-button--transport',
  )
  const rewindButton = rewindControl.button
  const seekWrapper = createElement('label', 'telco-remote__seek')
  const seekTitle = createElement('span')
  const seekRange = createElement('input')
  const seekValue = createElement('output')
  const rateRow = createElement('div', 'telco-remote__rates')
  const rateButtons = [1, 2, 0.25].map((rate) => ({
    rate,
    button: createButton(formatRate(rate), 'telco-button telco-button--secondary'),
  }))
  const stateOutput = createElement('output', 'telco-remote__state')

  seekTitle.textContent = 'Temps'
  seekRange.type = 'range'
  seekRange.min = '0'
  seekRange.max = String(durationMs)
  seekRange.step = '10'
  seekRange.value = '0'
  seekValue.textContent = '0 ms'
  seekWrapper.append(seekTitle, seekRange, seekValue)
  transportRow.append(playButton, rewindButton, seekWrapper)
  for (const entry of rateButtons) rateRow.append(entry.button)
  root.append(transportRow, rateRow, stateOutput)

  /** Converts one timeline value into the displayed percentage. */
  function formatProgress(timeMs: number, maxMs: number): string {
    if (maxMs <= 0) return '0%'
    return `${Math.max(0, Math.min(100, Math.round(timeMs / maxMs * 100)))}%`
  }

  /** Formats the compact rate labels displayed by the transport remote. */
  function formatRate(rate: number): string {
    return `×${rate}`
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

  /** Refreshes command availability from the V2 transport snapshot. */
  function syncState(state: RuntimeTelcoState = telco.getState()): void {
    const inFlight = telco.commandInFlight
    const { status, sequenceEnded, initialized } = state
    const canPlay = initialized && (sequenceEnded || status === 'ready' || status === 'paused')
    const canPause = status === 'playing'
    const canRewind = initialized && (status === 'ready' || status === 'paused' || status === 'playing')
    const canSeek = initialized
      && !sequenceEnded
      && (status === 'ready' || status === 'paused' || status === 'playing')
    const { displayMs, maxMs } = resolveDisplayedMs(state)

    setIfChanged(playButton.disabled, inFlight || (!canPlay && !canPause), (value) => { playButton.disabled = value })
    const playLabel = canPause ? 'Pause' : 'Lire'
    const playIcon = canPause ? 'pause' : 'play'
    if (playButtonIcon.getAttribute('data-icon') !== playIcon) {
      const iconPath = playButtonIcon.firstElementChild
      if (iconPath !== null) iconPath.setAttribute('d', TELCO_ICON_PATHS[playIcon])
      playButtonIcon.setAttribute('data-icon', playIcon)
    }
    setIfChanged(playButtonLabel.textContent ?? '', playLabel, (value) => { playButtonLabel.textContent = value })
    setIfChanged(playButton.getAttribute('aria-label') ?? '', playLabel, (value) => { playButton.setAttribute('aria-label', value) })
    setIfChanged(playButton.title, playLabel, (value) => { playButton.title = value })
    setIfChanged(rewindButton.disabled, inFlight || !canRewind, (value) => { rewindButton.disabled = value })
    // Keep the range enabled while pause/seek is being serialized. Disabling
    // it during pointerdown aborts the native drag before its final input.
    setIfChanged(seekRange.disabled, !canSeek, (value) => { seekRange.disabled = value })
    setIfChanged(seekRange.max, String(maxMs), (value) => { seekRange.max = value })
    setIfChanged(seekRange.value, String(displayMs), (value) => { seekRange.value = value })
    seekValue.textContent = `${displayMs} ms · ${formatProgress(displayMs, maxMs)}`
    stateOutput.textContent = `état=${status} · temps=${Math.round(state.timelineMs)} ms · révision=${state.runtimeRevision}`
    for (const entry of rateButtons) {
      entry.button.classList.toggle('telco-button--active', entry.rate === state.rate)
      setIfChanged(entry.button.disabled, inFlight || !initialized, (value) => { entry.button.disabled = value })
    }

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
    if (seekReleaseHandled) {
      syncState()
      return
    }
    seekReleaseHandled = true
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
    const wasPlaying = telco.getState().status === 'playing'
    const command = telco.togglePlay()
    onInfo?.(wasPlaying ? 'pause' : 'play')
    void command.then(reportCommandError).finally(() => syncState())
    syncState()
  })

  rewindButton.addEventListener('click', () => {
    void telco.rewind().then(reportCommandError).finally(() => syncState())
    syncState()
  })

  seekRange.addEventListener('pointerdown', () => {
    seekInteractionActive = true
    seekReleaseHandled = false
    if (telco.getState().status === 'playing' && !telco.commandInFlight) {
      seekScaleLockMaxMs = Number(seekRange.max)
      void telco.pause().then(reportCommandError).finally(() => syncState())
      syncState()
    }
  })

  seekRange.addEventListener('input', () => {
    seekInteractionActive = true
    seekReleaseHandled = false
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

  for (const entry of rateButtons) {
    entry.button.addEventListener('click', () => {
      try {
        telco.setRate(entry.rate)
        onInfo?.(`rate=${entry.rate}`)
        syncState(telco.getState())
      } catch (error) {
        onError?.(error instanceof Error ? error.message : String(error))
        syncState(telco.getState())
      }
    })
  }

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
