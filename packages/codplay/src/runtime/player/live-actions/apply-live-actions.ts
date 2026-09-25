import type { CompiledFunctionCollection, CompiledRecord } from '../../../scene/compiled'
import type { RuntimeComponentRuntime } from '../../components'
import { resolveLiveActionState, type SolvedScene } from '../pipeline'
import type { ActiveLiveActions } from './live-action-types'

/** Applies all active source actions through the standard component update path. */
export function applyLiveActions(
  scene: SolvedScene | undefined,
  componentRuntime: RuntimeComponentRuntime | undefined,
  sourceActions: ReadonlyMap<string, ActiveLiveActions>,
  previousLivePersoKeys: ReadonlySet<string>,
  functions: CompiledFunctionCollection,
): Set<string> {
  if (scene === undefined || componentRuntime === undefined) return new Set()

  const liveStates = new Map<string, CompiledRecord>()
  for (const actions of sourceActions.values()) {
    for (const active of actions) {
      for (const target of active.targets) {
        const perso = scene.persos[target.persoKey]
        if (perso === undefined) continue
        const currentState = liveStates.get(target.persoKey) ?? perso.state
        const nextState = resolveLiveActionState(
          currentState,
          target.actionValue,
          active.action.data,
          functions,
        )
        if (nextState !== undefined) liveStates.set(target.persoKey, nextState)
      }
    }
  }
  const affectedPersoKeys = new Set([...previousLivePersoKeys, ...liveStates.keys()])
  for (const persoKey of affectedPersoKeys) {
    const perso = scene.persos[persoKey]
    if (perso === undefined) continue
    componentRuntime.updateLive(persoKey, liveStates.get(persoKey) ?? perso.state, scene.timeMs)
  }
  return new Set(liveStates.keys())
}
