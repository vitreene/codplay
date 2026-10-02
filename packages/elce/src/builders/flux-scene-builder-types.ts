import type { SceneDoc } from 'codplay/scene/types'
import type { MediaId } from '../domain/document-types'

export type FluxMediaSources = Readonly<Record<MediaId, string>>

export type FluxSceneBuildOptions = Readonly<{
  readonly mediaSources?: FluxMediaSources
}>

export interface FluxSceneBuild {
  readonly sceneDoc: SceneDoc<string>
  readonly scrollPortId: string
  readonly bottomMarkerId: string
  readonly storyIds: readonly string[]
}
