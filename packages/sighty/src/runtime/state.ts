import {
  CodPlay,
  type CodPlayCompileSuccess,
  type CodPlayInstance,
  type RuntimePreloadMode,
} from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { createViewIndex, getStartEntry } from '../navigation/graph-index'
import type { ActiveComposition, IndexedEntry, ViewIndex } from '../navigation/types'
import { createSightyPublicEventChannel, type SightyPublicEvent, type SightyPublicEvents } from '../public-events'
import type { SightyMutableScenarioApi } from '../scenario'
import type { SightyRuntimeOptions, SightyRuntimeSlotChangeListener, SightyRuntimeStyle } from './types'
import { collectSceneKeys } from './helpers'

/** Keeps the mutable execution state shared by the focused runtime services. */
export type SightyRuntimeState<SceneKey extends string, SlotName extends string> = {
  readonly scenario: SightyMutableScenarioApi<SceneKey, SlotName>
  readonly root: HTMLElement
  readonly instanceIds: Readonly<Record<SceneKey, string>>
  readonly initialContext: Readonly<Record<string, unknown>>
  readonly preloadMode: RuntimePreloadMode
  readonly styles: readonly SightyRuntimeStyle[]
  readonly onTrace: SightyRuntimeOptions<SceneKey, SlotName>['onTrace']
  readonly owner: CodPlay
  readonly publicEventChannel: RuntimeEventChannel<SceneKey>
  /** Keeps one CodPlay occurrence per logical slot/scene pair. */
  readonly instances: Map<string, CodPlayInstance>
  /** Associates each internal occurrence key with its authored scene key. */
  readonly instanceSceneKeys: Map<string, SceneKey>
  readonly activeBindings: Map<string, import('./types').RuntimeBinding<SceneKey>>
  readonly bindingCleanups: Map<string, () => void>
  readonly slotChangeListeners: Map<SlotName, Set<SightyRuntimeSlotChangeListener<SceneKey>>>
  readonly cleanups: Array<() => void>
  readonly generationCounters: Map<string, number>
  readonly compiledBuilds: Map<SceneKey, CodPlayCompileSuccess>
  readonly sceneDocuments: Map<SceneKey, SceneDoc<string>>
  readonly sceneStyleSheets: Map<SceneKey, string>
  readonly resourceUrlsByScene: Map<SceneKey, readonly string[]>
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
  const viewIndex = createViewIndex(options.scenario.views)
  const layoutEntry = getStartEntry(viewIndex, '')
  const publicEventChannel = createSightyPublicEventChannel<SceneKey>()
  return {
    scenario: options.scenario as SightyMutableScenarioApi<SceneKey, SlotName>,
    root: options.root,
    instanceIds: options.instanceIds,
    initialContext: { ...(options.context ?? {}) },
    preloadMode: options.preloadMode ?? 'author',
    styles: options.styles ?? [],
    onTrace: options.onTrace,
    owner: new CodPlay(options.codplay),
    publicEventChannel,
    instances: new Map(),
    instanceSceneKeys: new Map(),
    activeBindings: new Map(),
    bindingCleanups: new Map(),
    slotChangeListeners: new Map(),
    cleanups: [],
    generationCounters: new Map(),
    compiledBuilds: new Map(),
    sceneDocuments: new Map(),
    sceneStyleSheets: new Map(),
    resourceUrlsByScene: new Map(),
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

/** Returns the scene owned by the scenario's starting view. */
export function getLayoutSceneKey<SceneKey extends string, SlotName extends string>(
  state: SightyRuntimeState<SceneKey, SlotName>,
): SceneKey {
  const sceneKey = state.layoutEntry?.view.view.scene
  if (sceneKey === undefined) {
    throw new Error('La vue de départ du scénario doit désigner la scène qui porte ses slots.')
  }
  return sceneKey
}
