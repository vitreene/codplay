import type { MachineContext } from '../machine'
import { computeGraduationInterval } from '../utils'
import { formatTimeMs, RULER_GRADUATION_LEVELS_MS, MIN_GRADUATION_GAP_PX } from '../constants'
import { timeToPixel } from './geometry'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createTimeRuler(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('seq-ruler')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

export function renderTimeRuler(svg: SVGSVGElement, ctx: MachineContext): void {
  const { viewport, scene, displayConfig, playRange, layoutProfile } = ctx
  const { pixelsPerMs, startMs, viewWidthPx } = viewport
  const toPx = (timeMs: number) => timeToPixel(timeMs, viewport, layoutProfile)
  const width = viewWidthPx || svg.clientWidth
  const height = svg.clientHeight || 28

  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  while (svg.firstChild) svg.removeChild(svg.firstChild)

  // Play range highlight band
  if (playRange) {
    const rx = toPx(playRange.inMs)
    const rw = toPx(playRange.outMs) - rx
    const band = document.createElementNS(SVG_NS, 'rect')
    band.setAttribute('x', String(rx))
    band.setAttribute('y', '0')
    band.setAttribute('width', String(Math.max(0, rw)))
    band.setAttribute('height', String(height))
    band.classList.add('seq-ruler__range')
    svg.appendChild(band)

    // In/out edge markers
    for (const [edgeMs, cls] of [[playRange.inMs, 'seq-ruler__range-in'], [playRange.outMs, 'seq-ruler__range-out']] as const) {
      const ex = toPx(edgeMs)
      const edge = document.createElementNS(SVG_NS, 'line')
      edge.setAttribute('x1', String(ex))
      edge.setAttribute('x2', String(ex))
      edge.setAttribute('y1', '0')
      edge.setAttribute('y2', String(height))
      edge.classList.add(cls)
      svg.appendChild(edge)
    }
  }

  const pxPerSec = pixelsPerMs * 1000
  const intervalMs = computeGraduationInterval(pxPerSec, RULER_GRADUATION_LEVELS_MS, MIN_GRADUATION_GAP_PX)
  const gradStart = Math.floor(startMs / intervalMs) * intervalMs
  const gradEnd = startMs + width / pixelsPerMs + intervalMs

  for (let t = gradStart; t <= Math.min(gradEnd, scene.meta.durationMs); t += intervalMs) {
    const x = toPx(t)

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(x))
    line.setAttribute('x2', String(x))
    line.setAttribute('y1', String(height - 8))
    line.setAttribute('y2', String(height))
    line.classList.add('seq-ruler__tick')
    svg.appendChild(line)

    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('x', String(x + 3))
    text.setAttribute('y', String(height - 10))
    text.classList.add('seq-ruler__label')
    text.textContent = formatTimeMs(t, displayConfig.timeUnit)
    svg.appendChild(text)
  }
}
