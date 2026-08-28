import type { CompiledFunctionCollection, CompiledRecord } from '../../../scene/compiled'
import type { RuntimeComponentRuntime } from '../../components'
import {
  resolveLiveCaptureActionState,
  type SolvedScene,
} from '../pipeline'
import type { ActiveCaptureAction } from './types'

/** Reapplies active capture actions through the normal component update path. */
export function applyLiveCaptureActions(
  scene: SolvedScene | undefined,
  componentRuntime: RuntimeComponentRuntime | undefined,
  activeCaptureActions: ReadonlyMap<string, ActiveCaptureAction>,
  previousLiveCapturePersoKeys: ReadonlySet<string>,
  functions: CompiledFunctionCollection,
): Set<string> {
  if (scene === undefined || componentRuntime === undefined) return new Set()

  const liveStates = new Map<string, CompiledRecord>()
  for (const active of activeCaptureActions.values()) {
    for (const target of active.targets) {
      const perso = scene.persos[target.persoKey]
      if (perso === undefined) continue
      const currentState = liveStates.get(target.persoKey) ?? perso.state
      const nextState = resolveLiveCaptureActionState(
        currentState,
        target.actionValue,
        active.action.data,
        functions,
      )
      if (nextState !== undefined) liveStates.set(target.persoKey, nextState)
    }
  }
  const affectedPersoKeys = new Set([...previousLiveCapturePersoKeys, ...liveStates.keys()])
  for (const persoKey of affectedPersoKeys) {
    const perso = scene.persos[persoKey]
    if (perso === undefined) continue
    componentRuntime.updateLive(
      persoKey,
      liveStates.get(persoKey) ?? perso.state,
      scene.timeMs,
    )
  }
  return new Set(liveStates.keys())
}
