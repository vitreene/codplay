import type { SightyCondition, SightyShowMode } from '../types'
import type { ActiveSelection } from './types'

/** Identifies one author scope that can provide an inherited condition. */
export type ConditionScope<SceneKey extends string = string> = Readonly<{
  path: string
  scope: Readonly<{
    accessBy?: SightyCondition<SceneKey>
    exitBy?: SightyCondition<SceneKey>
    showMode?: SightyShowMode
    onDenied?: Readonly<{ path: string } | { label: string } | { direction: 'next' | 'previous' | 'up' | 'down' }>
  }>
}>

/** Returns condition scopes from the most specific declaration to its ancestors. */
export function getConditionScopes<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): readonly ConditionScope<SceneKey>[] {
  const scopes: ConditionScope<SceneKey>[] = [
    { path: selection.entry.path, scope: selection.entry.view },
    ...[...selection.entry.graphScopes].reverse().map((graph) => ({
      path: graph.path,
      scope: graph.scope,
    })),
    ...[...selection.entry.parentViews].reverse().map((parent) => ({
      path: parent.path,
      scope: parent.view,
    })),
  ]
  const seen = new Set<string>()
  return scopes.filter((candidate) => {
    if (seen.has(candidate.path)) return false
    seen.add(candidate.path)
    return true
  })
}

/** Resolves the nearest access condition and its optional escape route. */
export function resolveAccessCondition<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): Readonly<{
  path: string
  condition: SightyCondition<SceneKey>
  onDenied?: ConditionScope<SceneKey>['scope']['onDenied']
}> | undefined {
  const scope = getConditionScopes(selection).find((candidate) => candidate.scope.accessBy !== undefined)
  if (scope === undefined || scope.scope.accessBy === undefined) return undefined
  return {
    path: scope.path,
    condition: scope.scope.accessBy,
    ...(scope.scope.onDenied === undefined ? {} : { onDenied: scope.scope.onDenied }),
  }
}

/** Resolves the nearest exit condition attached to one active selection. */
export function resolveExitCondition<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): Readonly<{ path: string; condition: SightyCondition<SceneKey> }> | undefined {
  const scope = getConditionScopes(selection).find((candidate) => candidate.scope.exitBy !== undefined)
  if (scope === undefined || scope.scope.exitBy === undefined) return undefined
  return { path: scope.path, condition: scope.scope.exitBy }
}
