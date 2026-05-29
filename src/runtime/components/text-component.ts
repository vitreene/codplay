import { BaseComponent } from './lib/base-component'
import { setTextContent } from './lib/dom'
import { RUNTIME_CONFIG } from '../config'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type TextInitial = {
  tag?: unknown
  content?: unknown
}

/**
 * Implements one simple text component.
 */
export class TextComponent extends BaseComponent {
  /**
   * Declares services used for className, style and attr patches.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Applies a text content value on one node. Silently ignores non-string and non-number values.
   */
  private applyContent(node: unknown, value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number') {
      setTextContent(node, String(value))
    }
  }

  /**
   * Applies one resolved runtime action on the text node.
   */
  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
    const state = input.action as TextInitial
    if (state.content !== undefined) {
      this.applyContent(this.node, state.content)
    }
  }

  /**
   * Creates the component root and applies the authored initial state.
   */
  render(): ComponentRenderResult {
    const state = this.perso.initial as TextInitial
    const tag = typeof state.tag === 'string' && state.tag.length > 0
      ? state.tag
      : RUNTIME_CONFIG.text.defaultTagName
    const rootNode = this.buildNode(tag)
    this.services.apply(rootNode, this.perso.initial)
    if (state.content !== undefined) {
      this.applyContent(rootNode, state.content)
    }
    return rootNode as Node
  }
}
