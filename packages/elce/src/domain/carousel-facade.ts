import { CAROUSEL_CONFIG, CARD_LAYOUT_IDS, CATALOG_REFERENCE, DEFAULT_PRESET_ID } from '../config/document-config'
import type { CardLayoutId } from '../config/document-config-types'
import { createCardBdcCommand } from '../app/commands/document-commands'
import type { ElceCarouselEditorActions, ElceCarouselFacadeOptions } from './carousel-facade-types'
import type { CarouselContent } from './carousel-types'
import type { CardContent, CardTextField } from './card/card-types'
import type { ElceCatalogReference } from './catalog-types'
import { createStableId } from './document-model'
import type { Bdc, BdcId } from './document-types'
import { ElceMediaResourceService } from './media-resource-service'
import { ElceCarouselService } from './carousel-service'
import { ElceCardService } from './card/card-service'

/** Routes Carousel and Card authoring intents through métier services and XState commands. */
export class ElceCarouselFacade {
  private readonly dispatch: ElceCarouselFacadeOptions['dispatch']
  private readonly selectCard: ElceCarouselFacadeOptions['selectCard']
  private readonly importMedia: ElceCarouselFacadeOptions['importMedia']
  private readonly carouselService = new ElceCarouselService()
  private readonly cardService = new ElceCardService()
  private readonly mediaService = new ElceMediaResourceService()

  public constructor(options: ElceCarouselFacadeOptions) {
    this.dispatch = options.dispatch
    this.selectCard = options.selectCard
    this.importMedia = options.importMedia
  }

  /** Creates actions bound to the current Carousel settings and Card BDCs. */
  public createEditorActions(
    bdcId: BdcId,
    content: CarouselContent,
    cards: readonly Bdc[],
  ): ElceCarouselEditorActions {
    const updateCarousel = (carousel: CarouselContent): void => this.dispatch({ type: 'bdc.carousel.update', bdcId, carousel })
    const updateCarouselFrom = (transform: (current: CarouselContent) => CarouselContent): void => updateCarousel(transform(content))
    const updateCard = (cardBdcId: BdcId, transform: (current: CardContent) => CardContent): void => {
      const currentCard = cards.find((candidate) => candidate.id === cardBdcId)?.card
      if (currentCard == null) return
      this.dispatch({ type: 'bdc.card.update', bdcId: cardBdcId, card: transform(currentCard) })
    }
    return {
      selectCard: (cardBdcId) => this.selectCard(cardBdcId),
      addCard: () => {
        const cardBdcId = createStableId('bdc-card')
        const previousCardBdcId = content.cards.at(-1)?.bdcId
        const previousCard = cards.find((candidate) => candidate.id === previousCardBdcId)
        const previousCardLayoutId = previousCard?.type === 'card'
          && CARD_LAYOUT_IDS.includes(previousCard.presetId as CardLayoutId)
          ? previousCard.presetId as CardLayoutId
          : CAROUSEL_CONFIG.initialCardLayoutId
        const initialCardOptions = previousCard?.type === 'card' && previousCard.card != null
          ? { imagePosition: previousCard.card.imagePosition, imageFit: previousCard.card.imageFit }
          : undefined
        this.dispatch(createCardBdcCommand(
          cardBdcId,
          bdcId,
          content.cards.length,
          previousCardLayoutId,
          initialCardOptions,
        ))
        this.selectCard(cardBdcId)
      },
      removeCard: (cardBdcId, selectedBdcId) => {
        const next = this.carouselService.removeCard(content, cardBdcId)
        if (next === content) return
        this.dispatch({ type: 'bdc.carousel.card.delete', bdcId: cardBdcId })
        if (selectedBdcId === cardBdcId) this.selectCard(next.cards[0]?.bdcId ?? null)
      },
      moveCard: (cardBdcId, index) => updateCarouselFrom((current) => this.carouselService.moveCard(current, cardBdcId, index)),
      setDefaultViewDurationSeconds: (seconds) => updateCarouselFrom((current) => this.carouselService.setDefaultViewDuration(current, seconds * 1000)),
      setPlaybackMode: (mode) => updateCarouselFrom((current) => this.carouselService.setPlaybackMode(current, mode)),
      setRepeatCount: (count) => updateCarouselFrom((current) => this.carouselService.setRepeatCount(current, count)),
      setAspectRatio: (aspectRatio) => updateCarouselFrom((current) => this.carouselService.setAspectRatio(current, aspectRatio)),
      setTransition: (transition) => updateCarouselFrom((current) => this.carouselService.setTransition(current, transition)),
      setCardLayout: (cardBdcId, layoutId) => this.dispatch({ type: 'bdc.card.layout.set', bdcId: cardBdcId, layoutId }),
      setCardDurationSeconds: (cardBdcId, seconds) => updateCarouselFrom((current) => this.carouselService.setCardDuration(current, cardBdcId, seconds === null ? null : seconds * 1000)),
      setCardText: (cardBdcId, field: CardTextField, value) => updateCard(cardBdcId, (current) => this.cardService.setTextField(current, field, value)),
      setCaption: (cardBdcId, value) => updateCard(cardBdcId, (current) => ({ ...current, caption: value })),
      setImagePosition: (cardBdcId, imagePosition) => updateCard(cardBdcId, (current) => this.cardService.setImagePosition(current, imagePosition)),
      setImageFit: (cardBdcId, imageFit) => updateCard(cardBdcId, (current) => this.cardService.setImageFit(current, imageFit)),
      attachCatalogReference: (cardBdcId, reference) => this.attachCatalogReference(cardBdcId, reference),
      importMediaFile: (cardBdcId, file) => {
        const mediaImport = this.mediaService.createImport(file)
        if (mediaImport !== null) this.importMedia(cardBdcId, mediaImport)
      },
      clearMedia: (cardBdcId) => this.dispatch({ type: 'bdc.card.media.set', bdcId: cardBdcId, mediaId: null }),
      deleteCarousel: () => this.dispatch({ type: 'bdc.carousel.delete', bdcId }),
    }
  }

  /** Assigns a reusable media resource to one Card BDC. */
  private attachCatalogReference(bdcId: BdcId, reference: ElceCatalogReference): void {
    if (reference.kind === CATALOG_REFERENCE.MEDIA) {
      this.dispatch({ type: 'bdc.card.media.set', bdcId, mediaId: reference.mediaId })
    }
  }
}

/** Converts the configured common duration to seconds for author-facing controls. */
export function defaultCarouselDurationSeconds(): number {
  return CAROUSEL_CONFIG.defaultViewDurationMs / 1000
}

/** Returns whether a Card layout projects a media field. */
export function cardLayoutHasMedia(layoutId: CardLayoutId): boolean {
  return layoutId !== DEFAULT_PRESET_ID.TEXT_SHORT
}

/** Creates a stable identity for a new Carousel BDC outside the React view. */
export function createCarouselBdcId(): BdcId {
  return createStableId('bdc-carousel')
}
