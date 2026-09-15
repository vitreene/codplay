import type {
  SightyGraphView,
  SightyRouteTarget,
  SightyViewGraph,
  SightyViewScope,
} from '../types'

/** Describes one graph container in the normalized author graph. */
export type IndexedGraph<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  path: string
  graph: SightyViewGraph<SceneKey, SlotName>
  entries: readonly IndexedEntry<SceneKey, SlotName>[]
  scope: SightyViewScope<SceneKey>
}>

/** Describes one authored view with its stable internal address. */
export type IndexedEntry<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  key: string
  path: string
  graphPath: string
  graph: SightyViewGraph<SceneKey, SlotName>
  view: SightyGraphView<SceneKey, SlotName>
  index: number
  parentViews: readonly IndexedEntry<SceneKey, SlotName>[]
  graphScopes: readonly IndexedGraph<SceneKey, SlotName>[]
}>

/** Describes one authored slot and the graph it owns. */
export type IndexedSlot<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  address: string
  slotName: SlotName
  graphPath: string
  ownerPath: string
  graph: SightyViewGraph<SceneKey, SlotName>
}>

/** Immutable navigation index derived from one normalized author graph. */
export type ViewIndex<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  root: SightyViewGraph<SceneKey, SlotName>
  graphs: ReadonlyMap<string, IndexedGraph<SceneKey, SlotName>>
  entries: readonly IndexedEntry<SceneKey, SlotName>[]
  entriesByPath: ReadonlyMap<string, IndexedEntry<SceneKey, SlotName>>
  entriesByKey: ReadonlyMap<string, readonly IndexedEntry<SceneKey, SlotName>[]>
  entriesByScene: ReadonlyMap<SceneKey, readonly IndexedEntry<SceneKey, SlotName>[]>
  slots: readonly IndexedSlot<SceneKey, SlotName>[]
  slotsByAddress: ReadonlyMap<string, IndexedSlot<SceneKey, SlotName>>
}>

/** Describes one scene selected in one logical slot. */
export type ActiveSelection<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  slotAddress: string
  slotName: SlotName
  graphPath: string
  ownerPath: string
  entry: IndexedEntry<SceneKey, SlotName>
  sceneEntry: IndexedEntry<SceneKey, SlotName>
  sceneKey: SceneKey
  generation: number
}>

/** Represents the one logical composition currently published by Sighty. */
export type ActiveComposition<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  revision: number
  layoutPath: string
  selections: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>
}>

/** One candidate action selected by the pure navigation resolver. */
export type ResolvedAction<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  action: Readonly<{
    action?: string
    go?: SightyRouteTarget
  }>
  selection: ActiveSelection<SceneKey, SlotName>
  order: number
  depth: number
  sourceMatch: boolean
}>
