import type { CardEditCommand } from './card-command-types'
import type { CardImageFit, CardLayoutId } from '../card-config'
import type { CarouselImagePosition } from '../../carousel/carousel-config'
import type { BdcId } from '../../../../core/document/content-document-types'
import type { CardContent, CardTextField } from '../domain/card-types'
import type { ElceCatalogReference } from '../../../../core/catalog/catalog-types'
import type { ElceMediaImport } from '../../../../domain/media/media-resource-types'
import type { ElceTextValue } from '../../../document/rich-text-types'
import type { RevelationTransitionOverrides } from '../../../revelation/revelation-types'
import type { ListContent } from '../../../list/domain/list-types'
import type { ListCommand } from '../../../list/authoring/list-command-types'

export interface ElceCardFacadeOptions {
  readonly dispatch: (command: CardEditCommand) => void
  readonly insertListBdc?: (command: ListCommand) => void
  readonly getCard: (bdcId: BdcId) => CardContent | null
  readonly importMedia: (bdcId: BdcId, mediaImport: ElceMediaImport) => void
}

export interface ElceCardEditorActions {
  readonly setCardLayout: (bdcId: BdcId, layoutId: CardLayoutId) => void
  readonly setCardText: (bdcId: BdcId, field: CardTextField, value: ElceTextValue) => void
  readonly setCaption: (bdcId: BdcId, value: ElceTextValue) => void
  readonly setImagePosition: (bdcId: BdcId, imagePosition: CarouselImagePosition) => void
  readonly setImageFit: (bdcId: BdcId, imageFit: CardImageFit) => void
  readonly setRevelation: (bdcId: BdcId, revelation: RevelationTransitionOverrides) => void
  readonly setList: (bdcId: BdcId, list: ListContent) => void
  readonly insertListBdc?: (bdcId: BdcId, listBdcId: BdcId, message: import('../../../document/rich-text-types').RichTextDocument, list: ListContent) => void
  readonly updateListBdc?: (bdcId: BdcId, list: ListContent) => void
  readonly attachCatalogReference: (bdcId: BdcId, reference: ElceCatalogReference) => void
  readonly importMediaFile: (bdcId: BdcId, file: File) => void
  readonly clearMedia: (bdcId: BdcId) => void
}
