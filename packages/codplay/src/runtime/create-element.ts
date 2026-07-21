import { createListPlugin } from './list-plugin/create-list-plugin'
import type { CaptureAction } from './capture-types'
import type {
  EmitRule,
  EmitRuleAction,
  ItemDoc,
  RuntimeElement,
  RuntimeEmitEvent,
  RuntimeEmitSelf,
  RuntimeNode,
  RuntimeNodeFactory
} from './types'

export const RUNTIME_OBJECT_EVENT_HANDLERS = '__codplayEventHandlers'
const SELF_PAYLOAD_KEY = 'self'

export type CreateElementOptions = {
  nodeFactory?: RuntimeNodeFactory
  emitRuntimeEvent?: (event: RuntimeEmitEvent) => void
  emitLiveCapture?: (event: RuntimeEmitEvent) => void
  subscribeJitTick?: (listener: (deltaMs: number) => void) => () => void
  getCurrentTimelineMs?: () => number
  /** Reads the current story state in read-only mode — used by capture `initCaptureState`. */
  getStoryState?: (storyId: string) => Readonly<Record<string, unknown>>
  /** Reads the current scene state in read-only mode — used by capture `initCaptureState` when `stateScope: 'scene'`. */
  getSceneState?: () => Readonly<Record<string, unknown>>
  /**
   * Subscribes one capture's `trackCommand` emitter to the playback ticker.
   * Capture is the emitter — it never applies its own output; the ticker
   * polls every subscriber once per frame and channels delivery through the
   * renderer's single render cycle (`PlayerFacade.applyCaptureTickActions`).
   * See `v1-capture-spec.md` regle 5.
   */
  subscribeCaptureTick?: (fn: () => CaptureAction | void) => () => void
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

type RuntimeObjectEventNode = Record<string, unknown> & {
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

/**
 * Checks whether a runtime node reference is a browser Element.
 */
function isDomElement(nodeRef: unknown): nodeRef is Element {
  if (typeof globalThis.Element === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Element
}

/**
 * Applies style entries directly on one DOM element style declaration.
 */
function applyDomStyleEntries(nodeRef: Element, styleEntries: Record<string, unknown>): void {
  const style = (nodeRef as unknown as { style?: Record<string, unknown> }).style
  if (style === undefined || style === null) {
    return
  }

  const styleWithSetProperty = style as Record<string, unknown> & {
    setProperty?: (propertyName: string, value: string) => void
    removeProperty?: (propertyName: string) => void
  }

  for (const [property, rawValue] of Object.entries(styleEntries)) {
    if (rawValue === undefined || rawValue === null) {
      if (property.includes('-')) {
        styleWithSetProperty.removeProperty?.(property)
      } else {
        style[property] = ''
      }
      continue
    }

    const value = String(rawValue)
    if (property.includes('-') && styleWithSetProperty.setProperty) {
      styleWithSetProperty.setProperty(property, value)
      continue
    }

    style[property] = value
  }
}

/**
 * Creates a default runtime node object when no browser DOM is available.
 */
function createDefaultRuntimeNode(tagName: string): RuntimeNode {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Resolves the initial tag name according to item type and state.
 */
function resolveTagName(item: ItemDoc): string {
  if ('tag' in item.initial && typeof item.initial.tag === 'string' && item.initial.tag.length > 0) {
    return item.initial.tag
  }

  if (item.type === 'text') {
    return 'p'
  }

  if (item.type === 'img') {
    return 'img'
  }

  return 'div'
}

/**
 * Creates a browser DOM element when the environment supports it.
 */
function createDomElementIfPossible(tagName: string): Element | null {
  if (typeof globalThis.document === 'undefined') {
    return null
  }

  return globalThis.document.createElement(tagName)
}

/**
 * Clears one DOM element mutable state before applying item initial values.
 */
function resetDomNodeState(nodeRef: Element): void {
  const attributeNames =
    typeof nodeRef.getAttributeNames === 'function'
      ? nodeRef.getAttributeNames()
      : []

  for (const attributeName of attributeNames) {
    nodeRef.removeAttribute(attributeName)
  }

  nodeRef.textContent = ''

  const nodeWithSource = nodeRef as unknown as { src?: unknown }
  if (typeof nodeWithSource.src === 'string') {
    nodeWithSource.src = ''
  }
}

/**
 * Clears one non-DOM runtime node mutable state before applying initials.
 */
function resetObjectNodeState(nodeRef: Record<string, unknown>): void {
  nodeRef.id = undefined
  nodeRef.className = ''
  nodeRef.textContent = undefined
  nodeRef.src = undefined
  nodeRef.style = {}
  nodeRef.attributes = {}

  if ('parentId' in nodeRef) {
    delete nodeRef.parentId
  }
}

/**
 * Applies initial item properties onto a runtime node reference.
 */
function applyInitialState(nodeRef: unknown, item: ItemDoc): void {
  const state = item.initial

  if (nodeRef && typeof nodeRef === 'object') {
    if (isDomElement(nodeRef)) {
      resetDomNodeState(nodeRef)
    }

    const mutableNode = nodeRef as Record<string, unknown>
    if (!isDomElement(nodeRef)) {
      resetObjectNodeState(mutableNode)
    }

    mutableNode.id = state.id ?? item.id

    if (state.className !== undefined) {
      mutableNode.className = state.className
    }

    if ('content' in state && state.content !== undefined) {
      mutableNode.textContent = state.content
    }

    if ('src' in state && state.src !== undefined) {
      mutableNode.src = state.src
    }

    if (state.style !== undefined) {
      if (isDomElement(nodeRef)) {
        applyDomStyleEntries(nodeRef, state.style)
      } else {
        mutableNode.style = { ...state.style }
      }
    }

    if (state.attr !== undefined) {
      if (isDomElement(nodeRef)) {
        for (const [key, rawValue] of Object.entries(state.attr)) {
          if (rawValue === undefined || rawValue === null || rawValue === false) {
            nodeRef.removeAttribute(key)
            continue
          }

          nodeRef.setAttribute(key, String(rawValue))
        }

        return
      }

      mutableNode.attributes = { ...state.attr }
    }

    if (state.move !== undefined) {
      mutableNode.parentId = state.move
    }
  }
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
 */
function emitDeclaredRuntimeEvents(
  item: ItemDoc,
  userEvent: string,
  emitRuntimeEvent: (event: RuntimeEmitEvent) => void
): void {
  const rule = item.emit?.[userEvent]
  if (!rule) {
    return
  }

  const self = createRuntimeEmitSelf(item)
  for (const action of resolveRootEmitRule(rule)) {
    const data = action.data === undefined ? { [SELF_PAYLOAD_KEY]: self } : { ...action.data, [SELF_PAYLOAD_KEY]: self }
    emitRuntimeEvent({
      name: action.event.name,
      data,
      cascade: action.event.cascade,
      scopeStoryId: action.event.cascade === true ? undefined : item.storyId
    })
  }
}

/**
 * Binds authored user event emits on DOM and object runtime nodes.
 */
function bindRuntimeEmitDeclarations(nodeRef: unknown, item: ItemDoc, options: CreateElementOptions): void {
  const emitRuntimeEvent = options.emitRuntimeEvent
  if (!emitRuntimeEvent || !item.emit) {
    return
  }

  for (const userEvent of Object.keys(item.emit)) {
    const emit = () => {
      emitDeclaredRuntimeEvents(item, userEvent, emitRuntimeEvent)
    }

    if (isDomElement(nodeRef)) {
      nodeRef.addEventListener(userEvent, emit)
      continue
    }

    if (typeof nodeRef === 'object' && nodeRef !== null) {
      const runtimeNode = nodeRef as RuntimeObjectEventNode
      runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] = {
        ...(runtimeNode[RUNTIME_OBJECT_EVENT_HANDLERS] ?? {}),
        [userEvent]: emit
      }
    }
  }
}

/**
 * Creates one runtime element for one item document.
 */
export function createElement(item: ItemDoc, options: CreateElementOptions = {}): RuntimeElement {
  const tagName = resolveTagName(item)
  const customNode = options.nodeFactory?.(item)
  const domNode = customNode === undefined ? createDomElementIfPossible(tagName) : null
  const nodeRef = customNode ?? domNode ?? createDefaultRuntimeNode(tagName)

  applyInitialState(nodeRef, item)
  bindRuntimeEmitDeclarations(nodeRef, item, options)

  // Deprecated legacy path: the current component-based list runtime does not
  // consume these plugins anymore. Keep temporarily while validating POC/demo
  // behavior before removal.
  const plugins = item.type === 'list'
    ? [
        createListPlugin({
          runtimeListId: item.id,
          nodeRef,
          autoAnimate: item.list?.autoAnimate,
          perf: item.list?.perf
        })
      ]
    : undefined

  return {
    runtimeItemId: item.id,
    nodeRef,
    plugins
  }
}
