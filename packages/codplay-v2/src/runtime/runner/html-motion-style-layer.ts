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

/** The transient presentation slots consumed by the stylesheet-backed HTML layer. */
const LOCAL_SIZE_SLOTS = ['--codplay-motion-width', '--codplay-motion-height'] as const
const LOCAL_TRANSFORM_SLOTS = ['--codplay-motion-transform'] as const
const LOCAL_ATTRIBUTES = ['data-codplay-motion-size', 'data-codplay-motion-transform'] as const
const HIDDEN_ATTRIBUTE = 'data-codplay-motion-hidden'
const PROJECTION_STYLE_ATTRIBUTE = 'data-codplay-motion-style'
const TRANSIENT_STYLE_SLOTS = ['--codplay-motion-width', '--codplay-motion-height', '--codplay-motion-transform'] as const
const TRANSIENT_ATTRIBUTES = [...LOCAL_ATTRIBUTES, HIDDEN_ATTRIBUTE] as const

const LOCAL_SIZE_PROPERTIES = ['width', 'height'] as const
const LOCAL_TRANSFORM_PROPERTIES = ['transition', 'transform-origin', 'translate', 'rotate', 'scale', 'transform'] as const

const PROJECTION_STYLE_TEXT = `
[data-codplay-motion-size] {
  width: var(--codplay-motion-width) !important;
  height: var(--codplay-motion-height) !important;
}

[data-codplay-motion-transform] {
  transition: none !important;
  transform-origin: 0 0 !important;
  translate: none !important;
  rotate: none !important;
  scale: none !important;
  transform: var(--codplay-motion-transform) !important;
}

[data-codplay-motion-hidden] {
  visibility: hidden !important;
}

[data-codplay-motion-seek] * {
  transition: none !important;
  animation: none !important;
}
`

const installedPresentationStyles = new WeakSet<Document>()

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
  const stylesheetBacked = installPresentationStyles(root)
  if (stylesheetBacked) return createStylesheetLayer()
  return createInlineFallbackLayer()
}

/** Creates the stylesheet-backed layer used by real browser hosts. */
function createStylesheetLayer(): HtmlMotionStyleLayer {
  const styleAttributePresence = new WeakMap<HTMLElement, boolean>()
  return {
    applyLocalSize: (node, width, height) => {
      rememberStyleAttributePresence(node, styleAttributePresence)
      setStyleSlot(node, '--codplay-motion-width', `${width}px`)
      setStyleSlot(node, '--codplay-motion-height', `${height}px`)
      node.setAttribute(LOCAL_ATTRIBUTES[0], '')
    },
    applyLocalTransform: (node, matrix) => {
      rememberStyleAttributePresence(node, styleAttributePresence)
      setStyleSlot(node, '--codplay-motion-transform', matrixCssValue(matrix))
      node.setAttribute(LOCAL_ATTRIBUTES[1], '')
    },
    clearLocal: (node) => clearStylesheetLocal(node, styleAttributePresence),
    applyHidden: (node) => node.setAttribute(HIDDEN_ATTRIBUTE, ''),
    clearHidden: (node) => node.removeAttribute(HIDDEN_ATTRIBUTE),
    captureTemplate: (node) => captureCleanTemplate(node),
    syncTemplate: (source, target) => syncCleanTemplate(source, target, () => undefined),
  }
}

/** Creates a deterministic inline fallback for lightweight DOM doubles. */
function createInlineFallbackLayer(): HtmlMotionStyleLayer {
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
    clearHidden: (node) => clearInlineContributions(node, ['visibility'], hiddenContributions),
    captureTemplate: (node) => captureInlineTemplate(node, localContributions, hiddenContributions),
    syncTemplate: (source, target) => syncCleanTemplate(source, target, (sourceNode, targetNode) => {
      if (!(sourceNode instanceof HTMLElement) || !(targetNode instanceof HTMLElement)) return
      restoreTemplateContributions(sourceNode, targetNode, localContributions)
      restoreTemplateContributions(sourceNode, targetNode, hiddenContributions)
    }),
  }
}

/** Clones one subtree after removing stylesheet-backed transient attributes. */
function captureCleanTemplate(node: HTMLElement): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement
  sanitizeTemplateTree(clone, () => undefined, node)
  return clone
}

/** Clones one subtree and restores the authored inline values behind transients. */
function captureInlineTemplate(
  node: HTMLElement,
  localContributions: WeakMap<HTMLElement, InlineContributionMap>,
  hiddenContributions: WeakMap<HTMLElement, InlineContributionMap>,
): HTMLElement {
  const clone = node.cloneNode(true) as HTMLElement
  sanitizeTemplateTree(clone, (source, target) => {
    restoreTemplateContributions(source, target, localContributions)
    restoreTemplateContributions(source, target, hiddenContributions)
  }, node)
  return clone
}

/** Synchronizes one existing source/template pair without creating stable child nodes. */
function syncCleanTemplate(
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
    if (isTransientAttribute(attribute.name)) {
      target.removeAttribute(attribute.name)
      continue
    }
    if (!sourceAttributes.has(attribute.name)) target.removeAttribute(attribute.name)
  }
  for (const [name, value] of sourceAttributes) {
    if (isTransientAttribute(name)) continue
    if (target.getAttribute(name) !== value) target.setAttribute(name, value)
  }
  for (const slot of TRANSIENT_STYLE_SLOTS) removeStyleSlot(target as HTMLElement, slot)
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

/** Tests whether one attribute is owned by the transient motion layer. */
function isTransientAttribute(name: string): boolean {
  return (TRANSIENT_ATTRIBUTES as readonly string[]).includes(name)
}

/** Narrows one node to an element without relying on a specific browser class. */
function isElementNode(value: Node): value is Element {
  return value.nodeType === 1
}

/** Walks a source/clone pair and removes every host-owned transient marker. */
function sanitizeTemplateTree(
  clone: HTMLElement,
  restore: (source: HTMLElement, target: HTMLElement) => void,
  source?: HTMLElement,
): void {
  for (const attribute of TRANSIENT_ATTRIBUTES) clone.removeAttribute(attribute)
  for (const slot of TRANSIENT_STYLE_SLOTS) removeStyleSlot(clone, slot)
  if (source !== undefined) restore(source, clone)

  const sourceChildren = source === undefined ? [] : Array.from(source.children)
  const cloneChildren = Array.from(clone.children)
  for (let index = 0; index < cloneChildren.length; index += 1) {
    const target = cloneChildren[index]
    const original = sourceChildren[index]
    if (!(target instanceof HTMLElement) || !(original instanceof HTMLElement)) continue
    sanitizeTemplateTree(target, restore, original)
  }
}

/** Restores the authored value when a live node still carries a transient slot. */
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

/** Installs the host stylesheet once per document, or selects the test fallback. */
function installPresentationStyles(root: Element): boolean {
  const document = (root as Element & { ownerDocument?: Document }).ownerDocument
  if (document === undefined) return false
  if (installedPresentationStyles.has(document)) return true

  const documentWithQueries = document as Document & {
    querySelector?: (selectors: string) => Element | null
  }
  const existing = documentWithQueries.querySelector?.(`style[${PROJECTION_STYLE_ATTRIBUTE}]`)
  if (existing !== null && existing !== undefined) {
    installedPresentationStyles.add(document)
    return true
  }

  const documentWithFactory = document as Document & {
    createElement?: (tagName: string) => HTMLElement
  }
  if (typeof documentWithFactory.createElement !== 'function') return false
  const style = documentWithFactory.createElement('style')
  style.setAttribute(PROJECTION_STYLE_ATTRIBUTE, '')
  style.textContent = PROJECTION_STYLE_TEXT
  const parent = document.head ?? document.documentElement ?? root
  if (typeof parent.appendChild !== 'function') return false
  parent.appendChild(style)
  installedPresentationStyles.add(document)
  return true
}

/** Clears all stylesheet-backed local slots while preserving authored properties. */
function clearStylesheetLocal(node: HTMLElement, styleAttributePresence: WeakMap<HTMLElement, boolean>): void {
  for (const attribute of LOCAL_ATTRIBUTES) node.removeAttribute(attribute)
  for (const slot of [...LOCAL_SIZE_SLOTS, ...LOCAL_TRANSFORM_SLOTS]) removeStyleSlot(node, slot)
  if (styleAttributePresence.get(node) === false && node.getAttribute('style') === '') node.removeAttribute('style')
  styleAttributePresence.delete(node)
}

/** Records whether a node had an authored style attribute before a local pose. */
function rememberStyleAttributePresence(node: HTMLElement, styleAttributePresence: WeakMap<HTMLElement, boolean>): void {
  if (!styleAttributePresence.has(node)) styleAttributePresence.set(node, node.getAttribute('style') !== null)
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

  writeStyleProperty(node, property, value, authored.priority === 'important' ? 'important' : '')
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

/** Writes one reserved CSS slot without touching an authored declaration. */
function setStyleSlot(node: HTMLElement, property: string, value: string): void {
  const style = node.style as unknown as StyleDeclarationLike
  if (typeof style.setProperty === 'function') style.setProperty(property, value)
  else style[property] = value
}

/** Removes one reserved CSS slot without restoring or replacing authored style text. */
function removeStyleSlot(node: HTMLElement, property: string): void {
  const style = node.style as unknown as StyleDeclarationLike
  if (typeof style.removeProperty === 'function') {
    style.removeProperty(property)
    return
  }
  delete style[property]
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

/** Writes one declaration while preserving an existing important author priority. */
function writeStyleProperty(node: HTMLElement, property: string, value: string, priority: string): void {
  const style = node.style as unknown as StyleDeclarationLike
  if (priority !== '' && typeof style.setProperty === 'function') {
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
