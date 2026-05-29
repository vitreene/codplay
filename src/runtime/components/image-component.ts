import { BaseComponent } from './lib/base-component'
import { setImageAlt, setImageFitMode, setImageSource } from './lib/dom'
import type { ImageFitMode } from './lib/dom'
import { RUNTIME_CONFIG } from '../config'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

type ImageState = {
  src?: unknown
  alt?: unknown
  fitMode?: unknown
}

const MEDIA = 'media'

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
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Applies image-specific props on the internal media part.
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
   */
  render(): ComponentRenderResult {
    const rootNode = this.buildNode(`<div><img data-part="${MEDIA}"/></div>`)
    this.services.apply(rootNode, this.perso.initial)
    this.applyImageMediaState(this.getPart(MEDIA), this.perso.initial as ImageState)
    return rootNode as Node
  }
}
