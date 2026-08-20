import type { ComponentInput, MaterializedPart, ComponentUpdateInput } from './component-types'

/** Provides the normative V2 component lifecycle and its materialized root reference. */
export abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']
  protected readonly services: ComponentInput<Initial>['services']
  public node: unknown | null = null
  private parts: readonly MaterializedPart[] = []

  /** Creates one component from author data and its injected service facade. */
  constructor(input: ComponentInput<Initial>) {
    this.perso = input.perso
    this.services = input.services
  }

  /** Declares the component render result with a template string in the current V2 tranche. */
  abstract render(): string

  /** Applies one resolved state through the component's materializer services. */
  abstract update(input: ComponentUpdateInput): void

  /** Stores one materialized root and its internal template parts. */
  _materialize(rootNode: unknown, parts: readonly MaterializedPart[]): void {
    this.node = rootNode
    this.parts = parts.map((part) => ({ ...part }))
  }

  /** Returns the internal parts discovered by the materialization boundary. */
  protected getPartsSnapshot(): readonly MaterializedPart[] {
    return this.parts.map((part) => ({ ...part }))
  }
}
