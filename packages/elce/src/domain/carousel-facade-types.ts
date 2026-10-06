import type { DocumentCommand } from '../app/commands/document-command-types'
import type { CardImageFit, CardLayoutId, CarouselImagePosition, CarouselPlaybackMode, CarouselTransition, MediaType } from '../config/document-config-types'
import type { CarouselAspectRatio, CarouselContent } from './carousel-types'
import type { Bdc } from './document-types'
import type { CardTextField } from './card/card-types'
import type { ElceCatalogReference } from './catalog-types'
import type { ElceMediaImport } from './media-resource-types'

export interface ElceCarouselFacadeOptions {
  readonly dispatch: (command: DocumentCommand) => void
  readonly selectCard: (bdcId: string | null) => void
  readonly importMedia: (bdcId: string, mediaImport: ElceMediaImport) => void
}

export interface ElceCarouselEditorActions {
  readonly selectCard: (bdcId: string) => void
  readonly addCard: () => void
  readonly removeCard: (bdcId: string, selectedBdcId: string | null) => void
  readonly moveCard: (bdcId: string, index: number) => void
  readonly setDefaultViewDurationSeconds: (seconds: number) => void
  readonly setPlaybackMode: (mode: CarouselPlaybackMode) => void
  readonly setRepeatCount: (repeatCount: number) => void
  readonly setAspectRatio: (aspectRatio: CarouselAspectRatio) => void
  readonly setTransition: (transition: CarouselTransition) => void
  readonly setCardLayout: (bdcId: string, layoutId: CardLayoutId) => void
  readonly setCardDurationSeconds: (bdcId: string, seconds: number | null) => void
  readonly setCardText: (bdcId: string, field: CardTextField, value: string) => void
  readonly setCaption: (bdcId: string, value: string) => void
  readonly setImagePosition: (bdcId: string, imagePosition: CarouselImagePosition) => void
  readonly setImageFit: (bdcId: string, imageFit: CardImageFit) => void
  readonly attachCatalogReference: (bdcId: string, reference: ElceCatalogReference) => void
  readonly importMediaFile: (bdcId: string, file: File) => void
  readonly importMediaFiles: (bdcId: string, files: readonly File[]) => void
  readonly clearMedia: (bdcId: string) => void
  readonly deleteCarousel: () => void
}

export interface ElceCarouselEditorProps {
  readonly bdcId: string
  readonly content: CarouselContent
  readonly cards: readonly Bdc[]
  readonly selectedCardBdcId: string | null
  readonly mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly actions: ElceCarouselEditorActions
}
