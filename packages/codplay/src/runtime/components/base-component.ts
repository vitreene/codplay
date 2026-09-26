import type { ComponentInput, ComponentServices, ComponentUpdateInput } from './component-types'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'
import type { RuntimeCaptureSourcePort } from '../capture'

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
  protected readonly captureSources: RuntimeCaptureSourcePort | undefined

  /** Creates one component from substrate-neutral author data. */
  constructor(input: ComponentInput<Initial>) {
    this.perso = input.perso
    this.services = input.services
    this.captureSources = input.captureSources
  }

  /** Prepares component-owned substrate state after materialization and before the first update. */
  initialize(): void {
    // Components without a setup phase keep the default no-op lifecycle.
  }

  /** Applies one resolved state through the component-specific projection. */
  abstract update(input: ComponentUpdateInput): void

  /** Releases component-owned resources at the final player teardown boundary. */
  destroy(): void {
    // Most components only own their materialized root, which the materializer releases.
  }

  /** Suspends component-owned sources before the player reconstructs a seek target. */
  beforeSeek(): void {
    // Components without live sources need no seek preparation.
  }

  /** Resumes component-owned sources after the player finishes seek presentation. */
  afterSeek(): void {
    // Components without live sources need no seek resumption.
  }

  /** Releases transient component-owned sources before sequence finalization. */
  onSequenceEnd(): void {
    // Components without live sources need no sequence-end cleanup.
  }

  /** Reattaches component-owned sources after an explicit player reset. */
  onReset(): void {
    // Components without live sources need no reset handling.
  }
}
