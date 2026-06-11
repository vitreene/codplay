import type { DeepReadonly, HelperTickContext } from './helper-types'
import type { StrapInput } from './strap-types'

type ExampleState = DeepReadonly<{
  armed: boolean
  nested: {
    value: number
  }
  items: Array<{
    label: string
  }>
}>

export function assertReadonlyStrapState(input: StrapInput, state: ExampleState): void {
  void input.state
  void state.armed
  void state.nested.value
  void state.items[0]?.label

  // @ts-expect-error Strap state stays read-only.
  input.state['armed'] = true

  // @ts-expect-error Nested object values stay read-only.
  state.nested.value = 1

  // @ts-expect-error Arrays stay read-only.
  state.items.push({ label: 'next' })

  // @ts-expect-error Nested array entries stay read-only.
  state.items[0]!.label = 'changed'
}

export function assertReadonlyHelperState(context: HelperTickContext): void {
  void context.state['armed']

  // @ts-expect-error Helper callback state stays read-only.
  context.state['armed'] = true
}

export function assertStrapContextSurface(input: StrapInput): void {
  void input.context.planned
  void input.context.live

  // @ts-expect-error Legacy helper surface is no longer canonical.
  void input.context.helpers
}
