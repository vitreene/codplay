import { BaseHTMLComponent } from './base-html-component'
import {
  isComponentRecord,
  isComponentTagName,
  reportInvalidComponentValue,
} from './component-validation'
import type { HTMLComponentInput, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'
import type { ValidationFunction } from '../../services'

/** Initial author data accepted by the V2 list component. */
export type ListInitial = Readonly<{
  tag?: string
  config?: Readonly<Record<string, unknown>>
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved state applied to one list host by its declared services. */
export type ListState = Readonly<{
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Validates the list root and its declared reorder policy. */
export const validateListInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_INITIAL_INVALID', 'list initial state must be a plain object.')
    return
  }

  // An empty tag is the documented shorthand for the default section root.
  if (value.tag !== undefined
    && (typeof value.tag !== 'string' || (value.tag.trim().length > 0 && !isComponentTagName(value.tag)))) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_TAG_INVALID', 'list.tag must be a valid HTML tag name.', 'tag')
  }

  if (value.config === undefined) return
  if (!isComponentRecord(value.config)) {
    reportInvalidComponentValue(context, 'AUTHOR_LIST_CONFIG_INVALID', 'list.config must be a plain object.', 'config')
    return
  }

  for (const property of ['reorderOnMove', 'reorderOnAdd', 'reorderOnRemove']) {
    const propertyValue = value.config[property]
    if (propertyValue !== undefined && typeof propertyValue !== 'boolean') {
      reportInvalidComponentValue(
        context,
        'AUTHOR_LIST_CONFIG_INVALID',
        `list.config.${property} must be a boolean.`,
        `config.${property}`,
      )
    }
  }
}

/** V2 list component: the capability owns order, while the component owns its root. */
export class ListComponent extends BaseHTMLComponent<ListInitial> {
  /** Creates one list host with the services declared by the catalog definition. */
  constructor(input: HTMLComponentInput<ListInitial>) {
    super(input)
  }

  /** Returns the authored list root without creating children or an implicit wrapper. */
  render(): string {
    const tag = this.perso.initial.tag === undefined || this.perso.initial.tag.trim().length === 0
      ? 'section'
      : this.perso.initial.tag
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(tag)) throw new Error(`Invalid list tag name: ${tag}`)
    return `<${tag}></${tag}>`
  }

  /** Applies only the list host state; child order is projected by the materializer. */
  update(input: ComponentUpdateInput<ListState>): void {
    if (this.node === null) throw new Error(`List component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
  }
}
