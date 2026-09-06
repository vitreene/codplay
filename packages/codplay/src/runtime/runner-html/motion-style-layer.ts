import type { HtmlMatrix } from '../motion/html-types'

type StyleSnapshot = Readonly<{
  value: string
  priority: string
}>

type InlineContribution = {
  authored: StyleSnapshot
  transient: StyleSnapshot
}

type InlineContributionMap = Map<string, InlineContribution>

type StyleDeclarationLike = {
  [property: string]: unknown
  setProperty?: (property: string, value: string, priority?: string) => void
  getPropertyValue?: (property: string) => string
  getPropertyPriority?: (property: string) => string
  removeProperty?: (property: string) => string
}

/** The authored properties temporarily replaced by a local motion pose. */
const LOCAL_SIZE_PROPERTIES = ['width', 'height'] as const
const LOCAL_TRANSFORM_PROPERTIES = ['transition', 'transform-origin', 'translate', 'rotate', 'scale', 'transform'] as const
const HIDDEN_PROPERTIES = ['visibility'] as const

const SEEK_STYLE_TEXT = `
[data-codplay-motion-seek] * {
  transition: none !important;
  animation: none !important;
}
`

const installedSeekStyles = new WeakSet<Document>()

/** Host-owned transient contribution layer for local poses and overlay visibility. */
export type HtmlMotionStyleLayer = Readonly<{
  applyLocalSize: (node: HTMLElement, width: number, height: number) => void
  applyLocalTransform: (node: HTMLElement, matrix: HtmlMatrix) => void
  clearLocal: (node: HTMLElement) => void
  applyHidden: (node: HTMLElement) => void
  clearHidden: (node: HTMLElement) => void
  /** Clones a subtree without carrying host-owned transient presentation state. */
  captureTemplate: (node: HTMLElement) => HTMLElement
  /** Synchronizes an existing template without creating DOM nodes when its structure is stable. */
  syncTemplate: (source: HTMLElement, target: HTMLElement) => boolean
}>

/** Creates a transient presentation layer without taking ownership of authored CSS declarations. */
export function createHtmlMotionStyleLayer(root: Element): HtmlMotionStyleLayer {
  installSeekStyles(root)
  return createInlineLayer()
}

/** Creates the inline layer used by browser hosts and lightweight DOM doubles alike. */
function createInlineLayer(): HtmlMotionStyleLayer {
  const localContributions = new WeakMap<HTMLElement, InlineContributionMap>()
  const hiddenContributions = new WeakMap<HTMLElement, InlineContributionMap>()
  return {
    applyLocalSize: (node, width, height) => {
      applyInlineContribution(node, 'width', `${width}px`, localContributions)
      applyInlineContribution(node, 'height', `${height}px`, localContributions)
    },
    applyLocalTransform: (node, matrix) => {
      applyInlineContribution(node, 'transition', 'none', localContributions)
      applyInlineContribution(node, 'transform-origin', '0 0', localContributions)
      applyInlineContribution(node, 'translate', 'none', localContributions)
      applyInlineContribution(node, 'rotate', 'none', localContributions)
      applyInlineContribution(node, 'scale', 'none', localContributions)
      applyInlineContribution(node, 'transform', matrixCssValue(matrix), localContributions)
    },
    clearLocal: (node) => {
      clearInlineContributions(node, LOCAL_SIZE_PROPERTIES, localContributions)
      clearInlineContributions(node, LOCAL_TRANSFORM_PROPERTIES, localContributions)
    },
    applyHidden: (node) => applyInlineContribution(node, 'visibility', 'hidden', hiddenContributions),
    clearHidden: (node) => clearInlineContributions(node, HIDDEN_PROPERTIES, hiddenContributions),
    captureTemplate: (node) => captureInlineTemplate(node, localContributions, hiddenContributions),
    syncTemplate: (source, target) => syncInlineTemplate(source, target, (sourceNode, targetNode) => {
      if (!(sourceNode instanceof HTMLElement) || !(targetNode instanceof HTMLElement)) return
      restoreTemplateContributions(sourceNode, targetNode, localContributions)
      restoreTemplateContributions(sourceNode, targetNode, hiddenContributions)
    }),
  }
}

/** Clones one subtree and restores the authored inline values behind transients. */
function captureInlineTemplate(
  node: HTMLElement,
  localContributions: WeakMap<HTMLElement, InlineContributionMap>,
  hiddenContributions: WeakMap<HTMLElement, InlineContributionMap>,
): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement
  restoreTemplateTree(node, clone, (source, target) => {
    restoreTemplateContributions(source, target, localContributions)
    restoreTemplateContributions(source, target, hiddenContributions)
  })
  return clone
}

/** Synchronizes one existing source/template pair without creating stable child nodes. */
function syncInlineTemplate(
  source: HTMLElement,
  target: HTMLElement,
  restore: (source: Element, target: Element) => void,
): boolean {
  return syncTemplateTree(source, target, restore)
}

/** Synchronizes attributes and text for a structurally identical element subtree. */
function syncTemplateTree(
  source: Element,
  target: Element,
  restore: (source: Element, target: Element) => void,
): boolean {
  if (source.tagName !== target.tagName || source.namespaceURI !== target.namespaceURI) return false

  const sourceAttributes = new Map(Array.from(source.attributes).map((attribute) => [attribute.name, attribute.value]))
  for (const attribute of Array.from(target.attributes)) {
    if (!sourceAttributes.has(attribute.name)) target.removeAttribute(attribute.name)
  }
  for (const [name, value] of sourceAttributes) {
    if (target.getAttribute(name) !== value) target.setAttribute(name, value)
  }
  restore(source, target)

  const sourceChildren = Array.from(source.childNodes)
  const targetChildren = Array.from(target.childNodes)
  if (sourceChildren.length !== targetChildren.length) return false
  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index]
    const targetChild = targetChildren[index]
    if (sourceChild.nodeType !== targetChild.nodeType) return false
    if (isElementNode(sourceChild) && isElementNode(targetChild)) {
      if (!syncTemplateTree(sourceChild, targetChild, restore)) return false
      continue
    }
    if (sourceChild.nodeValue !== targetChild.nodeValue) targetChild.nodeValue = sourceChild.nodeValue
  }
  return true
}

/** Narrows one node to an element without relying on a specific browser class. */
function isElementNode(value: Node): value is Element {
  return value.nodeType === 1
}

/** Walks a source/clone pair and restores host-owned properties to authored values. */
function restoreTemplateTree(
  source: HTMLElement,
  clone: HTMLElement,
  restore: (source: HTMLElement, target: HTMLElement) => void,
): void {
  restore(source, clone)

  const sourceChildren = Array.from(source.children)
  const cloneChildren = Array.from(clone.children)
  for (let index = 0; index < cloneChildren.length; index += 1) {
    const target = cloneChildren[index]
    const original = sourceChildren[index]
    if (!(target instanceof HTMLElement) || !(original instanceof HTMLElement)) continue
    restoreTemplateTree(original, target, restore)
  }
}

/** Restores the authored value represented by one host-owned contribution. */
function restoreTemplateContributions(
  source: HTMLElement,
  target: HTMLElement,
  contributions: WeakMap<HTMLElement, InlineContributionMap>,
): void {
  const nodeContributions = contributions.get(source)
  if (nodeContributions === undefined) return
  for (const [property, contribution] of nodeContributions) {
    const current = readStyleProperty(source, property)
    const authored = sameStyleSnapshot(current, contribution.transient) ? contribution.authored : current
    restoreStyleProperty(target, property, authored)
  }
}

/** Installs the root-scoped seek lock once per document. */
function installSeekStyles(root: Element): void {
  const document = (root as Element & { ownerDocument?: Document }).ownerDocument
  if (document === undefined || installedSeekStyles.has(document)) return

  const documentWithFactory = document as Document & {
    createElement?: (tagName: string) => HTMLElement
  }
  if (typeof documentWithFactory.createElement !== 'function') return
  const style = documentWithFactory.createElement('style')
  style.textContent = SEEK_STYLE_TEXT
  const parent = document.head ?? document.documentElement ?? root
  if (typeof parent.appendChild !== 'function') return
  parent.appendChild(style)
  installedSeekStyles.add(document)
}

/** Applies one inline transient property while tracking concurrent author writes. */
function applyInlineContribution(
  node: HTMLElement,
  property: string,
  value: string,
  contributions: WeakMap<HTMLElement, InlineContributionMap>,
): void {
  let nodeContributions = contributions.get(node)
  if (nodeContributions === undefined) {
    nodeContributions = new Map()
    contributions.set(node, nodeContributions)
  }

  const previous = nodeContributions.get(property)
  let authored = previous?.authored ?? readStyleProperty(node, property)
  if (previous !== undefined) {
    const current = readStyleProperty(node, property)
    if (sameStyleSnapshot(current, previous.transient)) restoreStyleProperty(node, property, authored)
    else authored = current
  }

  // The host must win over authored styles while the transient pose is active.
  // The authored priority is retained in the snapshot and restored on clear.
  writeStyleProperty(node, property, value, 'important')
  nodeContributions.set(property, { authored, transient: readStyleProperty(node, property) })
}

/** Removes inline transient properties and restores only values not changed by the author. */
function clearInlineContributions(
  node: HTMLElement,
  properties: readonly string[],
  contributions: WeakMap<HTMLElement, InlineContributionMap>,
): void {
  const nodeContributions = contributions.get(node)
  if (nodeContributions === undefined) return
  for (const property of properties) {
    const contribution = nodeContributions.get(property)
    if (contribution === undefined) continue
    const current = readStyleProperty(node, property)
    if (sameStyleSnapshot(current, contribution.transient)) restoreStyleProperty(node, property, contribution.authored)
    nodeContributions.delete(property)
  }
  if (nodeContributions.size === 0) contributions.delete(node)
}

/** Reads one CSS declaration in both browser styles and minimal test doubles. */
function readStyleProperty(node: HTMLElement, property: string): StyleSnapshot {
  const style = node.style as unknown as StyleDeclarationLike
  const value = typeof style.getPropertyValue === 'function'
    ? style.getPropertyValue(property)
    : readFallbackStyleValue(style, property)
  const priority = typeof style.getPropertyPriority === 'function'
    ? style.getPropertyPriority(property)
    : ''
  return { value: value ?? '', priority: priority ?? '' }
}

/** Reads a camel-case declaration from a style-like object without normalizing it. */
function readFallbackStyleValue(style: StyleDeclarationLike, property: string): string {
  const camelProperty = cssPropertyToJavaScript(property)
  const value = style[camelProperty] ?? style[property]
  return typeof value === 'string' ? value : ''
}

/** Writes one declaration with the requested cascade priority. */
function writeStyleProperty(node: HTMLElement, property: string, value: string, priority: string): void {
  const style = node.style as unknown as StyleDeclarationLike
  if (typeof style.setProperty === 'function') {
    style.setProperty(property, value, priority)
    return
  }
  style[cssPropertyToJavaScript(property)] = value
}

/** Restores one declaration or removes it when the authored value was absent. */
function restoreStyleProperty(node: HTMLElement, property: string, snapshot: StyleSnapshot): void {
  if (snapshot.value === '') {
    removeInlineStyleProperty(node, property)
    return
  }
  writeStyleProperty(node, property, snapshot.value, snapshot.priority)
}

/** Removes one declaration from a browser style or a minimal style double. */
function removeInlineStyleProperty(node: HTMLElement, property: string): void {
  const style = node.style as unknown as StyleDeclarationLike
  if (typeof style.removeProperty === 'function') {
    style.removeProperty(property)
    return
  }
  delete style[cssPropertyToJavaScript(property)]
  delete style[property]
}

/** Compares a live declaration with the last transient value written by this layer. */
function sameStyleSnapshot(left: StyleSnapshot, right: StyleSnapshot): boolean {
  return left.value === right.value && left.priority === right.priority
}

/** Converts a CSS property name to the JavaScript style property used by doubles. */
function cssPropertyToJavaScript(property: string): string {
  return property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

/** Serializes one affine matrix into the CSS transform function used by the presentation. */
function matrixCssValue(matrix: HtmlMatrix): string {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`
}
