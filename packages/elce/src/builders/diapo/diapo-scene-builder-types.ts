import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId, RevelationTransitionDefaults } from '../../domain/document/document-types'
import type { ChapterType, MediaType } from '../../config/document-config-types'
import type { TestAnswerState } from '../../domain/summary-profile/test-state-types'

export interface DiapoQuestionReset {
  readonly eventName: string
}

export type DiapoSceneBuildOptions = Readonly<{
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
  readonly chapterType?: ChapterType
  readonly revelationDefaults?: RevelationTransitionDefaults
  readonly questionAnswers?: Readonly<Record<string, TestAnswerState>>
}>

export interface DiapoSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly styleSheets: readonly string[]
  readonly questionReset?: DiapoQuestionReset
}
