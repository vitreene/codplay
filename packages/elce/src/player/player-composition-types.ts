import type { ElceDocument } from '../domain/document-model'
import type { MediaId, PageId } from '../domain/document-types'

export type ElcePlayerCompositionOptions = Readonly<{
  readonly stage: HTMLElement
  readonly document: ElceDocument
  readonly startPageId?: PageId
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}>
