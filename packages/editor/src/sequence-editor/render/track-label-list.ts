import type { MachineContext } from '../machine'
import type { TrackNode } from '../types'
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
): void {
  container.innerHTML = ''

  // Spacer matching cueRow + markerRow + waveformRow heights.
  // SVG/canvas use box-sizing:content-box → rendered height = attr + 1px border.
  const { layoutProfile, scene } = ctx
  const hasWaveform = Boolean(scene.audio?.waveform)
  const spacerH = (layoutProfile.rowHeightCues + 1)
    + (layoutProfile.rowHeightMarkers + 1)
    + (hasWaveform ? layoutProfile.rowHeightWaveform + 1 : 0)
  const spacer = document.createElement('div')
  spacer.style.cssText = `height:${spacerH}px;flex-shrink:0`
  container.appendChild(spacer)

  const collapsed = collapsedIds ?? new Set<string>()
  for (const { track, depth } of flattenWithDepth(ctx.scene.tracks, 0, collapsed)) {
    container.appendChild(buildLabelRow(track, depth, ctx, collapsed, onTrackClick, onToggleVisibility, onToggleCollapse))
  }
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
