import { SaxesParser } from 'saxes'
import type { XmlElement, XmlLocation, XmlNode, XmlParseIssue, XmlSourceDocument } from './source-model'

type MutableElement = {
  kind: 'element'
  name: string
  attributes: Record<string, string>
  children: XmlNode[]
  location: XmlLocation
}

/** Parses one XML string into an ordered tree with element provenance. */
export function parseXmlDocument(documentId: string, xml: string): XmlSourceDocument {
  const parser = new SaxesParser({ fileName: documentId, position: true })
  const stack: MutableElement[] = []
  const startLocations: XmlLocation[] = []
  const errors: XmlParseIssue[] = []
  let root: MutableElement | undefined

  /** Captures the current parser position for an XML tree node. */
  const readLocation = (): XmlLocation => ({
    documentId,
    line: parser.line,
    column: parser.column + 1,
    path: `/${stack.map(({ name }) => name).join('/')}`,
  })

  /** Adds one text or CDATA value to the currently open element. */
  const appendText = (value: string): void => {
    const parent = stack.at(-1)
    if (parent === undefined || value.length === 0) return
    parent.children.push({ kind: 'text', value, location: readLocation() })
  }

  parser.on('opentagstart', (tag) => {
    const parentPath = stack.map(({ name }) => name).join('/')
    startLocations.push({
      documentId,
      line: parser.line,
      column: Math.max(1, parser.column - tag.name.length),
      path: `/${parentPath ? `${parentPath}/` : ''}${tag.name}`,
    })
  })
  parser.on('opentag', (tag) => {
    const element: MutableElement = {
      kind: 'element',
      name: tag.name,
      attributes: Object.fromEntries(Object.entries(tag.attributes).map(([name, value]) => [name, String(value)])),
      children: [],
      location: startLocations.pop()!,
    }
    const parent = stack.at(-1)
    if (parent === undefined) root = element
    else parent.children.push(element)
    stack.push(element)
  })
  parser.on('text', appendText)
  parser.on('cdata', appendText)
  parser.on('closetag', () => { stack.pop() })
  parser.on('error', (error) => {
    errors.push({ message: error.message, line: parser.line, column: parser.column + 1 })
  })
  parser.write(xml).close()

  if (errors.length > 0) {
    const [first] = errors
    throw new Error(`${documentId}:${first!.line}:${first!.column}: ${first!.message}`)
  }
  if (root === undefined) throw new Error(`${documentId}: XML document has no root element.`)
  return { documentId, root: freezeElement(root) }
}

/** Freezes one completed mutable XML subtree at the reader boundary. */
function freezeElement(element: MutableElement): XmlElement {
  return {
    kind: 'element',
    name: element.name,
    attributes: element.attributes,
    children: element.children.map((child) => child.kind === 'element' ? freezeElement(child as MutableElement) : child),
    location: element.location,
  }
}

/** Returns the ordered text content of an element and all its descendants. */
export function readTextContent(element: XmlElement): string {
  return element.children.map((child) => child.kind === 'text' ? child.value : readTextContent(child)).join('')
}

/** Returns every descendant element matching an exact tag name. */
export function findElements(element: XmlElement, tagName: string): readonly XmlElement[] {
  return element.children.flatMap((child) => {
    if (child.kind !== 'element') return []
    return [ ...(child.name === tagName ? [child] : []), ...findElements(child, tagName) ]
  })
}

/** Returns only the direct element children of an XML element. */
export function getElementChildren(element: XmlElement): readonly XmlElement[] {
  return element.children.filter((child): child is XmlElement => child.kind === 'element')
}
