import type { ElceDocument } from '../domain/document/document-model'
import type { MediaId, PageId } from '../domain/document/document-types'
import type { ProjectTestState } from '../domain/summary-profile/test-state-types'
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
  readonly testState?: ProjectTestState
  readonly onTestStateChange?: (state: ProjectTestState) => void
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}>
