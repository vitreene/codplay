const ALLOWED_TAGS = new Set([
  'a', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'code', 'div', 'em', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'input', 'label', 'li',
  'main', 'nav', 'ol', 'option', 'p', 'pre', 'section', 'select', 'small', 'span', 'strong',
  'textarea', 'ul',
])

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])
const ALLOWED_ATTRIBUTES = new Set([
  'alt', 'class', 'disabled', 'for', 'hidden', 'id', 'lang', 'name', 'placeholder', 'role',
  'tabindex', 'title', 'type', 'value',
])
const URL_ATTRIBUTES = new Set(['href', 'src'])

import type { MarkupAttributeSanitizer } from '../../services'

type SanitizedNode =
  | { kind: 'text'; value: string }
  | { kind: 'element'; tag: string; attributes: SanitizedAttribute[]; children: SanitizedNode[] }

type SanitizedAttribute = Readonly<{
  name: string
  value: string
}>

type StackEntry = Readonly<{
  node: Extract<SanitizedNode, { kind: 'element' }>
  path: readonly number[]
}>

/** Sanitizes authored HTML before it enters the serializable CompiledScene. */
export function sanitizeMarkupTemplate(
  markup: string,
  sourcePath: string,
  sanitizers: readonly MarkupAttributeSanitizer[] = [],
): string {
  if (markup.trim().length === 0) throw new Error(`${sourcePath}: template must not be empty.`)

  const roots: SanitizedNode[] = []
  const parts: Array<{ partId: string; path: readonly number[] }> = []
  const seenParts = new Set<string>()
  const stack: StackEntry[] = []
  const tokens = /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g
  let cursor = 0

  for (const match of markup.matchAll(tokens)) {
    if (match.index !== cursor && markup.slice(cursor, match.index).trim().length > 0) {
      throw new Error(`${sourcePath}: invalid template syntax near offset ${cursor}.`)
    }
    cursor = (match.index ?? cursor) + match[0].length
    const token = match[0]
    if (token.startsWith('<!--')) continue
    if (!token.startsWith('<')) {
      if (token.trim().length === 0) continue
      appendNode(stack, roots, { kind: 'text', value: decodeEntities(token) })
      continue
    }
    if (token.startsWith('</')) {
      closeElement(token, stack, sourcePath)
      continue
    }

    const element = parseElement(token, sourcePath, sanitizers)
    const path = appendNode(stack, roots, element)
    const part = element.attributes.find((attribute) => attribute.name === 'data-part')
    if (part !== undefined) {
      const partId = part.value.trim()
      if (partId.length === 0) throw new Error(`${sourcePath}: data-part must not be empty.`)
      if (seenParts.has(partId)) throw new Error(`${sourcePath}: data-part is duplicated: ${partId}.`)
      seenParts.add(partId)
      parts.push({ partId, path })
    }
    if (!elementSelfClosing(token) && !VOID_TAGS.has(element.tag)) stack.push({ node: element, path })
  }

  if (cursor !== markup.length && markup.slice(cursor).trim().length > 0) {
    throw new Error(`${sourcePath}: invalid template syntax near offset ${cursor}.`)
  }
  if (stack.length > 0) throw new Error(`${sourcePath}: unclosed element: ${stack.at(-1)?.node.tag}.`)
  if (roots.length === 0) throw new Error(`${sourcePath}: template must produce at least one node.`)

  return roots.map(serializeNode).join('')
}

/** Parses one start tag and rejects elements or attributes outside the HTML profile. */
function parseElement(
  token: string,
  sourcePath: string,
  sanitizers: readonly MarkupAttributeSanitizer[],
): Extract<SanitizedNode, { kind: 'element' }> {
  const body = token.slice(1, -1).trim().replace(/\/\s*$/, '').trim()
  const tagMatch = /^([A-Za-z][A-Za-z0-9-]*)([\s\S]*)$/.exec(body)
  if (tagMatch === null) throw new Error(`${sourcePath}: invalid start tag.`)
  const tag = tagMatch[1].toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) throw new Error(`${sourcePath}: element is not allowed: ${tag}.`)
  const attributes = parseAttributes(tag, tagMatch[2], sourcePath, sanitizers)
  return { kind: 'element', tag, attributes, children: [] }
}

/** Parses quoted HTML attributes and rejects event and unsupported markup attributes. */
function parseAttributes(
  elementName: string,
  input: string,
  sourcePath: string,
  sanitizers: readonly MarkupAttributeSanitizer[],
): SanitizedAttribute[] {
  const attributes: SanitizedAttribute[] = []
  const names = new Set<string>()
  let cursor = 0
  while (cursor < input.length) {
    while (/\s/.test(input[cursor] ?? '')) cursor += 1
    if (cursor >= input.length) break
    const nameMatch = /^([^\s=/>]+)/.exec(input.slice(cursor))
    if (nameMatch === null) throw new Error(`${sourcePath}: invalid attribute syntax.`)
    const name = nameMatch[1].toLowerCase()
    cursor += name.length
    while (/\s/.test(input[cursor] ?? '')) cursor += 1
    if (input[cursor] !== '=') throw new Error(`${sourcePath}: boolean attribute is not allowed: ${name}.`)
    cursor += 1
    while (/\s/.test(input[cursor] ?? '')) cursor += 1
    const quote = input[cursor]
    if (quote !== '"' && quote !== "'") throw new Error(`${sourcePath}: attribute values must be quoted.`)
    cursor += 1
    const end = input.indexOf(quote, cursor)
    if (end < 0) throw new Error(`${sourcePath}: unterminated attribute: ${name}.`)
    const value = decodeEntities(input.slice(cursor, end))
    cursor = end + 1
    if (names.has(name)) throw new Error(`${sourcePath}: attribute is duplicated: ${name}.`)
    names.add(name)
    const sanitizedValue = applyServiceSanitizers(elementName, name, value, sourcePath, sanitizers)
    validateAttribute(name, sourcePath)
    attributes.push({ name, value: sanitizedValue })
  }
  return attributes
}

/** Delegates service-owned attribute policy before structural markup validation. */
function applyServiceSanitizers(
  elementName: string,
  attributeName: string,
  value: string,
  sourcePath: string,
  sanitizers: readonly MarkupAttributeSanitizer[],
): string {
  for (const sanitizer of sanitizers) {
    const result = sanitizer({ elementName, attributeName, value, path: sourcePath })
    if (result !== undefined) return result
  }
  if (attributeName === 'style') {
    throw new Error(`${sourcePath}: style attribute requires the style service.`)
  }
  return value
}

/** Applies the HTML profile to one parsed attribute. */
function validateAttribute(name: string, sourcePath: string): void {
  if (name.startsWith('on')) throw new Error(`${sourcePath}: event attribute is not allowed: ${name}.`)
  if (name === 'data-part' || name === 'style') return
  if (name.startsWith('data-') && name !== 'data-part') {
    throw new Error(`${sourcePath}: attribute is not allowed: ${name}.`)
  }
  if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('aria-') && !URL_ATTRIBUTES.has(name)) {
    throw new Error(`${sourcePath}: attribute is not allowed: ${name}.`)
  }
}

/** Appends one node and returns its stable child path. */
function appendNode(stack: readonly StackEntry[], roots: SanitizedNode[], node: SanitizedNode): readonly number[] {
  if (stack.length === 0) {
    const path = [roots.length]
    roots.push(node)
    return path
  }
  const parent = stack.at(-1)!.node
  const path = [...stack.at(-1)!.path, parent.children.length]
  parent.children.push(node)
  return path
}

/** Closes the current element and enforces properly nested markup. */
function closeElement(token: string, stack: StackEntry[], sourcePath: string): void {
  const name = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>$/.exec(token)?.[1]?.toLowerCase()
  if (name === undefined || stack.at(-1)?.node.tag !== name) {
    throw new Error(`${sourcePath}: mismatched closing tag.`)
  }
  stack.pop()
}

/** Detects explicit self-closing syntax. */
function elementSelfClosing(token: string): boolean {
  return /\/\s*>$/.test(token)
}

/** Decodes the small entity set needed before text/attribute values enter the template tree. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** Serializes the sanitized tree back to canonical markup for the compiled artifact. */
function serializeNode(node: SanitizedNode): string {
  if (node.kind === 'text') return escapeText(node.value)
  const attributes = node.attributes.map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`).join('')
  const opening = `<${node.tag}${attributes}>`
  if (VOID_TAGS.has(node.tag)) return opening
  return `${opening}${node.children.map(serializeNode).join('')}</${node.tag}>`
}

/** Escapes text before it is stored back in compiled markup. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escapes one serialized attribute value. */
function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;')
}
