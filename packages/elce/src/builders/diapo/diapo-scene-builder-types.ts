import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId } from '../../domain/document/document-types'
import type { ElceResolvedPageSettings } from '../../domain/editor-settings/editor-settings-types'
import type { ChapterType, MediaType } from '../../config/document-config-types'
import type { AppearanceClassNamesByTarget } from '../scene-style/appearance-class-names.ts'

export interface DiapoQuestionReset {
  readonly eventName: string
}

export type DiapoSceneBuildOptions = Readonly<{
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
  readonly chapterType?: ChapterType
  readonly editorSettings: ElceResolvedPageSettings
  readonly appearanceClassNamesByTarget?: AppearanceClassNamesByTarget
}>

export interface DiapoSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly styleSheets: readonly string[]
  readonly questionReset?: DiapoQuestionReset
}
