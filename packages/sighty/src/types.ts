import type { SceneDoc } from 'codplay/scene/types'

/** Identifies a scene resource in an authored Sighty file. */
export type SightySceneKey = string

/** Identifies a slot declared by an authored layout scene. */
export type SightySlotName = string

/** Describes one child scene placed in a view slot. */
export type SightySlotPlacement<SceneKey extends string = string> = Readonly<{
  view: Readonly<{ scene: SceneKey }>
}>

/** Describes one authored view and the scenes placed in its slots. */
export type SightyView<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  view: Readonly<{
    scene: SceneKey
    slots: Readonly<Record<SlotName, readonly SightySlotPlacement<SceneKey>[]>>
  }>
}>

/** Describes the serializable Sighty file that names external resources. */
export type SightyFile<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  format: 'sighty'
  version: number
  id: string
  resources: Readonly<{
    scenes: Readonly<Record<SceneKey, string>>
    data?: Readonly<Record<string, string>>
  }>
  views: readonly SightyView<SceneKey, SlotName>[]
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
  validate: () => readonly SightyAuthoringDiagnostic[]
}>
