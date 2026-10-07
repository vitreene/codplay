import type { DocumentCommand } from '../../../domain/commands/document-command-types'
import type { CardImageFit, CardLayoutId, CarouselImagePosition } from '../../../config/document-config-types'
import type { BdcId } from '../../../domain/document/document-types'
import type { CardTextField } from '../../../domain/card/card-types'
import type { ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import type { ElceMediaImport } from '../../../domain/media/media-resource-types'

export interface ElceCardFacadeOptions {
  readonly dispatch: (command: DocumentCommand) => void
  readonly importMedia: (bdcId: BdcId, mediaImport: ElceMediaImport) => void
}

export interface ElceCardEditorActions {
  readonly setCardLayout: (bdcId: BdcId, layoutId: CardLayoutId) => void
  readonly setCardText: (bdcId: BdcId, field: CardTextField, value: string) => void
  readonly setCaption: (bdcId: BdcId, value: string) => void
  readonly setImagePosition: (bdcId: BdcId, imagePosition: CarouselImagePosition) => void
  readonly setImageFit: (bdcId: BdcId, imageFit: CardImageFit) => void
  readonly attachCatalogReference: (bdcId: BdcId, reference: ElceCatalogReference) => void
  readonly importMediaFile: (bdcId: BdcId, file: File) => void
  readonly clearMedia: (bdcId: BdcId) => void
}
