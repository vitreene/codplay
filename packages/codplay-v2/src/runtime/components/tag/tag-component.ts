import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import type { TagInitial, TagState } from './tag-types'

/** V2 template-string component for a plain HTML tag. */
export class TagComponent extends BaseHTMLComponent<TagInitial> {
  /** Creates one tag component with services already bound by its runtime definition. */
  constructor(input: HTMLComponentInput<TagInitial>) {
    super(input)
  }

  /** Returns the compile-validated authored tag template. */
  render(): string {
    const tag = this.perso.initial.tag as string
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
