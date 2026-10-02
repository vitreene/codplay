import type { Bdc } from '../../domain/document-types'
import type { ElceAnchorDropTarget, ElceSectionChange } from '../../domain/anchor-types'
import type { MediaId } from '../../domain/document-types'

export type SectionEditorChange = ElceSectionChange

export interface SectionEditorProps {
  readonly bdc: Bdc
  readonly createFileDropTarget?: (file: File) => ElceAnchorDropTarget | null
  readonly resolveMediaSource?: (mediaId: MediaId, mediaType: 'image' | 'video') => string | null
  readonly onChange: (change: SectionEditorChange) => void
}
