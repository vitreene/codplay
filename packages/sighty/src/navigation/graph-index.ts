import type {
  SightyGraphView,
  SightyViewGraph,
  SightyViewMap,
} from '../types'
import type {
  IndexedEntry,
  IndexedGraph,
  IndexedSlot,
  ViewIndex,
} from './types'

/** Builds the single immutable navigation index used by the runtime. */
export function createViewIndex<
  SceneKey extends string = string,
  SlotName extends string = string,
>(root: SightyViewGraph<SceneKey, SlotName>): ViewIndex<SceneKey, SlotName> {
  const graphs = new Map<string, IndexedGraph<SceneKey, SlotName>>()
  const entries: IndexedEntry<SceneKey, SlotName>[] = []
  const entriesByPath = new Map<string, IndexedEntry<SceneKey, SlotName>>()
  const entriesByKey = new Map<string, IndexedEntry<SceneKey, SlotName>[]>()
  const entriesByScene = new Map<SceneKey, IndexedEntry<SceneKey, SlotName>[]>()
  const slots: IndexedSlot<SceneKey, SlotName>[] = []
  const slotsByAddress = new Map<string, IndexedSlot<SceneKey, SlotName>>()

  /** Walks one graph and records its entries, scopes and descendant slots. */
  const walkGraph = (
    graph: SightyViewGraph<SceneKey, SlotName>,
    graphPath: string,
    parentViews: readonly IndexedEntry<SceneKey, SlotName>[],
    inheritedScopes: readonly IndexedGraph<SceneKey, SlotName>[],
  ): IndexedGraph<SceneKey, SlotName> => {
    const graphScope: IndexedGraph<SceneKey, SlotName> = {
      path: graphPath,
      graph,
      entries: [],
      scope: isViewMap(graph) ? graph : {},
    }
    const graphScopes = [...inheritedScopes, graphScope]
    const directEntries = getDirectEntries(graph, graphPath).map((entry) => ({
      ...entry,
      parentViews,
      graphScopes,
    }))
    const indexedGraph = { ...graphScope, entries: directEntries }
    graphs.set(graphPath, indexedGraph)

    for (const entry of directEntries) {
      entries.push(entry)
      entriesByPath.set(entry.path, entry)
      addToIndex(entriesByKey, entry.key, entry)
      const sceneKey = entry.view.view.scene
      if (sceneKey !== undefined) addToIndex(entriesByScene, sceneKey, entry)

      const slotsInView = entry.view.view.slots ?? {}
      for (const [slotName, childGraph] of Object.entries(slotsInView) as [SlotName, SightyViewGraph<SceneKey, SlotName>][]) {
        const slotPath = `${entry.path}/${slotName}`
        const slot: IndexedSlot<SceneKey, SlotName> = {
          address: slotPath,
          slotName,
          graphPath: slotPath,
          ownerPath: entry.path,
          graph: childGraph,
        }
        slots.push(slot)
        slotsByAddress.set(slot.address, slot)
        walkGraph(childGraph, slotPath, [...parentViews, entry], graphScopes)
      }

      if (entry.view.view.views !== undefined) {
        walkGraph(entry.view.view.views, entry.path, [...parentViews, entry], graphScopes)
      }
      if (entry.view.view.graph !== undefined) {
        walkGraph(entry.view.view.graph, `${entry.path}/graph`, [...parentViews, entry], graphScopes)
      }
    }

    return indexedGraph
  }

  walkGraph(root, '', [], [])

  return {
    root,
    graphs,
    entries,
    entriesByPath,
    entriesByKey,
    entriesByScene,
    slots,
    slotsByAddress,
  }
}

/** Returns the direct entries of one graph in authored order. */
export function getDirectEntries<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  graphPath: string,
): readonly IndexedEntry<SceneKey, SlotName>[] {
  const rawEntries = isViewMap(graph)
    ? Object.entries(graph.views).map(([key, view]) => ({ key, view }))
    : graph.map((view, index) => ({ key: listEntryId(view, index), view }))

  return rawEntries
    .filter(({ view }) => view.hidden !== true)
    .map(({ key, view }, index) => ({
      key,
      path: appendPath(graphPath, key),
      graphPath,
      graph,
      view,
      index,
      parentViews: [],
      graphScopes: [],
    }))
}

/** Returns the declared start entry of one indexed graph. */
export function getStartEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  graphPath: string,
): IndexedEntry<SceneKey, SlotName> | undefined {
  const graph = index.graphs.get(graphPath)
  if (graph === undefined) return undefined
  const authoredGraph = graph.graph
  if (!isViewMap(authoredGraph)) return graph.entries[0]
  return graph.entries.find((entry) => entry.key === authoredGraph.start) ?? graph.entries[0]
}

/** Finds the deepest slot containing one normalized view address. */
export function findContainingSlot<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  path: string,
): IndexedSlot<SceneKey, SlotName> | undefined {
  return index.slots
    .filter((slot) => isPathPrefix(slot.graphPath, path))
    .sort((left, right) => right.graphPath.length - left.graphPath.length)[0]
}

/** Checks whether one normalized path contains another path. */
export function isPathPrefix(prefix: string, path: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** Normalizes a route path without changing its internal segments. */
export function normalizePath(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, '')
}

/** Tests whether a graph is an identified map rather than an ordered list. */
function isViewMap<
  SceneKey extends string = string,
  SlotName extends string = string,
>(graph: SightyViewGraph<SceneKey, SlotName>): graph is SightyViewMap<SceneKey, SlotName> {
  return !Array.isArray(graph)
}

/** Gets the stable key of one ordered entry, with a validation fallback. */
function listEntryId<
  SceneKey extends string,
  SlotName extends string,
>(view: SightyGraphView<SceneKey, SlotName>, index: number): string {
  const id = (view as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : String(index)
}

/** Appends one path segment without introducing a leading separator. */
function appendPath(basePath: string, segment: string): string {
  return basePath.length === 0 ? segment : `${basePath}/${segment}`
}

/** Adds an indexed item to a string-keyed multimap. */
function addToIndex<Key extends string, Value>(
  index: Map<Key, Value[]>,
  key: Key,
  value: Value,
): void {
  const values = index.get(key) ?? []
  values.push(value)
  index.set(key, values)
}
