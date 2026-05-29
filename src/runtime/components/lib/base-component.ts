import { htmlRenderMutationResolver } from '../../html-render-mutation-resolver'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from '../types'

/**
 * Provides one light base class for shared warnings and DOM part references.
 */
export abstract class BaseComponent implements RuntimeComponent {
  static readonly renderMutationResolver = htmlRenderMutationResolver

  protected readonly perso: RuntimeComponentClassInput['perso']
  protected readonly createElementOptions: RuntimeComponentClassInput['createElementOptions']
  private readonly reportWarning: RuntimeComponentClassInput['report']

  protected rootNode: unknown | null = null
  private readonly parts = new Map<string, unknown>()

  /**
   * Stores runtime dependencies shared by all components.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.perso = input.perso
    this.createElementOptions = input.createElementOptions
    this.reportWarning = input.report
  }

  /**
   * Applies authored initial state and creates the component root node.
   */
  abstract init(initial: Record<string, unknown>): void

  /**
   * Returns the current root node of the component.
   */
  render(): unknown {
    return this.rootNode
  }

  /**
   * Applies one resolved runtime action patch on the component.
   */
  abstract update(input: RuntimeComponentUpdateInput): void

  /**
   * Emits one normalized author warning scoped to the current component.
   */
  protected report(code: string, message: string, details?: Record<string, unknown>): void {
    this.reportWarning({
      code,
      message,
      details: {
        persoId: this.perso.id,
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
   * Clears all previously registered internal parts.
   */
  protected clearParts(): void {
    this.parts.clear()
  }

  /**
   * Returns one previously registered DOM part when available.
   */
  protected getPart(partId: string): unknown | null {
    return this.parts.get(partId) ?? null
  }

  /**
   * Resolves one author-facing ref to the component root or one internal ref.
   */
  protected resolveRef(ref?: string): unknown | null {
    if (ref === undefined || ref === 'root') {
      return this.rootNode
    }

    return this.getPart(ref)
  }
}
