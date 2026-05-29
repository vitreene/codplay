import { BaseComponent } from './lib/base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  createComponentRoot,
  ensureImagePart,
  resetComponentRoot,
  resetImagePart,
  setComponentRootId,
  setImageAlt,
  setImageFitMode,
  setImageSource
} from './lib/dom'
import type { ImageFitMode } from './lib/dom'
import type { RuntimeComponentUpdateInput } from './types'

type ImageState = {
  id?: unknown
  src?: unknown
  alt?: unknown
  fitMode?: unknown
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

const DEFAULT_IMAGE_FIT_MODE: ImageFitMode = 'wallpaper'
const MEDIA_PART_ID = 'media'

/**
 * Resolves one authored fitMode into the image component domain.
 */
function resolveImageFitMode(value: unknown): ImageFitMode | null {
  if (value === undefined) {
    return DEFAULT_IMAGE_FIT_MODE
  }

  if (value === 'wallpaper' || value === 'sprite') {
    return value
  }

  return null
}

/**
 * Implements one simple image component with one root and one media part.
 */
export class ImageComponent extends BaseComponent {
  /**
   * Creates the component root and the internal image part.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as ImageState
    const rootNode = createComponentRoot(this.perso, 'div', this.createElementOptions)

    resetComponentRoot(rootNode)
    setComponentRootId(rootNode, this.perso.id, state.id)

    const mediaNode = ensureImagePart(rootNode, this.getPart(MEDIA_PART_ID))
    resetImagePart(mediaNode)

    applyClassNameProps(rootNode, state.className)
    applyStyleProps(rootNode, state.style)
    applyAttrProps(rootNode, state.attr)

    this.applyImageMediaState(mediaNode, state)

    this.setPart(MEDIA_PART_ID, mediaNode)
    this.setRoot(rootNode)
  }

  /**
   * Applies one resolved runtime action on the image component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.report('RUNTIME_IMAGE_NOT_INITIALIZED', 'Image component update rejected because init is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const mediaNode = this.getPart(MEDIA_PART_ID)
    if (mediaNode === null) {
      this.report('RUNTIME_IMAGE_MEDIA_PART_MISSING', 'Image component media part is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const state = input.action as ImageState

    applyStyleProps(this.rootNode, state.style, {
      skipTransitionValues: true
    })
    applyClassNameProps(this.rootNode, state.className)
    applyAttrProps(this.rootNode, state.attr)

    this.applyImageMediaState(mediaNode, state, {
      eventId: input.eventId,
      eventSeq: input.eventSeq
    })
  }

  /**
   * Applies the image-specific props on the internal media part.
   */
  private applyImageMediaState(
    mediaNode: unknown,
    state: ImageState,
    context?: { eventId: string; eventSeq: number }
  ): void {
    if (state.src !== undefined) {
      if (typeof state.src !== 'string') {
        this.report('AUTHOR_IMAGE_SRC_INVALID', 'Image src must be a string', context)
      } else {
        setImageSource(mediaNode, state.src)
      }
    }

    if (state.alt !== undefined) {
      if (typeof state.alt !== 'string') {
        this.report('AUTHOR_IMAGE_ALT_INVALID', 'Image alt must be a string', context)
      } else {
        setImageAlt(mediaNode, state.alt)
      }
    }

    const fitMode = resolveImageFitMode(state.fitMode)
    if (fitMode === null) {
      this.report('AUTHOR_IMAGE_FIT_MODE_INVALID', 'Image fitMode must be wallpaper or sprite', {
        ...context,
        fitMode: state.fitMode
      })
      return
    }

    setImageFitMode(mediaNode, fitMode)
  }
}
