import type {
  CodPlayCompileSuccess,
  CodPlayInstance,
  CodPlayInstanceHostTarget,
  CodPlayInstanceMountReplace,
  CodPlayOptions,
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
  SightyMutationReloadPolicy,
  SightyScenarioMutation,
  SightyScenarioApi,
  SightyRuntimeEvent,
  SightyScenarioStateApi,
} from '../types'

/** Describes one stylesheet that the runtime must install before materialization. */
export type SightyRuntimeStyle = Readonly<{
  slot: string
  cssText: string
}>

/** Receives the scene key selected in one authored layout slot. */
export type SightyRuntimeSlotChangeListener<SceneKey extends string = string> = (
  sceneKey: SceneKey | undefined,
) => void

/** Configures the generic CodPlay execution grouped under one Sighty facade. */
export type SightyRuntimeConfiguration<SceneKey extends string = string> = Readonly<{
  root: HTMLElement
  instanceIds: Readonly<Record<SceneKey, string>>
  context?: Readonly<Record<string, unknown>>
  preloadMode?: RuntimePreloadMode
  styles?: readonly SightyRuntimeStyle[]
  codplay?: CodPlayOptions
  onTrace?: (sceneKey: SceneKey, event: CodPlayTraceEvent) => void
}>

/** Exposes runtime operations through the Sighty facade. */
export type SightyRuntimeApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  sceneKeys: readonly SceneKey[]
  slotNames: readonly SlotName[]
  events: SightyPublicEvents<SceneKey>
  scenarioState: SightyScenarioStateApi<SceneKey, SlotName>
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
  sceneStyleSheets: ReadonlyMap<SceneKey, string>
  resourceUrlsByScene: ReadonlyMap<SceneKey, readonly string[]>
  resourceUrls: readonly string[]
  instances: ReadonlyMap<string, CodPlayInstance>
  instanceSceneKeys: ReadonlyMap<string, SceneKey>
  presentation: readonly PresentationRelation<SceneKey, SlotName>[]
  playback: ReadonlyMap<string, MountedState>
}>

/** Describes one validated physical CodPlay mount request. */
export type ResolvedMount = Readonly<{
  host: CodPlayInstanceHostTarget
  childInstanceId: string
  replace?: CodPlayInstanceMountReplace
}>

/** Captures one physical relation independently from its live detach handle. */
export type PresentationRelation<
  SceneKey extends string,
  SlotName extends string,
> = Readonly<{
  selection: ActiveSelection<SceneKey, SlotName>
  mount: ResolvedMount
}>
