import type { SequenceEditorContext } from '../types'
import { msToPixel } from '../utils'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createMarkerRow(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('seq-markers')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

export function renderMarkerRow(svg: SVGSVGElement, ctx: SequenceEditorContext): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const { viewport, scene, layoutProfile } = ctx
  const h = layoutProfile.rowHeightMarkers

  svg.setAttribute('height', String(h))

  for (const marker of scene.markers) {
    const x = msToPixel(marker.timeMs - viewport.scrollLeftMs, viewport.pxPerSec)
    const color = marker.color ?? 'var(--seq-marker-default-color)'

    const flag = document.createElementNS(SVG_NS, 'polygon')
    flag.setAttribute('points', `${x},0 ${x + 8},0 ${x + 8},${h - 4} ${x},${h}`)
    flag.setAttribute('fill', color)
    flag.classList.add('seq-marker__flag')
    flag.dataset.markerId = marker.id
    svg.appendChild(flag)

    const label = document.createElementNS(SVG_NS, 'text')
    label.setAttribute('x', String(x + 10))
    label.setAttribute('y', String(h - 3))
    label.classList.add('seq-marker__label')
    label.textContent = marker.label
    svg.appendChild(label)
  }
}
