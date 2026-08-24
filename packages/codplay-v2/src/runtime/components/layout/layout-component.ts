import { BaseHTMLComponent } from '../base-html-component'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import type { LayoutInitial, LayoutState } from './layout-types'

/** V2 layout component with no author-facing initialization hook. */
export class LayoutComponent extends BaseHTMLComponent<LayoutInitial> {
  /** Creates one layout component with services bound by its runtime definition. */
  constructor(input: HTMLComponentInput<LayoutInitial>) {
    super(input)
  }

  /** Declares the compile-sanitized layout root and its internal mounting parts. */
  render(): string {
    return this.perso.initial.markup
  }

  /** Applies one resolved layout state to this component root. */
  update(input: ComponentUpdateInput<LayoutState>): void {
    if (this.node === null) throw new Error(`Layout component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, input.state)
  }
}
