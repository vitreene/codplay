import type { BdcId, MediaId } from '../../domain/document-types'
import type { ElceAnchorDropTarget } from '../../domain/anchor-types'

export type { ElceAnchorDropTarget } from '../../domain/anchor-types'

export interface ElceAnchorAttributes {
  readonly bdcId: BdcId
  readonly partId: string
  readonly paddingBottom: string
  readonly mediaId?: MediaId | null
  readonly mediaType?: 'image' | 'video' | null
}

export type ElceAnchorTransaction =
  | Readonly<{ kind: 'file-drop'; file: File; target: ElceAnchorDropTarget }>
  | Readonly<{ kind: 'move'; bdcId: BdcId }>
  | Readonly<{ kind: 'remove'; bdcId: BdcId }>

export interface ElceAnchorExtensionOptions {
  readonly createFileDropTarget?: (file: File) => ElceAnchorDropTarget | null
  readonly resolveMediaSource?: (mediaId: MediaId, mediaType: 'image' | 'video') => string | null
}
