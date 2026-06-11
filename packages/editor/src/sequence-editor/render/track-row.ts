import type { SequenceEditorContext, TrackNode } from '../types'
import { flattenTracks, getTrackRowHeight, msToPixel } from '../utils'
import { createKeyframeHandle } from './keyframe-handle'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createTrackRowArea(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-rows')
  return el
}

export function renderTrackRows(
  container: HTMLElement,
  ctx: SequenceEditorContext,
  onAddKeyframe: (trackId: string, rawMs: number) => void,
  onSelectKeyframe: (trackId: string, kfId: string) => void,
): void {
  container.innerHTML = ''

  const { viewport, scene, selection, layoutProfile } = ctx
  const rows = flattenTracks(scene.tracks)

  for (const track of rows) {
    const rowHeight = getTrackRowHeight(track, layoutProfile)
    const rowEl = buildTrackRow(track, rowHeight, ctx)

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.classList.add('seq-row__svg')
    svg.setAttribute('height', String(rowHeight))
    svg.setAttribute('aria-hidden', 'true')

    // active segment bar
    for (let i = 0; i < track.keyframes.length; i++) {
      const kf = track.keyframes[i]
      const next = track.keyframes[i + 1]
      if (!next) break
      const x1 = msToPixel(kf.timeMs - viewport.scrollLeftMs, viewport.pxPerSec)
      const x2 = msToPixel(next.timeMs - viewport.scrollLeftMs, viewport.pxPerSec)
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(x1))
      rect.setAttribute('y', String(rowHeight / 2 - 2))
      rect.setAttribute('width', String(Math.max(0, x2 - x1)))
      rect.setAttribute('height', '4')
      rect.classList.add('seq-row__segment')
      svg.appendChild(rect)
    }

    // keyframe handles
    for (const kf of track.keyframes) {
      const x = msToPixel(kf.timeMs - viewport.scrollLeftMs, viewport.pxPerSec)
      const handle = createKeyframeHandle(kf, x, rowHeight, layoutProfile)

      const isSelected =
        selection?.type === 'keyframe' &&
        selection.trackId === track.id &&
        selection.keyframeId === kf.id
      if (isSelected) handle.classList.add('seq-kf--selected')

      handle.addEventListener('click', e => {
        e.stopPropagation()
        onSelectKeyframe(track.id, kf.id)
      })

      svg.appendChild(handle)
    }

    rowEl.addEventListener('dblclick', (e) => {
      const rect = rowEl.getBoundingClientRect()
      const px = e.clientX - rect.left
      const rawMs = ctx.viewport.scrollLeftMs + (px / ctx.viewport.pxPerSec) * 1000
      onAddKeyframe(track.id, rawMs)
    })

    rowEl.appendChild(svg)
    container.appendChild(rowEl)
  }
}

function buildTrackRow(track: TrackNode, rowHeight: number, _ctx: SequenceEditorContext): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-row')
  row.dataset.trackId = track.id
  row.dataset.kind = track.kind
  row.style.height = `${rowHeight}px`
  if (track.children) row.dataset.hasChildren = 'true'
  return row
}
