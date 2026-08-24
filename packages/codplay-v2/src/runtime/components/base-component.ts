import type { ComponentInput, ComponentUpdateInput } from './component-types'

/** Provides the substrate-neutral V2 component construction and update contract. */
export abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']

  /** Creates one component from substrate-neutral author data. */
  constructor(input: ComponentInput<Initial>) {
    this.perso = input.perso
  }

  /** Applies one resolved state through the component-specific projection. */
  abstract update(input: ComponentUpdateInput): void
}
