import type { CompiledRecord, CompiledValue } from '../../../scene/compiled'

/** One compiled action selected for a live source update. */
export type RuntimeLiveAction = Readonly<{
  name: string
  data?: CompiledRecord
}>

/** One compiled persona action target resolved from the scene action index. */
export type LiveActionTarget = Readonly<{
  persoKey: string
  actionValue: CompiledValue
}>

/** One live action and all of its compiled targets. */
export type ActiveLiveAction = Readonly<{
  action: RuntimeLiveAction
  targets: readonly LiveActionTarget[]
}>

/** Ordered live actions owned by one source. */
export type ActiveLiveActions = readonly ActiveLiveAction[]
