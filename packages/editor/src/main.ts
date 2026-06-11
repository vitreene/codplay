import './sequence-editor/sequence-editor.css'

import type { EditorScene, SequenceEditorContext } from './sequence-editor/types'
import { StubController } from './sequence-editor/stub-controller'
import { formatTimeMs } from './sequence-editor/constants'
import { createTimeRuler, renderTimeRuler } from './sequence-editor/render/time-ruler'
import { createTrackLabelList, renderTrackLabelList } from './sequence-editor/render/track-label-list'
import { createTrackRowArea, renderTrackRows } from './sequence-editor/render/track-row'
import { createPlayheadOverlay, renderPlayhead } from './sequence-editor/render/playhead-line'
import { createCueRow, renderCueRow } from './sequence-editor/render/cue-row'
import { createMarkerRow, renderMarkerRow } from './sequence-editor/render/marker-row'
import { createWaveformRow, renderWaveformRow } from './sequence-editor/render/waveform-row'

import sceneEddy from './sequence-editor/fixtures/scene-eddy-ref.json'
import sceneOneTrack from './sequence-editor/fixtures/scene-one-track.json'
import sceneNested from './sequence-editor/fixtures/scene-nested-capsule.json'
import sceneEmpty from './sequence-editor/fixtures/scene-empty.json'

// ── Fixtures registry ────────────────────────────────────────────────────────

const FIXTURES: Record<string, EditorScene> = {
  'eddy-ref': sceneEddy as unknown as EditorScene,
  'one-track': sceneOneTrack as unknown as EditorScene,
  'nested-capsule': sceneNested as unknown as EditorScene,
  'empty': sceneEmpty as unknown as EditorScene,
}
const FIXTURE_LABELS: Record<string, string> = {
  'eddy-ref': 'Eddy scène 02',
  'one-track': 'Un élément texte',
  'nested-capsule': 'Capsule imbriquée',
  'empty': 'Scène vide',
}

// ── Mutable controller ref ───────────────────────────────────────────────────

let ctrl = new StubController(FIXTURES['eddy-ref']!)
let unsubscribe: (() => void) | null = null

// ── Build shell ──────────────────────────────────────────────────────────────

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
zoomWrap.innerHTML = `<span>zoom</span>`
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

toolbar.append(fixtureSelect, btnPlay, btnStop, timeDisplay, zoomWrap, unitBtn)

// Editor grid
const editor = document.createElement('div')
editor.classList.add('seq-editor')
editor.style.flex = '1'
editor.style.minHeight = '0'

// Corner
const corner = document.createElement('div')
corner.classList.add('seq-corner')

// Ruler wrapper
const rulerWrapper = document.createElement('div')
rulerWrapper.classList.add('seq-ruler-wrapper')
const ruler = createTimeRuler()
rulerWrapper.appendChild(ruler)

// Labels
const labels = createTrackLabelList()

// Timeline
const timeline = document.createElement('div')
timeline.classList.add('seq-timeline')

const timelineInner = document.createElement('div')
timelineInner.classList.add('seq-timeline-inner')
timeline.appendChild(timelineInner)

// Timeline sub-components
const cueRow = createCueRow()
const markerRow = createMarkerRow()
const waveformRow = createWaveformRow()
const trackRows = createTrackRowArea()
const playheadOverlay = createPlayheadOverlay()
playheadOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none'

timelineInner.append(cueRow, markerRow, waveformRow, trackRows, playheadOverlay)

editor.append(corner, rulerWrapper, labels, timeline)

// Info bar
const infobar = document.createElement('div')
infobar.classList.add('seq-infobar')

app.append(toolbar, editor, infobar)

// ── Pointer interaction on ruler (seek) ──────────────────────────────────────

rulerWrapper.addEventListener('pointerdown', (e) => {
  const rect = rulerWrapper.getBoundingClientRect()
  ctrl.seek(ctrl.pixelToMs(e.clientX - rect.left))
  rulerWrapper.setPointerCapture(e.pointerId)
})
rulerWrapper.addEventListener('pointermove', (e) => {
  if (e.buttons !== 1) return
  const rect = rulerWrapper.getBoundingClientRect()
  ctrl.seek(ctrl.pixelToMs(e.clientX - rect.left))
})

// ── Controls ─────────────────────────────────────────────────────────────────

btnPlay.addEventListener('click', () => {
  const ctx = ctrl.getContext()
  if (ctx.isPlaying) ctrl.pause()
  else ctrl.play()
})

btnStop.addEventListener('click', () => ctrl.stop())

zoomSlider.addEventListener('input', () => ctrl.setZoom(Number(zoomSlider.value)))

unitBtn.addEventListener('click', () => {
  const ctx = ctrl.getContext()
  const next = ctx.displayConfig.timeUnit === 's' ? 'ms' : 's'
  ctrl.setDisplayConfig({ timeUnit: next })
  unitBtn.textContent = next
})

// ── Fixture switcher ─────────────────────────────────────────────────────────

function mountFixture(key: string): void {
  if (unsubscribe) unsubscribe()
  ctrl.stop()
  const scene = FIXTURES[key]!
  ctrl = new StubController(scene)
  corner.textContent = scene.title
  zoomSlider.value = '80'
  ctrl.setVisibleDuration((timeline.clientWidth / ctrl.getContext().viewport.pxPerSec) * 1000)
  unsubscribe = ctrl.subscribe(render)
}

fixtureSelect.addEventListener('change', () => mountFixture(fixtureSelect.value))

// ── Render ────────────────────────────────────────────────────────────────────

function render(ctx: SequenceEditorContext): void {
  timeDisplay.textContent = formatTimeMs(ctx.playheadMs, ctx.displayConfig.timeUnit)
  btnPlay.textContent = ctx.isPlaying ? '⏸' : '▶'

  const timelineW = timeline.clientWidth
  const visMs = (timelineW / ctx.viewport.pxPerSec) * 1000
  if (Math.abs(visMs - ctx.viewport.visibleDurationMs) > 1) ctrl.setVisibleDuration(visMs)

  renderTimeRuler(ruler, ctx)
  renderTrackLabelList(labels, ctx, (trackId) => ctrl.select({ type: 'track', trackId }))
  renderTrackRows(
    trackRows,
    ctx,
    (trackId, rawMs) => ctrl.addKeyframe(trackId, rawMs),
    (trackId, kfId) => ctrl.select({ type: 'keyframe', trackId, keyframeId: kfId }),
  )
  renderCueRow(cueRow, ctx)
  renderMarkerRow(markerRow, ctx)
  renderWaveformRow(waveformRow, ctx)
  renderPlayhead(playheadOverlay, ctx)
  updateInfobar(infobar, ctx)
}

function updateInfobar(bar: HTMLElement, ctx: SequenceEditorContext): void {
  const sel = ctx.selection
  if (!sel) { bar.textContent = ''; return }
  if (sel.type === 'keyframe') {
    const track = ctx.scene.tracks.find(t => t.id === sel.trackId)
    const kf = track?.keyframes.find(k => k.id === sel.keyframeId)
    bar.textContent = kf
      ? `kf: ${formatTimeMs(kf.timeMs, ctx.displayConfig.timeUnit)}${kf.name ? ' — ' + kf.name : ''}  décor: ${kf.decorId ?? '∅'}`
      : ''
  } else if (sel.type === 'track') {
    const track = ctx.scene.tracks.find(t => t.id === sel.trackId)
    bar.textContent = track ? `track: ${track.label}  (${track.kind})  kf: ${track.keyframes.length}` : ''
  } else {
    bar.textContent = ''
  }
}

// ── Resize observer ───────────────────────────────────────────────────────────

const ro = new ResizeObserver(() => {
  ctrl.setVisibleDuration((timeline.clientWidth / ctrl.getContext().viewport.pxPerSec) * 1000)
})
ro.observe(timeline)

// ── Boot ──────────────────────────────────────────────────────────────────────

mountFixture('eddy-ref')
