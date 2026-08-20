import { isHtmlElementNode } from '../html-materializer-service-types'
import type { HtmlElementNode } from '../html-materializer-service-types'
import type { RuntimeComponentServiceInstance } from '../../runtime/catalog'
import type { ClassNamePatch } from './class-name-service'

/** Creates the component-scoped HTML adapter for the className service. */
export function createHtmlClassNameService(): RuntimeComponentServiceInstance {
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node)) return
      if (typeof value === 'string') {
        writeClassName(node, value)
        return
      }
      if (!isClassNamePatch(value)) return

      const classes = new Set(readClassName(node).split(/\s+/).filter(Boolean))
      for (const token of (value.add ?? '').split(/\s+/).filter(Boolean)) classes.add(token)
      for (const token of (value.remove ?? '').split(/\s+/).filter(Boolean)) classes.delete(token)
      writeClassName(node, [...classes].join(' '))
    },
  }
}

/** Checks the V1-compatible class delta shape at the materializer boundary. */
function isClassNamePatch(value: unknown): value is ClassNamePatch {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as { add?: unknown; remove?: unknown }
  return (candidate.add === undefined || typeof candidate.add === 'string')
    && (candidate.remove === undefined || typeof candidate.remove === 'string')
}

/** Reads the class attribute for HTML and SVG elements. */
function readClassName(node: HtmlElementNode): string {
  if (isSvgNode(node)) return node.getAttribute?.('class') ?? ''
  return typeof node.className === 'string' ? node.className : ''
}

/** Writes the class attribute for HTML and SVG elements. */
function writeClassName(node: HtmlElementNode, value: string): void {
  if (isSvgNode(node)) {
    if (value.length === 0) node.removeAttribute('class')
    else node.setAttribute('class', value)
    return
  }
  if ('className' in node) node.className = value
  else node.setAttribute('class', value)
}

/** Detects SVG nodes, whose className property is not a string. */
function isSvgNode(node: HtmlElementNode): boolean {
  return node.namespaceURI === 'http://www.w3.org/2000/svg'
}
