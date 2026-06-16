import type { MachineContext } from '../machine'
import type { TrackNode, MarkerTrack } from '../types'
import { getTrackRowHeight } from '../utils'

type FlatEntry = { track: TrackNode; depth: number }

function flattenWithDepth(
  tracks: TrackNode[],
  depth = 0,
  collapsedIds: ReadonlySet<string> = new Set(),
): FlatEntry[] {
  const result: FlatEntry[] = []
  for (const track of tracks) {
    result.push({ track, depth })
    if (track.children && !collapsedIds.has(track.id)) {
      result.push(...flattenWithDepth(track.children, depth + 1, collapsedIds))
    }
  }
  return result
}

export function createTrackLabelList(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-labels')
  return el
}

export function renderTrackLabelList(
  container: HTMLElement,
  ctx: MachineContext,
  onTrackClick: (trackId: string) => void,
  onToggleVisibility?: (trackId: string) => void,
  onToggleCollapse?: (capsuleId: string) => void,
  collapsedIds?: ReadonlySet<string>,
  onMarkerTrackClick?: (markerTrackId: string) => void,
  onToggleMarkerTrackVisibility?: (markerTrackId: string) => void,
  onAddMarkerTrack?: () => void,
  onRemoveMarkerTrack?: (markerTrackId: string) => void,
): void {
  container.innerHTML = ''

  // Spacer matching cueRow height — sits above the marker track label rows,
  // mirroring cueRow's position in timelineInner (cueRow → markerTrackRows → waveformRow → trackRows).
  // SVG/canvas use box-sizing:content-box → rendered height = attr + 1px border.
  const { layoutProfile, scene } = ctx
  const hasWaveform = Boolean(scene.audio?.waveform)
  const cueSpacer = document.createElement('div')
  cueSpacer.style.cssText = `height:${layoutProfile.rowHeightCues + 1}px;flex-shrink:0`
  container.appendChild(cueSpacer)

  for (const markerTrack of scene.markerTracks) {
    container.appendChild(
      buildMarkerTrackLabelRow(markerTrack, ctx, onMarkerTrackClick, onToggleMarkerTrackVisibility, onRemoveMarkerTrack),
    )
  }

  if (onAddMarkerTrack) {
    const addRow = document.createElement('div')
    addRow.classList.add('seq-label-row', 'seq-label-row--add-marker-track')
    addRow.style.height = `${layoutProfile.rowHeightMarkers + 1}px`
    addRow.textContent = '+ piste marqueur'
    addRow.title = 'Ajouter une piste de marqueurs'
    addRow.addEventListener('click', () => onAddMarkerTrack())
    container.appendChild(addRow)
  }

  if (hasWaveform) {
    const waveformSpacer = document.createElement('div')
    waveformSpacer.style.cssText = `height:${layoutProfile.rowHeightWaveform + 1}px;flex-shrink:0`
    container.appendChild(waveformSpacer)
  }

  const collapsed = collapsedIds ?? new Set<string>()
  for (const { track, depth } of flattenWithDepth(ctx.scene.tracks, 0, collapsed)) {
    container.appendChild(buildLabelRow(track, depth, ctx, collapsed, onTrackClick, onToggleVisibility, onToggleCollapse))
  }
}

function buildMarkerTrackLabelRow(
  markerTrack: MarkerTrack,
  ctx: MachineContext,
  onMarkerTrackClick?: (markerTrackId: string) => void,
  onToggleVisibility?: (markerTrackId: string) => void,
  onRemove?: (markerTrackId: string) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-label-row', 'seq-label-row--marker-track')
  row.dataset.markerTrackId = markerTrack.id
  // +1 compensates the SVG marker row's content-box border (see renderMarkerTrackRows)
  row.style.height = `${ctx.layoutProfile.rowHeightMarkers + 1}px`
  if (!markerTrack.visible) row.classList.add('seq-label-row--hidden')

  const name = document.createElement('span')
  name.classList.add('seq-label-row__name')
  name.textContent = markerTrack.label
  row.appendChild(name)

  const visBtn = document.createElement('button')
  visBtn.classList.add('seq-label-row__vis')
  visBtn.textContent = markerTrack.visible ? '●' : '○'
  visBtn.title = markerTrack.visible ? 'Masquer' : 'Afficher'
  visBtn.addEventListener('click', e => {
    e.stopPropagation()
    onToggleVisibility?.(markerTrack.id)
  })
  row.appendChild(visBtn)

  if (onRemove) {
    const rmBtn = document.createElement('button')
    rmBtn.classList.add('seq-label-row__remove')
    rmBtn.textContent = '✕'
    rmBtn.title = 'Retirer cette piste'
    rmBtn.addEventListener('click', e => {
      e.stopPropagation()
      onRemove(markerTrack.id)
    })
    row.appendChild(rmBtn)
  }

  if (onMarkerTrackClick) {
    row.addEventListener('click', () => onMarkerTrackClick(markerTrack.id))
  }
  return row
}

function buildLabelRow(
  track: TrackNode,
  depth: number,
  ctx: MachineContext,
  collapsedIds: ReadonlySet<string>,
  onTrackClick: (trackId: string) => void,
  onToggleVisibility?: (trackId: string) => void,
  onToggleCollapse?: (capsuleId: string) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-label-row')
  row.dataset.trackId = track.id
  row.dataset.kind = track.kind
  row.dataset.depth = String(depth)
  row.style.height = `${getTrackRowHeight(track, ctx.layoutProfile)}px`

  const isSelected = ctx.selection.trackId === track.id && ctx.selection.keyframeId === null
  if (isSelected) row.classList.add('seq-label-row--selected')
  if (!track.visible) row.classList.add('seq-label-row--hidden')

  // Collapse toggle — capsules with children only
  if (track.kind === 'capsule' && track.children?.length) {
    const isCollapsed = collapsedIds.has(track.id)
    const colBtn = document.createElement('button')
    colBtn.classList.add('seq-label-row__collapse')
    colBtn.textContent = isCollapsed ? '▶' : '▼'
    colBtn.title = isCollapsed ? 'Développer' : 'Réduire'
    colBtn.addEventListener('click', e => {
      e.stopPropagation()
      onToggleCollapse?.(track.id)
    })
    row.appendChild(colBtn)
  }

  const name = document.createElement('span')
  name.classList.add('seq-label-row__name')
  name.textContent = track.label
  row.appendChild(name)

  if (track.kind === 'capsule') {
    const tag = document.createElement('span')
    tag.classList.add('seq-label-row__kind')
    tag.textContent = track.capsuleType ?? 'capsule'
    row.appendChild(tag)
  }

  // Visibility toggle — right-aligned via margin-left:auto on CSS
  const visBtn = document.createElement('button')
  visBtn.classList.add('seq-label-row__vis')
  visBtn.textContent = track.visible ? '●' : '○'
  visBtn.title = track.visible ? 'Masquer' : 'Afficher'
  visBtn.addEventListener('click', e => {
    e.stopPropagation()
    onToggleVisibility?.(track.id)
  })
  row.appendChild(visBtn)

  row.addEventListener('click', () => onTrackClick(track.id))
  return row
}
