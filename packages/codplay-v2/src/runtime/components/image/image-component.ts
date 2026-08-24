import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { reportInvalidComponentValue, isComponentRecord } from '../component-validation'
import type { AttrValue, ClassNameValue, StyleValue } from '../../../services'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import { BaseHTMLComponent } from '../base-html-component'

/** Properties targeted at the persistent native image node. */
export type ImagePartState = Readonly<{
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Initial author state accepted by the V2 `img` component. */
export type ImageInitial = Readonly<{
  src?: string
  alt?: string
  img?: ImagePartState
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved state applied by one image update. */
export type ImageState = Readonly<ImageInitial>

/** Action payload accepted by one image perso. */
export type ImageAction = ImageState

const IMAGE_BASE_CLASS = 'cp-img-inner'

/** Validates one image initial payload, including the deliberate fitMode removal. */
export const validateImageInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_INITIAL_INVALID', 'img initial state must be a plain object.')
    return
  }

  validateImageFields(value, context, 'initial')
}

/** Validates one image action payload without accepting the retired fitMode field. */
export const validateImageAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validateImageFields(value, context, 'action')
}

/** V2 image component preserving one materialized `<img>` node per source. */
export class ImageComponent extends BaseHTMLComponent<ImageInitial> {
  /** Persistent native image nodes indexed by their immutable source. */
  private readonly imageBySource = new Map<string, unknown>()
  /** Source currently attached to the wrapper. */
  private activeSource: string | null = null

  /** Creates one image component with services bound by the core catalog. */
  constructor(input: HTMLComponentInput<ImageInitial>) {
    super(input)
  }

  /** Returns the stable wrapper template consumed by the DOM materializer. */
  render(): string {
    return '<div class="codplay-image-root"></div>'
  }

  /** Applies one complete resolved image state without reassigning an existing source. */
  update(input: ComponentUpdateInput<ImageState>): void {
    if (this.node === null) throw new Error(`Image component is not materialized: ${this.perso.id}`)

    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })

    if (typeof input.state.src === 'string') this.setActiveSource(input.state.src)
    const active = this.activeSource === null ? undefined : this.imageBySource.get(this.activeSource)
    if (active !== undefined) this.applyImageState(active, input.state)
  }

  /** Creates or returns the one native image node associated with a source. */
  private ensureImage(source: string): unknown {
    const existing = this.imageBySource.get(source)
    if (existing !== undefined) return existing

    const image = createImageNode()
    setImageSource(image, source)
    this.applyImageState(image, this.perso.initial)
    this.imageBySource.set(source, image)
    return image
  }

  /** Applies non-source state to one persistent image node. */
  private applyImageState(node: unknown, state: ImageInitial | ImageState): void {
    if (typeof state.alt === 'string') setImageAlt(node, state.alt)
    if (state.img !== undefined) {
      this.services.apply(node, {
        className: state.img.className,
        style: state.img.style,
        attr: state.img.attr,
      })
    }
    this.services.apply(node, { className: { add: IMAGE_BASE_CLASS } })
  }

  /** Attaches one cached image and detaches the previously active image. */
  private setActiveSource(source: string): void {
    const wrapper = this.node
    const image = this.ensureImage(source)
    const previous = this.activeSource === null ? undefined : this.imageBySource.get(this.activeSource)

    if (isChildNode(previous) && previous !== image && previous.parentNode === wrapper) {
      removeChild(previous)
    }
    if (isParentNode(wrapper) && isChildNode(image) && image.parentNode !== wrapper) {
      wrapper.appendChild(image)
    }
    this.activeSource = source
  }
}

/** Validates image-specific fields independently from shared service validators. */
function validateImageFields(
  value: Record<string, unknown>,
  context: Parameters<ValidationFunction>[1],
  scope: 'initial' | 'action',
): void {
  if ('fitMode' in value) {
    reportInvalidComponentValue(
      context,
      'AUTHOR_IMAGE_FIT_MODE_REMOVED',
      'img.fitMode is not part of the V2 contract; use img.style.objectFit.',
      'fitMode',
    )
  }
  if (value.src !== undefined && typeof value.src !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_SRC_INVALID', `img ${scope} src must be a string.`, 'src')
  }
  if (value.alt !== undefined && typeof value.alt !== 'string') {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_ALT_INVALID', `img ${scope} alt must be a string.`, 'alt')
  }
  if (value.img !== undefined && !isPlainRecord(value.img)) {
    reportInvalidComponentValue(context, 'AUTHOR_IMAGE_PART_INVALID', 'img.img must be a plain object.', 'img')
  }
}

/** Creates one native image node in a browser or a minimal test/runtime fallback. */
function createImageNode(): unknown {
  if (typeof globalThis.document !== 'undefined') return globalThis.document.createElement('img')
  return { tagName: 'IMG', parentNode: null, style: {}, attributes: {} }
}

/** Assigns a source exactly once to a freshly created image node. */
function setImageSource(node: unknown, source: string): void {
  if (typeof node !== 'object' || node === null) return
  const candidate = node as { src?: string; setAttribute?: (name: string, value: string) => void }
  if ('src' in candidate) candidate.src = source
  else candidate.setAttribute?.('src', source)
}

/** Applies alternative text without changing the source resource. */
function setImageAlt(node: unknown, alt: string): void {
  if (typeof node !== 'object' || node === null) return
  const candidate = node as { alt?: string; setAttribute?: (name: string, value: string) => void }
  if ('alt' in candidate) candidate.alt = alt
  else candidate.setAttribute?.('alt', alt)
}

/** Checks the append contract used by the persistent wrapper. */
function isParentNode(value: unknown): value is { appendChild: (child: unknown) => void } {
  return typeof value === 'object' && value !== null && 'appendChild' in value
    && typeof (value as { appendChild?: unknown }).appendChild === 'function'
}

/** Checks the parent pointer required to detach one persistent node. */
function isChildNode(value: unknown): value is { parentNode: unknown; remove?: () => void } {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}

/** Removes one image from its current parent without touching its source. */
function removeChild(node: { parentNode: unknown; remove?: () => void }): void {
  if (typeof node.remove === 'function') {
    node.remove()
    return
  }
  const parent = node.parentNode
  if (typeof parent === 'object' && parent !== null && 'removeChild' in parent) {
    const remove = (parent as { removeChild?: (child: unknown) => void }).removeChild
    remove?.(node)
  }
}
