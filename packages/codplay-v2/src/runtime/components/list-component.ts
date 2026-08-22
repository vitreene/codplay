import { BaseComponent } from './base-component'
import type { ComponentInput, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'

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

/** V2 list component: the capability owns order, while the component owns its root. */
export class ListComponent extends BaseComponent<ListInitial> {
  /** Creates one list host with the services declared by the catalog definition. */
  constructor(input: ComponentInput<ListInitial>) {
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
