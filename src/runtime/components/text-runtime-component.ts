import {
  applyAttrPatch,
  applyClassNamePatch,
  applyNodeId,
  applyStylePatch,
  applyTextContent,
  createRuntimeNode,
  resetRuntimeNodeState
} from './dom-component-adapter'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from './types'

/**
 * Implements the runtime text component defined by the V1 component contract.
 */
export class TextRuntimeComponent implements RuntimeComponent {
  private readonly input: RuntimeComponentClassInput
  private readonly item: RuntimeComponentClassInput['item']
  private rootNode: unknown | null = null

  /**
   * Creates one text component instance bound to a specific item id.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.input = input
    this.item = input.item
  }

  /**
   * Initializes the text component root node and applies initial patches.
   */
  init(initial: Record<string, unknown>): void {
    try {
      const tagName = typeof initial.tag === 'string' && initial.tag.length > 0 ? initial.tag : 'p'
      this.rootNode = createRuntimeNode(this.item, tagName, this.input.createElementOptions)
      resetRuntimeNodeState(this.rootNode)

      if (typeof initial.id === 'string') {
        applyNodeId(this.rootNode, initial.id)
      }

      applyClassNamePatch(
        this.rootNode,
        typeof initial.className === 'string' || typeof initial.className === 'object'
          ? (initial.className as string | { add?: string; remove?: string })
          : undefined
      )

      applyStylePatch(
        this.rootNode,
        typeof initial.style === 'object' && initial.style !== null
          ? (initial.style as Record<string, unknown>)
          : undefined
      )

      applyAttrPatch(
        this.rootNode,
        typeof initial.attr === 'object' && initial.attr !== null
          ? (initial.attr as Record<string, unknown>)
          : undefined
      )

      if (typeof initial.content === 'string') {
        applyTextContent(this.rootNode, initial.content)
      }
    } catch (error) {
      this.input.warn({
        code: 'RUNTIME_TEXT_INIT_FAILED',
        message: 'Text component init failed',
        details: {
          persoId: this.item.id,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }

  /**
   * Returns the runtime root node for this text component.
   */
  render(): unknown {
    return this.rootNode
  }

  /**
   * Applies one aggregated action payload onto the text component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.input.warn({
        code: 'RUNTIME_TEXT_UPDATE_FAILED',
        message: 'Text component update rejected because init is missing',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq
        }
      })
      return
    }

    try {
      if (input.action.content !== undefined && typeof input.action.content !== 'string') {
        this.input.warn({
          code: 'AUTHOR_TEXT_CONTENT_INVALID',
          message: 'Text action content must be a string',
          details: {
            persoId: input.persoId,
            eventId: input.eventId,
            eventSeq: input.eventSeq
          }
        })
      }

      if (typeof input.action.content === 'string') {
        applyTextContent(this.rootNode, input.action.content)
      }

      applyClassNamePatch(
        this.rootNode,
        typeof input.action.className === 'string' || typeof input.action.className === 'object'
          ? (input.action.className as string | { add?: string; remove?: string })
          : undefined
      )

      applyStylePatch(
        this.rootNode,
        typeof input.action.style === 'object' && input.action.style !== null
          ? (input.action.style as Record<string, unknown>)
          : undefined,
        {
          skipTransitionValues: true
        }
      )

      applyAttrPatch(
        this.rootNode,
        typeof input.action.attr === 'object' && input.action.attr !== null
          ? (input.action.attr as Record<string, unknown>)
          : undefined
      )
    } catch (error) {
      this.input.warn({
        code: 'RUNTIME_TEXT_UPDATE_FAILED',
        message: 'Text component update failed',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }
}
