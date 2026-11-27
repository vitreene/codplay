import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentInput, ComponentUpdateInput } from '../component-types'
import { resolveScrollProgressAxis, type ScrollContainerInitial, type ScrollContainerState } from './scroll-container-types'

/** Renders one scrollport: the authored tag root, styled and sized by the author. */
export class ScrollContainerComponent extends BaseHTMLComponent<ScrollContainerInitial> {
  /** Services declared by the scrollport root, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** Creates one scrollport and declares only its own services. */
  constructor(input: ComponentInput<ScrollContainerInitial>) {
    super(input)
    this.services.declare(ScrollContainerComponent.declaredServices)
  }

  /** Returns the compile-validated root tag; children are placed by `move`. */
  render(): string {
    const tag = this.perso.initial.tag as string
    return `<${tag}></${tag}>`
  }

  /** Applies the resolved root state to the scrollport. */
  update(input: ComponentUpdateInput<ScrollContainerState>): void {
    if (this.node === null) throw new Error(`Scroll container is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
  }

  /** Brings the configured scroll axis back to its start; the other axis keeps its offset. */
  override onReset(): void {
    if (!(this.node instanceof HTMLElement)) return
    if (resolveScrollProgressAxis(this.perso.initial) === 'inline') this.node.scrollLeft = 0
    else this.node.scrollTop = 0
  }
}
