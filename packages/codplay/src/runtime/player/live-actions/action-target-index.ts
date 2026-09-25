import type { CompiledScene } from '../../../scene/compiled'
import type { LiveActionTarget } from './live-action-types'

/** Resolves targets from the single compiled action index for one player. */
export function indexCompiledLiveActionTargets(
  compiledScene: CompiledScene,
): ReadonlyMap<string, readonly LiveActionTarget[]> {
  const index = new Map<string, readonly LiveActionTarget[]>()
  for (const [actionName, targets] of Object.entries(compiledScene.actionTargetIndex)) {
    const resolvedTargets: LiveActionTarget[] = []
    for (const target of targets) {
      const story = compiledScene.scene.stories[target.storyId]
      const perso = story?.persos.find((candidate) => candidate.id === target.persoId)
      const actionValue = perso?.actions[actionName]
      if (actionValue !== undefined) {
        resolvedTargets.push({
          persoKey: `${target.storyId}:${target.persoId}`,
          actionValue,
        })
      }
    }
    index.set(actionName, resolvedTargets)
  }
  return index
}
