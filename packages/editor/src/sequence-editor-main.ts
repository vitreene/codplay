import './sequence-editor/sequence-editor.css'

import type { EditorScene } from './sequence-editor/types'
import type { MachineContext, VirtualKeyframe } from './sequence-editor/machine'
import { SequenceEditorController } from './sequence-editor/controller'
import { flattenTracks } from './sequence-editor/utils'
import { formatTimeMs } from './sequence-editor/constants'
import { createTimeRuler, renderTimeRuler } from './sequence-editor/render/time-ruler'
import { createTrackLabelList, renderTrackLabelList } from './sequence-editor/render/track-label-list'
import { createTrackRowArea, renderTrackRows } from './sequence-editor/render/track-row'
import { createPlayheadOverlay, renderPlayhead } from './sequence-editor/render/playhead-line'
import { createCueRow, renderCueRow } from './sequence-editor/render/cue-row'
import { createMarkerTrackRows, renderMarkerTrackRows } from './sequence-editor/render/marker-row'
import { createWaveformRow, renderWaveformRow } from './sequence-editor/render/waveform-row'

import sceneEddy from './sequence-editor/fixtures/scene-eddy-ref.json'
import sceneOneTrack from './sequence-editor/fixtures/scene-one-track.json'
import sceneNested from './sequence-editor/fixtures/scene-nested-capsule.json'
import sceneCarousel from './sequence-editor/fixtures/scene-carousel.json'
import sceneEmpty from './sequence-editor/fixtures/scene-empty.json'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURES: Record<string, EditorScene> = {
  'eddy-ref':        sceneEddy     as unknown as EditorScene,
  'one-track':       sceneOneTrack as unknown as EditorScene,
  'nested-capsule':  sceneNested   as unknown as EditorScene,
  'carousel':        sceneCarousel as unknown as EditorScene,
  'empty':           sceneEmpty    as unknown as EditorScene,
}
const FIXTURE_LABELS: Record<string, string> = {
  'eddy-ref':       'Eddy scène 02',
  'one-track':      'Un élément texte',
  'nested-capsule': 'Capsule imbriquée',
  'carousel':       'Carousel (kf virtuels)',
  'empty':          'Scène vide',
}

// ── Controller ────────────────────────────────────────────────────────────────

let ctrl = new SequenceEditorController(FIXTURES['eddy-ref']!)
let unsubscribe: (() => void) | null = null

// ── Proximity guard ──────────────────────────────────────────────────────────

function isTooCloseToExisting(trackId: string, rawMs: number, ctx: MachineContext): boolean {
  const { pixelsPerMs } = ctx.viewport
  const thresholdMs = ctx.layoutProfile.keyframeHandleSizePx / pixelsPerMs
  const track = flattenTracks(ctx.scene.tracks).find(t => t.id === trackId)
  if (track) {
    for (const kf of track.keyframes) {
      if (Math.abs(kf.timeMs - rawMs) < thresholdMs) return true
    }
  }
  for (const vkf of ctx.virtualKeyframes) {
    if (vkf.trackId === trackId && Math.abs(vkf.timeMs - rawMs) < thresholdMs) return true
  }
  return false
}

// ── Collapse state (UI-only) ──────────────────────────────────────────────────

let collapsedCapsuleIds = new Set<string>()

function onToggleCollapse(capsuleId: string): void {
  if (collapsedCapsuleIds.has(capsuleId)) {
    collapsedCapsuleIds.delete(capsuleId)
    console.log('[seq] capsule:expand', capsuleId)
  } else {
    collapsedCapsuleIds.add(capsuleId)
    console.log('[seq] capsule:collapse', capsuleId)
  }
  render(ctrl.getSnapshot())
}

// ── RAF ticker ────────────────────────────────────────────────────────────────

let prevTs: number | null = null

function rafLoop(ts: number): void {
  if (ctrl.isPlaying()) {
    if (prevTs !== null) ctrl.tick(ts - prevTs)
    prevTs = ts

    // Follow playhead: paginated jump when playhead reaches right edge
    const ctx = ctrl.getSnapshot().context
    if (ctx.followPlayhead && ctx.playheadMs >= ctx.viewport.endMs) {
      ctrl.scrollToMs(ctx.playheadMs)
    }

    requestAnimationFrame(rafLoop)
  } else {
    prevTs = null
  }
}

// ── Build shell ───────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>('#app')!
app.style.cssText = 'display:flex;flex-direction:column;height:100vh;background:#111827'

// Toolbar
const toolbar = document.createElement('div')
toolbar.classList.add('seq-toolbar')

const fixtureSelect = document.createElement('select')
fixtureSelect.classList.add('seq-toolbar__select')
for (const [key, label] of Object.entries(FIXTURE_LABELS)) {
  const opt = document.createElement('option')
  opt.value = key
  opt.textContent = label
  fixtureSelect.appendChild(opt)
}

const btnPlay = document.createElement('button')
btnPlay.classList.add('seq-toolbar__btn')
btnPlay.textContent = '▶'
btnPlay.title = 'Play / Pause'

const btnStop = document.createElement('button')
btnStop.classList.add('seq-toolbar__btn')
btnStop.textContent = '■'
btnStop.title = 'Stop'

const timeDisplay = document.createElement('span')
timeDisplay.classList.add('seq-toolbar__time')

const zoomWrap = document.createElement('div')
zoomWrap.classList.add('seq-toolbar__zoom')
zoomWrap.innerHTML = '<span>zoom</span>'
const zoomSlider = document.createElement('input')
zoomSlider.type = 'range'
zoomSlider.min = '10'
zoomSlider.max = '800'
zoomSlider.value = '80'
zoomWrap.appendChild(zoomSlider)

const unitBtn = document.createElement('button')
unitBtn.classList.add('seq-toolbar__btn')
unitBtn.textContent = 's'
unitBtn.title = 'Basculer unité de temps'

const btnFollow = document.createElement('button')
btnFollow.classList.add('seq-toolbar__btn')
btnFollow.textContent = '≫'
btnFollow.title = 'Suivre la tête de lecture (mode paginé)'

const btnZoomRange = document.createElement('button')
btnZoomRange.classList.add('seq-toolbar__btn')
btnZoomRange.textContent = '⊡'
btnZoomRange.title = 'Zoom sur le clip'
btnZoomRange.style.display = 'none'

const btnClearRange = document.createElement('button')
btnClearRange.classList.add('seq-toolbar__btn')
btnClearRange.textContent = '×'
btnClearRange.title = 'Effacer le clip'
btnClearRange.style.display = 'none'

toolbar.append(fixtureSelect, btnPlay, btnStop, timeDisplay, zoomWrap, unitBtn, btnFollow, btnZoomRange, btnClearRange)

// Editor grid
const editor = document.createElement('div')
editor.classList.add('seq-editor')
editor.style.flex = '1'
editor.style.minHeight = '0'

const corner = document.createElement('div')
corner.classList.add('seq-corner')

const rulerWrapper = document.createElement('div')
rulerWrapper.classList.add('seq-ruler-wrapper')
const ruler = createTimeRuler()
rulerWrapper.appendChild(ruler)

const labels = createTrackLabelList()

const timeline = document.createElement('div')
timeline.classList.add('seq-timeline')
const timelineInner = document.createElement('div')
timelineInner.classList.add('seq-timeline-inner')
timeline.appendChild(timelineInner)

const cueRow = createCueRow()
const markerRow = createMarkerTrackRows()
// Matches the "+ piste marqueur" label row height (see renderTrackLabelList) so
// labels and timeline rows stay vertically aligned (scroll is synced between the two).
// Height is set in the render loop from ctx.layoutProfile.
const markerAddSpacer = document.createElement('div')
markerAddSpacer.classList.add('seq-marker-track-add-spacer')
const waveformRow = createWaveformRow()
const trackRows = createTrackRowArea()
const playheadOverlay = createPlayheadOverlay()
playheadOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none'

timelineInner.append(cueRow, markerRow, markerAddSpacer, waveformRow, trackRows, playheadOverlay)
editor.append(corner, rulerWrapper, labels, timeline)

const infobar = document.createElement('div')
infobar.classList.add('seq-infobar')

const outputPanel = document.createElement('pre')
outputPanel.classList.add('seq-output')

// Left column: editor + infobar
const leftCol = document.createElement('div')
leftCol.classList.add('seq-left')
leftCol.append(editor, infobar)

// Main area: left column + output panel
const mainArea = document.createElement('div')
mainArea.classList.add('seq-main')
mainArea.append(leftCol, outputPanel)

// Drag overlay (position:fixed, persists across renders, captures pointer during drag)
const dragOverlay = document.createElement('div')
dragOverlay.classList.add('seq-drag-overlay')
app.appendChild(dragOverlay)

app.append(toolbar, mainArea)

// ── Timeline pan (pointer drag on background) ─────────────────────────────────

function startPan(e: PointerEvent): void {
  // Pan only from idle state (machine must be in panning-capable state)
  if (ctrl.getSnapshot().value !== 'idle') return
  dragOverlay.classList.add('active')
  ctrl.panStart(e.clientX)

  function onMove(ev: PointerEvent): void {
    ctrl.panMove(ev.clientX)
  }

  function onUp(): void {
    ctrl.panEnd()
    dragOverlay.classList.remove('active')
    dragOverlay.removeEventListener('pointermove', onMove)
    dragOverlay.removeEventListener('pointerup', onUp)
  }

  dragOverlay.addEventListener('pointermove', onMove)
  dragOverlay.addEventListener('pointerup', onUp)
}

// ── Clip draw (drag on capsule row, threshold-gated) ─────────────────────────

function startClipDrag(trackId: string, e: PointerEvent): void {
  if (ctrl.getSnapshot().value !== 'idle') return
  const rect = timeline.getBoundingClientRect()
  const startClientX = e.clientX

  // Phase 1: watch for threshold on window — overlay stays inactive so click/dblclick can fire
  function onMoveWindow(ev: PointerEvent): void {
    if (Math.abs(ev.clientX - startClientX) <= 4) return
    // Threshold crossed: switch to overlay for clean drag capture
    window.removeEventListener('pointermove', onMoveWindow)
    window.removeEventListener('pointerup', onUpWindow)
    dragOverlay.classList.add('active')
    dragOverlay.addEventListener('pointermove', onMoveOverlay)
    dragOverlay.addEventListener('pointerup', onUpOverlay)
    ctrl.clipStartDraw(trackId, ctrl.pixelToMs(startClientX - rect.left))
    ctrl.clipDrawMove(ctrl.pixelToMs(ev.clientX - rect.left))
  }

  function onUpWindow(): void {
    window.removeEventListener('pointermove', onMoveWindow)
    window.removeEventListener('pointerup', onUpWindow)
  }

  // Phase 2: active drag on overlay
  function onMoveOverlay(ev: PointerEvent): void {
    ctrl.clipDrawMove(ctrl.pixelToMs(ev.clientX - rect.left))
  }

  function onUpOverlay(): void {
    ctrl.clipDrawEnd()
    dragOverlay.classList.remove('active')
    dragOverlay.removeEventListener('pointermove', onMoveOverlay)
    dragOverlay.removeEventListener('pointerup', onUpOverlay)
  }

  window.addEventListener('pointermove', onMoveWindow)
  window.addEventListener('pointerup', onUpWindow)
}

timeline.addEventListener('pointerdown', e => {
  if (e.button !== 0) return
  if (e.altKey) {
    startPan(e)
    return
  }
  const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
  if (rowEl?.dataset.kind === 'capsule') startClipDrag(rowEl.dataset.trackId!, e)
})

// Alt+dblclick on capsule row → clip boundary (intro → outro → move nearest)
timeline.addEventListener('dblclick', e => {
  if (!e.altKey) return
  const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
  if (rowEl?.dataset.kind !== 'capsule') return
  const rect = timeline.getBoundingClientRect()
  ctrl.clipPlace(rowEl.dataset.trackId!, ctrl.pixelToMs(e.clientX - rect.left))
})

// ── Timeline zoom (ctrl/meta + wheel, or trackpad pinch) ──────────────────────

timeline.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const rect = timeline.getBoundingClientRect()
  const focusPx = e.clientX - rect.left
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  ctrl.zoom(factor, focusPx)
}, { passive: false })

// ── Keyframe drag ─────────────────────────────────────────────────────────────

function startKeyframeDrag(trackId: string, kfId: string, _e: PointerEvent): void {
  dragOverlay.classList.add('active')

  function onMove(ev: PointerEvent): void {
    const rect = timeline.getBoundingClientRect()
    const pointerMs = ctrl.pixelToMs(ev.clientX - rect.left)
    ctrl.dragMove(pointerMs)
  }

  function onUp(): void {
    console.log('[seq] drag:end', kfId)
    ctrl.dragEnd()
    dragOverlay.classList.remove('active')
    dragOverlay.removeEventListener('pointermove', onMove)
    dragOverlay.removeEventListener('pointerup', onUp)
  }

  dragOverlay.addEventListener('pointermove', onMove)
  dragOverlay.addEventListener('pointerup', onUp)

  console.log('[seq] drag:start', trackId, kfId)
  ctrl.dragStartKeyframe(trackId, kfId)
}

// ── Marker drag ────────────────────────────────────────────────────────────────

function startMarkerDrag(markerId: string, _e: PointerEvent): void {
  dragOverlay.classList.add('active')
  ctrl.selectMarker(markerId)

  function onMove(ev: PointerEvent): void {
    const rect = timeline.getBoundingClientRect()
    const rawMs = ctrl.pixelToMs(ev.clientX - rect.left)
    const snapped = ctrl.snapToGrid(rawMs)
    ctrl.moveMarker(markerId, Math.max(0, snapped))
  }

  function onUp(): void {
    console.log('[seq] marker:drag:end', markerId)
    dragOverlay.classList.remove('active')
    dragOverlay.removeEventListener('pointermove', onMove)
    dragOverlay.removeEventListener('pointerup', onUp)
  }

  dragOverlay.addEventListener('pointermove', onMove)
  dragOverlay.addEventListener('pointerup', onUp)

  console.log('[seq] marker:drag:start', markerId)
}

// ── Ruler: seek (click) or range draw (drag) ──────────────────────────────────

rulerWrapper.addEventListener('pointerdown', e => {
  if (e.button !== 0) return
  const rect = rulerWrapper.getBoundingClientRect()
  const startMs = ctrl.pixelToMs(e.clientX - rect.left + timeline.scrollLeft)
  let dragStartX = e.clientX
  let rangeMode = false

  rulerWrapper.setPointerCapture(e.pointerId)
  ctrl.seek(startMs)

  function onMove(ev: PointerEvent): void {
    if (!rangeMode && Math.abs(ev.clientX - dragStartX) > 5) {
      rangeMode = true
    }
    if (rangeMode) {
      const curMs = ctrl.pixelToMs(ev.clientX - rect.left + timeline.scrollLeft)
      const inMs = Math.min(startMs, curMs)
      const outMs = Math.max(startMs, curMs)
      ctrl.setPlayRange(inMs, outMs)
    } else {
      ctrl.seek(ctrl.pixelToMs(ev.clientX - rect.left + timeline.scrollLeft))
    }
  }

  function onUp(ev: PointerEvent): void {
    if (rangeMode) {
      const curMs = ctrl.pixelToMs(ev.clientX - rect.left + timeline.scrollLeft)
      const inMs = Math.min(startMs, curMs)
      const outMs = Math.max(startMs, curMs)
      console.log('[seq] playrange:set', inMs.toFixed(0), '→', outMs.toFixed(0), 'ms')
      ctrl.setPlayRange(inMs, outMs)
    } else {
      console.log('[seq] ruler:seek', startMs.toFixed(0), 'ms')
    }
    rulerWrapper.removeEventListener('pointermove', onMove)
    rulerWrapper.removeEventListener('pointerup', onUp)
  }

  rulerWrapper.addEventListener('pointermove', onMove)
  rulerWrapper.addEventListener('pointerup', onUp)
})

// ── Controls ──────────────────────────────────────────────────────────────────

btnPlay.addEventListener('click', () => {
  if (ctrl.isPlaying()) {
    console.log('[seq] playhead:pause')
    ctrl.pause()
  } else {
    console.log('[seq] playhead:play')
    ctrl.play()
    requestAnimationFrame(rafLoop)
  }
})

btnStop.addEventListener('click', () => {
  console.log('[seq] playhead:stop')
  ctrl.stop()
})

zoomSlider.addEventListener('input', () => ctrl.setZoom(Number(zoomSlider.value)))

btnFollow.addEventListener('click', () => {
  ctrl.toggleFollowPlayhead()
  console.log('[seq] follow:', ctrl.isFollowingPlayhead())
})

btnZoomRange.addEventListener('click', () => ctrl.zoomToRange())

btnClearRange.addEventListener('click', () => {
  ctrl.clearPlayRange()
  console.log('[seq] playrange:clear')
})

unitBtn.addEventListener('click', () => {
  const next = ctrl.getSnapshot().context.displayConfig.timeUnit === 's' ? 'ms' : 's'
  ctrl.setDisplayConfig({ timeUnit: next })
  unitBtn.textContent = next
})

// ── Fixture switcher ──────────────────────────────────────────────────────────

function mountFixture(key: string): void {
  if (unsubscribe) unsubscribe()
  ctrl.stop()
  ctrl.destroy()
  ctrl = new SequenceEditorController(FIXTURES[key]!)
  collapsedCapsuleIds = new Set()
  corner.textContent = FIXTURES[key]!.title
  zoomSlider.value = '80'
  ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight)
  unsubscribe = ctrl.subscribe(render)
}

fixtureSelect.addEventListener('change', () => mountFixture(fixtureSelect.value))

// ── Render ────────────────────────────────────────────────────────────────────

function render(snap: { context: MachineContext }): void {
  const ctx = snap.context
  timeDisplay.textContent = formatTimeMs(ctx.playheadMs, ctx.displayConfig.timeUnit)
  btnPlay.textContent = ctx.isPlaying ? '⏸' : '▶'
  btnFollow.classList.toggle('seq-toolbar__btn--active', ctx.followPlayhead)
  const hasRange = ctx.playRange !== null
  btnZoomRange.style.display = hasRange ? '' : 'none'
  btnClearRange.style.display = hasRange ? '' : 'none'

  const currentPxPerSec = Math.round(ctx.viewport.pixelsPerMs * 1000)
  if (Number(zoomSlider.value) !== currentPxPerSec) zoomSlider.value = String(currentPxPerSec)

  const timelineW = timeline.clientWidth
  if (Math.abs(timelineW - ctx.viewport.viewWidthPx) > 1) {
    ctrl.notifyResize(timelineW, timeline.clientHeight)
  }

  // Total scrollable width = full scene at current zoom
  const totalPx = ctx.scene.durationMs * ctx.viewport.pixelsPerMs
  timelineInner.style.minWidth = `${totalPx}px`

  // Keep scrollLeft in sync with startMs (e.g. after zoom or external pan)
  const expectedScrollLeft = ctx.viewport.startMs * ctx.viewport.pixelsPerMs
  if (Math.abs(timeline.scrollLeft - expectedScrollLeft) > 1) {
    scrollSyncing = true
    timeline.scrollLeft = expectedScrollLeft
    scrollSyncing = false
  }

  renderTimeRuler(ruler, ctx)
  renderTrackLabelList(
    labels,
    ctx,
    id => {
      console.log('[seq] track:select', id)
      ctrl.selectTrack(id)
    },
    id => {
      console.log('[seq] track:toggleVisibility', id)
      ctrl.toggleVisibility(id)
    },
    onToggleCollapse,
    collapsedCapsuleIds,
    id => {
      console.log('[seq] markerTrack:select', id)
    },
    id => {
      console.log('[seq] markerTrack:toggleVisibility', id)
      ctrl.toggleMarkerTrackVisibility(id)
    },
    () => {
      const label = window.prompt('Nom de la piste de marqueurs :')
      if (!label) return
      const id = ctrl.addMarkerTrack(label)
      console.log('[seq] markerTrack:add', id, label)
    },
    id => {
      console.log('[seq] markerTrack:remove', id)
      ctrl.removeMarkerTrack(id)
    },
  )
  markerAddSpacer.style.height = `${ctx.layoutProfile.rowHeightMarkers + 1}px`
  renderTrackRows(
    trackRows,
    ctx,
    (trackId, rawMs) => {
      if (isTooCloseToExisting(trackId, rawMs, ctx)) return
      console.log('[seq] keyframe:add', trackId, rawMs.toFixed(0), 'ms')
      ctrl.addKeyframe(trackId, rawMs)
    },
    (trackId, kfId) => {
      console.log('[seq] keyframe:select', trackId, kfId)
      ctrl.selectKeyframe(trackId, kfId)
    },
    collapsedCapsuleIds,
    startKeyframeDrag,
    (vkf: VirtualKeyframe) => {
      const id = ctrl.addKeyframe(vkf.trackId, vkf.timeMs)
      ctrl.renameKeyframe(vkf.trackId, id, vkf.name)
      console.log('[seq] virtual:materialize', vkf.trackId, vkf.name, vkf.timeMs.toFixed(0), 'ms')
    },
  )
  renderCueRow(cueRow, ctx)
  renderMarkerTrackRows(
    markerRow,
    ctx,
    (markerTrackId, rawMs) => {
      const id = ctrl.addMarker(markerTrackId, Math.max(0, rawMs))
      console.log('[seq] marker:add', markerTrackId, id, rawMs.toFixed(0), 'ms')
    },
    markerId => {
      console.log('[seq] marker:select', markerId)
      ctrl.selectMarker(markerId)
    },
    startMarkerDrag,
  )
  renderWaveformRow(waveformRow, ctx)
  renderPlayhead(playheadOverlay, ctx)
  renderInfobar(infobar, ctx)
  outputPanel.textContent = JSON.stringify(ctx.scene, null, 2)
}

function renderInfobar(bar: HTMLElement, ctx: MachineContext): void {
  bar.innerHTML = ''
  const { selection, scene, displayConfig } = ctx
  const allTracks = flattenTracks(scene.tracks)

  function btn(label: string, action: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'seq-infobar__btn'
    b.textContent = label
    b.addEventListener('click', action)
    return b
  }
  function span(text: string): HTMLSpanElement {
    const s = document.createElement('span')
    s.textContent = text
    return s
  }

  if (selection.keyframeId) {
    const track = allTracks.find(t => t.id === selection.trackId)
    const kf = track?.keyframes.find(k => k.id === selection.keyframeId)
    if (!kf || !track) return
    bar.append(
      span(`kf: ${formatTimeMs(kf.timeMs, displayConfig.timeUnit)}${kf.name ? ' — ' + kf.name : ''}  décor: ${kf.decorId ?? '∅'}`),
      btn('Supprimer', () => ctrl.removeKeyframe(track.id, kf.id)),
      btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
    )
  } else if (selection.trackId) {
    const track = allTracks.find(t => t.id === selection.trackId)
    if (!track) return
    bar.append(
      span(`${track.label}  (${track.kind})  ${track.keyframes.length} kf`),
      btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
    )
    if (track.kind === 'capsule') {
      bar.append(btn('Vider la capsule', () => ctrl.clearCapsule(track.id)))
    }
  }
}

// Delete / Backspace → remove selected kf or marker
document.addEventListener('keydown', e => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return
  if ((e.target as HTMLElement).closest('input, textarea, select')) return
  const { selection } = ctrl.getSnapshot().context
  if (selection.keyframeId && selection.trackId) {
    ctrl.removeKeyframe(selection.trackId, selection.keyframeId)
  } else if (selection.markerId) {
    ctrl.removeMarker(selection.markerId)
  }
})

// ── Scroll sync ───────────────────────────────────────────────────────────────

let scrollSyncing = false

// Vertical: labels ↔ timeline
labels.addEventListener('scroll', () => {
  if (scrollSyncing) return
  scrollSyncing = true
  timeline.scrollTop = labels.scrollTop
  scrollSyncing = false
})

// Horizontal: timeline scrollLeft → viewport startMs
timeline.addEventListener('scroll', () => {
  if (scrollSyncing) return
  scrollSyncing = true
  labels.scrollTop = timeline.scrollTop
  scrollSyncing = false

  const { pixelsPerMs } = ctrl.getViewport()
  ctrl.scrollToMs(timeline.scrollLeft / pixelsPerMs)
})

// ── Resize observer ───────────────────────────────────────────────────────────

const ro = new ResizeObserver(() => ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight))
ro.observe(timeline)

// ── Boot ──────────────────────────────────────────────────────────────────────

mountFixture('eddy-ref')
