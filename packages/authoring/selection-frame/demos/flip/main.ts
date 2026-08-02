import { calibrateGhostToWorldSnapshot, captureOverlayPose, ensureOverlayLayer } from '../../src/overlay-pose'
import { HtmlFlipRuntime } from '../../../../codplay-v2/src/runtime/flip'
import { resolveFlipPoseGraph } from '../../../../codplay-v2/src/runtime/flip'
import type { FlipCapture, HtmlFlipProjection, HtmlMatrix, HtmlPose, ResolvedFlipPose } from '../../../../codplay-v2/src/runtime/flip'

import './style.css'

type ListId = 'demo-stage-list' | 'demo-list'
type TimelineEventKind = 'add' | 'to-first' | 'return-origin'

type TimelineEvent = Readonly<{
  timeMs: number
  itemId: string
  kind: TimelineEventKind
}>

type OverlayHandle = Readonly<{
  ghost: HTMLElement
  source: HTMLElement
  sourceStyle: string | null
}>

const HOST_ID = 'player-poc-flip-v2'
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
  container.innerHTML = `
    <main class="demo-shell">
      <aside>
        <p class="eyebrow">Runtime V2</p>
        <h1>Player POC</h1>
        <p class="subtitle">Cas dur : inserts, puis retour de tous les items vers l'origine ; la list cible dérive et tourne.</p>
        <div class="demo-controls">
          <button id="poc-play" class="demo-button" type="button">Play</button>
          <button id="poc-reset" class="demo-button demo-button-secondary" type="button">Reset</button>
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
  const nodes = new Map<string, HTMLElement>([
    ['demo-list', mainList],
    ['demo-stage-list', stageList],
  ])
  let projectionEpoch = 1
  let frameHandle: number | undefined
  let activeCapture: FlipCapture | undefined
  let renderedEventIndex = -1
  const localStyleSnapshots = new Map<string, string | null>()
  let lastDebugSeekKey = ''

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

  /** Applies one resolved local pose while preserving the authored item transform. */
  function applyLocalPose(handle: unknown, resolved: ResolvedFlipPose): void {
    const node = handle as HTMLElement
    if (resolved.progress >= 1) {
      restoreLocalPose(node, true)
      return
    }
    snapshotLocalStyle(node)
    restoreLocalPose(node, false)
    const naturalRect = captureOverlayPose(node).rect
    const scaleX = naturalRect.width === 0 ? 1 : resolved.pose.rect.width / naturalRect.width
    const scaleY = naturalRect.height === 0 ? 1 : resolved.pose.rect.height / naturalRect.height
    const deltaX = resolved.pose.rect.left - naturalRect.left
    const deltaY = resolved.pose.rect.top - naturalRect.top
    if (resolved.progress <= 0.05 || resolved.progress >= 0.95) {
      logFlip('local-apply', {
        itemId: resolved.itemId,
        progress: resolved.progress,
        naturalRect: { ...naturalRect },
        resolvedRect: { ...resolved.pose.rect },
        delta: { x: deltaX, y: deltaY },
        scale: { x: scaleX, y: scaleY },
      })
    }
    node.style.transition = 'none'
    node.style.transformOrigin = 'center'
    node.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY}) ${ITEM_TRANSFORMS[resolved.itemId] ?? ''}`
  }

  /** Saves one item's complete inline style before FLIP projection writes. */
  function snapshotLocalStyle(node: HTMLElement): void {
    const itemId = node.dataset.itemId
    if (itemId !== undefined && !localStyleSnapshots.has(itemId)) {
      localStyleSnapshots.set(itemId, node.getAttribute('style'))
    }
  }

  /** Restores the exact inline style captured before local FLIP projection. */
  function restoreLocalPose(node: HTMLElement, discardSnapshot: boolean): void {
    const itemId = node.dataset.itemId
    if (itemId === undefined) return
    const snapshot = localStyleSnapshots.get(itemId)
    if (snapshot === undefined) return
    if (snapshot === null) node.removeAttribute('style')
    else node.setAttribute('style', snapshot)
    if (discardSnapshot) localStyleSnapshots.delete(itemId)
  }

  /** Applies one world pose to a fixed overlay clone. */
  function applyOverlayPose(handle: OverlayHandle, resolved: ResolvedFlipPose): void {
    const { ghost } = handle
    const matrix = resolved.pose.matrix
    const linearMatrix: HtmlMatrix = { ...matrix, e: 0, f: 0 }
    const bounds = transformedBounds(linearMatrix, resolved.pose.localWidth, resolved.pose.localHeight)
    if (resolved.progress <= 0.05 || resolved.progress >= 0.95) {
      logFlip('overlay-apply', {
        itemId: resolved.itemId,
        progress: resolved.progress,
        resolvedRect: { ...resolved.pose.rect },
        matrix: { ...resolved.pose.matrix },
        overlayRect: { left: resolved.pose.rect.left - bounds.left, top: resolved.pose.rect.top - bounds.top },
      })
    }
    ghost.style.position = 'fixed'
    ghost.style.left = `${resolved.pose.rect.left - bounds.left}px`
    ghost.style.top = `${resolved.pose.rect.top - bounds.top}px`
    ghost.style.width = `${resolved.pose.localWidth}px`
    ghost.style.height = `${resolved.pose.localHeight}px`
    ghost.style.margin = '0'
    ghost.style.minWidth = '0'
    ghost.style.minHeight = '0'
    ghost.style.boxSizing = 'border-box'
    ghost.style.transformOrigin = '0 0'
    ghost.style.transform = `matrix(${linearMatrix.a}, ${linearMatrix.b}, ${linearMatrix.c}, ${linearMatrix.d}, 0, 0)`
    ghost.style.zIndex = '20'
  }

  /** Creates the host projection used by the V2 runtime. */
  function createProjection(): HtmlFlipProjection {
    return {
      getHostContextId: () => HOST_ID,
      getProjectionEpoch: () => projectionEpoch,
      resolveHandle: (itemId) => nodes.get(itemId),
      capturePose: (handle) => captureOverlayPose(handle as Element) as HtmlPose,
      applyLocalPose,
      beginOverlay: (handle, first) => {
        const source = handle as HTMLElement
        const ghost = source.cloneNode(true) as HTMLElement
        const sourceStyle = source.getAttribute('style')
        ensureOverlayLayer(stage).appendChild(ghost)
        source.style.visibility = 'hidden'
        ghost.style.position = 'fixed'
        ghost.style.margin = '0'
        ghost.style.visibility = 'visible'
        calibrateGhostToWorldSnapshot(ghost, first.rect)
        return { ghost, source, sourceStyle }
      },
      applyOverlayPose: (handle, resolved) => applyOverlayPose(handle as OverlayHandle, resolved),
      finishOverlay: (handle) => {
        const overlay = handle as OverlayHandle
        if (overlay.sourceStyle === null) overlay.source.removeAttribute('style')
        else overlay.source.setAttribute('style', overlay.sourceStyle)
        overlay.ghost.remove()
      },
      flush: () => undefined,
    }
  }

  const projection = createProjection()
  const runtime = new HtmlFlipRuntime(projection)

  /** Captures every Player POC move from its exact before and after DOM states. */
  function buildCaptures(): readonly FlipCapture[] {
    const captures: FlipCapture[] = []
    renderPlacement(-1)
    applyListDrift(0)
    for (const [index, event] of TIMELINE_EVENTS.entries()) {
      renderPlacement(index - 1)
      applyListDrift(event.timeMs)
      const rawCapture = runtime.capture({
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
          applyListDrift(event.timeMs)
        },
      })
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
      applyListDrift(event.timeMs + MOVE_DURATION_MS)
      const futureItems = new Map(ITEM_IDS.map((itemId) => [itemId, captureOverlayPose(nodes.get(itemId)!) as HtmlPose]))
      const futureAncestors = new Map([
        ['demo-stage-list', captureOverlayPose(stageList) as HtmlPose],
        ['demo-list', captureOverlayPose(mainList) as HtmlPose],
      ])
      applyListDrift(event.timeMs)
      const adjustedCapture: FlipCapture = {
        ...rawCapture,
        entries: rawCapture.entries.map((entry) => ({ ...entry, to: futureItems.get(entry.itemId) ?? entry.to })),
        ancestors: rawCapture.ancestors.map((ancestor) => ({ ...ancestor, to: futureAncestors.get(ancestor.ancestorId) ?? ancestor.to })),
      }
      captures.push(adjustedCapture)
      logFlip('capture-future-boundary', {
        captureId: adjustedCapture.captureId,
        event,
        boundaryTimeMs: event.timeMs + MOVE_DURATION_MS,
        items: adjustedCapture.entries.map((entry) => ({ itemId: entry.itemId, pose: describePose(entry.to) })),
        ancestors: adjustedCapture.ancestors.map((ancestor) => ({ ancestorId: ancestor.ancestorId, pose: describePose(ancestor.to) })),
      })
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
    clearItemLocalPoses()
    activeCapture = undefined
  }

  /** Restores only item transforms, never the captured parent transforms. */
  function clearItemLocalPoses(): void {
    for (const itemId of ITEM_IDS) restoreLocalPose(nodes.get(itemId)!, true)
  }

  /** Resolves the timeline directly and applies one active V2 capture if needed. */
  function seekTimeline(timeMs: number): void {
    const boundedTime = Math.max(0, Math.min(TIMELINE_END_MS, timeMs))
    const active = activeEventAt(boundedTime)
    const eventIndex = TIMELINE_EVENTS.findLastIndex((event) => event.timeMs <= boundedTime)
    if (eventIndex !== renderedEventIndex) {
      runtime.cancel()
      clearItemLocalPoses()
      renderPlacement(eventIndex)
      renderedEventIndex = eventIndex
    }
    applyListDrift(boundedTime)
    activeCapture = active === undefined ? undefined : captures[active.index]
    if (activeCapture !== undefined) {
      const progress = (boundedTime - activeCapture.startAt) / activeCapture.duration
      const debugKey = `${activeCapture.captureId}:${progress <= 0.05 ? 'start' : progress >= 0.95 ? 'end' : 'middle'}`
      if (debugKey !== lastDebugSeekKey) {
        lastDebugSeekKey = debugKey
        const resolved = resolveFlipPoseGraph(activeCapture, boundedTime, projection)
        logFlip('seek-resolved', {
          captureId: activeCapture.captureId,
          timeMs: boundedTime,
          progress,
          scroll: { x: window.scrollX, y: window.scrollY },
          resolved: resolved.map((entry) => ({ itemId: entry.itemId, mode: entry.mode, progress: entry.progress, pose: describePose(entry.pose) })),
        })
      }
      runtime.seek(activeCapture, boundedTime)
    }
    else {
      runtime.cancel()
      clearItemLocalPoses()
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
  window.addEventListener('resize', () => {
    clearPlayback()
    projectionEpoch += 1
    captures = buildCaptures()
    renderedEventIndex = -2
    seekTimeline(Number(seek.value))
    status.textContent = `Host projection epoch: ${projectionEpoch}`
  })

  debug.textContent = `V2 captures: ${captures.length}\nEvents: ${TIMELINE_EVENTS.map((event) => `${event.timeMs}ms ${event.itemId}:${event.kind}`).join(', ')}`
  seekTimeline(0)
}

/** Computes the transformed AABB of one local box. */
function transformedBounds(matrix: HtmlMatrix, width: number, height: number): { left: number; top: number } {
  const points = [
    transformPoint(matrix, [0, 0]),
    transformPoint(matrix, [width, 0]),
    transformPoint(matrix, [0, height]),
    transformPoint(matrix, [width, height]),
  ]
  return {
    left: Math.min(...points.map((point) => point[0])),
    top: Math.min(...points.map((point) => point[1])),
  }
}

function transformPoint(matrix: HtmlMatrix, point: readonly [number, number]): readonly [number, number] {
  return [matrix.a * point[0] + matrix.c * point[1], matrix.b * point[0] + matrix.d * point[1]]
}

const app = document.querySelector<HTMLElement>('#app')
if (app !== null) mountPlayerPocDemo(app)
