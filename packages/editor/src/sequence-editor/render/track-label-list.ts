import type { SequenceEditorContext, TrackNode } from '../types'
import { flattenTracks, getTrackRowHeight } from '../utils'

export function createTrackLabelList(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-labels')
  return el
}

export function renderTrackLabelList(
  container: HTMLElement,
  ctx: SequenceEditorContext,
  onTrackClick: (trackId: string) => void,
): void {
  container.innerHTML = ''

  const rows = flattenTracks(ctx.scene.tracks)
  for (const track of rows) {
    const row = buildLabelRow(track, ctx, onTrackClick)
    container.appendChild(row)
  }
}

function buildLabelRow(
  track: TrackNode,
  ctx: SequenceEditorContext,
  onTrackClick: (trackId: string) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-label-row')
  row.dataset.trackId = track.id
  row.dataset.kind = track.kind
  if (track.children) row.dataset.hasChildren = 'true'

  const height = getTrackRowHeight(track, ctx.layoutProfile)
  row.style.height = `${height}px`

  const isSelected = ctx.selection?.type === 'track' && ctx.selection.trackId === track.id
  if (isSelected) row.classList.add('seq-label-row--selected')

  const visBtn = document.createElement('button')
  visBtn.classList.add('seq-label-row__vis')
  visBtn.textContent = track.visible ? '●' : '○'
  visBtn.title = track.visible ? 'Masquer' : 'Afficher'
  row.appendChild(visBtn)

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

  row.addEventListener('click', () => onTrackClick(track.id))
  return row
}
