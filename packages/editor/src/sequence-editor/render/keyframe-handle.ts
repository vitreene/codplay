import type { Keyframe, LayoutProfile } from '../types'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createKeyframeHandle(
  kf: Keyframe,
  x: number,
  rowHeight: number,
  profile: LayoutProfile,
  centerY = rowHeight / 2,
  boundary?: 'intro' | 'outro',
): SVGGElement {
  const size = profile.keyframeHandleSizePx
  const half = size / 2
  const cy = centerY

  const g = document.createElementNS(SVG_NS, 'g')
  g.classList.add('seq-kf')
  g.dataset.kfId = kf.id
  if (kf.channel !== undefined) g.dataset.channel = kf.channel
  const keyframeLabel = kf.name === 'intro' || kf.name === 'outro' ? undefined : kf.name
  if (keyframeLabel) g.dataset.kfName = keyframeLabel

  if (boundary) g.classList.add(`seq-kf--${boundary}`)

  const diamond = document.createElementNS(SVG_NS, 'polygon')
  const points = boundary === 'intro'
    ? `${x},${cy - half} ${x + half},${cy} ${x},${cy + half}`
    : boundary === 'outro'
      ? `${x},${cy - half} ${x},${cy + half} ${x - half},${cy}`
      : `${x},${cy - half} ${x + half},${cy} ${x},${cy + half} ${x - half},${cy}`
  diamond.setAttribute('points', points)
  diamond.classList.add('seq-kf__diamond')

  g.appendChild(diamond)

  if (keyframeLabel) {
    const label = document.createElementNS(SVG_NS, 'text')
    label.setAttribute('x', String(x))
    label.setAttribute('y', String(cy - half - 2))
    label.classList.add('seq-kf__label')
    label.textContent = keyframeLabel
    g.appendChild(label)
  }

  return g
}
