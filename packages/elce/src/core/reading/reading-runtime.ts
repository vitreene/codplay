import { Sighty } from '@codplay/sighty'
import type {
  SightyRuntimeConfiguration,
  SightyRuntimeApi,
  SightyScenarioDefinition,
} from '@codplay/sighty'

/** Owns only the generic Sighty runtime for a scenario supplied by its caller. */
export class ReadingRuntime<SceneKey extends string, SlotName extends string> {
  private readonly sighty: Sighty<SceneKey, SlotName>

  /** Creates a Sighty runtime from an already-built scenario and its host options. */
  public constructor(
    scenario: SightyScenarioDefinition<SceneKey, SlotName>,
    configuration: SightyRuntimeConfiguration<SceneKey>,
  ) {
    this.sighty = new Sighty({ scenario, runtime: configuration })
  }

  /** Exposes the runtime API without exposing ownership of the Sighty facade. */
  public get api(): SightyRuntimeApi<SceneKey, SlotName> {
    return this.sighty.runtime
  }

  /** Initializes the configured runtime. */
  public initialize(): Promise<void> {
    return this.sighty.runtime.initialize()
  }

  /** Destroys the configured runtime and its CodPlay resources. */
  public destroy(): void {
    this.sighty.runtime.destroy()
  }
}
