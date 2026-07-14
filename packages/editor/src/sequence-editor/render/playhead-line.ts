import type { MachineContext } from '../machine'
import { timeToPixel } from './geometry'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createPlayheadOverlay(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('seq-playhead')
  svg.setAttribute('aria-hidden', 'true')
  svg.style.pointerEvents = 'none'

  const line = document.createElementNS(SVG_NS, 'line')
  line.classList.add('seq-playhead__line')
  line.id = 'seq-playhead-line'
  svg.appendChild(line)

  const head = document.createElementNS(SVG_NS, 'polygon')
  head.classList.add('seq-playhead__head')
  head.id = 'seq-playhead-head'
  svg.appendChild(head)

  return svg
}

export function renderPlayhead(svg: SVGSVGElement, ctx: MachineContext): void {
  const { viewport, playheadMs, layoutProfile } = ctx
  const x = timeToPixel(playheadMs, viewport, layoutProfile)
  if (!isFinite(x)) return
  const h = svg.clientHeight || 400

  const line = svg.querySelector<SVGLineElement>('#seq-playhead-line')
  const head = svg.querySelector<SVGPolygonElement>('#seq-playhead-head')

  if (line) {
    line.setAttribute('x1', String(x))
    line.setAttribute('x2', String(x))
    line.setAttribute('y1', '0')
    line.setAttribute('y2', String(h))
  }

  if (head) {
    head.setAttribute('points', `${x - 6},0 ${x + 6},0 ${x},8`)
  }
}
