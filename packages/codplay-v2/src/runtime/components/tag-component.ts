import { BaseHTMLComponent } from './base-html-component'
import {
  isComponentRecord,
  isComponentTagName,
  reportInvalidComponentValue,
} from './component-validation'
import type { HTMLComponentInput, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, ContentValue, StyleValue } from '../../services'
import type { ValidationFunction } from '../../services'

/** Initial and resolved state applied by one tag component. */
export type TagState = Readonly<{
  tag: string
  content?: ContentValue
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Validates the tag-specific initial contract without inspecting a materialized node. */
export const validateTagInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_TAG_INITIAL_INVALID', 'tag initial state must be a plain object.')
    return
  }

  // The component contract supplies div when the author omits tag.
  if (value.tag !== undefined && !isComponentTagName(value.tag)) {
    reportInvalidComponentValue(context, 'AUTHOR_TAG_NAME_INVALID', 'tag must be a valid HTML tag name.', 'tag')
  }
}

/** V2 template-string component for a plain HTML tag. */
export class TagComponent extends BaseHTMLComponent<TagState> {
  /** Creates one tag component with services already bound by its runtime definition. */
  constructor(input: HTMLComponentInput<TagState>) {
    super(input)
  }

  /** Returns the authored tag template. */
  render(): string {
    const tag = this.perso.initial.tag ?? 'div'
    if (!isComponentTagName(tag)) throw new Error(`Invalid tag name: ${tag}`)
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
