import { CATALOG_REFERENCE } from '../../../../core/catalog/catalog-config'
import type { CardLayoutId } from '../card-config'
import type { ElceCardEditorActions, ElceCardFacadeOptions } from './card-facade-types'
import type { CardContent, CardTextField } from '../domain/card-types'
import type { ElceCatalogReference } from '../../../../core/catalog/catalog-types'
import type { BdcId } from '../../../../core/document/content-document-types'
import { ElceMediaResourceService } from '../../../../domain/media/media-resource-service'
import { ElceCardService } from '../domain/card-service'
import type { ElceTextValue } from '../../../document/rich-text-types'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { ListContent } from '../../../list/domain/list-types'

/** Routes shared standalone and Carousel Card edits through document commands. */
export class ElceCardFacade {
  private readonly dispatch: ElceCardFacadeOptions['dispatch']
  private readonly getCard: ElceCardFacadeOptions['getCard']
  private readonly importMedia: ElceCardFacadeOptions['importMedia']
  private readonly mediaService = new ElceMediaResourceService()
  private readonly cardService = new ElceCardService()

  public constructor(options: ElceCardFacadeOptions) {
    this.dispatch = options.dispatch
    this.getCard = options.getCard
    this.importMedia = options.importMedia
  }

  /** Creates editing actions that read each Card from the current document. */
  public createEditorActions(): ElceCardEditorActions {
    /** Applies one Card field transformation to the latest stored content. */
    const updateCard = (bdcId: BdcId, transform: (current: CardContent) => CardContent): void => {
      const card = this.getCard(bdcId)
      if (card == null) return
      this.dispatch({ type: 'bdc.card.update', bdcId, card: transform(card) })
    }
    return {
      setCardLayout: (targetBdcId, layoutId: CardLayoutId) => this.dispatch({ type: 'bdc.card.layout.set', bdcId: targetBdcId, layoutId }),
      setCardText: (targetBdcId, field: CardTextField, value: ElceTextValue) => {
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
      setRevelation: (targetBdcId, revelation: RevelationTransitionOverrides) => {
        updateCard(targetBdcId, (current) => this.cardService.setRevelation(current, revelation))
      },
      setList: (targetBdcId, list: ListContent) => {
        updateCard(targetBdcId, (current) => this.cardService.setList(current, list))
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
