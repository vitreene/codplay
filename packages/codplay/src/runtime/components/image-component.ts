import { BaseComponent } from './lib/base-component'
import { ensureImagePart, resetImagePart, setImageAlt, setImageFitMode, setImageSource } from './lib/dom'
import { applyClassNamePatch } from './lib/dom-component-adapter'
import { injectBaseStyle } from './lib/inject-base-style'
import type { ImageFitMode } from './lib/dom'
import { RUNTIME_CONFIG } from '../config'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type ImageState = {
  src?: unknown
  alt?: unknown
  fitMode?: unknown
  img?: unknown
}

const MEDIA = 'media'
const IMG_BASE_CLASS = 'cp-img-inner'

/**
 * Resolves one authored fitMode into the image component domain.
 */
function resolveImageFitMode(value: unknown): ImageFitMode | null {
  if (value === undefined) {
    return RUNTIME_CONFIG.image.defaultFitMode
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
   * Declares services used for className, style and attr patches.
   * Injects the base stylesheet for the inner img element once per page.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
    injectBaseStyle(
      'cp-img-inner-style',
      ':where(.cp-img-inner){width:100%;height:100%;display:block}'
    )
  }

  /**
   * Ensures the img part exists inside the root node.
   * existingMediaNode must be captured before buildNode clears the parts map.
   * On refresh (existingMediaNode !== null) the img element is reused without
   * reset or src reload — reassigning the same src resets naturalWidth/complete
   * synchronously until the (cached) load event fires, which corrupts any code
   * reading image dimensions in the same tick (e.g. replace's split-cells).
   */
  private setupImageNode(rootNode: unknown, existingMediaNode: unknown | null): unknown {
    const mediaNode = ensureImagePart(rootNode, existingMediaNode)
    this.setPart(MEDIA, mediaNode)
    if (existingMediaNode === null) {
      resetImagePart(mediaNode)
    }
    return mediaNode
  }

  /**
   * Applies image-specific props on the internal img element.
   * The base class cp-img-inner is always re-ensured last so any authored
   * CSS selector or inline style can override defaults without !important.
   */
  private applyImageMediaState(mediaNode: unknown, state: ImageState): void {
    if (typeof state.src === 'string') {
      setImageSource(mediaNode, state.src)
    }

    if (typeof state.alt === 'string') {
      setImageAlt(mediaNode, state.alt)
    }

    const fitMode = resolveImageFitMode(state.fitMode)
    if (fitMode !== null) {
      setImageFitMode(mediaNode, fitMode)
    }

    if (state.img !== null && typeof state.img === 'object') {
      this.services.apply(mediaNode, state.img as Record<string, unknown>)
    }

    applyClassNamePatch(mediaNode, { add: IMG_BASE_CLASS })
  }

  /**
   * Applies one resolved runtime action on the image component.
   */
  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
    this.applyImageMediaState(this.getPart(MEDIA), input.action as ImageState)
  }

  /**
   * Creates the component root with an internal image part.
   * The existing img node is captured before buildNode clears the parts map so
   * setupImageNode can reuse it on seek refresh without reset or src reload.
   */
  render(): ComponentRenderResult {
    const existingMediaNode = this.getPart(MEDIA)
    const rootNode = this.buildNode(`<div><img data-part="${MEDIA}"/></div>`)
    const mediaNode = this.setupImageNode(rootNode, existingMediaNode)
    this.services.apply(rootNode, this.perso.initial)
    if (existingMediaNode === null) {
      this.applyImageMediaState(mediaNode, this.perso.initial as ImageState)
    }
    return rootNode as Node
  }
}
