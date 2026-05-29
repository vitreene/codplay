import { BaseComponent } from './lib/base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  createComponentRoot,
  resetComponentRoot,
  setComponentRootId,
  setTextContent
} from './lib/dom'
import type { RuntimeComponentUpdateInput } from './types'

type TextState = {
  id?: unknown
  tag?: unknown
  content?: unknown
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

const DEFAULT_TEXT_TAG = 'p'

/**
 * Resolves the root tag used by the text component.
 */
function resolveTextTag(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_TEXT_TAG
}

/**
 * Resolves one authored text content value into one renderable string.
 */
function resolveTextContent(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }

  return null
}

/**
 * Implements one simple text component with separated shared visual helpers.
 */
export class TextComponent extends BaseComponent {
  /**
   * Creates the component root and applies the authored initial state.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as TextState
    const rootNode = createComponentRoot(this.perso, resolveTextTag(state.tag), this.createElementOptions)

    resetComponentRoot(rootNode)
    setComponentRootId(rootNode, this.perso.id, state.id)

    applyClassNameProps(rootNode, state.className)
    applyStyleProps(rootNode, state.style)
    applyAttrProps(rootNode, state.attr)

    if (state.content !== undefined) {
      const content = resolveTextContent(state.content)
      if (content === null) {
        this.report('AUTHOR_TEXT_CONTENT_INVALID', 'Text content must be a string or number')
      } else {
        setTextContent(rootNode, content)
      }
    }

    this.setRoot(rootNode)
  }

  /**
   * Applies one resolved runtime action on the text node.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.report('RUNTIME_TEXT_NOT_INITIALIZED', 'Text component update rejected because init is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const state = input.action as TextState

    applyStyleProps(this.rootNode, state.style, {
      skipTransitionValues: true
    })
    applyClassNameProps(this.rootNode, state.className)
    applyAttrProps(this.rootNode, state.attr)

    if (state.content === undefined) {
      return
    }

    const content = resolveTextContent(state.content)
    if (content === null) {
      this.report('AUTHOR_TEXT_CONTENT_INVALID', 'Text content must be a string or number', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    setTextContent(this.rootNode, content)
  }
}
