import type {
  SightyGraphView,
  SightyViewGraph,
  SightyViewListEntry,
  SightyViewMap,
} from '../types'

/** Describes one raw authored graph entry before path or index metadata. */
export type AuthoredGraphEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  key: string
  view: SightyGraphView<SceneKey, SlotName>
}>

/** Narrows a graph to the identified map representation without enumerating it. */
export function isAuthoredViewMap<
  SceneKey extends string = string,
  SlotName extends string = string,
>(graph: SightyViewGraph<SceneKey, SlotName>): graph is SightyViewMap<SceneKey, SlotName> {
  return !Array.isArray(graph)
}

/** Enumerates one graph's authored entries in map or list order. */
export function getAuthoredGraphEntries<
  SceneKey extends string = string,
  SlotName extends string = string,
>(graph: SightyViewGraph<SceneKey, SlotName>): readonly AuthoredGraphEntry<SceneKey, SlotName>[] {
  if (isAuthoredViewMap(graph)) {
    return Object.entries(graph.views).map(([key, view]) => ({ key, view }))
  }
  return graph.map((view, index) => ({ key: getListEntryId(view, index), view }))
}

/** Returns the stable identifier of one ordered graph entry. */
function getListEntryId<
  SceneKey extends string,
  SlotName extends string,
>(view: SightyViewListEntry<SceneKey, SlotName> | SightyGraphView<SceneKey, SlotName>, index: number): string {
  const id = (view as Partial<SightyViewListEntry<SceneKey, SlotName>>).id
  return typeof id === 'string' && id.length > 0 ? id : String(index)
}
