import type { StrapFunction } from 'codplay/runtime/player/pipeline/strap-executor'

type Click = Readonly<{
  request: string
  event: string
  list: string
  icon: string
  shape: string
  color: string
  colorDuration: number
  duration: number
  rotation: number
  scale: number
}>

const CLICK_PATTERN = /^showItem\('([\w-]+)'\);TweenMax\.to\('#([\w-]+)',([\d.]+),\{fill:'(#[\da-f]{6})'\}\);TweenMax\.to\('#([\w-]+)',([\d.]+),\{rotation:(-?[\d.]+),scale:([\d.]+)\}\)$/i

/** Reads the complete sequence of operations exercised by the five SPIE hotspots. */
export function readClick(element: Element): Click {
  const id = element.getAttribute('id')
  const call = element.getAttribute('onClick') ?? ''
  const match = CLICK_PATTERN.exec(call)
  if (!id || match === null) throw new Error(`Unsupported SPIE click on ${id}: ${call}`)
  const [, list, shape, colorDuration, color, icon, duration, rotation, scale] = match
  return {
    request: `${id}:open`,
    event: `${id}:activate`,
    list: list!,
    icon: icon!,
    shape: shape!,
    color: color!,
    colorDuration: Number(colorDuration) * 1_000,
    duration: Number(duration) * 1_000,
    rotation: Number(rotation),
    scale: Number(scale),
  }
}

/** Reveals each list once and plans the terminal event after the last reveal and narration. */
export function createListCompletion(clicks: readonly Click[], revealMs: number, narrationMs: number): StrapFunction {
  return ({ event, state, context }) => {
    const click = clicks.find(({ request }) => request === event.name)
    if (click === undefined || state[click.list] === true) return

    const reveal = { update: { [click.list]: true }, events: [{ name: click.event }] }
    if (clicks.some(({ list }) => list !== click.list && state[list] !== true)) return reveal

    const remainingMs = Math.max(revealMs, click.colorDuration, click.duration, narrationMs - (event.applyAtMs ?? 0))
    return [reveal, context.planned.wait(remainingMs, {
      event: { name: 'sequence:end', visibility: 'public' },
    })]
  }
}

/** Exposes the source fill through the color of the CodPlay layout owning the SVG. */
export function createIconMarkup(svgText: string, iconId: string, shapeId: string): string {
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const svg = document.documentElement
  const shape = document.getElementById(shapeId)
  if (svg.localName !== 'svg' || shape === null) throw new Error(`Missing SVG target ${shapeId} in ${iconId}.`)
  const style = document.querySelector('style')
  const fillRule = new RegExp(`^\\s*#${shapeId}\\s*\\{\\s*fill:\\s*gray;\\s*\\}\\s*$`)
  if (style === null || !fillRule.test(style.textContent ?? '')) throw new Error(`Unsupported fill declaration for ${shapeId}.`)
  style.remove()
  shape.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  Array.from(svg.querySelectorAll('*')).filter((node) => node.children.length > 0 && node !== shape).forEach((node, index) => {
    node.id = `${iconId}-group-${index + 1}`
  })
  svg.id = `${iconId}-drawing`
  return `<div id="${iconId}">${new XMLSerializer().serializeToString(svg)}</div>`
}
