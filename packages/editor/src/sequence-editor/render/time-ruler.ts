import type { SequenceEditorContext } from '../types'
import { computeGraduationInterval, msToPixel } from '../utils'
import { formatTimeMs, RULER_GRADUATION_LEVELS_MS, MIN_GRADUATION_GAP_PX } from '../constants'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createTimeRuler(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('seq-ruler')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

export function renderTimeRuler(svg: SVGSVGElement, ctx: SequenceEditorContext): void {
  const { viewport, scene, displayConfig } = ctx
  const { pxPerSec, scrollLeftMs, visibleDurationMs } = viewport
  const width = msToPixel(visibleDurationMs, pxPerSec) || svg.clientWidth
  const height = svg.clientHeight || 28

  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)

  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const intervalMs = computeGraduationInterval(pxPerSec, RULER_GRADUATION_LEVELS_MS, MIN_GRADUATION_GAP_PX)
  const startMs = Math.floor(scrollLeftMs / intervalMs) * intervalMs
  const endMs = scrollLeftMs + visibleDurationMs + intervalMs

  for (let t = startMs; t <= Math.min(endMs, scene.durationMs); t += intervalMs) {
    const x = msToPixel(t - scrollLeftMs, pxPerSec)

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
