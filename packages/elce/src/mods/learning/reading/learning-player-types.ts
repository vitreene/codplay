import type { LearningDocument } from '../document/learning-document'
import type { CodPlayOptions } from 'codplay'
import type { MediaId, PageId } from '../../../core/document/content-document-types'
import type { ProjectTestState } from './learning-test-state-types'
import type { ElceScormProgressSink } from '../../../scorm/scorm-types'
import type { PageSceneCache } from '../../../core/reading/page-scene-cache'

export type LearningPlayerOptions = Readonly<{
  readonly stage: HTMLElement
  readonly document: LearningDocument
  readonly startPageId?: PageId
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly sceneCache?: PageSceneCache
  readonly frameScheduler?: CodPlayOptions['frameScheduler']
  readonly testState?: ProjectTestState
  readonly scormSession?: ElceScormProgressSink
  readonly onTestStateChange?: (state: ProjectTestState) => void
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}>
