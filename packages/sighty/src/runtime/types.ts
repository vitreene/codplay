import type {
  CodPlayCompileSuccess,
  CodPlayEventime,
  CodPlayEventimeTarget,
  CodPlayInstance,
  CodPlayInstanceHostTarget,
  CodPlayInstanceMountReplace,
  CodPlayOptions,
  CodPlayPublicEvent,
  CodPlayTraceEvent,
  RuntimePreloadMode,
} from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type { SightyPublicEvents } from '../public-events'
import type {
  ActiveComposition,
  ActiveSelection,
  IndexedEntry,
  ViewIndex,
} from '../navigation/types'
import type {
  SightyConditionFunction,
  SightyMutationReloadPolicy,
  SightyScenarioMutation,
  SightyScenarioApi,
  SightyShowMode,
} from '../types'

/** Identifies the authored layout used as the host of one runtime composition. */
export type SightyRuntimeLayout<SceneKey extends string = string> = Readonly<{
  sceneKey: SceneKey
  storyId: string
}>

/** Describes one stylesheet that the runtime must install before materialization. */
export type SightyRuntimeStyle = Readonly<{
  slot: string
  cssText: string
}>

/** Describes a non-fatal preload notification exposed to the application. */
export type SightyRuntimeWarning = Readonly<{
  code: string
  message: string
}>

/** Describes an event received by the Sighty scenario router. */
export type SightyRuntimeEvent<SceneKey extends string = string> = Readonly<{
  name: string
  sourceSceneKey?: SceneKey
  data?: CodPlayPublicEvent['data']
}>

/** Provides the event and the scene-message port to one external action. */
export type SightyActionContext<SceneKey extends string = string> = Readonly<{
  event: SightyRuntimeEvent<SceneKey>
  data: Readonly<Record<string, unknown>>
  context: Readonly<Record<string, unknown>>
  state: Readonly<Record<string, unknown>>
  updateContext: (patch: Readonly<Record<string, unknown>>) => Promise<void>
  send: (
    sceneKey: SceneKey,
    eventime: CodPlayEventime,
    target: CodPlayEventimeTarget,
  ) => Promise<void>
}>

/** Defines one executable action kept outside the declarative route graph. */
export type SightyActionHandler<SceneKey extends string = string> = (
  context: SightyActionContext<SceneKey>,
) => void | Promise<void>

/** Associates an authored action reference with its application-owned handler. */
export type SightyActionCatalog<SceneKey extends string = string> = Readonly<
  Record<string, SightyActionHandler<SceneKey>>
>

/** Associates an author condition reference with an application-owned function. */
export type SightyConditionCatalog<SceneKey extends string = string> = Readonly<
  Record<string, SightyConditionFunction<SceneKey>>
>

/** Receives the scene key selected in one authored layout slot. */
export type SightyRuntimeSlotChangeListener<SceneKey extends string = string> = (
  sceneKey: SceneKey | undefined,
) => void

/** Configures the generic CodPlay execution grouped under one Sighty facade. */
export type SightyRuntimeConfiguration<SceneKey extends string = string> = Readonly<{
  root: HTMLElement
  instanceIds: Readonly<Record<SceneKey, string>>
  layout: SightyRuntimeLayout<SceneKey>
  actionCatalog?: SightyActionCatalog<SceneKey>
  conditionCatalog?: SightyConditionCatalog<SceneKey>
  context?: Readonly<Record<string, unknown>>
  /** Overrides the built-in show policy for this runtime instance. */
  showMode?: SightyShowMode
  preloadMode?: RuntimePreloadMode
  styles?: readonly SightyRuntimeStyle[]
  codplay?: CodPlayOptions
  onTrace?: (sceneKey: SceneKey, event: CodPlayTraceEvent) => void
  onPreloadWarning?: (warning: SightyRuntimeWarning) => void
}>

/** Exposes runtime operations through the Sighty facade. */
export type SightyRuntimeApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  sceneKeys: readonly SceneKey[]
  slotNames: readonly SlotName[]
  events: SightyPublicEvents<SceneKey>
  getInstance: (sceneKey: SceneKey) => CodPlayInstance | undefined
  getInstanceAt: (slotAddress: string) => CodPlayInstance | undefined
  initialize: () => Promise<void>
  dispatch: (event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
  updateContext: (patch: Readonly<Record<string, unknown>>) => Promise<void>
  reset: () => Promise<void>
  mutate: (
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
    policy?: SightyMutationReloadPolicy,
  ) => Promise<boolean>
  mountSlot: (slotName: SlotName, childSceneKey?: SceneKey) => void
  detachSlot: (slotName: SlotName) => void
  isSlotMounted: (slotName: SlotName) => boolean
  getMountedSceneKey: (slotName: SlotName) => SceneKey | undefined
  onSlotChange: (
    slotName: SlotName,
    listener: SightyRuntimeSlotChangeListener<SceneKey>,
  ) => () => void
  play: (sceneKey: SceneKey) => Promise<void>
  playAll: (sceneKeys?: readonly SceneKey[]) => Promise<void>
  destroy: () => void
}>

/** Provides the scenario and integration options to the internal runtime. */
export type SightyRuntimeOptions<
  SceneKey extends string,
  SlotName extends string,
> = SightyRuntimeConfiguration<SceneKey> & Readonly<{
  scenario: SightyScenarioApi<SceneKey, SlotName>
}>

/** Groups compiled scenes by their stable author scene key. */
export type SightyRuntimeBuilds<SceneKey extends string> = ReadonlyMap<SceneKey, CodPlayCompileSuccess>

/** Identifies one active scene-to-Sighty event binding. */
export type RuntimeBinding<SceneKey extends string> = Readonly<{
  slotAddress: string
  occurrenceKey: string
  sceneKey: SceneKey
  generation: number
}>

/** Queues one public event together with its optional active binding. */
export type DispatchRequest<SceneKey extends string> = Readonly<{
  event: SightyRuntimeEvent<SceneKey>
  binding?: RuntimeBinding<SceneKey>
}>

/** Reports the logical changes committed by one composition synchronization. */
export type SynchronizationResult<SceneKey extends string, SlotName extends string> = Readonly<{
  entered: readonly ActiveSelection<SceneKey, SlotName>[]
  previous: ActiveComposition<SceneKey, SlotName>
  next: ActiveComposition<SceneKey, SlotName>
}>

/** Captures the playback state needed when a physical transition is reverted. */
export type MountedState = Readonly<{
  timelineMs: number
  rate: number
  wasPlaying: boolean
}>

/** Captures all authoring, execution and resource state for mutation rollback. */
export type RuntimeMutationSnapshot<
  SceneKey extends string,
  SlotName extends string,
> = Readonly<{
  viewIndex: ViewIndex<SceneKey, SlotName>
  authoredSceneKeys: readonly SceneKey[]
  layoutEntry: IndexedEntry<SceneKey, SlotName> | undefined
  initialAnchor: IndexedEntry<SceneKey, SlotName> | undefined
  composition: ActiveComposition<SceneKey, SlotName>
  context: Readonly<Record<string, unknown>>
  layoutGeneration: number
  generationCounters: ReadonlyMap<string, number>
  compiledBuilds: ReadonlyMap<SceneKey, CodPlayCompileSuccess>
  sceneDocuments: ReadonlyMap<SceneKey, SceneDoc<string>>
  resourceUrlsByScene: ReadonlyMap<SceneKey, readonly string[]>
  resourceUrls: readonly string[]
  deliveredData: ReadonlyMap<string, Readonly<Record<string, unknown>>>
  instances: ReadonlyMap<string, CodPlayInstance>
  instanceSceneKeys: ReadonlyMap<string, SceneKey>
  playback: ReadonlyMap<string, MountedState>
}>

/** Describes one validated physical CodPlay mount request. */
export type ResolvedMount = Readonly<{
  host: CodPlayInstanceHostTarget
  childInstanceId: string
  replace?: CodPlayInstanceMountReplace
}>
