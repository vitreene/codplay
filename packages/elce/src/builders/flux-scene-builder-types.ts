import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId } from '../domain/document-types'
import type { MediaType } from '../config/document-config-types'

export type FluxMediaSources = Readonly<Record<MediaId, string>>

export type FluxSceneBuildOptions = Readonly<{
  readonly mediaSources?: FluxMediaSources
  readonly mediaTypes?: Readonly<Record<MediaId, MediaType>>
}>

export interface FluxQuestionReset {
  readonly eventName: string
}

export interface FluxSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly scrollPortId: string
  readonly bottomMarkerId: string
  readonly storyIds: readonly string[]
  readonly styleSheets: readonly string[]
  readonly questionReset?: FluxQuestionReset
}
