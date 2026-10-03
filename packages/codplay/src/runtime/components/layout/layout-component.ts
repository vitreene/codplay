import { BaseHTMLComponent } from '../base-html-component'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import type { LayoutInitial, LayoutState } from './layout-types'
import { LayoutFlowReservationController } from './layout-flow-reservation'

/** V2 layout component with no author-facing initialization hook. */
export class LayoutComponent extends BaseHTMLComponent<LayoutInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const
  private flowReservation: LayoutFlowReservationController | null = null

  /** Creates one layout component and declares only its own services. */
  constructor(input: HTMLComponentInput<LayoutInitial>) {
    super(input)
    this.services.declare(LayoutComponent.declaredServices)
  }

  /** Declares the compile-sanitized layout root and its internal mounting parts. */
  render(): string {
    return this.perso.initial.markup
  }

  /** Starts optional visual line reservations after the layout is materialized. */
  initialize(): void {
    const declarations = this.perso.initial.flowReservations
    if (declarations === undefined || declarations.length === 0) return
    if (!(this.node instanceof HTMLElement)) throw new Error(`Layout root is not an HTML element: ${this.perso.id}`)
    this.flowReservation = new LayoutFlowReservationController(
      this.node,
      declarations,
      (partId) => this.getPart(partId),
    )
  }

  /** Applies one resolved layout state to this component root. */
  update(input: ComponentUpdateInput<LayoutState>): void {
    if (this.node === null) throw new Error(`Layout component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, input.state)
  }

  /** Recalculates the same layout when Sighty replays a retained scene. */
  afterSeek(): void {
    this.flowReservation?.refresh()
  }

  /** Restores the same layout after a CodPlay reset. */
  onReset(): void {
    this.flowReservation?.refresh()
  }

  /** Disconnects the layout-owned width observer at teardown. */
  destroy(): void {
    this.flowReservation?.destroy()
    this.flowReservation = null
  }
}
