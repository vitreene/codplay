import { createHtmlDomProjection, HtmlFlipRuntime } from '../../../../codplay-v2/src/runtime/flip'
import type { FlipCapture } from '../../../../codplay-v2/src/runtime/flip'

import './style.css'

type ContainerId = 'stress-a' | 'stress-b' | 'stress-c' | 'stress-d'
type TransferId = 'stress-q' | 'stress-k'
type ContentId = 'qa' | 'qb' | 'qc' | 'ka' | 'kb' | 'kc'
type OwnerId = 'q' | 'k'

type ContentExchange = Readonly<{
  timeMs: number
  itemId: ContentId
  from: OwnerId
  to: OwnerId
}>

const HOST_ID = 'flip-stress-test-v2'
const INITIAL_TIME_MS = 0
const BOUNDARY_TIME_MS = 1_000
const CONTAINER_END_TIME_MS = 10_000
const TRANSFER_END_TIME_MS = 9_000
const CONTAINER_DURATION_MS = 10_000
const SECONDARY_CONTAINER_DURATION_MS = 9_000
const TRANSFER_DURATION_MS = 8_000
const CONTENT_DURATION_MS = 1_000
const TIMELINE_END_MS = 10_000
const CONTENT_EASE = 'inOutQuad'

const CONTAINER_IDS: readonly ContainerId[] = ['stress-a', 'stress-b', 'stress-c', 'stress-d']
const CONTENT_IDS: readonly ContentId[] = ['qa', 'qb', 'qc', 'ka', 'kb', 'kc']

const CONTENT_EXCHANGES: readonly ContentExchange[] = [
  { timeMs: 1_000, itemId: 'qa', from: 'q', to: 'k' },
  { timeMs: 2_400, itemId: 'ka', from: 'k', to: 'q' },
  { timeMs: 3_800, itemId: 'qb', from: 'q', to: 'k' },
  { timeMs: 5_200, itemId: 'kb', from: 'k', to: 'q' },
  { timeMs: 6_600, itemId: 'qc', from: 'q', to: 'k' },
  { timeMs: 8_000, itemId: 'kc', from: 'k', to: 'q' },
]

const INITIAL_OWNERS: Readonly<Record<ContentId, OwnerId>> = {
  qa: 'q',
  qb: 'q',
  qc: 'q',
  ka: 'k',
  kb: 'k',
  kc: 'k',
}

const ITEM_LABELS: Readonly<Record<ContentId, string>> = {
  qa: 'Qa',
  qb: 'Qb',
  qc: 'Qc',
  ka: 'Ka',
  kb: 'Kb',
  kc: 'Kc',
}

/** Clamps one timeline time into the inclusive scene range. */
function clampTime(timeMs: number): number {
  return Math.max(0, Math.min(TIMELINE_END_MS, timeMs))
}

/** Returns one normalized progress value for a finite transition window. */
function progressAt(timeMs: number, startAt: number, duration: number): number {
  return Math.max(0, Math.min(1, (timeMs - startAt) / duration))
}

/** Returns the content ownership after all exchanges that have started. */
function ownersAt(timeMs: number): Record<ContentId, OwnerId> {
  const owners = { ...INITIAL_OWNERS }
  for (const exchange of CONTENT_EXCHANGES) {
    if (exchange.timeMs > timeMs) break
    owners[exchange.itemId] = exchange.to
  }
  return owners
}

/** Applies the authored root-container transformations for one scene time. */
function applyContainerTransforms(nodes: ReadonlyMap<string, HTMLElement>, timeMs: number): void {
  const a = nodes.get('stress-a')!
  const b = nodes.get('stress-b')!
  const c = nodes.get('stress-c')!
  const d = nodes.get('stress-d')!
  const leftProgress = progressAt(timeMs, INITIAL_TIME_MS, CONTAINER_DURATION_MS)
  const secondaryProgress = progressAt(timeMs, BOUNDARY_TIME_MS, SECONDARY_CONTAINER_DURATION_MS)

  a.style.transform = `translateY(${170 * leftProgress}px) rotate(${12 * leftProgress}deg)`
  b.style.transform = `translateY(${-170 * leftProgress}px) rotate(${-12 * leftProgress}deg)`
  c.style.transform = `translateY(${-170 * secondaryProgress}px) rotate(${-12 * secondaryProgress}deg)`
  d.style.transform = `translateY(${170 * secondaryProgress}px) rotate(${12 * secondaryProgress}deg)`
  c.style.visibility = timeMs < BOUNDARY_TIME_MS ? 'hidden' : 'visible'
  d.style.visibility = timeMs < BOUNDARY_TIME_MS ? 'hidden' : 'visible'
}

/** Creates one empty transfer container with a stable item handle. */
function createTransfer(id: TransferId, label: string, className: string, nodes: Map<string, HTMLElement>): HTMLElement {
  const transfer = document.createElement('section')
  transfer.id = id
  transfer.className = `transfer-container ${className}`
  transfer.setAttribute('aria-label', label)
  transfer.innerHTML = `<h3>${label}</h3><div class="transfer-items" role="list"></div>`
  nodes.set(id, transfer)
  return transfer
}

/** Creates one stable content handle used by alternating overlay captures. */
function createContent(id: ContentId, nodes: Map<string, HTMLElement>): HTMLElement {
  const item = document.createElement('span')
  item.id = `stress-${id}`
  item.className = `stress-item stress-${id}`
  item.setAttribute('role', 'listitem')
  item.textContent = ITEM_LABELS[id]
  nodes.set(item.id, item)
  return item
}

/** Renders natural parentage and geometry for one capture boundary or seek time. */
function renderScene(
  nodes: ReadonlyMap<string, HTMLElement>,
  timeMs: number,
  transfersAtTarget: boolean,
  owners: Readonly<Record<ContentId, OwnerId>>,
): void {
  applyContainerTransforms(nodes, timeMs)
  const a = nodes.get('stress-a')!
  const b = nodes.get('stress-b')!
  const c = nodes.get('stress-c')!
  const d = nodes.get('stress-d')!
  const q = nodes.get('stress-q')!
  const k = nodes.get('stress-k')!
  const qParent = transfersAtTarget ? b : a
  const kParent = transfersAtTarget ? c : d
  qParent.appendChild(q)
  kParent.appendChild(k)

  for (const contentId of CONTENT_IDS) {
    const owner = nodes.get(`stress-${contentId}`)!
    const transfer = nodes.get(owners[contentId] === 'q' ? 'stress-q' : 'stress-k')!
    transfer.querySelector<HTMLElement>('.transfer-items')!.appendChild(owner)
  }
}

/** Mounts the independent FLIP stress-test fixture. */
function mountFlipStressDemo(container: HTMLElement): void {
  container.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">Runtime V2</p>
        <h1>FLIP Stress Test</h1>
        <p class="subtitle">Quatre containers mobiles sur un axe vertical, deux transferts imbriqués et six échanges alternés.</p>
        <div class="demo-controls">
          <button id="stress-play" class="demo-button" type="button">Play</button>
          <button id="stress-reset" class="demo-button demo-button-secondary" type="button">Reset</button>
        </div>
        <label class="demo-progress-control" for="stress-seek">
          Seek
          <input id="stress-seek" class="demo-progress-range" type="range" min="0" max="${TIMELINE_END_MS}" value="0" step="1" />
          <output id="stress-seek-label" class="demo-progress-label">0ms</output>
        </label>
        <div id="stress-status" class="player-state">Prêt. Lancez le stress-test.</div>
        <div id="stress-debug" class="player-state stress-status"></div>
        <p class="stress-legend">A/B : visibles au FIRST, 10s. C/D : apparition à 1s, puis 9s. Q/K : 8s. Échanges : Qa → K, Ka → Q, Qb → K, Kb → Q, Qc → K, Kc → Q.</p>
      </aside>
      <div class="container">
        <div class="stress-stage" id="stress-stage">
          <section class="stress-container" id="stress-a"><h2>A</h2><p>source haut gauche</p></section>
          <section class="stress-container" id="stress-b"><h2>B</h2><p>cible haut droite</p></section>
          <section class="stress-container" id="stress-c"><h2>C</h2><p>source bas gauche</p></section>
          <section class="stress-container" id="stress-d"><h2>D</h2><p>cible bas droite</p></section>
        </div>
      </div>
    </main>
  `

  const stage = container.querySelector<HTMLElement>('#stress-stage')!
  const status = container.querySelector<HTMLDivElement>('#stress-status')!
  const debug = container.querySelector<HTMLDivElement>('#stress-debug')!
  const seek = container.querySelector<HTMLInputElement>('#stress-seek')!
  const seekLabel = container.querySelector<HTMLOutputElement>('#stress-seek-label')!
  const play = container.querySelector<HTMLButtonElement>('#stress-play')!
  const reset = container.querySelector<HTMLButtonElement>('#stress-reset')!
  const nodes = new Map<string, HTMLElement>()

  for (const id of CONTAINER_IDS) nodes.set(id, container.querySelector<HTMLElement>(`#${id}`)!)
  const q = createTransfer('stress-q', 'Q', 'transfer-q', nodes)
  const k = createTransfer('stress-k', 'K', 'transfer-k', nodes)
  nodes.get('stress-a')!.appendChild(q)
  nodes.get('stress-d')!.appendChild(k)
  for (const contentId of CONTENT_IDS) {
    const transfer = nodes.get(contentId.startsWith('q') ? 'stress-q' : 'stress-k')!
    transfer.querySelector<HTMLElement>('.transfer-items')!.appendChild(createContent(contentId, nodes))
  }

  let projectionEpoch = 1
  let frameHandle: number | undefined
  let captures: readonly FlipCapture[] = []
  let previousTimeMs = 0

  const projection = createHtmlDomProjection({
    hostContextId: HOST_ID,
    getProjectionEpoch: () => projectionEpoch,
    root: stage,
    resolveHandle: (itemId) => nodes.get(itemId),
  })
  const runtime = new HtmlFlipRuntime(projection)

  /** Captures one transition from two explicit natural scene states. */
  function captureTransition(input: Readonly<{
    captureId: string
    startAt: number
    duration: number
    itemIds: readonly string[]
    mode: 'local' | 'overlay-world'
    startTransfersAtTarget: boolean
    endTransfersAtTarget: boolean
    startOwners: Readonly<Record<ContentId, OwnerId>>
    endOwners: Readonly<Record<ContentId, OwnerId>>
  }>): FlipCapture {
    renderScene(nodes, input.startAt, input.startTransfersAtTarget, input.startOwners)
    const result = runtime.capture({
      captureId: input.captureId,
      hostContextId: HOST_ID,
      projectionEpoch,
      startAt: input.startAt,
      duration: input.duration,
      ease: CONTENT_EASE,
      entries: input.itemIds.map((itemId) => ({ itemId, ancestorIds: [], mode: input.mode })),
      mutate: () => renderScene(nodes, input.startAt + input.duration, input.endTransfersAtTarget, input.endOwners),
    })
    if (!result.ok) throw new Error(result.diagnostics.errors.map((entry) => `${entry.code}: ${entry.message}`).join('\n'))
    return result.value
  }

  /** Builds all independent FIRST/LAST captures from deterministic scene states. */
  function buildCaptures(): readonly FlipCapture[] {
    const built: FlipCapture[] = []
    const initialOwners = { ...INITIAL_OWNERS }
    const finalOwners = ownersAt(TIMELINE_END_MS)

    built.push(captureTransition({
      captureId: `${HOST_ID}-containers-ab`,
      startAt: 0,
      duration: CONTAINER_DURATION_MS,
      itemIds: ['stress-a', 'stress-b'],
      mode: 'local',
      startTransfersAtTarget: false,
      endTransfersAtTarget: false,
      startOwners: initialOwners,
      endOwners: initialOwners,
    }))
    built.push(captureTransition({
      captureId: `${HOST_ID}-containers-cd`,
      startAt: BOUNDARY_TIME_MS,
      duration: SECONDARY_CONTAINER_DURATION_MS,
      itemIds: ['stress-c', 'stress-d'],
      mode: 'local',
      startTransfersAtTarget: false,
      endTransfersAtTarget: true,
      startOwners: initialOwners,
      endOwners: initialOwners,
    }))
    built.push(captureTransition({
      captureId: `${HOST_ID}-transfers-qk`,
      startAt: BOUNDARY_TIME_MS,
      duration: TRANSFER_DURATION_MS,
      itemIds: ['stress-q', 'stress-k'],
      mode: 'overlay-world',
      startTransfersAtTarget: false,
      endTransfersAtTarget: true,
      startOwners: initialOwners,
      endOwners: initialOwners,
    }))

    for (const [index, exchange] of CONTENT_EXCHANGES.entries()) {
      const startOwners = ownersAt(exchange.timeMs - 1)
      const endOwners = { ...startOwners, [exchange.itemId]: exchange.to }
      built.push(captureTransition({
        captureId: `${HOST_ID}-content-${index + 1}-${exchange.itemId}`,
        startAt: exchange.timeMs,
        duration: CONTENT_DURATION_MS,
        itemIds: CONTENT_IDS.map((contentId) => `stress-${contentId}`),
        mode: 'overlay-world',
        startTransfersAtTarget: true,
        endTransfersAtTarget: true,
        startOwners,
        endOwners,
      }))
    }

    runtime.cancel()
    renderScene(nodes, INITIAL_TIME_MS, false, initialOwners)
    return built
  }

  /** Returns all captures active at one timeline instant. */
  function activeCapturesAt(timeMs: number): readonly FlipCapture[] {
    return captures.filter((capture) => timeMs >= capture.startAt && timeMs <= capture.endAt)
  }

  /** Stops playback and removes all runtime-owned poses and overlays. */
  function clearPlayback(): void {
    if (frameHandle !== undefined) cancelAnimationFrame(frameHandle)
    frameHandle = undefined
    runtime.cancel()
    play.textContent = 'Play'
  }

  /** Renders natural structure, then resolves all overlapping FLIP captures. */
  function seekTimeline(timeMs: number): void {
    const boundedTime = clampTime(timeMs)
    const active = activeCapturesAt(boundedTime)
    const rewound = boundedTime < previousTimeMs
    if (rewound) runtime.cancel()
    renderScene(nodes, boundedTime, boundedTime >= BOUNDARY_TIME_MS, ownersAt(boundedTime))
    if (active.length > 0) {
      const result = runtime.seekCached(HOST_ID, projectionEpoch, boundedTime)
      if (!result.ok) throw new Error(result.diagnostics.errors.map((entry) => entry.message).join('\n'))
    }
    else runtime.cancel()

    if (active.length === 0 || active.every((capture) => boundedTime >= capture.endAt)) {
      renderScene(nodes, boundedTime, boundedTime >= BOUNDARY_TIME_MS, ownersAt(boundedTime))
    }
    seek.value = String(boundedTime)
    seekLabel.value = `${Math.round(boundedTime)}ms`
    status.textContent = active.length === 0
      ? `Seek: ${Math.round(boundedTime)}ms`
      : `Seek: ${Math.round(boundedTime)}ms / ${active.length} capture(s) actif(s)`
    previousTimeMs = boundedTime
  }

  /** Starts playback using the same deterministic seek path as manual scrubbing. */
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

  captures = buildCaptures()
  debug.textContent = `Captures: ${captures.length}\nA/B: 0→10000ms\nC/D: 1000→10000ms\nQ/K: 1000→9000ms\nContenus: ${CONTENT_EXCHANGES.map((exchange) => `${exchange.timeMs}ms ${exchange.itemId}`).join(', ')}`
  seekTimeline(0)

  seek.addEventListener('input', () => {
    clearPlayback()
    seekTimeline(Number(seek.value))
  })
  play.addEventListener('click', () => {
    if (frameHandle !== undefined) {
      clearPlayback()
      return
    }
    playTimeline()
  })
  reset.addEventListener('click', () => {
    clearPlayback()
    seekTimeline(0)
  })
  window.addEventListener('resize', () => {
    clearPlayback()
    projectionEpoch += 1
    runtime.invalidateHost(HOST_ID, projectionEpoch)
    captures = buildCaptures()
    seekTimeline(Number(seek.value))
  })
}

const app = document.querySelector<HTMLElement>('#app')
if (app !== null) mountFlipStressDemo(app)
