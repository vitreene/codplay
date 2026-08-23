import { BaseComponent } from './base-component'
import { isComponentRecord, reportInvalidComponentValue } from './component-validation'
import type { ComponentInput, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'
import type { ValidationFunction } from '../../services'

/** Initial author data accepted by the layout component. */
export type LayoutInitial = Readonly<{
  markup: string
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved state applied by one layout update. */
export type LayoutState = Readonly<{
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Validates the layout template required before HTML materialization. */
export const validateLayoutInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value) || typeof value.markup !== 'string' || value.markup.trim().length === 0) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_LAYOUT_MARKUP_INVALID',
      'layout.markup must be a non-empty string.',
      'markup',
    )
  }
}

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
