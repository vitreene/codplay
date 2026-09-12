import { validateAuthoringResources } from './authoring-validation'
import type {
  SightyAuthoringDiagnostic,
  SightyScenarioApi,
  SightyScenarioResources,
  SightySceneCatalog,
  SightyView,
  SightyFile,
} from './types'

/** Owns and exposes the scenario resources grouped by the Sighty facade. */
export class SightyScenarioImpl<
  SceneKey extends string = string,
  SlotName extends string = string,
> implements SightyScenarioApi<SceneKey, SlotName> {
  private readonly resources: SightyScenarioResources<SceneKey, SlotName>

  /** Creates one scenario surface without rendering or running its scenes. */
  constructor(resources: SightyScenarioResources<SceneKey, SlotName>) {
    this.resources = resources
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
    return this.resources.data ?? {}
  }

  /** Returns the scene keys declared by the scenario file. */
  get sceneKeys(): readonly SceneKey[] {
    return Object.keys(this.file.resources.scenes) as SceneKey[]
  }

  /** Returns the slot names declared by the view rooted at one scene. */
  getSlotNames(sceneKey: SceneKey): readonly SlotName[] {
    const view = this.getView(sceneKey)
    return view === undefined ? [] : Object.keys(view.view.slots) as SlotName[]
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
    return this.file.views.find((view) => view.view.scene === sceneKey)
  }

  /** Validates scenario references without compiling, rendering or running scenes. */
  validate(): readonly SightyAuthoringDiagnostic[] {
    return validateAuthoringResources(this.resources)
  }
}
