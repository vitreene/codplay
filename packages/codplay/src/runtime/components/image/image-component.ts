import { canAppendChild } from '../../../shared'
import type { ComponentInput, ComponentUpdateInput } from '../component-types'
import { BaseHTMLComponent } from '../base-html-component'
import type { ImageInitial, ImageState } from './image-types'

const IMAGE_BASE_CLASS = 'cp-img-inner'

/** V2 image component preserving one materialized `<img>` node per source. */
export class ImageComponent extends BaseHTMLComponent<ImageInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** Persistent native image nodes indexed by their immutable source. */
  private readonly imageBySource = new Map<string, HTMLImageElement>()
  /** Source currently attached to the wrapper. */
  private activeSource: string | null = null

  /** Creates one image component with services bound by the core catalog. */
  constructor(input: ComponentInput<ImageInitial>) {
    super(input)
    this.services.declare(ImageComponent.declaredServices)
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

    if (input.state.src !== undefined) this.setActiveSource(input.state.src)
    const active = this.activeSource === null ? undefined : this.imageBySource.get(this.activeSource)
    if (active !== undefined) this.applyImageState(active, input.state)
  }

  /** Creates or returns the one native image node associated with a source. */
  private ensureImage(source: string): HTMLImageElement {
    const existing = this.imageBySource.get(source)
    if (existing !== undefined) return existing

    const image = document.createElement('img')
    image.src = source
    this.applyImageState(image, this.perso.initial)
    this.imageBySource.set(source, image)
    return image
  }

  /** Applies non-source state to one persistent image node. */
  private applyImageState(node: HTMLImageElement, state: ImageInitial | ImageState): void {
    if (state.alt !== undefined) node.alt = state.alt
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

    if (previous !== undefined && previous !== image && previous.parentNode === wrapper) previous.remove()
    if (canAppendChild(wrapper) && image.parentNode !== wrapper) wrapper.appendChild(image)
    this.activeSource = source
  }
}
