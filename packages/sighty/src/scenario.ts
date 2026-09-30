import type { CodPlayEventime } from 'codplay'
import { validateAuthoringResources } from './authoring-validation'
import {
  findGraphViewByPath,
  getDirectGraphEntries,
  getGraphEntries,
} from './view-graph'
import { isAuthoredViewMap } from './navigation/graph-entries'
import type {
  SightyAuthoringDiagnostic,
  SightyScenarioApi,
  SightyScenarioMutation,
  SightyScenarioDefinition,
  SightySceneCatalog,
  SightyGraphView,
  SightyViewMap,
  SightyViewListEntry,
  SightyViewReference,
  SightyView,
  SightyViewGraph,
} from './types'

/** Result retained internally so a runtime can restore a failed mutation. */
export type SightyScenarioMutationResult<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  previousScenario: SightyScenarioDefinition<SceneKey, SlotName>
}>

/** Runtime-only extension used to publish validated scenario versions atomically. */
export type SightyMutableScenarioApi<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyScenarioApi<SceneKey, SlotName> & Readonly<{
  applyMutation: (
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
  ) => SightyScenarioMutationResult<SceneKey, SlotName>
  restoreMutation: (result: SightyScenarioMutationResult<SceneKey, SlotName>) => void
}>

/** Owns and exposes the authored scenario grouped by the Sighty facade. */
export class SightyScenarioImpl<
  SceneKey extends string = string,
  SlotName extends string = string,
> implements SightyScenarioApi<SceneKey, SlotName> {
  private currentScenario: SightyScenarioDefinition<SceneKey, SlotName>
  private readonly resolvedScenes = new Map<SceneKey, SightySceneCatalog<SceneKey>[SceneKey]>()
  private readonly resolvingScenes = new Map<SceneKey, Promise<SightySceneCatalog<SceneKey>[SceneKey] | undefined>>()

  /** Creates one scenario surface without rendering or running its scenes. */
  constructor(scenario: SightyScenarioDefinition<SceneKey, SlotName>) {
    this.currentScenario = scenario
  }

  /** Returns the authored identity of the current scenario. */
  get id(): string | undefined {
    return this.currentScenario.id
  }

  /** Returns the current scenario revision. */
  get version(): number | undefined {
    return this.currentScenario.version
  }

  /** Returns the current authored view graph. */
  get views(): SightyViewGraph<SceneKey, SlotName> {
    return this.currentScenario.views
  }

  /** Returns the authored default occurrence policy. */
  get showMode() {
    return this.currentScenario.showMode
  }

  /** Returns the catalog of scene definitions. */
  get scenes(): Partial<SightySceneCatalog<SceneKey>> {
    return this.currentScenario.scenes ?? {}
  }

  /** Returns action implementations named by the scenario's view declarations. */
  get actions() {
    return this.currentScenario.actions ?? {}
  }

  /** Returns guard implementations named by the scenario's view declarations. */
  get guards() {
    return this.currentScenario.guards ?? {}
  }

  /** Returns the scenario data or an empty catalog when none was supplied. */
  get data(): Readonly<Record<string, unknown>> {
    return this.currentScenario.data ?? {}
  }

  /** Returns the scene keys made available to the scenario. */
  get sceneKeys(): readonly SceneKey[] {
    const keys = new Set<string>([
      ...Object.keys(this.scenes),
      ...Object.keys(this.currentScenario.sceneSources ?? {}),
    ])
    return [...keys] as SceneKey[]
  }

  /** Returns the slot names declared by the view rooted at one scene. */
  getSlotNames(sceneKey: SceneKey): readonly SlotName[] {
    const view = this.getView(sceneKey)
    return view === undefined ? [] : Object.keys(view.view.slots ?? {}) as SlotName[]
  }

  /** Returns one scene definition by its authored key. */
  getScene(sceneKey: SceneKey): SightySceneCatalog<SceneKey>[SceneKey] | undefined {
    return this.scenes[sceneKey]
  }

  /** Resolves one direct or deferred scene source once and caches its document. */
  resolveScene(sceneKey: SceneKey): Promise<SightySceneCatalog<SceneKey>[SceneKey] | undefined> {
    const direct = this.getScene(sceneKey)
    if (direct !== undefined) return Promise.resolve(direct)
    const cached = this.resolvedScenes.get(sceneKey)
    if (cached !== undefined) return Promise.resolve(cached)
    const source = this.currentScenario.sceneSources?.[sceneKey]
    if (source === undefined) return Promise.resolve(undefined)
    const pending = this.resolvingScenes.get(sceneKey)
    if (pending !== undefined) return pending

    const promise: Promise<SightySceneCatalog<SceneKey>[SceneKey] | undefined> = Promise.resolve(
      (typeof source === 'function' ? source() : source) as SightySceneCatalog<SceneKey>[SceneKey],
    )
      .then((scene) => {
        if (scene === undefined) return undefined
        this.resolvedScenes.set(sceneKey, scene)
        return scene
      })
      .finally(() => {
        this.resolvingScenes.delete(sceneKey)
      })
    this.resolvingScenes.set(sceneKey, promise)
    return promise
  }

  /** Returns one named value from the scenario data catalog. */
  getData(dataKey: string): unknown {
    return this.data[dataKey]
  }

  /** Returns the first authored view rooted at one scene key. */
  getView(sceneKey: SceneKey): SightyView<SceneKey, SlotName> | undefined {
    return getGraphEntries(this.views)
      .find((entry) => entry.view.view.scene === sceneKey)?.view
  }

  /** Validates scenario references without compiling, rendering or running scenes. */
  validate(): readonly SightyAuthoringDiagnostic[] {
    return validateAuthoringResources(this.currentScenario)
  }

  /** Applies one integration mutation only after validating its complete result. */
  applyMutation(
    mutation: SightyScenarioMutation<SceneKey, SlotName>,
  ): SightyScenarioMutationResult<SceneKey, SlotName> {
    const previousScenario = this.currentScenario
    const nextViewGraph = applyViewMutation(previousScenario.views, mutation)
    const nextScenario: SightyScenarioDefinition<SceneKey, SlotName> = {
      ...previousScenario,
      version: (previousScenario.version ?? 1) + 1,
      views: nextViewGraph,
    }
    const diagnostics = validateAuthoringResources(nextScenario)
    if (diagnostics.length > 0) {
      throw new Error(`La mutation Sighty est invalide. ${diagnostics.map((diagnostic) => diagnostic.message).join(' ')}`)
    }
    this.currentScenario = nextScenario
    return { previousScenario }
  }

  /** Restores a scenario version when its runtime reconfiguration cannot commit. */
  restoreMutation(result: SightyScenarioMutationResult<SceneKey, SlotName>): void {
    this.currentScenario = result.previousScenario
  }
}

/** Applies one author-facing mutation to a structural copy of the view graph. */
function applyViewMutation<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  mutation: SightyScenarioMutation<SceneKey, SlotName>,
): SightyViewGraph<SceneKey, SlotName> {
  const next = cloneGraph(graph)
  if (mutation.kind === 'add-view') {
    const parent = resolveMutationEntry(next, mutation.parent)
    if (parent === undefined) throw new Error('La vue parent de la mutation Sighty est introuvable ou ambiguë.')
    const childGraph = mutation.slot === undefined
      ? parent.view.view.views
      : parent.view.view.slots?.[mutation.slot]
    const addedView = { id: mutation.id, ...cloneView(mutation.view) }
    if (childGraph === undefined) {
      const created = [addedView] as unknown as SightyViewGraph<SceneKey, SlotName>
      replaceEntryViewGraph(next, parent.path, created, mutation.slot)
    } else if (isAuthoredViewMap(childGraph)) {
      if (childGraph.views[mutation.id] !== undefined) {
        throw new Error(`La vue Sighty « ${mutation.id} » existe déjà dans son graphe.`)
      }
      const updated = {
        ...childGraph,
        views: { ...childGraph.views, [mutation.id]: cloneView(mutation.view) },
      }
      replaceEntryViewGraph(next, parent.path, updated, mutation.slot)
    } else {
      if (childGraph.some((entry) => entry.id === mutation.id)) {
        throw new Error(`La vue Sighty « ${mutation.id} » existe déjà dans sa liste.`)
      }
      replaceEntryViewGraph(
        next,
        parent.path,
        [
          ...(childGraph as readonly SightyViewListEntry<SceneKey, SlotName>[]),
          addedView as SightyViewListEntry<SceneKey, SlotName>,
        ] as unknown as SightyViewGraph<SceneKey, SlotName>,
        mutation.slot,
      )
    }
    return next
  }

  const target = resolveMutationEntry(next, mutation.target)
  if (target === undefined) throw new Error('La vue ciblée par la mutation Sighty est introuvable ou ambiguë.')
  if (mutation.kind === 'remove-view') {
    removeEntry(next, target.path)
    return next
  }
  if (mutation.kind === 'hide-view' || mutation.kind === 'show-view') {
    replaceEntry(next, target.path, { ...target.view, hidden: mutation.kind === 'hide-view' })
    return next
  }
  if (mutation.kind === 'update-view') {
    replaceEntry(next, target.path, {
      ...target.view,
      ...mutation.patch,
      ...(mutation.patch.entry === undefined ? {} : { entry: cloneEntry(mutation.patch.entry) }),
    })
  }
  return next
}

/** Resolves a mutation reference without exposing an internal address publicly. */
function resolveMutationEntry<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  reference: SightyViewReference,
): { path: string; view: SightyGraphView<SceneKey, SlotName> } | undefined {
  if ('path' in reference) return findGraphViewByPath(graph, reference.path)
  const matches = getGraphEntries(graph).filter((entry) => entry.key === reference.label)
  return matches.length === 1 ? matches[0] : undefined
}

/** Clones graph containers while retaining executable author functions by reference. */
function cloneGraph<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
): SightyViewGraph<SceneKey, SlotName> {
  if (Array.isArray(graph)) {
    return graph.map((view) => cloneView(view)) as unknown as SightyViewGraph<SceneKey, SlotName>
  }
  return {
    ...graph,
    views: Object.fromEntries(
      Object.entries((graph as SightyViewMap<SceneKey, SlotName>).views)
        .map(([key, view]) => [key, cloneView(view as SightyGraphView<SceneKey, SlotName>)]),
    ),
  } as SightyViewGraph<SceneKey, SlotName>
}

/** Clones one view and all child graph containers without executing it. */
function cloneView<SceneKey extends string, SlotName extends string>(
  view: SightyGraphView<SceneKey, SlotName>,
): SightyGraphView<SceneKey, SlotName> {
  return {
    ...view,
    ...(view.entry === undefined ? {} : { entry: cloneEntry(view.entry) }),
    ...(view.actions === undefined ? {} : { actions: { ...view.actions } }),
    ...(view.data === undefined ? {} : { data: { ...view.data } }),
    ...(view.coupling === undefined ? {} : {
      coupling: {
        ...view.coupling,
        commands: Object.fromEntries(
          Object.entries(view.coupling.commands).map(([eventName, command]) => [
            eventName,
            Array.isArray(command) ? [...command] : command,
          ]),
        ),
      },
    }),
    view: {
      ...view.view,
      ...(view.view.views === undefined ? {} : { views: cloneGraph(view.view.views) }),
      ...(view.view.slots === undefined ? {} : {
        slots: Object.fromEntries(
          Object.entries(view.view.slots)
            .map(([slot, child]) => [slot, cloneGraph(child as SightyViewGraph<SceneKey, SlotName>)]),
        ),
      }),
    },
  } as unknown as SightyGraphView<SceneKey, SlotName>
}

/** Copies entry declarations so mutations cannot share their event lists. */
function cloneEntry(
  entry: CodPlayEventime | readonly CodPlayEventime[],
): CodPlayEventime | readonly CodPlayEventime[] {
  if (Array.isArray(entry)) return entry.map(cloneEventime)
  return cloneEventime(entry as CodPlayEventime)
}

/** Copies one eventime and its nested declarations for a scenario snapshot. */
function cloneEventime(eventime: CodPlayEventime): CodPlayEventime {
  return {
    ...eventime,
    ...(eventime.data === undefined ? {} : { data: { ...eventime.data } }),
    ...(eventime.events === undefined ? {} : { events: eventime.events.map(cloneEventime) }),
  }
}

/** Replaces a view's direct child graph in a cloned graph tree. */
function replaceEntryViewGraph<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
  childGraph: SightyViewGraph<SceneKey, SlotName>,
  slot: SlotName | undefined,
): void {
  const target = findGraphViewByPath(graph, path)
  if (target === undefined) throw new Error(`La vue parent Sighty « ${path} » est introuvable.`)
  const nextView = slot === undefined
    ? { ...target.view, view: { ...target.view.view, views: childGraph } }
    : {
        ...target.view,
        view: {
          ...target.view.view,
          slots: { ...(target.view.view.slots ?? {}), [slot]: childGraph },
        },
      }
  replaceEntry(graph, path, nextView as unknown as SightyGraphView<SceneKey, SlotName>)
}

type MutationEntryLocation<SceneKey extends string, SlotName extends string> = Readonly<{
  graph: SightyViewGraph<SceneKey, SlotName>
  key: string
  view: SightyGraphView<SceneKey, SlotName>
}>

/** Locates one mutable entry by walking the declared slot and child graph boundaries. */
function locateMutationEntry<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
): MutationEntryLocation<SceneKey, SlotName> | undefined {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return undefined
  const key = segments.shift()!
  const direct = getDirectGraphEntries(graph).find((entry) => entry.key === key)
  if (direct === undefined) return undefined
  if (segments.length === 0) return { graph, key, view: direct.view }

  const childPath = segments.join('/')
  for (const [slotName, child] of Object.entries(direct.view.view.slots ?? {}) as [SlotName, SightyViewGraph<SceneKey, SlotName>][]) {
    if (childPath === slotName || childPath.startsWith(`${slotName}/`)) {
      return locateMutationEntry(child, childPath.slice(slotName.length + 1))
    }
  }
  if (direct.view.view.views !== undefined) {
    return locateMutationEntry(direct.view.view.views, childPath)
  }
  return undefined
}

/** Replaces one view in a mutable structural clone at its stable graph path. */
function replaceEntry<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
  replacement: SightyGraphView<SceneKey, SlotName>,
): void {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) throw new Error('Une mutation ne peut pas remplacer la racine du graphe Sighty.')
  const location = locateMutationEntry(graph, path)
  if (location === undefined) throw new Error(`La vue Sighty « ${path} » est introuvable.`)
  if (Array.isArray(location.graph)) {
    const index = location.graph.findIndex((entry) => entry.id === location.key)
    if (index >= 0) {
      const current = location.graph[index]
      ;(location.graph as SightyGraphView<SceneKey, SlotName>[])[index] = {
        ...replacement,
        id: current.id,
      } as SightyGraphView<SceneKey, SlotName>
    }
    return
  }
  ;(location.graph as { views: Record<string, SightyGraphView<SceneKey, SlotName>> }).views[location.key] = replacement
}

/** Removes one view from a cloned graph and leaves its parent graph valid. */
function removeEntry<SceneKey extends string, SlotName extends string>(
  graph: SightyViewGraph<SceneKey, SlotName>,
  path: string,
): void {
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) throw new Error('Une mutation ne peut pas supprimer la racine du graphe Sighty.')
  const location = locateMutationEntry(graph, path)
  if (location === undefined) throw new Error(`La vue Sighty « ${path} » est introuvable.`)
  if (Array.isArray(location.graph)) {
    const index = location.graph.findIndex((entry) => entry.id === location.key)
    if (index >= 0) (location.graph as SightyGraphView<SceneKey, SlotName>[]).splice(index, 1)
    return
  }
  const map = location.graph as { start: string; views: Record<string, SightyGraphView<SceneKey, SlotName>> }
  if (map.start === location.key) throw new Error(`La vue de départ Sighty « ${location.key} » ne peut pas être supprimée.`)
  delete map.views[location.key]
}
