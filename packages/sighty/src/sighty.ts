import { CodPlay, type CodPlayOptions } from 'codplay'
import { SightyScenarioImpl } from './scenario'
import { loadSightyScenarioPackage } from './scenario-package-loader'
import { createSightyRuntime } from './runtime'
import type {
  SightyScenarioApi,
  SightyScenarioDefinition,
  SightySceneKey,
  SightySlotName,
} from './types'
import type {
  SightyRuntimeApi,
  SightyRuntimeConfiguration,
} from './runtime'
import type { SightyRuntimeBuild, SightyRuntimeOptions } from './runtime/types'

/** Configures the existing authored Sighty facade. */
export type SightyAuthorOptions<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  scenario: SightyScenarioDefinition<SceneKey, SlotName>
  runtime: SightyRuntimeConfiguration<SceneKey>
}>

/** Configures a Sighty owner that loads one exported scenario package. */
export type SightyOwnerOptions<SceneKey extends string = string> = Readonly<{
  codplay?: CodPlayOptions
  runtime?: Partial<Omit<SightyRuntimeConfiguration<SceneKey>, 'root' | 'instanceIds' | 'codplay'>>
}>

/** Options for preparing one exported scenario package. */
export type SightyLoadOptions<SceneKey extends string = string> = Readonly<{
  root: HTMLElement | string
  instanceIds?: Readonly<Record<SceneKey, string>>
}>

/** Selects either the existing author facade or the package owner form. */
export type SightyOptions<
  SceneKey extends string = string,
  SlotName extends string = string,
> = SightyAuthorOptions<SceneKey, SlotName> | SightyOwnerOptions<SceneKey>

type SightyProjectState<SceneKey extends string, SlotName extends string> = Readonly<{
  scenario: SightyScenarioApi<SceneKey, SlotName>
  runtime: SightyRuntimeApi<SceneKey, SlotName>
}>

/** Groups the Sighty scenario and runtime surfaces behind one public entry point. */
export class Sighty<
  SceneKey extends string = string,
  SlotName extends string = string,
> {
  #project: SightyProjectState<SceneKey, SlotName> | undefined
  #owner: CodPlay | undefined
  #ownerRuntimeOptions: SightyOwnerOptions<SceneKey>['runtime']
  #ownerMode = false
  #loading = false

  /** Scenario resources and authoring queries for this project. */
  get scenario(): SightyScenarioApi<SceneKey, SlotName> {
    return this.requireProject().scenario
  }

  /** CodPlay execution surface configured for this project. */
  get runtime(): SightyRuntimeApi<SceneKey, SlotName> {
    return this.requireProject().runtime
  }

  /** Creates an authored Sighty project or a package-loading owner. */
  constructor(options: SightyOptions<SceneKey, SlotName>) {
    if ('scenario' in options) {
      this.attachProject(options.scenario, options.runtime)
      return
    }
    this.#ownerMode = true
    this.#owner = new CodPlay(options.codplay)
    this.#ownerRuntimeOptions = options.runtime
  }

  /** Loads and prepares one package without creating or starting occurrences. */
  async load(packagePath: string, options: SightyLoadOptions<SceneKey>): Promise<Sighty<SceneKey, SlotName>> {
    if (!this.#ownerMode || this.#owner === undefined) {
      throw new Error('Sighty.load() requires an owner created without an authored scenario.')
    }
    if (this.#project !== undefined || this.#loading) {
      throw new Error('This Sighty owner already has a loaded scenario package.')
    }

    const owner = this.#owner
    this.#loading = true
    try {
      const loaded = await loadSightyScenarioPackage<SceneKey>(owner, packagePath, options.root)
      if (this.#owner !== owner) throw new Error('Sighty owner was destroyed while loading its scenario package.')
      const runtimeOptions: SightyRuntimeConfiguration<SceneKey> = {
        ...this.#ownerRuntimeOptions,
        root: loaded.root,
        instanceIds: options.instanceIds ?? createInstanceIds(loaded.scenario),
      }
      this.attachProject(loaded.scenario as SightyScenarioDefinition<SceneKey, SlotName>, runtimeOptions, {
        owner,
        preparedBuilds: loaded.preparedBuilds,
        packagedSceneKeys: loaded.packagedSceneKeys,
      })
      return this
    } finally {
      this.#loading = false
    }
  }

  /** Destroys this project or the package owned by this Sighty loader. */
  destroy(): void {
    if (this.#project !== undefined) {
      this.#project.runtime.destroy()
      this.#project = undefined
      this.#owner = undefined
      this.#ownerMode = false
      return
    }
    this.#owner?.destroy()
    this.#owner = undefined
    this.#ownerMode = false
  }

  /** Creates the mutable author surface and its existing runtime. */
  private attachProject(
    scenarioDefinition: SightyScenarioDefinition<SceneKey, SlotName>,
    runtimeConfiguration: SightyRuntimeConfiguration<SceneKey>,
    prepared?: Readonly<{
      owner: CodPlay
      preparedBuilds: ReadonlyMap<SceneKey, SightyRuntimeBuild>
      packagedSceneKeys: ReadonlySet<SceneKey>
    }>,
  ): void {
    const scenario = new SightyScenarioImpl(scenarioDefinition)
    const runtimeOptions: SightyRuntimeOptions<SceneKey, SlotName> = {
      ...runtimeConfiguration,
      scenario,
      ...(prepared === undefined ? {} : {
        owner: prepared.owner,
        preparedBuilds: prepared.preparedBuilds,
        packagedSceneKeys: prepared.packagedSceneKeys,
      }),
    }
    this.#project = {
      scenario,
      runtime: createSightyRuntime(scenario, runtimeOptions),
    }
  }

  /** Returns the attached project surfaces or reports that package loading is not finished. */
  private requireProject(): SightyProjectState<SceneKey, SlotName> {
    if (this.#project === undefined) throw new Error('Load a Sighty scenario package before using its scenario or runtime.')
    return this.#project
  }
}

/** Derives distinct owner-local CodPlay instance IDs for the direct scene catalog. */
function createInstanceIds<SceneKey extends string>(
  scenario: SightyScenarioDefinition<SceneKey>,
): Readonly<Record<SceneKey, string>> {
  const prefix = encodeURIComponent(scenario.id ?? 'sighty-scenario')
  return Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
    sceneKey,
    `sighty-${prefix}-${encodeURIComponent(sceneKey)}`,
  ])) as Readonly<Record<SceneKey, string>>
}

export type { SightySceneKey, SightySlotName }
