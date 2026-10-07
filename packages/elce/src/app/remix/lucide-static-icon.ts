import type { RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'

/** Converts a trusted Lucide SVG asset into native Remix elements. */
export function renderLucideIcon(svg: string, id: string, size: number): RemixNode {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  if (root.localName !== 'svg') throw new Error('Lucide asset is not an SVG element.')

  return jsx('svg', {
    ...svgAttributes(root),
    id,
    width: size,
    height: size,
    'aria-hidden': true,
    children: [...root.children].map((child, index) => renderSvgElement(child, `${id}-${index}`)),
  })
}

/** Builds one SVG child as a Remix node and identifies nested parent elements. */
function renderSvgElement(element: Element, id: string): RemixNode {
  const children = [...element.children].map((child, index) => renderSvgElement(child, `${id}-${index}`))
  const attributes = svgAttributes(element)
  if (children.length > 0) attributes.id ??= id
  return jsx(element.localName, { ...attributes, children })
}

/** Adapts SVG attribute names for Remix while preserving their values. */
function svgAttributes(element: Element): Record<string, string> {
  return Object.fromEntries([...element.attributes].map(({ name, value }) => {
    const attributeName = name.startsWith('aria-') || name.startsWith('data-')
      ? name
      : name.replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase())
    return [attributeName, value]
  }))
}
