import { BaseHTMLComponent, type ComponentInput, type ComponentUpdateInput, type MaterializedPart } from 'codplay'
import { projectItemStyle, recordItemTransformProjection } from './item-style-projection'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from './item-motion-reference'
import {
  ITEM_PREVIEW_HEIGHT_PROPERTY,
  ITEM_PREVIEW_TRANSFORM_PROPERTY,
  ITEM_PREVIEW_WIDTH_PROPERTY,
} from './item-preview'

type NativeComponentClass<Initial extends Record<string, unknown>> = {
  new (input: ComponentInput<Initial>): BaseHTMLComponent<Initial>
  readonly declaredServices: readonly string[]
}

/** Reuses a native component inside one Editor-owned presentation, with one runtime identity. */
export function createItemComponent<Initial extends Record<string, unknown>>(NativeComponent: NativeComponentClass<Initial>) {
  return class ItemComponent extends BaseHTMLComponent<Initial> {
    static readonly declaredServices = NativeComponent.declaredServices
    readonly native: BaseHTMLComponent<Initial>
    private readonly frameId = `editor-item-frame-${crypto.randomUUID()}`
    private styleElement: HTMLStyleElement | null = null
    private transformAnchor: HTMLElement | null = null
    private visualAnchor: HTMLElement | null = null

    /** Gives the native content owner the same services, resources and immutable author data. */
    constructor(input: ComponentInput<Initial>) {
      super(input)
      this.native = new NativeComponent(input)
    }

    /** Keeps private DOM parts inside one perso; motion owns only the outer frame. */
    render(): string {
      return `<div id="${this.frameId}">
        <style id="${this.frameId}-style" data-part="editor-item-style"></style>
        <div id="${this.frameId}-transform" data-part="editor-item-transform">
          <div id="${this.frameId}-visual" data-part="editor-item-visual">${this.native.render()}</div>
        </div>
      </div>`
    }

    /** Binds the existing native owner to its private root without publishing a second target. */
    override _materialize(rootNode: unknown, parts: readonly MaterializedPart[]): void {
      super._materialize(rootNode, parts)
      this.styleElement = this.getPart('editor-item-style') as HTMLStyleElement
      this.transformAnchor = this.getPart('editor-item-transform') as HTMLElement
      this.visualAnchor = this.getPart('editor-item-visual') as HTMLElement
      this.native._materialize(this.visualAnchor.firstElementChild, [])
    }

    /** Initializes the native source and content lifecycle after both roots exist. */
    override initialize(): void {
      this.native.initialize()
    }

    /** Applies geometry once and delegates the remaining resolved state to the native component. */
    update(input: ComponentUpdateInput): void {
      const state = input.state
      const style = state.style as Readonly<Record<string, unknown>> | undefined ?? {}
      const {
        [ITEM_MOTION_REFERENCE_ANGLE]: referenceAngle,
        [ITEM_MOTION_ROTATION_BASELINE]: rotationBaseline,
        [ITEM_PREVIEW_TRANSFORM_PROPERTY]: previewTransform,
        [ITEM_PREVIEW_WIDTH_PROPERTY]: previewWidth,
        [ITEM_PREVIEW_HEIGHT_PROPERTY]: previewHeight,
        ...itemStyle
      } = style
      const { frameStyle, visualStyle, motionTransformStyle, rotationOrigin } = projectItemStyle({
        ...itemStyle,
        ...(referenceAngle === undefined ? {} : { [ITEM_MOTION_REFERENCE_ANGLE]: referenceAngle }),
        ...(rotationBaseline === undefined ? {} : { [ITEM_MOTION_ROTATION_BASELINE]: rotationBaseline }),
      }, this.styleElement!.ownerDocument.defaultView?.devicePixelRatio ?? 1)
      const attributes = state.attr as Readonly<Record<string, unknown>> | undefined ?? {}
      const { 'data-item-id': itemId, ...visualAttributes } = attributes
      const fillsFrameWidth = visualStyle.width === '100%'
      const fillsFrameHeight = visualStyle.height === '100%'
      // The native style service formats the author rule; only motion writes inline frame
      // geometry. Captures reveal the current rule when they release their contributions.
      const styleElement = this.styleElement!
      this.services.apply(styleElement, { style: frameStyle })
      const rule = `#${this.frameId} { ${styleElement.style.cssText} }`
      if (styleElement.textContent !== rule) styleElement.textContent = rule
      this.services.apply(this.node, {
        className: this.perso.initial.editorFrameClassName,
        attr: { 'data-item-id': itemId },
      })
      const previewTransformStyle = typeof previewTransform === 'string'
        ? {
          position: 'absolute',
          left: '0px',
          top: '0px',
          width: typeof previewWidth === 'string' ? previewWidth : '100%',
          height: typeof previewHeight === 'string' ? previewHeight : '100%',
          scale: 'none',
          translate: 'none',
          transform: previewTransform,
          'transform-origin': '0px 0px',
        }
        : {
          position: 'absolute',
          left: '0px',
          top: '0px',
          width: '100%',
          height: '100%',
          scale: motionTransformStyle.scale ?? 'none',
          transform: motionTransformStyle.transform ?? 'none',
          translate: motionTransformStyle.translate ?? 'none',
          'transform-origin': motionTransformStyle['transform-origin'] ?? '50% 50%',
        }
      this.services.apply(this.transformAnchor, { style: {
        ...previewTransformStyle,
      } })
      this.transformAnchor!.style.transform = typeof previewTransform === 'string'
        ? previewTransform
        : typeof motionTransformStyle.transform === 'string' ? motionTransformStyle.transform : 'none'
      recordItemTransformProjection(this.transformAnchor!, rotationOrigin)
      const anchorLeft = fillsFrameWidth ? '0px' : '50%'
      const anchorTop = fillsFrameHeight ? '0px' : '50%'
      this.services.apply(this.visualAnchor, { style: {
        position: 'absolute',
        width: fillsFrameWidth ? '100%' : 'max-content',
        height: fillsFrameHeight ? '100%' : 'max-content',
        left: anchorLeft,
        top: anchorTop,
        'transform-origin': '0 0',
        transform: `translate(${fillsFrameWidth ? '0' : '-50%'},${fillsFrameHeight ? '0' : '-50%'})`,
      } })
      this.native.update({
        ...input,
        state: {
          ...state,
          style: visualStyle,
          attr: { ...visualAttributes, 'data-editor-visual-for': this.perso.id },
        },
      })
    }

    /** Preserves native seek preparation. */
    override beforeSeek(): void { this.native.beforeSeek() }
    /** Preserves native seek completion. */
    override afterSeek(): void { this.native.afterSeek() }
    /** Preserves native end-of-sequence cleanup. */
    override onSequenceEnd(): void { this.native.onSequenceEnd() }
    /** Preserves native reset handling. */
    override onReset(): void { this.native.onReset() }
    /** Releases native resources through their existing owner. */
    override destroy(): void { this.native.destroy() }
  }
}
