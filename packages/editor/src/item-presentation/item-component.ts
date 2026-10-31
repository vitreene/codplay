import { BaseHTMLComponent, type ComponentInput, type ComponentUpdateInput, type MaterializedPart } from 'codplay'
import { ITEM_PREVIEW_INVERSE_PROPERTY } from './item-preview'
import { projectItemStyle } from './item-style-projection'

let nextFrameId = 0

type NativeComponentClass<Initial extends Record<string, unknown>> = {
  new (input: ComponentInput<Initial>): BaseHTMLComponent<Initial>
  readonly declaredServices: readonly string[]
}

/** Reuses a native component inside one Editor-owned presentation, with one runtime identity. */
export function createItemComponent<Initial extends Record<string, unknown>>(NativeComponent: NativeComponentClass<Initial>) {
  return class ItemComponent extends BaseHTMLComponent<Initial> {
    static readonly declaredServices = NativeComponent.declaredServices
    readonly native: BaseHTMLComponent<Initial>
    private readonly frameId = `editor-item-frame-${++nextFrameId}`
    private styleElement: HTMLStyleElement | null = null
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
        <div id="${this.frameId}-visual" data-part="editor-item-visual">${this.native.render()}</div>
      </div>`
    }

    /** Binds the existing native owner to its private root without publishing a second target. */
    override _materialize(rootNode: unknown, parts: readonly MaterializedPart[]): void {
      super._materialize(rootNode, parts)
      this.styleElement = this.getPart('editor-item-style') as HTMLStyleElement
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
      const { [ITEM_PREVIEW_INVERSE_PROPERTY]: inverse, ...itemStyle } = style
      const { frameStyle, visualStyle } = projectItemStyle(itemStyle, this.styleElement!.ownerDocument.defaultView?.devicePixelRatio ?? 1)
      const attributes = state.attr as Readonly<Record<string, unknown>> | undefined ?? {}
      const { 'data-item-id': itemId, ...visualAttributes } = attributes
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
      const [fx, fy] = (styleElement.style.transformOrigin || '50% 50%')
        .split(/\s+/).map((value) => Number.parseFloat(value))
      this.services.apply(this.visualAnchor, { style: {
        position: 'absolute', width: 'max-content', height: 'max-content',
        left: inverse === undefined ? '50%' : '0px',
        top: inverse === undefined ? '50%' : '0px',
        'transform-origin': '0 0',
        transform: inverse === undefined ? 'translate(-50%,-50%)'
          : `${inverse} translate(${fx}%, ${fy}%) ${styleElement.style.transform} translate(${-fx!}%, ${-fy!}%)`,
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
