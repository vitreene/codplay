import { BaseComponent } from './base-component'
import type { ComponentInput, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, ContentValue, StyleValue } from '../../services'

/** Initial and resolved state applied by one tag component. */
export type TagState = Readonly<{
  tag: string
  content?: ContentValue
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** V2 template-string component for a plain HTML tag. */
export class TagComponent extends BaseComponent<TagState> {
  /** Creates one tag component with services already bound by its runtime definition. */
  constructor(input: ComponentInput<TagState>) {
    super(input)
  }

  /** Returns the authored tag template. */
  render(): string {
    const tag = this.perso.initial.tag
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(tag)) throw new Error(`Invalid tag name: ${tag}`)
    return `<${tag}></${tag}>`
  }

  /** Applies one complete resolved tag state to the materialized node. */
  update(input: ComponentUpdateInput<TagState>): void {
    if (this.node === null) throw new Error(`Tag component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
      content: input.state.content,
    })
  }
}
