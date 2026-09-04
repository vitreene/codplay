import type { Keyframe, LayoutProfile } from '../types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createKeyframeHandle(
  kf: Keyframe,
  x: number,
  rowHeight: number,
  profile: LayoutProfile,
  centerY = rowHeight / 2,
): SVGGElement {
  const size = profile.keyframeHandleSizePx
  const half = size / 2
  const cy = centerY

  const g = document.createElementNS(SVG_NS, 'g')
  g.classList.add('seq-kf')
  g.dataset.kfId = kf.id
  if (kf.channel !== undefined) g.dataset.channel = kf.channel
  if (kf.name) g.dataset.kfName = kf.name

  const diamond = document.createElementNS(SVG_NS, 'polygon')
  diamond.setAttribute('points', `${x},${cy - half} ${x + half},${cy} ${x},${cy + half} ${x - half},${cy}`)
  diamond.classList.add('seq-kf__diamond')

  g.appendChild(diamond)

  if (kf.name) {
    const label = document.createElementNS(SVG_NS, 'text')
    label.setAttribute('x', String(x))
    label.setAttribute('y', String(cy - half - 2))
    label.classList.add('seq-kf__label')
    label.textContent = kf.name
    g.appendChild(label)
  }

  return g
}
