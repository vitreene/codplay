import type { CompiledRecord } from '../../../scene/compiled'
import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY } from '../../config/strap-scope'
import type { RuntimeStateStore } from '../pipeline'
import type {
  ActiveCaptureAction,
  RuntimeCaptureSessionEntry,
} from './types'

/** Applies one trackCommand state patch to its declared live scope only. */
export function applyCaptureStateUpdate(
  stateStore: RuntimeStateStore,
  entry: Pick<RuntimeCaptureSessionEntry, 'storyId' | 'stateScope'>,
  update: CompiledRecord,
): void {
  stateStore.applyUpdate(
    entry.stateScope === 'scene' ? STRAP_SCOPE_SCENE : STRAP_SCOPE_STORY,
    update,
    entry.stateScope === 'story' ? entry.storyId : undefined,
  )
}

/** Reapplies non-journaled capture state so active straps see its live value. */
export function reapplyLiveCaptureStateUpdates(
  stateStore: RuntimeStateStore,
  liveCaptureStateUpdates: ReadonlyMap<string, CompiledRecord>,
  captureSessions: ReadonlyMap<string, RuntimeCaptureSessionEntry>,
): void {
  for (const [captureId, update] of liveCaptureStateUpdates) {
    const entry = captureSessions.get(captureId)
    if (entry === undefined) continue
    applyCaptureStateUpdate(stateStore, entry, update)
  }
}

/** Closes every active capture before seek or final player teardown. */
export function cancelActiveCaptures(
  captureSessions: Map<string, RuntimeCaptureSessionEntry>,
  activeCaptureActions: Map<string, ActiveCaptureAction>,
  liveCaptureStateUpdates: Map<string, CompiledRecord>,
): void {
  for (const entry of captureSessions.values()) entry.session.cancel()
  captureSessions.clear()
  activeCaptureActions.clear()
  liveCaptureStateUpdates.clear()
}
