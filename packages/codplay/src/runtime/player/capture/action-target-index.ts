import type { CompiledScene } from '../../../scene/compiled'
import type { CaptureActionTarget } from './types'

/** Resolves the compiled action-target index once when the player is created. */
export function indexCompiledCaptureActionTargets(
  compiledScene: CompiledScene,
): ReadonlyMap<string, readonly CaptureActionTarget[]> {
  const index = new Map<string, readonly CaptureActionTarget[]>()
  for (const [actionName, targets] of Object.entries(compiledScene.actionTargetIndex)) {
    const resolvedTargets: CaptureActionTarget[] = []
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
