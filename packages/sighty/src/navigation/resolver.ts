import type { SightyViewAction } from '../types'
import type {
  ActiveComposition,
  ActiveSelection,
  ResolvedAction,
} from './types'

/** Describes the public information used to resolve one incoming event. */
export type NavigationEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
}>

/** Resolves active actions from the most specific scope to inherited scopes. */
export function resolveActionCandidates<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  composition: ActiveComposition<SceneKey, SlotName>,
  event: NavigationEvent<SceneKey>,
): readonly ResolvedAction<SceneKey, SlotName>[] {
  const candidates: ResolvedAction<SceneKey, SlotName>[] = []
  let order = 0

  for (const selection of composition.selections.values()) {
    const scopes = scopesForSelection(selection)
    for (const scope of scopes) {
      const action = scope.actions?.[event.name]
      if (action === undefined) continue
      candidates.push({
        action,
        selection,
        order: order++,
        depth: scope.path.length === 0 ? 0 : scope.path.split('/').length,
        sourceMatch: selection.sceneKey === event.sourceSceneKey,
      })
    }
  }

  return candidates.sort(compareCandidates)
}

/** Collects the action scopes attached to one selected entry. */
function scopesForSelection<
  SceneKey extends string,
  SlotName extends string,
>(selection: ActiveSelection<SceneKey, SlotName>): readonly ActionScope[] {
  const entry = selection.entry
  const scopes: ActionScope[] = [
    { id: `view:${entry.path}`, path: entry.path, actions: entry.view.actions },
  ]

  for (const graph of [...entry.graphScopes].reverse()) {
    scopes.push({ id: `graph:${graph.path}`, path: graph.path, actions: graph.scope.actions })
  }
  for (const parent of [...entry.parentViews].reverse()) {
    scopes.push({ id: `view:${parent.path}`, path: parent.path, actions: parent.view.actions })
  }

  return scopes.filter((scope, scopeIndex) => {
    if (scope.actions === undefined) return false
    return scopes.findIndex((candidate) => candidate.id === scope.id) === scopeIndex
  })
}

/** Orders local actions before less-specific inherited actions. */
function compareCandidates<
  SceneKey extends string,
  SlotName extends string,
>(
  left: ResolvedAction<SceneKey, SlotName>,
  right: ResolvedAction<SceneKey, SlotName>,
): number {
  if (left.depth !== right.depth) return right.depth - left.depth
  if (left.sourceMatch !== right.sourceMatch) return left.sourceMatch ? -1 : 1
  return left.order - right.order
}

/** Keeps action scope typing separate from the public authoring type. */
type ActionScope = Readonly<{
  id: string
  path: string
  actions: Readonly<Record<string, SightyViewAction>> | undefined
}>
