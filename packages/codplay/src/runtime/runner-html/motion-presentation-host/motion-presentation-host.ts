import type {
  LayoutSnapshot,
  PresentationFrame,
} from '../../motion'
import { orderParentFirst } from '../motion-presentation'
import type { OverlayRevisionResolver } from '../motion-presentation'
import { createHtmlMotionStyleLayer } from '../motion-style-layer'
import { LocalMotionPresenter } from './local-presenter'
import type { HtmlMotionRootResolver } from './host-types'
import { OverlayMotionPresenter } from './overlay-presenter'

/** Commits one complete motion frame without owning temporal state. */
export class HtmlMotionPresentationHost {
  private readonly root: Element
  private readonly localPresenter: LocalMotionPresenter
  private readonly overlayPresenter: OverlayMotionPresenter

  /** Creates one item-indexed overlay resource host. */
  constructor(
    root: Element,
    resolveHandle: (itemId: string) => HTMLElement | undefined,
    resolveMotionRoot: HtmlMotionRootResolver = () => root,
  ) {
    this.root = root
    const transientStyles = createHtmlMotionStyleLayer(root)
    this.localPresenter = new LocalMotionPresenter(transientStyles)
    this.overlayPresenter = new OverlayMotionPresenter(
      root,
      resolveHandle,
      resolveMotionRoot,
      transientStyles,
    )
  }

  /** Removes the host-owned presentation so visible nodes expose natural geometry. */
  prepareNaturalCapture(): void {
    this.overlayPresenter.prepareNaturalCapture()
    this.localPresenter.prepareNaturalCapture()
  }

  /** Disables authored CSS transitions during one atomic logical seek. */
  prepareSeek(): void {
    this.root.setAttribute('data-codplay-motion-seek', '')
  }

  /** Restores authored CSS transition behavior after one seek commit. */
  completeSeek(): void {
    this.root.removeAttribute('data-codplay-motion-seek')
  }

  /** Releases every or selected transient presentation resource. */
  clearTransientPresentation(itemIds?: ReadonlySet<string>): void {
    if (itemIds === undefined) this.prepareNaturalCapture()
    this.overlayPresenter.clearTransientPresentation(itemIds)
    this.localPresenter.clearTransientPresentation(itemIds)
  }

  /** Applies exactly the source/overlay representation declared by one frame. */
  commit(
    frame: PresentationFrame,
    resolveRevision?: OverlayRevisionResolver,
    naturalLayout?: LayoutSnapshot,
  ): void {
    const directOverlayItemIds = new Set([...frame.items.values()]
      .filter((item) => item.representation === 'reparent')
      .map((item) => item.itemId))
    const activeOverlayItemIds = new Set(directOverlayItemIds)
    const localItemIds = new Set<string>()
    for (const item of frame.items.values()) {
      if (item.representation !== 'local') continue
      // A local descendant of a reparented item remains a local FLIP. Its
      // target is the matching descendant in the parent's ghost.
      localItemIds.add(item.itemId)
    }

    this.localPresenter.removeInactive(localItemIds)
    this.overlayPresenter.prepareFrame(
      frame,
      activeOverlayItemIds,
      resolveRevision,
      naturalLayout,
    )

    const orderedLocalItemIds = orderParentFirst(frame, localItemIds, naturalLayout)
    this.localPresenter.commit(
      frame,
      orderedLocalItemIds,
      directOverlayItemIds,
      naturalLayout,
      (itemId, currentFrame, overlayItemIds, layout) => this.overlayPresenter.resolveLocalTarget(
        itemId,
        currentFrame,
        overlayItemIds,
        layout,
      ),
      (itemId) => this.overlayPresenter.sourceFor(itemId),
    )
    this.overlayPresenter.applyFrame(frame, activeOverlayItemIds, naturalLayout)
  }

  /** Releases every overlay resource and restores all materialized sources. */
  destroy(): void {
    this.completeSeek()
    this.clearTransientPresentation()
  }
}
