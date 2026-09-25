import type { CompiledFunctionCollection, CompiledScene } from '../../../scene/compiled'
import type { RuntimeComponentRuntime } from '../../components'
import { indexCompiledLiveActionTargets } from './action-target-index'
import type { SolvedScene } from '../pipeline'
import { applyLiveActions } from './apply-live-actions'
import type { ActiveLiveActions, LiveActionTarget, RuntimeLiveAction } from './live-action-types'

/** Dependencies for resolving source actions through the compiled player scene. */
export type RuntimePlayerLiveActionControllerContext = Readonly<{
  compiledScene: CompiledScene
  componentRuntime: RuntimeComponentRuntime | undefined
  functions: CompiledFunctionCollection
  getSolvedScene: () => SolvedScene | undefined
}>

/** Shares one compiled action index and update path across capture and browser sources. */
export class RuntimePlayerLiveActionController {
  private readonly compiledTargets: ReadonlyMap<string, readonly LiveActionTarget[]>
  private readonly context: RuntimePlayerLiveActionControllerContext
  private readonly sourceActions = new Map<string, ActiveLiveActions>()
  private livePersoKeys = new Set<string>()

  /** Creates the shared live action path for one player. */
  constructor(context: RuntimePlayerLiveActionControllerContext) {
    this.context = context
    this.compiledTargets = indexCompiledLiveActionTargets(context.compiledScene)
  }

  /** Replaces one source's actions and presents the resulting live state. */
  setLiveActions(sourceId: string, actions: readonly RuntimeLiveAction[] | undefined): void {
    if (actions === undefined || actions.length === 0) {
      if (!this.sourceActions.has(sourceId)) return
      this.sourceActions.delete(sourceId)
    } else {
      this.sourceActions.set(sourceId, actions.map((action) => ({
        action,
        targets: this.compiledTargets.get(action.name) ?? [],
      })))
    }
    this.reapply()
  }

  /** Removes multiple source outputs and presents their restored base states. */
  removeSources(sourceIds: Iterable<string>): void {
    let changed = false
    for (const sourceId of sourceIds) changed = this.sourceActions.delete(sourceId) || changed
    if (changed) this.reapply()
  }

  /** Reapplies retained source values after the logical scene is presented. */
  reapply(scene?: SolvedScene): void {
    this.livePersoKeys = applyLiveActions(
      scene ?? this.context.getSolvedScene(),
      this.context.componentRuntime,
      this.sourceActions,
      this.livePersoKeys,
      this.context.functions,
    )
  }

  /** Drops retained values after the player and its components are destroyed. */
  clear(): void {
    this.sourceActions.clear()
    this.livePersoKeys.clear()
  }
}
