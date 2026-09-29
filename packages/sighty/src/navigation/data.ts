import type { ActiveSelection } from './types'

/** Resolves scenario and inherited view data for one active selection. */
export function resolveViewData<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
  scenarioData: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const values: Record<string, unknown> = { ...scenarioData }

  for (const declaration of collectDataDeclarations(selection)) {
    Object.assign(values, declaration.data ?? {})
  }

  return values
}

/** Collects inherited data declarations from broader to local view scope. */
function collectDataDeclarations<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): readonly Readonly<{ path: string; data?: Readonly<Record<string, unknown>> }>[] {
  const declarations = [
    ...selection.entry.graphScopes.map((graph) => ({ path: graph.path, data: graph.scope.data })),
    ...selection.entry.parentViews.map((parent) => ({ path: parent.path, data: parent.view.data })),
    { path: selection.entry.path, data: selection.entry.view.data },
  ]

  return declarations
    .map((declaration, order) => ({ ...declaration, order }))
    .sort((left, right) => {
      const leftDepth = left.path.length === 0 ? 0 : left.path.split('/').length
      const rightDepth = right.path.length === 0 ? 0 : right.path.split('/').length
      const depthDifference = leftDepth - rightDepth
      return depthDifference === 0 ? left.order - right.order : depthDifference
    })
}
