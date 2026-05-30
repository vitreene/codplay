import { htmlRenderMutationResolver } from '../../html-render-mutation-resolver'
import { createComponentRoot, resetComponentRoot, setComponentRootId } from './dom'
import { collectDataParts } from './dom-component-adapter'
import type { ComponentModules, ComponentRenderResult, ComponentServices, RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from '../types'

/**
 * Provides one light base class for shared warnings and DOM part references.
 */
export abstract class BaseComponent implements RuntimeComponent {
  static readonly renderMutationResolver = htmlRenderMutationResolver

  protected readonly perso: RuntimeComponentClassInput['perso']
  protected readonly services: ComponentServices
  readonly modules: ComponentModules
  protected readonly createElementOptions: RuntimeComponentClassInput['createElementOptions']
  private readonly reportWarning: RuntimeComponentClassInput['report']

  public node: unknown | null = null
  private readonly parts = new Map<string, unknown>()

  /**
   * Stores runtime dependencies shared by all components.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.perso = input.perso
    this.services = input.services
    this.modules = input.modules
    this.createElementOptions = input.createElementOptions
    this.reportWarning = input.report
  }

  /**
   * Describes the initial rendering of the component. Returns a constructed node.
   */
  abstract render(): ComponentRenderResult

  /**
   * Optional author hook called once after the root node is created.
   */
  init?(): void

  /**
   * Applies one resolved runtime action patch on the component.
   */
  abstract update(input: RuntimeComponentUpdateInput): void

  /**
   * Builds, resets and ids one root node from a tag name or an HTML template string.
   * For a tag: reuses the existing node on refresh.
   * For a template: parses fresh and auto-registers descendant elements with data-part as parts.
   */
  protected buildNode(tagOrTemplate: string): unknown {
    const isTemplate = tagOrTemplate.trimStart().startsWith('<')

    if (isTemplate) {
      const { rootNode, nodeByPart } = this._parseTemplate(tagOrTemplate)
      resetComponentRoot(rootNode)
      setComponentRootId(rootNode, this.perso.id, (this.perso.initial as Record<string, unknown>).id)
      for (const [partId, partNode] of nodeByPart) {
        this.setPart(partId, partNode)
      }
      return rootNode
    }

    const rootNode = this.node ?? createComponentRoot(this.perso, tagOrTemplate, this.createElementOptions)
    resetComponentRoot(rootNode)
    setComponentRootId(rootNode, this.perso.id, (this.perso.initial as Record<string, unknown>).id)
    return rootNode
  }

  /**
   * Parses one HTML template string into a root node and a map of descendant nodes by data-part name.
   */
  private _parseTemplate(html: string): { rootNode: unknown; nodeByPart: Map<string, unknown> } {
    const nodeByPart = new Map<string, unknown>()

    if (typeof globalThis.document !== 'undefined') {
      const template = globalThis.document.createElement('template')
      template.innerHTML = html
      const childNodes = Array.from(template.content.childNodes).filter((n) => {
        return !(n.nodeType === 3 && n.textContent?.trim() === '')
      })
      const rootNode = childNodes.length === 1 ? childNodes[0] : template.content

      collectDataParts(rootNode, nodeByPart)

      return { rootNode, nodeByPart }
    }

    return { rootNode: { tagName: 'DIV', innerHTML: html, style: {}, attributes: {} }, nodeByPart }
  }

  /**
   * Calls render(), assigns the returned node, then calls init() if present.
   */
  _init(): void {
    this.node = this.render()
    this.init?.()
  }

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
      return this.node
    }

    return this.getPart(ref)
  }
}
