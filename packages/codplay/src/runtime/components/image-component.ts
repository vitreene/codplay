import { BaseComponent } from './lib/base-component'
import { setImageAlt, setImageFitMode, setImageSource } from './lib/dom'
import { applyClassNamePatch, isDomElement } from './lib/dom-component-adapter'
import { injectBaseStyle } from './lib/inject-base-style'
import type { ImageFitMode } from './lib/dom'
import { RUNTIME_CONFIG } from '../config'
import type { PersoActionCommon, PersoInitialCommon, PersoInnerNodePatch } from '../perso-shared-types'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from './types'

export type ImgInitial = PersoInitialCommon & {
  src?: unknown
  alt?: unknown
  fitMode?: unknown
  img?: PersoInnerNodePatch
}

export type ImgAction = PersoActionCommon & {
  src?: unknown
  alt?: unknown
  fitMode?: unknown
  img?: PersoInnerNodePatch
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
 * Image component backed by one persistent <img> per distinct src (node-per-src).
 *
 * The src of a media element is a side-effectful resource (assigning it restarts decode),
 * so it cannot be reset/replayed like a style. Instead each authored src gets its own <img>,
 * created and decoded once, kept in a map. The component state is *which node is attached*
 * to the root — a structural, side-effect-free state that resets in render() and replays in
 * update() exactly like any other reconstructable state. The src itself is never reassigned;
 * switching image = detach the current node, attach the target node (its decode is preserved).
 *
 * Because exactly one <img> is attached at any time, the replace transitions (which clone the
 * root or read `querySelector('img')`) keep working unchanged.
 */
export class ImageComponent extends BaseComponent {
  /** One persistent, decoded <img> per src. Inactive nodes are detached but retained here. */
  private readonly mediaBySrc = new Map<string, unknown>()
  /** The src whose node is currently attached to the root. */
  private activeSrc: string | null = null

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
   * Collects the statically declared srcs of this perso (initial + actions). These are the
   * media preloaded for the scene — the static source of truth for the node collection.
   */
  private staticSrcs(): string[] {
    const srcs: string[] = []
    const initial = this.perso.initial as ImgInitial
    if (typeof initial.src === 'string') {
      srcs.push(initial.src)
    }
    const actions = (this.perso.actions ?? {}) as Record<string, unknown>
    for (const action of Object.values(actions)) {
      if (action !== null && typeof action === 'object' && !Array.isArray(action)) {
        const src = (action as Record<string, unknown>).src
        if (typeof src === 'string') {
          srcs.push(src)
        }
      }
    }
    return srcs
  }

  /**
   * Returns the persistent node for one src, creating it (and decoding it once) on first use.
   * A src outside the static set warns the author: all scene media should be preloaded.
   */
  private ensureMediaNode(src: string): unknown {
    const existing = this.mediaBySrc.get(src)
    if (existing !== undefined) {
      return existing
    }

    if (!this.staticSrcs().includes(src)) {
      this.report(
        'AUTHOR_IMAGE_SRC_NOT_PRELOADED',
        'Image src is not in the perso static set; all scene media should be preloaded',
        { src }
      )
    }

    const node =
      typeof globalThis.document !== 'undefined'
        ? globalThis.document.createElement('img')
        : ({ tagName: 'IMG', style: {}, attributes: {} } as unknown)

    setImageSource(node, src)
    this.applyMediaProps(node, this.perso.initial as ImgInitial)
    this.mediaBySrc.set(src, node)
    return node
  }

  /**
   * Applies the non-src media props (alt, fitMode, authored img styles, base class) on one node.
   * The src is never applied here — it is assigned once at node creation.
   */
  private applyMediaProps(node: unknown, state: ImgInitial | ImgAction): void {
    if (typeof state.alt === 'string') {
      setImageAlt(node, state.alt)
    }

    const fitMode = resolveImageFitMode(state.fitMode)
    if (fitMode !== null) {
      setImageFitMode(node, fitMode)
    }

    if (state.img !== null && typeof state.img === 'object') {
      this.services.apply(node, state.img as Record<string, unknown>)
    }

    applyClassNamePatch(node, { add: IMG_BASE_CLASS })
  }

  /**
   * Makes the node for one src the single attached child of the root: detaches the previously
   * active node and attaches the target one. No src reassignment, so no decode restart.
   */
  private setActiveSrc(rootNode: unknown, src: string): void {
    const node = this.ensureMediaNode(src)

    const previous =
      this.activeSrc !== null ? this.mediaBySrc.get(this.activeSrc) : undefined
    if (previous !== undefined && previous !== node && isDomElement(previous)) {
      previous.remove()
    }

    if (isDomElement(rootNode) && isDomElement(node) && node.parentNode !== rootNode) {
      rootNode.appendChild(node)
    }

    this.activeSrc = src
    this.setPart(MEDIA, node)
  }

  /**
   * Applies one resolved runtime action: switches the attached node when the action carries a
   * src, and applies any non-src media props on the active node.
   */
  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
    const action = input.action as ImgAction
    if (typeof action.src === 'string') {
      this.setActiveSrc(this.node, action.src)
    }
    this.applyMediaProps(this.getPart(MEDIA), action)
  }

  /**
   * Builds the root and resets the attached node to the authored initial src. On refresh
   * (seek/rewind) the root is reused and this reset re-attaches the initial node — the reset
   * step of the seek cycle, side-effect-free (no src reassignment).
   */
  render(): ComponentRenderResult {
    const rootNode = this.buildNode('<div></div>')
    this.services.apply(rootNode, this.perso.initial)

    const initialSrc = (this.perso.initial as ImgInitial).src
    if (typeof initialSrc === 'string') {
      this.setActiveSrc(rootNode, initialSrc)
    }

    return rootNode as Node
  }
}
