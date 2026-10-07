import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId, RevelationTransitionDefaults } from '../../domain/document/document-types'
import type { ChapterType, MediaType } from '../../config/document-config-types'

export interface DiapoQuestionReset {
  readonly eventName: string
}

export type DiapoSceneBuildOptions = Readonly<{
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
  readonly chapterType?: ChapterType
  readonly revelationDefaults?: RevelationTransitionDefaults
}>

export interface DiapoSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly styleSheets: readonly string[]
  readonly questionReset?: DiapoQuestionReset
}
