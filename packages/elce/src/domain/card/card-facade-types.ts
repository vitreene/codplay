import type { DocumentCommand } from '../../app/commands/document-command-types'
import type { CardImageFit, CardLayoutId, CarouselImagePosition, MediaType } from '../../config/document-config-types'
import type { Bdc, BdcId } from '../document-types'
import type { CardTextField } from './card-types'
import type { ElceCatalogReference } from '../catalog-types'
import type { ElceMediaImport } from '../media-resource-types'
import type { ReactNode } from 'react'

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

export interface ElceCardEditorFieldsProps {
  readonly bdc: Bdc
  readonly mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly actions: ElceCardEditorActions
  readonly idPrefix: string
  readonly imageAspectRatio: Readonly<{ width: number; height: number }> | null
  readonly allowMultipleMediaFiles?: boolean
  readonly importMediaFiles?: (bdcId: BdcId, files: readonly File[]) => void
  readonly toolbarContent?: ReactNode
  readonly toolbarEnd?: ReactNode
}
