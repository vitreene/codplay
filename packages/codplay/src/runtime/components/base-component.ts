import type { ComponentInput, ComponentServices, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'

/** Common serializable data accepted by every substrate-neutral component profile. */
export type BaseComponentData = Readonly<{
  content?: string | number
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Common root data excluding content for components whose root owns a child node. */
export type BaseComponentVisualData = Omit<BaseComponentData, 'content'>

/** Provides the substrate-neutral V2 component construction and update contract. */
export abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']
  protected readonly services: ComponentServices

  /** Creates one component from substrate-neutral author data. */
  constructor(input: ComponentInput<Initial>) {
    this.perso = input.perso
    this.services = input.services
  }

  /** Applies one resolved state through the component-specific projection. */
  abstract update(input: ComponentUpdateInput): void

  /** Releases component-owned resources at the final player teardown boundary. */
  destroy(): void {
    // Most components only own their materialized root, which the materializer releases.
  }
}
