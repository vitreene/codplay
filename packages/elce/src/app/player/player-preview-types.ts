import type { ElceDocument } from '../../domain/document/document-model'
import type { MediaId, PageId } from '../../domain/document/document-types'
import type { ElcePageSceneCache } from '../../player/player-composition-types'

export interface PlayerPreviewProps {
  readonly documentModel: ElceDocument
  readonly selectedPageId: PageId | null
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly sceneCache?: ElcePageSceneCache
}
