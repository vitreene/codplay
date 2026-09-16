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

/** Describes the event information made available to one author condition. */
export type SightyConditionEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
  data?: unknown
}>

/** Describes the read-only situation in which one access or exit condition runs. */
export type SightyConditionContext<SceneKey extends string = string> = Readonly<{
  event?: SightyConditionEvent<SceneKey>
  sceneKey: SceneKey
  data: Readonly<Record<string, unknown>>
  context: Readonly<Record<string, unknown>>
  state: Readonly<Record<string, unknown>>
}>

/** Defines one author condition; functions are allowed in the author file. */
export type SightyConditionFunction<SceneKey extends string = string> = (
  context: SightyConditionContext<SceneKey>,
) => boolean | Promise<boolean>

/** References a condition by catalog name or embeds its author function. */
export type SightyCondition<SceneKey extends string = string> =
  | string
  | SightyConditionFunction<SceneKey>

/** Describes one direction understood by the Sighty view graph. */
export type SightyViewDirection = 'next' | 'previous' | 'up' | 'down'

/** Describes the destination declared by one view action. */
export type SightyRouteTarget =
  | Readonly<{ path: string }>
  | Readonly<{ label: string }>
  | Readonly<{ direction: SightyViewDirection }>

/** Selects how an occurrence is treated when its view is shown again. */
export type SightyShowMode = 'reset' | 'maintain' | 'rewind'

/** Describes one serializable action attached to a view or graph scope. */
export type SightyViewAction = Readonly<{
  action?: string
  go?: SightyRouteTarget
}>

/** Names of the CodPlay telco commands that Sighty can mediate declaratively. */
export type SightyTelcoCommand =
  | 'play'
  | 'pause'
  | 'togglePlay'
  | 'setRate'
  | 'seek'
  | 'rewind'
  | 'reset'

/** Describes one event-to-telco relation declared by an authored view. */
export type SightyCouplingDescriptor<SlotName extends string = string> = Readonly<{
  couplingId: string
  controllerSlot?: SlotName
  controlledSlot: SlotName
  commands: Readonly<Record<string, SightyTelcoCommand | readonly SightyTelcoCommand[]>>
}>

/** Describes actions, conditions and data inherited by descendant view nodes. */
export type SightyViewScope<SceneKey extends string = string> = Readonly<{
  actions?: Readonly<Record<string, SightyViewAction>>
  data?: Readonly<Record<string, SightyDataValue>>
  /** Controls the occurrence when this scope admits a view again. */
  showMode?: SightyShowMode
  /** Admits the view when the condition returns true. */
  accessBy?: SightyCondition<SceneKey>
  /** Allows the owning view to be left when the condition returns true. */
  exitBy?: SightyCondition<SceneKey>
  /** Route used when the access condition refuses the view. */
  onDenied?: SightyRouteTarget
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
> = SightyViewScope<SceneKey> & Readonly<{
  view: SightyViewContent<SceneKey, SlotName>
  /** Mediates public controller events to the telco of another declared slot. */
  coupling?: SightyCouplingDescriptor<SlotName>
  /** Keeps a declaration in the file while excluding it from navigation. */
  hidden?: boolean
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
> = SightyViewScope<SceneKey> & Readonly<{
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
  /** Allows legacy flat files to use the current view-level coupling contract. */
  coupling?: SightyCouplingDescriptor<SlotName>
  /** Applies to legacy placements after they are normalized to a view graph. */
  showMode?: SightyShowMode
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
  /** Author-provided base data for the declared scenario. */
  data?: Readonly<Record<string, unknown>>
  /** Default occurrence policy inherited by every view in this scenario. */
  showMode?: SightyShowMode
  /** Legacy embedded resource declarations. */
  resources?: Readonly<{
    scenes?: Partial<Readonly<Record<SceneKey, string>>>
    data?: Readonly<Record<string, string>>
  }>
  views: SightyViewGraph<SceneKey, SlotName> | readonly SightyLegacyView<SceneKey, SlotName>[]
}>

/** Catalogs the CodPlay scene documents supplied to an authored project. */
export type SightySceneCatalog<SceneKey extends string = string> = Readonly<
  Record<SceneKey, SceneDoc<string>>
>

/** Supplies one scene immediately or creates it only when selected. */
export type SightySceneSource =
  | SceneDoc<string>
  | (() => SceneDoc<string> | Promise<SceneDoc<string>>)

/** Groups the scenario resources consumed by one Sighty project. */
export type SightyScenarioResources<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  file: SightyFile<SceneKey, SlotName>
  scenes?: Partial<SightySceneCatalog<SceneKey>>
  sceneSources?: Partial<Readonly<Record<SceneKey, SightySceneSource>>>
  data?: Readonly<Record<string, unknown>>
}>

/** Backward-compatible internal name for the scenario resource bundle. */
export type SightyAuthoringResources<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyScenarioResources<SceneKey, SlotName>

/** Identifies one authored view for an integration operation. */
export type SightyViewReference = Readonly<
  | { path: string }
  | { label: string }
>

/** Describes the shallow view fields that an integration may replace. */
export type SightyViewPatch<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<Partial<SightyGraphView<SceneKey, SlotName>>>

/** Describes one validated scenario structure mutation. */
export type SightyScenarioMutation<
  SceneKey extends string = string,
  SlotName extends string = string,
> =
  | Readonly<{
      kind: 'add-view'
      parent: SightyViewReference
      id: string
      view: SightyGraphView<SceneKey, SlotName>
      slot?: SlotName
    }>
  | Readonly<{
      kind: 'update-view'
      target: SightyViewReference
      patch: SightyViewPatch<SceneKey, SlotName>
    }>
  | Readonly<{
      kind: 'remove-view' | 'hide-view' | 'show-view'
      target: SightyViewReference
    }>

/** Selects how existing execution is treated after a scenario mutation. */
export type SightyMutationReloadPolicy = 'preserve' | 'rewind' | 'reset' | 'reload'

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
    | 'AUTHOR_VIEW_ROUTE_AMBIGUOUS'
    | 'AUTHOR_COUPLING_ID_MISSING'
    | 'AUTHOR_COUPLING_CONTROLLER_SLOT_UNKNOWN'
    | 'AUTHOR_COUPLING_CONTROLLED_SLOT_UNKNOWN'
    | 'AUTHOR_COUPLING_COMMAND_UNKNOWN'
    | 'AUTHOR_SHOW_MODE_UNKNOWN'
  path: string
  message: string
}>

/** Public scenario surface grouped under the Sighty facade. */
export type SightyScenarioApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  file: SightyFile<SceneKey, SlotName>
  scenes: Partial<SightySceneCatalog<SceneKey>>
  data: Readonly<Record<string, unknown>>
  sceneKeys: readonly SceneKey[]
  getSlotNames: (sceneKey: SceneKey) => readonly SlotName[]
  getScene: (sceneKey: SceneKey) => SightySceneCatalog<SceneKey>[SceneKey] | undefined
  resolveScene: (sceneKey: SceneKey) => Promise<SightySceneCatalog<SceneKey>[SceneKey] | undefined>
  getData: (dataKey: string) => unknown
  getView: (sceneKey: SceneKey) => SightyView<SceneKey, SlotName> | undefined
  getViewGraph: () => SightyViewGraph<SceneKey, SlotName>
  validate: () => readonly SightyAuthoringDiagnostic[]
}>
