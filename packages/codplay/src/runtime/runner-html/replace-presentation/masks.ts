import type { SlotReplaceShape } from '../../components'



const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const MASK_PATHS = {
  circle: 'M50 0 A50 50 0 1 1 50 100 A50 50 0 1 1 50 0 Z',
  diamond: 'M50 0 L100 50 L50 100 L0 50 Z',
  rect: 'M0 0 H100 V100 H0 Z',
} as const

export type MaskShapeDefinition = Readonly<{
  path: string
  viewBox: string
}>


/** Applies the generated alpha mask used by the expanding reveal. */
export function setMaskImage(snapshot: HTMLElement, shape: SlotReplaceShape): void {
  const mask = createMaskDataUrl(shape)
  snapshot.style.setProperty('mask-image', mask)
  snapshot.style.setProperty('-webkit-mask-image', mask)
  snapshot.style.setProperty('mask-position', 'center')
  snapshot.style.setProperty('-webkit-mask-position', 'center')
  snapshot.style.setProperty('mask-repeat', 'no-repeat')
  snapshot.style.setProperty('-webkit-mask-repeat', 'no-repeat')
  snapshot.style.setProperty('mask-mode', 'alpha')
  snapshot.style.setProperty('mask-size', '0% auto')
  snapshot.style.setProperty('-webkit-mask-size', '0% auto')
}


/** Serializes one preset or author path into an SVG alpha mask data URL. */
export function createMaskDataUrl(shape: SlotReplaceShape): string {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('xmlns', SVG_NAMESPACE)
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const definition = getMaskShapeDefinition(shape)
  const viewport = document.createElementNS(SVG_NAMESPACE, 'svg')
  viewport.setAttribute('width', '100')
  viewport.setAttribute('height', '100')
  viewport.setAttribute('viewBox', definition.viewBox)
  viewport.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  const path = document.createElementNS(SVG_NAMESPACE, 'path')
  path.setAttribute('d', definition.path)
  path.setAttribute('fill', 'white')
  viewport.append(path)
  svg.append(viewport)

  const serialized = new XMLSerializer().serializeToString(svg)
  return `url("data:image/svg+xml,${encodeURIComponent(serialized)}")`
}

/** Resolves one named or author mask shape to its reusable SVG path definition. */
export function getMaskShapeDefinition(shape: SlotReplaceShape | 'rect'): MaskShapeDefinition {
  if (shape === 'circle') return { path: MASK_PATHS.circle, viewBox: '0 0 100 100' }
  if (shape === 'diamond') return { path: MASK_PATHS.diamond, viewBox: '0 0 100 100' }
  if (shape === 'star') return { path: createStarPath(), viewBox: '0 0 100 100' }
  if (shape === 'rect') return { path: MASK_PATHS.rect, viewBox: '0 0 100 100' }
  return { path: shape.path, viewBox: shape.viewBox }
}


/** Adds one filled path to the generated SVG mask. */
export function appendMaskPath(svg: SVGSVGElement, data: string): void {
  const path = document.createElementNS(SVG_NAMESPACE, 'path')
  path.setAttribute('d', data)
  path.setAttribute('fill', 'white')
  svg.append(path)
}


/** Builds a centered five-point star path on a normalized square. */
export function createStarPath(): string {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = (-90 + index * 36) * Math.PI / 180
    const radius = index % 2 === 0 ? 49 : 22
    const x = 50 + Math.cos(angle) * radius
    const y = 50 + Math.sin(angle) * radius
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`
  })
  return `${points.join(' ')} Z`
}


/** Chooses an oversized mask extent that covers tall and wide slot rectangles. */
export function getMaskExtent(root: Element): number {
  const rect = root.getBoundingClientRect()
  const aspect = rect.width === 0 ? 1 : rect.height / rect.width
  return 340 * Math.max(1, aspect)
}
