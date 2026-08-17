import { createHtmlDomProjection, HtmlFlipRuntime } from '../../../../codplay-v2/src/runtime/flip'
import type { FlipCapture, HtmlPose } from '../../../../codplay-v2/src/runtime/flip'

import './style.css'

type ListId = 'demo-stage-list' | 'demo-list'
type TimelineEventKind = 'add' | 'to-first' | 'return-origin'

type TimelineEvent = Readonly<{
  timeMs: number
  itemId: string
  kind: TimelineEventKind
}>

const HOST_ID = 'player-poc-flip-v2'
const DEBUG_SEEK_TIME_MS = 7233
const MOVE_DURATION_MS = 320
const TIMELINE_END_MS = 10_000
const ITEM_IDS = ['demo-item-1', 'demo-item-2', 'demo-item-3', 'demo-item-4', 'demo-item-5'] as const
const ITEM_LABELS: Record<string, string> = {
  'demo-item-1': 'ITEM 1',
  'demo-item-2': 'ITEM 2',
  'demo-item-3': 'ITEM 3',
  'demo-item-4': 'ITEM 4',
  'demo-item-5': 'ITEM 5',
}
const ITEM_COLORS: Record<string, string> = {
  'demo-item-1': '#f25f5c',
  'demo-item-2': '#f7b267',
  'demo-item-3': '#70c1b3',
  'demo-item-4': '#247ba0',
  'demo-item-5': '#b388eb',
}
const ITEM_TRANSFORMS: Record<string, string> = {
  'demo-item-1': 'rotate(-4deg) scale(0.98)',
  'demo-item-2': 'rotate(3deg) scale(1.01)',
  'demo-item-3': 'rotate(-2deg) scale(0.99)',
  'demo-item-4': 'rotate(2deg) scale(1.02)',
  'demo-item-5': 'rotate(-3deg) scale(1)',
}
const TIMELINE_EVENTS: readonly TimelineEvent[] = [
  { timeMs: 1000, itemId: 'demo-item-1', kind: 'add' },
  { timeMs: 2000, itemId: 'demo-item-2', kind: 'add' },
  { timeMs: 3000, itemId: 'demo-item-3', kind: 'add' },
  { timeMs: 4000, itemId: 'demo-item-4', kind: 'add' },
  { timeMs: 5000, itemId: 'demo-item-5', kind: 'add' },
  { timeMs: 6200, itemId: 'demo-item-3', kind: 'to-first' },
  { timeMs: 7200, itemId: 'demo-item-1', kind: 'return-origin' },
  { timeMs: 7600, itemId: 'demo-item-2', kind: 'return-origin' },
  { timeMs: 8000, itemId: 'demo-item-3', kind: 'return-origin' },
  { timeMs: 8400, itemId: 'demo-item-4', kind: 'return-origin' },
  { timeMs: 8800, itemId: 'demo-item-5', kind: 'return-origin' },
]

const FLIP_DEBUG = true

/** Emits bounded diagnostic snapshots for one Player POC FLIP transition. */
function logFlip(label: string, payload: unknown): void {
  if (FLIP_DEBUG) console.log(`[flip-v2] ${label} ${JSON.stringify(payload)}`)
}

/** Keeps only geometry and matrix fields useful for diagnosing an offset. */
function describePose(pose: HtmlPose): Record<string, unknown> {
  return {
    rect: { ...pose.rect },
    matrix: { ...pose.matrix },
    parentMatrix: { ...pose.parentMatrix },
    localWidth: pose.localWidth,
    localHeight: pose.localHeight,
  }
}

/** Mounts the Player POC visual reference on the V2 FLIP timeline runtime. */
function mountPlayerPocDemo(container: HTMLElement): void {
  logFlip('demo-loaded', { version: 'flip-v2-debug-7233' })
  container.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">Runtime V2</p>
        <h1>Player POC</h1>
        <p class="subtitle">Cas dur : inserts, puis retour de tous les items vers l'origine ; la list cible dérive et tourne.</p>
        <div class="demo-controls">
          <button id="poc-play" class="demo-button" type="button">Play</button>
          <button id="poc-reset" class="demo-button demo-button-secondary" type="button">Reset</button>
          <button id="poc-debug-seek" class="demo-button demo-button-secondary" type="button">Debug 7233ms</button>
        </div>
        <label class="demo-progress-control" for="poc-seek">
          Seek
          <input id="poc-seek" class="demo-progress-range" type="range" min="0" max="${TIMELINE_END_MS}" value="0" step="1" />
          <output id="poc-seek-label" class="demo-progress-label">0ms</output>
        </label>
        <div id="poc-status" class="player-state">Prêt. Lancez la timeline.</div>
        <div id="poc-debug" class="player-state"></div>
      </aside>
      <div class="container" id="demo-container">
        <div class="poc-stage" id="poc-stage">
          <section class="demo-card demo-list-main" id="demo-list"></section>
          <section class="demo-card demo-stage-list" id="demo-stage-list"></section>
          <section id="demo-trash-list" hidden></section>
        </div>
      </div>
    </main>
  `

  const stage = container.querySelector<HTMLElement>('#poc-stage')!
  const mainList = container.querySelector<HTMLElement>('#demo-list')!
  const stageList = container.querySelector<HTMLElement>('#demo-stage-list')!
  const status = container.querySelector<HTMLDivElement>('#poc-status')!
  const debug = container.querySelector<HTMLDivElement>('#poc-debug')!
  const seek = container.querySelector<HTMLInputElement>('#poc-seek')!
  const seekLabel = container.querySelector<HTMLOutputElement>('#poc-seek-label')!
  const play = container.querySelector<HTMLButtonElement>('#poc-play')!
  const reset = container.querySelector<HTMLButtonElement>('#poc-reset')!
  const debugSeek = container.querySelector<HTMLButtonElement>('#poc-debug-seek')!
  const nodes = new Map<string, HTMLElement>([
    ['demo-list', mainList],
    ['demo-stage-list', stageList],
  ])
  let projectionEpoch = 1
  let frameHandle: number | undefined
  let activeCapture: FlipCapture | undefined
  let renderedEventIndex = -1

  /** Creates one Player POC item with its authored transform. */
  function createItem(itemId: string): HTMLElement {
    const node = document.createElement('div')
    node.className = 'demo-list-item'
    node.dataset.itemId = itemId
    node.textContent = ITEM_LABELS[itemId] ?? itemId
    node.style.backgroundColor = ITEM_COLORS[itemId] ?? '#475569'
    node.style.transform = ITEM_TRANSFORMS[itemId] ?? 'none'
    node.style.transformOrigin = 'center'
    nodes.set(itemId, node)
    return node
  }

  for (const itemId of ITEM_IDS) createItem(itemId)

  /** Returns the logical list arrays after a prefix of the timeline. */
  function placementAt(eventIndex: number): { stage: string[]; main: string[] } {
    const stageItems = [...ITEM_IDS]
    const mainItems: string[] = []
    for (let index = 0; index <= eventIndex; index += 1) {
      const event = TIMELINE_EVENTS[index]
      if (event === undefined) continue
      const source = event.kind === 'return-origin' ? mainItems : stageItems
      const sourceIndex = source.indexOf(event.itemId)
      if (sourceIndex >= 0) source.splice(sourceIndex, 1)
      if (event.kind === 'return-origin') stageItems.push(event.itemId)
      else if (event.kind === 'to-first') mainItems.unshift(event.itemId)
      else mainItems.push(event.itemId)
    }
    return { stage: stageItems, main: mainItems }
  }

  /** Renders the logical parentage for one timeline event prefix. */
  function renderPlacement(eventIndex: number): void {
    const placement = placementAt(eventIndex)
    for (const itemId of placement.stage) stageList.appendChild(nodes.get(itemId)!)
    for (const itemId of placement.main) mainList.appendChild(nodes.get(itemId)!)
  }

  /** Applies the continuous parent drift declared by the Player POC scene. */
  function applyListDrift(timeMs: number): void {
    const progress = Math.max(0, Math.min(1, timeMs / 12_000))
    mainList.style.transform = `translate(${130 * progress}px, ${-35 * progress}px) rotate(${24 + 16 * progress}deg) scale(0.77)`
    stageList.style.transform = `translate(${-95 * progress}px, ${28 * progress}px) rotate(${-10 + 16 * progress}deg) scale(1.1)`
  }

  /** Returns the last move event whose capture window may be active. */
  function activeEventAt(timeMs: number): { event: TimelineEvent; index: number } | undefined {
    for (let index = TIMELINE_EVENTS.length - 1; index >= 0; index -= 1) {
      const event = TIMELINE_EVENTS[index]!
      if (timeMs >= event.timeMs && timeMs <= event.timeMs + MOVE_DURATION_MS) return { event, index }
    }
    return undefined
  }

  const projection = createHtmlDomProjection({
    hostContextId: HOST_ID,
    getProjectionEpoch: () => projectionEpoch,
    root: stage,
    resolveHandle: (itemId) => nodes.get(itemId),
    debug: logFlip,
  })
  const runtime = new HtmlFlipRuntime(projection)

  /** Captures every Player POC move from its exact before and after DOM states. */
  function buildCaptures(): readonly FlipCapture[] {
    const captures: FlipCapture[] = []
    renderPlacement(-1)
    applyListDrift(0)
    for (const [index, event] of TIMELINE_EVENTS.entries()) {
      renderPlacement(index - 1)
      applyListDrift(event.timeMs)
      const captureResult = runtime.capture({
        captureId: `${HOST_ID}-${event.itemId}-${event.timeMs}`,
        hostContextId: HOST_ID,
        projectionEpoch,
        startAt: event.timeMs,
        duration: MOVE_DURATION_MS,
        easing: 'out(2)',
        entries: ITEM_IDS.map((itemId) => ({
          itemId,
          ancestorIds: event.kind !== 'to-first' && itemId === event.itemId
            ? []
            : [placementAt(index).main.includes(itemId) ? 'demo-list' : 'demo-stage-list'],
          mode: event.kind !== 'to-first' && itemId === event.itemId ? 'overlay-world' as const : 'local' as const,
        })),
        ancestors: [
          { ancestorId: 'demo-stage-list', regime: 'composited' as const },
          { ancestorId: 'demo-list', regime: 'composited' as const },
        ],
        mutate: () => {
          renderPlacement(index)
          applyListDrift(event.timeMs + MOVE_DURATION_MS)
        },
      })
      if (!captureResult.ok) {
        const message = captureResult.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n')
        logFlip('capture-error', { captureId: `${HOST_ID}-${event.itemId}-${event.timeMs}`, message })
        throw new Error(message)
      }
      const rawCapture = captureResult.value
      logFlip('capture-first-last', {
        captureId: rawCapture.captureId,
        event,
        first: rawCapture.entries.map((entry) => ({ itemId: entry.itemId, mode: entry.mode, pose: describePose(entry.from) })),
        last: rawCapture.entries.map((entry) => ({ itemId: entry.itemId, mode: entry.mode, pose: describePose(entry.to) })),
        ancestors: rawCapture.ancestors.map((ancestor) => ({
          ancestorId: ancestor.ancestorId,
          from: describePose(ancestor.from),
          to: describePose(ancestor.to),
        })),
      })
      applyListDrift(event.timeMs)
      captures.push(rawCapture)
    }
    renderPlacement(-1)
    applyListDrift(0)
    return captures
  }

  let captures = buildCaptures()

  /** Stops the RAF clock and removes current FLIP styles/overlays. */
  function clearPlayback(): void {
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle)
    frameHandle = undefined
    play.textContent = 'Play'
    runtime.cancel()
    activeCapture = undefined
  }

  /** Resolves the timeline directly and applies one active V2 capture if needed. */
  function seekTimeline(timeMs: number): void {
    const boundedTime = Math.max(0, Math.min(TIMELINE_END_MS, timeMs))
    const active = activeEventAt(boundedTime)
    const eventIndex = TIMELINE_EVENTS.findLastIndex((event) => event.timeMs <= boundedTime)
    if (eventIndex !== renderedEventIndex) {
      runtime.cancel()
      renderPlacement(eventIndex)
      renderedEventIndex = eventIndex
    }
    applyListDrift(boundedTime)
    activeCapture = active === undefined ? undefined : captures[active.index]
    if (activeCapture !== undefined) {
      runtime.seek(activeCapture, boundedTime)
    }
    else {
      runtime.cancel()
    }
    seek.value = String(boundedTime)
    seekLabel.value = `${Math.round(boundedTime)}ms`
    status.textContent = active === undefined ? `Seek: ${Math.round(boundedTime)}ms` : `Seek: ${Math.round(boundedTime)}ms / ${active.event.itemId}`
  }

  /** Starts playback from the current seek position through the same seek path. */
  function playTimeline(): void {
    if (Number(seek.value) >= TIMELINE_END_MS) seekTimeline(0)
    play.textContent = 'Pause'
    const startTime = performance.now() - Number(seek.value)
    const frame = (now: number): void => {
      const timeMs = Math.min(TIMELINE_END_MS, now - startTime)
      seekTimeline(timeMs)
      if (timeMs < TIMELINE_END_MS) frameHandle = requestAnimationFrame(frame)
      else {
        frameHandle = undefined
        play.textContent = 'Play'
      }
    }
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle)
    frameHandle = requestAnimationFrame(frame)
  }

  seek.addEventListener('input', () => {
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle)
    frameHandle = undefined
    play.textContent = 'Play'
    seekTimeline(Number(seek.value))
  })
  play.addEventListener('click', () => {
    if (frameHandle !== undefined) {
      cancelAnimationFrame(frameHandle)
      frameHandle = undefined
      play.textContent = 'Play'
      return
    }
    playTimeline()
  })
  reset.addEventListener('click', () => {
    clearPlayback()
    renderedEventIndex = -2
    seekTimeline(0)
  })
  debugSeek.addEventListener('click', () => {
    logFlip('debug-seek-click', { timeMs: DEBUG_SEEK_TIME_MS })
    clearPlayback()
    seekTimeline(DEBUG_SEEK_TIME_MS)
  })
  window.addEventListener('resize', () => {
    clearPlayback()
    projectionEpoch += 1
    runtime.invalidateHost(HOST_ID, projectionEpoch)
    captures = buildCaptures()
    renderedEventIndex = -2
    seekTimeline(Number(seek.value))
    status.textContent = `Host projection epoch: ${projectionEpoch}`
  })

  debug.textContent = `V2 captures: ${captures.length}\nEvents: ${TIMELINE_EVENTS.map((event) => `${event.timeMs}ms ${event.itemId}:${event.kind}`).join(', ')}`
  seekTimeline(0)
}

const app = document.querySelector<HTMLElement>('#app')
if (app !== null) mountPlayerPocDemo(app)
