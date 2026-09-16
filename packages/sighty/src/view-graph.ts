import type {
  SightyFile,
  SightyGraphView,
  SightyLegacyView,
  SightyViewGraph,
  SightyViewList,
  SightyViewListEntry,
  SightyViewMap,
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
    ...(view.coupling === undefined ? {} : { coupling: view.coupling }),
    ...(view.showMode === undefined ? {} : { showMode: view.showMode }),
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
    path: basePath.length === 0 ? key : `${basePath}/${key}`,
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
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')
  return getGraphEntries(graph).find((entry) => entry.path === normalizedPath)
}

/** Returns the stable authored identifier of one ordered graph entry. */
function getListEntryId<
  SceneKey extends string,
  SlotName extends string,
>(view: SightyViewListEntry<SceneKey, SlotName> | SightyGraphView<SceneKey, SlotName>, index: number): string {
  const id = (view as Partial<SightyViewListEntry<SceneKey, SlotName>>).id
  return typeof id === 'string' && id.length > 0 ? id : String(index)
}
