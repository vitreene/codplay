import { utils } from 'animejs'

import { RUNTIME_OBJECT_EVENT_HANDLERS, type CreateElementOptions } from '../../create-element'
import { startCaptureSession } from '../../capture-session'
import type { EmitRule, EmitRuleAction, ItemDoc, RuntimeEmitEvent, RuntimeEmitSelf } from '../../types'
import { resolveContainerQueryValue } from './container-query-units'

const SELF_PAYLOAD_KEY = 'self'

type RuntimeObjectEventNode = Record<string, unknown> & {
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

/**
 * Normalizes one authored emit declaration into one action list.
 */
function normalizeEmitRuleActions(rule: EmitRule): EmitRuleAction[] {
  return Array.isArray(rule) ? rule : [rule]
}

/**
 * Keeps only emit actions that target the component root.
 */
function resolveRootEmitRule(rule: EmitRule): EmitRuleAction[] {
  return normalizeEmitRuleActions(rule).filter((action) => action.ref === undefined || action.ref === 'root')
}

/**
 * Checks whether one runtime node reference is a browser Element.
 */
export function isDomElement(nodeRef: unknown): nodeRef is Element {
  if (typeof globalThis.Element === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Element
}

/**
 * Checks whether one runtime node reference is a browser Node.
 */
export function isDomNode(nodeRef: unknown): nodeRef is Node {
  if (typeof globalThis.Node === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Node
}

/**
 * Resolves final scalar value from either literal or transition object.
 */
export function resolveFinalValue(rawValue: unknown): unknown {
  if (typeof rawValue !== 'object' || rawValue === null) {
    return rawValue
  }

  const transitionLike = rawValue as { to?: unknown }
  if (transitionLike.to !== undefined) {
    return transitionLike.to
  }

  return rawValue
}

/**
 * Checks whether one style payload entry is a transition definition.
 */
function isTransitionStyleValue(rawValue: unknown): rawValue is { to: unknown } {
  return typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue
}


/**
 * Creates one runtime self payload exposed during perso emit.
 */
function createRuntimeEmitSelf(item: ItemDoc): RuntimeEmitSelf {
  return {
    id: item.id,
    name: item.name,
    storyId: item.storyId
  }
}

/**
 * Emits all declared runtime events for one user interaction.
 * When the DOM event target is an HTMLInputElement, includes `value` (string)
 * and `valueAsNumber` (number) in the event data so straps and transforms
 * can read the current input value without coupling to the DOM.
 */
function emitDeclaredRuntimeEvents(
  item: ItemDoc,
  userEvent: string,
  emitRuntimeEvent: (event: RuntimeEmitEvent) => void,
  domEvent?: Event
): void {
  const rule = item.emit?.[userEvent]
  if (!rule) {
    return
  }

  const self = createRuntimeEmitSelf(item)
  const htmlInputElement = globalThis.HTMLInputElement
  const inputPayload =
    typeof htmlInputElement === 'function' && domEvent?.target instanceof htmlInputElement
      ? { value: domEvent.target.value, valueAsNumber: domEvent.target.valueAsNumber }
      : undefined

  for (const action of resolveRootEmitRule(rule)) {
    const base = action.data === undefined ? { [SELF_PAYLOAD_KEY]: self } : { ...action.data, [SELF_PAYLOAD_KEY]: self }
    const data = inputPayload !== undefined ? { ...base, ...inputPayload } : base
    emitRuntimeEvent({
      name: action.event.name,
      data,
      cascade: action.event.cascade,
      scopeStoryId: item.storyId
    })
  }
}

/**
 * Reads the current translateX/translateY from one DOM element's computed transform.
 */
function readElementTranslation(element: Element): { x: number; y: number } {
  const style = globalThis.getComputedStyle?.(element as HTMLElement)
  const transform = style?.transform
  if (!transform || transform === 'none') {
    return { x: 0, y: 0 }
  }

  if (typeof globalThis.DOMMatrix === 'undefined') {
    return { x: 0, y: 0 }
  }

  const matrix = new globalThis.DOMMatrix(transform)
  return { x: matrix.m41, y: matrix.m42 }
}

/**
 * Binds authored user event emits on DOM and object runtime nodes.
 */
function bindRuntimeEmitDeclarations(nodeRef: unknown, item: ItemDoc, options: CreateElementOptions | undefined): void {
  const emitRuntimeEvent = options?.emitRuntimeEvent
  if (!emitRuntimeEvent || !item.emit) {
    return
  }

  for (const userEvent of Object.keys(item.emit)) {
    const rule = item.emit[userEvent]
    const captureSpec = resolveRootEmitRule(rule).find((action) => action.capture !== undefined)?.capture

    if (isDomElement(nodeRef)) {
      nodeRef.addEventListener(userEvent, (domEvent) => {
        emitDeclaredRuntimeEvents(item, userEvent, emitRuntimeEvent, domEvent)

        if (captureSpec !== undefined && domEvent instanceof PointerEvent) {
          const base = readElementTranslation(nodeRef)
          startCaptureSession({
            capture: captureSpec,
            startX: domEvent.clientX,
            startY: domEvent.clientY,
            baseX: base.x,
            baseY: base.y,
            startMs: Date.now(),
            persoId: item.id,
            scopeStoryId: item.storyId,
            emitRuntimeEvent,
            getCurrentTimelineMs: options?.getCurrentTimelineMs
          })
        }
      })
      continue
    }

    if (typeof nodeRef === 'object' && nodeRef !== null) {
      const runtimeNode = nodeRef as RuntimeObjectEventNode
      runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] = {
        ...(runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] ?? {}),
        [userEvent]: () => {
          emitDeclaredRuntimeEvents(item, userEvent, emitRuntimeEvent)
        }
      }
    }
  }
}

/**
 * Creates one runtime node using nodeFactory, DOM, or plain object fallback.
 */
export function createRuntimeNode(
  item: ItemDoc,
  fallbackTagName: string,
  options: CreateElementOptions | undefined
): unknown {
  const customNode = options?.nodeFactory?.(item)
  if (customNode !== undefined) {
    bindRuntimeEmitDeclarations(customNode, item, options)
    return customNode
  }

  if (typeof globalThis.document !== 'undefined') {
    const domNode = globalThis.document.createElement(fallbackTagName)
    bindRuntimeEmitDeclarations(domNode, item, options)
    return domNode
  }

  const objectNode: Record<string, unknown> = { tagName: fallbackTagName.toUpperCase(), style: {}, attributes: {} }
  bindRuntimeEmitDeclarations(objectNode, item, options)
  return objectNode
}

/**
 * Resets style, className, and attributes on one runtime node without clearing its children.
 * Used when reusing an existing template node across seeks: child structure and moved perso
 * nodes are preserved, but authored state (inline styles, classes, attributes) is wiped.
 * Pass preserveDataPart = true on part nodes so they remain discoverable on subsequent seeks.
 */
export function resetRuntimeNodeStyleState(nodeRef: unknown, preserveDataPart = false): void {
  if (isDomElement(nodeRef)) {
    const preserveSrc =
      (typeof globalThis.HTMLImageElement !== 'undefined' && nodeRef instanceof globalThis.HTMLImageElement) ||
      (typeof globalThis.HTMLMediaElement !== 'undefined' && nodeRef instanceof globalThis.HTMLMediaElement)

    const attributeNames =
      typeof nodeRef.getAttributeNames === 'function'
        ? nodeRef.getAttributeNames()
        : []

    for (const attributeName of attributeNames) {
      if (preserveDataPart && attributeName === 'data-part') continue
      // Removing src (even to reassign the same url right after) resets naturalWidth/
      // complete/readyState synchronously until the browser revalidates it, even from
      // cache — see applyImageSource comment. Preserved here so the generic sweep
      // actually matches the intent already stated below.
      if (preserveSrc && attributeName === 'src') continue
      nodeRef.removeAttribute(attributeName)
    }

    nodeRef.className = ''

    const style = (nodeRef as unknown as { style?: { cssText?: string } }).style
    if (style && typeof style.cssText === 'string') {
      style.cssText = ''
    }

    if (
      typeof globalThis.HTMLImageElement !== 'undefined' &&
      nodeRef instanceof globalThis.HTMLImageElement
    ) {
      nodeRef.alt = ''
    }

    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  mutableNode.className = ''
  mutableNode.src = undefined
  mutableNode.alt = undefined
  mutableNode.style = {}
  if (!preserveDataPart) {
    mutableNode.attributes = {}
  }
}

/**
 * Resets mutable state on one runtime node before applying initial values.
 */
export function resetRuntimeNodeState(nodeRef: unknown): void {
  if (isDomElement(nodeRef)) {
    const preserveSrc =
      (typeof globalThis.HTMLImageElement !== 'undefined' && nodeRef instanceof globalThis.HTMLImageElement) ||
      (typeof globalThis.HTMLMediaElement !== 'undefined' && nodeRef instanceof globalThis.HTMLMediaElement)

    const attributeNames =
      typeof nodeRef.getAttributeNames === 'function'
        ? nodeRef.getAttributeNames()
        : []

    for (const attributeName of attributeNames) {
      // See resetRuntimeNodeStyleState comment.
      if (preserveSrc && attributeName === 'src') continue
      nodeRef.removeAttribute(attributeName)
    }

    nodeRef.className = ''
    nodeRef.textContent = ''

    const style = (nodeRef as unknown as { style?: { cssText?: string } }).style
    if (style && typeof style.cssText === 'string') {
      style.cssText = ''
    }

    if (
      typeof globalThis.HTMLImageElement !== 'undefined' &&
      nodeRef instanceof globalThis.HTMLImageElement
    ) {
      nodeRef.alt = ''
    }

    if (
      typeof globalThis.HTMLMediaElement !== 'undefined' &&
      nodeRef instanceof globalThis.HTMLMediaElement
    ) {
      nodeRef.pause()
      try {
        nodeRef.currentTime = 0
      } catch {
        return
      }
    }

    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  mutableNode.id = undefined
  mutableNode.className = ''
  mutableNode.textContent = undefined
  mutableNode.src = undefined
  mutableNode.alt = undefined
  mutableNode.style = {}
  mutableNode.attributes = {}
  mutableNode.children = []
  mutableNode.childNodes = []

  if ('currentTime' in mutableNode) {
    mutableNode.currentTime = 0
  }

  if ('paused' in mutableNode) {
    mutableNode.paused = true
  }

  if ('parentId' in mutableNode) {
    delete mutableNode.parentId
  }

  if ('parentNode' in mutableNode) {
    mutableNode.parentNode = null
  }
}

/**
 * Applies one id value on a runtime node when supported.
 */
export function applyNodeId(nodeRef: unknown, id: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    return
  }

  if (isDomElement(nodeRef)) {
    nodeRef.id = id
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).id = id
  }
}

/**
 * Applies className updates on one runtime node.
 */
export function applyClassNamePatch(
  nodeRef: unknown,
  className: string | { add?: string; remove?: string } | undefined
): void {
  if (className === undefined) {
    return
  }

  const isSvgNode = isDomElement(nodeRef) && nodeRef.namespaceURI === 'http://www.w3.org/2000/svg'

  const readCurrentClassName = (): string => {
    if (isSvgNode) {
      return nodeRef.getAttribute('class') ?? ''
    }

    return typeof nodeRef === 'object' && nodeRef !== null && typeof (nodeRef as { className?: unknown }).className === 'string'
      ? ((nodeRef as { className?: string }).className ?? '')
      : ''
  }

  const writeClassName = (nextClassName: string): void => {
    if (isSvgNode) {
      if (nextClassName.length === 0) {
        nodeRef.removeAttribute('class')
      } else {
        nodeRef.setAttribute('class', nextClassName)
      }
      return
    }

    if (isDomElement(nodeRef)) {
      nodeRef.className = nextClassName
      return
    }

    if (typeof nodeRef === 'object' && nodeRef !== null) {
      ;(nodeRef as Record<string, unknown>).className = nextClassName
    }
  }

  if (typeof className === 'string') {
    writeClassName(className)
    return
  }

  const classSet = new Set(readCurrentClassName().split(/\s+/).filter((token) => token.length > 0))
  for (const token of (className.add ?? '').split(/\s+/)) {
    if (token.length > 0) {
      classSet.add(token)
    }
  }

  for (const token of (className.remove ?? '').split(/\s+/)) {
    if (token.length > 0) {
      classSet.delete(token)
    }
  }

  writeClassName([...classSet].join(' '))
}

/**
 * Applies style patch values on one runtime node.
 */
export function applyStylePatch(
  nodeRef: unknown,
  patch: Record<string, unknown> | undefined,
  options: {
    skipTransitionValues?: boolean
  } = {}
): void {
  if (patch === undefined) {
    return
  }

  if (isDomElement(nodeRef)) {
    const style = (nodeRef as unknown as { style?: Record<string, unknown> }).style
    if (style === undefined || style === null) {
      return
    }

    const styleWithSetProperty = style as Record<string, unknown> & {
      setProperty?: (propertyName: string, value: string) => void
      removeProperty?: (propertyName: string) => void
    }

    const definedPatch: Record<string, unknown> = {}

    for (const [key, rawValue] of Object.entries(patch)) {
      if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
        continue
      }

      const finalValue = resolveFinalValue(rawValue)
      if (finalValue === undefined || finalValue === null) {
        if (key.includes('-')) {
          styleWithSetProperty.removeProperty?.(key)
        } else {
          style[key] = ''
        }
        continue
      }

      definedPatch[key] = resolveContainerQueryValue(nodeRef, finalValue)
    }

    if (Object.keys(definedPatch).length > 0) {
      utils.set(nodeRef, definedPatch as Parameters<typeof utils.set>[1])
    }
    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  const currentStyle =
    typeof mutableNode.style === 'object' && mutableNode.style !== null
      ? (mutableNode.style as Record<string, unknown>)
      : {}

  for (const [key, rawValue] of Object.entries(patch)) {
    if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
      continue
    }

    currentStyle[key] = resolveFinalValue(rawValue)
  }

  mutableNode.style = currentStyle
}

/**
 * Applies attributes patch values on one runtime node.
 */
export function applyAttrPatch(nodeRef: unknown, patch: Record<string, unknown> | undefined): void {
  if (patch === undefined) {
    return
  }

  if (isDomElement(nodeRef)) {
    for (const [key, rawValue] of Object.entries(patch)) {
      if (rawValue === undefined || rawValue === null || rawValue === false) {
        nodeRef.removeAttribute(key)
        continue
      }

      nodeRef.setAttribute(key, String(rawValue))
    }
    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  const attributes =
    typeof mutableNode.attributes === 'object' && mutableNode.attributes !== null
      ? (mutableNode.attributes as Record<string, unknown>)
      : {}

  for (const [key, rawValue] of Object.entries(patch)) {
    if (rawValue === undefined || rawValue === null || rawValue === false) {
      delete attributes[key]
      continue
    }

    attributes[key] = rawValue
  }

  mutableNode.attributes = attributes
}

/**
 * Applies text content on one runtime node when supported.
 */
export function applyTextContent(nodeRef: unknown, content: string): void {
  if (isDomElement(nodeRef)) {
    nodeRef.textContent = content
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).textContent = content
  }
}

/**
 * Applies one image source url on one runtime media node.
 * Reassigning the same src attribute still resets naturalWidth/complete
 * synchronously until the browser revalidates it (even from cache), which
 * corrupts any code reading image dimensions in the same tick (e.g. replace's
 * split-cells geometry) — seek replays the same action repeatedly while
 * scrubbing, so this guard against redundant reassignment matters.
 */
export function applyImageSource(nodeRef: unknown, src: string): void {
  if (
    isDomElement(nodeRef) &&
    typeof globalThis.HTMLImageElement !== 'undefined' &&
    nodeRef instanceof globalThis.HTMLImageElement
  ) {
    if (nodeRef.getAttribute('src') === src) {
      return
    }
    nodeRef.src = src
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).src = src
  }
}

/**
 * Applies one image alt text on one runtime media node.
 */
export function applyImageAlt(nodeRef: unknown, alt: string): void {
  if (
    isDomElement(nodeRef) &&
    typeof globalThis.HTMLImageElement !== 'undefined' &&
    nodeRef instanceof globalThis.HTMLImageElement
  ) {
    nodeRef.alt = alt
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).alt = alt
  }
}

/**
 * Applies one object-fit value on one runtime media node.
 */
export function applyObjectFit(nodeRef: unknown, objectFit: 'cover' | 'contain'): void {
  if (isDomElement(nodeRef)) {
    ;(nodeRef as HTMLElement).style.objectFit = objectFit
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    const mutableNode = nodeRef as Record<string, unknown>
    const style =
      typeof mutableNode.style === 'object' && mutableNode.style !== null
        ? (mutableNode.style as Record<string, unknown>)
        : {}

    style.objectFit = objectFit
    mutableNode.style = style
  }
}

/**
 * Appends one child node when both parent and child are DOM nodes.
 */
export function appendDomChild(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.appendChild(childNode)
  }
}

/**
 * Removes one child node when both parent and child are DOM nodes.
 */
export function removeDomChild(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.removeChild(childNode)
  }
}

/**
 * Scans one node tree for data-part attributes, registers each found node and removes the attribute.
 * Supports both real DOM elements (via querySelectorAll) and plain object nodes (via recursive traversal).
 */
export function collectDataParts(rootNode: unknown, nodeByPart: Map<string, unknown>): void {
  if (isDomElement(rootNode)) {
    for (const el of Array.from(rootNode.querySelectorAll('[data-part]'))) {
      const partName = el.getAttribute('data-part')
      if (partName && !nodeByPart.has(partName)) {
        el.removeAttribute('data-part')
        nodeByPart.set(partName, el)
      }
    }
    return
  }

  if (typeof rootNode !== 'object' || rootNode === null) {
    return
  }

  const objectNode = rootNode as Record<string, unknown>
  const partName =
    typeof (objectNode.attributes as Record<string, unknown> | undefined)?.['data-part'] === 'string'
      ? (objectNode.attributes as Record<string, string>)['data-part']
      : undefined
  if (partName && !nodeByPart.has(partName)) {
    delete (objectNode.attributes as Record<string, unknown>)['data-part']
    objectNode.id = partName
    nodeByPart.set(partName, rootNode)
  }

  for (const child of Array.isArray(objectNode.children) ? objectNode.children : []) {
    collectDataParts(child, nodeByPart)
  }
}
