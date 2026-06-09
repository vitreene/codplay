import { BaseComponent } from './lib/base-component'
import { RUNTIME_CONFIG } from '../config'
import { isDomElement } from './lib/dom-component-adapter'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type TextInitial = {
  tag?: unknown
  content?: unknown
}

/**
 * Applies one rich text content value on one DOM element via innerHTML.
 */
function applyRichContent(node: unknown, value: unknown): void {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return
  }

  const content = String(value)
  if (isDomElement(node)) {
    node.innerHTML = content
    return
  }

  if (typeof node === 'object' && node !== null) {
    ;(node as Record<string, unknown>).innerHTML = content
  }
}

/**
 * Implements one rich text component with innerHTML support.
 * Handles inline markup (strong, em, span…) and is the target component
 * for replace-split-text transitions.
 */
export class TextComponent extends BaseComponent {
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
    const state = input.action as TextInitial
    if (state.content !== undefined) {
      applyRichContent(this.node, state.content)
    }
  }

  render(): ComponentRenderResult {
    const state = this.perso.initial as TextInitial
    const tag = typeof state.tag === 'string' && state.tag.length > 0
      ? state.tag
      : RUNTIME_CONFIG.text.defaultTagName
    const rootNode = this.buildNode(tag)
    this.services.apply(rootNode, this.perso.initial)
    if (state.content !== undefined) {
      applyRichContent(rootNode, state.content)
    }
    return rootNode as Node
  }
}
