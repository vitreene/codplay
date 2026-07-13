import './sequence-editor.css'

import type { MachineContext, VirtualKeyframe } from './machine'
import type { SequenceEditorController } from './controller'
import { formatTimeMs } from './constants'
import { createTimeRuler, renderTimeRuler } from './render/time-ruler'
import { createTrackLabelList, renderTrackLabelList } from './render/track-label-list'
import { createTrackRowArea, renderTrackRows } from './render/track-row'
import { createPlayheadOverlay, renderPlayhead } from './render/playhead-line'
import { createCueRow, renderCueRow } from './render/cue-row'
import { createMarkerTrackRows, renderMarkerTrackRows } from './render/marker-row'
import { createWaveformRow, renderWaveformRow } from './render/waveform-row'

export interface MountSequenceEditorOptions {
  /** Notifié à chaque changement de playhead — le pont vers `player.seek({ timelineMs })` vit chez l'appelant, pas ici. */
  onPlayheadChange?: (timeMs: number) => void
}

export interface SequenceEditorMountHandle {
  destroy(): void
}

/**
 * Monte le sequence-editor dans `container`, piloté par `controller` — un seul contrôleur pour
 * toute la durée du montage (changer de scène = `destroy()` puis remonter avec un nouveau
 * contrôleur, pas de remplacement à chaud). Assemble les modules `create*`/`render*` déjà
 * existants ; ne contient aucune logique de démo (pas de sélecteur de fixture — c'est
 * l'appelant qui choisit quelle scène charger dans le contrôleur avant de monter).
 */
export function mountSequenceEditor(
  container: HTMLElement,
  controller: SequenceEditorController,
  options: MountSequenceEditorOptions = {},
): SequenceEditorMountHandle {
  const ctrl = controller

  // ── Proximity guard ──────────────────────────────────────────────────────────

  function isTooCloseToExisting(trackId: string, rawMs: number, ctx: MachineContext): boolean {
    const { pixelsPerMs } = ctx.viewport
    const thresholdMs = ctx.layoutProfile.keyframeHandleSizePx / pixelsPerMs
    const track = ctx.scene.items.find((i) => i.id === trackId)
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
    } else {
      collapsedCapsuleIds.add(capsuleId)
    }
    render(ctrl.getSnapshot())
  }

  // ── RAF ticker ────────────────────────────────────────────────────────────────

  let prevTs: number | null = null
  let rafHandle: number | null = null

  function rafLoop(ts: number): void {
    if (ctrl.isPlaying()) {
      if (prevTs !== null) ctrl.tick(ts - prevTs)
      prevTs = ts

      const ctx = ctrl.getSnapshot().context
      if (ctx.followPlayhead && ctx.playheadMs >= ctx.viewport.endMs) {
        ctrl.scrollToMs(ctx.playheadMs)
      }

      rafHandle = requestAnimationFrame(rafLoop)
    } else {
      prevTs = null
      rafHandle = null
    }
  }

  // ── Build shell ───────────────────────────────────────────────────────────────

  container.style.cssText = 'display:flex;flex-direction:column;height:100%;background:#111827'

  const toolbar = document.createElement('div')
  toolbar.classList.add('seq-toolbar')

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

  const unitLabel = document.createElement('span')
  unitLabel.classList.add('seq-toolbar__label')
  unitLabel.textContent = 'unité'

  const unitBtn = document.createElement('button')
  unitBtn.classList.add('seq-toolbar__btn')
  unitBtn.textContent = 's'
  unitBtn.title = 'Basculer unité de temps (s / ms)'

  const followLabel = document.createElement('span')
  followLabel.classList.add('seq-toolbar__label')
  followLabel.textContent = 'suivre'

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

  toolbar.append(btnPlay, btnStop, timeDisplay, zoomWrap, unitLabel, unitBtn, followLabel, btnFollow, btnZoomRange, btnClearRange)

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

  const leftCol = document.createElement('div')
  leftCol.classList.add('seq-left')
  leftCol.append(editor, infobar)

  const mainArea = document.createElement('div')
  mainArea.classList.add('seq-main')
  mainArea.append(leftCol, outputPanel)

  const dragOverlay = document.createElement('div')
  dragOverlay.classList.add('seq-drag-overlay')
  container.appendChild(dragOverlay)

  container.append(toolbar, mainArea)

  // ── Timeline pan (pointer drag on background) ─────────────────────────────────

  function startPan(e: PointerEvent): void {
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

    function onMoveWindow(ev: PointerEvent): void {
      if (Math.abs(ev.clientX - startClientX) <= 4) return
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

  function onTimelinePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return
    // La sélection de texte native pendant un drag est bloquée par CSS (`user-select:none` +
    // `-webkit-user-select:none` sur `.seq-editor`, toujours actif, pas quelque chose que le JS
    // doit "rattraper" via `preventDefault()`) — vérifié en conditions réelles (Safari) : la
    // sélection reste vide au drag, avec ou sans `preventDefault` ici. Un `preventDefault()`
    // systématique sur ce pointerdown avait été ajouté par erreur pour ce même besoin ; retiré —
    // il s'appliquait aussi au cas d'un simple double-clic (aucun drag prévu), risque inutile.
    if (e.altKey) {
      startPan(e)
      return
    }
    const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
    if (rowEl?.dataset.kind === 'capsule') {
      startClipDrag(rowEl.dataset.trackId!, e)
    }
  }
  timeline.addEventListener('pointerdown', onTimelinePointerDown)

  function onTimelineDblClick(e: MouseEvent): void {
    if (!e.altKey) return
    const rowEl = (e.target as HTMLElement).closest('[data-track-id]') as HTMLElement | null
    if (rowEl?.dataset.kind !== 'capsule') return
    const rect = timeline.getBoundingClientRect()
    ctrl.clipPlace(rowEl.dataset.trackId!, ctrl.pixelToMs(e.clientX - rect.left))
  }
  timeline.addEventListener('dblclick', onTimelineDblClick)

  // ── Timeline zoom (ctrl/meta + wheel, or trackpad pinch) ──────────────────────

  function onTimelineWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const rect = timeline.getBoundingClientRect()
    const focusPx = e.clientX - rect.left
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    ctrl.zoom(factor, focusPx)
  }
  timeline.addEventListener('wheel', onTimelineWheel, { passive: false })

  // ── Keyframe drag ─────────────────────────────────────────────────────────────

  function startKeyframeDrag(trackId: string, kfId: string): void {
    dragOverlay.classList.add('active')

    function onMove(ev: PointerEvent): void {
      const rect = timeline.getBoundingClientRect()
      const pointerMs = ctrl.pixelToMs(ev.clientX - rect.left)
      ctrl.dragMove(pointerMs)
    }

    function onUp(): void {
      ctrl.dragEnd()
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMove)
      dragOverlay.removeEventListener('pointerup', onUp)
    }

    dragOverlay.addEventListener('pointermove', onMove)
    dragOverlay.addEventListener('pointerup', onUp)

    ctrl.dragStartKeyframe(trackId, kfId)
  }

  // ── Marker drag ────────────────────────────────────────────────────────────────

  function startMarkerDrag(markerId: string): void {
    dragOverlay.classList.add('active')
    ctrl.selectMarker(markerId)

    function onMove(ev: PointerEvent): void {
      const rect = timeline.getBoundingClientRect()
      const rawMs = ctrl.pixelToMs(ev.clientX - rect.left)
      const snapped = ctrl.snapToGrid(rawMs)
      ctrl.moveMarker(markerId, Math.max(0, snapped))
    }

    function onUp(): void {
      dragOverlay.classList.remove('active')
      dragOverlay.removeEventListener('pointermove', onMove)
      dragOverlay.removeEventListener('pointerup', onUp)
    }

    dragOverlay.addEventListener('pointermove', onMove)
    dragOverlay.addEventListener('pointerup', onUp)
  }

  // ── Ruler: seek (click) or range draw (drag) ──────────────────────────────────

  function onRulerPointerDown(e: PointerEvent): void {
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
        ctrl.setPlayRange(inMs, outMs)
      }
      rulerWrapper.removeEventListener('pointermove', onMove)
      rulerWrapper.removeEventListener('pointerup', onUp)
    }

    rulerWrapper.addEventListener('pointermove', onMove)
    rulerWrapper.addEventListener('pointerup', onUp)
  }
  rulerWrapper.addEventListener('pointerdown', onRulerPointerDown)

  // ── Controls ──────────────────────────────────────────────────────────────────

  function onPlayClick(): void {
    if (ctrl.isPlaying()) {
      ctrl.pause()
    } else {
      ctrl.play()
      rafHandle = requestAnimationFrame(rafLoop)
    }
  }
  btnPlay.addEventListener('click', onPlayClick)

  function onStopClick(): void {
    ctrl.stop()
  }
  btnStop.addEventListener('click', onStopClick)

  function onZoomInput(): void {
    ctrl.setZoom(Number(zoomSlider.value))
  }
  zoomSlider.addEventListener('input', onZoomInput)

  function onFollowClick(): void {
    ctrl.toggleFollowPlayhead()
  }
  btnFollow.addEventListener('click', onFollowClick)

  function onZoomRangeClick(): void {
    ctrl.zoomToRange()
  }
  btnZoomRange.addEventListener('click', onZoomRangeClick)

  function onClearRangeClick(): void {
    ctrl.clearPlayRange()
  }
  btnClearRange.addEventListener('click', onClearRangeClick)

  function onUnitClick(): void {
    const next = ctrl.getSnapshot().context.displayConfig.timeUnit === 's' ? 'ms' : 's'
    ctrl.setDisplayConfig({ timeUnit: next })
    unitBtn.textContent = next
  }
  unitBtn.addEventListener('click', onUnitClick)

  // ── Render ────────────────────────────────────────────────────────────────────

  let scrollSyncing = false
  let lastPlayheadMs: number | null = null

  function render(snap: { context: MachineContext }): void {
    const ctx = snap.context
    timeDisplay.textContent = formatTimeMs(ctx.playheadMs, ctx.displayConfig.timeUnit)
    btnPlay.textContent = ctx.isPlaying ? '⏸' : '▶'
    btnFollow.classList.toggle('seq-toolbar__btn--active', ctx.followPlayhead)
    const hasRange = ctx.playRange !== null
    btnZoomRange.style.display = hasRange ? '' : 'none'
    btnClearRange.style.display = hasRange ? '' : 'none'

    if (options.onPlayheadChange && ctx.playheadMs !== lastPlayheadMs) {
      lastPlayheadMs = ctx.playheadMs
      options.onPlayheadChange(ctx.playheadMs)
    }

    const currentPxPerSec = Math.round(ctx.viewport.pixelsPerMs * 1000)
    if (Number(zoomSlider.value) !== currentPxPerSec) zoomSlider.value = String(currentPxPerSec)

    const timelineW = timeline.clientWidth
    if (Math.abs(timelineW - ctx.viewport.viewWidthPx) > 1) {
      ctrl.notifyResize(timelineW, timeline.clientHeight)
    }

    const totalPx = ctx.scene.meta.durationMs * ctx.viewport.pixelsPerMs
    timelineInner.style.minWidth = `${totalPx}px`

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
      (id) => ctrl.selectTrack(id),
      (id) => ctrl.toggleVisibility(id),
      onToggleCollapse,
      collapsedCapsuleIds,
      () => {},
      (id) => ctrl.toggleMarkerTrackVisibility(id),
      () => {
        const label = window.prompt('Nom de la piste de marqueurs :')
        if (!label) return
        ctrl.addMarkerTrack(label)
      },
      (id) => ctrl.removeMarkerTrack(id),
    )
    markerAddSpacer.style.height = `${ctx.layoutProfile.rowHeightMarkers + 1}px`
    renderTrackRows(
      trackRows,
      ctx,
      (trackId, rawMs) => {
        if (isTooCloseToExisting(trackId, rawMs, ctx)) return
        ctrl.addKeyframe(trackId, rawMs)
      },
      (trackId, kfId) => ctrl.selectKeyframe(trackId, kfId),
      collapsedCapsuleIds,
      startKeyframeDrag,
      (vkf: VirtualKeyframe) => {
        const id = ctrl.addKeyframe(vkf.trackId, vkf.timeMs)
        ctrl.renameKeyframe(vkf.trackId, id, vkf.name)
      },
    )
    renderCueRow(cueRow, ctx)
    renderMarkerTrackRows(
      markerRow,
      ctx,
      (markerTrackId, rawMs) => ctrl.addMarker(markerTrackId, Math.max(0, rawMs)),
      (markerId) => ctrl.selectMarker(markerId),
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
      const track = scene.items.find((i) => i.id === selection.trackId)
      const kf = track?.keyframes.find((k) => k.id === selection.keyframeId)
      if (!kf || !track) return
      bar.append(
        span(`kf: ${formatTimeMs(kf.timeMs, displayConfig.timeUnit)}${kf.name ? ' — ' + kf.name : ''}  décor: ${kf.decorId}`),
        btn('Supprimer', () => ctrl.removeKeyframe(track.id, kf.id)),
        btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
      )
    } else if (selection.trackId) {
      const track = scene.items.find((i) => i.id === selection.trackId)
      if (!track) return
      bar.append(
        span(`${track.label ?? track.id}  (${track.type})  ${track.keyframes.length} kf`),
        btn('Vider la ligne', () => ctrl.clearTrack(track.id)),
      )
      if (track.type === 'capsule') {
        bar.append(btn('Vider la capsule', () => ctrl.clearCapsule(track.id)))
      }
    }
  }

  // Delete / Backspace → remove selected kf or marker
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    const { selection } = ctrl.getSnapshot().context
    if (selection.keyframeId && selection.trackId) {
      ctrl.removeKeyframe(selection.trackId, selection.keyframeId)
    } else if (selection.markerId) {
      ctrl.removeMarker(selection.markerId)
    }
  }
  document.addEventListener('keydown', onKeyDown)

  // ── Scroll sync ───────────────────────────────────────────────────────────────

  function onLabelsScroll(): void {
    if (scrollSyncing) return
    scrollSyncing = true
    timeline.scrollTop = labels.scrollTop
    scrollSyncing = false
  }
  labels.addEventListener('scroll', onLabelsScroll)

  function onTimelineScroll(): void {
    if (scrollSyncing) return
    scrollSyncing = true
    labels.scrollTop = timeline.scrollTop
    scrollSyncing = false

    const { pixelsPerMs } = ctrl.getViewport()
    ctrl.scrollToMs(timeline.scrollLeft / pixelsPerMs)
  }
  timeline.addEventListener('scroll', onTimelineScroll)

  // ── Resize observer ───────────────────────────────────────────────────────────

  const ro = new ResizeObserver(() => ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight))
  ro.observe(timeline)

  // ── Boot ──────────────────────────────────────────────────────────────────────

  ctrl.notifyResize(timeline.clientWidth, timeline.clientHeight)
  const unsubscribe = ctrl.subscribe(render)

  return {
    destroy(): void {
      unsubscribe()
      ro.disconnect()
      document.removeEventListener('keydown', onKeyDown)
      if (rafHandle !== null) cancelAnimationFrame(rafHandle)
      container.innerHTML = ''
    },
  }
}
