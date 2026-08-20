import { BaseComponent } from './base-component'
import type { ComponentInput, ComponentUpdateInput } from './component-types'

/** Initial author data accepted by the layout component. */
export type LayoutInitial = Readonly<{
  markup?: string
  className?: string
  style?: Readonly<Record<string, string | number>>
  attr?: Readonly<Record<string, string | boolean | number>>
}>

/** Resolved state projected by one layout update. */
export type LayoutState = Readonly<{
  className?: string
  style?: Readonly<Record<string, string | number>>
  attr?: Readonly<Record<string, string | boolean | number>>
}>

/** V2 layout component with no author-facing initialization hook. */
export class LayoutComponent extends BaseComponent<LayoutInitial> {
  /** Creates one layout component with services bound by its runtime definition. */
  constructor(input: ComponentInput<LayoutInitial>) {
    super(input)
  }

  /** Declares the layout root and its internal mounting parts. */
  render(): string {
    if (typeof this.perso.initial.markup !== 'string' || this.perso.initial.markup.trim().length === 0) {
      throw new Error(`Layout markup must not be empty: ${this.perso.id}`)
    }
    return this.perso.initial.markup
  }

  /** Applies one resolved layout state to this component root. */
  update(input: ComponentUpdateInput<LayoutState>): void {
    if (this.node === null) throw new Error(`Layout component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, input.state)
  }
}
