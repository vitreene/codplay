import { Trash2 } from 'lucide-react'
import type { Bdc } from '../../../domain/document/document-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'
import type { ElceCarouselEditorProps } from '../../facades/carousel/carousel-facade-types'
import { CardBdcEditorFields } from './card-editor-fields'
import './card-editor.css'

export type CardEditorProps = Readonly<{
  readonly bdc: Bdc
  readonly mediaById: ElceCarouselEditorProps['mediaById']
  readonly actions: ElceCardEditorActions
  readonly onDelete: () => void
}>

/** Edits one standalone Diapo Card using the same fields as Carousel Cards. */
export function CardEditor({ bdc, mediaById, actions, onDelete }: CardEditorProps) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  return (
    <section id={`elce-card-editor-${bdc.id}`} className="elce-card-editor" aria-label="Éditeur de carte autonome">
      <header id={`elce-card-editor-header-${bdc.id}`} className="elce-card-editor__header">
        <h3 id={`elce-card-editor-title-${bdc.id}`} className="elce-card-editor__title">Carte</h3>
        <button
          id={`elce-card-editor-delete-${bdc.id}`}
          className="elce-card-editor__delete"
          type="button"
          aria-label="Supprimer la carte de cette Diapo"
          title="Supprimer la carte de cette Diapo"
          onClick={onDelete}
        ><Trash2 aria-hidden="true" size={14} /></button>
      </header>
      <CardBdcEditorFields
        bdc={bdc}
        mediaById={mediaById}
        actions={actions}
        idPrefix="elce-card"
        imageAspectRatio={null}
      />
    </section>
  )
}
