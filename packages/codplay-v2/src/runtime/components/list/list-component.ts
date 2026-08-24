import { BaseHTMLComponent } from '../base-html-component'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import type { ListInitial, ListState } from './list-types'

/** V2 list component: the capability owns order, while the component owns its root. */
export class ListComponent extends BaseHTMLComponent<ListInitial> {
  /** Creates one list host with the services declared by the catalog definition. */
  constructor(input: HTMLComponentInput<ListInitial>) {
    super(input)
  }

  /** Returns the compile-validated list root without creating children. */
  render(): string {
    const tag = this.perso.initial.tag as string
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
