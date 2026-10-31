import { OFFSET_STYLE_PROPERTIES } from '../decor-editor/units'
import { resolveContentInsetStyles } from '../motion-editor/border-insets'
import { contentBoxLayoutDisplacement } from '../motion-editor/content-box'

type Length = Readonly<{ cqw: number; px: number }>

/** Reads the logical/physical lengths already qualified by the native compiler. */
function readLength(value: unknown): Length | null {
  if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'length'
    && 'value' in value && typeof value.value === 'number' && 'unit' in value) {
    if (value.unit === 'cqw') return { cqw: value.value, px: 0 }
    if (value.unit === 'px') return { cqw: 0, px: value.value }
    return null
  }
  if (typeof value === 'number') return { cqw: value, px: 0 }
  if (typeof value !== 'string') return null
  const match = value.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(cqw|px)$/)
  if (match === null) return null
  return match[2] === 'cqw' ? { cqw: Number(match[1]), px: 0 } : { cqw: 0, px: Number(match[1]) }
}

/** Serializes a derived length without losing its responsive or fixed contribution. */
function formatLength(value: Length): string {
  if (value.px === 0) return `${value.cqw}cqw`
  if (value.cqw === 0) return `${value.px}px`
  return `calc(${value.cqw}cqw ${value.px < 0 ? '-' : '+'} ${Math.abs(value.px)}px)`
}

/** Projects one resolved item state into its frame and private native representation. */
export function projectItemStyle(style: Readonly<Record<string, unknown>>, pixelRatio: number) {
  const insets = resolveContentInsetStyles(style, pixelRatio)
  const origin = typeof style['transform-origin'] === 'string'
    ? style['transform-origin'].trim().split(/\s+/).map((value) => Number.parseFloat(value) / 100)
    : undefined
  const frame = {
    x: 0, y: 0, width: 0, height: 0,
    rotate: typeof style.rotate === 'number' ? style.rotate : 0,
    scaleX: typeof style.scaleX === 'number' ? style.scaleX : 1,
    scaleY: typeof style.scaleY === 'number' ? style.scaleY : 1,
    ...(origin === undefined ? {} : { rotationOrigin: { fx: origin[0]!, fy: origin[1]! } }),
  }
  const contributions = Object.entries(insets).filter(([, css]) => css !== '0px').map(([side, css]) => {
    const displacement = contentBoxLayoutDisplacement(frame, { top: 0, right: 0, bottom: 0, left: 0, [side]: 1 })
    return { css, x: -displacement.x, y: -displacement.y,
      width: side === 'left' || side === 'right' ? 1 : 0,
      height: side === 'top' || side === 'bottom' ? 1 : 0 }
  })
  const frameStyle: Record<string, unknown> = { position: 'relative', overflow: 'visible' }
  const visualStyle: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(style)) {
    const ownsGeometry = OFFSET_STYLE_PROPERTIES.has(property)
      || property === 'transform' || property === 'translate' || property === 'scale'
    if (!ownsGeometry || property === 'width' || property === 'height') visualStyle[property] = value
    if (ownsGeometry) frameStyle[property] = value
  }
  for (const property of ['x', 'y', 'width', 'height'] as const) {
    const value = readLength(style[property])
    if (value === null) continue
    const terms = contributions.filter((contribution) => contribution[property] !== 0).map((contribution) => {
      const coefficient = contribution[property]
      return `${coefficient < 0 ? ' - ' : ' + '}${Math.abs(coefficient) === 1 ? '' : `${Math.abs(coefficient)} * `}${contribution.css}`
    }).join('')
    frameStyle[property] = terms === '' ? formatLength(value) : `calc(${formatLength(value)}${terms})`
  }
  return { frameStyle, visualStyle }
}
