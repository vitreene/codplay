import type { DocumentCommand } from '../app/commands/document-command-types'
import type { CarouselCardPresetId, CarouselImagePosition, CarouselPlaybackMode, CarouselTransition } from '../config/document-config-types'
import type { MediaType } from '../config/document-config-types'
import type { CarouselAspectRatio, CarouselContent, CarouselShortText } from './carousel-types'
import type { ElceCatalogReference } from './catalog-types'
import type { ElceMediaImport } from './media-resource-types'

export interface ElceCarouselFacadeOptions {
  readonly dispatch: (command: DocumentCommand) => void
  readonly selectView: (viewId: string | null) => void
  readonly importMedia: (bdcId: string, viewId: string, mediaImport: ElceMediaImport) => void
}

export interface ElceCarouselEditorActions {
  readonly selectView: (viewId: string) => void
  readonly addView: () => void
  readonly removeView: (viewId: string, selectedViewId: string | null) => void
  readonly moveView: (viewId: string, index: number) => void
  readonly setDefaultViewDurationSeconds: (seconds: number) => void
  readonly setPlaybackMode: (mode: CarouselPlaybackMode) => void
  readonly setRepeatCount: (repeatCount: number) => void
  readonly setAspectRatio: (aspectRatio: CarouselAspectRatio) => void
  readonly setTransition: (transition: CarouselTransition) => void
  readonly setViewPreset: (viewId: string, presetId: CarouselCardPresetId) => void
  readonly setViewDurationSeconds: (viewId: string, seconds: number | null) => void
  readonly setShortText: (viewId: string, field: keyof CarouselShortText, value: string) => void
  readonly setCaption: (viewId: string, value: string) => void
  readonly setImagePosition: (viewId: string, imagePosition: CarouselImagePosition) => void
  readonly attachCatalogReference: (viewId: string, reference: ElceCatalogReference) => void
  readonly importMediaFile: (viewId: string, file: File) => void
  readonly clearMedia: (viewId: string) => void
  readonly deleteCarousel: () => void
}

export interface ElceCarouselEditorProps {
  readonly bdcId: string
  readonly content: CarouselContent
  readonly selectedViewId: string | null
  readonly mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly actions: ElceCarouselEditorActions
}
