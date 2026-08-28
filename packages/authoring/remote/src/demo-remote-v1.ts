import type { TelcoApi } from 'codplay-v1/telco/types'
import type { PlayerStateSnapshot, PlayerPublicEventInput } from 'codplay-v1/player/types'

export type DemoRemoteAction = {
  id: string
  label: string
  event: PlayerPublicEventInput
  className?: string
}

export type DemoRemoteConfig = {
  telco: TelcoApi
  seekMaxMsFromScene: number
  actions?: DemoRemoteAction[]
  emit?: (event: PlayerPublicEventInput) => Promise<unknown>
}

export function createDemoRemoteV1(config: DemoRemoteConfig): {
  element: HTMLElement
  sync: () => void
  destroy: () => void
} {
  const { telco, seekMaxMsFromScene } = config

  const SEEK_THROTTLE_MS = 90
  let pendingSeekTargetMs: number | null = null
  let activeSeekTargetMs: number | null = null
  let seekThrottleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let lastSeekDispatchMs = 0
  let seekInteractionActive = false
  let seekScaleLockMaxMs: number | null = null

  function mkEl<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
    const node = globalThis.document.createElement(tag)
    if (className !== undefined) node.className = className
    return node
  }

  function mkBtn(text: string, className: string): HTMLButtonElement {
    const btn = mkEl('button')
    btn.type = 'button'
    btn.className = className
    btn.textContent = text
    return btn
  }

  const root = mkEl('div')

  // Transport row
  const transportRow = mkEl('div', 'demo-controls')
  const playBtn = mkBtn('', 'demo-button')
  // Label lives in its own span, never reassigned onto the button's own
  // textContent — Safari's hit-testing on a live-reassigned text node
  // directly inside a <button> can miss clicks on the rendered word.
  const playBtnLabel = mkEl('span')
  playBtnLabel.textContent = 'Play'
  playBtn.appendChild(playBtnLabel)
  const rewindBtn = mkBtn('Rewind', 'demo-button demo-button-secondary')

  const seekWrapper = mkEl('label', 'demo-progress-control')
  const seekLegend = mkEl('span')
  seekLegend.textContent = 'Seek'
  const seekRange = mkEl('input', 'demo-progress-range')
  seekRange.type = 'range'
  seekRange.min = '0'
  seekRange.max = String(seekMaxMsFromScene)
  seekRange.step = '10'
  seekRange.value = '0'
  const seekLabel = mkEl('span', 'demo-progress-label')
  seekLabel.textContent = '0%'
  seekWrapper.append(seekLegend, seekRange, seekLabel)
  transportRow.append(playBtn, rewindBtn, seekWrapper)

  // Rate row
  type RateEntry = { node: HTMLButtonElement; rate: number }
  const rateRow = mkEl('div', 'demo-controls demo-rate-controls')
  const rateBtns: RateEntry[] = [
    { rate: 1, node: mkBtn('x1', 'demo-button demo-button-secondary') },
    { rate: 2, node: mkBtn('x2', 'demo-button demo-button-secondary') },
    { rate: 0.25, node: mkBtn('x1/4', 'demo-button demo-button-secondary') },
  ]
  for (const r of rateBtns) rateRow.appendChild(r.node)

  // Action buttons
  const actionBtns = new Map<string, HTMLButtonElement>()
  const actionsRow = (config.actions?.length ?? 0) > 0 ? mkEl('div', 'demo-controls demo-actions') : null
  for (const action of config.actions ?? []) {
    const btn = mkBtn(action.label, `demo-button ${action.className ?? 'demo-button-secondary'}`)
    btn.id = action.id
    actionsRow?.appendChild(btn)
    actionBtns.set(action.id, btn)
  }

  // Player state readout
  const stateEl = mkEl('div', 'player-state')

  root.append(transportRow, rateRow)
  if (actionsRow !== null) root.appendChild(actionsRow)
  root.appendChild(stateEl)

  // --- Logic ---

  function formatPct(ms: number, maxMs: number): string {
    if (maxMs <= 0) return '0%'
    return `${Math.max(0, Math.min(100, Math.round((ms / maxMs) * 100)))}%`
  }

  function readRangeMs(): number {
    const v = Number(seekRange.value)
    return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
  }

  function nowMs(): number {
    return typeof globalThis.performance !== 'undefined' ? globalThis.performance.now() : Date.now()
  }

  function syncRates(): void {
    const current = telco.rate
    for (const r of rateBtns) r.node.classList.toggle('demo-rate-active', r.rate === current)
  }

  /**
   * Assigns one DOM text/attribute value only when it actually changed, to
   * avoid needless per-frame DOM writes (observed to break Safari's
   * hit-testing on the play/pause button label when rewritten every frame).
   */
  function setIfChanged<T extends string | boolean>(currentValue: T, nextValue: T, apply: (value: T) => void): void {
    if (currentValue !== nextValue) apply(nextValue)
  }

  function resolveDisplayedMs(state: PlayerStateSnapshot): { displayMs: number; maxMs: number } {
    const maxMs = seekScaleLockMaxMs !== null ? seekScaleLockMaxMs : Math.round(state.horizon.progressEndMs)
    const clampedMs = Math.min(Math.max(0, Math.round(state.timelineMs)), maxMs)
    const interactMs = Math.min(readRangeMs(), maxMs)
    const seekTargetMs = activeSeekTargetMs ?? pendingSeekTargetMs
    const pendingMs = seekTargetMs === null ? null : Math.min(seekTargetMs, maxMs)
    const displayMs = seekInteractionActive ? interactMs : (pendingMs ?? clampedMs)
    return { displayMs, maxMs }
  }

  /**
   * Refreshes only what actually changes every frame during playback: the
   * seek range position, its label, and the state readout.
   */
  function syncProgress(state: PlayerStateSnapshot = telco.getState()): void {
    const { displayMs, maxMs } = resolveDisplayedMs(state)
    setIfChanged(seekRange.value, String(displayMs), (v) => { seekRange.value = v })
    seekLabel.textContent = formatPct(displayMs, maxMs)
    stateEl.textContent = `status=${state.status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`
  }

  function syncState(state: PlayerStateSnapshot = telco.getState()): void {
    const inFlight = telco.commandInFlight
    const { status, sequenceEnded, initialized } = state

    const canPlay = sequenceEnded || status === 'ready' || status === 'paused'
    const canPause = !sequenceEnded && status === 'playing'
    const canRewind =
      !sequenceEnded && initialized && (status === 'ready' || status === 'paused' || status === 'playing')
    const canSeek =
      !sequenceEnded && initialized && (status === 'paused' || status === 'playing' || status === 'seeking')

    const { displayMs, maxMs } = resolveDisplayedMs(state)

    setIfChanged(playBtn.disabled, inFlight || (!canPlay && !canPause), (v) => { playBtn.disabled = v })
    setIfChanged(playBtnLabel.textContent, canPause ? 'Pause' : 'Play', (v) => { playBtnLabel.textContent = v })
    setIfChanged(rewindBtn.disabled, inFlight || !canRewind, (v) => { rewindBtn.disabled = v })
    setIfChanged(seekRange.disabled, !canSeek, (v) => { seekRange.disabled = v })
    setIfChanged(seekRange.max, String(maxMs), (v) => { seekRange.max = v })
    setIfChanged(seekRange.value, String(displayMs), (v) => { seekRange.value = v })
    seekLabel.textContent = formatPct(displayMs, maxMs)
    stateEl.textContent = `status=${status} timelineMs=${Math.round(state.timelineMs)} revision=${state.runtimeRevision}`

    for (const action of config.actions ?? []) {
      const btn = actionBtns.get(action.id)
      if (btn !== undefined) btn.disabled = inFlight || !initialized
    }

    syncRates()
  }

  async function runSeekFlow(targetMs: number): Promise<void> {
    if (telco.getState().status === 'playing') {
      syncState()
      await telco.pause()
    }
    syncState()
    await telco.seek(targetMs)
  }

  function flushPendingSeek(): void {
    if (telco.commandInFlight || pendingSeekTargetMs === null) return

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

  function scheduleSeek(): void {
    if (pendingSeekTargetMs === null || seekThrottleTimer !== null) return
    const wait = Math.max(0, SEEK_THROTTLE_MS - (nowMs() - lastSeekDispatchMs))
    seekThrottleTimer = globalThis.setTimeout(() => {
      seekThrottleTimer = null
      flushPendingSeek()
    }, wait)
  }

  // Play / Pause
  playBtn.addEventListener('click', () => {
    const state = telco.getState()
    void (state.status === 'playing' ? telco.pause() : telco.play()).finally(() => syncState())
    syncState()
  })

  // Rewind
  rewindBtn.addEventListener('click', () => {
    void telco.rewind().finally(() => syncState())
    syncState()
  })

  // Seek
  seekRange.addEventListener('pointerdown', () => {
    seekInteractionActive = true
    if (telco.getState().status === 'playing' && !telco.commandInFlight) {
      seekScaleLockMaxMs = Number(seekRange.max)
      void telco.pause().finally(() => syncState())
      syncState()
    }
  })

  seekRange.addEventListener('input', () => {
    if (telco.getState().status === 'playing' || telco.commandInFlight) return
    seekInteractionActive = true
    const targetMs = readRangeMs()
    pendingSeekTargetMs = targetMs
    const maxMs = Number(seekRange.max)
    seekLabel.textContent = formatPct(targetMs, Number.isFinite(maxMs) ? maxMs : seekMaxMsFromScene)
    scheduleSeek()
  })

  seekRange.addEventListener('change', () => {
    seekInteractionActive = false
    seekScaleLockMaxMs = null
    if (telco.getState().status === 'playing' || telco.commandInFlight) {
      syncState()
      return
    }
    pendingSeekTargetMs = readRangeMs()
    if (seekThrottleTimer !== null) {
      globalThis.clearTimeout(seekThrottleTimer)
      seekThrottleTimer = null
    }
    flushPendingSeek()
  })

  const clearSeekInteraction = (): void => {
    seekInteractionActive = false
    seekScaleLockMaxMs = null
    syncState()
  }
  seekRange.addEventListener('pointerup', clearSeekInteraction)
  seekRange.addEventListener('pointercancel', clearSeekInteraction)
  seekRange.addEventListener('blur', clearSeekInteraction)

  // Rates
  for (const r of rateBtns) {
    r.node.addEventListener('click', () => {
      telco.setRate(r.rate)
      syncRates()
    })
  }

  // Actions
  const emitFn = config.emit
  if (emitFn !== undefined) {
    for (const action of config.actions ?? []) {
      const btn = actionBtns.get(action.id)
      if (btn !== undefined) {
        btn.addEventListener('click', () => {
          void emitFn(action.event).finally(() => syncState())
          syncState()
        })
      }
    }
  }

  const stopOnChange = telco.onChange((state) => syncState(state))
  const stopOnProgress = telco.onProgress((state) => syncProgress(state))

  syncRates()

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
