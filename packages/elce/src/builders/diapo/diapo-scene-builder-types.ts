import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId } from '../../domain/document-types'
import type { MediaType } from '../../config/document-config-types'

export interface DiapoQuestionReset {
  readonly eventName: string
}

export type DiapoSceneBuildOptions = Readonly<{
  readonly mediaSources?: Readonly<Record<MediaId, string>>
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
}>

export interface DiapoSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly styleSheets: readonly string[]
  readonly questionReset?: DiapoQuestionReset
}
