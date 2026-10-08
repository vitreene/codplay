import { CAROUSEL_CONFIG, CARD_LAYOUT_IDS, DEFAULT_PRESET_ID, DEFAULT_PROJECT_REVELATION } from '../../../config/document-config'
import type { CardLayoutId } from '../../../config/document-config-types'
import { createCardBdcCommand } from '../../../domain/commands/document-commands'
import type { ElceCarouselEditorActions, ElceCarouselFacadeOptions } from './carousel-facade-types'
import type { CarouselContent } from '../../../domain/carousel/carousel-types'
import { createStableId } from '../../../domain/document/document-model'
import type { Bdc, BdcId, RevelationTransitionDefaults } from '../../../domain/document/document-types'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'
import { ElceCarouselService } from '../../../domain/carousel/carousel-service'
import { ElceCardFacade } from '../card/card-facade'

/** Routes Carousel and Card authoring intents through métier services and XState commands. */
export class ElceCarouselFacade {
  private readonly dispatch: ElceCarouselFacadeOptions['dispatch']
  private readonly selectCard: ElceCarouselFacadeOptions['selectCard']
  private readonly importMedia: ElceCarouselFacadeOptions['importMedia']
  private readonly carouselService = new ElceCarouselService()
  private readonly cardFacade: ElceCardFacade
  private readonly mediaService = new ElceMediaResourceService()

  public constructor(options: ElceCarouselFacadeOptions) {
    this.dispatch = options.dispatch
    this.selectCard = options.selectCard
    this.importMedia = options.importMedia
    this.cardFacade = new ElceCardFacade(options)
  }

  /** Creates actions bound to the current Carousel settings and Card BDCs. */
  public createEditorActions(
    bdcId: BdcId,
    content: CarouselContent,
    cards: readonly Bdc[],
    revelationDefaults: RevelationTransitionDefaults = DEFAULT_PROJECT_REVELATION,
  ): ElceCarouselEditorActions {
    const updateCarousel = (carousel: CarouselContent): void => this.dispatch({ type: 'bdc.carousel.update', bdcId, carousel })
    const updateCarouselFrom = (transform: (current: CarouselContent) => CarouselContent): void => updateCarousel(transform(content))
    const cardActions = this.cardFacade.createEditorActions(cards)
    /** Imports one supported file through the controller's serialized media queue. */
    const importMediaFile = (cardBdcId: BdcId, file: File): void => {
      const mediaImport = this.mediaService.createImport(file)
      if (mediaImport !== null) this.importMedia(cardBdcId, mediaImport)
    }
    /** Creates ordered Card BDCs for a multi-file import and queues each media. */
    const importMediaFiles = (cardBdcId: BdcId, files: readonly File[]): void => {
      if (files.length === 0) return
      if (files.length === 1) {
        const file = files[0]
        if (file !== undefined) importMediaFile(cardBdcId, file)
        return
      }
      const targetCard = cards.find((candidate) => candidate.id === cardBdcId)
      const targetIndex = content.cards.findIndex((entry) => entry.bdcId === cardBdcId)
      if (targetCard?.type !== 'card' || targetCard.card == null || targetIndex < 0
        || !CARD_LAYOUT_IDS.includes(targetCard.presetId as CardLayoutId)) return
      const mediaImports = files.flatMap((file) => {
        const mediaImport = this.mediaService.createImport(file)
        return mediaImport === null ? [] : [mediaImport]
      })
      if (mediaImports.length === 0) return
      if (mediaImports.length === 1) {
        this.importMedia(cardBdcId, mediaImports[0]!)
        return
      }
      const cardBdcIds = [cardBdcId]
      const initialCardOptions = {
        imagePosition: targetCard.card.imagePosition,
        imageFit: targetCard.card.imageFit,
      }
      for (let index = 1; index < mediaImports.length; index += 1) {
        const nextCardBdcId = createStableId('bdc-card')
        this.dispatch(createCardBdcCommand(
          nextCardBdcId,
          bdcId,
          targetIndex + index,
          targetCard.presetId as CardLayoutId,
          initialCardOptions,
        ))
        cardBdcIds.push(nextCardBdcId)
      }
      mediaImports.forEach((mediaImport, index) => {
        const targetBdcId = cardBdcIds[index]
        if (targetBdcId !== undefined) this.importMedia(targetBdcId, mediaImport)
      })
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
        this.dispatch({ type: 'bdc.card.delete', bdcId: cardBdcId })
        if (selectedBdcId === cardBdcId) this.selectCard(next.cards[0]?.bdcId ?? null)
      },
      moveCard: (cardBdcId, index) => updateCarouselFrom((current) => this.carouselService.moveCard(current, cardBdcId, index)),
      setDefaultViewDurationSeconds: (seconds) => updateCarouselFrom((current) => this.carouselService.setDefaultViewDuration(current, seconds * 1000)),
      setPlaybackMode: (mode) => updateCarouselFrom((current) => this.carouselService.setPlaybackMode(current, mode)),
      setRepeatCount: (count) => updateCarouselFrom((current) => this.carouselService.setRepeatCount(current, count)),
      setAspectRatio: (aspectRatio) => updateCarouselFrom((current) => this.carouselService.setAspectRatio(current, aspectRatio)),
      setTransition: (transition) => updateCarouselFrom((current) => this.carouselService.setTransition(current, transition)),
      transitionPreset: this.carouselService.transitionPreset(content, revelationDefaults),
      setCardDurationSeconds: (cardBdcId, seconds) => updateCarouselFrom((current) => this.carouselService.setCardDuration(current, cardBdcId, seconds === null ? null : seconds * 1000)),
      ...cardActions,
      importMediaFiles,
      deleteCarousel: () => this.dispatch({ type: 'bdc.carousel.delete', bdcId }),
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

/** Creates a stable identity for a new Carousel BDC outside the editor view. */
export function createCarouselBdcId(): BdcId {
  return createStableId('bdc-carousel')
}
