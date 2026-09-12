import { SightyScenarioImpl } from './scenario'
import { createSightyRuntime } from './runtime'
import type {
  SightyScenarioApi,
  SightyScenarioResources,
  SightySceneKey,
  SightySlotName,
} from './types'
import type { SightyRuntimeApi, SightyRuntimeConfiguration } from './runtime'

/** Configures the two public surfaces grouped by one Sighty instance. */
export type SightyOptions<
  SceneKey extends string = string,
  SlotName extends string = string,
> = Readonly<{
  scenario: SightyScenarioResources<SceneKey, SlotName>
  runtime: SightyRuntimeConfiguration<SceneKey>
}>

/** Groups the scenario and runtime surfaces behind one public entry point. */
export class Sighty<
  SceneKey extends string = string,
  SlotName extends string = string,
> {
  /** Scenario resources and authoring queries for this project. */
  readonly scenario: SightyScenarioApi<SceneKey, SlotName>

  /** CodPlay execution surface configured for this project. */
  readonly runtime: SightyRuntimeApi<SceneKey, SlotName>

  /** Creates one Sighty facade from a scenario and its runtime configuration. */
  constructor(options: SightyOptions<SceneKey, SlotName>) {
    const scenario = new SightyScenarioImpl(options.scenario)
    this.scenario = scenario
    this.runtime = createSightyRuntime(scenario, options.runtime)
  }
}

export type { SightySceneKey, SightySlotName }
