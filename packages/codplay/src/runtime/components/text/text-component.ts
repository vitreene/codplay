import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import type { TextInitial, TextState } from './text-types'

/** Rich HTML text component retained from the V1 text-content behavior. */
export class TextComponent extends BaseHTMLComponent<TextInitial> {
  /** Services declared by the rich text author profile. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** Creates one rich text component using the shared presentation services. */
  constructor(input: HTMLComponentInput<TextInitial>) {
    super(input)
    this.services.declare(TextComponent.declaredServices)
  }

  /** Returns the configured text root without adding a content wrapper. */
  render(): string {
    const tag = this.perso.initial.tag as string
    return `<${tag} id="${escapeAttribute(this.perso.id)}"></${tag}>`
  }

  /** Applies visual services and rich innerHTML content to the persistent root. */
  update(input: ComponentUpdateInput<TextState>): void {
    if (this.node === null) throw new Error(`Text component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
    if (input.state.content === null || input.state.content === undefined) {
      setRichContent(this.node, '')
      return
    }
    if (typeof input.state.content === 'string' || typeof input.state.content === 'number') {
      setRichContent(this.node, String(input.state.content))
    }
  }
}

/** Writes one author-provided rich HTML value to an HTML materialized root. */
function setRichContent(node: unknown, content: string): void {
  if (typeof node === 'object' && node !== null && 'innerHTML' in node) {
    ;(node as { innerHTML: string }).innerHTML = content
  }
}

/** Escapes the root identity before placing it in component markup. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
