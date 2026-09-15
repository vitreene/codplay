import type {
  SightyFile,
  SightyGraphView,
  SightyLegacyView,
  SightyViewGraph,
  SightyViewList,
  SightyViewListEntry,
  SightyViewMap,
  SightyViewScope,
} from './types'

/** Identifies one graph node together with its authored path and container. */
export type SightyGraphEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  key: string
  path: string
  graph: SightyViewGraph<SceneKey, SlotName>
  view: SightyGraphView<SceneKey, SlotName>
}>

/** Describes the parent scopes found while resolving one graph path. */
export type SightyGraphContext<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  entry: SightyGraphEntry<SceneKey, SlotName>
  parentViews: readonly SightyGraphEntry<SceneKey, SlotName>[]
  graphScopes: readonly SightyViewScope<SceneKey>[]
}>

/** Identifies one slot graph together with the view that owns it. */
export type SightyGraphSlot<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  slotName: SlotName
  graphPath: string
  ownerPath: string
  graph: SightyViewGraph<SceneKey, SlotName>
}>

/** Narrows a graph to the identified map representation. */
export function isSightyViewMap<
  SceneKey extends string = string,
  SlotName extends string = string,
>(graph: SightyViewGraph<SceneKey, SlotName>): graph is SightyViewMap<SceneKey, SlotName> {
  return !Array.isArray(graph)
}

/** Converts the legacy flat placement representation into the recursive graph form. */
export function normalizeSightyViewGraph<
  SceneKey extends string = string,
  SlotName extends string = string,
>(views: SightyFile<SceneKey, SlotName>['views'], version?: number): SightyViewGraph<SceneKey, SlotName> {
  const authoredVersion = version ?? (Array.isArray(views) ? 1 : 2)
  if (!Array.isArray(views) || authoredVersion >= 2) return views as SightyViewGraph<SceneKey, SlotName>
  return (views as readonly SightyLegacyView<SceneKey, SlotName>[]).map((view, index) => ({
    id: `legacy-view-${index}`,
    ...normalizeLegacyView(view),
  })) as SightyViewList<SceneKey, SlotName>
}

/** Converts one legacy flat view and each of its slot placements. */
function normalizeLegacyView<
  SceneKey extends string,
  SlotName extends string,
>(view: SightyLegacyView<SceneKey, SlotName>): SightyGraphView<SceneKey, SlotName> {
  return {
    view: {
      scene: view.view.scene,
      slots: Object.fromEntries(
        Object.entries(view.view.slots).map(([slotName, placements]) => [
          slotName,
          (placements as readonly { view: Readonly<{ scene: SceneKey }> }[]).map((placement, index) => ({
            id: `legacy-${slotName}-${index}`,
            view: { scene: placement.view.scene },
          })),
        ]),
      ) as unknown as Readonly<Record<SlotName, SightyViewGraph<SceneKey, SlotName>>>,
    },
  }
}

/** Lists the direct entries of one graph with paths rooted at the supplied prefix. */
export function getDirectGraphEntries<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath = '',
): readonly SightyGraphEntry<SceneKey, SlotName>[] {
  const entries = isSightyViewMap(graph)
    ? Object.entries(graph.views)
    : graph.map((view, index) => [getListEntryId(view, index), view] as const)
  return entries.map(([key, view]) => ({
    key,
    path: appendGraphPath(basePath, key),
    graph,
    view,
  }))
}

/** Lists every node of a graph, including nodes nested in slots and child graphs. */
export function getGraphEntries<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath = '',
): readonly SightyGraphEntry<SceneKey, SlotName>[] {
  const entries: SightyGraphEntry<SceneKey, SlotName>[] = []
  collectGraphEntries(graph, basePath, entries)
  return entries
}

/** Lists the external action references declared by one recursive view graph. */
export function getGraphActionReferences<
  SceneKey extends string = string,
  SlotName extends string = string,
>(graph: SightyViewGraph<SceneKey, SlotName>): readonly string[] {
  const references: string[] = []
  collectGraphActionReferences(graph, references)
  return references
}

/** Collects graph and view action references without resolving their handlers. */
function collectGraphActionReferences<
  SceneKey extends string,
  SlotName extends string,
>(graph: SightyViewGraph<SceneKey, SlotName>, references: string[]): void {
  if (isSightyViewMap(graph)) addActionReferences(graph, references)

  for (const entry of getDirectGraphEntries(graph)) {
    addActionReferences(entry.view, references)
    const slots = entry.view.view.slots ?? {}
    for (const childGraph of Object.values(slots) as SightyViewGraph<SceneKey, SlotName>[]) {
      collectGraphActionReferences(childGraph, references)
    }
    if (entry.view.view.views !== undefined) {
      collectGraphActionReferences(entry.view.view.views, references)
    }
    if (entry.view.view.graph !== undefined) {
      collectGraphActionReferences(entry.view.view.graph, references)
    }
  }
}

/** Adds each non-empty external action reference from one scope once. */
function addActionReferences<SceneKey extends string>(scope: SightyViewScope<SceneKey>, references: string[]): void {
  for (const action of Object.values(scope.actions ?? {})) {
    if (action.action !== undefined && !references.includes(action.action)) references.push(action.action)
  }
}

/** Lists every slot graph declared below a recursive view graph. */
export function getGraphSlots<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath = '',
): readonly SightyGraphSlot<SceneKey, SlotName>[] {
  const slots: SightyGraphSlot<SceneKey, SlotName>[] = []
  collectGraphSlots(graph, basePath, slots)
  return slots
}

/** Collects slot graphs while retaining their owning view path. */
function collectGraphSlots<
  SceneKey extends string,
  SlotName extends string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath: string,
  slots: SightyGraphSlot<SceneKey, SlotName>[],
): void {
  for (const entry of getDirectGraphEntries(graph, basePath)) {
    const declaredSlots = entry.view.view.slots ?? {}
    for (const [slotName, childGraph] of Object.entries(declaredSlots) as [SlotName, SightyViewGraph<SceneKey, SlotName>][]) {
      const graphPath = `${entry.path}/${slotName}`
      slots.push({ slotName, graphPath, ownerPath: entry.path, graph: childGraph })
      collectGraphSlots(childGraph, graphPath, slots)
    }

    const childViews = entry.view.view.views
    if (childViews !== undefined) collectGraphSlots(childViews, entry.path, slots)

    const nestedGraph = entry.view.view.graph
    if (nestedGraph !== undefined) collectGraphSlots(nestedGraph, `${entry.path}/graph`, slots)
  }
}

/** Collects one graph subtree in authored order. */
function collectGraphEntries<
  SceneKey extends string,
  SlotName extends string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath: string,
  entries: SightyGraphEntry<SceneKey, SlotName>[],
): void {
  for (const entry of getDirectGraphEntries(graph, basePath)) {
    entries.push(entry)
    const slots = entry.view.view.slots ?? {}
    for (const [slotName, childGraph] of Object.entries(slots) as [string, SightyViewGraph<SceneKey, SlotName>][]) {
      collectGraphEntries(childGraph, `${entry.path}/${slotName}`, entries)
    }

    const childViews = entry.view.view.views
    if (childViews !== undefined) collectGraphEntries(childViews, entry.path, entries)

    const nestedGraph = entry.view.view.graph
    if (nestedGraph !== undefined) collectGraphEntries(nestedGraph, `${entry.path}/graph`, entries)
  }
}

/** Returns the declared start node of one graph. */
export function getGraphStartEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath = '',
): SightyGraphEntry<SceneKey, SlotName> | undefined {
  const entries = getDirectGraphEntries(graph, basePath)
  if (entries.length === 0) return undefined
  if (!isSightyViewMap(graph)) return entries[0]
  return entries.find((entry) => entry.key === graph.start)
}

/** Finds the first node carrying one scene key in a recursive graph. */
export function findGraphViewByScene<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  sceneKey: SceneKey,
): SightyGraphEntry<SceneKey, SlotName> | undefined {
  return getGraphEntries(graph).find((entry) => entry.view.view.scene === sceneKey)
}

/** Finds one node by its normalized slash-separated graph path. */
export function findGraphViewByPath<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
): SightyGraphEntry<SceneKey, SlotName> | undefined {
  const normalizedPath = normalizeGraphPath(path)
  return getGraphEntries(graph).find((entry) => entry.path === normalizedPath)
}

/** Resolves one graph path and returns its inherited view and graph scopes. */
export function findGraphContext<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
): SightyGraphContext<SceneKey, SlotName> | undefined {
  const normalizedPath = normalizeGraphPath(path)
  return findGraphContextInGraph(graph, '', normalizedPath, [], [])
}

/** Searches a graph subtree while retaining the scopes inherited by descendants. */
function findGraphContextInGraph<
  SceneKey extends string,
  SlotName extends string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath: string,
  targetPath: string,
  parentViews: readonly SightyGraphEntry<SceneKey, SlotName>[],
  inheritedGraphScopes: readonly SightyViewScope<SceneKey>[],
): SightyGraphContext<SceneKey, SlotName> | undefined {
  const graphScopes = isSightyViewMap(graph)
    ? [...inheritedGraphScopes, graph]
    : inheritedGraphScopes

  for (const entry of getDirectGraphEntries(graph, basePath)) {
    if (entry.path === targetPath) return { entry, parentViews, graphScopes }

    const nextParentViews = [...parentViews, entry]
    const slots = entry.view.view.slots ?? {}
    for (const [slotName, childGraph] of Object.entries(slots) as [string, SightyViewGraph<SceneKey, SlotName>][]) {
      const result = findGraphContextInGraph(
        childGraph,
        `${entry.path}/${slotName}`,
        targetPath,
        nextParentViews,
        graphScopes,
      )
      if (result !== undefined) return result
    }

    const childViews = entry.view.view.views
    if (childViews !== undefined) {
      const result = findGraphContextInGraph(
        childViews,
        entry.path,
        targetPath,
        nextParentViews,
        graphScopes,
      )
      if (result !== undefined) return result
    }

    const nestedGraph = entry.view.view.graph
    if (nestedGraph !== undefined) {
      const result = findGraphContextInGraph(
        nestedGraph,
        `${entry.path}/graph`,
        targetPath,
        nextParentViews,
        graphScopes,
      )
      if (result !== undefined) return result
    }
  }
  return undefined
}

/** Returns the stable authored identifier of one ordered graph entry. */
function getListEntryId<
  SceneKey extends string,
  SlotName extends string,
>(view: SightyViewListEntry<SceneKey, SlotName> | SightyGraphView<SceneKey, SlotName>, index: number): string {
  const id = (view as Partial<SightyViewListEntry<SceneKey, SlotName>>).id
  return typeof id === 'string' && id.length > 0 ? id : String(index)
}

/** Joins one graph path segment without introducing a leading slash. */
function appendGraphPath(basePath: string, segment: string): string {
  return basePath.length === 0 ? segment : `${basePath}/${segment}`
}

/** Normalizes the author-facing path syntax used by route targets. */
function normalizeGraphPath(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, '')
}
