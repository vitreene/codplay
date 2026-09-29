import type {
  SightyRuntimeEvent,
  SightyScenarioSelection,
  SightyScenarioStateApi,
  SightyViewReference,
} from '../types'

type ScenarioStateReaders<SceneKey extends string, SlotName extends string> = Readonly<{
  active: () => SightyScenarioSelection<SceneKey, SlotName> | undefined
  current: () => readonly SightyScenarioSelection<SceneKey, SlotName>[]
  context: () => Readonly<Record<string, unknown>>
  canAccess: (reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
  canExit: (reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>) => Promise<boolean>
}>

/** Exposes live scenario state and delegates guard decisions to navigation. */
export class SightyScenarioState<SceneKey extends string, SlotName extends string>
  implements SightyScenarioStateApi<SceneKey, SlotName> {
  private readonly readers: ScenarioStateReaders<SceneKey, SlotName>

  /** Creates a read-only state surface over the owning Sighty runtime. */
  constructor(readers: ScenarioStateReaders<SceneKey, SlotName>) {
    this.readers = readers
  }

  /** Returns the view currently followed by Sighty's navigation pointer. */
  get active(): SightyScenarioSelection<SceneKey, SlotName> | undefined {
    return this.readers.active()
  }

  /** Returns a snapshot of the currently selected authored views. */
  get current(): readonly SightyScenarioSelection<SceneKey, SlotName>[] {
    return this.readers.current()
  }

  /** Returns the runtime's current durable scenario context. */
  get context(): Readonly<Record<string, unknown>> {
    return this.readers.context()
  }

  /** Evaluates access using the active runtime's navigation conditions. */
  canAccess(reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    return this.readers.canAccess(reference, event)
  }

  /** Evaluates exit using the active runtime's navigation conditions. */
  canExit(reference: SightyViewReference, event: SightyRuntimeEvent<SceneKey>): Promise<boolean> {
    return this.readers.canExit(reference, event)
  }
}
