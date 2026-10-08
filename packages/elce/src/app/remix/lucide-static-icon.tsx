import type { RemixNode } from 'remix/ui'

/** Converts a trusted Lucide SVG asset into native Remix elements. */
export function renderLucideIcon(svg: string, id: string, size: number): RemixNode {
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement
  if (root.localName !== 'svg') throw new Error('Lucide asset is not an SVG element.')

  return <svg
    {...svgAttributes(root)}
    id={id}
    width={size}
    height={size}
    aria-hidden={true}
  >
    {[...root.children].map((child, index) => renderSvgElement(child, `${id}-${index}`))}
  </svg>
}

/** Builds one SVG child as a Remix node and identifies nested parent elements. */
function renderSvgElement(element: Element, id: string): RemixNode {
  const children = [...element.children].map((child, index) => renderSvgElement(child, `${id}-${index}`))
  const attributes = svgAttributes(element)
  const Tag = element.localName as keyof JSX.IntrinsicSVGElements
  return <Tag
    {...attributes}
    id={children.length > 0 ? attributes.id ?? id : attributes.id}
  >
    {children}
  </Tag>
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
