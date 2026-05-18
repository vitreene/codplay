import { htmlRenderMutationResolver } from '../html-render-mutation-resolver'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from './types'

/**
 * Provides one light base class for shared warnings and DOM part references.
 */
export abstract class BaseComponent implements RuntimeComponent {
  static readonly renderMutationResolver = htmlRenderMutationResolver

  protected readonly item: RuntimeComponentClassInput['item']
  protected readonly createElementOptions: RuntimeComponentClassInput['createElementOptions']
  private readonly reportWarning: RuntimeComponentClassInput['warn']

  protected rootNode: unknown | null = null
  private readonly parts = new Map<string, unknown>()

  /**
   * Stores runtime dependencies shared by all components.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.item = input.item
    this.createElementOptions = input.createElementOptions
    this.reportWarning = input.warn
  }

  abstract init(initial: Record<string, unknown>): void

  /**
   * Returns the current root node of the component.
   */
  render(): unknown {
    return this.rootNode
  }

  abstract update(input: RuntimeComponentUpdateInput): void

  /**
   * Emits one normalized author warning scoped to the current component.
   */
  protected warn(code: string, message: string, details?: Record<string, unknown>): void {
    this.reportWarning({
      code,
      message,
      details: {
        persoId: this.item.id,
        ...details
      }
    })
  }

  /**
   * Stores the component root node.
   */
  protected setRoot(nodeRef: unknown): void {
    this.rootNode = nodeRef
  }

  /**
   * Registers one named DOM part for later updates.
   */
  protected setPart(partId: string, nodeRef: unknown): void {
    this.parts.set(partId, nodeRef)
  }

  /**
   * Returns one previously registered DOM part when available.
   */
  protected getPart(partId: string): unknown | null {
    return this.parts.get(partId) ?? null
  }
}
