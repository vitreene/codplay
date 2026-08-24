import type {
  HTMLComponentInput,
  MaterializedPart,
} from './component-types'
import { BaseComponent } from './base-component'

/** Provides the HTML/SVG markup projection contract for current V2 components. */
export abstract class BaseHTMLComponent<Initial extends Record<string, unknown>>
  extends BaseComponent<Initial> {
  protected readonly services: HTMLComponentInput<Initial>['services']
  public node: unknown | null = null
  private parts: readonly MaterializedPart[] = []

  /** Creates one markup component with its HTML/SVG services. */
  constructor(input: HTMLComponentInput<Initial>) {
    super(input)
    this.services = input.services
  }

  /** Declares the markup representation consumed by an HTML materializer. */
  abstract render(): string

  /** Stores one materialized root and its internal template parts. */
  _materialize(rootNode: unknown, parts: readonly MaterializedPart[]): void {
    this.node = rootNode
    this.parts = parts.map((part) => ({ ...part }))
  }

  /** Returns the internal parts discovered by the HTML materialization boundary. */
  protected getPartsSnapshot(): readonly MaterializedPart[] {
    return this.parts.map((part) => ({ ...part }))
  }

  /** Resolves one private materialized part without exposing the part registry publicly. */
  protected getPart(partId: string): unknown {
    return this.parts.find((part) => part.partId === partId)?.nodeRef
  }
}
