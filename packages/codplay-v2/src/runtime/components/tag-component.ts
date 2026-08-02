import { BaseComponent } from './base-component'
import type { ComponentInput, ComponentUpdateInput } from './component-types'

/** Initial and resolved state projected by one tag component. */
export type TagState = Readonly<{
  tag: string
  content?: string | number
  className?: string
  style?: Readonly<Record<string, string | number>>
  attr?: Readonly<Record<string, string | boolean | number>>
}>

/** V2 template-string component for a plain HTML tag. */
export class TagComponent extends BaseComponent<TagState> {
  /** Creates one tag component and declares its projection services. */
  constructor(input: ComponentInput<TagState>) {
    super(input)
    this.services.declare(['className', 'style', 'attr', 'content'])
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
    })
    if (input.state.content !== undefined) {
      this.services.content?.apply(this.node, String(input.state.content))
    }
  }
}
