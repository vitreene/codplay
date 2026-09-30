import type {
  SightyGraphView,
  SightyViewGraph,
} from './types'
import { getAuthoredGraphEntries } from './navigation/graph-entries'

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

/** Lists the direct entries of one graph with paths rooted at the supplied prefix. */
export function getDirectGraphEntries<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  basePath = '',
): readonly SightyGraphEntry<SceneKey, SlotName>[] {
  return getAuthoredGraphEntries(graph).map(({ key, view }) => ({
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

  }
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
