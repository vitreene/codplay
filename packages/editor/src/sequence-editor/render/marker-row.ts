import type { MachineContext } from '../machine'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createMarkerTrackRows(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-marker-tracks')
  return el
}

export function renderMarkerTrackRows(
  container: HTMLElement,
  ctx: MachineContext,
  onAddMarker?: (markerTrackId: string, rawMs: number) => void,
  onSelectMarker?: (markerId: string) => void,
  onDragStartMarker?: (markerId: string, e: PointerEvent) => void,
): void {
  container.innerHTML = ''

  const { viewport, scene, selection, layoutProfile } = ctx
  const { pixelsPerMs, startMs } = viewport
  const h = layoutProfile.rowHeightMarkers

  for (const track of Object.values(scene.markerTracks)) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.classList.add('seq-markers')
    if (!track.visible) svg.classList.add('seq-markers--hidden')
    svg.setAttribute('height', String(h))
    svg.dataset.markerTrackId = track.id
    svg.setAttribute('aria-hidden', 'true')

    for (const marker of track.markers) {
      const x = (marker.timeMs - startMs) * pixelsPerMs
      const color = marker.color ?? track.color ?? 'var(--seq-marker-default-color)'

      const flag = document.createElementNS(SVG_NS, 'polygon')
      flag.setAttribute('points', `${x},0 ${x + 8},0 ${x + 8},${h - 4} ${x},${h}`)
      flag.setAttribute('fill', color)
      flag.classList.add('seq-marker__flag')
      if (selection.markerId === marker.id) flag.classList.add('seq-marker__flag--selected')
      flag.dataset.markerId = marker.id

      if (onDragStartMarker) {
        flag.addEventListener('pointerdown', e => {
          e.stopPropagation()
          e.preventDefault()
          onDragStartMarker(marker.id, e)
        })
      } else if (onSelectMarker) {
        flag.addEventListener('click', e => {
          e.stopPropagation()
          onSelectMarker(marker.id)
        })
      }
      svg.appendChild(flag)

      const label = document.createElementNS(SVG_NS, 'text')
      label.setAttribute('x', String(x + 10))
      label.setAttribute('y', String(h - 3))
      label.classList.add('seq-marker__label')
      label.textContent = marker.label
      svg.appendChild(label)
    }

    if (onAddMarker) {
      svg.style.cursor = 'pointer'
      svg.addEventListener('dblclick', e => {
        const rect = svg.getBoundingClientRect()
        const rawMs = startMs + (e.clientX - rect.left) / pixelsPerMs
        onAddMarker(track.id, rawMs)
      })
    }

    container.appendChild(svg)
  }
}
