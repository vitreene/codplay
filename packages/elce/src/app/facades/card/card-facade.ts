import { CATALOG_REFERENCE } from '../../../config/document-config'
import type { CardLayoutId } from '../../../config/document-config-types'
import type { ElceCardEditorActions, ElceCardFacadeOptions } from './card-facade-types'
import type { CardContent, CardTextField } from '../../../domain/card/card-types'
import type { ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import type { Bdc, BdcId } from '../../../domain/document/document-types'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'
import { ElceCardService } from '../../../domain/card/card-service'

/** Routes shared standalone and Carousel Card edits through document commands. */
export class ElceCardFacade {
  private readonly dispatch: ElceCardFacadeOptions['dispatch']
  private readonly importMedia: ElceCardFacadeOptions['importMedia']
  private readonly mediaService = new ElceMediaResourceService()
  private readonly cardService = new ElceCardService()

  public constructor(options: ElceCardFacadeOptions) {
    this.dispatch = options.dispatch
    this.importMedia = options.importMedia
  }

  /** Creates editing actions for the Card BDCs in the supplied current document. */
  public createEditorActions(cards: readonly Bdc[]): ElceCardEditorActions {
    const updateCard = (bdcId: BdcId, transform: (current: CardContent) => CardContent): void => {
      const card = cards.find((candidate) => candidate.id === bdcId)?.card
      if (card == null) return
      this.dispatch({ type: 'bdc.card.update', bdcId, card: transform(card) })
    }
    return {
      setCardLayout: (targetBdcId, layoutId: CardLayoutId) => this.dispatch({ type: 'bdc.card.layout.set', bdcId: targetBdcId, layoutId }),
      setCardText: (targetBdcId, field: CardTextField, value: string) => {
        updateCard(targetBdcId, (current) => this.cardService.setTextField(current, field, value))
      },
      setCaption: (targetBdcId, value) => {
        updateCard(targetBdcId, (current) => ({ ...current, caption: value }))
      },
      setImagePosition: (targetBdcId, imagePosition) => {
        updateCard(targetBdcId, (current) => this.cardService.setImagePosition(current, imagePosition))
      },
      setImageFit: (targetBdcId, imageFit) => {
        updateCard(targetBdcId, (current) => this.cardService.setImageFit(current, imageFit))
      },
      attachCatalogReference: (targetBdcId, reference: ElceCatalogReference) => {
        this.attachCatalogReference(targetBdcId, reference)
      },
      importMediaFile: (targetBdcId, file) => {
        const mediaImport = this.mediaService.createImport(file)
        if (mediaImport !== null) this.importMedia(targetBdcId, mediaImport)
      },
      clearMedia: (targetBdcId) => this.dispatch({ type: 'bdc.card.media.set', bdcId: targetBdcId, mediaId: null }),
    }
  }

  /** Attaches an existing reusable media resource to the selected Card. */
  private attachCatalogReference(bdcId: BdcId, reference: ElceCatalogReference): void {
    if (reference.kind === CATALOG_REFERENCE.MEDIA) {
      this.dispatch({ type: 'bdc.card.media.set', bdcId, mediaId: reference.mediaId })
    }
  }
}
