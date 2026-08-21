import { isPlainRecord } from '../../shared'
import type { ValidationFunction } from '../../services'
import { reportInvalidServiceValue } from '../../services/service-validation-report'
import type { AttrValue, ClassNameValue, StyleValue } from '../../services'
import { BaseComponent } from './base-component'
import type { ComponentInput, ComponentUpdateInput } from './component-types'

/** Initial state accepted by the V2 HTML media component. */
export type MediaInitial = Readonly<{
  src: string
  tag?: 'video'
  controls?: boolean
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Resolved state accepted by one media update. */
export type MediaState = Readonly<{
  src: string
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}>

/** Validates the source and template options declared by one media perso. */
export const validateMediaInitial: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value) || typeof value.src !== 'string' || value.src.length === 0) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SRC_INVALID', 'media.src must be a non-empty string.', context)
    return
  }
  if (value.tag !== undefined && value.tag !== 'video') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_TAG_INVALID', 'media.tag only accepts "video".', context)
  }
  if (value.controls !== undefined && typeof value.controls !== 'boolean') {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_CONTROLS_INVALID', 'media.controls must be a boolean.', context)
  }
}

/** Validates a source replacement carried by one media action. */
export const validateMediaAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value) || value.src === undefined) return
  if (typeof value.src !== 'string' || value.src.length === 0) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_MEDIA_SRC_INVALID', 'media action src must be a non-empty string.', context)
  }
}

/** V2 media component that preserves one materialized video node per source. */
export class MediaComponent extends BaseComponent<MediaInitial> {
  /** One persistent video node per source; inactive nodes remain detached here. */
  private readonly mediaBySrc = new Map<string, unknown>()
  /** Source currently attached to the component root. */
  private activeSrc: string | null = null

  /** Creates one media component with its declared core services. */
  constructor(input: ComponentInput<MediaInitial>) {
    super(input)
  }

  /** Returns the authored media wrapper; video nodes belong to this component's private media part. */
  render(): string {
    return '<div class="codplay-media-root"></div>'
  }

  /** Applies root services and selects the persistent video node for the resolved source. */
  update(input: ComponentUpdateInput<MediaState>): void {
    if (this.node === null) throw new Error(`Media component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
    this.setActiveSource(input.state.src)
  }

  /** Creates or reuses one source node and attaches it as the sole media child. */
  private setActiveSource(src: string): void {
    const root = this.node
    if (!isParentNode(root)) return
    const active = this.ensureNodeForSource(src)
    if (!isNode(active)) return
    const previous = this.activeSrc === null ? undefined : this.mediaBySrc.get(this.activeSrc)
    if (isNode(previous) && previous !== active && previous.parentNode === root) root.removeChild(previous)
    if (active.parentNode !== root) root.appendChild(active)
    this.activeSrc = src
  }

  /** Returns one cached source node, assigning its source only at first creation. */
  private ensureNodeForSource(src: string): unknown {
    const existing = this.mediaBySrc.get(src)
    if (existing !== undefined) return existing
    const node = createMediaNode()
    setMediaSource(node, src)
    if (this.perso.initial.controls === true) setVideoControls(node)
    this.mediaBySrc.set(src, node)
    return node
  }
}

/** Creates one internal video node for the component's private media part. */
function createMediaNode(): unknown {
  if (typeof globalThis.document !== 'undefined') return globalThis.document.createElement('video')
  return { tagName: 'VIDEO', parentNode: null, src: '' }
}

/** Assigns one source exactly once to a freshly created media node. */
function setMediaSource(node: unknown, src: string): void {
  if (typeof node !== 'object' || node === null) return
  ;(node as { src?: string }).src = src
}

/** Applies the fixed author option to each source node when it is created. */
function setVideoControls(node: unknown): void {
  if (typeof node !== 'object' || node === null) return
  const candidate = node as { setAttribute?: (name: string, value: string) => void }
  candidate.setAttribute?.('controls', '')
}

/** Checks the DOM-like parent surface needed by source selection. */
function isParentNode(value: unknown): value is {
  appendChild: (child: unknown) => unknown
  removeChild: (child: unknown) => unknown
} {
  return typeof value === 'object'
    && value !== null
    && 'appendChild' in value
    && typeof value.appendChild === 'function'
    && 'removeChild' in value
    && typeof value.removeChild === 'function'
}

/** Checks the DOM-like node surface needed by source selection. */
function isNode(value: unknown): value is { parentNode: unknown } {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}
