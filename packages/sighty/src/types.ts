import type { SceneDoc } from 'codplay/scene/types'

/** Identifies a scene resource in an authored Sighty file. */
export type SightySceneKey = string

/** Identifies a slot declared by an authored layout scene. */
export type SightySlotName = string

/** Describes one child scene placed in a view slot. */
export type SightySlotPlacement<SceneKey extends string = string> = Readonly<{
  view: Readonly<{ scene: SceneKey }>
}>

/** Describes a data binding declared by one view. */
export type SightyDataBinding = Readonly<{
  from: string
  update: 'entry' | 'live'
  event?: string
}>

/** Describes one authored value or one authored data binding. */
export type SightyDataValue = unknown | SightyDataBinding

/** Describes one direction understood by the Sighty view graph. */
export type SightyViewDirection = 'next' | 'previous' | 'up' | 'down'

/** Describes the destination declared by one view action. */
export type SightyRouteTarget =
  | Readonly<{ path: string }>
  | Readonly<{ label: string }>
  | Readonly<{ direction: SightyViewDirection }>

/** Describes one serializable action attached to a view or graph scope. */
export type SightyViewAction = Readonly<{
  action?: string
  go?: SightyRouteTarget
}>

/** Describes actions and guards inherited by descendant view nodes. */
export type SightyViewScope = Readonly<{
  actions?: Readonly<Record<string, SightyViewAction>>
  guards?: Readonly<Record<string, string>>
}>

/** Describes the scene, slots and nested graph carried by one view node. */
export type SightyViewContent<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  scene?: SceneKey
  /** Child views owned by this view. */
  views?: SightyViewGraph<SceneKey, SlotName>
  slots?: Readonly<Partial<Record<SlotName, SightyViewGraph<SceneKey, SlotName>>>>
  /** @deprecated Kept while legacy authored files are migrated. */
  graph?: SightyViewGraph<SceneKey, SlotName>
}>

/** Describes one node in the recursive authored view graph. */
export type SightyGraphView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyViewScope & Readonly<{
  data?: Readonly<Record<string, SightyDataValue>>
  view: SightyViewContent<SceneKey, SlotName>
}>

/** Describes an ordered graph whose next/previous routes use array order. */
export type SightyViewListEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyGraphView<SceneKey, SlotName> & Readonly<{
  /** Stable address of the entry inside its list. */
  id: string
}>

export type SightyViewList<
  SceneKey extends string = string,
  SlotName extends string = string,
> = readonly SightyViewListEntry<SceneKey, SlotName>[]

/** Describes an identified graph whose routes use its declared view keys. */
export type SightyViewMap<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyViewScope & Readonly<{
  start: string
  views: Readonly<Record<string, SightyGraphView<SceneKey, SlotName>>>
}>

/** Describes one recursive list or map of authored view nodes. */
export type SightyViewGraph<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyViewList<SceneKey, SlotName> | SightyViewMap<SceneKey, SlotName>

/** Keeps the first flat file shape readable while projects migrate to graphs. */
export type SightyLegacyView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  view: Readonly<{
    scene: SceneKey
    slots: Readonly<Record<SlotName, readonly SightySlotPlacement<SceneKey>[]>>
  }>
}>

/** Names one normalized graph node returned by the scenario surface. */
export type SightyView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyGraphView<SceneKey, SlotName>

/** Describes the serializable Sighty file that references authored resources. */
export type SightyFile<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  /** Optional in the project-local authoring form. */
  format?: 'sighty'
  /** Optional until the file format is versioned as a published contract. */
  version?: number
  id?: string
  /** Legacy embedded resource declarations. */
  resources?: Readonly<{
    scenes: Readonly<Record<SceneKey, string>>
    data?: Readonly<Record<string, string>>
  }>
  views: SightyViewGraph<SceneKey, SlotName> | readonly SightyLegacyView<SceneKey, SlotName>[]
}>

/** Catalogs the CodPlay scene documents supplied to an authored project. */
export type SightySceneCatalog<SceneKey extends string = string> = Readonly<
  Record<SceneKey, SceneDoc<string>>
>

/** Groups the scenario resources consumed by one Sighty project. */
export type SightyScenarioResources<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  file: SightyFile<SceneKey, SlotName>
  scenes: SightySceneCatalog<SceneKey>
  data?: Readonly<Record<string, unknown>>
}>

/** Backward-compatible internal name for the scenario resource bundle. */
export type SightyAuthoringResources<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyScenarioResources<SceneKey, SlotName>

/** Reports one inconsistency in an authored Sighty resource graph. */
export type SightyAuthoringDiagnostic = Readonly<{
  code:
    | 'AUTHOR_SCENE_RESOURCE_MISSING'
    | 'AUTHOR_SCENE_RESOURCE_UNDECLARED'
    | 'AUTHOR_VIEW_SCENE_UNKNOWN'
    | 'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN'
    | 'AUTHOR_VIEW_GRAPH_START_UNKNOWN'
    | 'AUTHOR_VIEW_LIST_ID_MISSING'
    | 'AUTHOR_VIEW_LIST_ID_DUPLICATE'
    | 'AUTHOR_VIEW_ROUTE_UNKNOWN'
  path: string
  message: string
}>

/** Public scenario surface grouped under the Sighty facade. */
export type SightyScenarioApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  file: SightyFile<SceneKey, SlotName>
  scenes: SightySceneCatalog<SceneKey>
  data: Readonly<Record<string, unknown>>
  sceneKeys: readonly SceneKey[]
  getSlotNames: (sceneKey: SceneKey) => readonly SlotName[]
  getScene: (sceneKey: SceneKey) => SightySceneCatalog<SceneKey>[SceneKey] | undefined
  getData: (dataKey: string) => unknown
  getView: (sceneKey: SceneKey) => SightyView<SceneKey, SlotName> | undefined
  getViewGraph: () => SightyViewGraph<SceneKey, SlotName>
  validate: () => readonly SightyAuthoringDiagnostic[]
}>
