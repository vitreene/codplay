import { validateAuthoringResources } from './authoring-validation'
import { findGraphViewByScene, normalizeSightyViewGraph } from './view-graph'
import type {
  SightyAuthoringDiagnostic,
  SightyScenarioApi,
  SightyScenarioResources,
  SightySceneCatalog,
  SightyFile,
  SightyView,
  SightyViewGraph,
} from './types'

/** Owns and exposes the scenario resources grouped by the Sighty facade. */
export class SightyScenarioImpl<
  SceneKey extends string = string,
  SlotName extends string = string,
> implements SightyScenarioApi<SceneKey, SlotName> {
  private readonly resources: SightyScenarioResources<SceneKey, SlotName>
  private readonly viewGraph: SightyViewGraph<SceneKey, SlotName>

  /** Creates one scenario surface without rendering or running its scenes. */
  constructor(resources: SightyScenarioResources<SceneKey, SlotName>) {
    this.resources = resources
    this.viewGraph = normalizeSightyViewGraph<SceneKey, SlotName>(resources.file.views, resources.file.version)
  }

  /** Returns the serializable Sighty scenario file. */
  get file(): SightyFile<SceneKey, SlotName> {
    return this.resources.file
  }

  /** Returns the catalog of scene definitions. */
  get scenes(): SightySceneCatalog<SceneKey> {
    return this.resources.scenes
  }

  /** Returns the scenario data or an empty catalog when none was supplied. */
  get data(): Readonly<Record<string, unknown>> {
    return this.resources.data ?? this.file.resources?.data ?? {}
  }

  /** Returns the scene keys made available to the scenario. */
  get sceneKeys(): readonly SceneKey[] {
    return Object.keys(this.file.resources?.scenes ?? this.scenes) as SceneKey[]
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

  /** Returns one named value from the scenario data catalog. */
  getData(dataKey: string): unknown {
    return this.data[dataKey]
  }

  /** Returns the first authored view rooted at one scene key. */
  getView(sceneKey: SceneKey): SightyView<SceneKey, SlotName> | undefined {
    return findGraphViewByScene(this.viewGraph, sceneKey)?.view
  }

  /** Returns the normalized recursive view graph used by the runtime. */
  getViewGraph(): SightyViewGraph<SceneKey, SlotName> {
    return this.viewGraph
  }

  /** Validates scenario references without compiling, rendering or running scenes. */
  validate(): readonly SightyAuthoringDiagnostic[] {
    return validateAuthoringResources(this.resources)
  }
}
