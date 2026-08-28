import type { CompiledValue } from '../../../scene/compiled'
import type { RuntimeCaptureAction, RuntimeCaptureSession } from '../../capture'
import type { RuntimeEventInput } from '../pipeline'

/** Compiled action target resolved once for live capture updates. */
export type CaptureActionTarget = Readonly<{
  persoKey: string
  actionValue: CompiledValue
}>

/** Active capture action and the component targets it currently affects. */
export type ActiveCaptureAction = Readonly<{
  action: RuntimeCaptureAction
  targets: readonly CaptureActionTarget[]
}>

/** Player event input whose application time defaults to the current player time. */
export type RuntimePlayerEmitInput = Omit<RuntimeEventInput, 'applyAtMs'> & Readonly<{
  applyAtMs?: number
}>

/** Player-owned capture session entry and its state scope. */
export type RuntimeCaptureSessionEntry = Readonly<{
  storyId: string
  stateScope: 'scene' | 'story'
  session: RuntimeCaptureSession
}>
