import type { MachineContext } from '../machine'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createCueRow(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.classList.add('seq-cues')
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

export function renderCueRow(svg: SVGSVGElement, ctx: MachineContext): void {
  while (svg.firstChild) svg.removeChild(svg.firstChild)

  const { viewport, scene, layoutProfile } = ctx
  const { pixelsPerMs, startMs } = viewport
  const h = layoutProfile.rowHeightCues

  svg.setAttribute('height', String(h))

  for (const cue of scene.cues) {
    const x = (cue.timeMs - startMs) * pixelsPerMs

    const line = document.createElementNS(SVG_NS, 'line')
    line.setAttribute('x1', String(x))
    line.setAttribute('x2', String(x))
    line.setAttribute('y1', '4')
    line.setAttribute('y2', String(h))
    line.classList.add('seq-cue__line')
    line.dataset.cueId = cue.id
    svg.appendChild(line)

    const label = document.createElementNS(SVG_NS, 'text')
    label.setAttribute('x', String(x + 3))
    label.setAttribute('y', '12')
    label.classList.add('seq-cue__label')
    label.textContent = cue.label
    svg.appendChild(label)
  }
}
