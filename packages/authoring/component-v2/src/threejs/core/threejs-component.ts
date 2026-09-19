import {
  BaseComponent,
  BaseHTMLComponent,
  type ComponentInput,
} from 'codplay'
import type { ThreeRuntime } from './threejs-core-types'

/** Base for Three.js components that contribute to an existing native scene. */
export abstract class BaseThreeComponent<Initial extends Record<string, unknown>>
  extends BaseComponent<Initial> {
  protected readonly runtime: ThreeRuntime

  /** Reads the engine-prepared Three.js namespace once during construction. */
  constructor(input: ComponentInput<Initial>) {
    super(input)
    this.runtime = input.runtime!.getLibrary<ThreeRuntime>('three')
  }
}

/** Base for the Three.js host that also owns an HTML representation. */
export abstract class BaseThreeHTMLComponent<Initial extends Record<string, unknown>>
  extends BaseHTMLComponent<Initial> {
  protected readonly runtime: ThreeRuntime

  /** Reads the engine-prepared Three.js namespace once during construction. */
  constructor(input: ComponentInput<Initial>) {
    super(input)
    this.runtime = input.runtime!.getLibrary<ThreeRuntime>('three')
  }
}
