import { BaseHTMLComponent } from '../base-html-component'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import type { LayoutInitial, LayoutState } from './layout-types'

/** V2 layout component with no author-facing initialization hook. */
export class LayoutComponent extends BaseHTMLComponent<LayoutInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** Creates one layout component and declares only its own services. */
  constructor(input: HTMLComponentInput<LayoutInitial>) {
    super(input)
    this.services.declare(LayoutComponent.declaredServices)
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
