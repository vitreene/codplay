import { BaseComponent } from './lib/base-component'
import { setTextContent } from './lib/dom'
import { RUNTIME_CONFIG } from '../config'
import type { PersoActionCommon, PersoInitialCommon } from '../perso-shared-types'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

export type TagInitial = PersoInitialCommon & {
  tag?: unknown
  content?: unknown
}

export type TagAction = PersoActionCommon & {
  content?: unknown
}

/**
 * Implements one generic tag component with plain text content.
 */
export class TagComponent extends BaseComponent {
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  private applyContent(node: unknown, value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number') {
      setTextContent(node, String(value))
    }
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
    const state = input.action as TagAction
    if (state.content !== undefined) {
      this.applyContent(this.node, state.content)
    }
  }

  render(): ComponentRenderResult {
    const state = this.perso.initial as TagInitial
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
