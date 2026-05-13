import {
  appendDomChild,
  applyAttrPatch,
  applyClassNamePatch,
  applyImageAlt,
  applyImageSource,
  applyNodeId,
  applyObjectFit,
  applyStylePatch,
  createRuntimeNode,
  isDomElement,
  resetRuntimeNodeState
} from './dom-component-adapter'
import { htmlRenderMutationResolver } from '../html-render-mutation-resolver'
import type { RuntimeComponent, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from './types'

type FitMode = 'wallpaper' | 'sprite'

/**
 * Resolves image fit mode to one object-fit css value.
 */
function resolveObjectFit(fitMode: FitMode): 'cover' | 'contain' {
  return fitMode === 'sprite' ? 'contain' : 'cover'
}

/**
 * Builds one object node that represents media image state.
 */
function createObjectMediaNode(): Record<string, unknown> {
  return {
    tagName: 'IMG',
    style: {},
    attributes: {}
  }
}

/**
 * Implements the runtime image component with root+media structure.
 */
export class ImageRuntimeComponent implements RuntimeComponent {
  static readonly renderMutationResolver = htmlRenderMutationResolver

  private readonly input: RuntimeComponentClassInput
  private readonly item: RuntimeComponentClassInput['item']

  private rootNode: unknown | null = null
  private mediaNode: unknown | null = null

  /**
   * Creates one image component instance bound to one item.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.input = input
    this.item = input.item
  }

  /**
   * Initializes image root/media nodes and applies initial payload.
   */
  init(initial: Record<string, unknown>): void {
    try {
      this.rootNode ??= createRuntimeNode(this.item, 'div', this.input.createElementOptions)
      resetRuntimeNodeState(this.rootNode)

      if (isDomElement(this.rootNode)) {
        const existingMedia = this.mediaNode ?? this.rootNode.querySelector('img')
        this.mediaNode = existingMedia ?? globalThis.document.createElement('img')
        appendDomChild(this.rootNode, this.mediaNode)
      } else {
        this.mediaNode ??= createObjectMediaNode()
      }

      resetRuntimeNodeState(this.mediaNode)

      applyNodeId(this.rootNode, typeof initial.id === 'string' ? initial.id : this.item.id)

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

      this.applyMediaPatch(initial, {
        persoId: this.item.id,
        eventId: 'init',
        eventSeq: 0,
        action: initial
      })
    } catch (error) {
      this.input.warn({
        code: 'RUNTIME_IMAGE_INIT_FAILED',
        message: 'Image component init failed',
        details: {
          persoId: this.item.id,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }

  /**
   * Returns the root node rendered by this component.
   */
  render(): unknown {
    return this.rootNode
  }

  /**
   * Applies one aggregated action payload on root and media nodes.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null || this.mediaNode === null) {
      this.input.warn({
        code: 'RUNTIME_IMAGE_UPDATE_FAILED',
        message: 'Image component update rejected because init is missing',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq
        }
      })
      return
    }

    try {
      this.applyMediaPatch(input.action, input)

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
        code: 'RUNTIME_IMAGE_UPDATE_FAILED',
        message: 'Image component update failed',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }

  /**
   * Applies one media patch on image-specific fields.
   */
  private applyMediaPatch(payload: Record<string, unknown>, context: RuntimeComponentUpdateInput): void {
    if (this.mediaNode === null) {
      return
    }

    if (payload.src !== undefined && typeof payload.src !== 'string') {
      this.input.warn({
        code: 'AUTHOR_IMAGE_SRC_INVALID',
        message: 'Image src must be a string',
        details: {
          persoId: context.persoId,
          eventId: context.eventId,
          eventSeq: context.eventSeq
        }
      })
    }

    if (typeof payload.src === 'string') {
      applyImageSource(this.mediaNode, payload.src)
    }

    if (payload.alt !== undefined && typeof payload.alt !== 'string') {
      this.input.warn({
        code: 'AUTHOR_IMAGE_ACTION_INVALID',
        message: 'Image alt must be a string',
        details: {
          persoId: context.persoId,
          eventId: context.eventId,
          eventSeq: context.eventSeq
        }
      })
    }

    if (typeof payload.alt === 'string') {
      applyImageAlt(this.mediaNode, payload.alt)
    }

    const fitMode = payload.fitMode
    if (fitMode !== undefined && fitMode !== 'wallpaper' && fitMode !== 'sprite') {
      this.input.warn({
        code: 'AUTHOR_IMAGE_FIT_MODE_INVALID',
        message: 'Image fitMode must be wallpaper or sprite',
        details: {
          persoId: context.persoId,
          eventId: context.eventId,
          eventSeq: context.eventSeq,
          fitMode
        }
      })
    }

    if (fitMode === 'wallpaper' || fitMode === 'sprite') {
      applyObjectFit(this.mediaNode, resolveObjectFit(fitMode))
      return
    }

    applyObjectFit(this.mediaNode, 'cover')
  }
}
