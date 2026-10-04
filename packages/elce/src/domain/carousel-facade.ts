import { CAROUSEL_CONFIG, CATALOG_REFERENCE, DEFAULT_PRESET_ID } from '../config/document-config'
import type { CarouselCardPresetId } from '../config/document-config-types'
import type { ElceCarouselEditorActions, ElceCarouselFacadeOptions } from './carousel-facade-types'
import type { CarouselContent } from './carousel-types'
import type { ElceCatalogReference } from './catalog-types'
import { createStableId } from './document-model'
import type { BdcId } from './document-types'
import { ElceMediaResourceService } from './media-resource-service'
import { ElceCarouselService } from './carousel-service'

/** Routes Carousel authoring intents through métier services and XState commands. */
export class ElceCarouselFacade {
  private readonly dispatch: ElceCarouselFacadeOptions['dispatch']
  private readonly selectView: ElceCarouselFacadeOptions['selectView']
  private readonly importMedia: ElceCarouselFacadeOptions['importMedia']
  private readonly carouselService = new ElceCarouselService()
  private readonly mediaService = new ElceMediaResourceService()

  public constructor(options: ElceCarouselFacadeOptions) {
    this.dispatch = options.dispatch
    this.selectView = options.selectView
    this.importMedia = options.importMedia
  }

  /** Creates editor actions that apply the service to one current Carousel value. */
  public createEditorActions(bdcId: BdcId, content: CarouselContent): ElceCarouselEditorActions {
    const update = (carousel: CarouselContent): void => this.dispatch({ type: 'bdc.carousel.update', bdcId, carousel })
    const updateFrom = (transform: (current: CarouselContent) => CarouselContent): void => update(transform(content))
    return {
      selectView: (viewId) => this.selectView(viewId),
      addView: () => {
        const next = this.carouselService.addView(content)
        update(next)
        this.selectView(next.views[next.views.length - 1]?.id ?? null)
      },
      removeView: (viewId, selectedViewId) => {
        const next = this.carouselService.removeView(content, viewId)
        if (next.views.length === 0) return
        update(next)
        if (selectedViewId === viewId) {
          this.selectView(next.views[0]?.id ?? null)
        }
      },
      moveView: (viewId, index) => update(this.carouselService.moveView(content, viewId, index)),
      setDefaultViewDurationSeconds: (seconds) => updateFrom((current) => this.carouselService.setDefaultViewDuration(current, seconds * 1000)),
      setPlaybackMode: (mode) => updateFrom((current) => this.carouselService.setPlaybackMode(current, mode)),
      setRepeatCount: (count) => updateFrom((current) => this.carouselService.setRepeatCount(current, count)),
      setAspectRatio: (aspectRatio) => updateFrom((current) => this.carouselService.setAspectRatio(current, aspectRatio)),
      setTransition: (transition) => updateFrom((current) => this.carouselService.setTransition(current, transition)),
      setViewPreset: (viewId, presetId) => updateFrom((current) => this.carouselService.changeViewPreset(current, viewId, presetId)),
      setViewDurationSeconds: (viewId, seconds) => updateFrom((current) => this.carouselService.setViewDuration(current, viewId, seconds === null ? null : seconds * 1000)),
      setShortText: (viewId, field, value) => updateFrom((current) => this.carouselService.setShortText(current, viewId, field, value)),
      setCaption: (viewId, value) => updateFrom((current) => this.carouselService.setCaption(current, viewId, value)),
      setImagePosition: (viewId, imagePosition) => updateFrom((current) => this.carouselService.setImagePosition(current, viewId, imagePosition)),
      attachCatalogReference: (viewId, reference) => this.attachCatalogReference(bdcId, viewId, reference),
      importMediaFile: (viewId, file) => {
        const mediaImport = this.mediaService.createImport(file)
        switch (mediaImport) {
          case null:
            return
          default:
            this.importMedia(bdcId, viewId, mediaImport)
        }
      },
      clearMedia: (viewId) => this.dispatch({ type: 'bdc.carousel.media.set', bdcId, viewId, mediaId: null }),
      deleteCarousel: () => this.dispatch({ type: 'bdc.carousel.delete', bdcId }),
    }
  }

  /** Resolves media catalog references without treating reusable media as BDCs. */
  private attachCatalogReference(bdcId: BdcId, viewId: string, reference: ElceCatalogReference): void {
    switch (reference.kind) {
      case CATALOG_REFERENCE.MEDIA:
        this.dispatch({ type: 'bdc.carousel.media.set', bdcId, viewId, mediaId: reference.mediaId })
        return
      case CATALOG_REFERENCE.BDC:
        return
    }
  }
}

/** Converts the initial shared duration to seconds for author-facing controls. */
export function defaultCarouselDurationSeconds(): number {
  return CAROUSEL_CONFIG.defaultViewDurationMs / 1000
}

/** Returns whether one card preset can contain a reusable media reference. */
export function carouselPresetHasMedia(presetId: CarouselCardPresetId): boolean {
  switch (presetId) {
    case DEFAULT_PRESET_ID.PHOTO:
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return true
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return false
  }
}

/** Creates a stable identity for a new Carousel BDC outside the React view. */
export function createCarouselBdcId(): BdcId {
  return createStableId('bdc-carousel')
}
