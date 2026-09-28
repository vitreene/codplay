import {
  BaseComponent,
  type ComponentUpdateInput,
} from 'codplay'
import type { AvatarTarget } from '../avatar-types'

/** Shared target handoff for logical Avatar feature components. */
export abstract class AvatarFeatureComponent<Initial extends Record<string, unknown>>
  extends BaseComponent<Initial> {
  /** Applies one feature contribution to the Avatar capability selected by rel. */
  update(input: ComponentUpdateInput<Initial>): void {
    const target = input.target as AvatarTarget | undefined
    if (target === undefined) return
    this.contribute(target, input)
  }

  /** Converts the resolved author state into one coordinator contribution. */
  protected abstract contribute(
    target: AvatarTarget,
    input: ComponentUpdateInput<Initial>,
  ): void
}
