import type { ApiResult, BuilderCompileOutput, ResourceManifest } from '../builder/types'
import type { StrapCollection } from '../player/strap-types'
import type { Player } from '../player'
import type { StoryEvent } from '../player'
import type { SceneDoc } from '../player/types'
import type { TelcoApi } from '../telco/types'

export type CodPlayLoadInput = {
  /** Scène telle que décrite par l'auteur (SceneDoc). Le compilateur reçoit SceneDef en interne. */
  scene: SceneDoc
  mountTarget: unknown
  strapCollection?: StrapCollection
  extraResources?: ResourceManifest['entries']
  enableInteractionLock?: boolean
}

export type CodPlayApi = {
  player: Player
  telco: TelcoApi
  load: (input: CodPlayLoadInput) => Promise<ApiResult<BuilderCompileOutput>>
  emit: (input: StoryEvent) => Promise<ApiResult<void>>
}
