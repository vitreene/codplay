import {
  CodPlay,
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type CodPlayInstanceHostTarget,
  type CodPlayInstanceMountHandle,
  type RuntimePreloadMode,
} from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { createViewIndex } from '../navigation/graph-index'
import type { ActiveComposition, IndexedEntry, ViewIndex } from '../navigation/types'
import { createSightyPublicEventChannel, type SightyPublicEvent, type SightyPublicEvents } from '../public-events'
import type { SightyMutableScenarioApi } from '../scenario'
import type { SightyActionCatalog, SightyConditionCatalog, SightyRuntimeLayout, SightyRuntimeOptions, SightyRuntimeSlotChangeListener, SightyRuntimeStyle } from './types'
import type { SightyShowMode } from '../types'
import { collectSceneKeys } from './helpers'

/** Keeps the mutable execution state shared by the focused runtime services. */
export type SightyRuntimeState<SceneKey extends string, SlotName extends string> = {
  readonly scenario: SightyRuntimeOptions<SceneKey, SlotName>['scenario']
  readonly mutableScenario: SightyMutableScenarioApi<SceneKey, SlotName>
  readonly root: HTMLElement
  readonly instanceIds: Readonly<Record<SceneKey, string>>
  readonly layout: SightyRuntimeLayout<SceneKey>
  readonly actionCatalog: SightyActionCatalog<SceneKey>
  readonly conditionCatalog: SightyConditionCatalog<SceneKey>
  readonly initialContext: Readonly<Record<string, unknown>>
  readonly showMode: SightyShowMode | undefined
  readonly preloadMode: RuntimePreloadMode
  readonly styles: readonly SightyRuntimeStyle[]
  readonly onTrace: SightyRuntimeOptions<SceneKey, SlotName>['onTrace']
  readonly onPreloadWarning: SightyRuntimeOptions<SceneKey, SlotName>['onPreloadWarning']
  readonly owner: CodPlay
  readonly publicEventChannel: RuntimeEventChannel<SceneKey>
  /** Keeps one CodPlay occurrence per logical slot/scene pair. */
  readonly instances: Map<string, CodPlayInstance>
  /** Associates each internal occurrence key with its authored scene key. */
  readonly instanceSceneKeys: Map<string, SceneKey>
  readonly mounts: Map<string, CodPlayInstanceMountHandle>
  readonly mountTargets: Map<string, CodPlayInstanceHostTarget>
  readonly activeBindings: Map<string, import('./types').RuntimeBinding<SceneKey>>
  readonly bindingCleanups: Map<string, () => void>
  readonly slotChangeListeners: Map<SlotName, Set<SightyRuntimeSlotChangeListener<SceneKey>>>
  readonly cleanups: Array<() => void>
  readonly generationCounters: Map<string, number>
  readonly compiledBuilds: Map<SceneKey, CodPlayCompileSuccess>
  readonly sceneDocuments: Map<SceneKey, SceneDoc<string>>
  readonly resourceUrlsByScene: Map<SceneKey, readonly string[]>
  readonly deliveredData: Map<string, Readonly<Record<string, unknown>>>
  viewIndex: ViewIndex<SceneKey, SlotName>
  authoredSceneKeys: readonly SceneKey[]
  layoutEntry: IndexedEntry<SceneKey, SlotName> | undefined
  initialAnchor: IndexedEntry<SceneKey, SlotName> | undefined
  composition: ActiveComposition<SceneKey, SlotName>
  context: Readonly<Record<string, unknown>>
  resourceUrls: readonly string[]
  layoutGeneration: number
  initialized: boolean
  transitioning: boolean
  destroyed: boolean
}

/** Describes the private publication channel retained by the runtime state. */
export type RuntimeEventChannel<SceneKey extends string> = Readonly<{
  api: SightyPublicEvents<SceneKey>
  publish: (event: SightyPublicEvent<SceneKey>) => readonly unknown[]
  clear: () => void
}>

/** Creates the state container shared by runtime lifecycle services. */
export function createRuntimeState<SceneKey extends string, SlotName extends string>(
  options: SightyRuntimeOptions<SceneKey, SlotName>,
): SightyRuntimeState<SceneKey, SlotName> {
  const viewIndex = createViewIndex(options.scenario.getViewGraph())
  const layoutEntry = viewIndex.entriesByScene.get(options.layout.sceneKey)?.[0]
  const publicEventChannel = createSightyPublicEventChannel<SceneKey>()
  return {
    scenario: options.scenario,
    mutableScenario: options.scenario as SightyMutableScenarioApi<SceneKey, SlotName>,
    root: options.root,
    instanceIds: options.instanceIds,
    layout: options.layout,
    actionCatalog: options.actionCatalog ?? {},
    conditionCatalog: options.conditionCatalog ?? {},
    initialContext: { ...(options.context ?? {}) },
    showMode: options.showMode,
    preloadMode: options.preloadMode ?? 'author',
    styles: options.styles ?? [],
    onTrace: options.onTrace,
    onPreloadWarning: options.onPreloadWarning,
    owner: new CodPlay(options.codplay),
    publicEventChannel,
    instances: new Map(),
    instanceSceneKeys: new Map(),
    mounts: new Map(),
    mountTargets: new Map(),
    activeBindings: new Map(),
    bindingCleanups: new Map(),
    slotChangeListeners: new Map(),
    cleanups: [],
    generationCounters: new Map(),
    compiledBuilds: new Map(),
    sceneDocuments: new Map(),
    resourceUrlsByScene: new Map(),
    deliveredData: new Map(),
    viewIndex,
    authoredSceneKeys: collectSceneKeys(viewIndex),
    layoutEntry,
    initialAnchor: undefined,
    composition: {
      revision: 0,
      layoutPath: layoutEntry?.path ?? '',
      selections: new Map(),
    },
    context: { ...(options.context ?? {}) },
    resourceUrls: [],
    layoutGeneration: 0,
    initialized: false,
    transitioning: false,
    destroyed: false,
  }
}
