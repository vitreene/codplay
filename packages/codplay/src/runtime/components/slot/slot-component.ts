import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import type { SlotInitial, SlotState } from './slot-types'

/** Core HTML host that exposes an opaque foreign representation through one tag root. */
export class ForeignContentComponent extends BaseHTMLComponent<SlotInitial> {
  /** Services that apply only to the host root; foreign content has no text service. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** Creates one opaque foreign-content host. */
  constructor(input: HTMLComponentInput<SlotInitial>) {
    super(input)
    this.services.declare(ForeignContentComponent.declaredServices)
  }

  /** Returns the authored host tag, with the structural div default normalized by the builder. */
  render(): string {
    const tag = this.perso.initial.tag ?? 'div'
    return `<${tag}></${tag}>`
  }

  /** Applies host-root services while leaving the opaque foreign value to its adapter. */
  update(input: ComponentUpdateInput<SlotState>): void {
    if (this.node === null) throw new Error(`Foreign content component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
  }
}

/** Public slot-oriented name for the generic foreign-content host component. */
export { ForeignContentComponent as SlotComponent }
