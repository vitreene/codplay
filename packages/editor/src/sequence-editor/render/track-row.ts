import type { MachineContext } from '../machine'
import type { TrackNode } from '../types'
import { getTrackRowHeight } from '../utils'
import { createKeyframeHandle } from './keyframe-handle'

const SVG_NS = 'http://www.w3.org/2000/svg'

function flattenFiltered(tracks: TrackNode[], collapsedIds: ReadonlySet<string>): TrackNode[] {
  const result: TrackNode[] = []
  for (const track of tracks) {
    result.push(track)
    if (track.children && !collapsedIds.has(track.id)) {
      result.push(...flattenFiltered(track.children, collapsedIds))
    }
  }
  return result
}

function getEffectiveMs(kfId: string, kfTimeMs: number, ctx: MachineContext): number {
  const i = ctx.interaction
  if (i?.kind === 'dragging-keyframe' && i.keyframeId === kfId) return i.currentMs
  return kfTimeMs
}

export function createTrackRowArea(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-rows')
  return el
}

export function renderTrackRows(
  container: HTMLElement,
  ctx: MachineContext,
  onAddKeyframe: (trackId: string, rawMs: number) => void,
  onSelectKeyframe: (trackId: string, kfId: string) => void,
  collapsedIds?: ReadonlySet<string>,
  onDragStart?: (trackId: string, kfId: string, e: PointerEvent) => void,
): void {
  container.innerHTML = ''

  const { viewport, scene, selection, layoutProfile } = ctx
  const { pixelsPerMs, startMs } = viewport
  const collapsed = collapsedIds ?? new Set<string>()
  const drag = ctx.interaction?.kind === 'dragging-keyframe' ? ctx.interaction : null

  for (const track of flattenFiltered(scene.tracks, collapsed)) {
    const rowHeight = getTrackRowHeight(track, layoutProfile)
    const rowEl = buildTrackRow(track, rowHeight)

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.classList.add('seq-row__svg')
    svg.setAttribute('height', String(rowHeight))
    svg.setAttribute('aria-hidden', 'true')

    // Segment bars between adjacent keyframes (positions follow active drag)
    for (let i = 0; i < track.keyframes.length; i++) {
      const kf = track.keyframes[i]!
      const next = track.keyframes[i + 1]
      if (!next) break
      const x1 = (getEffectiveMs(kf.id, kf.timeMs, ctx) - startMs) * pixelsPerMs
      const x2 = (getEffectiveMs(next.id, next.timeMs, ctx) - startMs) * pixelsPerMs
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(Math.min(x1, x2)))
      rect.setAttribute('y', String(rowHeight / 2 - 2))
      rect.setAttribute('width', String(Math.max(0, Math.abs(x2 - x1))))
      rect.setAttribute('height', '4')
      rect.classList.add('seq-row__segment')
      svg.appendChild(rect)
    }

    // Transition duration bands (named = amber, interpolated = blue)
    for (const kf of track.keyframes) {
      if (!kf.transitionOut) continue
      const kfX = (getEffectiveMs(kf.id, kf.timeMs, ctx) - startMs) * pixelsPerMs
      const bandW = kf.transitionOut.durationMs * pixelsPerMs
      const band = document.createElementNS(SVG_NS, 'rect')
      band.setAttribute('x', String(kfX))
      band.setAttribute('y', String(rowHeight / 2 - 5))
      band.setAttribute('width', String(Math.max(1, bandW)))
      band.setAttribute('height', '10')
      band.classList.add(
        'seq-row__transition',
        kf.transitionOut.kind === 'named' ? 'seq-row__transition--named' : 'seq-row__transition--interp',
      )
      svg.appendChild(band)
    }

    // Keyframe handles (position follows active drag for the dragged keyframe)
    for (const kf of track.keyframes) {
      const effectiveMs = getEffectiveMs(kf.id, kf.timeMs, ctx)
      const x = (effectiveMs - startMs) * pixelsPerMs
      const handle = createKeyframeHandle(kf, x, rowHeight, layoutProfile)
      const isDragging = drag?.keyframeId === kf.id && drag.trackId === track.id

      if (selection.keyframeId === kf.id && selection.trackId === track.id) {
        handle.classList.add('seq-kf--selected')
      }
      if (isDragging) {
        handle.classList.add('seq-kf--dragging')
      }

      if (onDragStart) {
        handle.addEventListener('pointerdown', e => {
          e.stopPropagation()
          e.preventDefault()
          onDragStart(track.id, kf.id, e)
        })
      } else {
        handle.addEventListener('click', e => {
          e.stopPropagation()
          onSelectKeyframe(track.id, kf.id)
        })
      }

      svg.appendChild(handle)
    }

    rowEl.addEventListener('dblclick', e => {
      const rect = rowEl.getBoundingClientRect()
      const rawMs = viewport.startMs + (e.clientX - rect.left) / viewport.pixelsPerMs
      onAddKeyframe(track.id, rawMs)
    })

    rowEl.appendChild(svg)
    container.appendChild(rowEl)
  }
}

function buildTrackRow(track: TrackNode, rowHeight: number): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-row')
  if (!track.visible) row.classList.add('seq-row--hidden')
  row.dataset.trackId = track.id
  row.dataset.kind = track.kind
  row.style.height = `${rowHeight}px`
  if (track.children) row.dataset.hasChildren = 'true'
  return row
}
