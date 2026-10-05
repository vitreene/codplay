import type { ElceDocument } from '../domain/document-model'
import type { MediaId, PageId } from '../domain/document-types'
import type { SightySceneSourceValue } from '@codplay/sighty'

export type ElcePageSceneCache = Map<string, Readonly<{
  signature: string
  source: SightySceneSourceValue
  styleSheets: readonly string[]
}>>

export type ElcePlayerCompositionOptions = Readonly<{
  readonly stage: HTMLElement
  readonly document: ElceDocument
  readonly startPageId?: PageId
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly sceneCache?: ElcePageSceneCache
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}>
