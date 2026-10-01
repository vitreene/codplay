import type { CodPlayEventime, CodPlayEventimeTarget, CodPlayPublicEvent } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'

/** Identifies a scene resource in an authored Sighty scenario. */
export type SightySceneKey = string

/** Names one registered scenario action as action:domain:verb. */
export type SightyActionKey = `action:${string}:${string}`

/** Names one registered scenario guard as guard:domain:predicate. */
export type SightyGuardKey = `guard:${string}:${string}`

/** Identifies a slot declared by an authored layout scene. */
export type SightySlotName = string

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

/** Defines one author condition; functions are allowed in the scenario. */
export type SightyConditionFunction<SceneKey extends string = string> = (
  context: SightyConditionContext<SceneKey>,
) => boolean | Promise<boolean>

/** Describes one event received by the Sighty scenario router. */
export type SightyRuntimeEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
  data?: CodPlayPublicEvent['data']
}>

/** Describes one selected view exposed to a scenario action. */
export type SightyScenarioSelection<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  slotName: SlotName
  view: SightyViewReference
  sceneKey: SceneKey
}>

/** Reads the navigation pointer and selections, then evaluates scenario guards. */
export type SightyScenarioStateApi<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  /** View followed by the scenario's next/previous pointer. */
  active: SightyScenarioSelection<SceneKey, SlotName> | undefined
  /** Every currently selected view, including persistent and parallel slots. */
  current: readonly SightyScenarioSelection<SceneKey, SlotName>[]
  context: Readonly<Record<string, unknown>>
  canAccess: (reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
  canExit: (reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
}>

/** Provides the active event, view data and scenario operations to one action. */
export type SightyActionContext<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  event: SightyRuntimeEvent<SceneKey>
  data: Readonly<Record<string, unknown>>
  context: Readonly<Record<string, unknown>>
  state: Readonly<Record<string, unknown>>
  scenarioState: SightyScenarioStateApi<SceneKey, SlotName>
  updateContext: (patch: Readonly<Record<string, unknown>>) => Promise<void>
  send: (
    sceneKey: SceneKey,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
  ) => Promise<void>
}>

/** Defines one executable scenario action. */
export type SightyActionHandler<SceneKey extends string = string, SlotName extends string = string> = (
  context: SightyActionContext<SceneKey, SlotName>,
) => void | Promise<void>

/** Names scenario actions that view declarations may reference. */
export type SightyActions<SceneKey extends string = string, SlotName extends string = string> = Readonly<
  Record<SightyActionKey, SightyActionHandler<SceneKey, SlotName>>
>

/** Names scenario guards that access and exit declarations may reference. */
export type SightyGuards<SceneKey extends string = string> = Readonly<
  Record<SightyGuardKey, SightyConditionFunction<SceneKey>>
>

/** References a namespaced guard or embeds its author function inline. */
export type SightyCondition<SceneKey extends string = string> =
  | SightyGuardKey
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

/** Describes one action attached to a view or graph scope, by key or inline. */
export type SightyViewAction<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  action?: SightyActionKey | SightyActionHandler<SceneKey, SlotName>
  go?: SightyRouteTarget
  /** Resets Sighty context or asks existing scenes to handle selected reset keys. */
  reset?: readonly string[]
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
export type SightyViewScope<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  /** Default named or inline handler inherited by event actions that do not declare one. */
  action?: SightyActionKey | SightyActionHandler<SceneKey, SlotName>
  actions?: Readonly<Record<string, SightyViewAction<SceneKey, SlotName>>>
  data?: Readonly<Record<string, unknown>>
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
}>

/** Describes one node in the recursive authored view graph. */
export type SightyGraphView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyViewScope<SceneKey, SlotName> & Readonly<{
  /** Events passed to this view's scene whenever the view is admitted. */
  entry?: CodPlayEventime | readonly CodPlayEventime[]
  view: SightyViewContent<SceneKey, SlotName>
  /** Mediates public controller events to the telco of another declared slot. */
  coupling?: SightyCouplingDescriptor<SlotName>
  /** Keeps a declaration in the scenario while excluding it from navigation. */
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
> = SightyViewScope<SceneKey, SlotName> & Readonly<{
  start: string
  views: Readonly<Record<string, SightyGraphView<SceneKey, SlotName>>>
}>

/** Describes one recursive list or map of authored view nodes. */
export type SightyViewGraph<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyViewList<SceneKey, SlotName> | SightyViewMap<SceneKey, SlotName>

/** Names one normalized graph node returned by the scenario surface. */
export type SightyView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyGraphView<SceneKey, SlotName>

/** Converts selected replay reset keys into one event handled by a scene. */
export type SightySceneResetHandler = (keys: readonly string[]) => CodPlayEventime | undefined

/** Holds a scene document and its optional stylesheet and reset handler. */
export type SightySceneSourceValue = SceneDoc<string> | Readonly<{
  sceneDoc: SceneDoc<string>
  styleSheet?: string
  onReset?: SightySceneResetHandler
}>

/** Catalogs scene documents with optional stylesheet and reset handlers. */
export type SightySceneCatalog<SceneKey extends string = string> = Readonly<
  Record<SceneKey, SightySceneSourceValue>
>

/** Supplies one scene immediately or creates it only when selected. */
export type SightySceneSource =
  | SightySceneSourceValue
  | (() => SightySceneSourceValue | Promise<SightySceneSourceValue>)

/** Defines the single authored scenario, including its views, registries and scenes. */
export type SightyScenarioDefinition<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  format?: 'sighty'
  version?: number
  id?: string
  views: SightyViewGraph<SceneKey, SlotName>
  showMode?: SightyShowMode
  scenes?: Partial<SightySceneCatalog<SceneKey>>
  sceneSources?: Partial<Readonly<Record<SceneKey, SightySceneSource>>>
  data?: Readonly<Record<string, unknown>>
  actions?: SightyActions<SceneKey, SlotName>
  guards?: SightyGuards<SceneKey>
}>

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
    | 'AUTHOR_VIEW_SCENE_UNKNOWN'
    | 'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN'
    | 'AUTHOR_VIEW_GRAPH_START_UNKNOWN'
    | 'AUTHOR_VIEW_LIST_ID_MISSING'
    | 'AUTHOR_VIEW_LIST_ID_DUPLICATE'
    | 'AUTHOR_VIEW_ROUTE_UNKNOWN'
    | 'AUTHOR_VIEW_ROUTE_AMBIGUOUS'
    | 'AUTHOR_ACTION_KEY_INVALID'
    | 'AUTHOR_GUARD_KEY_INVALID'
    | 'AUTHOR_ACTION_REFERENCE_INVALID'
    | 'AUTHOR_GUARD_REFERENCE_INVALID'
    | 'AUTHOR_COUPLING_ID_MISSING'
    | 'AUTHOR_COUPLING_CONTROLLER_SLOT_UNKNOWN'
    | 'AUTHOR_COUPLING_CONTROLLED_SLOT_UNKNOWN'
    | 'AUTHOR_COUPLING_COMMAND_UNKNOWN'
    | 'AUTHOR_ENTRY_EVENTS_EMPTY'
    | 'AUTHOR_ENTRY_EVENT_NAME_MISSING'
    | 'AUTHOR_SHOW_MODE_UNKNOWN'
    | 'AUTHOR_ACTION_RESET_INVALID'
    | 'AUTHOR_ACTION_RESET_EMPTY'
    | 'AUTHOR_ACTION_RESET_ALL_MIXED'
  path: string
  message: string
}>

/** Public scenario surface grouped under the Sighty facade. */
export type SightyScenarioApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  readonly id: string | undefined
  readonly version: number | undefined
  readonly views: SightyViewGraph<SceneKey, SlotName>
  readonly showMode: SightyShowMode | undefined
  scenes: Partial<SightySceneCatalog<SceneKey>>
  data: Readonly<Record<string, unknown>>
  actions: SightyActions<SceneKey, SlotName>
  guards: SightyGuards<SceneKey>
  sceneKeys: readonly SceneKey[]
  getSlotNames: (sceneKey: SceneKey) => readonly SlotName[]
  getScene: (sceneKey: SceneKey) => SightySceneCatalog<SceneKey>[SceneKey] | undefined
  resolveScene: (sceneKey: SceneKey) => Promise<SightySceneCatalog<SceneKey>[SceneKey] | undefined>
  getData: (dataKey: string) => unknown
  getView: (sceneKey: SceneKey) => SightyView<SceneKey, SlotName> | undefined
  validate: () => readonly SightyAuthoringDiagnostic[]
}>
